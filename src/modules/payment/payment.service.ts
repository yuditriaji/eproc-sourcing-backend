import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventService } from '../events/event.service';
import {
  PaymentStatus,
  PaymentType,
  Prisma,
  Payment,
  UserRole,
} from '@prisma/client';

export interface CreatePaymentDto {
  paymentNumber?: string;
  invoiceId?: string;
  poId: string;
  amount: number;
  paymentType: PaymentType;
  scheduledDate?: Date;
  reference?: string;
  method?: string;
  notes?: string;
}

export interface UpdatePaymentDto {
  amount?: number;
  scheduledDate?: Date;
  reference?: string;
  method?: string;
  notes?: string;
  status?: PaymentStatus;
}

export interface ApprovePaymentDto {
  approvedBy?: string;
  notes?: string;
}

export interface ProcessPaymentDto {
  reference: string;
  processedDate: Date;
  notes?: string;
}

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private events: EventService,
  ) {}

  async create(
    createPaymentDto: CreatePaymentDto,
    userId: string,
  ): Promise<Payment> {
    try {
      // Get user info
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Generate payment number if not provided
      const paymentNumber =
        createPaymentDto.paymentNumber || (await this.generatePaymentNumber());

      // Check if payment number is unique
      const existingPayment = await this.prisma.payment.findFirst({
        where: {
          tenantId: user.tenantId,
          paymentNumber,
        },
      });

      if (existingPayment) {
        throw new BadRequestException('Payment number already exists');
      }

      // Validate PO
      const po = await this.prisma.purchaseOrder.findFirst({
        where: {
          id: createPaymentDto.poId,
          tenantId: user.tenantId,
          deletedAt: null,
        },
      });

      if (!po) {
        throw new NotFoundException('Purchase Order not found');
      }

      // Validate invoice if provided
      if (createPaymentDto.invoiceId) {
        const invoice = await this.prisma.invoice.findFirst({
          where: {
            id: createPaymentDto.invoiceId,
            tenantId: user.tenantId,
            deletedAt: null,
          },
        });

        if (!invoice) {
          throw new NotFoundException('Invoice not found');
        }
      }

      const payment = await this.prisma.payment.create({
        data: {
          tenantId: user.tenantId,
          paymentNumber,
          invoiceId: createPaymentDto.invoiceId,
          poId: createPaymentDto.poId,
          amount: createPaymentDto.amount,
          paymentType: createPaymentDto.paymentType,
          requestedDate: new Date(),
          scheduledDate: createPaymentDto.scheduledDate,
          reference: createPaymentDto.reference,
          method: createPaymentDto.method,
          notes: createPaymentDto.notes,
          status: PaymentStatus.REQUESTED,
        },
        include: {
          invoice: true,
          purchaseOrder: true,
        },
      });

      // Audit log
      await this.audit.log({
        tenantId: user.tenantId,
        userId,
        action: 'CREATE',
        targetType: 'Payment',
        targetId: payment.id,
        newValues: payment as any,
      });

      // Emit event
      await this.events.emit('payment.created', {
        payment,
        userId,
        tenantId: user.tenantId,
      });

      return payment;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create payment: ${error.message}`,
      );
    }
  }

  async findAll(
    tenantId: string,
    role: UserRole,
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: PaymentStatus,
    poId?: string,
  ): Promise<{ data: Payment[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {
      tenantId,
      deletedAt: null,
      ...(status && { status }),
      ...(poId && { poId }),
    };

    // Vendors can only see payments related to their invoices/POs
    if (role === UserRole.VENDOR) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { vendor: true },
      });

      if (user?.vendor) {
        where.invoice = {
          vendorId: user.vendor.id,
        };
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        include: {
          invoice: {
            include: {
              vendor: true,
            },
          },
          purchaseOrder: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, tenantId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        invoice: {
          include: {
            vendor: true,
          },
        },
        purchaseOrder: true,
        receiver: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async update(
    id: string,
    updatePaymentDto: UpdatePaymentDto,
    tenantId: string,
    userId: string,
  ): Promise<Payment> {
    const payment = await this.findOne(id, tenantId);

    // Can't update approved or processed payments
    if (
      payment.status === PaymentStatus.APPROVED ||
      payment.status === PaymentStatus.PROCESSED
    ) {
      throw new BadRequestException(
        'Cannot update approved or processed payments',
      );
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: updatePaymentDto,
      include: {
        invoice: {
          include: {
            vendor: true,
          },
        },
        purchaseOrder: true,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      targetType: 'Payment',
      targetId: id,
      oldValues: payment as any,
      newValues: updated as any,
    });

    return updated;
  }

  async approve(
    id: string,
    dto: ApprovePaymentDto,
    tenantId: string,
    userId: string,
  ): Promise<Payment> {
    const payment = await this.findOne(id, tenantId);

    if (payment.status !== PaymentStatus.REQUESTED) {
      throw new BadRequestException('Only requested payments can be approved');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.APPROVED,
        approvedBy: dto.approvedBy || userId,
        approvedAt: new Date(),
        notes: dto.notes
          ? `${payment.notes || ''}\nApproval notes: ${dto.notes}`.trim()
          : payment.notes,
      },
      include: {
        invoice: {
          include: {
            vendor: true,
          },
        },
        purchaseOrder: true,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      targetType: 'Payment',
      targetId: id,
      oldValues: { status: payment.status } as any,
      newValues: { status: PaymentStatus.APPROVED } as any,
    });

    await this.events.emit('payment.approved', {
      payment: updated,
      userId,
      tenantId,
    });

    return updated;
  }

  async process(
    id: string,
    dto: ProcessPaymentDto,
    tenantId: string,
    userId: string,
  ): Promise<Payment> {
    const payment = await this.findOne(id, tenantId);

    if (payment.status !== PaymentStatus.APPROVED) {
      throw new BadRequestException('Only approved payments can be processed');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.PROCESSED,
        reference: dto.reference,
        processedDate: dto.processedDate,
        notes: dto.notes
          ? `${payment.notes || ''}\nProcessing notes: ${dto.notes}`.trim()
          : payment.notes,
      },
      include: {
        invoice: {
          include: {
            vendor: true,
          },
        },
        purchaseOrder: true,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      targetType: 'Payment',
      targetId: id,
      oldValues: { status: payment.status } as any,
      newValues: { status: PaymentStatus.PROCESSED, reference: dto.reference } as any,
    });

    await this.events.emit('payment.processed', {
      payment: updated,
      userId,
      tenantId,
    });

    return updated;
  }

  async receive(
    id: string,
    receivedAt: Date,
    tenantId: string,
    userId: string,
  ): Promise<Payment> {
    const payment = await this.findOne(id, tenantId);

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        receivedById: userId,
        receivedAt,
      },
      include: {
        invoice: {
          include: {
            vendor: true,
          },
        },
        purchaseOrder: true,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      targetType: 'Payment',
      targetId: id,
      newValues: { receivedAt } as any,
    });

    return updated;
  }

  async fail(
    id: string,
    reason: string,
    tenantId: string,
    userId: string,
  ): Promise<Payment> {
    const payment = await this.findOne(id, tenantId);

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.FAILED,
        notes: `${payment.notes || ''}\nFailure reason: ${reason}`.trim(),
      },
      include: {
        invoice: {
          include: {
            vendor: true,
          },
        },
        purchaseOrder: true,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      targetType: 'Payment',
      targetId: id,
      oldValues: { status: payment.status } as any,
      newValues: { status: PaymentStatus.FAILED, reason } as any,
    });

    return updated;
  }

  async cancel(
    id: string,
    reason: string,
    tenantId: string,
    userId: string,
  ): Promise<Payment> {
    const payment = await this.findOne(id, tenantId);

    if (payment.status === PaymentStatus.PROCESSED) {
      throw new BadRequestException('Cannot cancel processed payments');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.CANCELLED,
        notes: `${payment.notes || ''}\nCancellation reason: ${reason}`.trim(),
      },
      include: {
        invoice: {
          include: {
            vendor: true,
          },
        },
        purchaseOrder: true,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      targetType: 'Payment',
      targetId: id,
      oldValues: { status: payment.status } as any,
      newValues: { status: PaymentStatus.CANCELLED, reason } as any,
    });

    return updated;
  }

  async delete(id: string, tenantId: string, userId: string): Promise<void> {
    const payment = await this.findOne(id, tenantId);

    if (
      payment.status !== PaymentStatus.REQUESTED &&
      payment.status !== PaymentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Can only delete requested or cancelled payments',
      );
    }

    await this.prisma.payment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'DELETE',
      targetType: 'Payment',
      targetId: id,
    });
  }

  private async generatePaymentNumber(): Promise<string> {
    const count = await this.prisma.payment.count();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    return `PAY-${year}${month}-${String(count + 1).padStart(5, '0')}`;
  }
}
