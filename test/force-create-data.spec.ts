/**
 * FORCE DATA CREATION TEST
 * This test will NOT skip - it will fail loudly if anything doesn't work
 */

import axios from 'axios';

const BASE_URL = 'https://eproc-sourcing-backend.onrender.com';
const API_URL = `${BASE_URL}/api/v1`;
const TIMESTAMP = Date.now();
const TENANT = `force-test-${TIMESTAMP}`;  // New unique tenant

// Known admin credentials for NEW tenant
const ADMIN_EMAIL = `admin-${TIMESTAMP}@forcetest.com`;
const ADMIN_PASSWORD = 'ForceTest123!@#';

describe('FORCE CREATE DATA - NO SKIPPING', () => {
  let adminToken: string;
  let userToken: string;
  let vendorId: string;
  let poId: string;

  it('STEP 1: Provision NEW tenant and login', async () => {
    console.log('\n========================================');
    console.log('FORCING DATA CREATION - NO SKIPS ALLOWED');
    console.log('========================================\n');
    
    console.log('1. Provisioning NEW tenant...');
    console.log(`   Tenant: ${TENANT}`);
    console.log(`   Admin Email: ${ADMIN_EMAIL}`);
    
    const provisionRes = await axios.post(`${API_URL}/tenants`, {
      name: `Force Test ${TIMESTAMP}`,
      subdomain: TENANT,
      config: { region: 'test' },
      admin: {
        email: ADMIN_EMAIL,
        username: `forceadmin${TIMESTAMP}`,
        password: ADMIN_PASSWORD,
        firstName: 'Force',
        lastName: 'Admin'
      }
    }, { validateStatus: () => true });

    console.log(`   Provision status: ${provisionRes.status}`);
    if (provisionRes.status === 201 || provisionRes.status === 200) {
      console.log(`   ✓ Tenant provisioned successfully`);
    } else {
      console.log(`   ⚠ Provision response:`, JSON.stringify(provisionRes.data, null, 2));
    }
    
    console.log('\n2. Logging in as admin...');
    const loginRes = await axios.post(`${API_URL}/${TENANT}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }, { validateStatus: () => true });

    console.log(`   Login status: ${loginRes.status}`);

    if (loginRes.status !== 200 && loginRes.status !== 201) {
      console.log('   Login response:', JSON.stringify(loginRes.data, null, 2));
      throw new Error(`Admin login failed with status ${loginRes.status}`);
    }

    adminToken = loginRes.data.accessToken;
    console.log(`   ✓ Admin token obtained: ${adminToken.substring(0, 30)}...`);

    expect(adminToken).toBeTruthy();
  }, 90000);

  it('STEP 2: Create USER and login', async () => {
    console.log('\n3. Creating USER account...');
    
    const userPayload = {
      email: `user-${TIMESTAMP}@forcetest.com`,
      username: `forceuser${TIMESTAMP}`,
      password: 'ForceUser123!@#',
      firstName: 'Force',
      lastName: 'User',
      role: 'USER'
    };

    const createUserRes = await axios.post(
      `${API_URL}/${TENANT}/auth/register`,
      userPayload,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   User creation status: ${createUserRes.status}`);
    console.log(`   User data:`, JSON.stringify(createUserRes.data, null, 2));

    if (createUserRes.status !== 201 && createUserRes.status !== 200) {
      throw new Error(`User creation failed with status ${createUserRes.status}: ${JSON.stringify(createUserRes.data)}`);
    }

    console.log(`   ✓ USER account created`);

    console.log('\n4. Logging in as USER...');
    const userLoginRes = await axios.post(`${API_URL}/${TENANT}/auth/login`, {
      email: userPayload.email,
      password: userPayload.password,
    }, { validateStatus: () => true });

    console.log(`   User login status: ${userLoginRes.status}`);

    if (userLoginRes.status !== 200 && userLoginRes.status !== 201) {
      console.log('   User login response:', JSON.stringify(userLoginRes.data, null, 2));
      throw new Error(`User login failed with status ${userLoginRes.status}`);
    }

    userToken = userLoginRes.data.accessToken;
    console.log(`   ✓ User token obtained: ${userToken.substring(0, 30)}...`);

    expect(userToken).toBeTruthy();
  }, 30000);

  it('STEP 3: Create vendor as USER', async () => {
    console.log('\n5. Creating vendor as USER...');
    
    const vendorData = {
      name: `Force Vendor ${Date.now()}`,
      registrationNumber: `REG-FORCE-${Date.now()}`,
      taxId: `TAX-FORCE-${Date.now()}`,
      contactEmail: `vendor-force-${Date.now()}@test.com`,
      contactPhone: '+628123456789',
      address: {
        street: '123 Force Street',
        city: 'Jakarta',
        country: 'Indonesia',
        postalCode: '12345'
      }
    };

    const vendorRes = await axios.post(
      `${API_URL}/${TENANT}/vendors`,
      vendorData,
      {
        headers: { Authorization: `Bearer ${userToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   Vendor creation status: ${vendorRes.status}`);
    console.log(`   Vendor data:`, JSON.stringify(vendorRes.data, null, 2));

    if (vendorRes.status !== 201) {
      throw new Error(`Vendor creation failed with status ${vendorRes.status}: ${JSON.stringify(vendorRes.data)}`);
    }

    vendorId = vendorRes.data.id;
    console.log(`   ✓ Vendor ID: ${vendorId}`);

    expect(vendorId).toBeTruthy();
  }, 30000);

  it('STEP 4: Create PO as admin', async () => {
    console.log('\n6. Creating purchase order as admin...');
    
    const poData = {
      title: `Force PO ${Date.now()}`,
      description: 'Forced PO creation',
      amount: 10000,
      items: [
        { name: 'Item A', quantity: 1, unitPrice: 5000 },
        { name: 'Item B', quantity: 1, unitPrice: 5000 },
      ],
    };

    const poRes = await axios.post(
      `${API_URL}/${TENANT}/purchase-orders`,
      poData,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   PO creation status: ${poRes.status}`);
    console.log(`   PO data:`, JSON.stringify(poRes.data, null, 2));

    if (poRes.status !== 201) {
      throw new Error(`PO creation failed with status ${poRes.status}: ${JSON.stringify(poRes.data)}`);
    }

    poId = poRes.data.id;
    console.log(`   ✓ PO ID: ${poId}`);

    console.log('\n7. Approving PO...');
    const approveRes = await axios.post(
      `${API_URL}/${TENANT}/purchase-orders/${poId}/approve`,
      { approved: true },  // ApprovePODto might require this
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   PO approve status: ${approveRes.status}`);
    console.log(`   PO approve response:`, JSON.stringify(approveRes.data, null, 2));
    
    if (approveRes.status !== 200 && approveRes.status !== 201) {
      throw new Error(`PO approval failed with status ${approveRes.status}: ${JSON.stringify(approveRes.data)}`);
    }
    
    // Verify PO status is actually APPROVED
    const poCheckRes = await axios.get(
      `${API_URL}/${TENANT}/purchase-orders/${poId}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );
    console.log(`   PO status after approval: ${poCheckRes.data?.status}`);
    
    if (poCheckRes.data?.status !== 'APPROVED' && poCheckRes.data?.status !== 'COMPLETED') {
      throw new Error(`PO status is ${poCheckRes.data?.status}, not APPROVED or COMPLETED`);
    }

    expect(poId).toBeTruthy();
  }, 30000);

  it('STEP 5: CREATE INVOICE - THIS MUST WORK', async () => {
    console.log('\n8. Creating invoice as admin...');
    
    const invoiceData = {
      invoiceNumber: `FORCE-INV-${Date.now()}`,
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
      notes: 'FORCED INVOICE CREATION',
    };

    const invoiceRes = await axios.post(
      `${API_URL}/${TENANT}/invoices`,
      invoiceData,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   Invoice creation status: ${invoiceRes.status}`);
    console.log(`   Invoice data:`, JSON.stringify(invoiceRes.data, null, 2));

    if (invoiceRes.status !== 201) {
      console.log('\n❌ INVOICE CREATION FAILED!');
      console.log('Status:', invoiceRes.status);
      console.log('Response:', JSON.stringify(invoiceRes.data, null, 2));
      console.log('\nRequest Payload was:');
      console.log(JSON.stringify(invoiceData, null, 2));
      throw new Error(`Invoice creation failed with status ${invoiceRes.status}: ${JSON.stringify(invoiceRes.data)}`);
    }

    const invoiceId = invoiceRes.data.id;
    console.log(`   ✓ Invoice ID: ${invoiceId}`);
    console.log(`   ✓ Invoice Number: ${invoiceRes.data.invoiceNumber}`);

    // Now verify it's in the database
    console.log('\n9. Verifying invoice exists in database...');
    const getRes = await axios.get(
      `${API_URL}/${TENANT}/invoices/${invoiceId}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      },
    );

    console.log(`   Get invoice status: ${getRes.status}`);
    console.log(`   Retrieved data:`, JSON.stringify(getRes.data, null, 2));

    if (getRes.status !== 200) {
      throw new Error(`Invoice retrieval failed with status ${getRes.status}`);
    }

    console.log('\n✅ SUCCESS! Invoice was created and retrieved!');
    console.log(`✅ Database MUST contain this invoice: ${invoiceId}`);
    console.log('\n========================================');
    console.log('NOW RUN YOUR SQL QUERY AGAIN:');
    console.log(`SELECT * FROM invoices WHERE id = '${invoiceId}';`);
    console.log('========================================\n');

    expect(invoiceId).toBeTruthy();
    expect(getRes.data.id).toBe(invoiceId);
  }, 30000);
});
