import { UserRole, VendorStatus, TenderStatus, BidStatus, ContractStatus, PRStatus, POStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export const testTenant = {
  id: 'test-tenant-001',
  name: 'Test Tenant',
  subdomain: 'test',
  residencyTag: 'us',
  config: {},
};

export const adminUser = {
  id: 'admin-001',
  tenantId: testTenant.id,
  email: 'admin@test.com',
  username: 'admin',
  password: bcrypt.hashSync('admin123', 10),
  firstName: 'Admin',
  lastName: 'User',
  role: UserRole.ADMIN,
  abilities: { manage: 'all' },
  isActive: true,
  isVerified: true,
};

export const buyerUser = {
  id: 'buyer-001',
  tenantId: testTenant.id,
  email: 'buyer@test.com',
  username: 'buyer',
  password: bcrypt.hashSync('buyer123', 10),
  firstName: 'Buyer',
  lastName: 'User',
  role: UserRole.BUYER,
  abilities: { manage: 'procurement' },
  department: 'Procurement',
  isActive: true,
  isVerified: true,
};

export const vendorUser = {
  id: 'vendor-user-001',
  tenantId: testTenant.id,
  email: 'vendor@test.com',
  username: 'vendor',
  password: bcrypt.hashSync('vendor123', 10),
  firstName: 'Vendor',
  lastName: 'User',
  role: UserRole.VENDOR,
  abilities: { submit: 'bid' },
  isActive: true,
  isVerified: true,
};

export const testVendor = {
  id: 'vendor-001',
  tenantId: testTenant.id,
  name: 'Test Vendor Inc',
  registrationNumber: 'REG-001',
  taxId: 'TAX-001',
  contactEmail: 'contact@vendor.com',
  contactPhone: '+1234567890',
  status: VendorStatus.ACTIVE,
  rating: 4.5,
};

export const testCurrency = {
  id: 'currency-usd',
  tenantId: testTenant.id,
  code: 'USD',
  symbol: '$',
  name: 'US Dollar',
  isActive: true,
  exchangeRate: 1.0,
};

export const testContract = {
  id: 'contract-001',
  tenantId: testTenant.id,
  contractNumber: 'CNT-001',
  title: 'Test Contract',
  description: 'Test contract description',
  totalAmount: 100000.0,
  currencyId: testCurrency.id,
  status: ContractStatus.DRAFT,
  ownerId: buyerUser.id,
};

export const testTender = {
  id: 'tender-001',
  tenantId: testTenant.id,
  tenderNumber: 'TND-001',
  title: 'Test Tender',
  description: 'Test tender description',
  requirements: { items: ['Item 1', 'Item 2'] },
  criteria: { technical: 60, commercial: 40 },
  estimatedValue: 50000.0,
  status: TenderStatus.DRAFT,
  creatorId: buyerUser.id,
};

export const testBid = {
  id: 'bid-001',
  tenantId: testTenant.id,
  tenderId: testTender.id,
  vendorId: testVendor.id,
  bidAmount: 48000.0,
  status: BidStatus.DRAFT,
  technicalProposal: { approach: 'Agile methodology' },
  financialProposal: { breakdown: { labor: 30000, materials: 18000 } },
};

export const testPR = {
  id: 'pr-001',
  tenantId: testTenant.id,
  prNumber: 'PR-001',
  title: 'Test Purchase Requisition',
  description: 'Test PR description',
  items: [{ name: 'Item 1', quantity: 10, unitPrice: 100 }],
  estimatedAmount: 1000.0,
  status: PRStatus.PENDING,
  requesterId: buyerUser.id,
};

export const testPO = {
  id: 'po-001',
  tenantId: testTenant.id,
  poNumber: 'PO-001',
  title: 'Test Purchase Order',
  description: 'Test PO description',
  amount: 1000.0,
  currencyId: testCurrency.id,
  status: POStatus.DRAFT,
  items: [{ name: 'Item 1', quantity: 10, unitPrice: 100 }],
  createdById: buyerUser.id,
};

export const testCompanyCode = {
  id: 'cc-001',
  tenantId: testTenant.id,
  code: 'CC01',
  name: 'Test Company Code',
  description: 'Main company code for testing',
};

export const testPlant = {
  id: 'plant-001',
  tenantId: testTenant.id,
  companyCodeId: testCompanyCode.id,
  code: 'PLT01',
  name: 'Test Plant',
  description: 'Main plant for testing',
};

export const testPurchasingOrg = {
  id: 'porg-001',
  tenantId: testTenant.id,
  code: 'PORG01',
  name: 'Test Purchasing Organization',
};

export const testOrgUnit = {
  id: 'org-001',
  tenantId: testTenant.id,
  level: 1,
  name: 'Test Division',
  type: 'COMPANY_CODE' as const,
  companyCode: 'CC01',
};

export const testBudget = {
  id: 'budget-001',
  tenantId: testTenant.id,
  fiscalYear: '2025',
  totalAmount: 1000000.0,
  availableAmount: 1000000.0,
  orgUnitId: testOrgUnit.id,
  type: 'DIVISION' as const,
};
