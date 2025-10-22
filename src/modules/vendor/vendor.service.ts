import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';

export interface CreateVendorDto {
  name: string;
  registrationNumber?: string;
  taxId?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: any;
}

@Injectable()
export class VendorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createVendor(dto: CreateVendorDto) {
    // Enforce uniqueness by name+contactEmail within tenant via schema constraints where possible
    try {
      const tenantId = this.tenantContext.getTenantId();
      if (!tenantId) throw new BadRequestException('Missing tenant context');

      const vendor = await this.prisma.vendor.create({
        data: {
          tenantId,
          name: dto.name,
          registrationNumber: dto.registrationNumber || null,
          taxId: dto.taxId || null,
          contactEmail: dto.contactEmail || null,
          contactPhone: dto.contactPhone || null,
          website: dto.website || null,
          address: dto.address || null,
          status: 'ACTIVE' as any,
        } as any,
        select: {
          id: true,
          name: true,
          contactEmail: true,
          status: true,
          createdAt: true,
        },
      });
      return vendor;
    } catch (e: any) {
      // Prisma unique constraint or other errors
      throw new BadRequestException(e.message || 'Failed to create vendor');
    }
  }

  async listVendors(limit = 20, offset = 0) {
    return this.prisma.vendor.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: { id: true, name: true, contactEmail: true, status: true, createdAt: true },
    });
  }
}