import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';

export interface CreateCurrencyDto {
  code: string;
  symbol: string;
  name: string;
  exchangeRate?: number;
  isActive?: boolean;
}

export interface UpdateCurrencyDto {
  symbol?: string;
  name?: string;
  exchangeRate?: number;
  isActive?: boolean;
}

@Injectable()
export class CurrencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createCurrency(dto: CreateCurrencyDto, tenantId?: string) {
    const actualTenantId = tenantId || this.tenantContext.getTenantId();
    
    // Check if currency code already exists for this tenant
    const existing = await this.prisma.currency.findUnique({
      where: {
        tenantId_code: {
          tenantId: actualTenantId,
          code: dto.code,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Currency code ${dto.code} already exists`);
    }

    return this.prisma.currency.create({
      data: {
        tenantId: actualTenantId,
        code: dto.code,
        symbol: dto.symbol,
        name: dto.name,
        exchangeRate: dto.exchangeRate || 1.0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async listCurrencies(limit = 20, offset = 0, isActive?: boolean, search?: string) {
    const tenantId = this.tenantContext.getTenantId();
    const where: any = { tenantId };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [currencies, total] = await Promise.all([
      this.prisma.currency.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
      }),
      this.prisma.currency.count({ where }),
    ]);

    return {
      data: currencies,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async getCurrency(id: string) {
    const tenantId = this.tenantContext.getTenantId();
    
    const currency = await this.prisma.currency.findFirst({
      where: { id, tenantId },
    });

    if (!currency) {
      throw new NotFoundException('Currency not found');
    }

    return currency;
  }

  async updateCurrency(id: string, dto: UpdateCurrencyDto) {
    const tenantId = this.tenantContext.getTenantId();

    const existing = await this.prisma.currency.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Currency not found');
    }

    return this.prisma.currency.update({
      where: { id },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });
  }

  async deleteCurrency(id: string) {
    const tenantId = this.tenantContext.getTenantId();

    const existing = await this.prisma.currency.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Currency not found');
    }

    // Check if currency is in use
    const [contractsCount, posCount, invoicesCount] = await Promise.all([
      this.prisma.contract.count({ where: { currencyId: id, tenantId } }),
      this.prisma.purchaseOrder.count({ where: { currencyId: id, tenantId } }),
      this.prisma.invoice.count({ where: { currencyId: id, tenantId } }),
    ]);

    if (contractsCount > 0 || posCount > 0 || invoicesCount > 0) {
      throw new ConflictException(
        'Cannot delete currency that is in use by contracts, purchase orders, or invoices',
      );
    }

    return this.prisma.currency.delete({
      where: { id },
    });
  }

  async getActiveCurrencies() {
    const tenantId = this.tenantContext.getTenantId();
    
    return this.prisma.currency.findMany({
      where: { tenantId, isActive: true },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        symbol: true,
        name: true,
        exchangeRate: true,
      },
    });
  }
}