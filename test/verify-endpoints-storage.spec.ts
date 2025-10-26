/**
 * Endpoint Data Storage Verification Test
 * 
 * This test verifies that Invoice, Payment, and Quotation endpoints
 * actually store data in the database tables.
 */

import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.BASE_URL || 'https://eproc-sourcing-backend.onrender.com';
const API_URL = `${BASE_URL}/api/v1`;
const TENANT = 'test-tenant';

describe('Endpoint Data Storage Verification', () => {
  let client: AxiosInstance;
  let adminToken: string;
  let vendorToken: string;
  let vendorId: string;
  let poId: string;
  let invoiceId: string;
  let paymentId: string;
  let quotationId: string;

  beforeAll(async () => {
    console.log('\n🔍 VERIFYING ENDPOINT DATA STORAGE\n');

    client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      validateStatus: () => true,
    });

    // Wait for API to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create ADMIN user
    const adminEmail = `admin-storage-${Date.now()}@test.com`;
    const adminRegister = await client.post('/auth/register', {
      email: adminEmail,
      username: `adminstorage${Date.now()}`,
      password: 'Admin@12345',
      role: 'ADMIN',
    });

    if (adminRegister.status === 201 || adminRegister.status === 200) {
      const adminLogin = await client.post('/auth/login', {
        email: adminEmail,
        password: 'Admin@12345',
      });
      adminToken = adminLogin.data.accessToken;
      console.log('✓ Admin authenticated');
    } else {
      console.log('⚠ Admin registration failed:', adminRegister.status);
      return;
    }

    // Create vendor
    const vendorRes = await client.post(
      `/${TENANT}/vendors`,
      {
        name: `Storage Test Vendor ${Date.now()}`,
        registrationNumber: `REG-STOR-${Date.now()}`,
        taxId: `TAX-STOR-${Date.now()}`,
        contactEmail: `vendor-stor-${Date.now()}@test.com`,
        status: 'ACTIVE',
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );

    if (vendorRes.status === 201) {
      vendorId = vendorRes.data.id;
      console.log('✓ Vendor created:', vendorId);
    }

    // Create vendor user
    const vendorEmail = `vendor-stor-${Date.now()}@test.com`;
    await client.post('/auth/register', {
      email: vendorEmail,
      username: `vendorstor${Date.now()}`,
      password: 'Vendor@12345',
      role: 'VENDOR',
    });

    const vendorLogin = await client.post('/auth/login', {
      email: vendorEmail,
      password: 'Vendor@12345',
    });
    vendorToken = vendorLogin.data.accessToken;
    console.log('✓ Vendor user authenticated');

    // Create a PO
    const poRes = await client.post(
      `/${TENANT}/purchase-orders`,
      {
        title: `Storage Test PO ${Date.now()}`,
        description: 'PO for storage verification',
        amount: 10000,
        items: [
          { name: 'Item A', quantity: 1, unitPrice: 5000 },
          { name: 'Item B', quantity: 1, unitPrice: 5000 },
        ],
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );

    if (poRes.status === 201) {
      poId = poRes.data.id;
      console.log('✓ Purchase Order created:', poId);
      
      // Approve the PO
      await client.patch(
        `/${TENANT}/purchase-orders/${poId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      console.log('✓ Purchase Order approved');
    }

    console.log('\n--- Test Setup Complete ---\n');
  }, 60000);

  describe('VERIFY: Invoice Endpoint Stores Data', () => {
    it('should create invoice and verify it exists in database', async () => {
      if (!poId || !vendorId || !vendorToken) {
        console.log('⚠ Skipping: Missing prerequisites');
        return;
      }

      console.log('\n📋 Testing Invoice Creation...');

      const invoiceData = {
        invoiceNumber: `INV-STOR-${Date.now()}`,
        poId,
        vendorId,
        amount: 10000,
        taxAmount: 1000,
        totalAmount: 11000,
        items: [
          {
            itemNumber: 1,
            description: 'Item A',
            quantity: 1,
            unitPrice: 5000,
            totalAmount: 5000,
          },
          {
            itemNumber: 2,
            description: 'Item B',
            quantity: 1,
            unitPrice: 5000,
            totalAmount: 5000,
          },
        ],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Storage verification invoice',
      };

      const createRes = await client.post(`/${TENANT}/invoices`, invoiceData, {
        headers: { Authorization: `Bearer ${vendorToken}` },
      });

      console.log(`   Create response status: ${createRes.status}`);
      expect([200, 201]).toContain(createRes.status);

      if (createRes.status === 201) {
        invoiceId = createRes.data.id;
        console.log(`   ✓ Invoice created: ${invoiceId}`);

        // Verify invoice can be retrieved
        const getRes = await client.get(`/${TENANT}/invoices/${invoiceId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        console.log(`   Retrieve response status: ${getRes.status}`);
        expect(getRes.status).toBe(200);
        expect(getRes.data.id).toBe(invoiceId);
        expect(getRes.data.invoiceNumber).toBe(invoiceData.invoiceNumber);
        console.log('   ✓ Invoice verified in database');

        // List all invoices
        const listRes = await client.get(`/${TENANT}/invoices`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        expect(listRes.status).toBe(200);
        const invoices = listRes.data.data || listRes.data;
        expect(Array.isArray(invoices)).toBe(true);
        expect(invoices.length).toBeGreaterThan(0);
        console.log(`   ✓ Total invoices in database: ${invoices.length}`);
      }
    });
  });

  describe('VERIFY: Payment Endpoint Stores Data', () => {
    it('should create payment and verify it exists in database', async () => {
      if (!poId || !invoiceId || !adminToken) {
        console.log('⚠ Skipping: Missing prerequisites');
        return;
      }

      console.log('\n💰 Testing Payment Creation...');

      const paymentData = {
        paymentNumber: `PAY-STOR-${Date.now()}`,
        invoiceId,
        poId,
        amount: 11000,
        paymentType: 'ADVANCE',
        method: 'BANK_TRANSFER',
        reference: `REF-${Date.now()}`,
        notes: 'Storage verification payment',
      };

      const createRes = await client.post(`/${TENANT}/payments`, paymentData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      console.log(`   Create response status: ${createRes.status}`);
      expect([200, 201]).toContain(createRes.status);

      if (createRes.status === 201) {
        paymentId = createRes.data.id;
        console.log(`   ✓ Payment created: ${paymentId}`);

        // Verify payment can be retrieved
        const getRes = await client.get(`/${TENANT}/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        console.log(`   Retrieve response status: ${getRes.status}`);
        expect(getRes.status).toBe(200);
        expect(getRes.data.id).toBe(paymentId);
        expect(getRes.data.paymentNumber).toBe(paymentData.paymentNumber);
        console.log('   ✓ Payment verified in database');

        // List all payments
        const listRes = await client.get(`/${TENANT}/payments`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        expect(listRes.status).toBe(200);
        const payments = listRes.data.data || listRes.data;
        expect(Array.isArray(payments)).toBe(true);
        expect(payments.length).toBeGreaterThan(0);
        console.log(`   ✓ Total payments in database: ${payments.length}`);
      }
    });
  });

  describe('VERIFY: Quotation Endpoint Stores Data', () => {
    it('should create quotation and verify it exists in database', async () => {
      if (!vendorId || !adminToken) {
        console.log('⚠ Skipping: Missing prerequisites');
        return;
      }

      console.log('\n📝 Testing Quotation Creation...');

      const quotationData = {
        quotationNumber: `QUO-STOR-${Date.now()}`,
        vendorId,
        amount: 15000,
        items: [
          {
            itemNumber: 1,
            description: 'Service A',
            quantity: 1,
            unitPrice: 7500,
            totalAmount: 7500,
          },
          {
            itemNumber: 2,
            description: 'Service B',
            quantity: 1,
            unitPrice: 7500,
            totalAmount: 7500,
          },
        ],
        validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Storage verification quotation',
        terms: { payment: 'Net 30', delivery: '14 days' },
      };

      const createRes = await client.post(
        `/${TENANT}/quotations`,
        quotationData,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );

      console.log(`   Create response status: ${createRes.status}`);
      expect([200, 201]).toContain(createRes.status);

      if (createRes.status === 201) {
        quotationId = createRes.data.id;
        console.log(`   ✓ Quotation created: ${quotationId}`);

        // Verify quotation can be retrieved
        const getRes = await client.get(`/${TENANT}/quotations/${quotationId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        console.log(`   Retrieve response status: ${getRes.status}`);
        expect(getRes.status).toBe(200);
        expect(getRes.data.id).toBe(quotationId);
        expect(getRes.data.quotationNumber).toBe(quotationData.quotationNumber);
        console.log('   ✓ Quotation verified in database');

        // List all quotations
        const listRes = await client.get(`/${TENANT}/quotations`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        expect(listRes.status).toBe(200);
        const quotations = listRes.data.data || listRes.data;
        expect(Array.isArray(quotations)).toBe(true);
        expect(quotations.length).toBeGreaterThan(0);
        console.log(`   ✓ Total quotations in database: ${quotations.length}`);
      }
    });
  });

  describe('SUMMARY: Database Storage Verification', () => {
    it('should display summary of created records', async () => {
      console.log('\n' + '='.repeat(60));
      console.log('📊 DATABASE STORAGE VERIFICATION SUMMARY');
      console.log('='.repeat(60));
      console.log(`Invoice ID:    ${invoiceId || 'Not created'}`);
      console.log(`Payment ID:    ${paymentId || 'Not created'}`);
      console.log(`Quotation ID:  ${quotationId || 'Not created'}`);
      console.log('='.repeat(60));
      console.log('\n✅ All endpoints verified to store data in database\n');

      expect(invoiceId).toBeDefined();
      expect(paymentId).toBeDefined();
      expect(quotationId).toBeDefined();
    });
  });
});
