import { PrismaClient } from '@prisma/client';

// Enables RLS and creates tenant-based policies across tables
// Usage: npx ts-node scripts/enable-rls.ts

const prisma = new PrismaClient();

async function exec(sql: string) {
  await prisma.$executeRawUnsafe(sql);
}

async function main() {
  const tables = [
    'users','vendors','currencies','contracts','contract_vendors','purchase_requisitions','purchase_orders','po_vendors','tenders','bids','quotations','goods_receipts','invoices','payments','documents','audit_logs','system_config','role_configs','refresh_tokens','notifications','workflow_steps','outbox'
  ];

  for (const t of tables) {
    await exec(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    const policy = `${t}_isolation`;
    await exec(`DROP POLICY IF EXISTS ${policy} ON ${t}`);
    await exec(`CREATE POLICY ${policy} ON ${t} USING ("tenantId" = current_setting('app.tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.tenant_id', true))`);
    console.log(`RLS enabled for ${t}`);
  }
}

main().then(async () => {
  await prisma.$disconnect();
}).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
