import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EventService } from "../events/event.service";
import { ContractStatus, Prisma, Contract, User } from "@prisma/client";

export interface CreateContractDto {
  contractNumber: string;
  title: string;
  description?: string;
  totalAmount?: number;
  currencyId?: string;
  startDate?: Date;
  endDate?: Date;
  terms?: any;
  deliverables?: any;
  vendorIds?: string[];
}

export interface UpdateContractDto {
  title?: string;
  description?: string;
  totalAmount?: number;
  currencyId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: ContractStatus;
  terms?: any;
  deliverables?: any;
}

@Injectable()
export class ContractService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private events: EventService,
  ) {}

  async create(
    createContractDto: CreateContractDto,
    ownerId: string,
  ): Promise<Contract> {
    try {
      // Get user to find tenantId
      const owner = await this.prisma.user.findUnique({
        where: { id: ownerId },
      });
      
      if (!owner) {
        throw new BadRequestException("Owner not found");
      }

      // Check if contract number is unique within tenant
      const existingContract = await this.prisma.contract.findFirst({
        where: { 
          tenantId: owner.tenantId,
          contractNumber: createContractDto.contractNumber 
        },
      });

      if (existingContract) {
        throw new BadRequestException("Contract number already exists");
      }

      const contract = await this.prisma.contract.create({
        data: {
          tenantId: owner.tenantId,
          contractNumber: createContractDto.contractNumber,
          title: createContractDto.title,
          description: createContractDto.description,
          totalAmount: createContractDto.totalAmount,
          currencyId: createContractDto.currencyId,
          startDate: createContractDto.startDate,
          endDate: createContractDto.endDate,
          terms: createContractDto.terms,
          deliverables: createContractDto.deliverables,
          ownerId,
          status: ContractStatus.DRAFT,
        },
        include: {
          owner: true,
          currency: true,
          vendors: {
            include: {
              vendor: true,
            },
          },
        },
      });
      // Add vendors if provided
      if (
        createContractDto.vendorIds &&
        createContractDto.vendorIds.length > 0
      ) {
        await this.addVendors(
          contract.id,
          createContractDto.vendorIds,
          ownerId,
        );
      }

      // Audit log
      await this.audit.log({
        action: "CREATE",
        targetType: "Contract",
        targetId: contract.id,
        userId: ownerId,
        oldValues: null,
        newValues: contract,
      });

      // Emit event
      await this.events.emit("contract.created", {
        contractId: contract.id,
        ownerId,
        contract,
      });

      return contract;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create contract: ${error.message}`,
      );
    }
  }

  async findAll(
    page = 1,
    limit = 10,
    status?: ContractStatus,
    ownerId?: string,
  ): Promise<{ contracts: Contract[]; total: number }> {
    const skip = (page - 1) * limit;
    const where: Prisma.ContractWhereInput = {
      deletedAt: null,
      ...(status && { status }),
      ...(ownerId && { ownerId }),
    };

    const [contracts, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip,
        take: limit,
        include: {
          owner: true,
          currency: true,
          vendors: {
            include: {
              vendor: true,
            },
          },
          _count: {
            select: {
              purchaseRequisitions: true,
              purchaseOrders: true,
              tenders: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.contract.count({ where }),
    ]);

    return { contracts, total };
  }

  async findOne(id: string): Promise<Contract> {
    const contract = await this.prisma.contract.findFirst({
      where: { id, deletedAt: null },
      include: {
        owner: true,
        currency: true,
        vendors: {
          include: {
            vendor: true,
          },
        },
        purchaseRequisitions: {
          include: {
            requester: true,
          },
        },
        purchaseOrders: {
          include: {
            creator: true,
            vendors: {
              include: {
                vendor: true,
              },
            },
          },
        },
        tenders: {
          include: {
            creator: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException("Contract not found");
    }

    return contract;
  }

  async update(
    id: string,
    updateContractDto: UpdateContractDto,
    userId: string,
  ): Promise<Contract> {
    const existingContract = await this.findOne(id);

    // Check if status transition is valid
    if (
      updateContractDto.status &&
      !this.isValidStatusTransition(
        existingContract.status,
        updateContractDto.status,
      )
    ) {
      throw new BadRequestException(
        `Invalid status transition from ${existingContract.status} to ${updateContractDto.status}`,
      );
    }

    const updatedContract = await this.prisma.contract.update({
      where: { id },
      data: {
        ...updateContractDto,
        updatedAt: new Date(),
      },
      include: {
        owner: true,
        currency: true,
        vendors: {
          include: {
            vendor: true,
          },
        },
      },
    });

    // Audit log
    await this.audit.log({
      action: "UPDATE",
      targetType: "Contract",
      targetId: id,
      userId: userId,
      oldValues: existingContract,
      newValues: updatedContract,
    });

    // Emit event for status changes
    if (
      updateContractDto.status &&
      updateContractDto.status !== existingContract.status
    ) {
      await this.events.emit("contract.status_changed", {
        contractId: id,
        userId,
        oldStatus: existingContract.status,
        newStatus: updateContractDto.status,
        contract: updatedContract,
      });
    }

    return updatedContract;
  }

  async addVendors(
    contractId: string,
    vendorIds: string[],
    userId: string,
  ): Promise<void> {
    const contract = await this.findOne(contractId);

    // Check if contract is in a state where vendors can be added
    if (
      contract.status === ContractStatus.COMPLETED ||
      contract.status === ContractStatus.CLOSED
    ) {
      throw new BadRequestException(
        "Cannot add vendors to a completed or closed contract",
      );
    }

    // Add vendors
    const contractVendors = vendorIds.map((vendorId, index) => ({
      contractId,
      vendorId,
      role: index === 0 ? ("PRIMARY" as const) : ("SECONDARY" as const), // First vendor is primary
    }));

    await this.prisma.contractVendor.createMany({
      data: contractVendors as any,
      skipDuplicates: true,
    });

    // Audit log
    await this.audit.log({
      action: "UPDATE",
      targetType: "Contract",
      targetId: contractId,
      userId: userId,
      oldValues: null,
      newValues: { vendorIds },
    });

    // Emit event
    await this.events.emit("contract.vendors_added", {
      contractId,
      userId,
      vendorIds,
    });
  }

  async removeVendor(
    contractId: string,
    vendorId: string,
    userId: string,
  ): Promise<void> {
    await this.findOne(contractId); // Check if contract exists

    await this.prisma.contractVendor.deleteMany({
      where: {
        contractId,
        vendorId,
      },
    });

    // Audit log
    await this.audit.log({
      action: "UPDATE",
      targetType: "Contract",
      targetId: contractId,
      userId: userId,
      oldValues: null,
      newValues: { vendorId },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const contract = await this.findOne(id);

    // Check if contract can be deleted
    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException("Only draft contracts can be deleted");
    }

    // Soft delete
    await this.prisma.contract.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Audit log
    await this.audit.log({
      action: "DELETE",
      targetType: "Contract",
      targetId: id,
      userId: userId,
      oldValues: contract,
      newValues: null,
    });

    // Emit event
    await this.events.emit("contract.deleted", {
      contractId: id,
      userId,
      contract,
    });
  }

  async getContractStatistics(ownerId?: string): Promise<any> {
    const where: Prisma.ContractWhereInput = {
      deletedAt: null,
      ...(ownerId && { ownerId }),
    };

    const [
      totalContracts,
      draftContracts,
      inProgressContracts,
      completedContracts,
      totalValue,
    ] = await Promise.all([
      this.prisma.contract.count({ where }),
      this.prisma.contract.count({
        where: { ...where, status: ContractStatus.DRAFT },
      }),
      this.prisma.contract.count({
        where: { ...where, status: ContractStatus.IN_PROGRESS },
      }),
      this.prisma.contract.count({
        where: { ...where, status: ContractStatus.COMPLETED },
      }),
      this.prisma.contract.aggregate({
        where: { ...where, totalAmount: { not: null } },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      totalContracts,
      draftContracts,
      inProgressContracts,
      completedContracts,
      totalValue: totalValue._sum.totalAmount || 0,
    };
  }

  private isValidStatusTransition(
    currentStatus: ContractStatus,
    newStatus: ContractStatus,
  ): boolean {
    const validTransitions: Record<ContractStatus, ContractStatus[]> = {
      [ContractStatus.DRAFT]: [ContractStatus.IN_PROGRESS],
      [ContractStatus.IN_PROGRESS]: [
        ContractStatus.COMPLETED,
        ContractStatus.TERMINATED,
      ],
      [ContractStatus.COMPLETED]: [ContractStatus.CLOSED],
      [ContractStatus.CLOSED]: [],
      [ContractStatus.TERMINATED]: [],
    };

    return validTransitions[currentStatus].includes(newStatus);
  }

  async generateContractNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");

    // Get the count of contracts this month
    const startOfMonth = new Date(year, new Date().getMonth(), 1);
    const endOfMonth = new Date(year, new Date().getMonth() + 1, 0);

    const count = await this.prisma.contract.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    const sequence = String(count + 1).padStart(4, "0");
    return `CON-${year}${month}-${sequence}`;
  }
}
