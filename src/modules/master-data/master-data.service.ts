import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';

export interface MasterDataValidationDto {
  companyCodeId?: string;
  plantId?: string;
  storageLocationId?: string;
  purchasingOrgId?: string;
  purchasingGroupId?: string;
}

export interface HierarchyResponse {
  companyCodes: CompanyCodeHierarchy[];
  purchasingOrgs: PurchasingOrgHierarchy[];
  orgUnits: OrgUnitHierarchy[];
  currencies: CurrencyOption[];
}

interface CompanyCodeHierarchy {
  id: string;
  code: string;
  name: string;
  description?: string;
  plants: PlantHierarchy[];
}

interface PlantHierarchy {
  id: string;
  code: string;
  name: string;
  description?: string;
  storageLocations: StorageLocationHierarchy[];
}

interface StorageLocationHierarchy {
  id: string;
  code: string;
  name: string;
}

interface PurchasingOrgHierarchy {
  id: string;
  code: string;
  name: string;
  groups: PurchasingGroupHierarchy[];
  assignments: PorgAssignmentHierarchy[];
}

interface PurchasingGroupHierarchy {
  id: string;
  code: string;
  name: string;
}

interface PorgAssignmentHierarchy {
  id: string;
  companyCode?: { id: string; code: string; name: string };
  plant?: { id: string; code: string; name: string };
}

interface OrgUnitHierarchy {
  id: string;
  name: string;
  type: string;
  level: number;
  companyCode?: string;
  pgCode?: string;
  children: OrgUnitHierarchy[];
}

interface CurrencyOption {
  id: string;
  code: string;
  symbol: string;
  name: string;
  exchangeRate: number;
}

@Injectable()
export class MasterDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getHierarchy(): Promise<HierarchyResponse> {
    const tenantId = this.tenantContext.getTenantId();

    const [companyCodes, purchasingOrgs, orgUnits, currencies] = await Promise.all([
      this.getCompanyCodeHierarchy(tenantId),
      this.getPurchasingOrgHierarchy(tenantId),
      this.getOrgUnitHierarchy(tenantId),
      this.getActiveCurrencies(tenantId),
    ]);

    return {
      companyCodes,
      purchasingOrgs,
      orgUnits,
      currencies,
    };
  }

  async validateMasterDataReferences(dto: MasterDataValidationDto): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const tenantId = this.tenantContext.getTenantId();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate company code hierarchy
    if (dto.companyCodeId) {
      const companyCode = await this.prisma.companyCode.findFirst({
        where: { id: dto.companyCodeId, tenantId },
      });

      if (!companyCode) {
        errors.push('Company code not found');
      } else if (dto.plantId) {
        const plant = await this.prisma.plant.findFirst({
          where: { id: dto.plantId, companyCodeId: dto.companyCodeId, tenantId },
        });

        if (!plant) {
          errors.push('Plant not found or does not belong to the specified company code');
        } else if (dto.storageLocationId) {
          const storageLocation = await this.prisma.storageLocation.findFirst({
            where: { id: dto.storageLocationId, plantId: dto.plantId, tenantId },
          });

          if (!storageLocation) {
            errors.push('Storage location not found or does not belong to the specified plant');
          }
        }
      } else if (dto.storageLocationId) {
        errors.push('Plant ID is required when storage location ID is specified');
      }
    } else if (dto.plantId || dto.storageLocationId) {
      errors.push('Company code ID is required when plant or storage location is specified');
    }

    // Validate purchasing org hierarchy
    if (dto.purchasingOrgId) {
      const purchasingOrg = await this.prisma.purchasingOrg.findFirst({
        where: { id: dto.purchasingOrgId, tenantId },
      });

      if (!purchasingOrg) {
        errors.push('Purchasing organization not found');
      } else if (dto.purchasingGroupId) {
        const purchasingGroup = await this.prisma.purchasingGroup.findFirst({
          where: { 
            id: dto.purchasingGroupId, 
            purchasingOrgId: dto.purchasingOrgId, 
            tenantId 
          },
        });

        if (!purchasingGroup) {
          errors.push('Purchasing group not found or does not belong to the specified purchasing organization');
        }
      }
    } else if (dto.purchasingGroupId) {
      errors.push('Purchasing organization ID is required when purchasing group ID is specified');
    }

    // Check purchasing org assignments
    if (dto.companyCodeId && dto.purchasingOrgId) {
      const assignment = await this.prisma.purchasingOrgAssignment.findFirst({
        where: {
          purchasingOrgId: dto.purchasingOrgId,
          companyCodeId: dto.companyCodeId,
          tenantId,
        },
      });

      if (!assignment) {
        warnings.push('No purchasing organization assignment found for this company code');
      } else if (dto.plantId) {
        const plantAssignment = await this.prisma.purchasingOrgAssignment.findFirst({
          where: {
            purchasingOrgId: dto.purchasingOrgId,
            plantId: dto.plantId,
            tenantId,
          },
        });

        if (!plantAssignment) {
          warnings.push('No purchasing organization assignment found for this plant');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async getCompanyCodeHierarchy(tenantId: string): Promise<CompanyCodeHierarchy[]> {
    const companyCodes = await this.prisma.companyCode.findMany({
      where: { tenantId },
      include: {
        plants: {
          include: {
            storageLocations: {
              orderBy: { code: 'asc' },
            },
          },
          orderBy: { code: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    return companyCodes.map(cc => ({
      id: cc.id,
      code: cc.code,
      name: cc.name,
      description: cc.description,
      plants: cc.plants.map(plant => ({
        id: plant.id,
        code: plant.code,
        name: plant.name,
        description: plant.description,
        storageLocations: plant.storageLocations.map(sl => ({
          id: sl.id,
          code: sl.code,
          name: sl.name,
        })),
      })),
    }));
  }

  private async getPurchasingOrgHierarchy(tenantId: string): Promise<PurchasingOrgHierarchy[]> {
    const purchasingOrgs = await this.prisma.purchasingOrg.findMany({
      where: { tenantId },
      include: {
        groups: {
          orderBy: { code: 'asc' },
        },
        assignments: {
          include: {
            companyCode: {
              select: { id: true, code: true, name: true },
            },
            plant: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    return purchasingOrgs.map(porg => ({
      id: porg.id,
      code: porg.code,
      name: porg.name,
      groups: porg.groups.map(group => ({
        id: group.id,
        code: group.code,
        name: group.name,
      })),
      assignments: porg.assignments.map(assignment => ({
        id: assignment.id,
        companyCode: assignment.companyCode,
        plant: assignment.plant,
      })),
    }));
  }

  private async getOrgUnitHierarchy(tenantId: string): Promise<OrgUnitHierarchy[]> {
    // Get root level org units (level 1 or no parent)
    const rootUnits = await this.prisma.orgUnit.findMany({
      where: { tenantId, OR: [{ level: 1 }, { parentId: null }] },
      include: {
        children: {
          include: {
            children: {
              include: {
                children: true, // Support up to 4 levels deep
              },
            },
          },
        },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });

    return rootUnits.map(unit => this.mapOrgUnitToHierarchy(unit));
  }

  private mapOrgUnitToHierarchy(unit: any): OrgUnitHierarchy {
    return {
      id: unit.id,
      name: unit.name,
      type: unit.type,
      level: unit.level,
      companyCode: unit.companyCode,
      pgCode: unit.pgCode,
      children: unit.children?.map((child: any) => this.mapOrgUnitToHierarchy(child)) || [],
    };
  }

  private async getActiveCurrencies(tenantId: string): Promise<CurrencyOption[]> {
    const currencies = await this.prisma.currency.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        code: true,
        symbol: true,
        name: true,
        exchangeRate: true,
      },
      orderBy: { code: 'asc' },
    });

    return currencies.map(currency => ({
      id: currency.id,
      code: currency.code,
      symbol: currency.symbol,
      name: currency.name,
      exchangeRate: currency.exchangeRate ? Number(currency.exchangeRate) : 1.0,
    }));
  }

  async getMasterDataSummary() {
    const tenantId = this.tenantContext.getTenantId();

    const [
      companyCodeCount,
      plantCount,
      storageLocationCount,
      purchasingOrgCount,
      purchasingGroupCount,
      activeVendorCount,
      activeCurrencyCount,
      orgUnitCount,
    ] = await Promise.all([
      this.prisma.companyCode.count({ where: { tenantId } }),
      this.prisma.plant.count({ where: { tenantId } }),
      this.prisma.storageLocation.count({ where: { tenantId } }),
      this.prisma.purchasingOrg.count({ where: { tenantId } }),
      this.prisma.purchasingGroup.count({ where: { tenantId } }),
      this.prisma.vendor.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.currency.count({ where: { tenantId, isActive: true } }),
      this.prisma.orgUnit.count({ where: { tenantId } }),
    ]);

    return {
      summary: {
        companyCodes: companyCodeCount,
        plants: plantCount,
        storageLocations: storageLocationCount,
        purchasingOrgs: purchasingOrgCount,
        purchasingGroups: purchasingGroupCount,
        activeVendors: activeVendorCount,
        activeCurrencies: activeCurrencyCount,
        orgUnits: orgUnitCount,
      },
    };
  }
}