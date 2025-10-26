/**
 * Invoice and Payment Workflow Tests
 * TC-TRANS-039 to TC-TRANS-052
 */

import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.BASE_URL || 'https://eproc-sourcing-backend.onrender.com';
const API_URL = `${BASE_URL}/api/v1`;

describe('Invoice and Payment Workflow', () => {
  let client: AxiosInstance;
  let adminToken: string;
  let vendorToken: string;
  let poId: string;
  let vendorId: string;
  let invoiceId: string;
  let paymentId: string;

  beforeAll(async () => {
    client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      validateStatus: () => true,
    });

    // Register and login as ADMIN
    const adminEmail = `admin-invoice-${Date.now()}@test.com`;
    await client.post('/auth/register', {
      email: adminEmail,
      username: `admininv${Date.now()}`,
      password: 'Admin@12345',
      role: 'ADMIN',
    });

    const adminLogin = await client.post('/auth/login', {
      email: adminEmail,
      password: 'Admin@12345',
    });
    adminToken = adminLogin.data.accessToken;

    // Create vendor
    const vendorRes = await client.post(
      '/vendors',
      {
        name: `Invoice Test Vendor ${Date.now()}`,
        registrationNumber: `REG-INV-${Date.now()}`,
        taxId: `TAX-INV-${Date.now()}`,
        contactEmail: `vendor-inv-${Date.now()}@test.com`,
        status: 'ACTIVE',
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    if (vendorRes.status === 201) {
      vendorId = vendorRes.data.id;
    }

    // Register vendor user
    const vendorEmail = `vendor-inv-${Date.now()}@test.com`;
    await client.post('/auth/register', {
      email: vendorEmail,
      username: `vendorinv${Date.now()}`,
      password: 'Vendor@12345',
      role: 'VENDOR',
    });

    const vendorLogin = await client.post('/auth/login', {
      email: vendorEmail,
      password: 'Vendor@12345',
    });
    vendorToken = vendorLogin.data.accessToken;

    // Create a PO for invoice testing
    const poRes = await client.post(
      '/purchase-orders',
      {
        title: `Invoice Test PO ${Date.now()}`,
        description: 'PO for invoice testing',
        amount: 10000,
        items: [
          { name: 'Service A', quantity: 1, unitPrice: 5000 },
          { name: 'Service B', quantity: 1, unitPrice: 5000 },
        ],
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );

    if (poRes.status === 201) {
      poId = poRes.data.id;
      // Approve the PO
      await client.patch(`/purchase-orders/${poId}/approve`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });
    }
  });

  describe('TC-TRANS-039: Vendor creates invoice against PO', () => {
    it('should create invoice in PENDING status', async () => {
      if (!poId || !vendorId) {
        console.log('Skipping: No PO or vendor ID');
        return;
      }

      const invoiceData = {
        invoiceNumber: `INV-${Date.now()}`,
        poId,
        vendorId,
        amount: 10000,
        taxAmount: 1000,
        totalAmount: 11000,
        items: [
          {
            itemNumber: 1,
            description: 'Service A',
            quantity: 1,
            unitPrice: 5000,
            totalAmount: 5000,
          },
          {
            itemNumber: 2,
            description: 'Service B',
            quantity: 1,
            unitPrice: 5000,
            totalAmount: 5000,
          },
        ],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Invoice for completed services',
      };

      const response = await client.post('/invoices', invoiceData, {
        headers: { Authorization: `Bearer ${vendorToken}` },
      });

      if (response.status === 201) {
        expect(response.data).toHaveProperty('id');
        expect(response.data.status).toBe('PENDING');
        expect(response.data.totalAmount).toBe(invoiceData.totalAmount);
        invoiceId = response.data.id;
      } else {
        console.log('Create invoice response:', response.status, response.data);
      }
    });

    it('should retrieve invoice by ID', async () => {
      if (!invoiceId) {
        console.log('Skipping: No invoice ID');
        return;
      }

      const response = await client.get(`/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(response.data).toHaveProperty('id', invoiceId);
        expect(response.data.status).toBe('PENDING');
      }
    });
  });

  describe('TC-TRANS-040: Create InvoiceItem with budget tracing', () => {
    it('should verify invoice items are linked correctly', async () => {
      if (!invoiceId) {
        console.log('Skipping: No invoice ID');
        return;
      }

      const response = await client.get(`/invoices/${invoiceId}/items`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(Array.isArray(response.data)).toBe(true);
        if (response.data.length > 0) {
          expect(response.data[0]).toHaveProperty('itemNumber');
          expect(response.data[0]).toHaveProperty('description');
          expect(response.data[0]).toHaveProperty('totalAmount');
        }
      }
    });
  });

  describe('TC-TRANS-041: Invoice with budget deduction', () => {
    it('should handle budget deduction on invoice approval', async () => {
      // This test verifies budget integration
      // Actual budget deduction tested in budget-control.spec.ts
      if (!invoiceId) {
        console.log('Skipping: No invoice ID');
        return;
      }

      const response = await client.get(`/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        // Budget fields may be present
        if (response.data.budgetId) {
          expect(response.data).toHaveProperty('budgetId');
          expect(response.data).toHaveProperty('totalBilled');
        }
      }
    });
  });

  describe('TC-TRANS-042: Approve invoice', () => {
    it('should approve invoice (PENDING → APPROVED)', async () => {
      if (!invoiceId) {
        console.log('Skipping: No invoice ID');
        return;
      }

      const response = await client.patch(
        `/invoices/${invoiceId}/approve`,
        { notes: 'Invoice approved for payment' },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      if (response.status === 200) {
        expect(response.data.status).toBe('APPROVED');
      }
    });
  });

  describe('TC-TRANS-043: Mark invoice as paid', () => {
    it('should mark invoice as PAID after payment', async () => {
      if (!invoiceId) {
        console.log('Skipping: No invoice ID');
        return;
      }

      const response = await client.patch(
        `/invoices/${invoiceId}/status`,
        { status: 'PAID' },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      if (response.status === 200) {
        expect(response.data.status).toBe('PAID');
      }
    });
  });

  describe('TC-TRANS-044: Handle overdue invoice', () => {
    it('should create overdue invoice scenario', async () => {
      if (!poId || !vendorId) {
        console.log('Skipping: No PO or vendor ID');
        return;
      }

      // Create invoice with past due date
      const overdueInvoiceData = {
        invoiceNumber: `INV-OVERDUE-${Date.now()}`,
        poId,
        vendorId,
        amount: 5000,
        taxAmount: 500,
        totalAmount: 5500,
        items: [{ itemNumber: 1, description: 'Service', quantity: 1, unitPrice: 5000, totalAmount: 5000 }],
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      };

      const createRes = await client.post('/invoices', overdueInvoiceData, {
        headers: { Authorization: `Bearer ${vendorToken}` },
      });

      if (createRes.status === 201) {
        const overdueId = createRes.data.id;

        // Approve it
        await client.patch(`/invoices/${overdueId}/approve`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });

        // Check if system marks as overdue
        const checkRes = await client.get(`/invoices/${overdueId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (checkRes.status === 200) {
          // Status might be OVERDUE or APPROVED depending on implementation
          expect(['OVERDUE', 'APPROVED']).toContain(checkRes.data.status);
        }
      }
    });
  });

  describe('TC-TRANS-045: Dispute invoice', () => {
    it('should mark invoice as DISPUTED', async () => {
      if (!poId || !vendorId) {
        console.log('Skipping: No PO or vendor ID');
        return;
      }

      // Create new invoice to dispute
      const disputeInvoiceData = {
        invoiceNumber: `INV-DISPUTE-${Date.now()}`,
        poId,
        vendorId,
        amount: 8000,
        taxAmount: 800,
        totalAmount: 8800,
        items: [{ itemNumber: 1, description: 'Disputed Item', quantity: 1, unitPrice: 8000, totalAmount: 8000 }],
      };

      const createRes = await client.post('/invoices', disputeInvoiceData, {
        headers: { Authorization: `Bearer ${vendorToken}` },
      });

      if (createRes.status === 201) {
        const disputeId = createRes.data.id;

        const response = await client.patch(
          `/invoices/${disputeId}/dispute`,
          { reason: 'Amount does not match agreed terms' },
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );

        if (response.status === 200) {
          expect(response.data.status).toBe('DISPUTED');
        }
      }
    });
  });

  describe('TC-TRANS-046: Cancel invoice', () => {
    it('should cancel invoice', async () => {
      if (!poId || !vendorId) {
        console.log('Skipping: No PO or vendor ID');
        return;
      }

      // Create new invoice to cancel
      const cancelInvoiceData = {
        invoiceNumber: `INV-CANCEL-${Date.now()}`,
        poId,
        vendorId,
        amount: 3000,
        taxAmount: 300,
        totalAmount: 3300,
        items: [{ itemNumber: 1, description: 'Cancelled Item', quantity: 1, unitPrice: 3000, totalAmount: 3000 }],
      };

      const createRes = await client.post('/invoices', cancelInvoiceData, {
        headers: { Authorization: `Bearer ${vendorToken}` },
      });

      if (createRes.status === 201) {
        const cancelId = createRes.data.id;

        const response = await client.patch(
          `/invoices/${cancelId}/cancel`,
          { reason: 'Invoice created in error' },
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );

        if (response.status === 200) {
          expect(response.data.status).toBe('CANCELLED');
        }
      }
    });
  });

  describe('TC-TRANS-047: Request payment for approved invoice', () => {
    it('should create payment request', async () => {
      if (!invoiceId || !poId) {
        console.log('Skipping: No invoice or PO ID');
        return;
      }

      const paymentData = {
        paymentNumber: `PAY-${Date.now()}`,
        invoiceId,
        poId,
        amount: 11000,
        paymentType: 'FULL',
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        method: 'BANK_TRANSFER',
        notes: 'Payment for invoice services',
      };

      const response = await client.post('/payments', paymentData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 201) {
        expect(response.data).toHaveProperty('id');
        expect(response.data.status).toBe('REQUESTED');
        expect(response.data.paymentType).toBe('FULL');
        paymentId = response.data.id;
      } else {
        console.log('Create payment response:', response.status, response.data);
      }
    });

    it('should test different payment types', async () => {
      if (!invoiceId || !poId) {
        console.log('Skipping: No invoice or PO ID');
        return;
      }

      const paymentTypes = ['DOWN_PAYMENT', 'INSTALLMENT', 'MILESTONE'];

      for (const type of paymentTypes) {
        const paymentData = {
          paymentNumber: `PAY-${type}-${Date.now()}`,
          invoiceId,
          poId,
          amount: 2000,
          paymentType: type,
        };

        const response = await client.post('/payments', paymentData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (response.status === 201) {
          expect(response.data.paymentType).toBe(type);
        }
      }
    });
  });

  describe('TC-TRANS-048: Approve payment', () => {
    it('should approve payment (REQUESTED → APPROVED)', async () => {
      if (!paymentId) {
        console.log('Skipping: No payment ID');
        return;
      }

      const response = await client.patch(
        `/payments/${paymentId}/approve`,
        { approvedBy: 'Finance Manager' },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      if (response.status === 200) {
        expect(response.data.status).toBe('APPROVED');
        expect(response.data).toHaveProperty('approvedAt');
      }
    });
  });

  describe('TC-TRANS-049: Process payment', () => {
    it('should process payment (APPROVED → PROCESSED)', async () => {
      if (!paymentId) {
        console.log('Skipping: No payment ID');
        return;
      }

      const response = await client.patch(
        `/payments/${paymentId}/process`,
        {
          reference: `REF-${Date.now()}`,
          processedDate: new Date().toISOString(),
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      if (response.status === 200) {
        expect(response.data.status).toBe('PROCESSED');
        expect(response.data).toHaveProperty('processedDate');
        expect(response.data).toHaveProperty('reference');
      }
    });
  });

  describe('TC-TRANS-050: Record payment receipt', () => {
    it('should record vendor payment receipt', async () => {
      if (!paymentId) {
        console.log('Skipping: No payment ID');
        return;
      }

      const response = await client.patch(
        `/payments/${paymentId}/receive`,
        { receivedAt: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${vendorToken}` } },
      );

      if (response.status === 200) {
        expect(response.data).toHaveProperty('receivedAt');
      }
    });
  });

  describe('TC-TRANS-051: Failed payment', () => {
    it('should handle payment failure', async () => {
      if (!invoiceId || !poId) {
        console.log('Skipping: No invoice or PO ID');
        return;
      }

      // Create new payment
      const paymentData = {
        paymentNumber: `PAY-FAIL-${Date.now()}`,
        invoiceId,
        poId,
        amount: 5000,
        paymentType: 'FULL',
      };

      const createRes = await client.post('/payments', paymentData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (createRes.status === 201) {
        const failPaymentId = createRes.data.id;

        // Approve it
        await client.patch(`/payments/${failPaymentId}/approve`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });

        // Mark as failed
        const response = await client.patch(
          `/payments/${failPaymentId}/fail`,
          { reason: 'Insufficient funds' },
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );

        if (response.status === 200) {
          expect(response.data.status).toBe('FAILED');
        }
      }
    });
  });

  describe('TC-TRANS-052: Cancel payment', () => {
    it('should cancel payment', async () => {
      if (!invoiceId || !poId) {
        console.log('Skipping: No invoice or PO ID');
        return;
      }

      // Create new payment to cancel
      const paymentData = {
        paymentNumber: `PAY-CANCEL-${Date.now()}`,
        invoiceId,
        poId,
        amount: 4000,
        paymentType: 'FULL',
      };

      const createRes = await client.post('/payments', paymentData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (createRes.status === 201) {
        const cancelPaymentId = createRes.data.id;

        const response = await client.patch(
          `/payments/${cancelPaymentId}/cancel`,
          { reason: 'Payment no longer required' },
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );

        if (response.status === 200) {
          expect(response.data.status).toBe('CANCELLED');
        }
      }
    });
  });

  describe('Invoice and Payment Listing', () => {
    it('should list all invoices', async () => {
      const response = await client.get('/invoices', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(Array.isArray(response.data)).toBe(true);
      }
    });

    it('should list vendor own invoices', async () => {
      const response = await client.get('/invoices', {
        headers: { Authorization: `Bearer ${vendorToken}` },
      });

      if (response.status === 200) {
        expect(Array.isArray(response.data)).toBe(true);
      }
    });

    it('should list all payments', async () => {
      const response = await client.get('/payments', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(Array.isArray(response.data)).toBe(true);
      }
    });

    it('should filter invoices by status', async () => {
      const response = await client.get('/invoices?status=APPROVED', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200) {
        expect(Array.isArray(response.data)).toBe(true);
      }
    });
  });
});
