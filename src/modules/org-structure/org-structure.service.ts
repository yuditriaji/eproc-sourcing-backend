import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";

@Injectable()
export class OrgStructureService {
  constructor(private readonly prisma: PrismaService) {}

  // Company Code
  listCompanyCodes(q?: string) {
    return this.prisma.companyCode.findMany({
      where: q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { code: "asc" },
    });
  }
  createCompanyCode(dto: { code: string; name: string; description?: string }) {
    return this.prisma.companyCode.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description || null,
      } as any,
    });
  }
  async updateCompanyCode(
    id: string,
    dto: { name?: string; description?: string },
  ) {
    const found = await this.prisma.companyCode.findFirst({ where: { id } });
    if (!found) throw new NotFoundException("CompanyCode not found");
    return this.prisma.companyCode.update({
      where: { id },
      data: {
        name: dto.name ?? found.name,
        description: dto.description ?? found.description,
      } as any,
    });
  }
  deleteCompanyCode(id: string) {
    return this.prisma.companyCode.delete({ where: { id } });
  }

  // Plant
  listPlants(companyCodeId?: string) {
    return this.prisma.plant.findMany({
      where: companyCodeId ? { companyCodeId } : undefined,
      orderBy: { code: "asc" },
    });
  }
  async createPlant(dto: {
    companyCodeId: string;
    code: string;
    name: string;
    description?: string;
  }) {
    const cc = await this.prisma.companyCode.findFirst({
      where: { id: dto.companyCodeId },
    });
    if (!cc) throw new BadRequestException("Invalid companyCodeId");
    return this.prisma.plant.create({
      data: {
        companyCodeId: dto.companyCodeId,
        code: dto.code,
        name: dto.name,
        description: dto.description || null,
      } as any,
    });
  }
  async updatePlant(id: string, dto: { name?: string; description?: string }) {
    const plant = await this.prisma.plant.findFirst({ where: { id } });
    if (!plant) throw new NotFoundException("Plant not found");
    return this.prisma.plant.update({
      where: { id },
      data: {
        name: dto.name ?? plant.name,
        description: dto.description ?? plant.description,
      } as any,
    });
  }
  deletePlant(id: string) {
    return this.prisma.plant.delete({ where: { id } });
  }

  // Storage Location
  listStorageLocations(plantId?: string) {
    return this.prisma.storageLocation.findMany({
      where: plantId ? { plantId } : undefined,
      orderBy: { code: "asc" },
    });
  }
  async createStorageLocation(dto: {
    plantId: string;
    code: string;
    name: string;
  }) {
    const plant = await this.prisma.plant.findFirst({
      where: { id: dto.plantId },
    });
    if (!plant) throw new BadRequestException("Invalid plantId");
    return this.prisma.storageLocation.create({
      data: { plantId: dto.plantId, code: dto.code, name: dto.name } as any,
    });
  }
  async updateStorageLocation(id: string, dto: { name?: string }) {
    const sl = await this.prisma.storageLocation.findFirst({ where: { id } });
    if (!sl) throw new NotFoundException("StorageLocation not found");
    return this.prisma.storageLocation.update({
      where: { id },
      data: { name: dto.name ?? sl.name } as any,
    });
  }
  deleteStorageLocation(id: string) {
    return this.prisma.storageLocation.delete({ where: { id } });
  }

  // Purchasing Org
  listPurchasingOrgs(q?: string) {
    return this.prisma.purchasingOrg.findMany({
      where: q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { code: "asc" },
    });
  }
  createPurchasingOrg(dto: { code: string; name: string }) {
    return this.prisma.purchasingOrg.create({
      data: { code: dto.code, name: dto.name } as any,
    });
  }
  async updatePurchasingOrg(id: string, dto: { name?: string }) {
    const porg = await this.prisma.purchasingOrg.findFirst({ where: { id } });
    if (!porg) throw new NotFoundException("PurchasingOrg not found");
    return this.prisma.purchasingOrg.update({
      where: { id },
      data: { name: dto.name ?? porg.name } as any,
    });
  }
  deletePurchasingOrg(id: string) {
    return this.prisma.purchasingOrg.delete({ where: { id } });
  }

  // Purchasing Group
  listPurchasingGroups(purchasingOrgId?: string) {
    return this.prisma.purchasingGroup.findMany({
      where: purchasingOrgId ? { purchasingOrgId } : undefined,
      orderBy: { code: "asc" },
    });
  }
  async createPurchasingGroup(dto: {
    purchasingOrgId: string;
    code: string;
    name: string;
  }) {
    const porg = await this.prisma.purchasingOrg.findFirst({
      where: { id: dto.purchasingOrgId },
    });
    if (!porg) throw new BadRequestException("Invalid purchasingOrgId");
    return this.prisma.purchasingGroup.create({
      data: {
        purchasingOrgId: dto.purchasingOrgId,
        code: dto.code,
        name: dto.name,
      } as any,
    });
  }
  async updatePurchasingGroup(id: string, dto: { name?: string }) {
    const pgrp = await this.prisma.purchasingGroup.findFirst({ where: { id } });
    if (!pgrp) throw new NotFoundException("PurchasingGroup not found");
    return this.prisma.purchasingGroup.update({
      where: { id },
      data: { name: dto.name ?? pgrp.name } as any,
    });
  }
  deletePurchasingGroup(id: string) {
    return this.prisma.purchasingGroup.delete({ where: { id } });
  }

  // Assignments
  listAssignments(purchasingOrgId?: string) {
    return this.prisma.purchasingOrgAssignment.findMany({
      where: purchasingOrgId ? { purchasingOrgId } : undefined,
      include: { companyCode: true, plant: true, purchasingOrg: true },
      orderBy: { createdAt: "desc" },
    });
  }
  async createAssignment(dto: {
    purchasingOrgId: string;
    companyCodeId?: string;
    plantId?: string;
  }) {
    if (!!dto.companyCodeId === !!dto.plantId)
      throw new BadRequestException("Provide either companyCodeId or plantId");
    if (dto.companyCodeId) {
      const ok = await this.prisma.companyCode.findFirst({
        where: { id: dto.companyCodeId },
      });
      if (!ok) throw new BadRequestException("Invalid companyCodeId");
    }
    if (dto.plantId) {
      const ok = await this.prisma.plant.findFirst({
        where: { id: dto.plantId },
      });
      if (!ok) throw new BadRequestException("Invalid plantId");
    }
    return this.prisma.purchasingOrgAssignment.create({
      data: {
        purchasingOrgId: dto.purchasingOrgId,
        companyCodeId: dto.companyCodeId || null,
        plantId: dto.plantId || null,
      } as any,
    });
  }
  deleteAssignment(id: string) {
    return this.prisma.purchasingOrgAssignment.delete({ where: { id } });
  }
}
