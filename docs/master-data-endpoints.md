# Master Data Endpoints

This document describes the master data endpoints for the e-procurement sourcing backend API. All endpoints are tenant-scoped and require JWT authentication.

## Base URL Structure
```
{API_PREFIX}/{tenant}
```
Where:
- `API_PREFIX`: Default is `api/v1`
- `tenant`: Tenant identifier

## Authentication
All endpoints require JWT authentication via Bearer token in the Authorization header.

**Note:** This documentation reflects the currently implemented endpoints. Some master data entities like currencies are part of the data model but don't have dedicated controllers yet.

---

## 1. Vendor Management

### Create Vendor
```http
POST /{tenant}/vendors
```

**Request Body:**
```json
{
  "name": "Acme Corp",
  "registrationNumber": "REG123456",
  "taxId": "TAX123456",
  "contactEmail": "contact@acme.com",
  "contactPhone": "+1-555-0123",
  "website": "https://acme.com",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  },
  "bankDetails": {
    "bankName": "First Bank",
    "accountNumber": "1234567890",
    "routingNumber": "021000021"
  },
  "businessType": "Corporation",
  "yearEstablished": 2010,
  "employeeCount": 500,
  "annualRevenue": 10000000.00,
  "certifications": ["ISO9001", "ISO14001"],
  "companyCodeId": "cc_123",
  "plantId": "plant_123",
  "purchasingOrgId": "porg_123",
  "purchasingGroupId": "pgroup_123"
}
```

**Response:**
```json
{
  "id": "vendor_123",
  "tenantId": "tenant_123",
  "name": "Acme Corp",
  "status": "PENDING_APPROVAL",
  "rating": null,
  "totalContracts": 0,
  "onTimeDelivery": null,
  "createdAt": "2025-01-01T00:00:00Z",
  // ... other fields
}
```

### List Vendors
```http
GET /{tenant}/vendors?limit=20&offset=0&status=ACTIVE&search=acme&companyCodeId=cc_123&purchasingOrgId=porg_123
```

**Query Parameters:**
- `limit`: Number of records (default: 20)
- `offset`: Skip records (default: 0)
- `status`: Filter by vendor status (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `PENDING_APPROVAL`, `BLACKLISTED`)
- `search`: Search by name, registration number, or contact email
- `companyCodeId`: Filter by company code
- `purchasingOrgId`: Filter by purchasing organization

**Response:**
```json
{
  "data": [
    {
      "id": "vendor_123",
      "name": "Acme Corp",
      "contactEmail": "contact@acme.com",
      "status": "ACTIVE",
      "rating": 4.5,
      "createdAt": "2025-01-01T00:00:00Z",
      "companyCode": { "code": "CC01", "name": "Main Company" },
      "purchasingOrg": { "code": "PORG01", "name": "Central Purchasing" }
    }
  ],
  "meta": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Get Active Vendors
```http
GET /{tenant}/vendors/active
```

**Response:**
```json
[
  {
    "id": "vendor_123",
    "name": "Acme Corp",
    "contactEmail": "contact@acme.com",
    "registrationNumber": "REG123456",
    "rating": 4.5
  }
]
```

### Get Vendor by ID
```http
GET /{tenant}/vendors/{id}
```

**Response:**
```json
{
  "id": "vendor_123",
  "name": "Acme Corp",
  "registrationNumber": "REG123456",
  "taxId": "TAX123456",
  "contactEmail": "contact@acme.com",
  "contactPhone": "+1-555-0123",
  "website": "https://acme.com",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  },
  "status": "ACTIVE",
  "rating": 4.5,
  "totalContracts": 15,
  "onTimeDelivery": 92.5,
  "companyCode": { "code": "CC01", "name": "Main Company" },
  "plant": { "code": "P001", "name": "Plant 1" },
  "purchasingOrg": { "code": "PORG01", "name": "Central Purchasing" },
  "contracts": [
    {
      "id": "contract_123",
      "contractNumber": "CNT-2025-001",
      "status": "IN_PROGRESS"
    }
  ],
  "bids": [
    {
      "id": "bid_123",
      "tender": {
        "tenderNumber": "TND-2025-001",
        "title": "IT Equipment Procurement"
      },
      "status": "SUBMITTED"
    }
  ],
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

### Update Vendor
```http
PUT /{tenant}/vendors/{id}
```

**Request Body:**
```json
{
  "name": "Acme Corporation (Updated)",
  "contactEmail": "info@acme.com",
  "contactPhone": "+1-555-0124",
  "website": "https://www.acme.com",
  "businessType": "Corporation",
  "yearEstablished": 2010,
  "employeeCount": 750,
  "annualRevenue": 15000000.00,
  "status": "ACTIVE"
}
```

### Update Vendor Rating
```http
PUT /{tenant}/vendors/{id}/rating
```

**Request Body:**
```json
{
  "rating": 4.8,
  "onTimeDelivery": 95.5
}
```

### Delete Vendor
```http
DELETE /{tenant}/vendors/{id}
```

**Note:** If vendor has active relationships (contracts, bids, etc.), it will be soft-deleted. Otherwise, hard-deleted.

---

## 2. Organizational Structure Management

All organizational structure endpoints are under the `/org` path.

### Company Code Management

#### Create Company Code
```http
POST /{tenant}/org/company-codes
```

**Request Body:**
```json
{
  "code": "CC01",
  "name": "Main Company",
  "description": "Primary company code for operations"
}
```

#### List Company Codes
```http
GET /{tenant}/org/company-codes?q={search_term}
```

**Query Parameters:**
- `q`: Search term for filtering company codes (optional)

#### Update Company Code
```http
PUT /{tenant}/org/company-codes/{id}
```

**Request Body:**
```json
{
  "name": "Updated Company Name",
  "description": "Updated description"
}
```

#### Delete Company Code
```http
DELETE /{tenant}/org/company-codes/{id}
```

---

### Plant Management

#### Create Plant
```http
POST /{tenant}/org/plants
```

**Request Body:**
```json
{
  "companyCodeId": "cc_123",
  "code": "P001",
  "name": "Manufacturing Plant 1",
  "description": "Main manufacturing facility"
}
```

#### List Plants
```http
GET /{tenant}/org/plants?companyCodeId={id}
```

**Query Parameters:**
- `companyCodeId`: Filter plants by company code (optional)

#### Update Plant
```http
PUT /{tenant}/org/plants/{id}
```

**Request Body:**
```json
{
  "name": "Updated Plant Name",
  "description": "Updated description"
}
```

#### Delete Plant
```http
DELETE /{tenant}/org/plants/{id}
```

---

### Storage Location Management

#### Create Storage Location
```http
POST /{tenant}/org/storage-locations
```

**Request Body:**
```json
{
  "plantId": "plant_123",
  "code": "SL001",
  "name": "Main Warehouse"
}
```

#### List Storage Locations
```http
GET /{tenant}/org/storage-locations?plantId={id}
```

**Query Parameters:**
- `plantId`: Filter storage locations by plant (optional)

#### Update Storage Location
```http
PUT /{tenant}/org/storage-locations/{id}
```

**Request Body:**
```json
{
  "name": "Updated Storage Location Name"
}
```

#### Delete Storage Location
```http
DELETE /{tenant}/org/storage-locations/{id}
```

---

### Purchasing Organization Management

#### Create Purchasing Organization
```http
POST /{tenant}/org/purchasing-orgs
```

**Request Body:**
```json
{
  "code": "PORG01",
  "name": "Central Purchasing"
}
```

#### List Purchasing Organizations
```http
GET /{tenant}/org/purchasing-orgs?q={search_term}
```

**Query Parameters:**
- `q`: Search term for filtering purchasing organizations (optional)

#### Update Purchasing Organization
```http
PUT /{tenant}/org/purchasing-orgs/{id}
```

**Request Body:**
```json
{
  "name": "Updated Purchasing Org Name"
}
```

#### Delete Purchasing Organization
```http
DELETE /{tenant}/org/purchasing-orgs/{id}
```

---

### Purchasing Group Management

#### Create Purchasing Group
```http
POST /{tenant}/org/purchasing-groups
```

**Request Body:**
```json
{
  "purchasingOrgId": "porg_123",
  "code": "PG001",
  "name": "IT Equipment Group"
}
```

#### List Purchasing Groups
```http
GET /{tenant}/org/purchasing-groups?purchasingOrgId={id}
```

**Query Parameters:**
- `purchasingOrgId`: Filter purchasing groups by purchasing organization (optional)

#### Update Purchasing Group
```http
PUT /{tenant}/org/purchasing-groups/{id}
```

**Request Body:**
```json
{
  "name": "Updated Purchasing Group Name"
}
```

#### Delete Purchasing Group
```http
DELETE /{tenant}/org/purchasing-groups/{id}
```

---

### Purchasing Organization Assignment

#### Create Assignment
```http
POST /{tenant}/org/porg-assignments
```

**Request Body:**
```json
{
  "purchasingOrgId": "porg_123",
  "companyCodeId": "cc_123",
  "plantId": "plant_123"
}
```

#### List Assignments
```http
GET /{tenant}/org/porg-assignments?purchasingOrgId={id}
```

**Query Parameters:**
- `purchasingOrgId`: Filter assignments by purchasing organization (optional)

#### Delete Assignment
```http
DELETE /{tenant}/org/porg-assignments/{id}
```

---

## 3. Configuration and Organizational Units

### Tenant Basis Configuration
```http
POST /{tenant}/config/basis
```

**Request Body:**
```json
{
  "basisConfig": {
    "defaultCurrency": "USD",
    "fiscalYear": 2025,
    "taxRate": 0.1
  },
  "processConfig": {
    "approvalRequired": true,
    "autoApprovalThreshold": 1000
  }
}
```

### Bulk Create Organizational Units
```http
POST /{tenant}/config/org-units/bulk
```

**Request Body:**
```json
{
  "ccs": [
    {
      "code": "CC01",
      "name": "Main Company",
      "pgs": [
        {
          "code": "PG001",
          "name": "IT Group"
        },
        {
          "code": "PG002", 
          "name": "Facilities Group"
        }
      ]
    }
  ]
}
```

---

## 4. Currency Management

### Create Currency
```http
POST /{tenant}/currencies
```

**Request Body:**
```json
{
  "code": "USD",
  "symbol": "$",
  "name": "US Dollar",
  "exchangeRate": 1.0,
  "isActive": true
}
```

**Response:**
```json
{
  "id": "curr_123",
  "tenantId": "tenant_123",
  "code": "USD",
  "symbol": "$",
  "name": "US Dollar",
  "exchangeRate": 1.0,
  "isActive": true,
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

### List Currencies
```http
GET /{tenant}/currencies?limit=20&offset=0&active=true&search=USD
```

**Query Parameters:**
- `limit`: Number of records to return (default: 20)
- `offset`: Number of records to skip (default: 0)
- `active`: Filter by active status (true/false)
- `search`: Search by currency code or name

### Get Active Currencies
```http
GET /{tenant}/currencies/active
```

**Response:**
```json
[
  {
    "id": "curr_123",
    "code": "USD",
    "symbol": "$",
    "name": "US Dollar",
    "exchangeRate": 1.0
  }
]
```

### Get Currency by ID
```http
GET /{tenant}/currencies/{id}
```

### Update Currency
```http
PUT /{tenant}/currencies/{id}
```

**Request Body:**
```json
{
  "symbol": "US$",
  "name": "US Dollar (Updated)",
  "exchangeRate": 1.05,
  "isActive": true
}
```

### Delete Currency
```http
DELETE /{tenant}/currencies/{id}
```

**Note:** Currency can only be deleted if not in use by contracts, purchase orders, or invoices.

---

## 5. Master Data Relationships

### Get Master Data Hierarchy
```http
GET /{tenant}/master-data/hierarchy
```

**Response:**
```json
{
  "companyCodes": [
    {
      "id": "cc_123",
      "code": "CC01",
      "name": "Main Company",
      "description": "Primary company",
      "plants": [
        {
          "id": "plant_123",
          "code": "P001",
          "name": "Plant 1",
          "description": "Manufacturing plant",
          "storageLocations": [
            {
              "id": "sl_123",
              "code": "SL001",
              "name": "Warehouse A"
            }
          ]
        }
      ]
    }
  ],
  "purchasingOrgs": [
    {
      "id": "porg_123",
      "code": "PORG01",
      "name": "Central Purchasing",
      "groups": [
        {
          "id": "pgroup_123",
          "code": "PG001",
          "name": "IT Equipment"
        }
      ],
      "assignments": [
        {
          "id": "assign_123",
          "companyCode": { "id": "cc_123", "code": "CC01", "name": "Main Company" },
          "plant": { "id": "plant_123", "code": "P001", "name": "Plant 1" }
        }
      ]
    }
  ],
  "orgUnits": [
    {
      "id": "org_123",
      "name": "IT Department",
      "type": "PURCHASING_GROUP",
      "level": 2,
      "companyCode": "CC01",
      "pgCode": "PG001",
      "children": []
    }
  ],
  "currencies": [
    {
      "id": "curr_123",
      "code": "USD",
      "symbol": "$",
      "name": "US Dollar",
      "exchangeRate": 1.0
    }
  ]
}
```

### Validate Master Data References
```http
POST /{tenant}/master-data/validate
```

**Request Body:**
```json
{
  "companyCodeId": "cc_123",
  "plantId": "plant_123",
  "storageLocationId": "sl_123",
  "purchasingOrgId": "porg_123",
  "purchasingGroupId": "pgroup_123"
}
```

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": [
    "No purchasing organization assignment found for this plant"
  ]
}
```

### Get Master Data Summary
```http
GET /{tenant}/master-data/summary
```

**Response:**
```json
{
  "summary": {
    "companyCodes": 5,
    "plants": 12,
    "storageLocations": 25,
    "purchasingOrgs": 3,
    "purchasingGroups": 8,
    "activeVendors": 150,
    "activeCurrencies": 10,
    "orgUnits": 20
  }
}
```

---

## Error Responses

### Standard Error Format
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "code",
      "message": "Code must be unique within tenant"
    }
  ]
}
```

### Common Error Codes
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid JWT)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate unique constraint)
- `422` - Unprocessable Entity (business logic error)

---

## Rate Limiting

All endpoints are subject to rate limiting based on user role:
- `ADMIN`: High limits
- `USER`: Standard limits  
- `VENDOR`: Restricted limits

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

---

## Data Validation Rules

### Currency
- `code`: Must be 3-character ISO currency code
- `symbol`: Max 10 characters
- `exchangeRate`: Must be positive decimal

### Vendor
- `name`: Required, max 200 characters
- `registrationNumber`: Must be unique within tenant
- `contactEmail`: Must be valid email format
- `rating`: 0.00 to 5.00 scale

### Organizational Codes
- All codes must be unique within their scope
- Company codes: Alphanumeric, max 4 characters
- Plant codes: Alphanumeric, max 4 characters, unique within company code
- Storage location codes: Alphanumeric, max 4 characters, unique within plant

---

## Swagger Documentation

Complete API documentation with request/response schemas is available at:
```
/{API_PREFIX}/docs
```

The Swagger UI provides interactive testing capabilities and detailed schema definitions for all master data endpoints.