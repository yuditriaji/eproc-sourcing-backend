import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class ConfigServiceBasis {
  constructor(private readonly prisma: PrismaService) {}

  async upsertTenantBasis(tenantId: string, body: { tenantConfig?: any; processConfig?: { name: string; processType: string; steps: any } }) {
    if (!tenantId) throw new BadRequestException('Missing tenant');

    let tenantConfig = null;
    if (body.tenantConfig) {
      tenantConfig = await this.prisma.tenantConfig.upsert({
        where: { tenantId },
        update: { orgStructure: body.tenantConfig.orgStructure ?? null, businessVariants: body.tenantConfig.businessVariants ?? null },
        create: { tenantId, orgStructure: body.tenantConfig.orgStructure ?? null, businessVariants: body.tenantConfig.businessVariants ?? null },
      });
    }

    let processConfig = null;
    if (body.processConfig) {
      processConfig = await this.prisma.processConfig.create({
        data: {
          tenantId,
          name: body.processConfig.name,
          processType: body.processConfig.processType as any,
          steps: body.processConfig.steps ?? [],
        },
      });
    }

    return { tenantConfig, processConfig };
  }

  async bulkCreateOrgUnits(tenantId: string, json: any) {
    if (!tenantId) throw new BadRequestException('Missing tenant');
    const units: any[] = [];

    if (json?.ccs && Array.isArray(json.ccs)) {
      for (const cc of json.ccs) {
        // Upsert parent company code to avoid duplicates
        const parent = await this.prisma.orgUnit.upsert({
          where: { tenantId_companyCode: { tenantId, companyCode: cc.code } as any },
          update: {
            name: cc.name || cc.code,
            type: 'COMPANY_CODE' as any,
            level: 1,
          },
          create: {
            tenantId,
            level: 1,
            name: cc.name || cc.code,
            type: 'COMPANY_CODE' as any,
            companyCode: cc.code,
          },
        });
        units.push(parent);

        const pgs = cc.pgs || 0;
        for (let i = 1; i <= pgs; i++) {
          const code = `${cc.code}-PG${i}`; // ensure tenant-wide uniqueness for pgCode
          const child = await this.prisma.orgUnit.upsert({
            where: { tenantId_pgCode: { tenantId, pgCode: code } as any },
            update: {
              parentId: parent.id,
              name: code,
              type: 'PURCHASING_GROUP' as any,
              level: 2,
            },
            create: {
              tenantId,
              parentId: parent.id,
              level: 2,
              name: code,
              type: 'PURCHASING_GROUP' as any,
              pgCode: code,
            },
          });
          units.push(child);
        }
      }
    }

    return { created: units.length, units };
  }
}