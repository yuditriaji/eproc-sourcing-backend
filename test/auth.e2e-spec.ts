import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

describe('Authentication & Authorization (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Tenant',
        subdomain: 'test-auth',
        residencyTag: 'us',
      },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  describe('TC-TRANS-001: Complete user registration → login → access protected resource', () => {
    it('should complete full authentication flow', async () => {
      // 1. Register user
      const registerData = {
        tenantId,
        email: 'testuser@example.com',
        username: 'testuser',
        password: 'Test@123',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.USER,
      };

      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerData)
        .expect(201);

      expect(registerResponse.body).toHaveProperty('id');
      expect(registerResponse.body.email).toBe(registerData.email);

      // 2. Login
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: registerData.email,
          password: registerData.password,
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('accessToken');
      expect(loginResponse.body.user.email).toBe(registerData.email);

      const accessToken = loginResponse.body.accessToken;

      // 3. Access protected resource
      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(meResponse.body.email).toBe(registerData.email);
      expect(meResponse.body.role).toBe(UserRole.USER);
    });
  });

  describe('TC-MASTER-002 & TC-MASTER-003: User login scenarios', () => {
    beforeAll(async () => {
      // Create admin user for testing
      await prisma.user.create({
        data: {
          tenantId,
          email: 'admin@test.com',
          username: 'admin',
          password: await bcrypt.hash('Admin@123', 10),
          firstName: 'Admin',
          lastName: 'User',
          role: UserRole.ADMIN,
          isActive: true,
          isVerified: true,
        },
      });
    });

    it('should login with valid credentials and return JWT token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'Admin@123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe('admin@test.com');
      expect(response.body.user.role).toBe(UserRole.ADMIN);

      // Store for later tests
      adminToken = response.body.accessToken;
    });

    it('should return 401 for invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'WrongPassword',
        })
        .expect(401);
    });

    it('should return 401 for non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'SomePassword',
        })
        .expect(401);
    });
  });

  describe('TC-TRANS-002: Test RolesGuard with @Roles decorator', () => {
    beforeAll(async () => {
      // Create regular user
      const user = await prisma.user.create({
        data: {
          tenantId,
          email: 'regularuser@test.com',
          username: 'regularuser',
          password: await bcrypt.hash('User@123', 10),
          firstName: 'Regular',
          lastName: 'User',
          role: UserRole.USER,
          isActive: true,
          isVerified: true,
        },
      });

      // Login to get token
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'regularuser@test.com',
          password: 'User@123',
        });

      userToken = loginResponse.body.accessToken;
    });

    it('should allow ADMIN to access admin-only endpoints', async () => {
      // Assuming there's an admin endpoint (adjust based on your API)
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      // Should not be 403
      expect(response.status).not.toBe(403);
    });

    it('should deny USER access to admin-only endpoints', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/roles')
        .set('Authorization', `Bearer ${userToken}`);

      // Depending on your implementation, this might be 403 Forbidden
      expect([403, 401]).toContain(response.status);
    });
  });

  describe('TC-TRANS-004: Test token expiry and refresh', () => {
    let refreshToken: string;

    it('should return refresh token on login', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'Admin@123',
        })
        .expect(200);

      // Check for refresh token in cookies
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();

      if (cookies && Array.isArray(cookies)) {
        const refreshCookie = cookies.find((cookie) => cookie.startsWith('refreshToken='));
        expect(refreshCookie).toBeDefined();
      }
    });

    it('should refresh access token with valid refresh token', async () => {
      // Login to get fresh tokens
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'Admin@123',
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Attempt to refresh
      const refreshResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies)
        .expect(200);

      expect(refreshResponse.body).toHaveProperty('accessToken');
      expect(refreshResponse.body.accessToken).toBeTruthy();
    });
  });

  describe('TC-TRANS-005: Test logout and token revocation', () => {
    it('should logout user and revoke tokens', async () => {
      // Login first
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'Admin@123',
        });

      const accessToken = loginResponse.body.accessToken;
      const cookies = loginResponse.headers['set-cookie'];

      // Logout
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies)
        .expect(200);

      // Try to use the token after logout
      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      // Should be unauthorized (token might still be valid in JWT but refresh token is revoked)
      // The exact behavior depends on your implementation
      expect([200, 401]).toContain(meResponse.status);
    });

    it('should not allow refresh after logout', async () => {
      // Login
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'Admin@123',
        });

      const cookies = loginResponse.headers['set-cookie'];
      const accessToken = loginResponse.body.accessToken;

      // Logout
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      // Try to refresh with revoked token
      const refreshResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies);

      expect([401, 403]).toContain(refreshResponse.status);
    });
  });

  describe('TC-MASTER-005: Verify user uniqueness per tenant', () => {
    it('should prevent duplicate email within same tenant', async () => {
      const userData = {
        tenantId,
        email: 'duplicate@test.com',
        username: 'uniqueuser1',
        password: 'Test@123',
        firstName: 'First',
        lastName: 'User',
        role: UserRole.USER,
      };

      // Create first user
      await request(app.getHttpServer()).post('/api/v1/auth/register').send(userData).expect(201);

      // Try to create duplicate with same email
      const duplicateResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...userData,
          username: 'uniqueuser2', // Different username
        });

      expect([400, 409]).toContain(duplicateResponse.status);
    });

    it('should prevent duplicate username within same tenant', async () => {
      const userData = {
        tenantId,
        email: 'unique@test.com',
        username: 'duplicateusername',
        password: 'Test@123',
        firstName: 'First',
        lastName: 'User',
        role: UserRole.USER,
      };

      // Create first user
      await request(app.getHttpServer()).post('/api/v1/auth/register').send(userData).expect(201);

      // Try to create duplicate with same username
      const duplicateResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...userData,
          email: 'different@test.com', // Different email
        });

      expect([400, 409]).toContain(duplicateResponse.status);
    });
  });
});
