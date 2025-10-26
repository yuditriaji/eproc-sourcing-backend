/**
 * Diagnostic Test - Check Actual Data Storage
 * This test will show exactly what's being returned and what's failing
 */

import axios from 'axios';

const BASE_URL = 'https://eproc-sourcing-backend.onrender.com';
const API_URL = `${BASE_URL}/api/v1`;
const timestamp = Date.now();

describe('Diagnostic Check - Data Storage', () => {
  let tenantId: string;
  let adminToken: string;

  it('STEP 1: Provision tenant', async () => {
    const tenantData = {
      name: `Diagnostic Tenant ${timestamp}`,
      subdomain: `diag-${timestamp}`,
      admin: {
        email: `admin-diag-${timestamp}@test.com`,
        password: 'SecurePass123!',
        firstName: 'Admin',
        lastName: 'Diagnostic',
      },
    };

    const response = await axios.post(`${API_URL}/tenants`, tenantData, {
      validateStatus: () => true,
    });

    console.log('\n=== TENANT PROVISIONING ===');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    expect([200, 201]).toContain(response.status);
    tenantId = response.data.tenant?.id || response.data.tenant?.subdomain || response.data.subdomain;
    
    console.log('Extracted Tenant ID:', tenantId);
    expect(tenantId).toBeTruthy();

    // Login to get token
    const loginRes = await axios.post(
      `${API_URL}/${tenantId}/auth/login`,
      {
        email: tenantData.admin.email,
        password: tenantData.admin.password,
      },
      { validateStatus: () => true }
    );

    console.log('\n=== ADMIN LOGIN ===');
    console.log('Status:', loginRes.status);
    console.log('Has token:', !!loginRes.data.accessToken);
    
    adminToken = loginRes.data.accessToken;
    expect(adminToken).toBeTruthy();
  }, 30000);

  it('STEP 2: Create currency', async () => {
    const currencyData = {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      exchangeRate: 1.0,
    };

    const response = await axios.post(
      `${API_URL}/${tenantId}/currencies`,
      currencyData,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      }
    );

    console.log('\n=== CURRENCY CREATION ===');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.status >= 400) {
      console.log('ERROR - Currency not created');
      console.log('Status:', response.status);
      console.log('Error:', response.data);
    } else {
      const currency = response.data.data || response.data;
      console.log('Currency ID:', currency?.id);
      expect(currency?.id).toBeTruthy();
    }
  });

  it('STEP 3: Create vendor', async () => {
    const vendorData = {
      name: `Test Vendor ${timestamp}`,
      registrationNumber: `REG-${timestamp}`,
      taxId: `TAX-${timestamp}`,
      email: `vendor-${timestamp}@test.com`,
      phone: '+1234567890',
      address: '123 Test St',
      city: 'Test City',
      country: 'USA',
      postalCode: '12345',
      status: 'ACTIVE',
    };

    const response = await axios.post(
      `${API_URL}/${tenantId}/vendors`,
      vendorData,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      }
    );

    console.log('\n=== VENDOR CREATION ===');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.status >= 400) {
      console.log('ERROR - Vendor not created');
      console.log('Error:', response.data);
    } else {
      const vendor = response.data.data || response.data;
      console.log('Vendor ID:', vendor?.id);
      expect(vendor?.id).toBeTruthy();
    }
  });

  it('STEP 4: Create contract', async () => {
    const contractData = {
      title: `Test Contract ${timestamp}`,
      description: 'Diagnostic test contract',
      totalAmount: 100000,
      terms: { paymentTerms: 'Net 30' },
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const response = await axios.post(
      `${API_URL}/${tenantId}/contracts`,
      contractData,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      }
    );

    console.log('\n=== CONTRACT CREATION ===');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.status >= 400) {
      throw new Error(`Contract creation failed: ${response.status} - ${JSON.stringify(response.data)}`);
    }
    
    const contract = response.data.data || response.data;
    console.log('Contract ID:', contract?.id);
    
    if (!contract?.id) {
      throw new Error(`Contract ID missing. Response: ${JSON.stringify(response.data, null, 2)}`);
    }
    
    expect(contract.id).toBeTruthy();
  });

  it('STEP 5: Create budget', async () => {
    const budgetData = {
      fiscalYear: '2025',
      orgUnitId: `test-org-${timestamp}`,
      type: 'DEPARTMENT',
      totalAmount: 1000000,
      availableAmount: 1000000,
      description: 'Test budget',
    };

    const response = await axios.post(
      `${API_URL}/${tenantId}/budgets`,
      budgetData,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        validateStatus: () => true,
      }
    );

    console.log('\n=== BUDGET CREATION ===');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.status >= 400) {
      console.log('ERROR - Budget not created');
      console.log('Error:', response.data);
    } else {
      const budget = response.data.data || response.data;
      console.log('Budget ID:', budget?.id);
      expect(budget?.id).toBeTruthy();
    }
  });

  it('SUMMARY: Check what was created', () => {
    console.log('\n=== DIAGNOSTIC SUMMARY ===');
    console.log('Tenant ID:', tenantId);
    console.log('Admin Token:', adminToken ? 'Present' : 'Missing');
    console.log('\nTo verify in database, check:');
    console.log(`SELECT * FROM "Tenant" WHERE id = '${tenantId}' OR subdomain = '${tenantId}';`);
    console.log(`SELECT * FROM "Currency" WHERE "tenantId" = '${tenantId}';`);
    console.log(`SELECT * FROM "Vendor" WHERE "tenantId" = '${tenantId}';`);
    console.log(`SELECT * FROM "Contract" WHERE "tenantId" = '${tenantId}';`);
    console.log(`SELECT * FROM "Budget" WHERE "tenantId" = '${tenantId}';`);
  });
});
