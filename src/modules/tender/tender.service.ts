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

export interface CreateTenderDto {
  title: string;
  description: string;
  requirements: any;
  criteria: any;
  estimatedValue?: number;
  closingDate: Date;
  category?: string;
  department?: string;
  // SAP org refs (optional)
  companyCodeId?: string;
  plantId?: string;
  storageLocationId?: string;
  purchasingOrgId?: string;
  purchasingGroupId?: string;
}

export interface UpdateTenderDto {
  title?: string;
  description?: string;
  requirements?: any;
  criteria?: any;
  estimatedValue?: number;
  closingDate?: Date;
  category?: string;
  department?: string;
}

@Injectable()
export class TenderService {
  constructor(
    private prismaService: PrismaService,
    private auditService: AuditService,
    private eventService: EventService,
    private abilityFactory: AbilityFactory,
  ) {}

  async createTender(
    createTenderDto: CreateTenderDto,
    userId: string,
    userRole: string,
    ipAddress: string,
    userAgent: string,
  ) {
    // Role-based permission check
    if (userRole !== "ADMIN" && userRole !== "USER") {
      throw new ForbiddenException("Insufficient permissions to create tender");
    }

    // Validate required fields
    if (!createTenderDto.title || !createTenderDto.description) {
      throw new BadRequestException("Title and description are required");
    }

    // Set department scoping for users (not admin)
    const tenderData = {
      ...createTenderDto,
      creatorId: userId,
      department: userRole === "USER" ? createTenderDto.department : undefined,
    };

    // Validate purchasing org assignment if provided
    const porgId = (createTenderDto as any).purchasingOrgId as
      | string
      | undefined;
    const plantId = (createTenderDto as any).plantId as string | undefined;
    const companyCodeId = (createTenderDto as any).companyCodeId as
      | string
      | undefined;
    if (porgId && (plantId || companyCodeId)) {
      const assignment =
        await this.prismaService.purchasingOrgAssignment.findFirst({
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

    const tender = await this.prismaService.tender.create({
      data: {
        title: tenderData.title,
        description: tenderData.description,
        requirements: tenderData.requirements,
        criteria: tenderData.criteria,
        estimatedValue: tenderData.estimatedValue,
        closingDate: tenderData.closingDate,
        category: tenderData.category,
        department: tenderData.department,
        creatorId: userId,
        processConfigId: (createTenderDto as any).processConfigId,
        orgUnitId: (createTenderDto as any).orgUnitId,
        companyCodeId: (createTenderDto as any).companyCodeId,
        plantId: (createTenderDto as any).plantId,
        storageLocationId: (createTenderDto as any).storageLocationId,
        purchasingOrgId: (createTenderDto as any).purchasingOrgId,
        purchasingGroupId: (createTenderDto as any).purchasingGroupId,
        tenderNumber: `TDR-${Date.now()}`, // Temporary number generation
      } as any,
      include: {
        creator: {
          select: {
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Audit log
    await this.auditService.log({
      userId,
      action: "tender_created",
      targetType: "Tender",
      targetId: tender.id,
      newValues: tender,
      ipAddress,
      userAgent,
    });

    // Emit event
    await this.eventService.emit("tender.created", {
      tenderId: tender.id,
      creatorId: userId,
      department: tender.department,
      estimatedValue: tender.estimatedValue,
    });

    return tender;
  }

  async getTenders(
    userId: string,
    userRole: string,
    department?: string,
    filters?: {
      status?: string;
      category?: string;
      department?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: any = {};

    // Apply role-based filtering
    switch (userRole) {
      case "ADMIN":
        // Admin can see all tenders
        break;
      case "USER":
        // Users can see all tenders but with department context
        if (department) {
          where.OR = [
            { department },
            { department: null }, // Global tenders
          ];
        }
        break;
      case "VENDOR":
        // Vendors can only see published tenders
        where.status = "PUBLISHED";
        break;
      default:
        throw new ForbiddenException("Invalid user role");
    }

    // Apply additional filters
    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;
    if (filters?.department) where.department = filters.department;

    const tenders = await this.prismaService.tender.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters?.limit || 20,
      skip: filters?.offset || 0,
      include: {
        creator: {
          select: {
            username: true,
            email: true,
            role: true,
          },
        },
        bids:
          userRole !== "VENDOR"
            ? {
                select: {
                  id: true,
                  status: true,
                  submittedAt: true,
                  vendor: {
                    select: {
                      name: true,
                      contactEmail: true,
                    },
                  },
                },
              }
            : false,
      },
    });

    return tenders;
  }

  async getTenderById(tenderId: string, userId: string, userRole: string) {
    const tender = await this.prismaService.tender.findFirst({
      where: { id: tenderId },
      include: {
        creator: {
          select: {
            username: true,
            email: true,
            role: true,
          },
        },
        bids:
          userRole !== "VENDOR"
            ? {
                include: {
                  vendor: {
                    select: {
                      name: true,
                      contactEmail: true,
                    },
                  },
                },
              }
            : {
                where: { vendorId: userId }, // Vendors only see their own bids
                include: {
                  vendor: {
                    select: {
                      name: true,
                      contactEmail: true,
                    },
                  },
                },
              },
      },
    });

    if (!tender) {
      throw new NotFoundException("Tender not found");
    }

    // Role-based permission check
    if (userRole === "VENDOR" && tender.status !== "PUBLISHED") {
      throw new ForbiddenException("Cannot view unpublished tender");
    }

    return tender;
  }

  async updateTender(
    tenderId: string,
    updateTenderDto: UpdateTenderDto,
    userId: string,
    userRole: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const existingTender = await this.prismaService.tender.findFirst({
      where: { id: tenderId },
    });

    if (!existingTender) {
      throw new NotFoundException("Tender not found");
    }

    // Role-based permission check
    if (userRole !== "ADMIN" && userRole !== "USER") {
      throw new ForbiddenException("Insufficient permissions to update tender");
    }
    if (userRole === "USER" && existingTender.creatorId !== userId) {
      throw new ForbiddenException("Users can only update their own tenders");
    }

    // Prevent updates if tender has been published and has bids
    if (existingTender.status !== "DRAFT" && userRole !== "ADMIN") {
      const bidCount = await this.prismaService.bid.count({
        where: { tenderId },
      });

      if (bidCount > 0) {
        throw new BadRequestException(
          "Cannot update tender with existing bids",
        );
      }
    }

    const updatedTender = await this.prismaService.tender.update({
      where: { id: tenderId },
      data: updateTenderDto,
      include: {
        creator: {
          select: {
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Audit log
    await this.auditService.log({
      userId,
      action: "tender_updated",
      targetType: "Tender",
      targetId: tenderId,
      oldValues: existingTender,
      newValues: updatedTender,
      ipAddress,
      userAgent,
    });

    // Emit event
    await this.eventService.emit("tender.updated", {
      tenderId: updatedTender.id,
      updatedBy: userId,
      changes: Object.keys(updateTenderDto),
    });

    return updatedTender;
  }

  async publishTender(
    tenderId: string,
    userId: string,
    userRole: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const tender = await this.prismaService.tender.findFirst({
      where: { id: tenderId },
    });

    if (!tender) {
      throw new NotFoundException("Tender not found");
    }

    // Role-based permission check
    if (userRole !== "ADMIN" && userRole !== "USER") {
      throw new ForbiddenException(
        "Insufficient permissions to publish tender",
      );
    }
    if (userRole === "USER" && tender.creatorId !== userId) {
      throw new ForbiddenException("Users can only publish their own tenders");
    }

    if (tender.status !== "DRAFT") {
      throw new BadRequestException("Only draft tenders can be published");
    }

    const publishedTender = await this.prismaService.tender.update({
      where: { id: tenderId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    // Audit log
    await this.auditService.log({
      userId,
      action: "tender_published",
      targetType: "Tender",
      targetId: tenderId,
      oldValues: { status: "DRAFT" },
      newValues: { status: "PUBLISHED" },
      ipAddress,
      userAgent,
    });

    // Emit event to start Camunda workflow
    await this.eventService.emit("tender.published", {
      tenderId: publishedTender.id,
      publishedBy: userId,
      userRole,
      department: publishedTender.department,
      estimatedValue: publishedTender.estimatedValue,
      closingDate: publishedTender.closingDate,
    });

    return publishedTender;
  }

  async deleteTender(
    tenderId: string,
    userId: string,
    userRole: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const tender = await this.prismaService.tender.findFirst({
      where: { id: tenderId },
    });

    if (!tender) {
      throw new NotFoundException("Tender not found");
    }

    // Role-based permission check
    if (userRole !== "ADMIN" && userRole !== "USER") {
      throw new ForbiddenException("Insufficient permissions to delete tender");
    }
    if (userRole === "USER" && tender.creatorId !== userId) {
      throw new ForbiddenException("Users can only delete their own tenders");
    }

    // Only allow deletion of draft tenders or by admin
    if (tender.status !== "DRAFT" && userRole !== "ADMIN") {
      throw new BadRequestException("Only draft tenders can be deleted");
    }

    await this.prismaService.tender.delete({
      where: { id: tenderId },
    });

    // Audit log
    await this.auditService.log({
      userId,
      action: "tender_deleted",
      targetType: "Tender",
      targetId: tenderId,
      oldValues: tender,
      ipAddress,
      userAgent,
    });

    // Emit event
    await this.eventService.emit("tender.deleted", {
      tenderId,
      deletedBy: userId,
    });

    return { message: "Tender deleted successfully" };
  }
}
