const request = require('supertest');
const { Test } = require('@nestjs/testing');

jest.mock('uuid', () => ({ v4: () => '00000000-0000-0000-0000-000000000000' }));

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-abcdefghijklmnopqrstuvwxyz1234';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh-secret-abcdefghijklmnopqrstuvwxyz1234';
process.env.API_PREFIX = process.env.API_PREFIX || 'api/v1';

// Import compiled AppModule and PrismaService from dist
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/database/prisma/prisma.service');
const bcrypt = require('bcryptjs');

describe('E2E smoke (auth + tenders)', () => {
  let app;
  let prismaMock;

  beforeAll(async () => {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('admin123', salt);

    prismaMock = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      // Auth paths
      user: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          if (where?.email === 'admin@eproc.local' && where?.tenantId === 'tenant_a') {
            return {
              id: 'u1', email: 'admin@eproc.local', username: 'admin', password: hashed,
              firstName: 'System', lastName: 'Admin', role: 'ADMIN', abilities: [], isActive: true, isVerified: true,
            };
          }
          if (where?.id === 'u1' && where?.tenantId === 'tenant_a') {
            return {
              id: 'u1', email: 'admin@eproc.local', role: 'ADMIN', abilities: [], isActive: true, isVerified: true,
            };
          }
          return null;
        }),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'rt1' }),
        findFirst: jest.fn().mockResolvedValue({ token: 'any', isRevoked: false, expiresAt: new Date(Date.now()+3600_000) }),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
      tenant: { findUnique: jest.fn().mockResolvedValue({ residencyTag: 'us' }) },
      outbox: { create: jest.fn().mockResolvedValue({ id: 'o1' }) },
      tender: {
        findMany: jest.fn().mockResolvedValue([{ id: 't1', title: 'Sample', status: 'PUBLISHED', creator: { username: 'admin', email: 'admin@eproc.local', role: 'ADMIN' }, bids: [] }]),
        create: jest.fn().mockResolvedValue({ id: 't2', title: 'Created', department: null }),
        findUnique: jest.fn().mockResolvedValue({ id: 't1', title: 'Sample', status: 'PUBLISHED' }),
      },
      bid: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'b1' }) },
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('auth login and get tenders', async () => {
    // login
    const loginRes = await request(app.getHttpServer())
      .post(`/api/v1/auth/login`)
      .set('x-tenant-id', 'tenant_a')
      .send({ email: 'admin@eproc.local', password: 'admin123' })
      .expect(200);

    expect(loginRes.body.accessToken).toBeDefined();

    const token = loginRes.body.accessToken;

    // tenders list
    const tendersRes = await request(app.getHttpServer())
      .get(`/api/v1/tenders`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', 'tenant_a')
      .expect(200);

    expect(Array.isArray(tendersRes.body)).toBe(true);
  });
});
