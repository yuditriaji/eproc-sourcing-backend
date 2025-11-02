# Configuration Process Flow

Complete end-to-end process flow for configuring the e-procurement sourcing backend, including all request bodies and responses for UI/UX alignment.

---

## Table of Contents
1. [Tenant Provisioning](#1-tenant-provisioning)
2. [Authentication](#2-authentication)
3. [Basis Configuration](#3-basis-configuration)
4. [Organizational Structure Setup](#4-organizational-structure-setup)
5. [Master Data Configuration](#5-master-data-configuration)
6. [User Management](#6-user-management)
7. [Configuration Validation](#7-configuration-validation)

---

## Base URL Pattern
```
{API_PREFIX}/{tenant}
```
Where:
- `API_PREFIX`: Default is `api/v1`
- `tenant`: Tenant identifier (subdomain or ID)

All configuration endpoints require JWT authentication unless specified as public.

---

## 1. Tenant Provisioning

### 1.1 Create New Tenant
**Endpoint:** `POST /{API_PREFIX}/tenants`  
**Auth:** Public (platform operator use)  
**Description:** Creates a new tenant organization with an initial admin user

#### Request Body
```json
{
  "name": "Acme Corporation",
  "subdomain": "acme",
  "config": {
    "region": "us",
    "timezone": "America/New_York",
    "features": ["procurement", "tender"]
  },
  "admin": {
    "email": "admin@acme.com",
    "username": "acmeadmin",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Administrator"
  }
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Tenant created successfully",
  "data": {
    "tenant": {
      "id": "ten_abc123xyz",
      "name": "Acme Corporation",
      "subdomain": "acme",
      "config": {
        "region": "us",
        "timezone": "America/New_York",
        "features": ["procurement", "tender"]
      },
      "status": "ACTIVE",
      "createdAt": "2025-01-15T10:00:00.000Z"
    },
    "adminUser": {
      "id": "usr_admin001",
      "email": "admin@acme.com",
      "username": "acmeadmin",
      "firstName": "John",
      "lastName": "Administrator",
      "role": "ADMIN",
      "tenantId": "ten_abc123xyz",
      "isActive": true,
      "isVerified": true
    }
  }
}
```

#### Error Response (400 Bad Request)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Tenant creation failed",
  "errors": [
    "Subdomain 'acme' is already taken",
    "Admin email must be valid"
  ]
}
```

---

## 2. Authentication

### 2.1 Admin Login
**Endpoint:** `POST /{API_PREFIX}/{tenant}/auth/login`  
**Auth:** Public  
**Description:** Authenticate as admin and obtain access token

#### Request Body
```json
{
  "email": "admin@acme.com",
  "password": "SecurePassword123!"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "usr_admin001",
      "email": "admin@acme.com",
      "username": "acmeadmin",
      "firstName": "John",
      "lastName": "Administrator",
      "role": "ADMIN",
      "tenantId": "ten_abc123xyz",
      "abilities": [
        {
          "actions": ["manage"],
          "subjects": ["all"]
        }
      ]
    }
  }
}
```

**Note:** A `refreshToken` is set as an httpOnly cookie. Use `Authorization: Bearer {accessToken}` for subsequent requests.

### 2.2 Get Role Configuration
**Endpoint:** `GET /{API_PREFIX}/{tenant}/auth/roles/config`  
**Auth:** Bearer (ADMIN)  
**Description:** Retrieve available roles and permissions

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Role configuration retrieved",
  "data": {
    "roles": [
      {
        "role": "ADMIN",
        "permissions": ["*"],
        "description": "System administrator with full access"
      },
      {
        "role": "USER",
        "permissions": ["read:tenders", "create:tenders", "score:bids"],
        "description": "Internal user who can create tenders and score bids"
      },
      {
        "role": "BUYER",
        "permissions": ["create:pr", "create:po", "manage:vendors"],
        "description": "Purchasing professional"
      },
      {
        "role": "MANAGER",
        "permissions": ["approve:pr", "approve:po", "view:reports"],
        "description": "Department manager with approval authority"
      },
      {
        "role": "FINANCE",
        "permissions": ["approve:invoice", "process:payment", "view:budgets"],
        "description": "Finance team member"
      },
      {
        "role": "VENDOR",
        "permissions": ["read:own", "create:bids", "submit:bids"],
        "description": "External vendor who can submit bids"
      }
    ]
  }
}
```

---

## 3. Basis Configuration

### 3.1 Create/Update Tenant Basis Configuration
**Endpoint:** `POST /{API_PREFIX}/{tenant}/config/basis`  
**Auth:** Bearer (ADMIN)  
**Description:** Set up foundational tenant configuration including org structure and process definitions

#### Request Body
```json
{
  "tenantConfig": {
    "orgStructure": {
      "levels": 3,
      "notes": "CompanyCode → Plant → StorageLocation hierarchy",
      "allowCrossPlantProcurement": true
    },
    "businessVariants": [
      {
        "name": "Standard Procurement",
        "code": "STD",
        "description": "Standard procurement process for regular items"
      },
      {
        "name": "Express Procurement",
        "code": "EXP",
        "description": "Expedited procurement for urgent requirements"
      }
    ],
    "approvalLimits": {
      "tier1": 10000,
      "tier2": 50000,
      "tier3": 100000
    },
    "financialYear": {
      "startMonth": 1,
      "endMonth": 12
    }
  },
  "processConfig": {
    "name": "Standard Tender Process",
    "processType": "TENDER",
    "description": "Complete tender lifecycle from draft to award",
    "steps": [
      {
        "stepName": "Draft",
        "requiredRole": "BUYER",
        "allowedActions": ["create", "edit"],
        "duration": 2
      },
      {
        "stepName": "Review",
        "requiredRole": "MANAGER",
        "allowedActions": ["review", "comment"],
        "duration": 1
      },
      {
        "stepName": "Publish",
        "requiredRole": "ADMIN",
        "allowedActions": ["publish"],
        "duration": 0
      },
      {
        "stepName": "Bidding",
        "requiredRole": "VENDOR",
        "allowedActions": ["submit_bid"],
        "duration": 14
      },
      {
        "stepName": "Evaluation",
        "requiredRole": "BUYER",
        "allowedActions": ["score", "compare"],
        "duration": 3
      },
      {
        "stepName": "Award",
        "requiredRole": "ADMIN",
        "allowedActions": ["award", "reject"],
        "duration": 1
      }
    ]
  }
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Basis configuration created successfully",
  "data": {
    "tenantConfig": {
      "id": "tc_config001",
      "tenantId": "ten_abc123xyz",
      "orgStructure": {
        "levels": 3,
        "notes": "CompanyCode → Plant → StorageLocation hierarchy",
        "allowCrossPlantProcurement": true
      },
      "businessVariants": [
        {
          "name": "Standard Procurement",
          "code": "STD",
          "description": "Standard procurement process for regular items"
        },
        {
          "name": "Express Procurement",
          "code": "EXP",
          "description": "Expedited procurement for urgent requirements"
        }
      ],
      "approvalLimits": {
        "tier1": 10000,
        "tier2": 50000,
        "tier3": 100000
      },
      "financialYear": {
        "startMonth": 1,
        "endMonth": 12
      },
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    },
    "processConfig": {
      "id": "pc_proc001",
      "tenantId": "ten_abc123xyz",
      "name": "Standard Tender Process",
      "processType": "TENDER",
      "description": "Complete tender lifecycle from draft to award",
      "steps": [
        {
          "stepName": "Draft",
          "requiredRole": "BUYER",
          "allowedActions": ["create", "edit"],
          "duration": 2
        },
        {
          "stepName": "Review",
          "requiredRole": "MANAGER",
          "allowedActions": ["review", "comment"],
          "duration": 1
        },
        {
          "stepName": "Publish",
          "requiredRole": "ADMIN",
          "allowedActions": ["publish"],
          "duration": 0
        },
        {
          "stepName": "Bidding",
          "requiredRole": "VENDOR",
          "allowedActions": ["submit_bid"],
          "duration": 14
        },
        {
          "stepName": "Evaluation",
          "requiredRole": "BUYER",
          "allowedActions": ["score", "compare"],
          "duration": 3
        },
        {
          "stepName": "Award",
          "requiredRole": "ADMIN",
          "allowedActions": ["award", "reject"],
          "duration": 1
        }
      ],
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

---

## 4. Organizational Structure Setup

### 4.1 Create Company Code
**Endpoint:** `POST /{API_PREFIX}/{tenant}/org/company-codes`  
**Auth:** Bearer (ADMIN)  
**Description:** Create a company code (top-level organizational unit)

#### Request Body
```json
{
  "code": "CC1000",
  "name": "Acme US Operations",
  "description": "Primary company code for US operations",
  "address": {
    "street": "123 Business St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  }
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Company code created successfully",
  "data": {
    "id": "cc_us1000",
    "tenantId": "ten_abc123xyz",
    "code": "CC1000",
    "name": "Acme US Operations",
    "description": "Primary company code for US operations",
    "address": {
      "street": "123 Business St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA"
    },
    "createdAt": "2025-01-15T11:00:00.000Z"
  }
}
```

### 4.2 Create Plant
**Endpoint:** `POST /{API_PREFIX}/{tenant}/org/plants`  
**Auth:** Bearer (ADMIN)  
**Description:** Create a plant under a company code

#### Request Body
```json
{
  "companyCodeId": "cc_us1000",
  "code": "P1001",
  "name": "Manhattan Manufacturing Plant",
  "description": "Primary manufacturing facility",
  "address": {
    "street": "456 Industrial Ave",
    "city": "New York",
    "state": "NY",
    "zipCode": "10002",
    "country": "USA"
  }
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Plant created successfully",
  "data": {
    "id": "plt_man1001",
    "tenantId": "ten_abc123xyz",
    "companyCodeId": "cc_us1000",
    "code": "P1001",
    "name": "Manhattan Manufacturing Plant",
    "description": "Primary manufacturing facility",
    "address": {
      "street": "456 Industrial Ave",
      "city": "New York",
      "state": "NY",
      "zipCode": "10002",
      "country": "USA"
    },
    "createdAt": "2025-01-15T11:05:00.000Z"
  }
}
```

### 4.3 Create Storage Location
**Endpoint:** `POST /{API_PREFIX}/{tenant}/org/storage-locations`  
**Auth:** Bearer (ADMIN)  
**Description:** Create a storage location within a plant

#### Request Body
```json
{
  "plantId": "plt_man1001",
  "code": "SL001",
  "name": "Main Warehouse",
  "description": "Primary storage facility for finished goods",
  "capacity": 50000,
  "unit": "sqft"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Storage location created successfully",
  "data": {
    "id": "sl_wh001",
    "tenantId": "ten_abc123xyz",
    "plantId": "plt_man1001",
    "code": "SL001",
    "name": "Main Warehouse",
    "description": "Primary storage facility for finished goods",
    "capacity": 50000,
    "unit": "sqft",
    "createdAt": "2025-01-15T11:10:00.000Z"
  }
}
```

### 4.4 Create Purchasing Organization
**Endpoint:** `POST /{API_PREFIX}/{tenant}/org/purchasing-orgs`  
**Auth:** Bearer (ADMIN)  
**Description:** Create a purchasing organization

#### Request Body
```json
{
  "code": "PORG1000",
  "name": "US Procurement Organization",
  "description": "Handles all procurement for US operations"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Purchasing organization created successfully",
  "data": {
    "id": "porg_us1000",
    "tenantId": "ten_abc123xyz",
    "code": "PORG1000",
    "name": "US Procurement Organization",
    "description": "Handles all procurement for US operations",
    "createdAt": "2025-01-15T11:15:00.000Z"
  }
}
```

### 4.5 Create Purchasing Group
**Endpoint:** `POST /{API_PREFIX}/{tenant}/org/purchasing-groups`  
**Auth:** Bearer (ADMIN)  
**Description:** Create a purchasing group under a purchasing organization

#### Request Body
```json
{
  "purchasingOrgId": "porg_us1000",
  "code": "PG100",
  "name": "IT & Electronics Procurement Group",
  "description": "Specializes in IT equipment and electronics procurement"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Purchasing group created successfully",
  "data": {
    "id": "pg_it100",
    "tenantId": "ten_abc123xyz",
    "purchasingOrgId": "porg_us1000",
    "code": "PG100",
    "name": "IT & Electronics Procurement Group",
    "description": "Specializes in IT equipment and electronics procurement",
    "createdAt": "2025-01-15T11:20:00.000Z"
  }
}
```

### 4.6 Assign Purchasing Org to Company Code
**Endpoint:** `POST /{API_PREFIX}/{tenant}/org/porg-assignments`  
**Auth:** Bearer (ADMIN)  
**Description:** Link purchasing organization to company code or plant

#### Request Body (Company Code Assignment)
```json
{
  "purchasingOrgId": "porg_us1000",
  "companyCodeId": "cc_us1000"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Purchasing organization assigned successfully",
  "data": {
    "id": "pa_assign001",
    "tenantId": "ten_abc123xyz",
    "purchasingOrgId": "porg_us1000",
    "companyCodeId": "cc_us1000",
    "plantId": null,
    "createdAt": "2025-01-15T11:25:00.000Z"
  }
}
```

### 4.7 Get Organizational Hierarchy
**Endpoint:** `GET /{API_PREFIX}/{tenant}/org/company-codes`  
**Auth:** Bearer  
**Description:** Retrieve complete organizational hierarchy

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Organizational hierarchy retrieved",
  "data": [
    {
      "id": "cc_us1000",
      "code": "CC1000",
      "name": "Acme US Operations",
      "plants": [
        {
          "id": "plt_man1001",
          "code": "P1001",
          "name": "Manhattan Manufacturing Plant",
          "storageLocations": [
            {
              "id": "sl_wh001",
              "code": "SL001",
              "name": "Main Warehouse"
            }
          ]
        }
      ],
      "purchasingOrgs": [
        {
          "id": "porg_us1000",
          "code": "PORG1000",
          "name": "US Procurement Organization",
          "purchasingGroups": [
            {
              "id": "pg_it100",
              "code": "PG100",
              "name": "IT & Electronics Procurement Group"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 5. Master Data Configuration

### 5.1 Create Currency
**Endpoint:** `POST /{API_PREFIX}/{tenant}/currencies`  
**Auth:** Bearer (ADMIN, USER)  
**Description:** Add a currency for financial transactions

#### Request Body
```json
{
  "code": "USD",
  "symbol": "$",
  "name": "US Dollar",
  "exchangeRate": 1.0,
  "isActive": true
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Currency created successfully",
  "data": {
    "id": "cur_usd001",
    "tenantId": "ten_abc123xyz",
    "code": "USD",
    "symbol": "$",
    "name": "US Dollar",
    "exchangeRate": 1.0,
    "isActive": true,
    "createdAt": "2025-01-15T11:30:00.000Z"
  }
}
```

### 5.2 Create Vendor
**Endpoint:** `POST /{API_PREFIX}/{tenant}/vendors`  
**Auth:** Bearer (USER)  
**Description:** Register a new vendor/supplier

#### Request Body
```json
{
  "name": "TechCorp Suppliers Ltd",
  "companyCodeId": "cc_us1000",
  "purchasingOrgId": "porg_us1000",
  "purchasingGroupId": "pg_it100",
  "registrationNumber": "REG-12345",
  "taxId": "TAX-67890",
  "contactEmail": "procurement@techcorp.com",
  "contactPhone": "+1-555-0123",
  "website": "https://www.techcorp.com",
  "address": {
    "street": "789 Tech Blvd",
    "city": "San Francisco",
    "state": "CA",
    "zipCode": "94102",
    "country": "USA"
  },
  "bankDetails": {
    "bankName": "First National Bank",
    "accountNumber": "XXXX-XXXX-1234",
    "routingNumber": "123456789",
    "swift": "FNBAUS33"
  },
  "businessType": "IT Equipment & Services",
  "yearEstablished": 2010,
  "employeeCount": 250,
  "annualRevenue": 50000000,
  "certifications": ["ISO 9001", "ISO 27001"],
  "insuranceInfo": {
    "provider": "Global Insurance Co",
    "policyNumber": "POL-98765",
    "expiryDate": "2025-12-31"
  }
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Vendor created successfully",
  "data": {
    "id": "ven_tech001",
    "tenantId": "ten_abc123xyz",
    "name": "TechCorp Suppliers Ltd",
    "companyCodeId": "cc_us1000",
    "purchasingOrgId": "porg_us1000",
    "purchasingGroupId": "pg_it100",
    "registrationNumber": "REG-12345",
    "taxId": "TAX-67890",
    "contactEmail": "procurement@techcorp.com",
    "contactPhone": "+1-555-0123",
    "website": "https://www.techcorp.com",
    "address": {
      "street": "789 Tech Blvd",
      "city": "San Francisco",
      "state": "CA",
      "zipCode": "94102",
      "country": "USA"
    },
    "bankDetails": {
      "bankName": "First National Bank",
      "accountNumber": "XXXX-XXXX-1234",
      "routingNumber": "123456789",
      "swift": "FNBAUS33"
    },
    "businessType": "IT Equipment & Services",
    "yearEstablished": 2010,
    "employeeCount": 250,
    "annualRevenue": 50000000,
    "certifications": ["ISO 9001", "ISO 27001"],
    "insuranceInfo": {
      "provider": "Global Insurance Co",
      "policyNumber": "POL-98765",
      "expiryDate": "2025-12-31"
    },
    "status": "ACTIVE",
    "rating": 0,
    "createdAt": "2025-01-15T11:40:00.000Z"
  }
}
```

### 5.3 Get Master Data Summary
**Endpoint:** `GET /{API_PREFIX}/{tenant}/master-data/summary`  
**Auth:** Bearer  
**Description:** Get statistics of all configured master data

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Master data summary retrieved",
  "data": {
    "summary": {
      "companyCodes": 1,
      "plants": 1,
      "storageLocations": 1,
      "purchasingOrgs": 1,
      "purchasingGroups": 1,
      "activeVendors": 1,
      "activeCurrencies": 3,
      "orgUnits": 5
    },
    "lastUpdated": "2025-01-15T11:40:00.000Z"
  }
}
```

---

## 6. User Management

### 6.1 Create User Account
**Endpoint:** `POST /{API_PREFIX}/{tenant}/auth/register`  
**Auth:** Bearer (ADMIN)  
**Description:** Create a new user with specified role

#### Request Body
```json
{
  "email": "buyer@acme.com",
  "username": "johnbuyer",
  "password": "SecurePassword456!",
  "firstName": "John",
  "lastName": "Buyer",
  "role": "BUYER",
  "departmentId": "dept_procurement",
  "companyCodeId": "cc_us1000",
  "purchasingGroupId": "pg_it100"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "User created successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "usr_buyer001",
      "email": "buyer@acme.com",
      "username": "johnbuyer",
      "firstName": "John",
      "lastName": "Buyer",
      "role": "BUYER",
      "departmentId": "dept_procurement",
      "companyCodeId": "cc_us1000",
      "purchasingGroupId": "pg_it100",
      "abilities": [
        {
          "actions": ["create", "read", "update"],
          "subjects": ["PurchaseRequisition"],
          "conditions": { "creatorId": "{{userId}}" }
        },
        {
          "actions": ["create", "read"],
          "subjects": ["PurchaseOrder"]
        },
        {
          "actions": ["read", "update"],
          "subjects": ["Vendor"]
        }
      ],
      "tenantId": "ten_abc123xyz",
      "isActive": true,
      "isVerified": true,
      "createdAt": "2025-01-15T12:00:00.000Z"
    }
  }
}
```

---

## 7. Configuration Validation

### 7.1 Validate Master Data References
**Endpoint:** `POST /{API_PREFIX}/{tenant}/master-data/validate`  
**Auth:** Bearer  
**Description:** Validate consistency of master data references

#### Request Body
```json
{
  "companyCodeId": "cc_us1000",
  "plantId": "plt_man1001",
  "storageLocationId": "sl_wh001",
  "purchasingOrgId": "porg_us1000",
  "purchasingGroupId": "pg_it100"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Validation completed",
  "data": {
    "valid": true,
    "errors": [],
    "warnings": [],
    "validations": {
      "companyCode": {
        "exists": true,
        "active": true
      },
      "plant": {
        "exists": true,
        "belongsToCompanyCode": true
      },
      "storageLocation": {
        "exists": true,
        "belongsToPlant": true
      },
      "purchasingOrg": {
        "exists": true,
        "assignedToCompanyCode": true
      },
      "purchasingGroup": {
        "exists": true,
        "belongsToPurchasingOrg": true
      }
    }
  }
}
```

#### Response (200 OK - With Errors)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Validation completed with errors",
  "data": {
    "valid": false,
    "errors": [
      "Storage location 'sl_wh001' does not belong to plant 'plt_man1001'",
      "Purchasing group 'pg_it100' is not assigned to purchasing org 'porg_us1000'"
    ],
    "warnings": [
      "Company code 'cc_us1000' has no active purchasing organization assignment"
    ],
    "validations": {
      "companyCode": {
        "exists": true,
        "active": true
      },
      "plant": {
        "exists": true,
        "belongsToCompanyCode": true
      },
      "storageLocation": {
        "exists": true,
        "belongsToPlant": false
      },
      "purchasingOrg": {
        "exists": true,
        "assignedToCompanyCode": false
      },
      "purchasingGroup": {
        "exists": true,
        "belongsToPurchasingOrg": false
      }
    }
  }
}
```

---

## Configuration Flow Summary

### Complete Setup Sequence
1. **Provision Tenant** → Create organization and admin
2. **Login** → Obtain authentication token
3. **Basis Configuration** → Set up org structure and processes
4. **Organizational Structure** → Create hierarchy (Company Codes → Plants → Storage Locations)
5. **Purchasing Structure** → Create Purchasing Orgs → Groups and assignments
6. **Master Data** → Configure currencies, vendors, and other reference data
7. **User Management** → Create users with appropriate roles
8. **Validation** → Verify all configurations are consistent

### Next Steps After Configuration
Once configuration is complete, the system is ready for:
- **Transaction Processing** (see TRANSACTION_PROCESS_FLOW.md)
- **Procurement Workflows** (Contract → PR → PO → GR → Invoice → Payment)
- **Tender Workflows** (Create → Publish → Bid → Evaluate → Award)

---

## Error Handling

### Common Error Codes
- **400** - Bad Request (validation errors, missing required fields)
- **401** - Unauthorized (missing or invalid JWT)
- **403** - Forbidden (insufficient role permissions)
- **404** - Not Found (entity doesn't exist)
- **409** - Conflict (duplicate codes, violates uniqueness)

### Standard Error Response Format
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Configuration validation failed",
  "errors": [
    "Company code with code 'CC1000' already exists",
    "Purchasing group must belong to a purchasing organization"
  ]
}
```

---

## Rate Limiting
Configuration endpoints are subject to role-based rate limiting:
- **ADMIN**: 5000 requests/hour
- **USER**: 2000 requests/hour

Rate limit headers:
```
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4987
X-RateLimit-Reset: 1640998800
```
