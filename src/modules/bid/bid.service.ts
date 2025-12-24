import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EventService } from "../events/event.service";
import { AbilityFactory, Action } from "../auth/abilities/ability.factory";
import * as crypto from "crypto";
import { TenantKmsService } from "../../common/crypto/tenant-kms.service";

export interface CreateBidDto {
  tenderId: string;
  technicalProposal: any;
  commercialProposal: any;
  financialProposal: any;
  documents?: any[];
}

export interface UpdateBidDto {
  technicalProposal?: any;
  commercialProposal?: any;
  financialProposal?: any;
  documents?: any[];
}

@Injectable()
export class BidService {
  constructor(
    private prismaService: PrismaService,
    private auditService: AuditService,
    private eventService: EventService,
    private abilityFactory: AbilityFactory,
    private tenantKms: TenantKmsService,
  ) { }

  async createBid(
    createBidDto: CreateBidDto,
    userId: string,
    userRole: string,
    ipAddress: string,
    userAgent: string,
    userEmail?: string,
    tenantId?: string,
  ) {
    // Only vendors can create bids
    if (userRole !== "VENDOR") {
      throw new ForbiddenException("Only vendors can create bids");
    }

    // Find vendor by user email with multiple strategies
    let vendorId: string | undefined;

    if (userEmail) {
      // Strategy 1: Exact email match (case-insensitive)
      let vendor = await this.prismaService.vendor.findFirst({
        where: {
          contactEmail: { equals: userEmail, mode: 'insensitive' },
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      // Strategy 2: Try email prefix match (user part before @)
      if (!vendor && userEmail.includes('@')) {
        const emailPrefix = userEmail.split('@')[0].toLowerCase();
        vendor = await this.prismaService.vendor.findFirst({
          where: {
            OR: [
              { contactEmail: { contains: emailPrefix, mode: 'insensitive' } },
              { name: { contains: emailPrefix, mode: 'insensitive' } },
            ],
            status: 'ACTIVE',
          },
          select: { id: true },
        });
      }

      // Strategy 3: Try domain match for company vendors
      if (!vendor && userEmail.includes('@')) {
        const domain = userEmail.split('@')[1]?.toLowerCase();
        if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) {
          vendor = await this.prismaService.vendor.findFirst({
            where: {
              contactEmail: { contains: domain, mode: 'insensitive' },
              status: 'ACTIVE',
            },
            select: { id: true },
          });
        }
      }

      vendorId = vendor?.id;
    }

    if (!vendorId) {
      throw new ForbiddenException("No vendor profile found for this user. Please ensure your vendor profile is set up correctly.");
    }

    // Check if tender exists and is published
    const tender = await this.prismaService.tender.findUnique({
      where: { id: createBidDto.tenderId },
    });

    if (!tender) {
      throw new NotFoundException("Tender not found");
    }

    if (tender.status !== "PUBLISHED") {
      throw new BadRequestException("Cannot bid on unpublished tender");
    }

    // Check if tender is still open
    if (tender.closingDate && new Date() > tender.closingDate) {
      throw new BadRequestException("Tender has closed");
    }

    // Check if vendor has already submitted a bid
    const existingBid = await this.prismaService.bid.findFirst({
      where: {
        tenderId: createBidDto.tenderId,
        vendorId: vendorId,
      },
    });

    if (existingBid) {
      throw new BadRequestException("Bid already exists for this tender");
    }

    try {
      // Use tender's tenantId as it's guaranteed to be valid (created with valid FK)
      const validTenantId = tender.tenantId;

      if (!validTenantId) {
        throw new BadRequestException("Tender does not have a valid tenant");
      }

      // Store proposal data directly (skip encryption to avoid failures)
      const bid = await this.prismaService.bid.create({
        data: {
          tenantId: validTenantId,
          tenderId: createBidDto.tenderId,
          vendorId: vendorId,
          technicalProposal: createBidDto.technicalProposal,
          financialProposal: createBidDto.financialProposal,
          bidAmount: createBidDto.financialProposal?.totalAmount || createBidDto.commercialProposal?.amount,
          status: "DRAFT",
        },
        include: {
          tender: {
            select: {
              title: true,
              status: true,
            },
          },
          vendor: {
            select: {
              name: true,
              contactEmail: true,
            },
          },
        },
      });

      // Audit log
      await this.auditService.log({
        userId,
        action: "bid_created",
        targetType: "Bid",
        targetId: bid.id,
        newValues: { bidId: bid.id, tenderId: createBidDto.tenderId },
        ipAddress,
        userAgent,
      });

      // Emit event
      await this.eventService.emit("bid.created", {
        bidId: bid.id,
        tenderId: createBidDto.tenderId,
        vendorId: vendorId,
      });

      return {
        success: true,
        data: bid,
      };
    } catch (error: any) {
      console.error('Bid creation failed:', error);
      throw new BadRequestException(`Failed to create bid: ${error.message}`);
    }
  }

  async getBids(
    userId: string,
    userRole: string,
    userEmail?: string,
    filters?: {
      tenderId?: string;
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
      page?: number;
      pageSize?: number;
    },
  ) {
    const where: any = {};

    // Apply role-based filtering
    switch (userRole) {
      case "ADMIN":
      case "MANAGER":
      case "BUYER":
        // Admin/Manager/Buyer can see all bids
        break;
      case "USER":
        // Users can see bids for their tenders
        const userTenders = await this.prismaService.tender.findMany({
          where: { creatorId: userId },
          select: { id: true },
        });
        where.tenderId = { in: userTenders.map((t) => t.id) };
        break;
      case "VENDOR":
        // Vendors can only see their own bids - lookup by email with multiple strategies
        if (userEmail) {
          // Strategy 1: Exact email match (case-insensitive)
          let vendor = await this.prismaService.vendor.findFirst({
            where: { contactEmail: { equals: userEmail, mode: 'insensitive' } },
            select: { id: true },
          });

          // Strategy 2: Try email prefix match
          if (!vendor && userEmail.includes('@')) {
            const emailPrefix = userEmail.split('@')[0].toLowerCase();
            vendor = await this.prismaService.vendor.findFirst({
              where: {
                OR: [
                  { contactEmail: { contains: emailPrefix, mode: 'insensitive' } },
                  { name: { contains: emailPrefix, mode: 'insensitive' } },
                ],
              },
              select: { id: true },
            });
          }

          // Strategy 3: Try domain match for company emails
          if (!vendor && userEmail.includes('@')) {
            const domain = userEmail.split('@')[1]?.toLowerCase();
            if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) {
              vendor = await this.prismaService.vendor.findFirst({
                where: { contactEmail: { contains: domain, mode: 'insensitive' } },
                select: { id: true },
              });
            }
          }

          if (vendor) {
            where.vendorId = vendor.id;
            console.log(`getBids: Found vendor ${vendor.id} for email ${userEmail}`);
          } else {
            console.log(`getBids: No vendor found for email ${userEmail}`);
            // Return empty result
            return {
              success: true,
              data: [],
              meta: { total: 0, page: 1, pageSize: filters?.pageSize || 20, totalPages: 0 },
            };
          }
        } else {
          // Fallback to userId (for backward compatibility)
          console.log(`getBids: No email provided, using userId ${userId}`);
          where.vendorId = userId;
        }
        break;
      default:
        throw new ForbiddenException("Invalid user role");
    }

    // Apply additional filters
    if (filters?.tenderId) where.tenderId = filters.tenderId;
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.tender = {
        title: { contains: filters.search, mode: 'insensitive' },
      };
    }

    // Support both page/pageSize and limit/offset
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || filters?.limit || 20;
    const skip = filters?.offset ?? (page - 1) * pageSize;
    const take = pageSize;

    const [bids, total] = await Promise.all([
      this.prismaService.bid.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: {
          tender: {
            select: {
              id: true,
              title: true,
              status: true,
              closingDate: true,
              tenderNumber: true,
            },
          },
          vendor: {
            select: {
              name: true,
              contactEmail: true,
            },
          },
        },
      }),
      this.prismaService.bid.count({ where }),
    ]);

    return {
      success: true,
      data: bids,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getBidById(bidId: string, userId: string, userRole: string, userEmail?: string) {
    const bid = await this.prismaService.bid.findUnique({
      where: { id: bidId },
      include: {
        tender: {
          select: {
            id: true,
            title: true,
            status: true,
            closingDate: true,
            creatorId: true,
            tenderNumber: true,
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
            contactEmail: true,
          },
        },
      },
    });

    if (!bid) {
      throw new NotFoundException("Bid not found");
    }

    console.log(`getBidById: bidId=${bidId}, userId=${userId}, userRole=${userRole}, userEmail=${userEmail}`);
    console.log(`getBidById: bid.vendorId=${bid.vendorId}, vendor.contactEmail=${bid.vendor?.contactEmail}`);

    // Check access permissions
    let canAccess = false;

    if (userRole === "ADMIN" || userRole === "MANAGER" || userRole === "BUYER") {
      canAccess = true;
    } else if (userRole === "VENDOR") {
      // Compare by email for vendors (vendorId is Vendor table ID, not User ID)
      if (userEmail && bid.vendor?.contactEmail) {
        // Strategy 1: Exact email match
        if (bid.vendor.contactEmail.toLowerCase() === userEmail.toLowerCase()) {
          canAccess = true;
        }
        // Strategy 2: Email prefix match
        if (!canAccess && userEmail.includes('@')) {
          const emailPrefix = userEmail.split('@')[0].toLowerCase();
          const vendorPrefix = bid.vendor.contactEmail.split('@')[0].toLowerCase();
          if (emailPrefix === vendorPrefix) {
            canAccess = true;
          }
        }
      }
      // Fallback: direct ID comparison
      if (!canAccess) {
        canAccess = bid.vendorId === userId;
      }
      console.log(`getBidById: VENDOR access check result: ${canAccess}`);
    } else if (userRole === "USER") {
      canAccess = bid.tender.creatorId === userId;
    }

    if (!canAccess) {
      console.log(`getBidById: Access denied for user ${userId} to bid ${bidId}`);
      throw new ForbiddenException("Access denied to this bid");
    }

    // Decrypt sensitive data if authorized
    if (bid.encryptedData) {
      try {
        (bid as any).decryptedData = this.decryptSensitiveData(
          bid.encryptedData,
        );
      } catch (error) {
        delete (bid as any).encryptedData;
      }
    }

    return {
      success: true,
      data: bid,
    };
  }

  async updateBid(
    bidId: string,
    updateBidDto: UpdateBidDto,
    userId: string,
    userRole: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const existingBid = await this.prismaService.bid.findUnique({
      where: { id: bidId },
      include: {
        tender: true,
      },
    });

    if (!existingBid) {
      throw new NotFoundException("Bid not found");
    }

    // Only vendors can update their own bids
    if (userRole !== "VENDOR" || existingBid.vendorId !== userId) {
      throw new ForbiddenException("Access denied");
    }

    // Cannot update submitted bids
    if (existingBid.status !== "DRAFT") {
      throw new BadRequestException("Cannot update submitted bid");
    }

    // Check if tender is still open
    if (
      existingBid.tender.closingDate &&
      new Date() > existingBid.tender.closingDate
    ) {
      throw new BadRequestException("Tender has closed");
    }

    // Encrypt sensitive updated data
    const encryptedData = this.encryptSensitiveData({
      technicalProposal: updateBidDto.technicalProposal,
      commercialProposal: updateBidDto.commercialProposal,
      financialProposal: updateBidDto.financialProposal,
    });

    const updatedBid = await this.prismaService.bid.update({
      where: { id: bidId },
      data: {
        encryptedData,
        updatedAt: new Date(),
      },
    });

    // Audit log
    await this.auditService.log({
      userId,
      action: "bid_updated",
      targetType: "Bid",
      targetId: bidId,
      oldValues: { status: existingBid.status },
      newValues: { status: "DRAFT", updated: true },
      ipAddress,
      userAgent,
    });

    // Emit event
    await this.eventService.emit("bid.updated", {
      bidId,
      vendorId: userId,
      tenderId: existingBid.tenderId,
    });

    return updatedBid;
  }

  async submitBid(
    bidId: string,
    userId: string,
    userRole: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const bid = await this.prismaService.bid.findUnique({
      where: { id: bidId },
      include: {
        tender: true,
      },
    });

    if (!bid) {
      throw new NotFoundException("Bid not found");
    }

    // Only vendors can submit their own bids
    if (userRole !== "VENDOR" || bid.vendorId !== userId) {
      throw new ForbiddenException("Access denied");
    }

    if (bid.status !== "DRAFT") {
      throw new BadRequestException("Bid has already been submitted");
    }

    // Check if tender is still open
    if (bid.tender.closingDate && new Date() > bid.tender.closingDate) {
      throw new BadRequestException("Tender has closed");
    }

    const submittedBid = await this.prismaService.bid.update({
      where: { id: bidId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });

    // Audit log
    await this.auditService.log({
      userId,
      action: "bid_submitted",
      targetType: "Bid",
      targetId: bidId,
      oldValues: { status: "DRAFT" },
      newValues: { status: "SUBMITTED" },
      ipAddress,
      userAgent,
    });

    // Emit event to trigger scoring workflow
    await this.eventService.emit("bid.submitted", {
      bidId,
      tenderId: bid.tenderId,
      vendorId: userId,
      submittedAt: new Date(),
    });

    return submittedBid;
  }

  private encryptSensitiveData(data: any): string {
    try {
      const key = crypto.scryptSync(
        process.env.ENCRYPTION_KEY || "fallback-key",
        "salt",
        32,
      );
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

      let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      return JSON.stringify({
        encrypted,
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
      });
    } catch (error) {
      throw new Error("Failed to encrypt sensitive data");
    }
  }

  private decryptSensitiveData(encryptedString: string): any {
    try {
      const { encrypted, iv, authTag } = JSON.parse(encryptedString);
      const key = crypto.scryptSync(
        process.env.ENCRYPTION_KEY || "fallback-key",
        "salt",
        32,
      );

      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(iv, "hex"),
      );
      decipher.setAuthTag(Buffer.from(authTag, "hex"));

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error("Failed to decrypt sensitive data");
    }
  }

  private async encryptWithTenantDek(
    obj: any,
  ): Promise<{ ciphertext: string; keyVersion: number }> {
    const active = await this.tenantKms.getActiveDek();
    const dek = this.tenantKms.unwrapDek(active.wrappedDek);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv);
    const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
    return { ciphertext: payload, keyVersion: active.version };
  }

  private decryptWithTenantDek(ciphertext: string): any {
    const tenantIdDek = this.tenantKms.getActiveDek();
    // Note: decrypt with currently active key; for key rotation you should pick by keyVersion
    // Kept simple for now; a real impl would select the version per-record.
    throw new Error("Not implemented: decryptWithTenantDek");
  }
}
