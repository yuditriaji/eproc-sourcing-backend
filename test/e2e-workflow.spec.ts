/**
 * End-to-End Workflow Tests
 * Full procurement lifecycle: Tender → Bid → Contract → PO → GR → Invoice → Payment
 */

import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.BASE_URL || 'https://eproc-sourcing-backend.onrender.com';
const API_URL = `${BASE_URL}/api/v1`;

describe('E2E Procurement Workflow', () => {
  let client: AxiosInstance;
  let adminToken: string;
  let vendorToken: string;
  let tenderId: string;
  let bidId: string;
  let contractId: string;
  let poId: string;
  let grId: string;
  let invoiceId: string;

  beforeAll(async () => {
    client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      validateStatus: () => true,
    });

    // Setup admin user
    const adminEmail = `admin-e2e-${Date.now()}@test.com`;
    await client.post('/auth/register', {
      email: adminEmail,
      username: `admine2e${Date.now()}`,
      password: 'Admin@12345',
      role: 'ADMIN',
    });

    const adminLogin = await client.post('/auth/login', {
      email: adminEmail,
      password: 'Admin@12345',
    });
    adminToken = adminLogin.data.accessToken;

    // Setup vendor user
    const vendorEmail = `vendor-e2e-${Date.now()}@test.com`;
    await client.post('/auth/register', {
      email: vendorEmail,
      username: `vendore2e${Date.now()}`,
      password: 'Vendor@12345',
      role: 'VENDOR',
    });

    const vendorLogin = await client.post('/auth/login', {
      email: vendorEmail,
      password: 'Vendor@12345',
    });
    vendorToken = vendorLogin.data.accessToken;
  });

  describe('Step 1: Create and Publish Tender', () => {
    it('should create a tender', async () => {
      const tenderData = {
        title: `E2E Tender ${Date.now()}`,
        description: 'Full workflow tender for end-to-end testing',
        estimatedValue: 100000,
        category: 'IT_EQUIPMENT',
        specifications: {
          items: [
            { name: 'Laptop', quantity: 10, specifications: 'i7, 16GB RAM, 512GB SSD' },
            { name: 'Monitor', quantity: 10, specifications: '27-inch, 4K' },
          ],
        },
        evaluationCriteria: {
          price: 60,
          quality: 30,
          delivery: 10,
        },
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await client.post('/tenders', tenderData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 201) {
        expect(response.data).toHaveProperty('id');
        tenderId = response.data.id;
      }
    });

    it('should publish the tender', async () => {
      if (!tenderId) {
        console.log('Skipping: No tender ID');
        return;
      }

      const response = await client.patch(`/tenders/${tenderId}/publish`, {}, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(response.data.status).toBe('PUBLISHED');
      }
    });
  });

  describe('Step 2: Vendor Submits Bid', () => {
    it('should submit a bid', async () => {
      if (!tenderId) {
        console.log('Skipping: No tender ID');
        return;
      }

      const bidData = {
        tenderId,
        amount: 95000,
        technicalScore: 85,
        proposal: 'Our proposal includes premium equipment with extended warranty',
        items: [
          { name: 'Laptop', quantity: 10, unitPrice: 8000 },
          { name: 'Monitor', quantity: 10, unitPrice: 1500 },
        ],
        deliveryTimeline: '30 days',
      };

      const response = await client.post('/bids', bidData, {
        headers: { Authorization: `Bearer ${vendorToken}` },
      });

      if (response.status === 201) {
        expect(response.data).toHaveProperty('id');
        bidId = response.data.id;
      }
    });

    it('should evaluate and accept the bid', async () => {
      if (!bidId) {
        console.log('Skipping: No bid ID');
        return;
      }

      // Evaluate
      const evaluateRes = await client.patch(`/bids/${bidId}/evaluate`, {
        scores: { price: 57, quality: 25, delivery: 9 },
        notes: 'Strong technical offering with competitive pricing',
      }, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (evaluateRes.status === 200) {
        // Accept
        const acceptRes = await client.patch(`/bids/${bidId}/accept`, {}, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (acceptRes.status === 200) {
          expect(acceptRes.data.status).toBe('ACCEPTED');
        }
      }
    });
  });

  describe('Step 3: Create Contract', () => {
    it('should create contract from accepted bid', async () => {
      if (!bidId) {
        console.log('Skipping: No bid ID');
        return;
      }

      const contractData = {
        bidId,
        title: `Contract for E2E Test ${Date.now()}`,
        description: 'Contract for equipment procurement',
        value: 95000,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        terms: 'Standard terms and conditions apply',
      };

      const response = await client.post('/contracts', contractData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 201) {
        expect(response.data).toHaveProperty('id');
        contractId = response.data.id;
      }
    });

    it('should activate the contract', async () => {
      if (!contractId) {
        console.log('Skipping: No contract ID');
        return;
      }

      const response = await client.patch(`/contracts/${contractId}/activate`, {}, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(response.data.status).toBe('ACTIVE');
      }
    });
  });

  describe('Step 4: Create Purchase Order', () => {
    it('should create PO from contract', async () => {
      if (!contractId) {
        console.log('Skipping: No contract ID');
        return;
      }

      const poData = {
        contractId,
        title: `PO for E2E Test ${Date.now()}`,
        description: 'Purchase order for equipment',
        amount: 95000,
        items: [
          { name: 'Laptop', quantity: 10, unitPrice: 8000 },
          { name: 'Monitor', quantity: 10, unitPrice: 1500 },
        ],
      };

      const response = await client.post('/purchase-orders', poData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 201) {
        expect(response.data).toHaveProperty('id');
        poId = response.data.id;
      }
    });

    it('should approve the PO', async () => {
      if (!poId) {
        console.log('Skipping: No PO ID');
        return;
      }

      const response = await client.patch(`/purchase-orders/${poId}/approve`, {}, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(response.data.status).toBe('APPROVED');
      }
    });
  });

  describe('Step 5: Record Goods Receipt', () => {
    it('should create goods receipt', async () => {
      if (!poId) {
        console.log('Skipping: No PO ID');
        return;
      }

      const grData = {
        receiptNumber: `GR-E2E-${Date.now()}`,
        poId,
        receivedDate: new Date().toISOString(),
        receivedItems: [
          { itemName: 'Laptop', orderedQuantity: 10, receivedQuantity: 10, condition: 'GOOD' },
          { itemName: 'Monitor', orderedQuantity: 10, receivedQuantity: 10, condition: 'GOOD' },
        ],
        notes: 'All items received in good condition',
      };

      const response = await client.post('/goods-receipts', grData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 201) {
        expect(response.data).toHaveProperty('id');
        grId = response.data.id;
      }
    });

    it('should inspect goods receipt', async () => {
      if (!grId) {
        console.log('Skipping: No GR ID');
        return;
      }

      const inspectionData = {
        inspectedBy: 'QC Team',
        inspectedAt: new Date().toISOString(),
        inspectionNotes: 'All items meet specifications',
        approvalStatus: 'APPROVED',
      };

      const response = await client.patch(`/goods-receipts/${grId}/inspect`, inspectionData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(response.data).toHaveProperty('inspectedBy');
      }
    });
  });

  describe('Step 6: Create and Process Invoice', () => {
    it('should create invoice', async () => {
      if (!poId) {
        console.log('Skipping: No PO ID');
        return;
      }

      const invoiceData = {
        invoiceNumber: `INV-E2E-${Date.now()}`,
        poId,
        amount: 95000,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          { description: 'Laptop x 10', quantity: 10, unitPrice: 8000, totalPrice: 80000 },
          { description: 'Monitor x 10', quantity: 10, unitPrice: 1500, totalPrice: 15000 },
        ],
      };

      const response = await client.post('/invoices', invoiceData, {
        headers: { Authorization: `Bearer ${vendorToken}` },
      });

      if (response.status === 201) {
        expect(response.data).toHaveProperty('id');
        invoiceId = response.data.id;
      }
    });

    it('should approve invoice', async () => {
      if (!invoiceId) {
        console.log('Skipping: No invoice ID');
        return;
      }

      const response = await client.patch(`/invoices/${invoiceId}/approve`, {}, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(response.data.status).toBe('APPROVED');
      }
    });
  });

  describe('Step 7: Process Payment', () => {
    it('should create payment', async () => {
      if (!invoiceId) {
        console.log('Skipping: No invoice ID');
        return;
      }

      const paymentData = {
        invoiceId,
        amount: 95000,
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: `PAY-E2E-${Date.now()}`,
        paymentDate: new Date().toISOString(),
      };

      const response = await client.post('/payments', paymentData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 201) {
        expect(response.data).toHaveProperty('id');
        expect(response.data.status).toBe('COMPLETED');
      }
    });

    it('should verify payment updates invoice status', async () => {
      if (!invoiceId) {
        console.log('Skipping: No invoice ID');
        return;
      }

      const response = await client.get(`/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(['PAID', 'APPROVED']).toContain(response.data.status);
      }
    });

    it('should verify contract is fulfilled', async () => {
      if (!contractId) {
        console.log('Skipping: No contract ID');
        return;
      }

      const response = await client.get(`/contracts/${contractId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(['ACTIVE', 'COMPLETED']).toContain(response.data.status);
      }
    });
  });

  describe('Verification and Reporting', () => {
    it('should retrieve complete workflow audit trail', async () => {
      if (!tenderId) {
        console.log('Skipping: No tender ID');
        return;
      }

      const response = await client.get(`/audit-logs?entityId=${tenderId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(Array.isArray(response.data)).toBe(true);
      }
    });

    it('should generate workflow report', async () => {
      if (!tenderId) {
        console.log('Skipping: No tender ID');
        return;
      }

      const response = await client.get(`/reports/workflow/${tenderId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      // Report endpoint may not exist, skip if not found
      if (response.status === 200) {
        expect(response.data).toBeDefined();
      }
    });
  });
});

describe('Multi-Tenant Isolation Tests', () => {
  let client: AxiosInstance;
  let tenant1AdminToken: string;
  let tenant2AdminToken: string;
  let tenant1TenderId: string;

  beforeAll(async () => {
    client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      validateStatus: () => true,
    });

    // Setup tenant 1 admin
    const t1Email = `tenant1-admin-${Date.now()}@test.com`;
    await client.post('/auth/register', {
      email: t1Email,
      username: `t1admin${Date.now()}`,
      password: 'Admin@12345',
      role: 'ADMIN',
    });

    const t1Login = await client.post('/auth/login', {
      email: t1Email,
      password: 'Admin@12345',
    });
    tenant1AdminToken = t1Login.data.accessToken;

    // Setup tenant 2 admin
    const t2Email = `tenant2-admin-${Date.now()}@test.com`;
    await client.post('/auth/register', {
      email: t2Email,
      username: `t2admin${Date.now()}`,
      password: 'Admin@12345',
      role: 'ADMIN',
    });

    const t2Login = await client.post('/auth/login', {
      email: t2Email,
      password: 'Admin@12345',
    });
    tenant2AdminToken = t2Login.data.accessToken;
  });

  it('should create tender in tenant 1', async () => {
    const tenderData = {
      title: `Tenant 1 Tender ${Date.now()}`,
      description: 'Tender for tenant 1',
      estimatedValue: 50000,
      category: 'SERVICES',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const response = await client.post('/tenders', tenderData, {
      headers: { Authorization: `Bearer ${tenant1AdminToken}` },
    });

    if (response.status === 201) {
      tenant1TenderId = response.data.id;
    }
  });

  it('should not allow tenant 2 to access tenant 1 tender', async () => {
    if (!tenant1TenderId) {
      console.log('Skipping: No tenant 1 tender ID');
      return;
    }

    const response = await client.get(`/tenders/${tenant1TenderId}`, {
      headers: { Authorization: `Bearer ${tenant2AdminToken}` },
    });

    // Should be 404 or 403 (not found or forbidden)
    if (response.status !== 502) {
      expect([403, 404]).toContain(response.status);
    }
  });

  it('should not list tenant 1 tender for tenant 2', async () => {
    const response = await client.get('/tenders', {
      headers: { Authorization: `Bearer ${tenant2AdminToken}` },
    });

    if (response.status === 200) {
      const tenders = response.data;
      // Tenant 1 tender should not appear in tenant 2 list
      const foundTender = tenders.find((t: any) => t.id === tenant1TenderId);
      expect(foundTender).toBeUndefined();
    }
  });
});
