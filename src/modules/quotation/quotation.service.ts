import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventService } from '../events/event.service';
import {
  QuotationStatus,
  Prisma,
  Quotation,
  UserRoleEnum,
} from '@prisma/client';

export interface CreateQuotationDto {
  quotationNumber?: string;
  rfqId?: string; // P2P Workflow - Link to RFQ
  tenderId?: string; // Legacy: Keep for backward compatibility
  vendorId?: string; // Optional - auto-detect from user if not provided
  amount: number;
  currencyId?: string;
  validUntil?: Date | string;
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
  ) { }

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

    // Auto-detect vendorId if not provided
    let vendorId = createQuotationDto.vendorId;
    if (!vendorId) {
      // Try 1: Look up vendor by user's email matching vendor contactEmail
      let vendor = await this.prisma.vendor.findFirst({
        where: {
          tenantId: user.tenantId,
          contactEmail: user.email,
        },
      });

      // Try 2: Look up vendor by username (email prefix) in vendor name
      if (!vendor && user.role === 'VENDOR') {
        // Extract username from email (e.g., vendor@sam.com -> vendor, sam)
        const emailParts = user.email.split('@');
        const username = emailParts[0]; // e.g., "vendor"
        const domain = emailParts[1]?.split('.')[0]; // e.g., "sam"

        // Try to find vendor by username in name
        vendor = await this.prisma.vendor.findFirst({
          where: {
            tenantId: user.tenantId,
            name: { contains: username, mode: 'insensitive' },
            status: 'ACTIVE',
          },
        });

        // If not found, try domain name
        if (!vendor && domain) {
          vendor = await this.prisma.vendor.findFirst({
            where: {
              tenantId: user.tenantId,
              name: { contains: domain, mode: 'insensitive' },
              status: 'ACTIVE',
            },
          });
        }
      }

      // Try 3: For VENDOR role, look for vendor by user's full name
      if (!vendor && user.role === 'VENDOR') {
        const userName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
        if (userName) {
          vendor = await this.prisma.vendor.findFirst({
            where: {
              tenantId: user.tenantId,
              name: { contains: userName, mode: 'insensitive' },
              status: 'ACTIVE',
            },
          });
        }
      }

      // NO MORE BROAD FALLBACK - require proper vendor linking
      if (vendor) {
        vendorId = vendor.id;
      }
    }
    if (!vendorId) {
      throw new BadRequestException(
        'Could not determine your vendor profile. Please ensure your user email matches the vendor contact email, ' +
        'or contact admin to link your account to a vendor.'
      );
    }

    // Validate RFQ if provided
    if (createQuotationDto.rfqId) {
      const rfq = await this.prisma.rFQ.findUnique({
        where: { id: createQuotationDto.rfqId },
      });
      if (!rfq) {
        throw new BadRequestException('RFQ not found');
      }
      if (rfq.status !== 'PUBLISHED') {
        throw new BadRequestException('RFQ is not open for quotations');
      }
    }

    const quotationNumber =
      createQuotationDto.quotationNumber ||
      (await this.generateQuotationNumber());

    // Parse validUntil if it's a string
    let validUntil: Date | undefined;
    if (createQuotationDto.validUntil) {
      validUntil = typeof createQuotationDto.validUntil === 'string'
        ? new Date(createQuotationDto.validUntil)
        : createQuotationDto.validUntil;
    }

    const quotation = await this.prisma.quotation.create({
      data: {
        tenantId: user.tenantId,
        quotationNumber,
        rfqId: createQuotationDto.rfqId,
        tenderId: createQuotationDto.tenderId,
        vendorId,
        amount: createQuotationDto.amount,
        currencyId: createQuotationDto.currencyId,
        validUntil,
        items: createQuotationDto.items,
        notes: createQuotationDto.notes,
        terms: createQuotationDto.terms,
        status: QuotationStatus.SUBMITTED,
      },
      include: {
        vendor: true,
        rfq: true,
        tender: true,
        currency: true,
      },
    });

    await this.audit.log({
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
    role: UserRoleEnum,
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: string,
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

    // Filter by status if provided
    if (status) {
      where.status = status as any;
    }

    // Vendors can only see their own quotations
    if (role === UserRoleEnum.VENDOR) {
      // Look up the vendor linked to this user
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (user) {
        // Try 1: Find vendor by email match
        let vendor = await this.prisma.vendor.findFirst({
          where: {
            tenantId,
            contactEmail: user.email,
          },
        });

        // Try 2: Look up vendor by username (email prefix) in vendor name
        if (!vendor) {
          const emailParts = user.email.split('@');
          const username = emailParts[0];
          const domain = emailParts[1]?.split('.')[0];

          vendor = await this.prisma.vendor.findFirst({
            where: {
              tenantId,
              name: { contains: username, mode: 'insensitive' },
              status: 'ACTIVE',
            },
          });

          if (!vendor && domain) {
            vendor = await this.prisma.vendor.findFirst({
              where: {
                tenantId,
                name: { contains: domain, mode: 'insensitive' },
                status: 'ACTIVE',
              },
            });
          }
        }

        // Try 3: Look for vendor by user's full name
        if (!vendor) {
          const userName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
          if (userName) {
            vendor = await this.prisma.vendor.findFirst({
              where: {
                tenantId,
                name: { contains: userName, mode: 'insensitive' },
                status: 'ACTIVE',
              },
            });
          }
        }

        if (vendor) {
          where.vendorId = vendor.id;
        } else {
          // No vendor found - return empty results
          where.vendorId = 'no-vendor-found';
        }
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        include: {
          vendor: true,
          rfq: true,
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
        rfq: true,
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
