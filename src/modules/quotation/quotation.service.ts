import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventService } from '../events/event.service';
import {
  QuotationStatus,
  Prisma,
  Quotation,
  UserRole,
} from '@prisma/client';

export interface CreateQuotationDto {
  quotationNumber?: string;
  tenderId?: string;
  vendorId: string;
  amount: number;
  currencyId?: string;
  validUntil?: Date;
  items: any;
  notes?: string;
  terms?: any;
}

export interface UpdateQuotationDto {
  amount?: number;
  currencyId?: string;
  validUntil?: Date;
  items?: any;
  notes?: string;
  terms?: any;
  score?: number;
  status?: QuotationStatus;
}

@Injectable()
export class QuotationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private events: EventService,
  ) {}

  async create(
    createQuotationDto: CreateQuotationDto,
    userId: string,
  ): Promise<Quotation> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const quotationNumber =
      createQuotationDto.quotationNumber ||
      (await this.generateQuotationNumber());

    const quotation = await this.prisma.quotation.create({
      data: {
        tenantId: user.tenantId,
        quotationNumber,
        tenderId: createQuotationDto.tenderId,
        vendorId: createQuotationDto.vendorId,
        amount: createQuotationDto.amount,
        currencyId: createQuotationDto.currencyId,
        validUntil: createQuotationDto.validUntil,
        items: createQuotationDto.items,
        notes: createQuotationDto.notes,
        terms: createQuotationDto.terms,
        status: QuotationStatus.SUBMITTED,
      },
      include: {
        vendor: true,
        tender: true,
        currency: true,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId,
      action: 'CREATE',
      targetType: 'Quotation',
      targetId: quotation.id,
      newValues: quotation as any,
    });

    return quotation;
  }

  async findAll(
    tenantId: string,
    role: UserRole,
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: Quotation[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const where: Prisma.QuotationWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (role === UserRole.VENDOR) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { vendor: true },
      });

      if (user?.vendor) {
        where.vendorId = user.vendor.id;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        include: {
          vendor: true,
          tender: true,
          currency: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.quotation.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, tenantId: string): Promise<Quotation> {
    const quotation = await this.prisma.quotation.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        vendor: true,
        tender: true,
        currency: true,
      },
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    return quotation;
  }

  async update(
    id: string,
    updateQuotationDto: UpdateQuotationDto,
    tenantId: string,
    userId: string,
  ): Promise<Quotation> {
    const quotation = await this.findOne(id, tenantId);

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: updateQuotationDto,
      include: {
        vendor: true,
        tender: true,
        currency: true,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      targetType: 'Quotation',
      targetId: id,
      oldValues: quotation as any,
      newValues: updated as any,
    });

    return updated;
  }

  async delete(id: string, tenantId: string, userId: string): Promise<void> {
    await this.findOne(id, tenantId);

    await this.prisma.quotation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'DELETE',
      targetType: 'Quotation',
      targetId: id,
    });
  }

  private async generateQuotationNumber(): Promise<string> {
    const count = await this.prisma.quotation.count();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    return `QUO-${year}${month}-${String(count + 1).padStart(5, '0')}`;
  }
}
