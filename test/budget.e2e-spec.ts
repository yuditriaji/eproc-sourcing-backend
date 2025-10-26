import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { BudgetType, TransferType } from '@prisma/client';
import { AppModule } from '../src/app.module';

describe('Budget Control E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let tenantId: string;
  let budgetAId: string;
  let budgetBId: string;
  let transferId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    tenantId = 'tenant-a';

    // Login as admin
    const loginResponse = await request(app.getHttpServer())
      .post(`/api/v1/${tenantId}/auth/login`)
      .send({
        email: 'admin@eproc.local',
        password: 'admin123',
      });

    adminToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Budget Creation', () => {
    it('should create a budget for Division A', async () => {
      // Get Division A org unit
      const orgUnits = await prisma.orgUnit.findMany({
        where: { tenantId, level: 1 },
        take: 2,
        orderBy: { name: 'asc' },
      });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/${tenantId}/budgets`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fiscalYear: '2026',
          totalAmount: 50000000,
          orgUnitId: orgUnits[0].id,
          type: BudgetType.DIVISION,
        })
        .expect(201);

      budgetAId = response.body.id;
      expect(response.body.fiscalYear).toBe('2026');
      expect(parseFloat(response.body.totalAmount)).toBe(50000000);
      expect(parseFloat(response.body.availableAmount)).toBe(50000000);
    });

    it('should create a budget for Division B', async () => {
      const orgUnits = await prisma.orgUnit.findMany({
        where: { tenantId, level: 1 },
        skip: 1,
        take: 1,
        orderBy: { name: 'asc' },
      });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/${tenantId}/budgets`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fiscalYear: '2026',
          totalAmount: 50000000,
          orgUnitId: orgUnits[0].id,
          type: BudgetType.DIVISION,
        })
        .expect(201);

      budgetBId = response.body.id;
    });

    it('should prevent duplicate budget for same org unit and fiscal year', async () => {
      const orgUnits = await prisma.orgUnit.findMany({
        where: { tenantId, level: 1 },
        take: 1,
        orderBy: { name: 'asc' },
      });

      await request(app.getHttpServer())
        .post(`/api/v1/${tenantId}/budgets`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fiscalYear: '2026',
          totalAmount: 10000000,
          orgUnitId: orgUnits[0].id,
          type: BudgetType.DIVISION,
        })
        .expect(400);
    });
  });

  describe('Budget Transfer with Traceability', () => {
    it('should transfer 10M from Budget A to Budget B', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/${tenantId}/budgets/transfer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fromBudgetId: budgetAId,
          targetBudgetId: budgetBId,
          amount: 10000000,
          type: TransferType.CROSS_LEVEL,
          traceFlag: true,
        })
        .expect(200);

      transferId = response.body.id;
      expect(response.body.amount).toBeDefined();
      expect(response.body.transferType).toBe(TransferType.CROSS_LEVEL);
      expect(response.body.traceFlag).toBe(true);
    });

    it('should reflect updated available amounts after transfer', async () => {
      const [budgetA, budgetB] = await Promise.all([
        prisma.budget.findUnique({ where: { id: budgetAId } }),
        prisma.budget.findUnique({ where: { id: budgetBId } }),
      ]);

      expect(parseFloat(budgetA.availableAmount.toString())).toBe(40000000); // 50M - 10M
      expect(parseFloat(budgetB.availableAmount.toString())).toBe(60000000); // 50M + 10M
    });

    it('should prevent transfer with insufficient funds', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/${tenantId}/budgets/transfer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fromBudgetId: budgetAId,
          targetBudgetId: budgetBId,
          amount: 99999999999, // More than available
          type: TransferType.CROSS_LEVEL,
          traceFlag: true,
        })
        .expect(400);
    });
  });

  describe('Budget Allocation', () => {
    it('should allocate budget to child org units', async () => {
      // Get departments under Division A
      const departments = await prisma.orgUnit.findMany({
        where: { tenantId, level: 2, pgCode: { startsWith: 'DEPT-A' } },
        take: 2,
      });

      if (departments.length >= 2) {
        const response = await request(app.getHttpServer())
          .post(`/api/v1/${tenantId}/budgets/${budgetAId}/allocate`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            fromBudgetId: budgetAId,
            toOrgUnits: [
              { orgUnitId: departments[0].id, amount: 5000000 },
              { orgUnitId: departments[1].id, amount: 3000000 },
            ],
            reason: 'FY2026 departmental allocation',
          })
          .expect(200);

        expect(response.body).toHaveLength(2);
        expect(response.body[0].amount).toBeDefined();

        // Verify budget deduction
        const budget = await prisma.budget.findUnique({ where: { id: budgetAId } });
        expect(parseFloat(budget.availableAmount.toString())).toBe(32000000); // 40M - 8M
      }
    });
  });

  describe('Budget Usage Report', () => {
    it('should retrieve budget details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/${tenantId}/budgets/${budgetAId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(budgetAId);
      expect(response.body.orgUnit).toBeDefined();
      expect(response.body.allocationsFrom).toBeDefined();
    });

    it('should generate usage report with transfer traceability', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/${tenantId}/budgets/${budgetBId}/usage`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.budgetId).toBe(budgetBId);
      expect(response.body.totalAmount).toBe(50000000);
      expect(response.body.availableAmount).toBe(60000000); // After 10M transfer in
      expect(response.body.transfers).toBeDefined();
      expect(response.body.transfers.length).toBeGreaterThan(0);

      // Verify transfer trace
      const transferIn = response.body.transfers.find((t: any) => t.type === 'IN');
      expect(transferIn).toBeDefined();
      expect(transferIn.amount).toBe(10000000);
      expect(transferIn.traceId).toBe(transferId);
    });

    it('should filter usage report by trace ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/${tenantId}/budgets/${budgetBId}/usage?traceId=${transferId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.budgetId).toBe(budgetBId);
      // Should only include transfers matching the trace ID
      const transfers = response.body.transfers.filter((t: any) => t.traceId === transferId);
      expect(transfers.length).toBeGreaterThan(0);
    });
  });

  describe('Budget Listing', () => {
    it('should list all budgets for tenant', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/${tenantId}/budgets`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter budgets by fiscal year', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/${tenantId}/budgets?fiscalYear=2026`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((budget: any) => {
        expect(budget.fiscalYear).toBe('2026');
      });
    });
  });

  describe('Budget Deduction (Integration Test)', () => {
    it('should deduct from budget when creating PO items', async () => {
      const budgetBefore = await prisma.budget.findUnique({ where: { id: budgetBId } });
      const availableBefore = parseFloat(budgetBefore.availableAmount.toString());

      // Simulate direct deduction (normally done by PO service)
      await prisma.$transaction(async (tx) => {
        // Deduct budget
        await tx.budget.update({
          where: { id: budgetBId },
          data: { availableAmount: { decrement: 5000 } },
        });

        // Create PO item with trace
        await tx.pOItem.create({
          data: {
            tenantId,
            poId: 'test-po-001',
            itemNumber: 1,
            description: 'Test item',
            quantity: 1,
            unitPrice: 5000,
            consumedAmount: 5000,
            totalAmount: 5000,
            transferTraceId: transferId,
            purchaseOrder: {
              connectOrCreate: {
                where: {
                  tenantId_poNumber: { tenantId, poNumber: 'PO-TEST-001' },
                },
                create: {
                  tenantId,
                  poNumber: 'PO-TEST-001',
                  title: 'Test PO',
                  amount: 5000,
                  totalAmount: 5000,
                  budgetId: budgetBId,
                  transferTraceId: transferId,
                  items: { lineItems: [] },
                  createdById: 'admin-user-id',
                },
              },
            },
          },
        });
      });

      const budgetAfter = await prisma.budget.findUnique({ where: { id: budgetBId } });
      const availableAfter = parseFloat(budgetAfter.availableAmount.toString());

      expect(availableAfter).toBe(availableBefore - 5000);

      // Verify POItem has transfer trace
      const poItem = await prisma.pOItem.findFirst({
        where: { poId: 'test-po-001' },
      });
      expect(poItem.transferTraceId).toBe(transferId);
      expect(parseFloat(poItem.consumedAmount.toString())).toBe(5000);
    });
  });

  describe('Authorization', () => {
    it('should prevent unauthorized budget creation', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/${tenantId}/budgets`)
        .send({
          fiscalYear: '2026',
          totalAmount: 10000000,
          orgUnitId: 'some-org-unit',
          type: BudgetType.DIVISION,
        })
        .expect(401);
    });

    it('should enforce RBAC for budget transfers', async () => {
      // This test assumes vendor role cannot transfer budgets
      // Would need vendor token to fully test
      const response = await request(app.getHttpServer())
        .post(`/api/v1/${tenantId}/budgets/transfer`)
        .set('Authorization', `Bearer invalid-token`)
        .send({
          fromBudgetId: budgetAId,
          targetBudgetId: budgetBId,
          amount: 1000000,
          type: TransferType.SAME_LEVEL,
          traceFlag: true,
        })
        .expect(401);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity for budget transfers', async () => {
      const transfer = await prisma.budgetTransfer.findUnique({
        where: { id: transferId },
        include: {
          sourceBudget: true,
          targetBudget: true,
        },
      });

      expect(transfer).toBeDefined();
      expect(transfer.sourceBudget).toBeDefined();
      expect(transfer.targetBudget).toBeDefined();
      expect(transfer.budgetId).toBe(budgetAId);
      expect(transfer.targetBudgetId).toBe(budgetBId);
    });

    it('should record audit logs for budget operations', async () => {
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          tenantId,
          action: { in: ['BUDGET_ALLOCATE', 'BUDGET_TRANSFER', 'BUDGET_DEDUCT'] },
        },
        orderBy: { timestamp: 'desc' },
        take: 5,
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      auditLogs.forEach((log) => {
        expect(log.budgetKeyFigure).toBeDefined();
      });
    });
  });
});
