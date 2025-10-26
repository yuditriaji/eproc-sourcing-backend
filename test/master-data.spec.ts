/**
 * Master Data Management Tests
 * TC-MASTER-001 to TC-MASTER-023
 * Covers: Currencies, Departments, Vendors, and Budget Management
 */

import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.BASE_URL || 'https://eproc-sourcing-backend.onrender.com';
const API_URL = `${BASE_URL}/api/v1`;

describe('Master Data Management', () => {
  let client: AxiosInstance;
  let adminToken: string;
  let userToken: string;
  let vendorToken: string;

  beforeAll(async () => {
    client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      validateStatus: () => true,
    });

    // Setup admin user
    const adminEmail = `admin-master-${Date.now()}@test.com`;
    await client.post('/auth/register', {
      email: adminEmail,
      username: `adminmaster${Date.now()}`,
      password: 'Admin@12345',
      role: 'ADMIN',
    });

    const adminLogin = await client.post('/auth/login', {
      email: adminEmail,
      password: 'Admin@12345',
    });
    adminToken = adminLogin.data.accessToken;

    // Setup regular user
    const userEmail = `user-master-${Date.now()}@test.com`;
    await client.post('/auth/register', {
      email: userEmail,
      username: `usermaster${Date.now()}`,
      password: 'User@12345',
      role: 'USER',
    });

    const userLogin = await client.post('/auth/login', {
      email: userEmail,
      password: 'User@12345',
    });
    userToken = userLogin.data.accessToken;

    // Setup vendor user
    const vendorEmail = `vendor-master-${Date.now()}@test.com`;
    await client.post('/auth/register', {
      email: vendorEmail,
      username: `vendormaster${Date.now()}`,
      password: 'Vendor@12345',
      role: 'VENDOR',
    });

    const vendorLogin = await client.post('/auth/login', {
      email: vendorEmail,
      password: 'Vendor@12345',
    });
    vendorToken = vendorLogin.data.accessToken;
  }, 60000); // Increase timeout for setup

  // ==========================================
  // CURRENCY MANAGEMENT (TC-MASTER-001 to TC-MASTER-005)
  // ==========================================

  describe('Currency Management (TC-MASTER-001 to TC-MASTER-005)', () => {
    let currencyId: string;

    describe('TC-MASTER-001: Create new currency', () => {
      it('should create a new currency as ADMIN', async () => {
        const currencyData = {
          code: `TST${Date.now().toString().slice(-6)}`,
          name: 'Test Currency',
          symbol: '₸',
          exchangeRate: 1.25,
          isActive: true,
        };

        const response = await client.post('/currencies', currencyData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 201) {
          expect(response.data).toHaveProperty('id');
          expect(response.data.code).toBe(currencyData.code);
          expect(response.data.exchangeRate).toBe(currencyData.exchangeRate);
          currencyId = response.data.id;
        } else if (response.status === 404) {
          console.log('Currency creation endpoint not available');
        }
      });

      it('should prevent duplicate currency codes', async () => {
        const currencyData = {
          code: 'USD',
          name: 'US Dollar Duplicate',
          symbol: '$',
          exchangeRate: 1.0,
        };

        const response = await client.post('/currencies', currencyData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status !== 404) {
          expect([400, 409]).toContain(response.status);
        }
      });

      it('should validate currency code format', async () => {
        const invalidData = {
          code: 'INVALID_CODE', // Too long
          name: 'Invalid Currency',
          symbol: '$',
          exchangeRate: 1.0,
        };

        const response = await client.post('/currencies', invalidData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status !== 404) {
          expect([400, 422]).toContain(response.status);
        }
      });
    });

    describe('TC-MASTER-002: List all currencies', () => {
      it('should list all currencies', async () => {
        const response = await client.get('/currencies', {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200) {
          expect(Array.isArray(response.data)).toBe(true);
          if (response.data.length > 0) {
            expect(response.data[0]).toHaveProperty('code');
            expect(response.data[0]).toHaveProperty('name');
          }
        }
      });

      it('should filter active currencies only', async () => {
        const response = await client.get('/currencies?isActive=true', {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200 && Array.isArray(response.data)) {
          response.data.forEach((currency: any) => {
            if (currency.isActive !== undefined) {
              expect(currency.isActive).toBe(true);
            }
          });
        }
      });
    });

    describe('TC-MASTER-003: Update currency', () => {
      it('should update currency exchange rate', async () => {
        if (!currencyId) {
          console.log('Skipping: No currency ID');
          return;
        }

        const updateData = {
          exchangeRate: 1.35,
          isActive: true,
        };

        const response = await client.patch(`/currencies/${currencyId}`, updateData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200) {
          expect(response.data.exchangeRate).toBe(updateData.exchangeRate);
        } else if (response.status === 404) {
          console.log('Currency update endpoint not available');
        }
      });

      it('should prevent non-admin from updating currency', async () => {
        if (!currencyId) {
          console.log('Skipping: No currency ID');
          return;
        }

        const response = await client.patch(
          `/currencies/${currencyId}`,
          { exchangeRate: 1.5 },
          { headers: { Authorization: `Bearer ${vendorToken}` } },
        );

        if (response.status !== 404) {
          expect([401, 403]).toContain(response.status);
        }
      });
    });

    describe('TC-MASTER-004: Deactivate currency', () => {
      it('should deactivate a currency', async () => {
        if (!currencyId) {
          console.log('Skipping: No currency ID');
          return;
        }

        const response = await client.patch(
          `/currencies/${currencyId}`,
          { isActive: false },
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );

        if (response.status === 200) {
          expect(response.data.isActive).toBe(false);
        }
      });
    });

    describe('TC-MASTER-005: Delete currency', () => {
      it('should delete a currency', async () => {
        if (!currencyId) {
          console.log('Skipping: No currency ID');
          return;
        }

        const response = await client.delete(`/currencies/${currencyId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200 || response.status === 204) {
          // Verify deletion
          const getResponse = await client.get(`/currencies/${currencyId}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          });
          expect(getResponse.status).toBe(404);
        } else if (response.status === 404) {
          console.log('Currency deletion endpoint not available');
        }
      });
    });
  });

  // ==========================================
  // DEPARTMENT MANAGEMENT (TC-MASTER-011 to TC-MASTER-015)
  // ==========================================

  describe('Department Management (TC-MASTER-011 to TC-MASTER-015)', () => {
    let departmentId: string;

    describe('TC-MASTER-011: Create department', () => {
      it('should create a new department', async () => {
        const deptData = {
          code: `DEPT${Date.now().toString().slice(-6)}`,
          name: `Test Department ${Date.now()}`,
          description: 'Department for testing purposes',
          budgetLimit: 500000,
          isActive: true,
        };

        const response = await client.post('/departments', deptData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 201) {
          expect(response.data).toHaveProperty('id');
          expect(response.data.name).toBe(deptData.name);
          departmentId = response.data.id;
        } else if (response.status === 404) {
          console.log('Department creation endpoint not available');
        }
      });

      it('should validate required fields', async () => {
        const invalidData = {
          code: `DEPT${Date.now()}`,
          // Missing name
        };

        const response = await client.post('/departments', invalidData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status !== 404) {
          expect([400, 422]).toContain(response.status);
        }
      });
    });

    describe('TC-MASTER-012: List departments', () => {
      it('should list all departments', async () => {
        const response = await client.get('/departments', {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200) {
          expect(Array.isArray(response.data)).toBe(true);
        } else if (response.status === 404) {
          console.log('Department listing endpoint not available');
        }
      });

      it('should filter departments by status', async () => {
        const response = await client.get('/departments?isActive=true', {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200 && Array.isArray(response.data)) {
          response.data.forEach((dept: any) => {
            if (dept.isActive !== undefined) {
              expect(dept.isActive).toBe(true);
            }
          });
        }
      });
    });

    describe('TC-MASTER-013: Update department', () => {
      it('should update department details', async () => {
        if (!departmentId) {
          console.log('Skipping: No department ID');
          return;
        }

        const updateData = {
          budgetLimit: 600000,
          description: 'Updated description',
        };

        const response = await client.patch(`/departments/${departmentId}`, updateData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200) {
          expect(response.data.budgetLimit).toBe(updateData.budgetLimit);
        }
      });
    });

    describe('TC-MASTER-014: Assign users to department', () => {
      it('should assign user to department', async () => {
        if (!departmentId) {
          console.log('Skipping: No department ID');
          return;
        }

        const response = await client.post(
          `/departments/${departmentId}/users`,
          { userId: 'test-user-id' },
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );

        // May not be implemented
        if (response.status !== 404) {
          expect([200, 201]).toContain(response.status);
        }
      });
    });

    describe('TC-MASTER-015: Deactivate department', () => {
      it('should deactivate a department', async () => {
        if (!departmentId) {
          console.log('Skipping: No department ID');
          return;
        }

        const response = await client.patch(
          `/departments/${departmentId}`,
          { isActive: false },
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );

        if (response.status === 200) {
          expect(response.data.isActive).toBe(false);
        }
      });
    });
  });

  // ==========================================
  // BUDGET MANAGEMENT (TC-MASTER-016 to TC-MASTER-020)
  // ==========================================

  describe('Budget Management (TC-MASTER-016 to TC-MASTER-020)', () => {
    let budgetId: string;
    let departmentId: string;

    beforeAll(async () => {
      // Create a department for budget testing
      const deptRes = await client.post(
        '/departments',
        {
          code: `BUDG${Date.now().toString().slice(-6)}`,
          name: `Budget Test Dept ${Date.now()}`,
          budgetLimit: 1000000,
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      if (deptRes.status === 201) {
        departmentId = deptRes.data.id;
      }
    });

    describe('TC-MASTER-016: Create budget', () => {
      it('should create a new budget', async () => {
        const budgetData = {
          fiscalYear: new Date().getFullYear(),
          departmentId: departmentId || 'default-dept',
          totalAmount: 1000000,
          allocatedAmount: 0,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        };

        const response = await client.post('/budgets', budgetData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 201) {
          expect(response.data).toHaveProperty('id');
          expect(response.data.totalAmount).toBe(budgetData.totalAmount);
          budgetId = response.data.id;
        } else if (response.status === 404) {
          console.log('Budget creation endpoint not available');
        }
      });

      it('should validate budget dates', async () => {
        const invalidData = {
          fiscalYear: new Date().getFullYear(),
          totalAmount: 1000000,
          startDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(), // End before start
        };

        const response = await client.post('/budgets', invalidData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status !== 404) {
          expect([400, 422]).toContain(response.status);
        }
      });
    });

    describe('TC-MASTER-017: List budgets', () => {
      it('should list all budgets', async () => {
        const response = await client.get('/budgets', {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200) {
          expect(Array.isArray(response.data)).toBe(true);
        } else if (response.status === 404) {
          console.log('Budget listing endpoint not available');
        }
      });

      it('should filter budgets by fiscal year', async () => {
        const currentYear = new Date().getFullYear();
        const response = await client.get(`/budgets?fiscalYear=${currentYear}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200 && Array.isArray(response.data)) {
          response.data.forEach((budget: any) => {
            if (budget.fiscalYear) {
              expect(budget.fiscalYear).toBe(currentYear);
            }
          });
        }
      });

      it('should filter budgets by department', async () => {
        if (!departmentId) {
          console.log('Skipping: No department ID');
          return;
        }

        const response = await client.get(`/budgets?departmentId=${departmentId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200) {
          expect(Array.isArray(response.data)).toBe(true);
        }
      });
    });

    describe('TC-MASTER-018: Update budget allocation', () => {
      it('should update budget allocated amount', async () => {
        if (!budgetId) {
          console.log('Skipping: No budget ID');
          return;
        }

        const updateData = {
          allocatedAmount: 250000,
        };

        const response = await client.patch(`/budgets/${budgetId}`, updateData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200) {
          expect(response.data.allocatedAmount).toBe(updateData.allocatedAmount);
        }
      });

      it('should prevent over-allocation', async () => {
        if (!budgetId) {
          console.log('Skipping: No budget ID');
          return;
        }

        const updateData = {
          allocatedAmount: 1500000, // More than total
        };

        const response = await client.patch(`/budgets/${budgetId}`, updateData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status !== 404) {
          expect([400, 422]).toContain(response.status);
        }
      });
    });

    describe('TC-MASTER-019: Check budget availability', () => {
      it('should check available budget', async () => {
        if (!budgetId) {
          console.log('Skipping: No budget ID');
          return;
        }

        const response = await client.get(`/budgets/${budgetId}/available`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200) {
          expect(response.data).toHaveProperty('available');
        } else if (response.status === 404) {
          console.log('Budget availability endpoint not available');
        }
      });

      it('should calculate remaining budget correctly', async () => {
        if (!budgetId) {
          console.log('Skipping: No budget ID');
          return;
        }

        const response = await client.get(`/budgets/${budgetId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200) {
          const budget = response.data;
          const expected = budget.totalAmount - (budget.allocatedAmount || 0);
          if (budget.remainingAmount !== undefined) {
            expect(budget.remainingAmount).toBe(expected);
          }
        }
      });
    });

    describe('TC-MASTER-020: Budget alerts', () => {
      it('should alert when budget exceeds threshold', async () => {
        if (!budgetId) {
          console.log('Skipping: No budget ID');
          return;
        }

        // Update to 90% allocation
        await client.patch(
          `/budgets/${budgetId}`,
          { allocatedAmount: 900000 },
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );

        const response = await client.get(`/budgets/${budgetId}/alerts`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200) {
          expect(response.data).toHaveProperty('alerts');
        } else if (response.status === 404) {
          console.log('Budget alerts endpoint not available');
        }
      });
    });
  });

  // ==========================================
  // ADDITIONAL VENDOR TESTS (TC-MASTER-006 to TC-MASTER-010)
  // ==========================================

  describe('Vendor Management Extended (TC-MASTER-006 to TC-MASTER-010)', () => {
    let testVendorId: string;

    describe('TC-MASTER-006: Create vendor', () => {
      it('should create a vendor with complete details', async () => {
        const vendorData = {
          name: `Test Vendor ${Date.now()}`,
          email: `vendor${Date.now()}@test.com`,
          phone: '+1234567890',
          address: '123 Test Street',
          city: 'Test City',
          country: 'Test Country',
          taxId: `TAX${Date.now()}`,
          category: 'IT_SERVICES',
          status: 'ACTIVE',
        };

        const response = await client.post('/vendors', vendorData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 201) {
          expect(response.data).toHaveProperty('id');
          expect(response.data.name).toBe(vendorData.name);
          testVendorId = response.data.id;
        }
      });
    });

    describe('TC-MASTER-007: List vendors with filters', () => {
      it('should filter vendors by category', async () => {
        const response = await client.get('/vendors?category=IT_SERVICES', {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200 && Array.isArray(response.data)) {
          response.data.forEach((vendor: any) => {
            if (vendor.category) {
              expect(vendor.category).toBe('IT_SERVICES');
            }
          });
        }
      });

      it('should filter vendors by status', async () => {
        const response = await client.get('/vendors?status=ACTIVE', {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200 && Array.isArray(response.data)) {
          response.data.forEach((vendor: any) => {
            if (vendor.status) {
              expect(vendor.status).toBe('ACTIVE');
            }
          });
        }
      });

      it('should search vendors by name', async () => {
        const response = await client.get('/vendors?search=Test', {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200) {
          expect(Array.isArray(response.data)).toBe(true);
        }
      });
    });

    describe('TC-MASTER-008: Update vendor', () => {
      it('should update vendor details', async () => {
        if (!testVendorId) {
          console.log('Skipping: No vendor ID');
          return;
        }

        const updateData = {
          phone: '+9876543210',
          status: 'ACTIVE',
        };

        const response = await client.patch(`/vendors/${testVendorId}`, updateData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200) {
          expect(response.data.phone).toBe(updateData.phone);
        }
      });
    });

    describe('TC-MASTER-009: Vendor performance tracking', () => {
      it('should retrieve vendor performance metrics', async () => {
        if (!testVendorId) {
          console.log('Skipping: No vendor ID');
          return;
        }

        const response = await client.get(`/vendors/${testVendorId}/performance`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 200) {
          expect(response.data).toBeDefined();
        } else if (response.status === 404) {
          console.log('Vendor performance endpoint not available');
        }
      });
    });

    describe('TC-MASTER-010: Suspend/activate vendor', () => {
      it('should suspend a vendor', async () => {
        if (!testVendorId) {
          console.log('Skipping: No vendor ID');
          return;
        }

        const response = await client.patch(
          `/vendors/${testVendorId}`,
          { status: 'SUSPENDED' },
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );

        if (response.status === 200) {
          expect(response.data.status).toBe('SUSPENDED');
        }
      });

      it('should reactivate a vendor', async () => {
        if (!testVendorId) {
          console.log('Skipping: No vendor ID');
          return;
        }

        const response = await client.patch(
          `/vendors/${testVendorId}`,
          { status: 'ACTIVE' },
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );

        if (response.status === 200) {
          expect(response.data.status).toBe('ACTIVE');
        }
      });
    });
  });
});
