import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";

export interface CreateVendorDto {
  name: string;
  // org refs
  companyCodeId?: string;
  plantId?: string;
  storageLocationId?: string;
  purchasingOrgId?: string;
  purchasingGroupId?: string;
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
      if (!tenantId) throw new BadRequestException("Missing tenant context");

      // Validate purchasing org assignment if provided
      const porgId = dto.purchasingOrgId;
      const plantId = dto.plantId;
      const companyCodeId = dto.companyCodeId;
      if (porgId && (plantId || companyCodeId)) {
        const assignment = await this.prisma.purchasingOrgAssignment.findFirst({
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

      const vendor = await this.prisma.vendor.create({
        data: {
          tenantId,
          name: dto.name,
          companyCodeId: dto.companyCodeId || null,
          plantId: dto.plantId || null,
          storageLocationId: dto.storageLocationId || null,
          purchasingOrgId: dto.purchasingOrgId || null,
          purchasingGroupId: dto.purchasingGroupId || null,
          registrationNumber: dto.registrationNumber || null,
          taxId: dto.taxId || null,
          contactEmail: dto.contactEmail || null,
          contactPhone: dto.contactPhone || null,
          website: dto.website || null,
          address: dto.address || null,
          status: "ACTIVE" as any,
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
      throw new BadRequestException(e.message || "Failed to create vendor");
    }
  }

  async listVendors(limit = 20, offset = 0) {
    return this.prisma.vendor.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        name: true,
        contactEmail: true,
        status: true,
        createdAt: true,
      },
    });
  }
}
