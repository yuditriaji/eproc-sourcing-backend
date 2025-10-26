import { PrismaClient } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';

export class TestDatabase {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async connect() {
    await this.prisma.$connect();
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }

  async cleanAll() {
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
        await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE;`);
      } catch (error) {
        // Ignore errors for tables that don't exist
      }
    }
  }

  getPrisma() {
    return this.prisma;
  }
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export class ApiTestHelper {
  constructor(private app: INestApplication) {}

  async login(email: string, password: string): Promise<AuthTokens> {
    const response = await request(this.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    return {
      accessToken: response.body.accessToken,
      refreshToken: response.headers['set-cookie']?.[0],
    };
  }

  async register(userData: any): Promise<any> {
    const response = await request(this.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(201);

    return response.body;
  }

  getAuthHeader(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  async makeAuthRequest(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    token: string,
    body?: any,
  ) {
    const req = request(this.app.getHttpServer())[method](path).set(this.getAuthHeader(token));

    if (body && (method === 'post' || method === 'put' || method === 'patch')) {
      req.send(body);
    }

    return req;
  }
}

export async function createTestApp(moduleMetadata: any): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule(moduleMetadata).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();
  return app;
}

export function mockPrismaService() {
  return {
    tenant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    vendor: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tender: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    bid: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    contract: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    purchaseRequisition: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    purchaseOrder: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    invoice: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    budget: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
  };
}

export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
