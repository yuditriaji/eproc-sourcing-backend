import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventService } from '../events/event.service';
import { BudgetService } from '../budget/budget.service';
import {
  InvoiceStatus,
  Prisma,
  Invoice,
  UserRoleEnum,
  POStatus,
} from '@prisma/client';

export interface CreateInvoiceDto {
  invoiceNumber?: string;
  poId?: string;
  vendorId: string;
  amount: number;
  currencyId?: string;
  taxAmount?: number;
  totalAmount: number;
  invoiceDate?: Date;
  dueDate?: Date;
  items: any;
  notes?: string;
  // Budget control fields
  budgetId?: string;
  transferTraceId?: string;
}

export interface UpdateInvoiceDto {
  amount?: number;
  currencyId?: string;
  taxAmount?: number;
  totalAmount?: number;
  invoiceDate?: Date;
  dueDate?: Date;
  items?: any;
  notes?: string;
  status?: InvoiceStatus;
}

export interface ApproveInvoiceDto {
  notes?: string;
}

export interface DisputeInvoiceDto {
  reason: string;
}

@Injectable()
export class InvoiceService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private events: EventService,
    @Inject(forwardRef(() => BudgetService))
    private budgetService: BudgetService,
  ) {}

  async create(
    createInvoiceDto: CreateInvoiceDto,
    userId: string,
  ): Promise<Invoice> {
    try {
      // Get user info
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Generate invoice number if not provided
      const invoiceNumber =
        createInvoiceDto.invoiceNumber || (await this.generateInvoiceNumber());

      // Check if invoice number is unique
      const existingInvoice = await this.prisma.invoice.findFirst({
        where: {
          tenantId: user.tenantId,
          invoiceNumber,
        },
      });

      if (existingInvoice) {
        throw new BadRequestException('Invoice number already exists');
      }

      // Validate PO if provided
      if (createInvoiceDto.poId) {
        const po = await this.prisma.purchaseOrder.findFirst({
          where: {
            id: createInvoiceDto.poId,
            tenantId: user.tenantId,
            deletedAt: null,
          },
        });

        if (!po) {
          throw new NotFoundException('Purchase Order not found');
        }

        if (po.status !== POStatus.APPROVED && po.status !== POStatus.COMPLETED) {
          throw new BadRequestException(
            'Can only create invoices for approved or completed POs',
          );
        }
      }

      // Validate vendor
      const vendor = await this.prisma.vendor.findFirst({
        where: {
          id: createInvoiceDto.vendorId,
          tenantId: user.tenantId,
          deletedAt: null,
        },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      const invoice = await this.prisma.invoice.create({
        data: {
          tenantId: user.tenantId,
          invoiceNumber,
          poId: createInvoiceDto.poId,
          vendorId: createInvoiceDto.vendorId,
          amount: createInvoiceDto.amount,
          currencyId: createInvoiceDto.currencyId,
          taxAmount: createInvoiceDto.taxAmount,
          totalAmount: createInvoiceDto.totalAmount,
          invoiceDate: createInvoiceDto.invoiceDate || new Date(),
          dueDate: createInvoiceDto.dueDate,
          items: createInvoiceDto.items,
          notes: createInvoiceDto.notes,
          status: InvoiceStatus.PENDING,
          budgetId: createInvoiceDto.budgetId,
          transferTraceId: createInvoiceDto.transferTraceId,
        },
        include: {
          vendor: true,
          purchaseOrder: true,
          currency: true,
        },
      });

      // Audit log
      await this.audit.log({
        userId,
        action: 'CREATE',
        targetType: 'Invoice',
        targetId: invoice.id,
        newValues: invoice as any,
      });

      // Emit event
      await this.events.emit('invoice.created', {
        invoice,
        userId,
        tenantId: user.tenantId,
      });

      return invoice;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create invoice: ${error.message}`,
      );
    }
  }

  async findAll(
    tenantId: string,
    role: UserRoleEnum,
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: InvoiceStatus,
    vendorId?: string,
  ): Promise<{ data: Invoice[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      tenantId,
      deletedAt: null,
      ...(status && { status }),
      ...(vendorId && { vendorId }),
    };

    // Vendors can only see their invoices (invoice.vendorId should match related vendor)
    // Note: This assumes vendors are linked via vendorId field in invoices
    if (role === UserRoleEnum.VENDOR && vendorId) {
      where.vendorId = vendorId;
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          vendor: true,
          purchaseOrder: true,
          currency: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, tenantId: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        vendor: true,
        purchaseOrder: true,
        currency: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async update(
    id: string,
    updateInvoiceDto: UpdateInvoiceDto,
    tenantId: string,
    userId: string,
  ): Promise<Invoice> {
    const invoice = await this.findOne(id, tenantId);

    // Can't update approved or paid invoices
    if (
      invoice.status === InvoiceStatus.APPROVED ||
      invoice.status === InvoiceStatus.PAID
    ) {
      throw new BadRequestException(
        'Cannot update approved or paid invoices',
      );
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: updateInvoiceDto,
      include: {
        vendor: true,
        purchaseOrder: true,
        currency: true,
      },
    });

    await this.audit.log({
      userId,
      action: 'UPDATE',
      targetType: 'Invoice',
      targetId: id,
      oldValues: invoice as any,
      newValues: updated as any,
    });

    return updated;
  }

  async approve(
    id: string,
    dto: ApproveInvoiceDto,
    tenantId: string,
    userId: string,
  ): Promise<Invoice> {
    const invoice = await this.findOne(id, tenantId);

    if (invoice.status !== InvoiceStatus.PENDING) {
      throw new BadRequestException('Only pending invoices can be approved');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.APPROVED,
        notes: dto.notes
          ? `${invoice.notes || ''}\nApproval notes: ${dto.notes}`.trim()
          : invoice.notes,
      },
      include: {
        vendor: true,
        purchaseOrder: true,
        currency: true,
      },
    });

    await this.audit.log({
      userId,
      action: 'UPDATE',
      targetType: 'Invoice',
      targetId: id,
      oldValues: { status: invoice.status } as any,
      newValues: { status: InvoiceStatus.APPROVED } as any,
    });

    await this.events.emit('invoice.approved', {
      invoice: updated,
      userId,
      tenantId,
    });

    return updated;
  }

  async updateStatus(
    id: string,
    status: InvoiceStatus,
    tenantId: string,
    userId: string,
  ): Promise<Invoice> {
    const invoice = await this.findOne(id, tenantId);

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status },
      include: {
        vendor: true,
        purchaseOrder: true,
        currency: true,
      },
    });

    await this.audit.log({
      userId,
      action: 'UPDATE',
      targetType: 'Invoice',
      targetId: id,
      oldValues: { status: invoice.status } as any,
      newValues: { status } as any,
    });

    await this.events.emit('invoice.status_changed', {
      invoice: updated,
      oldStatus: invoice.status,
      newStatus: status,
      userId,
      tenantId,
    });

    return updated;
  }

  async dispute(
    id: string,
    dto: DisputeInvoiceDto,
    tenantId: string,
    userId: string,
  ): Promise<Invoice> {
    const invoice = await this.findOne(id, tenantId);

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.DISPUTED,
        notes: `${invoice.notes || ''}\nDispute reason: ${dto.reason}`.trim(),
      },
      include: {
        vendor: true,
        purchaseOrder: true,
        currency: true,
      },
    });

    await this.audit.log({
      userId,
      action: 'UPDATE',
      targetType: 'Invoice',
      targetId: id,
      oldValues: { status: invoice.status } as any,
      newValues: { status: InvoiceStatus.DISPUTED, reason: dto.reason } as any,
    });

    return updated;
  }

  async cancel(
    id: string,
    reason: string,
    tenantId: string,
    userId: string,
  ): Promise<Invoice> {
    const invoice = await this.findOne(id, tenantId);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot cancel paid invoices');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.CANCELLED,
        notes: `${invoice.notes || ''}\nCancellation reason: ${reason}`.trim(),
      },
      include: {
        vendor: true,
        purchaseOrder: true,
        currency: true,
      },
    });

    await this.audit.log({
      userId,
      action: 'UPDATE',
      targetType: 'Invoice',
      targetId: id,
      oldValues: { status: invoice.status } as any,
      newValues: { status: InvoiceStatus.CANCELLED, reason } as any,
    });

    return updated;
  }

  async delete(id: string, tenantId: string, userId: string): Promise<void> {
    const invoice = await this.findOne(id, tenantId);

    if (invoice.status !== InvoiceStatus.PENDING && invoice.status !== InvoiceStatus.CANCELLED) {
      throw new BadRequestException(
        'Can only delete pending or cancelled invoices',
      );
    }

    await this.prisma.invoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId,
      action: 'DELETE',
      targetType: 'Invoice',
      targetId: id,
    });
  }

  private async generateInvoiceNumber(): Promise<string> {
    const count = await this.prisma.invoice.count();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    return `INV-${year}${month}-${String(count + 1).padStart(5, '0')}`;
  }
}
