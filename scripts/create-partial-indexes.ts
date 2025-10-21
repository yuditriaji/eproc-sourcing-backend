import { PrismaClient } from '@prisma/client';

// Backfill per-tenant partial indexes (example for hot tenants)
// Usage: npx ts-node scripts/create-partial-indexes.ts TENANT_ID

const prisma = new PrismaClient();

async function main() {
  const tenantId = process.argv[2];
  if (!tenantId) {
    console.error('TENANT_ID required');
    process.exit(1);
  }

  const statements = [
    `CREATE INDEX IF NOT EXISTS bids_tenant_${tenantId}_idx ON bids (tender_id, vendor_id) WHERE tenant_id = '${tenantId}'`,
    `CREATE INDEX IF NOT EXISTS tenders_tenant_${tenantId}_idx ON tenders (status, closing_date) WHERE tenant_id = '${tenantId}'`,
    `CREATE INDEX IF NOT EXISTS documents_tenant_${tenantId}_idx ON documents (tender_id, vendor_id) WHERE tenant_id = '${tenantId}'`
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
    console.log('Created index:', sql);
  }
}

main().finally(async () => prisma.$disconnect());
