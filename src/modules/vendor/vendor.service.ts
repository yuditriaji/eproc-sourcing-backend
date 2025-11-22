import { BadRequestException, Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";

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
  bankDetails?: any;
  businessType?: string;
  yearEstablished?: number;
  employeeCount?: number;
  annualRevenue?: number;
  certifications?: any;
  insuranceInfo?: any;
}

export interface UpdateVendorDto {
  name?: string;
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
  businessType?: string;
  yearEstablished?: number;
  employeeCount?: number;
  annualRevenue?: number;
  certifications?: any;
  insuranceInfo?: any;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_APPROVAL' | 'BLACKLISTED';
}

@Injectable()
export class VendorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createVendor(dto: CreateVendorDto, tenantId?: string) {
    // Enforce uniqueness by name+contactEmail within tenant via schema constraints where possible
    try {
      const resolvedTenantId = tenantId || this.tenantContext.getTenantId();
      if (!resolvedTenantId) throw new BadRequestException("Missing tenant context");

      // Validate purchasing org assignment if provided
      const porgId = dto.purchasingOrgId;
      const plantId = dto.plantId;
      const companyCodeId = dto.companyCodeId;
      if (porgId && (plantId || companyCodeId)) {
        // Check if purchasing org is assigned to company code
        const companyAssignment = companyCodeId ? await this.prisma.purchasingOrgAssignment.findFirst({
          where: {
            purchasingOrgId: porgId,
            companyCodeId: companyCodeId,
          },
        }) : null;
        
        // Check if purchasing org is assigned to plant
        const plantAssignment = plantId ? await this.prisma.purchasingOrgAssignment.findFirst({
          where: {
            purchasingOrgId: porgId,
            plantId: plantId,
          },
        }) : null;
        
        // At least one assignment must exist
        if (!companyAssignment && !plantAssignment) {
          throw new BadRequestException(
            "Purchasing org is not assigned to the provided plant/company code",
          );
        }
      }

      const vendor = await this.prisma.vendor.create({
        data: {
          tenantId: resolvedTenantId,
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
          bankDetails: dto.bankDetails || null,
          businessType: dto.businessType || null,
          yearEstablished: dto.yearEstablished || null,
          employeeCount: dto.employeeCount || null,
          annualRevenue: dto.annualRevenue || null,
          certifications: dto.certifications || null,
          insuranceInfo: dto.insuranceInfo || null,
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

  async listVendors(limit = 20, offset = 0, status?: string, search?: string, companyCodeId?: string, purchasingOrgId?: string) {
    const tenantId = this.tenantContext.getTenantId();
    const where: any = { tenantId, deletedAt: null };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { registrationNumber: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (companyCodeId) {
      where.companyCodeId = companyCodeId;
    }

    if (purchasingOrgId) {
      where.purchasingOrgId = purchasingOrgId;
    }

    const [vendors, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          companyCode: { select: { code: true, name: true } },
          plant: { select: { code: true, name: true } },
          purchasingOrg: { select: { code: true, name: true } },
          purchasingGroup: { select: { code: true, name: true } },
        },
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return {
      data: vendors,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async getVendor(id: string) {
    const tenantId = this.tenantContext.getTenantId();
    
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        companyCode: { select: { code: true, name: true } },
        plant: { select: { code: true, name: true } },
        storageLocation: { select: { code: true, name: true } },
        purchasingOrg: { select: { code: true, name: true } },
        purchasingGroup: { select: { code: true, name: true } },
        contracts: {
          select: { 
            contract: {
              select: { id: true, contractNumber: true, status: true }
            }
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        bids: {
          select: { id: true, tender: { select: { tenderNumber: true, title: true } }, status: true },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  async updateVendor(id: string, dto: UpdateVendorDto) {
    const tenantId = this.tenantContext.getTenantId();

    const existing = await this.prisma.vendor.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Vendor not found');
    }

    // Validate purchasing org assignment if provided
    if (dto.purchasingOrgId && (dto.plantId || dto.companyCodeId)) {
      const assignment = await this.prisma.purchasingOrgAssignment.findFirst({
        where: {
          purchasingOrgId: dto.purchasingOrgId,
          ...(dto.plantId ? { plantId: dto.plantId } : {}),
          ...(dto.companyCodeId ? { companyCodeId: dto.companyCodeId } : {}),
          tenantId,
        },
      });
      if (!assignment) {
        throw new BadRequestException(
          "Purchasing org is not assigned to the provided plant/company code",
        );
      }
    }

    try {
      return await this.prisma.vendor.update({
        where: { id },
        data: {
          ...dto,
          updatedAt: new Date(),
        },
        include: {
          companyCode: { select: { code: true, name: true } },
          plant: { select: { code: true, name: true } },
          storageLocation: { select: { code: true, name: true } },
          purchasingOrg: { select: { code: true, name: true } },
          purchasingGroup: { select: { code: true, name: true } },
        },
      });
    } catch (e: any) {
      throw new BadRequestException(e.message || "Failed to update vendor");
    }
  }

  async deleteVendor(id: string) {
    const tenantId = this.tenantContext.getTenantId();

    const existing = await this.prisma.vendor.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Vendor not found');
    }

    // Check if vendor has active relationships
    const [contractsCount, bidsCount, quotationsCount, posCount] = await Promise.all([
      this.prisma.contractVendor.count({ where: { vendorId: id, tenantId } }),
      this.prisma.bid.count({ where: { vendorId: id, tenantId } }),
      this.prisma.quotation.count({ where: { vendorId: id, tenantId } }),
      this.prisma.pOVendor.count({ where: { vendorId: id, tenantId } }),
    ]);

    const totalRelationships = contractsCount + bidsCount + quotationsCount + posCount;

    if (totalRelationships > 0) {
      // Soft delete if vendor has relationships
      return await this.prisma.vendor.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'INACTIVE' as any,
        },
      });
    } else {
      // Hard delete if no relationships
      return await this.prisma.vendor.delete({
        where: { id },
      });
    }
  }

  async updateVendorRating(id: string, rating: number, onTimeDelivery?: number, tenantId?: string) {
    const resolvedTenantId = tenantId || this.tenantContext.getTenantId();

    const existing = await this.prisma.vendor.findFirst({
      where: { id, tenantId: resolvedTenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Vendor not found');
    }

    if (rating < 0 || rating > 5) {
      throw new BadRequestException('Rating must be between 0 and 5');
    }

    if (onTimeDelivery !== undefined && (onTimeDelivery < 0 || onTimeDelivery > 100)) {
      throw new BadRequestException('On-time delivery must be between 0 and 100');
    }

    return await this.prisma.vendor.update({
      where: { id },
      data: {
        rating,
        ...(onTimeDelivery !== undefined ? { onTimeDelivery } : {}),
        updatedAt: new Date(),
      },
    });
  }

  async getActiveVendors() {
    const tenantId = this.tenantContext.getTenantId();
    
    return this.prisma.vendor.findMany({
      where: { tenantId, status: 'ACTIVE', deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        contactEmail: true,
        registrationNumber: true,
        rating: true,
      },
    });
  }

  /**
   * Generate a secure random password
   * Format: [Uppercase][Lowercase][Numbers][Special]...
   * Example: Td8#kL2@pR9!
   */
  private generateSecurePassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + special;
    
    let password = '';
    
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Create user account for vendor with auto-generated password
   */
  async createVendorUser(
    vendorId: string,
    dto: { email: string; username?: string; firstName?: string; lastName?: string },
    tenantId: string,
    adminUserId: string,
  ) {
    // Verify vendor exists
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, tenantId, deletedAt: null },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // Check if user with email already exists
    const existingUser = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Generate secure temporary password
    const temporaryPassword = this.generateSecurePassword(12);
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Generate username if not provided
    const username = dto.username || dto.email.split('@')[0];

    // Create user with VENDOR role
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        username,
        password: hashedPassword,
        firstName: dto.firstName || vendor.name,
        lastName: dto.lastName || '',
        role: 'VENDOR' as any,
        isVerified: true,  // Auto-verified since created by admin
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Log audit trail
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId,
        action: 'CREATE' as any,
        entity: 'User',
        entityId: user.id,
        newValues: {
          email: user.email,
          username: user.username,
          role: user.role,
          vendorId: vendorId,
          vendorName: vendor.name,
        },
      },
    });

    return {
      user,
      temporaryPassword,
      message: 'User created successfully. Send these credentials to the vendor. They must change the password on first login.',
    };
  }
}
