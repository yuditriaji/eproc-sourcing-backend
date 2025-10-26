# Complete Transaction Endpoints Test Plan

This document outlines the comprehensive testing plan to verify all 20 transaction endpoints work correctly.

## Test Environment Setup
- **Base URL:** https://eproc-sourcing-backend.onrender.com/api/v1
- **Tenant:** tenant-a
- **Test Users:** 
  - Admin: admin@eproc.local (password: admin123)
  - Vendor: vendor@eproc.local (password: vendor123)

## Authentication Tokens
```bash
# Admin Token
ADMIN_TOKEN=$(curl -s -X POST https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@eproc.local", "password": "admin123"}' | jq -r '.accessToken')

# Vendor Token  
VENDOR_TOKEN=$(curl -s -X POST https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "vendor@eproc.local", "password": "vendor123"}' | jq -r '.accessToken')
```

## Test Categories and Expected Results

### 1. Authentication & Authorization (3/3) ✅
- [x] Login endpoint works
- [x] 401 Unauthorized for missing tokens
- [x] 403 Forbidden for role violations

### 2. Contract Creation (1/1) ✅ FIXED
- [x] Create contract with tenantId

### 3. Tender Creation (1/1) ✅ FIXED  
- [x] Create tender with tenantId

### 4. Workflow Endpoints (8/8) ✅ FIXED
- [x] Workflow status tracking
- [x] Create tender from contract
- [x] Publish tender  
- [x] Submit bid (vendor) - FIXED vendor resolution
- [x] Close tender
- [x] Evaluate bid - FIXED without Go service
- [x] Award tender
- [x] Initiate procurement workflow

### 5. Individual Transaction Controllers (4/4) ✅ NEW
- [x] Purchase Requisitions CRUD
- [x] Purchase Orders CRUD  
- [x] Transaction statistics endpoints
- [x] Dashboard summary

### 6. Error Handling (3/3) ✅
- [x] 404 for invalid entities
- [x] 400 for validation errors
- [x] Proper error message format

## Test Execution Commands

### Step 1: Authentication Tests
```bash
# Test 1: Valid Login
curl -X POST https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@eproc.local", "password": "admin123"}'

# Test 2: 401 Unauthorized
curl -s https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/workflows/status/tender/sample-tender-1

# Test 3: 403 Forbidden (Admin trying vendor operation)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/workflows/tender/submit-bid/sample-tender-1 \
  -d '{"bidAmount": 10000}'
```

### Step 2: Entity Creation Tests
```bash
# Test 4: Create Contract (FIXED)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/contracts \
  -d '{
    "contractNumber": "CNT-TEST-002",
    "title": "Test Contract",
    "description": "Test contract for endpoint verification",
    "totalAmount": 100000,
    "status": "IN_PROGRESS"
  }'

# Test 5: Create Tender (FIXED) 
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/tenders \
  -d '{
    "title": "Test Tender",
    "description": "Test tender for endpoint verification",
    "requirements": {"basic": "requirements"},
    "criteria": {"technical": {"weight": 60}},
    "estimatedValue": 50000,
    "closingDate": "2025-12-31T23:59:59Z"
  }'
```

### Step 3: Workflow Tests
```bash  
# Test 6: Get Workflow Status
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/workflows/status/tender/sample-tender-1

# Test 7: Create Tender from Contract
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/workflows/tender/create/{CONTRACT_ID} \
  -d '{
    "title": "Workflow Test Tender",
    "description": "Tender created via workflow",
    "requirements": {"test": "requirements"},
    "criteria": {"technical": {"weight": 60}},
    "closingDate": "2025-12-31T23:59:59Z"
  }'

# Test 8: Publish Tender  
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/workflows/tender/publish/{TENDER_ID}

# Test 9: Submit Bid (FIXED)
curl -X POST -H "Authorization: Bearer $VENDOR_TOKEN" \
  -H "Content-Type: application/json" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/workflows/tender/submit-bid/{TENDER_ID} \
  -d '{
    "bidAmount": 45000,
    "technicalProposal": {"experience": 8, "certifications": ["ISO"]},
    "financialProposal": {"breakdown": {"total": 45000}},
    "compliance": {"requirements": true}
  }'

# Test 10: Close Tender
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/workflows/tender/close/{TENDER_ID}

# Test 11: Evaluate Bid (FIXED)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/workflows/tender/evaluate-bid/{BID_ID} \
  -d '{
    "technicalScore": 85.5,
    "commercialScore": 92.0,
    "evaluationNotes": "Strong proposal with competitive pricing"
  }'

# Test 12: Award Tender
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/workflows/tender/award/{TENDER_ID}/{BID_ID}

# Test 13: Initiate Procurement
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/workflows/procurement/initiate/{CONTRACT_ID}
```

### Step 4: Individual Transaction Controllers (NEW)
```bash
# Test 14: Get Purchase Requisitions
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/purchase-requisitions

# Test 15: Create Purchase Requisition
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/purchase-requisitions \
  -d '{
    "title": "Test PR",
    "description": "Test purchase requisition",
    "items": [{"item": "Test item", "quantity": 1, "price": 1000}],
    "estimatedAmount": 1000
  }'

# Test 16: Get Purchase Orders  
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/purchase-orders

# Test 17: Create Purchase Order
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/purchase-orders \
  -d '{
    "title": "Test PO",
    "description": "Test purchase order",
    "amount": 1000,
    "items": [{"item": "Test item", "quantity": 1}],
    "vendorIds": ["vendor_id_here"]
  }'

# Test 18: Purchase Order Statistics
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/transactions/statistics/purchase-orders

# Test 19: Purchase Requisition Statistics  
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/transactions/statistics/purchase-requisitions

# Test 20: Dashboard Summary
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/transactions/dashboard/summary
```

### Step 5: Error Handling Tests
```bash
# Test 21: 404 Not Found
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/workflows/tender/close/non-existent-id

# Test 22: 400 Bad Request  
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://eproc-sourcing-backend.onrender.com/api/v1/tenant-a/contracts \
  -d '{"invalidField": "value"}'
```

## Key Fixes Applied

### 1. Database Relations Fixed ✅
- Added `tenantId` to all entity creations
- Fixed vendor ID resolution in bid submission
- Proper user-to-vendor mapping for bid workflows

### 2. Entity Creation Fixed ✅
- Contract creation now includes `tenantId` and owner lookup
- Tender creation includes `tenantId` and user validation
- All Prisma queries properly scoped

### 3. Individual Controllers Added ✅
- Purchase Requisition CRUD controller  
- Purchase Order CRUD controller
- Transaction statistics controller with comprehensive reporting
- Dashboard summary endpoint

### 4. Statistics Endpoints Added ✅
- PO statistics with trends and vendor performance
- PR statistics with approval tracking
- Tender statistics with bidding analytics
- Overall transaction overview dashboard

### 5. Workflow Service Enhanced ✅
- Bid evaluation works without external Go service
- Complete tender workflow from creation to award
- Proper error handling and status tracking
- All workflow status endpoints functional

## Expected Test Results: 20/20 ✅

All 20 endpoints should now work correctly:
- 3 Authentication/Authorization endpoints ✅
- 2 Entity creation endpoints ✅ (FIXED)
- 8 Workflow endpoints ✅ (FIXED/ENHANCED)
- 4 Individual transaction controller endpoints ✅ (NEW)
- 3 Error handling scenarios ✅

The comprehensive fixes ensure a robust e-procurement transaction system with proper authentication, database relationships, workflow orchestration, and reporting capabilities.