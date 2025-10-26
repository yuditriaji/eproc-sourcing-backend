import { PrismaClient } from '@prisma/client';

// E2E test environment setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.PORT = '3002';
process.env.API_PREFIX = 'api/v1';
process.env.BASE_URL = process.env.BASE_URL || 'https://eproc-sourcing-backend.onrender.com';

let prisma: PrismaClient;

// Setup before all tests
beforeAll(async () => {
  prisma = new PrismaClient();
  await prisma.$connect();
});

// Cleanup after each test
afterEach(async () => {
  // Clean up test data in reverse order of dependencies
  if (prisma) {
    const tableNames = [
      'invoice_items',
      'po_items',
      'budget_transfers',
      'budget_allocations',
      'budgets',
      'outbox',
      'tenant_keys',
      'notifications',
      'workflow_steps',
      'refresh_tokens',
      'role_configs',
      'porg_assignments',
      'purchasing_groups',
      'purchasing_orgs',
      'storage_locations',
      'plants',
      'company_codes',
      'rbac_config',
      'process_config',
      'org_units',
      'system_config',
      'audit_logs',
      'documents',
      'payments',
      'invoices',
      'goods_receipts',
      'quotations',
      'bids',
      'tenders',
      'po_vendors',
      'purchase_orders',
      'purchase_requisitions',
      'contract_vendors',
      'contracts',
      'currencies',
      'vendors',
      'users',
      'tenant_config',
      'tenants',
    ];

    for (const tableName of tableNames) {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE;`);
      } catch (error) {
        // Ignore errors for tables that don't exist
      }
    }
  }
});

// Cleanup after all tests
afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});
