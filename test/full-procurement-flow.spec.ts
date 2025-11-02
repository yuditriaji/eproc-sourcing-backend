/**
 * FULL PROCUREMENT FLOW E2E TEST
 * Tests the complete procurement workflow:
 * Tender → Quotation → Bid → Contract → PR → PO → Goods Receipt → Invoice → Payment
 */

import axios from 'axios';

const BASE_URL = 'https://eproc-sourcing-backend.onrender.com';
const API_URL = `${BASE_URL}/api/v1`;
const TIMESTAMP = Date.now();
const TENANT = `fullflow-${TIMESTAMP}`;

// Admin credentials
const ADMIN_EMAIL = `admin-${TIMESTAMP}@fullflow.com`;
const ADMIN_PASSWORD = 'FullFlow123!@#';

// User credentials  
const USER_EMAIL = `user-${TIMESTAMP}@fullflow.com`;
const USER_PASSWORD = 'UserFlow123!@#';

// Vendor credentials
const VENDOR_EMAIL = `vendor-${TIMESTAMP}@fullflow.com`;
const VENDOR_PASSWORD = 'VendorFlow123!@#';

describe('FULL PROCUREMENT FLOW E2E', () => {
  let adminToken: string;
  let userToken: string;
  let vendorToken: string;
  
  let vendorId: string;
  let tenderId: string;
  let quotationId: string;
  let bidId: string;
  let contractId: string;
  let prId: string;
  let poId: string;
  let goodsReceiptId: string;
  let invoiceId: string;
  let paymentId: string;

  it('STEP 1: Provision tenant and create accounts', async () => {
    console.log('\n========================================');
    console.log('FULL PROCUREMENT FLOW - END TO END TEST');
    console.log('========================================\n');
    
    // Provision tenant
    console.log('1. Provisioning tenant...');
    const provisionRes = await axios.post(`${API_URL}/tenants`, {
      name: `Full Flow Test ${TIMESTAMP}`,
      subdomain: TENANT,
      config: { region: 'test' },
      admin: {
        email: ADMIN_EMAIL,
        username: `admin${TIMESTAMP}`,
        password: ADMIN_PASSWORD,
        firstName: 'Admin',
        lastName: 'User'
      }
    }, { validateStatus: () => true });

    expect([200, 201]).toContain(provisionRes.status);
    console.log('   ✓ Tenant provisioned');

    // Login as admin
    console.log('\n2. Logging in as ADMIN...');
    const adminLoginRes = await axios.post(`${API_URL}/${TENANT}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }, { validateStatus: () => true });

    expect([200, 201]).toContain(adminLoginRes.status);
    adminToken = adminLoginRes.data.accessToken;
    console.log(`   ✓ Admin token obtained`);
    
    if (!adminToken) {
      throw new Error('Failed to obtain admin token');
    }

    // Create USER account
    console.log('\n3. Creating USER account...');
    const userRes = await axios.post(
      `${API_URL}/${TENANT}/auth/register`,
      {
        email: USER_EMAIL,
        username: `user${TIMESTAMP}`,
        password: USER_PASSWORD,
        firstName: 'Test',
        lastName: 'User',
        role: 'USER'
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   User account creation status: ${userRes.status}`);
    expect([200, 201]).toContain(userRes.status);
    console.log('   ✓ USER account created');

    // Login as USER
    console.log('\n4. Logging in as USER...');
    const userLoginRes = await axios.post(`${API_URL}/${TENANT}/auth/login`, {
      email: USER_EMAIL,
      password: USER_PASSWORD,
    }, { validateStatus: () => true });

    expect([200, 201]).toContain(userLoginRes.status);
    userToken = userLoginRes.data.accessToken;
    console.log('   ✓ User token obtained');
    
    if (!userToken) {
      throw new Error('Failed to obtain user token');
    }

    // Create Vendor (as USER)
    console.log('\n5. Creating VENDOR record...');
    const vendorRes = await axios.post(
      `${API_URL}/${TENANT}/vendors`,
      {
        name: `Vendor Corp ${TIMESTAMP}`,
        registrationNumber: `REG-${TIMESTAMP}`,
        taxId: `TAX-${TIMESTAMP}`,
        contactEmail: VENDOR_EMAIL,
        contactPhone: '+628123456789',
        address: {
          street: '123 Vendor Street',
          city: 'Jakarta',
          country: 'Indonesia',
          postalCode: '12345'
        }
      },
      {
        headers: { Authorization: `Bearer ${userToken}` },
        validateStatus: () => true,
      },
    );

    expect(vendorRes.status).toBe(201);
    vendorId = vendorRes.data.id;
    console.log(`   ✓ Vendor created: ${vendorId}`);

    // Create VENDOR role account
    console.log('\n6. Creating VENDOR role account...');
    const vendorAccountRes = await axios.post(
      `${API_URL}/${TENANT}/auth/register`,
      {
        email: VENDOR_EMAIL,
        username: `vendor${TIMESTAMP}`,
        password: VENDOR_PASSWORD,
        firstName: 'Vendor',
        lastName: 'User',
        role: 'VENDOR'
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   Vendor account creation status: ${vendorAccountRes.status}`);
    console.log(`   Vendor account response:`, JSON.stringify(vendorAccountRes.data, null, 2));

    let vendorUserId: string;
    
    // VENDOR accounts return 403 with user info when created but unverified
    if (vendorAccountRes.status === 403) {
      console.log('   Vendor account requires verification (as expected for VENDOR role)');
      vendorUserId = vendorAccountRes.data?.userId;
      console.log(`   Extracted vendor user ID from 403 response: ${vendorUserId}`);
    } else if (vendorAccountRes.status === 200 || vendorAccountRes.status === 201) {
      vendorUserId = vendorAccountRes.data?.id || vendorAccountRes.data?.user?.id;
      console.log(`   Vendor account created and verified: ${vendorUserId}`);
    } else {
      console.log('   Vendor account creation failed:', JSON.stringify(vendorAccountRes.data, null, 2));
      throw new Error(`Vendor account creation failed: ${JSON.stringify(vendorAccountRes.data)}`);
    }
    
    console.log('   ✓ VENDOR role account created (pending verification)');

    // Verify the VENDOR account using ADMIN token
    console.log('\n7. Verifying VENDOR account...');
    
    if (vendorUserId) {
      console.log(`   Found vendor user ID: ${vendorUserId}`);
      const verifyRes = await axios.patch(
        `${API_URL}/${TENANT}/auth/users/${vendorUserId}/verify`,
        {},
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          validateStatus: () => true,
        },
      );
      
      console.log(`   Verification status: ${verifyRes.status}`);
      if (verifyRes.status !== 200) {
        console.log('   Verification response:', JSON.stringify(verifyRes.data, null, 2));
      } else {
        console.log('   ✓ VENDOR account verified');
      }
    } else {
      console.log('   ⚠ Could not find vendor user ID, verification may be needed manually');
    }

    // Login as VENDOR
    console.log('\n8. Logging in as VENDOR...');
    const vendorLoginRes = await axios.post(`${API_URL}/${TENANT}/auth/login`, {
      email: VENDOR_EMAIL,
      password: VENDOR_PASSWORD,
    }, { validateStatus: () => true });

    console.log(`   Vendor login status: ${vendorLoginRes.status}`);
    if (vendorLoginRes.status !== 200 && vendorLoginRes.status !== 201) {
      console.log('   Vendor login response:', JSON.stringify(vendorLoginRes.data, null, 2));
      throw new Error(`Vendor login failed: ${JSON.stringify(vendorLoginRes.data)}`);
    }
    
    vendorToken = vendorLoginRes.data.accessToken;
    console.log('   ✓ Vendor token obtained');
    
    if (!vendorToken) {
      throw new Error('Failed to obtain vendor token');
    }
  }, 90000);

  it('STEP 2: Create Tender', async () => {
    console.log('\n9. Creating TENDER...');
    
    const tenderRes = await axios.post(
      `${API_URL}/${TENANT}/tenders`,
      {
        title: `Test Tender ${TIMESTAMP}`,
        description: 'Full flow test tender',
        requirements: { items: ['Item 1', 'Item 2'] },
        criteria: { quality: 40, price: 30, delivery: 30 },
        estimatedValue: 50000,
        closingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        category: 'GOODS',
        department: 'PROCUREMENT',
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   Tender creation status: ${tenderRes.status}`);
    if (tenderRes.status !== 201) {
      console.log('   Response:', JSON.stringify(tenderRes.data, null, 2));
      throw new Error(`Tender creation failed: ${JSON.stringify(tenderRes.data)}`);
    }

    tenderId = tenderRes.data.id;
    console.log(`   ✓ Tender created: ${tenderId}`);

    // Publish tender using workflow endpoint
    console.log('\n10. Publishing TENDER...');
    const publishRes = await axios.post(
      `${API_URL}/${TENANT}/workflows/tender/publish/${tenderId}`,
      {},
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   Publish status: ${publishRes.status}`);
    // Workflow responses have success field
    if (publishRes.status !== 200 || !publishRes.data.success) {
      console.log('   Response:', JSON.stringify(publishRes.data, null, 2));
      throw new Error(`Tender publish failed: ${JSON.stringify(publishRes.data)}`);
    }
    console.log('   ✓ Tender published');
  }, 30000);

  it('STEP 3: Vendor submits Quotation', async () => {
    console.log('\n11. Creating QUOTATION (as admin)...');
    
    const quotationRes = await axios.post(
      `${API_URL}/${TENANT}/quotations`,
      {
        tenderId,
        vendorId,
        amount: 45000,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          { name: 'Item 1', quantity: 10, unitPrice: 2000, total: 20000 },
          { name: 'Item 2', quantity: 5, unitPrice: 5000, total: 25000 }
        ],
        notes: 'Best competitive price',
        terms: { paymentTerms: 'Net 30', deliveryTime: '7 days' }
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` }, // Admin can create on behalf
        validateStatus: () => true,
      },
    );

    console.log(`   Quotation creation status: ${quotationRes.status}`);
    if (quotationRes.status !== 201) {
      console.log('   Response:', JSON.stringify(quotationRes.data, null, 2));
      throw new Error(`Quotation creation failed: ${JSON.stringify(quotationRes.data)}`);
    }

    quotationId = quotationRes.data.id;
    console.log(`   ✓ Quotation created: ${quotationId}`);
  }, 30000);

  it('STEP 4: Submit Bid', async () => {
    console.log('\n12. Submitting BID (as VENDOR)...');
    
    const bidRes = await axios.post(
      `${API_URL}/${TENANT}/workflows/tender/submit-bid/${tenderId}`,
      {
        bidAmount: 45000,
        technicalProposal: { approach: 'Best practices', timeline: '2 weeks' },
        financialProposal: { breakdown: { labor: 20000, materials: 25000 } },
        compliance: { certifications: ['ISO9001'] }
      },
      {
        headers: { Authorization: `Bearer ${vendorToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   Bid creation status: ${bidRes.status}`);
    if (bidRes.status !== 201) {
      console.log('   Response:', JSON.stringify(bidRes.data, null, 2));
      throw new Error(`Bid creation failed: ${JSON.stringify(bidRes.data)}`);
    }

    bidId = bidRes.data.data?.id || bidRes.data.id;
    console.log(`   ✓ Bid created: ${bidId}`);
  }, 30000);

  it('STEP 5: Create Contract', async () => {
    console.log('\n13. Creating CONTRACT...');
    
    const contractRes = await axios.post(
      `${API_URL}/${TENANT}/contracts`,
      {
        title: `Contract ${TIMESTAMP}`,
        contractNumber: `CNT-${TIMESTAMP}`,
        vendorId,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        value: 45000,
        terms: { payment: 'Net 30', warranty: '1 year' },
        status: 'DRAFT'
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   Contract creation status: ${contractRes.status}`);
    if (contractRes.status !== 201) {
      console.log('   Response:', JSON.stringify(contractRes.data, null, 2));
      throw new Error(`Contract creation failed: ${JSON.stringify(contractRes.data)}`);
    }

    contractId = contractRes.data.id;
    console.log(`   ✓ Contract created: ${contractId}`);

    // Approve contract
    console.log('\n14. Approving CONTRACT...');
    const approveRes = await axios.patch(
      `${API_URL}/${TENANT}/contracts/${contractId}/status`,
      { status: 'IN_PROGRESS' },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    expect([200, 201]).toContain(approveRes.status);
    console.log('   ✓ Contract approved');
  }, 30000);

  it('STEP 6: Create Purchase Requisition (PR)', async () => {
    console.log('\n15. Creating PURCHASE REQUISITION using workflow...');
    
    const prRes = await axios.post(
      `${API_URL}/${TENANT}/workflows/procurement/create-pr/${contractId}`,
      {
        title: `PR ${TIMESTAMP}`,
        description: 'Purchase requisition for contract items',
        items: [
          { name: 'Item 1', quantity: 10, estimatedPrice: 2000 },
          { name: 'Item 2', quantity: 5, estimatedPrice: 5000 }
        ],
        estimatedAmount: 45000,
        requiredBy: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        justification: 'Required for project delivery'
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   PR creation status: ${prRes.status}`);
    console.log(`   PR response:`, JSON.stringify(prRes.data, null, 2));
    if (prRes.status !== 201 && !prRes.data.success) {
      throw new Error(`PR creation failed: ${JSON.stringify(prRes.data)}`);
    }

    prId = prRes.data.data?.id || prRes.data.id;
    console.log(`   ✓ PR created: ${prId}`);
    
    if (!prId) {
      throw new Error(`Failed to extract PR ID from response`);
    }

    // Approve PR using workflow
    console.log('\n16. Approving PR using workflow...');
    const approvePRRes = await axios.post(
      `${API_URL}/${TENANT}/workflows/procurement/approve-pr/${prId}`,
      { approved: true },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   Approve PR status: ${approvePRRes.status}`);
    if (approvePRRes.status !== 200) {
      console.log('   Response:', JSON.stringify(approvePRRes.data, null, 2));
      throw new Error(`PR approval failed: ${JSON.stringify(approvePRRes.data)}`);
    }
    console.log('   ✓ PR approved');
  }, 30000);

  it('STEP 7: Create Purchase Order (PO)', async () => {
    console.log('\n17. Creating PURCHASE ORDER using workflow...');
    
    const poRes = await axios.post(
      `${API_URL}/${TENANT}/workflows/procurement/create-po/${prId}`,
      {
        vendorIds: [vendorId]
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   PO creation status: ${poRes.status}`);
    console.log(`   PO response:`, JSON.stringify(poRes.data, null, 2));
    if (poRes.status !== 201 && !poRes.data.success) {
      throw new Error(`PO creation failed: ${JSON.stringify(poRes.data)}`);
    }

    poId = poRes.data.data?.id || poRes.data.id;
    console.log(`   ✓ PO created: ${poId}`);
    
    if (!poId) {
      throw new Error(`Failed to extract PO ID from response`);
    }

    // Approve PO using workflow
    console.log('\n18. Approving PO using workflow...');
    const approvePORes = await axios.post(
      `${API_URL}/${TENANT}/workflows/procurement/approve-po/${poId}`,
      { approved: true },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   Approve PO status: ${approvePORes.status}`);
    if (approvePORes.status !== 200) {
      console.log('   Response:', JSON.stringify(approvePORes.data, null, 2));
      throw new Error(`PO approval failed: ${JSON.stringify(approvePORes.data)}`);
    }
    console.log('   ✓ PO approved');
  }, 30000);

  it('STEP 8: Create Goods Receipt', async () => {
    console.log('\n19. Creating GOODS RECEIPT using workflow...');
    
    const grRes = await axios.post(
      `${API_URL}/${TENANT}/workflows/procurement/goods-receipt/${poId}`,
      {
        poId,
        receivedDate: new Date().toISOString(),
        receivedItems: [
          { name: 'Item 1', quantity: 10, condition: 'Good' },
          { name: 'Item 2', quantity: 5, condition: 'Good' }
        ],
        notes: 'All items received in good condition',
        inspectionNotes: 'Quality inspection passed',
        inspectedBy: 'QC Team'
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   GR creation status: ${grRes.status}`);
    if (grRes.status !== 201) {
      console.log('   Response:', JSON.stringify(grRes.data, null, 2));
      throw new Error(`Goods Receipt creation failed: ${JSON.stringify(grRes.data)}`);
    }

    goodsReceiptId = grRes.data.data?.id || grRes.data.id;
    console.log(`   ✓ Goods Receipt created: ${goodsReceiptId}`);
  }, 30000);

  it('STEP 9: Create Invoice', async () => {
    console.log('\n20. Creating INVOICE...');
    
    const invoiceRes = await axios.post(
      `${API_URL}/${TENANT}/invoices`,
      {
        invoiceNumber: `INV-${TIMESTAMP}`,
        poId,
        vendorId,
        amount: 45000,
        taxAmount: 4500,
        totalAmount: 49500,
        items: [
          {
            itemNumber: 1,
            description: 'Item 1',
            quantity: 10,
            unitPrice: 2000,
            totalAmount: 20000,
          },
          {
            itemNumber: 2,
            description: 'Item 2',
            quantity: 5,
            unitPrice: 5000,
            totalAmount: 25000,
          },
        ],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Full payment required',
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   Invoice creation status: ${invoiceRes.status}`);
    if (invoiceRes.status !== 201) {
      console.log('   Response:', JSON.stringify(invoiceRes.data, null, 2));
      throw new Error(`Invoice creation failed: ${JSON.stringify(invoiceRes.data)}`);
    }

    invoiceId = invoiceRes.data.id;
    console.log(`   ✓ Invoice created: ${invoiceId}`);

    // Approve invoice
    console.log('\n21. Approving INVOICE...');
    const approveInvRes = await axios.patch(
      `${API_URL}/${TENANT}/invoices/${invoiceId}/approve`,
      { notes: 'Approved for payment' },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    expect([200, 201]).toContain(approveInvRes.status);
    console.log('   ✓ Invoice approved');
  }, 30000);

  it('STEP 10: Create Payment', async () => {
    console.log('\n22. Creating PAYMENT...');
    
    const paymentRes = await axios.post(
      `${API_URL}/${TENANT}/payments`,
      {
        invoiceId,
        amount: 49500,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'BANK_TRANSFER',
        reference: `PAY-${TIMESTAMP}`,
        notes: 'Full payment for invoice'
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   Payment creation status: ${paymentRes.status}`);
    if (paymentRes.status !== 201) {
      console.log('   Response:', JSON.stringify(paymentRes.data, null, 2));
      throw new Error(`Payment creation failed: ${JSON.stringify(paymentRes.data)}`);
    }

    paymentId = paymentRes.data.id;
    console.log(`   ✓ Payment created: ${paymentId}`);

    console.log('\n========================================');
    console.log('✅ FULL PROCUREMENT FLOW COMPLETED!');
    console.log('========================================');
    console.log(`Tender ID: ${tenderId}`);
    console.log(`Quotation ID: ${quotationId}`);
    console.log(`Bid ID: ${bidId}`);
    console.log(`Contract ID: ${contractId}`);
    console.log(`PR ID: ${prId}`);
    console.log(`PO ID: ${poId}`);
    console.log(`Goods Receipt ID: ${goodsReceiptId}`);
    console.log(`Invoice ID: ${invoiceId}`);
    console.log(`Payment ID: ${paymentId}`);
    console.log('========================================\n');

    expect(paymentId).toBeTruthy();
  }, 30000);
});
