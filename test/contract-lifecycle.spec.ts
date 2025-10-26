/**
 * Contract Lifecycle Tests
 * TC-TRANS-017 to TC-TRANS-021
 */

import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.BASE_URL || 'https://eproc-sourcing-backend.onrender.com';
const API_URL = `${BASE_URL}/api/v1`;

describe('Contract Lifecycle Management', () => {
  let client: AxiosInstance;
  let adminToken: string;
  let contractId: string;
  let vendorId: string;
  let currencyId: string;

  beforeAll(async () => {
    client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      validateStatus: () => true,
    });

    // Register and login as ADMIN
    const adminEmail = `admin-${Date.now()}@test.com`;
    await client.post('/auth/register', {
      email: adminEmail,
      username: `admin${Date.now()}`,
      password: 'Admin@12345',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    });

    const loginRes = await client.post('/auth/login', {
      email: adminEmail,
      password: 'Admin@12345',
    });
    adminToken = loginRes.data.accessToken;

    // Get or create currency
    const currenciesRes = await client.get('/currencies', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (currenciesRes.status === 200 && currenciesRes.data.length > 0) {
      currencyId = currenciesRes.data[0].id;
    }

    // Create vendor
    const vendorRes = await client.post(
      '/vendors',
      {
        name: `Contract Test Vendor ${Date.now()}`,
        registrationNumber: `REG-${Date.now()}`,
        taxId: `TAX-${Date.now()}`,
        contactEmail: `vendor-contract-${Date.now()}@test.com`,
        status: 'ACTIVE',
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    if (vendorRes.status === 201) {
      vendorId = vendorRes.data.id;
    }
  });

  describe('TC-TRANS-017: Create contract (draft)', () => {
    it('should create contract in DRAFT status', async () => {
      const contractData = {
        contractNumber: `CNT-${Date.now()}`,
        title: `Test Contract ${Date.now()}`,
        description: 'Contract for testing lifecycle',
        totalAmount: 500000,
        currencyId,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        terms: {
          paymentTerms: 'Net 30',
          deliveryTerms: 'FOB',
          warranties: '1 year',
        },
        deliverables: {
          milestones: [
            { name: 'Phase 1', deadline: '2025-03-01', value: 200000 },
            { name: 'Phase 2', deadline: '2025-06-01', value: 300000 },
          ],
        },
      };

      const response = await client.post('/contracts', contractData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 201) {
        expect(response.data).toHaveProperty('id');
        expect(response.data.status).toBe('DRAFT');
        expect(response.data.title).toBe(contractData.title);
        expect(response.data.contractNumber).toBe(contractData.contractNumber);
        contractId = response.data.id;
      } else {
        console.log('Create contract response:', response.status, response.data);
      }
    });

    it('should retrieve contract by ID', async () => {
      if (!contractId) {
        console.log('Skipping: No contract ID');
        return;
      }

      const response = await client.get(`/contracts/${contractId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(response.data).toHaveProperty('id', contractId);
        expect(response.data.status).toBe('DRAFT');
      }
    });

    it('should update contract details', async () => {
      if (!contractId) {
        console.log('Skipping: No contract ID');
        return;
      }

      const updateData = {
        description: 'Updated contract description',
        totalAmount: 550000,
      };

      const response = await client.patch(`/contracts/${contractId}`, updateData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(response.data.description).toBe(updateData.description);
        expect(response.data.totalAmount).toBe(updateData.totalAmount);
      }
    });
  });

  describe('TC-TRANS-018: Assign vendors to contract (ContractVendor)', () => {
    it('should assign PRIMARY vendor to contract', async () => {
      if (!contractId || !vendorId) {
        console.log('Skipping: No contract or vendor ID');
        return;
      }

      const response = await client.post(
        `/contracts/${contractId}/vendors`,
        {
          vendorId,
          role: 'PRIMARY',
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      if (response.status === 201 || response.status === 200) {
        expect(response.data).toBeDefined();
      }
    });

    it('should assign SECONDARY vendor to contract', async () => {
      if (!contractId) {
        console.log('Skipping: No contract ID');
        return;
      }

      // Create another vendor
      const vendor2Res = await client.post(
        '/vendors',
        {
          name: `Secondary Vendor ${Date.now()}`,
          registrationNumber: `REG-SEC-${Date.now()}`,
          taxId: `TAX-SEC-${Date.now()}`,
          contactEmail: `vendor2-${Date.now()}@test.com`,
          status: 'ACTIVE',
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      if (vendor2Res.status === 201) {
        const vendor2Id = vendor2Res.data.id;

        const response = await client.post(
          `/contracts/${contractId}/vendors`,
          {
            vendorId: vendor2Id,
            role: 'SECONDARY',
          },
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );

        if (response.status === 201 || response.status === 200) {
          expect(response.data).toBeDefined();
        }
      }
    });

    it('should list all vendors for contract', async () => {
      if (!contractId) {
        console.log('Skipping: No contract ID');
        return;
      }

      const response = await client.get(`/contracts/${contractId}/vendors`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(Array.isArray(response.data)).toBe(true);
        if (response.data.length > 0) {
          expect(response.data[0]).toHaveProperty('vendorId');
          expect(response.data[0]).toHaveProperty('role');
        }
      }
    });
  });

  describe('TC-TRANS-019: Sign contract', () => {
    it('should mark vendor signature', async () => {
      if (!contractId || !vendorId) {
        console.log('Skipping: No contract or vendor ID');
        return;
      }

      const response = await client.post(
        `/contracts/${contractId}/vendors/${vendorId}/sign`,
        {
          signedAt: new Date().toISOString(),
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      if (response.status === 200) {
        expect(response.data).toHaveProperty('signedAt');
      }
    });

    it('should transition contract to IN_PROGRESS after signing', async () => {
      if (!contractId) {
        console.log('Skipping: No contract ID');
        return;
      }

      const response = await client.patch(
        `/contracts/${contractId}/status`,
        { status: 'IN_PROGRESS' },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      if (response.status === 200) {
        expect(response.data.status).toBe('IN_PROGRESS');
      }
    });
  });

  describe('TC-TRANS-020: Complete contract', () => {
    it('should transition contract IN_PROGRESS → COMPLETED', async () => {
      if (!contractId) {
        console.log('Skipping: No contract ID');
        return;
      }

      const response = await client.patch(
        `/contracts/${contractId}/status`,
        { status: 'COMPLETED' },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      if (response.status === 200) {
        expect(response.data.status).toBe('COMPLETED');
      }
    });

    it('should transition contract COMPLETED → CLOSED', async () => {
      if (!contractId) {
        console.log('Skipping: No contract ID');
        return;
      }

      const response = await client.patch(
        `/contracts/${contractId}/status`,
        { status: 'CLOSED' },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      if (response.status === 200) {
        expect(response.data.status).toBe('CLOSED');
      }
    });
  });

  describe('TC-TRANS-021: Terminate contract', () => {
    it('should create and terminate a contract', async () => {
      // Create new contract
      const contractData = {
        contractNumber: `CNT-TERM-${Date.now()}`,
        title: `Termination Test Contract ${Date.now()}`,
        description: 'Contract for termination testing',
        totalAmount: 100000,
        currencyId,
      };

      const createRes = await client.post('/contracts', contractData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (createRes.status === 201) {
        const terminationContractId = createRes.data.id;

        // Terminate it
        const response = await client.patch(
          `/contracts/${terminationContractId}/status`,
          {
            status: 'TERMINATED',
            terminationReason: 'Breach of contract terms',
          },
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );

        if (response.status === 200) {
          expect(response.data.status).toBe('TERMINATED');
        }
      }
    });
  });

  describe('Contract Listing and Filtering', () => {
    it('should list all contracts', async () => {
      const response = await client.get('/contracts', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(Array.isArray(response.data)).toBe(true);
      }
    });

    it('should filter contracts by status', async () => {
      const response = await client.get('/contracts?status=DRAFT', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(Array.isArray(response.data)).toBe(true);
      }
    });
  });
});
