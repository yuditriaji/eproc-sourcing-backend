import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventService } from '../events/event.service';
import {
  Budget,
  BudgetAllocation,
  BudgetTransfer,
  Prisma,
  TransferType,
} from '@prisma/client';
import {
  CreateBudgetDto,
  AllocateBudgetDto,
  TransferBudgetDto,
  DeductBudgetDto,
  BudgetUsageQueryDto,
  BudgetUsageReport,
} from '../../common/dto/budget.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class BudgetService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private events: EventService,
  ) {}

  /**
   * Create a new budget for an organization unit
   */
  async create(
    tenantId: string,
    createBudgetDto: CreateBudgetDto,
    userId: string,
  ): Promise<Budget> {
    try {
      // Check if budget already exists for this orgUnit + fiscalYear
      const existing = await this.prisma.budget.findUnique({
        where: {
          tenantId_fiscalYear_orgUnitId: {
            tenantId,
            fiscalYear: createBudgetDto.fiscalYear,
            orgUnitId: createBudgetDto.orgUnitId,
          },
        },
      });

      if (existing) {
        throw new BadRequestException(
          'Budget already exists for this organization unit and fiscal year',
        );
      }

      // Verify orgUnit exists and belongs to tenant
      const orgUnit = await this.prisma.orgUnit.findFirst({
        where: {
          id: createBudgetDto.orgUnitId,
          tenantId,
        },
      });

      if (!orgUnit) {
        throw new NotFoundException('Organization unit not found');
      }

      const budget = await this.prisma.budget.create({
        data: {
          tenantId,
          fiscalYear: createBudgetDto.fiscalYear,
          totalAmount: createBudgetDto.totalAmount,
          availableAmount: createBudgetDto.totalAmount,
          orgUnitId: createBudgetDto.orgUnitId,
          type: createBudgetDto.type,
          configId: createBudgetDto.configId,
        },
        include: {
          orgUnit: true,
        },
      });

      // Audit log
      await this.audit.log({
        action: 'BUDGET_ALLOCATE',
        targetType: 'Budget',
        targetId: budget.id,
        userId,
        oldValues: null,
        newValues: budget,
        budgetKeyFigure: {
          amount: createBudgetDto.totalAmount,
          fiscalYear: createBudgetDto.fiscalYear,
          orgUnitId: createBudgetDto.orgUnitId,
        },
      });

      // Emit event
      await this.events.emit('budget.created', {
        budgetId: budget.id,
        tenantId,
        orgUnitId: createBudgetDto.orgUnitId,
        fiscalYear: createBudgetDto.fiscalYear,
        totalAmount: createBudgetDto.totalAmount,
      });

      return budget;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(`Failed to create budget: ${error.message}`);
    }
  }

  /**
   * Allocate budget from parent to child organization units
   */
  async allocate(
    tenantId: string,
    allocateBudgetDto: AllocateBudgetDto,
    userId: string,
  ): Promise<BudgetAllocation[]> {
    return this.prisma.$transaction(async (tx) => {
      // Get source budget
      const sourceBudget = await tx.budget.findFirst({
        where: {
          id: allocateBudgetDto.fromBudgetId,
          tenantId,
        },
        include: {
          orgUnit: true,
        },
      });

      if (!sourceBudget) {
        throw new NotFoundException('Source budget not found');
      }

      // Calculate total allocation
      const totalAllocAmount = allocateBudgetDto.toOrgUnits.reduce(
        (sum, item) => sum + item.amount,
        0,
      );

      // Verify sufficient funds
      if (
        new Decimal(sourceBudget.availableAmount).lessThan(totalAllocAmount)
      ) {
        throw new BadRequestException(
          `Insufficient budget. Available: ${sourceBudget.availableAmount}, Requested: ${totalAllocAmount}`,
        );
      }

      // Create allocations
      const allocations: BudgetAllocation[] = [];
      for (const item of allocateBudgetDto.toOrgUnits) {
        // Verify target orgUnit exists
        const targetOrgUnit = await tx.orgUnit.findFirst({
          where: {
            id: item.orgUnitId,
            tenantId,
          },
        });

        if (!targetOrgUnit) {
          throw new NotFoundException(
            `Organization unit ${item.orgUnitId} not found`,
          );
        }

        // Create allocation
        const allocation = await tx.budgetAllocation.create({
          data: {
            tenantId,
            budgetId: sourceBudget.id,
            fromOrgUnitId: sourceBudget.orgUnitId,
            toOrgUnitId: item.orgUnitId,
            amount: item.amount,
            reason: allocateBudgetDto.reason,
            traceId: allocateBudgetDto.traceId,
          },
          include: {
            fromOrgUnit: true,
            toOrgUnit: true,
          },
        });

        allocations.push(allocation);

        // Audit log
        await this.audit.log({
          action: 'BUDGET_ALLOCATE',
          targetType: 'BudgetAllocation',
          targetId: allocation.id,
          userId,
          oldValues: null,
          newValues: allocation,
          budgetKeyFigure: {
            budgetId: sourceBudget.id,
            amount: item.amount,
            fromOrgUnit: sourceBudget.orgUnit.name,
            toOrgUnit: targetOrgUnit.name,
            traceId: allocateBudgetDto.traceId,
          },
        });
      }

      // Deduct from source budget
      await tx.budget.update({
        where: { id: sourceBudget.id },
        data: {
          availableAmount: {
            decrement: totalAllocAmount,
          },
        },
      });

      // Emit event
      await this.events.emit('budget.allocated', {
        budgetId: sourceBudget.id,
        tenantId,
        allocations: allocations.map((a) => ({
          allocationId: a.id,
          toOrgUnitId: a.toOrgUnitId,
          amount: a.amount,
        })),
      });

      return allocations;
    });
  }

  /**
   * Transfer budget between organization units (same or cross-level)
   */
  async transfer(
    tenantId: string,
    transferDto: TransferBudgetDto,
    userId: string,
  ): Promise<BudgetTransfer> {
    return this.prisma.$transaction(async (tx) => {
      // Get source and target budgets
      const [sourceBudget, targetBudget] = await Promise.all([
        tx.budget.findFirst({
          where: { id: transferDto.fromBudgetId, tenantId },
          include: { orgUnit: true },
        }),
        tx.budget.findFirst({
          where: { id: transferDto.targetBudgetId, tenantId },
          include: { orgUnit: true },
        }),
      ]);

      if (!sourceBudget) {
        throw new NotFoundException('Source budget not found');
      }
      if (!targetBudget) {
        throw new NotFoundException('Target budget not found');
      }

      // Verify sufficient funds
      if (
        new Decimal(sourceBudget.availableAmount).lessThan(transferDto.amount)
      ) {
        throw new BadRequestException(
          `Insufficient budget. Available: ${sourceBudget.availableAmount}, Requested: ${transferDto.amount}`,
        );
      }

      // Verify fiscal years match
      if (sourceBudget.fiscalYear !== targetBudget.fiscalYear) {
        throw new BadRequestException(
          'Cannot transfer between different fiscal years',
        );
      }

      // Create transfer record
      const transfer = await tx.budgetTransfer.create({
        data: {
          tenantId,
          budgetId: sourceBudget.id,
          targetBudgetId: targetBudget.id,
          amount: transferDto.amount,
          transferType: transferDto.type,
          approvalChain: transferDto.approvalChain || undefined,
          traceFlag: transferDto.traceFlag,
        },
        include: {
          sourceBudget: {
            include: { orgUnit: true },
          },
          targetBudget: {
            include: { orgUnit: true },
          },
        },
      });

      // Update budget amounts atomically
      await Promise.all([
        tx.budget.update({
          where: { id: sourceBudget.id },
          data: {
            availableAmount: {
              decrement: transferDto.amount,
            },
          },
        }),
        tx.budget.update({
          where: { id: targetBudget.id },
          data: {
            availableAmount: {
              increment: transferDto.amount,
            },
            transferOriginId: transfer.id,
          },
        }),
      ]);

      // Audit log
      await this.audit.log({
        action: 'BUDGET_TRANSFER',
        targetType: 'BudgetTransfer',
        targetId: transfer.id,
        userId,
        oldValues: {
          sourceAvailable: sourceBudget.availableAmount,
          targetAvailable: targetBudget.availableAmount,
        },
        newValues: {
          sourceAvailable: new Decimal(sourceBudget.availableAmount)
            .minus(transferDto.amount)
            .toNumber(),
          targetAvailable: new Decimal(targetBudget.availableAmount)
            .plus(transferDto.amount)
            .toNumber(),
        },
        budgetKeyFigure: {
          transferId: transfer.id,
          amount: transferDto.amount,
          type: transferDto.type,
          fromBudget: sourceBudget.orgUnit.name,
          toBudget: targetBudget.orgUnit.name,
          traceFlag: transferDto.traceFlag,
        },
      });

      // Emit event
      await this.events.emit('budget.transferred', {
        transferId: transfer.id,
        tenantId,
        fromBudgetId: sourceBudget.id,
        targetBudgetId: targetBudget.id,
        amount: transferDto.amount,
        type: transferDto.type,
      });

      return transfer;
    });
  }

  /**
   * Deduct budget for transaction (PO/Invoice/PR)
   */
  async deduct(
    tenantId: string,
    deductDto: DeductBudgetDto,
    userId: string,
  ): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      // Get budget
      const budget = await tx.budget.findFirst({
        where: {
          id: deductDto.budgetId,
          tenantId,
        },
        include: {
          orgUnit: true,
        },
      });

      if (!budget) {
        throw new NotFoundException('Budget not found');
      }

      // Verify sufficient funds
      if (new Decimal(budget.availableAmount).lessThan(deductDto.amount)) {
        throw new BadRequestException(
          `Insufficient budget. Available: ${budget.availableAmount}, Requested: ${deductDto.amount}`,
        );
      }

      // Deduct from budget
      await tx.budget.update({
        where: { id: budget.id },
        data: {
          availableAmount: {
            decrement: deductDto.amount,
          },
        },
      });

      // Create POItems or InvoiceItems if provided
      if (deductDto.items && deductDto.items.length > 0) {
        if (deductDto.targetType === 'PO') {
          // Create/update PO items with budget tracking
          for (const item of deductDto.items) {
            await tx.pOItem.upsert({
              where: {
                tenantId_poId_itemNumber: {
                  tenantId,
                  poId: deductDto.targetId,
                  itemNumber: item.itemNumber,
                },
              },
              create: {
                tenantId,
                poId: deductDto.targetId,
                itemNumber: item.itemNumber,
                description: `Item ${item.itemNumber}`,
                quantity: 1,
                unitPrice: item.consumedAmount,
                consumedAmount: item.consumedAmount,
                totalAmount: item.consumedAmount,
                budgetAllocationId: item.budgetAllocationId,
                transferTraceId:
                  item.transferTraceId || deductDto.transferTraceId,
              },
              update: {
                consumedAmount: item.consumedAmount,
                transferTraceId:
                  item.transferTraceId || deductDto.transferTraceId,
              },
            });
          }
        } else if (deductDto.targetType === 'INVOICE') {
          // Create/update Invoice items with budget tracking
          for (const item of deductDto.items) {
            await tx.invoiceItem.upsert({
              where: {
                tenantId_invoiceId_itemNumber: {
                  tenantId,
                  invoiceId: deductDto.targetId,
                  itemNumber: item.itemNumber,
                },
              },
              create: {
                tenantId,
                invoiceId: deductDto.targetId,
                itemNumber: item.itemNumber,
                description: `Item ${item.itemNumber}`,
                quantity: 1,
                unitPrice: item.consumedAmount,
                consumedAmount: item.consumedAmount,
                totalAmount: item.consumedAmount,
                transferTraceId:
                  item.transferTraceId || deductDto.transferTraceId,
              },
              update: {
                consumedAmount: item.consumedAmount,
                transferTraceId:
                  item.transferTraceId || deductDto.transferTraceId,
              },
            });
          }
        }
      }

      // Audit log
      await this.audit.log({
        action: 'BUDGET_DEDUCT',
        targetType: deductDto.targetType,
        targetId: deductDto.targetId,
        userId,
        oldValues: {
          availableAmount: budget.availableAmount,
        },
        newValues: {
          availableAmount: new Decimal(budget.availableAmount)
            .minus(deductDto.amount)
            .toNumber(),
        },
        budgetKeyFigure: {
          budgetId: budget.id,
          amount: deductDto.amount,
          orgUnit: budget.orgUnit.name,
          transferTraceId: deductDto.transferTraceId,
          targetType: deductDto.targetType,
          targetId: deductDto.targetId,
        },
      });

      // Emit event
      await this.events.emit('budget.deducted', {
        budgetId: budget.id,
        tenantId,
        amount: deductDto.amount,
        targetType: deductDto.targetType,
        targetId: deductDto.targetId,
        transferTraceId: deductDto.transferTraceId,
      });
    });
  }

  /**
   * Generate budget usage report with transfer traceability
   */
  async usageReport(
    tenantId: string,
    query: BudgetUsageQueryDto,
  ): Promise<BudgetUsageReport> {
    // Build where clause
    const where: Prisma.BudgetWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.budgetId && { id: query.budgetId }),
      ...(query.orgUnitId && { orgUnitId: query.orgUnitId }),
      ...(query.fiscalYear && { fiscalYear: query.fiscalYear }),
      ...(query.level && { type: query.level }),
    };

    // Get budget
    const budget = await this.prisma.budget.findFirst({
      where,
      include: {
        orgUnit: true,
        allocationsFrom: {
          include: {
            toOrgUnit: true,
          },
        },
        transfersOut: {
          include: {
            targetBudget: {
              include: { orgUnit: true },
            },
          },
          where: query.traceId ? { id: query.traceId } : undefined,
        },
        transfersIn: {
          include: {
            sourceBudget: {
              include: { orgUnit: true },
            },
          },
          where: query.traceId ? { id: query.traceId } : undefined,
        },
        purchaseOrders: {
          include: {
            poItems: {
              where: query.traceId ? { transferTraceId: query.traceId } : undefined,
            },
          },
        },
        invoices: {
          include: {
            invoiceItems: {
              where: query.traceId ? { transferTraceId: query.traceId } : undefined,
            },
          },
        },
      },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    // Calculate consumed amount
    const consumedAmount =
      new Decimal(budget.totalAmount).minus(budget.availableAmount).toNumber();
    const consumedPercent =
      (consumedAmount / parseFloat(budget.totalAmount.toString())) * 100;

    // Build report
    const report: BudgetUsageReport = {
      budgetId: budget.id,
      fiscalYear: budget.fiscalYear,
      totalAmount: parseFloat(budget.totalAmount.toString()),
      availableAmount: parseFloat(budget.availableAmount.toString()),
      consumedAmount,
      consumedPercent,
      orgUnit: {
        id: budget.orgUnit.id,
        name: budget.orgUnit.name,
        type: budget.orgUnit.type,
      },
      allocations: budget.allocationsFrom.map((alloc) => ({
        toOrgUnit: alloc.toOrgUnit.name,
        amount: parseFloat(alloc.amount.toString()),
        allocatedAt: alloc.allocatedAt,
      })),
      transfers: [
        ...budget.transfersOut.map((t) => ({
          type: 'OUT' as const,
          amount: parseFloat(t.amount.toString()),
          counterpartyBudget: t.targetBudget.orgUnit.name,
          transferredAt: t.transferredAt,
          traceId: t.id,
        })),
        ...budget.transfersIn.map((t) => ({
          type: 'IN' as const,
          amount: parseFloat(t.amount.toString()),
          counterpartyBudget: t.sourceBudget.orgUnit.name,
          transferredAt: t.transferredAt,
          traceId: t.id,
        })),
      ],
      usage: {
        purchaseOrders: budget.purchaseOrders.map((po) => ({
          poNumber: po.poNumber,
          amount: parseFloat(po.totalCommitted?.toString() || po.totalAmount?.toString() || '0'),
          transferTraceId: po.transferTraceId || undefined,
          items: po.poItems.map((item) => ({
            itemNumber: item.itemNumber,
            consumedAmount: parseFloat(item.consumedAmount.toString()),
            transferTraceId: item.transferTraceId || undefined,
          })),
        })),
        invoices: budget.invoices.map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          amount: parseFloat(inv.totalBilled?.toString() || inv.totalAmount.toString()),
          transferTraceId: inv.transferTraceId || undefined,
          items: inv.invoiceItems.map((item) => ({
            itemNumber: item.itemNumber,
            consumedAmount: parseFloat(item.consumedAmount.toString()),
            transferTraceId: item.transferTraceId || undefined,
          })),
        })),
      },
    };

    return report;
  }

  /**
   * Get all budgets for a tenant
   */
  async findAll(
    tenantId: string,
    fiscalYear?: string,
    orgUnitId?: string,
  ): Promise<Budget[]> {
    return this.prisma.budget.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(fiscalYear && { fiscalYear }),
        ...(orgUnitId && { orgUnitId }),
      },
      include: {
        orgUnit: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get a single budget
   */
  async findOne(tenantId: string, budgetId: string): Promise<Budget> {
    const budget = await this.prisma.budget.findFirst({
      where: {
        id: budgetId,
        tenantId,
        deletedAt: null,
      },
      include: {
        orgUnit: true,
        allocationsFrom: {
          include: {
            toOrgUnit: true,
          },
        },
        transfersOut: {
          include: {
            targetBudget: {
              include: { orgUnit: true },
            },
          },
        },
        transfersIn: {
          include: {
            sourceBudget: {
              include: { orgUnit: true },
            },
          },
        },
      },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    return budget;
  }
}
