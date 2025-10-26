import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EventService } from "../events/event.service";
import {
  PRStatus,
  Prisma,
  PurchaseRequisition,
  UserRole,
} from "@prisma/client";

export interface CreatePRDto {
  prNumber?: string;
  title: string;
  description?: string;
  items: any; // Array of items with specifications
  estimatedAmount?: number;
  requiredBy?: Date;
  justification?: string;
  contractId?: string;
  // SAP org refs (optional)
  companyCodeId?: string;
  plantId?: string;
  storageLocationId?: string;
  purchasingOrgId?: string;
  purchasingGroupId?: string;
}

export interface UpdatePRDto {
  title?: string;
  description?: string;
  items?: any;
  estimatedAmount?: number;
  requiredBy?: Date;
  justification?: string;
  status?: PRStatus;
}

export interface ApprovePRDto {
  approved: boolean;
  rejectionReason?: string;
  comments?: string;
}

@Injectable()
export class PurchaseRequisitionService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private events: EventService,
  ) {}

  async create(
    createPRDto: CreatePRDto,
    requesterId: string,
  ): Promise<PurchaseRequisition> {
    try {
      // Generate PR number if not provided
      const prNumber = createPRDto.prNumber || (await this.generatePRNumber());

      // Check if PR number is unique
      const existingPR = await this.prisma.purchaseRequisition.findFirst({
        where: { prNumber },
      });

      if (existingPR) {
        throw new BadRequestException("PR number already exists");
      }

      // Validate contract if provided
      if (createPRDto.contractId) {
        const contract = await this.prisma.contract.findFirst({
          where: { id: createPRDto.contractId, deletedAt: null },
        });

        if (!contract) {
          throw new NotFoundException("Contract not found");
        }

        if (contract.status !== "IN_PROGRESS") {
          throw new BadRequestException(
            "Can only create PRs for active contracts",
          );
        }
      }

      // Validate purchasing org assignment if provided
      if ((createPRDto as any).purchasingOrgId) {
        const porgId = (createPRDto as any).purchasingOrgId as string;
        const plantId = (createPRDto as any).plantId as string | undefined;
        const companyCodeId = (createPRDto as any).companyCodeId as
          | string
          | undefined;
        if (plantId || companyCodeId) {
          const assignment =
            await this.prisma.purchasingOrgAssignment.findFirst({
              where: {
                purchasingOrgId: porgId,
                ...(plantId ? { plantId } : {}),
                ...(companyCodeId ? { companyCodeId } : {}),
              },
            });
          if (!assignment)
            throw new BadRequestException(
              "Purchasing org is not assigned to the provided plant/company code",
            );
        }
      }

      // Get user's tenant ID
      const user = await this.prisma.user.findUnique({
        where: { id: requesterId },
      });
      
      if (!user) {
        throw new BadRequestException("User not found");
      }

      const pr = await this.prisma.purchaseRequisition.create({
        data: {
          tenantId: user.tenantId,
          prNumber,
          title: createPRDto.title,
          description: createPRDto.description,
          items: createPRDto.items,
          estimatedAmount: createPRDto.estimatedAmount,
          requiredBy: createPRDto.requiredBy,
          justification: createPRDto.justification,
          contractId: createPRDto.contractId,
          requesterId,
          status: PRStatus.PENDING,
          companyCodeId: (createPRDto as any).companyCodeId,
          plantId: (createPRDto as any).plantId,
          storageLocationId: (createPRDto as any).storageLocationId,
          purchasingOrgId: (createPRDto as any).purchasingOrgId,
          purchasingGroupId: (createPRDto as any).purchasingGroupId,
        } as any,
        include: {
          requester: true,
          contract: true,
          approver: true,
        },
      });

      // Audit log
      await this.audit.log({
        action: "PR_CREATED",
        targetType: "PurchaseRequisition",
        targetId: pr.id,
        userId: requesterId,
        oldValues: null,
        newValues: pr,
      });

      // Emit event to trigger approval workflow
      await this.events.emit("pr.created", {
        prId: pr.id,
        requesterId,
        pr,
      });

      return pr;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException("Failed to create purchase requisition");
    }
  }

  async findAll(
    page = 1,
    limit = 10,
    status?: PRStatus,
    requesterId?: string,
    contractId?: string,
  ): Promise<{ prs: PurchaseRequisition[]; total: number }> {
    const skip = (page - 1) * limit;
    const where: Prisma.PurchaseRequisitionWhereInput = {
      deletedAt: null,
      ...(status && { status }),
      ...(requesterId && { requesterId }),
      ...(contractId && { contractId }),
    };

    const [prs, total] = await Promise.all([
      this.prisma.purchaseRequisition.findMany({
        where,
        skip,
        take: limit,
        include: {
          requester: true,
          contract: true,
          approver: true,
          purchaseOrders: {
            include: {
              creator: true,
            },
          },
          _count: {
            select: {
              purchaseOrders: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.purchaseRequisition.count({ where }),
    ]);

    return { prs, total };
  }

  async findOne(id: string): Promise<PurchaseRequisition> {
    const pr = await this.prisma.purchaseRequisition.findFirst({
      where: { id, deletedAt: null },
      include: {
        requester: true,
        contract: {
          include: {
            owner: true,
            vendors: {
              include: {
                vendor: true,
              },
            },
          },
        },
        approver: true,
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
        documents: true,
      },
    });

    if (!pr) {
      throw new NotFoundException("Purchase Requisition not found");
    }

    return pr;
  }

  async update(
    id: string,
    updatePRDto: UpdatePRDto,
    userId: string,
  ): Promise<PurchaseRequisition> {
    const existingPR = await this.findOne(id);

    // Check if PR can be updated
    if (existingPR.status !== PRStatus.PENDING) {
      throw new BadRequestException("Only pending PRs can be updated");
    }

    // Check if user is the requester or has approval rights
    if (existingPR.requesterId !== userId) {
      const user = await this.prisma.user.findFirst({ where: { id: userId } });
      if (
        !user ||
        ![UserRole.ADMIN, UserRole.MANAGER, UserRole.APPROVER].includes(
          user.role as any,
        )
      ) {
        throw new ForbiddenException("You can only update your own PRs");
      }
    }

    const updatedPR = await this.prisma.purchaseRequisition.update({
      where: { id },
      data: {
        ...updatePRDto,
        updatedAt: new Date(),
      },
      include: {
        requester: true,
        contract: true,
        approver: true,
      },
    });

    // Audit log
    await this.audit.log({
      action: "PR_UPDATED",
      targetType: "PurchaseRequisition",
      targetId: id,
      userId: userId,
      oldValues: existingPR,
      newValues: updatedPR,
    });

    return updatedPR;
  }

  async approve(
    id: string,
    approvePRDto: ApprovePRDto,
    approverId: string,
  ): Promise<PurchaseRequisition> {
    const pr = await this.findOne(id);

    // Check if PR can be approved
    if (pr.status !== PRStatus.PENDING) {
      throw new BadRequestException("Only pending PRs can be approved");
    }

    // Check if user has approval rights
    const approver = await this.prisma.user.findFirst({
      where: { id: approverId },
    });
    if (
      !approver ||
      ![UserRole.ADMIN, UserRole.MANAGER, UserRole.APPROVER].includes(
        approver.role as any,
      )
    ) {
      throw new ForbiddenException("You do not have permission to approve PRs");
    }

    const newStatus = approvePRDto.approved
      ? PRStatus.APPROVED
      : PRStatus.REJECTED;

    const updatedPR = await this.prisma.purchaseRequisition.update({
      where: { id },
      data: {
        status: newStatus,
        approvedById: approverId,
        approvedAt: approvePRDto.approved ? new Date() : null,
        rejectionReason: approvePRDto.rejectionReason,
        updatedAt: new Date(),
      },
      include: {
        requester: true,
        contract: true,
        approver: true,
      },
    });

    // Audit log
    await this.audit.log({
      action: approvePRDto.approved ? "PR_APPROVED" : "PR_REJECTED",
      targetType: "PurchaseRequisition",
      targetId: id,
      userId: approverId,
      oldValues: pr,
      newValues: updatedPR,
    });

    // Emit event
    await this.events.emit(
      approvePRDto.approved ? "pr.approved" : "pr.rejected",
      {
        prId: id,
        approverId,
        pr: updatedPR,
        comments: approvePRDto.comments,
      },
    );

    return updatedPR;
  }

  async cancel(
    id: string,
    userId: string,
    reason?: string,
  ): Promise<PurchaseRequisition> {
    const pr = await this.findOne(id);

    // Check if PR can be cancelled
    if (pr.status === PRStatus.APPROVED) {
      throw new BadRequestException("Approved PRs cannot be cancelled");
    }

    // Check if user can cancel this PR
    if (pr.requesterId !== userId) {
      const user = await this.prisma.user.findFirst({ where: { id: userId } });
      if (
        !user ||
        ![UserRole.ADMIN, UserRole.MANAGER].includes(user.role as any)
      ) {
        throw new ForbiddenException("You can only cancel your own PRs");
      }
    }

    const updatedPR = await this.prisma.purchaseRequisition.update({
      where: { id },
      data: {
        status: PRStatus.CANCELLED,
        rejectionReason: reason,
        updatedAt: new Date(),
      },
      include: {
        requester: true,
        contract: true,
        approver: true,
      },
    });

    // Audit log
    await this.audit.log({
      action: "PR_CANCELLED",
      targetType: "PurchaseRequisition",
      targetId: id,
      userId: userId,
      oldValues: pr,
      newValues: updatedPR,
    });

    // Emit event
    await this.events.emit("pr.cancelled", {
      prId: id,
      userId,
      pr: updatedPR,
      reason,
    });

    return updatedPR;
  }

  async delete(id: string, userId: string): Promise<void> {
    const pr = await this.findOne(id);

    // Check if PR can be deleted
    if (pr.status !== PRStatus.PENDING && pr.status !== PRStatus.REJECTED) {
      throw new BadRequestException(
        "Only pending or rejected PRs can be deleted",
      );
    }

    // Check if user can delete this PR
    if (pr.requesterId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (
        !user ||
        ![UserRole.ADMIN, UserRole.MANAGER].includes(user.role as any)
      ) {
        throw new ForbiddenException("You can only delete your own PRs");
      }
    }

    // Soft delete
    await this.prisma.purchaseRequisition.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Audit log
    await this.audit.log({
      action: "PR_DELETED",
      targetType: "PurchaseRequisition",
      targetId: id,
      userId: userId,
      oldValues: pr,
      newValues: null,
    });

    // Emit event
    await this.events.emit("pr.deleted", {
      prId: id,
      userId,
      pr,
    });
  }

  async getPRStatistics(requesterId?: string): Promise<any> {
    const where: Prisma.PurchaseRequisitionWhereInput = {
      deletedAt: null,
      ...(requesterId && { requesterId }),
    };

    const [
      totalPRs,
      pendingPRs,
      approvedPRs,
      rejectedPRs,
      totalEstimatedValue,
    ] = await Promise.all([
      this.prisma.purchaseRequisition.count({ where }),
      this.prisma.purchaseRequisition.count({
        where: { ...where, status: PRStatus.PENDING },
      }),
      this.prisma.purchaseRequisition.count({
        where: { ...where, status: PRStatus.APPROVED },
      }),
      this.prisma.purchaseRequisition.count({
        where: { ...where, status: PRStatus.REJECTED },
      }),
      this.prisma.purchaseRequisition.aggregate({
        where: { ...where, estimatedAmount: { not: null } },
        _sum: { estimatedAmount: true },
      }),
    ]);

    return {
      totalPRs,
      pendingPRs,
      approvedPRs,
      rejectedPRs,
      totalEstimatedValue: totalEstimatedValue._sum.estimatedAmount || 0,
    };
  }

  async generatePRNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");

    // Get the count of PRs this month
    const startOfMonth = new Date(year, new Date().getMonth(), 1);
    const endOfMonth = new Date(year, new Date().getMonth() + 1, 0);

    const count = await this.prisma.purchaseRequisition.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    const sequence = String(count + 1).padStart(4, "0");
    return `PR-${year}${month}-${sequence}`;
  }

  async getPendingApprovalsForUser(
    userId: string,
  ): Promise<PurchaseRequisition[]> {
    // Get user role to determine what PRs they can approve
    const user = await this.prisma.user.findFirst({ where: { id: userId } });
    if (
      !user ||
      ![UserRole.ADMIN, UserRole.MANAGER, UserRole.APPROVER].includes(
        user.role as any,
      )
    ) {
      return [];
    }

    // For now, return all pending PRs based on role
    // In a more complex system, this would be based on approval workflows, departments, etc.
    return this.prisma.purchaseRequisition.findMany({
      where: {
        status: PRStatus.PENDING,
        deletedAt: null,
        ...(user.role === UserRole.MANAGER &&
          user.department && {
            requester: {
              department: user.department,
            },
          }),
      },
      include: {
        requester: true,
        contract: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }
}
