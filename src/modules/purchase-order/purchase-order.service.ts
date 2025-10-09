import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventService } from '../events/event.service';
import { POStatus, Prisma, PurchaseOrder, UserRole, PRStatus } from '@prisma/client';

export interface CreatePODto {
  poNumber?: string;
  title: string;
  description?: string;
  amount: number;
  currencyId?: string;
  taxAmount?: number;
  totalAmount?: number;
  expectedDelivery?: Date;
  items: any; // Detailed line items
  terms?: any;
  prId?: string;
  contractId?: string;
  vendorIds: string[];
}

export interface UpdatePODto {
  title?: string;
  description?: string;
  amount?: number;
  currencyId?: string;
  taxAmount?: number;
  totalAmount?: number;
  expectedDelivery?: Date;
  items?: any;
  terms?: any;
  status?: POStatus;
}

export interface ApprovePODto {
  approved: boolean;
  rejectionReason?: string;
  comments?: string;
}

@Injectable()
export class PurchaseOrderService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private events: EventService,
  ) {}

  async create(createPODto: CreatePODto, createdById: string): Promise<PurchaseOrder> {
    try {
      // Generate PO number if not provided
      const poNumber = createPODto.poNumber || await this.generatePONumber();

      // Check if PO number is unique
      const existingPO = await this.prisma.purchaseOrder.findUnique({
        where: { poNumber },
      });

      if (existingPO) {
        throw new BadRequestException('PO number already exists');
      }

      // Validate PR if provided
      if (createPODto.prId) {
        const pr = await this.prisma.purchaseRequisition.findFirst({
          where: { id: createPODto.prId, deletedAt: null },
        });

        if (!pr) {
          throw new NotFoundException('Purchase Requisition not found');
        }

        if (pr.status !== PRStatus.APPROVED) {
          throw new BadRequestException('Can only create POs from approved PRs');
        }
      }

      // Validate contract if provided
      if (createPODto.contractId) {
        const contract = await this.prisma.contract.findFirst({
          where: { id: createPODto.contractId, deletedAt: null },
        });

        if (!contract) {
          throw new NotFoundException('Contract not found');
        }
      }

      // Calculate total amount if not provided
      const totalAmount = createPODto.totalAmount || 
        (createPODto.amount + (createPODto.taxAmount || 0));

      const po = await this.prisma.purchaseOrder.create({
        data: {
          poNumber,
          title: createPODto.title,
          description: createPODto.description,
          amount: createPODto.amount,
          currencyId: createPODto.currencyId,
          taxAmount: createPODto.taxAmount,
          totalAmount,
          expectedDelivery: createPODto.expectedDelivery,
          items: createPODto.items,
          terms: createPODto.terms,
          prId: createPODto.prId,
          contractId: createPODto.contractId,
          createdById,
          status: POStatus.DRAFT,
        },
        include: {
          purchaseRequisition: true,
          contract: true,
          currency: true,
          creator: true,
          approver: true,
        },
      });

      // Add vendors
      if (createPODto.vendorIds && createPODto.vendorIds.length > 0) {
        await this.addVendors(po.id, createPODto.vendorIds, createdById);
      }

      // Audit log
      await this.audit.log({
        action: 'PO_CREATED',
        targetType: 'PurchaseOrder',
        targetId: po.id,
        userId: createdById,
        oldValues: null,
        newValues: po,
      });

      // Emit event
      await this.events.emit('po.created', {
        poId: po.id,
        createdById,
        po,
      });

      return po;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to create purchase order');
    }
  }

  async findAll(
    page = 1,
    limit = 10,
    status?: POStatus,
    createdById?: string,
    contractId?: string,
  ): Promise<{ pos: PurchaseOrder[]; total: number }> {
    const skip = (page - 1) * limit;
    const where: Prisma.PurchaseOrderWhereInput = {
      deletedAt: null,
      ...(status && { status }),
      ...(createdById && { createdById }),
      ...(contractId && { contractId }),
    };

    const [pos, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        include: {
          purchaseRequisition: true,
          contract: true,
          currency: true,
          creator: true,
          approver: true,
          vendors: {
            include: {
              vendor: true,
            },
          },
          _count: {
            select: {
              goodsReceipts: true,
              invoices: true,
              payments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { pos, total };
  }

  async findOne(id: string): Promise<PurchaseOrder> {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        purchaseRequisition: {
          include: {
            requester: true,
          },
        },
        contract: {
          include: {
            owner: true,
          },
        },
        currency: true,
        creator: true,
        approver: true,
        vendors: {
          include: {
            vendor: true,
          },
        },
        goodsReceipts: {
          include: {
            documents: true,
          },
        },
        invoices: {
          include: {
            vendor: true,
            payments: true,
          },
        },
        payments: {
          include: {
            invoice: true,
          },
        },
        documents: true,
      },
    });

    if (!po) {
      throw new NotFoundException('Purchase Order not found');
    }

    return po;
  }

  async update(id: string, updatePODto: UpdatePODto, userId: string): Promise<PurchaseOrder> {
    const existingPO = await this.findOne(id);

    // Check if PO can be updated
    if (existingPO.status === POStatus.COMPLETED || existingPO.status === POStatus.CANCELLED) {
      throw new BadRequestException('Completed or cancelled POs cannot be updated');
    }

    // Check if user has permission to update
    if (existingPO.createdById !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || ![UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE].includes(user.role as any)) {
        throw new ForbiddenException('You can only update your own POs');
      }
    }

    // Check if status transition is valid
    if (updatePODto.status && !this.isValidStatusTransition(existingPO.status, updatePODto.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${existingPO.status} to ${updatePODto.status}`
      );
    }

    // Recalculate total amount if amounts changed
    let totalAmount = updatePODto.totalAmount;
    if ((updatePODto.amount !== undefined || updatePODto.taxAmount !== undefined) && !totalAmount) {
      const baseAmount = updatePODto.amount || Number(existingPO.amount);
      const taxAmount = updatePODto.taxAmount || Number(existingPO.taxAmount || 0);
      totalAmount = baseAmount + taxAmount;
    }

    const updatedPO = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...updatePODto,
        ...(totalAmount && { totalAmount }),
        updatedAt: new Date(),
      },
      include: {
        purchaseRequisition: true,
        contract: true,
        currency: true,
        creator: true,
        approver: true,
        vendors: {
          include: {
            vendor: true,
          },
        },
      },
    });

    // Audit log
    await this.audit.log({
      action: 'PO_UPDATED',
      targetType: 'PurchaseOrder',
      targetId: id,
      userId: userId,
      oldValues: existingPO,
      newValues: updatedPO,
    });

    // Emit event for status changes
    if (updatePODto.status && updatePODto.status !== existingPO.status) {
      await this.events.emit('po.status_changed', {
        poId: id,
        userId,
        oldStatus: existingPO.status,
        newStatus: updatePODto.status,
        po: updatedPO,
      });
    }

    return updatedPO;
  }

  async approve(id: string, approvePODto: ApprovePODto, approverId: string): Promise<PurchaseOrder> {
    const po = await this.findOne(id);

    // Check if PO can be approved
    if (po.status !== POStatus.DRAFT) {
      throw new BadRequestException('Only draft POs can be approved');
    }

    // Check if user has approval rights
    const approver = await this.prisma.user.findUnique({ where: { id: approverId } });
    if (!approver || ![UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE, UserRole.APPROVER].includes(approver.role as any)) {
      throw new ForbiddenException('You do not have permission to approve POs');
    }

    const newStatus = approvePODto.approved ? POStatus.APPROVED : POStatus.CANCELLED;

    const updatedPO = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: newStatus,
        approvedById: approverId,
        approvedAt: approvePODto.approved ? new Date() : null,
        updatedAt: new Date(),
      },
      include: {
        purchaseRequisition: true,
        contract: true,
        currency: true,
        creator: true,
        approver: true,
        vendors: {
          include: {
            vendor: true,
          },
        },
      },
    });

    // Audit log
    await this.audit.log({
      action: approvePODto.approved ? 'PO_APPROVED' : 'PO_REJECTED',
      targetType: 'PurchaseOrder',
      targetId: id,
      userId: approverId,
      oldValues: po,
      newValues: updatedPO,
    });

    // Emit event
    await this.events.emit(approvePODto.approved ? 'po.approved' : 'po.rejected', {
      poId: id,
      approverId,
      po: updatedPO,
      comments: approvePODto.comments,
    });

    return updatedPO;
  }

  async addVendors(poId: string, vendorIds: string[], userId: string): Promise<void> {
    const po = await this.findOne(poId);

    // Check if PO is in a state where vendors can be added
    if (po.status === POStatus.COMPLETED || po.status === POStatus.CANCELLED) {
      throw new BadRequestException('Cannot add vendors to a completed or cancelled PO');
    }

    // Add vendors
    const poVendors = vendorIds.map((vendorId, index) => ({
      poId,
      vendorId,
      role: index === 0 ? 'PRIMARY' as const : 'SECONDARY' as const, // First vendor is primary
    }));

    await this.prisma.pOVendor.createMany({
      data: poVendors,
      skipDuplicates: true,
    });

    // Audit log
    await this.audit.log({
      action: 'PO_VENDORS_ADDED',
      targetType: 'PurchaseOrder',
      targetId: poId,
      userId: userId,
      oldValues: null,
      newValues: { vendorIds },
    });

    // Emit event
    await this.events.emit('po.vendors_added', {
      poId,
      userId,
      vendorIds,
    });
  }

  async removeVendor(poId: string, vendorId: string, userId: string): Promise<void> {
    await this.findOne(poId); // Check if PO exists

    await this.prisma.pOVendor.delete({
      where: {
        poId_vendorId: {
          poId,
          vendorId,
        },
      },
    });

    // Audit log
    await this.audit.log({
      action: 'PO_VENDOR_REMOVED',
      targetType: 'PurchaseOrder',
      targetId: poId,
      userId: userId,
      oldValues: null,
      newValues: { vendorId },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const po = await this.findOne(id);

    // Check if PO can be deleted
    if (po.status !== POStatus.DRAFT) {
      throw new BadRequestException('Only draft POs can be deleted');
    }

    // Check if user has permission
    if (po.createdById !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || ![UserRole.ADMIN, UserRole.MANAGER].includes(user.role as any)) {
        throw new ForbiddenException('You can only delete your own POs');
      }
    }

    // Soft delete
    await this.prisma.purchaseOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Audit log
    await this.audit.log({
      action: 'PO_DELETED',
      targetType: 'PurchaseOrder',
      targetId: id,
      userId: userId,
      oldValues: po,
      newValues: null,
    });

    // Emit event
    await this.events.emit('po.deleted', {
      poId: id,
      userId,
      po,
    });
  }

  async getPOStatistics(createdById?: string): Promise<any> {
    const where: Prisma.PurchaseOrderWhereInput = {
      deletedAt: null,
      ...(createdById && { createdById }),
    };

    const [
      totalPOs,
      draftPOs,
      approvedPOs,
      inProgressPOs,
      completedPOs,
      totalValue,
    ] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.count({ where: { ...where, status: POStatus.DRAFT } }),
      this.prisma.purchaseOrder.count({ where: { ...where, status: POStatus.APPROVED } }),
      this.prisma.purchaseOrder.count({ where: { ...where, status: POStatus.IN_PROGRESS } }),
      this.prisma.purchaseOrder.count({ where: { ...where, status: POStatus.COMPLETED } }),
      this.prisma.purchaseOrder.aggregate({
        where: { ...where, totalAmount: { not: null } },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      totalPOs,
      draftPOs,
      approvedPOs,
      inProgressPOs,
      completedPOs,
      totalValue: totalValue._sum.totalAmount || 0,
    };
  }

  private isValidStatusTransition(currentStatus: POStatus, newStatus: POStatus): boolean {
    const validTransitions: Record<POStatus, POStatus[]> = {
      [POStatus.DRAFT]: [POStatus.APPROVED, POStatus.CANCELLED],
      [POStatus.APPROVED]: [POStatus.IN_PROGRESS, POStatus.CANCELLED],
      [POStatus.IN_PROGRESS]: [POStatus.DELIVERED, POStatus.CANCELLED],
      [POStatus.DELIVERED]: [POStatus.COMPLETED],
      [POStatus.COMPLETED]: [],
      [POStatus.CANCELLED]: [],
    };

    return validTransitions[currentStatus].includes(newStatus);
  }

  async generatePONumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get the count of POs this month
    const startOfMonth = new Date(year, new Date().getMonth(), 1);
    const endOfMonth = new Date(year, new Date().getMonth() + 1, 0);
    
    const count = await this.prisma.purchaseOrder.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `PO-${year}${month}-${sequence}`;
  }

  async getPendingApprovalsForUser(userId: string): Promise<PurchaseOrder[]> {
    // Get user role to determine what POs they can approve
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || ![UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE, UserRole.APPROVER].includes(user.role as any)) {
      return [];
    }

    // Return pending POs based on role and approval limits
    return this.prisma.purchaseOrder.findMany({
      where: {
        status: POStatus.DRAFT,
        deletedAt: null,
        ...(user.role === UserRole.MANAGER && user.department && {
          creator: {
            department: user.department,
          },
        }),
      },
      include: {
        creator: true,
        contract: true,
        currency: true,
        vendors: {
          include: {
            vendor: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createFromPR(prId: string, vendorIds: string[], userId: string): Promise<PurchaseOrder> {
    const pr = await this.prisma.purchaseRequisition.findFirst({
      where: { id: prId, deletedAt: null },
      include: {
        requester: true,
        contract: true,
      },
    });

    if (!pr) {
      throw new NotFoundException('Purchase Requisition not found');
    }

    if (pr.status !== PRStatus.APPROVED) {
      throw new BadRequestException('Can only create POs from approved PRs');
    }

    const createPODto: CreatePODto = {
      title: `PO for ${pr.title}`,
      description: pr.description,
      amount: Number(pr.estimatedAmount || 0),
      expectedDelivery: pr.requiredBy,
      items: pr.items,
      prId: pr.id,
      contractId: pr.contractId,
      vendorIds,
    };

    return this.create(createPODto, userId);
  }
}