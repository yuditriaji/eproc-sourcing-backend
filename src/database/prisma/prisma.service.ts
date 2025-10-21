import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../../common/tenant/tenant-context';

const TENANTED_MODELS = new Set<string>([
  'User','Vendor','Currency','Contract','ContractVendor','PurchaseRequisition','PurchaseOrder','POVendor','Tender','Bid','Quotation','GoodsReceipt','Invoice','Payment','Document','AuditLog','SystemConfig','RoleConfig','RefreshToken','Notification','WorkflowStep','TenantKey','Outbox'
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly tenantContext: TenantContext) {
    super();

    const maybeUse = (this as any).$use;
    if (typeof maybeUse === 'function') {
      maybeUse.call(this, async (params, next) => {
        const tenantId = this.tenantContext.getTenantId();
        const model = params.model as string | undefined;

        if (!model || !TENANTED_MODELS.has(model) || !tenantId) {
          return next(params);
        }

        // Coerce findUnique into findFirst with tenant scoping
        if (params.action === 'findUnique') {
          params.action = 'findFirst';
        }

        // WHERE scoping
        if (params.action === 'findFirst' || params.action === 'findMany' || params.action === 'count' || params.action === 'deleteMany' || params.action === 'updateMany') {
          const existingWhere = params.args?.where ?? {};
          params.args = {
            ...params.args,
            where: {
              AND: [
                { tenantId },
                existingWhere,
              ],
            },
          };
        }

        // Single record mutations
        if (params.action === 'update' || params.action === 'delete') {
          const existingWhere = params.args?.where ?? {};
          params.args = {
            ...params.args,
            where: {
              AND: [
                { tenantId },
                existingWhere,
              ],
            },
          };
        }

        if (params.action === 'create') {
          params.args.data = {
            ...(params.args.data || {}),
            tenantId,
          };
        }

        if (params.action === 'createMany') {
          const data = params.args?.data;
          if (Array.isArray(data)) {
            params.args.data = data.map((d) => ({ ...d, tenantId }));
          } else if (data && typeof data === 'object') {
            params.args.data = { ...data, tenantId };
          }
        }

        if (params.action === 'upsert') {
          params.args = {
            ...params.args,
            where: {
              AND: [
                { tenantId },
                params.args.where ?? {},
              ],
            },
            create: { ...(params.args.create || {}), tenantId },
            update: params.args.update,
          };
        }

        return next(params);
      });
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
