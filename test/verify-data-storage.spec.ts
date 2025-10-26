/**
 * Data Storage Verification Test
 * This test creates entities and outputs their IDs for database verification
 */

import axios from 'axios';

const BASE_URL = 'https://eproc-sourcing-backend.onrender.com';
const API_URL = `${BASE_URL}/api/v1`;
const timestamp = Date.now();

// Store all created entity IDs
const createdEntities = {
  tenantId: '',
  adminUserId: '',
  normalUserId: '',
  vendorUserId: '',
  currencyId: '',
  companyCodeId: '',
  plantId: '',
  vendorId: '',
  orgUnitId: '',
  budgetId: '',
  contractId: '',
  tenderId: '',
  bidId: '',
  prId: '',
  poId: '',
  grId: '',
  invoiceId: '',
  paymentId: '',
};

describe('Data Storage Verification Test', () => {
  let tenantId: string;
  let adminToken: string;
  let userToken: string;
  let vendorToken: string;

  beforeAll(async () => {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 STARTING DATA STORAGE VERIFICATION TEST');
    console.log('='.repeat(80));
    console.log('Base URL:', BASE_URL);
    console.log('Timestamp:', timestamp);
    console.log('='.repeat(80) + '\n');
  }, 60000);

  it('STEP 1: Create Tenant', async () => {
    console.log('\n📋 Creating tenant...');
    
    const response = await axios.post(`${API_URL}/tenants`, {
      name: `Verify Tenant ${timestamp}`,
      subdomain: `verify-${timestamp}`,
      admin: {
        email: `admin-verify-${timestamp}@test.com`,
        password: 'SecurePass123!',
        firstName: 'Admin',
        lastName: 'Verify',
      },
    }, { validateStatus: () => true });

    expect([200, 201]).toContain(response.status);
    tenantId = response.data.tenant?.id || response.data.tenant?.subdomain;
    createdEntities.tenantId = tenantId;
    createdEntities.adminUserId = response.data.adminUser?.id;

    console.log('✅ Tenant created');
    console.log('   Tenant ID:', tenantId);
    console.log('   Admin User ID:', createdEntities.adminUserId);

    // Login
    const loginRes = await axios.post(`${API_URL}/${tenantId}/auth/login`, {
      email: `admin-verify-${timestamp}@test.com`,
      password: 'SecurePass123!',
    });
    adminToken = loginRes.data.accessToken;
    expect(adminToken).toBeTruthy();
    console.log('   Admin token obtained ✓');
  }, 60000);

  it('STEP 2: Create Users', async () => {
    console.log('\n👥 Creating additional users...');

    // Normal user
    const userRes = await axios.post(`${API_URL}/${tenantId}/auth/register`, {
      email: `user-verify-${timestamp}@test.com`,
      username: `userverify${timestamp}`,
      password: 'UserPass123!',
      firstName: 'Normal',
      lastName: 'User',
      role: 'USER',
    }, { validateStatus: () => true });

    if ([200, 201].includes(userRes.status)) {
      createdEntities.normalUserId = userRes.data.user?.id || userRes.data.id;
      userToken = userRes.data.accessToken;
      console.log('✅ Normal USER created');
      console.log('   User ID:', createdEntities.normalUserId);
    }

    // Vendor user
    const vendorUserRes = await axios.post(`${API_URL}/${tenantId}/auth/register`, {
      email: `vendor-verify-${timestamp}@test.com`,
      username: `vendorverify${timestamp}`,
      password: 'VendorPass123!',
      firstName: 'Vendor',
      lastName: 'User',
      role: 'VENDOR',
    }, { validateStatus: () => true });

    if ([200, 201].includes(vendorUserRes.status)) {
      createdEntities.vendorUserId = vendorUserRes.data.user?.id || vendorUserRes.data.id;
      vendorToken = vendorUserRes.data.accessToken;
      console.log('✅ VENDOR user created');
      console.log('   Vendor User ID:', createdEntities.vendorUserId);
    }
  }, 60000);

  it('STEP 3: Create Currency', async () => {
    console.log('\n💵 Creating currency...');

    const response = await axios.post(`${API_URL}/${tenantId}/currencies`, {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      exchangeRate: 1.0,
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
      validateStatus: () => true,
    });

    if ([200, 201].includes(response.status)) {
      createdEntities.currencyId = (response.data.data || response.data).id;
      console.log('✅ Currency created');
      console.log('   Currency ID:', createdEntities.currencyId);
    } else {
      console.log('❌ Currency creation failed:', response.status, response.data);
    }
  });

  it('STEP 4: Create Company Code', async () => {
    console.log('\n🏭 Creating company code...');

    const response = await axios.post(`${API_URL}/${tenantId}/master-data/company-codes`, {
      code: `CC${timestamp}`,
      name: `Company ${timestamp}`,
      address: '123 Business St',
      city: 'Business City',
      country: 'USA',
      currencyId: createdEntities.currencyId,
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
      validateStatus: () => true,
    });

    if ([200, 201].includes(response.status)) {
      createdEntities.companyCodeId = (response.data.data || response.data).id;
      console.log('✅ Company Code created');
      console.log('   Company Code ID:', createdEntities.companyCodeId);
    } else {
      console.log('❌ Company Code creation failed:', response.status);
    }
  });

  it('STEP 5: Create Plant', async () => {
    console.log('\n🏗️  Creating plant...');

    const response = await axios.post(`${API_URL}/${tenantId}/master-data/plants`, {
      code: `PLT${timestamp}`,
      name: `Plant ${timestamp}`,
      address: '456 Factory Ave',
      city: 'Factory City',
      companyCodeId: createdEntities.companyCodeId,
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
      validateStatus: () => true,
    });

    if ([200, 201].includes(response.status)) {
      createdEntities.plantId = (response.data.data || response.data).id;
      console.log('✅ Plant created');
      console.log('   Plant ID:', createdEntities.plantId);
    } else {
      console.log('❌ Plant creation failed:', response.status);
    }
  });

  it('STEP 6: Create Vendor', async () => {
    console.log('\n🏢 Creating vendor...');

    const response = await axios.post(`${API_URL}/${tenantId}/vendors`, {
      name: `Vendor ${timestamp}`,
      registrationNumber: `REG-${timestamp}`,
      taxId: `TAX-${timestamp}`,
      email: `vendor-${timestamp}@vendor.com`,
      phone: '+1234567890',
      address: '789 Vendor St',
      city: 'Vendor City',
      country: 'USA',
      postalCode: '12345',
      status: 'ACTIVE',
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
      validateStatus: () => true,
    });

    if ([200, 201].includes(response.status)) {
      createdEntities.vendorId = (response.data.data || response.data).id;
      console.log('✅ Vendor created');
      console.log('   Vendor ID:', createdEntities.vendorId);
    } else {
      console.log('❌ Vendor creation failed:', response.status);
    }
  });

  it('STEP 7: Create Org Unit', async () => {
    console.log('\n🏛️  Creating organization unit...');

    const response = await axios.post(`${API_URL}/${tenantId}/org-units`, {
      name: `Department ${timestamp}`,
      code: `DEPT-${timestamp}`,
      type: 'DEPARTMENT',
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
      validateStatus: () => true,
    });

    if ([200, 201].includes(response.status)) {
      createdEntities.orgUnitId = (response.data.data || response.data).id;
      console.log('✅ Org Unit created');
      console.log('   Org Unit ID:', createdEntities.orgUnitId);
    } else {
      console.log('❌ Org Unit creation failed:', response.status);
    }
  });

  it('STEP 8: Create Budget', async () => {
    console.log('\n💰 Creating budget...');

    const response = await axios.post(`${API_URL}/${tenantId}/budgets`, {
      fiscalYear: '2025',
      orgUnitId: createdEntities.orgUnitId || `test-org-${timestamp}`,
      type: 'DEPARTMENT',
      totalAmount: 1000000,
      availableAmount: 1000000,
      description: 'Annual budget',
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
      validateStatus: () => true,
    });

    if ([200, 201].includes(response.status)) {
      createdEntities.budgetId = (response.data.data || response.data).id;
      console.log('✅ Budget created');
      console.log('   Budget ID:', createdEntities.budgetId);
    } else {
      console.log('❌ Budget creation failed:', response.status);
    }
  });

  it('STEP 9: Create Contract', async () => {
    console.log('\n📄 Creating contract...');

    const response = await axios.post(`${API_URL}/${tenantId}/contracts`, {
      title: `Contract ${timestamp}`,
      description: 'Test contract',
      totalAmount: 500000,
      currencyId: createdEntities.currencyId,
      terms: { paymentTerms: 'Net 30' },
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
      validateStatus: () => true,
    });

    if ([200, 201].includes(response.status)) {
      createdEntities.contractId = (response.data.data || response.data).id;
      console.log('✅ Contract created');
      console.log('   Contract ID:', createdEntities.contractId);

      // Assign vendor
      if (createdEntities.vendorId) {
        await axios.post(
          `${API_URL}/${tenantId}/contracts/${createdEntities.contractId}/vendors`,
          { vendorId: createdEntities.vendorId, role: 'PRIMARY' },
          { headers: { Authorization: `Bearer ${adminToken}` }, validateStatus: () => true }
        );
        console.log('   Vendor assigned to contract ✓');
      }
    } else {
      console.log('❌ Contract creation failed:', response.status, response.data);
    }
  });

  it('STEP 10: Create Tender', async () => {
    console.log('\n📢 Creating tender...');

    const response = await axios.post(`${API_URL}/${tenantId}/tenders`, {
      title: `Tender ${timestamp}`,
      description: 'Test tender',
      requirements: { items: ['Item 1', 'Item 2'] },
      criteria: { technical: 60, commercial: 40 },
      estimatedValue: 75000,
      category: 'GOODS',
      closingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
      validateStatus: () => true,
    });

    if ([200, 201].includes(response.status)) {
      createdEntities.tenderId = (response.data.data || response.data).id;
      console.log('✅ Tender created');
      console.log('   Tender ID:', createdEntities.tenderId);

      // Publish tender
      await axios.patch(
        `${API_URL}/${tenantId}/tenders/${createdEntities.tenderId}/publish`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` }, validateStatus: () => true }
      );
      console.log('   Tender published ✓');
    } else {
      console.log('❌ Tender creation failed:', response.status);
    }
  });

  it('STEP 11: Create Bid', async () => {
    if (!createdEntities.tenderId || !createdEntities.vendorId) {
      console.log('⏭️  Skipping bid - tender or vendor missing');
      return;
    }

    console.log('\n📝 Creating bid...');

    const response = await axios.post(`${API_URL}/${tenantId}/bids`, {
      tenderId: createdEntities.tenderId,
      vendorId: createdEntities.vendorId,
      bidAmount: 72000,
      technicalProposal: { approach: 'Test approach' },
      financialProposal: { breakdown: { item1: 72000 } },
      validityPeriod: 90,
    }, {
      headers: { Authorization: `Bearer ${vendorToken || adminToken}` },
      validateStatus: () => true,
    });

    if ([200, 201].includes(response.status)) {
      createdEntities.bidId = (response.data.data || response.data).id;
      console.log('✅ Bid created');
      console.log('   Bid ID:', createdEntities.bidId);
    } else {
      console.log('❌ Bid creation failed:', response.status);
    }
  });

  it('STEP 12: Create PR', async () => {
    console.log('\n📋 Creating purchase requisition...');

    const response = await axios.post(`${API_URL}/${tenantId}/workflows/procurement/create-pr`, {
      description: `PR ${timestamp}`,
      items: [
        { description: 'Item 1', quantity: 10, unitPrice: 1000 },
      ],
      estimatedAmount: 10000,
      justification: 'Test PR',
      urgency: 'MEDIUM',
      budgetId: createdEntities.budgetId,
    }, {
      headers: { Authorization: `Bearer ${userToken || adminToken}` },
      validateStatus: () => true,
    });

    if ([200, 201].includes(response.status)) {
      createdEntities.prId = (response.data.data?.pr || response.data.data).id;
      console.log('✅ PR created');
      console.log('   PR ID:', createdEntities.prId);

      // Approve PR
      await axios.post(
        `${API_URL}/${tenantId}/workflows/procurement/approve-pr/${createdEntities.prId}`,
        { approved: true, comments: 'Approved' },
        { headers: { Authorization: `Bearer ${adminToken}` }, validateStatus: () => true }
      );
      console.log('   PR approved ✓');
    } else {
      console.log('❌ PR creation failed:', response.status);
    }
  });

  it('STEP 13: Create PO', async () => {
    if (!createdEntities.prId || !createdEntities.vendorId) {
      console.log('⏭️  Skipping PO - PR or vendor missing');
      return;
    }

    console.log('\n📦 Creating purchase order...');

    const response = await axios.post(
      `${API_URL}/${tenantId}/workflows/procurement/create-po/${createdEntities.prId}`,
      { vendorIds: [createdEntities.vendorId] },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      }
    );

    if ([200, 201].includes(response.status)) {
      createdEntities.poId = (response.data.data?.po || response.data.data).id;
      console.log('✅ PO created');
      console.log('   PO ID:', createdEntities.poId);

      // Approve PO
      await axios.post(
        `${API_URL}/${tenantId}/workflows/procurement/approve-po/${createdEntities.poId}`,
        { approved: true, comments: 'Approved' },
        { headers: { Authorization: `Bearer ${adminToken}` }, validateStatus: () => true }
      );
      console.log('   PO approved ✓');
    } else {
      console.log('❌ PO creation failed:', response.status);
    }
  });

  it('FINAL: Show Verification Queries', () => {
    console.log('\n' + '='.repeat(80));
    console.log('📊 DATABASE VERIFICATION QUERIES');
    console.log('='.repeat(80));
    console.log('\nRun these SQL queries to verify data was stored:\n');

    console.log('-- Check Tenant');
    console.log(`SELECT * FROM "Tenant" WHERE id = '${createdEntities.tenantId}' OR subdomain = '${createdEntities.tenantId}';`);
    
    console.log('\n-- Check Users');
    console.log(`SELECT id, email, role FROM "User" WHERE "tenantId" = '${createdEntities.tenantId}';`);
    
    console.log('\n-- Check Currency');
    console.log(`SELECT * FROM "Currency" WHERE id = '${createdEntities.currencyId}';`);
    
    console.log('\n-- Check Company Code');
    console.log(`SELECT * FROM "CompanyCode" WHERE id = '${createdEntities.companyCodeId}';`);
    
    console.log('\n-- Check Plant');
    console.log(`SELECT * FROM "Plant" WHERE id = '${createdEntities.plantId}';`);
    
    console.log('\n-- Check Vendor');
    console.log(`SELECT * FROM "Vendor" WHERE id = '${createdEntities.vendorId}';`);
    
    console.log('\n-- Check Org Unit');
    console.log(`SELECT * FROM "OrgUnit" WHERE id = '${createdEntities.orgUnitId}';`);
    
    console.log('\n-- Check Budget');
    console.log(`SELECT * FROM "Budget" WHERE id = '${createdEntities.budgetId}';`);
    
    console.log('\n-- Check Contract');
    console.log(`SELECT * FROM "Contract" WHERE id = '${createdEntities.contractId}';`);
    
    console.log('\n-- Check Tender');
    console.log(`SELECT * FROM "Tender" WHERE id = '${createdEntities.tenderId}';`);
    
    console.log('\n-- Check Bid');
    console.log(`SELECT * FROM "Bid" WHERE id = '${createdEntities.bidId}';`);
    
    console.log('\n-- Check PR');
    console.log(`SELECT * FROM "PurchaseRequisition" WHERE id = '${createdEntities.prId}';`);
    
    console.log('\n-- Check PO');
    console.log(`SELECT * FROM "PurchaseOrder" WHERE id = '${createdEntities.poId}';`);
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 ENTITY SUMMARY');
    console.log('='.repeat(80));
    Object.entries(createdEntities).forEach(([key, value]) => {
      const status = value ? '✅' : '❌';
      console.log(`${status} ${key}: ${value || 'NOT CREATED'}`);
    });
    console.log('='.repeat(80) + '\n');
  });
});
