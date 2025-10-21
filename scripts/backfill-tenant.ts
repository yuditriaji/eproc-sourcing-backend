import { PrismaClient } from '@prisma/client';

// Backfills tenantId across all tables with a default tenant
// Usage: npx ts-node scripts/backfill-tenant.ts

const prisma = new PrismaClient();

async function main() {
  const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'tenant_default';
  const DEFAULT_TENANT_NAME = process.env.DEFAULT_TENANT_NAME || 'Default Tenant';
  const DEFAULT_RESIDENCY = process.env.DEFAULT_RESIDENCY_TAG || 'global';

  // Upsert default tenant
  await prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: { name: DEFAULT_TENANT_NAME, residencyTag: DEFAULT_RESIDENCY },
    create: { id: DEFAULT_TENANT_ID, name: DEFAULT_TENANT_NAME, residencyTag: DEFAULT_RESIDENCY },
  });

  // Helper to run updateMany safely
  async function setTenant(model: any, where: any = {}) {
    return model.updateMany({ data: { tenantId: DEFAULT_TENANT_ID }, where: { OR: [{ tenantId: null as any }, { tenantId: undefined as any }] as any } });
  }

  console.log('Backfilling tenantId for all tenant-scoped tables...');

  await setTenant(prisma.user);
  await setTenant(prisma.vendor);
  await setTenant(prisma.currency);
  await setTenant(prisma.contract);
  await setTenant(prisma.contractVendor);
  await setTenant(prisma.purchaseRequisition);
  await setTenant(prisma.purchaseOrder);
  await setTenant(prisma.pOVendor);
  await setTenant(prisma.tender);
  await setTenant(prisma.bid);
  await setTenant(prisma.quotation);
  await setTenant(prisma.goodsReceipt);
  await setTenant(prisma.invoice);
  await setTenant(prisma.payment);
  await setTenant(prisma.document);
  await setTenant(prisma.auditLog);
  await setTenant(prisma.systemConfig);
  await setTenant(prisma.roleConfig);
  await setTenant(prisma.refreshToken);
  await setTenant(prisma.notification);
  await setTenant(prisma.workflowStep);
  await setTenant(prisma.outbox);

  console.log('Backfill complete.');
}

main().finally(async () => {
  await prisma.$disconnect();
});
