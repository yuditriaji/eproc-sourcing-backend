# Root Cause Analysis: Why Tables Are Empty

## Executive Summary

**Primary Issue**: Tests are calling incorrect API endpoints that don't exist, resulting in 404 errors and no data being stored in the database.

**Impact**: Tables for Bid, Invoice, Payment, Quotation, PurchaseOrder, and GoodsReceipt remain empty because the API calls fail before reaching the database layer.

---

## Root Causes Identified

### 1. **Missing Tenant Parameter in Test URLs** ⚠️ CRITICAL

#### The Problem
All controllers require a `:tenant` parameter in the route, but tests are calling routes **without** this parameter.

#### Controller Routes (Actual Implementation)
```typescript
// Bid Controller
@Controller(":tenant/bids")  // ← Requires tenant!

// Tender Controller  
@Controller(":tenant/tenders")  // ← Requires tenant!

// Vendor Controller
@Controller(":tenant/vendors")  // ← Requires tenant!

// Purchase Order Controller
@Controller(":tenant/purchase-orders")  // ← Requires tenant!

// Workflow Controller (for Goods Receipts)
@Controller(":tenant/workflows")  // ← Requires tenant!
```

#### Test URLs (What Tests Are Calling)
```typescript
// bid-management.spec.ts
client.post('/bids', bidData, ...)          // ❌ Missing tenant
client.post('/tenders', tenderData, ...)     // ❌ Missing tenant

// invoice-payment.spec.ts
client.post('/vendors', vendorData, ...)     // ❌ Missing tenant
client.post('/purchase-orders', poData, ...) // ❌ Missing tenant
client.post('/invoices', invoiceData, ...)   // ❌ Missing tenant
client.post('/payments', paymentData, ...)   // ❌ Missing tenant

// goods-receipt.spec.ts
client.post(`${API_URL}/${TENANT}/workflows/procurement/goods-receipt/${testPO.id}`, ...) // ✅ Correct!
```

#### Result
- Requests return **404 Not Found**
- No data reaches the service layer
- No database operations occur
- Tables remain empty

---

### 2. **Missing Controllers for Invoice, Payment, Quotation** ❌

#### Controllers That Exist
✅ BidController (`src/modules/bid/bid.controller.ts`)
✅ TenderController (`src/modules/tender/tender.controller.ts`)
✅ VendorController (`src/modules/vendor/vendor.controller.ts`)
✅ PurchaseOrderController (`src/modules/purchase-order/purchase-order.controller.ts`)
✅ WorkflowController (`src/modules/workflow/workflow.controller.ts`)

#### Controllers That Are MISSING
❌ **InvoiceController** - No file found
❌ **PaymentController** - No file found
❌ **QuotationController** - No file found
❌ **GoodsReceiptController** - No file found (uses WorkflowController instead)

#### Impact
Even if tests used correct URLs with tenant parameter:
- `/test-tenant/invoices` → **404** (no controller)
- `/test-tenant/payments` → **404** (no controller)
- `/test-tenant/quotations` → **404** (no controller)

---

### 3. **Test URL Pattern Inconsistency**

#### Different Patterns Used
```typescript
// Pattern 1: Direct route (missing tenant) - WRONG
client.post('/bids', ...)
client.post('/invoices', ...)

// Pattern 2: With tenant constant - CORRECT
const TENANT = 'test-tenant';
client.post(`${API_URL}/${TENANT}/workflows/...`, ...)

// Pattern 3: Dynamic tenant - CORRECT (if implemented)
client.post(`/${tenantId}/bids`, ...)
```

Only **goods-receipt.spec.ts** uses the correct pattern with tenant parameter.

---

## Detailed Breakdown by Entity

### **Bids** 🔴

**Test Code**:
```typescript
// bid-management.spec.ts line 97
const response = await client.post('/bids', bidData, {
  headers: { Authorization: `Bearer ${vendorToken}` },
});
```

**Actual Route**:
```typescript
// bid.controller.ts line 99
@Controller(":tenant/bids")
```

**What Should Be**:
```typescript
const response = await client.post('/test-tenant/bids', bidData, {
  headers: { Authorization: `Bearer ${vendorToken}` },
});
```

**Result**: 404 → No bids created → `bids` table empty

---

### **Tenders** 🔴

**Test Code**:
```typescript
// bid-management.spec.ts line 43
const tenderRes = await client.post('/tenders', {...}, ...);
```

**Actual Route**:
```typescript
// tender.controller.ts line 158
@Controller(":tenant/tenders")
```

**What Should Be**:
```typescript
const tenderRes = await client.post('/test-tenant/tenders', {...}, ...);
```

**Result**: 404 → No tenders created → Test dependencies fail → All bid tests skip

---

### **Vendors** 🔴

**Test Code**:
```typescript
// invoice-payment.spec.ts line 44
const vendorRes = await client.post('/vendors', {...}, ...);
```

**Actual Route**:
```typescript
// vendor.controller.ts line 177
@Controller(":tenant/vendors")
```

**What Should Be**:
```typescript
const vendorRes = await client.post('/test-tenant/vendors', {...}, ...);
```

**Result**: 404 → No vendor created → `vendorId` undefined → All invoice/payment tests skip

---

### **Purchase Orders** 🔴

**Test Code**:
```typescript
// invoice-payment.spec.ts line 74
const poRes = await client.post('/purchase-orders', {...}, ...);
```

**Actual Route**:
```typescript
// purchase-order.controller.ts line 28
@Controller(":tenant/purchase-orders")
```

**What Should Be**:
```typescript
const poRes = await client.post('/test-tenant/purchase-orders', {...}, ...);
```

**Result**: 404 → No PO created → `poId` undefined → Tests skip → `purchase_orders` table empty

---

### **Goods Receipts** ✅ CORRECT!

**Test Code**:
```typescript
// goods-receipt.spec.ts line 150
const response = await axios.post(
  `${API_URL}/${TENANT}/workflows/procurement/goods-receipt/${testPO.id}`,
  grData,
  { headers: { Authorization: `Bearer ${adminToken}` } },
);
```

**Actual Route**:
```typescript
// workflow.controller.ts line 28, 245
@Controller(":tenant/workflows")
@Post("procurement/goods-receipt/:poId")
```

**Result**: ✅ Correct route! BUT depends on PO being created first (which fails due to missing tenant in PO creation)

---

### **Invoices** ❌ NO CONTROLLER

**Test Code**:
```typescript
// invoice-payment.spec.ts line 129
const response = await client.post('/invoices', invoiceData, {...});
```

**Actual Route**: **DOES NOT EXIST**

**Missing**: `src/modules/invoice/invoice.controller.ts`

**Result**: 404 (even with tenant, no controller exists) → `invoices` table empty

---

### **Payments** ❌ NO CONTROLLER

**Test Code**:
```typescript
// invoice-payment.spec.ts line 379
const response = await client.post('/payments', paymentData, {...});
```

**Actual Route**: **DOES NOT EXIST**

**Missing**: `src/modules/payment/payment.controller.ts`

**Result**: 404 (even with tenant, no controller exists) → `payments` table empty

---

### **Quotations** ❌ NO CONTROLLER

**Test Code**:
```typescript
// Expected: client.post('/quotations', ...)
```

**Actual Route**: **DOES NOT EXIST**

**Missing**: `src/modules/quotation/quotation.controller.ts`

**Result**: No endpoint available → `quotations` table empty

---

## Summary Table

| Entity | Controller Exists | Tenant Required | Test Uses Tenant | Result | Table Status |
|--------|------------------|-----------------|------------------|--------|-------------|
| Bid | ✅ Yes | ✅ Yes | ❌ No | 404 Error | Empty |
| Tender | ✅ Yes | ✅ Yes | ❌ No | 404 Error | - |
| Vendor | ✅ Yes | ✅ Yes | ❌ No | 404 Error | - |
| PurchaseOrder | ✅ Yes | ✅ Yes | ❌ No | 404 Error | Empty |
| GoodsReceipt | ✅ Yes (Workflow) | ✅ Yes | ✅ Yes | Depends on PO | Empty |
| Invoice | ❌ No | N/A | ❌ No | 404 Error | Empty |
| Payment | ❌ No | N/A | ❌ No | 404 Error | Empty |
| Quotation | ❌ No | N/A | N/A | 404 Error | Empty |

---

## Solutions

### Solution 1: Fix Test URLs (Quick Fix) 🔧

Update all test files to include tenant parameter:

#### bid-management.spec.ts
```typescript
const TENANT = 'test-tenant';

// Before
client.post('/bids', ...)
client.post('/tenders', ...)

// After
client.post(`/${TENANT}/bids`, ...)
client.post(`/${TENANT}/tenders`, ...)
```

#### invoice-payment.spec.ts
```typescript
const TENANT = 'test-tenant';

// Before
client.post('/vendors', ...)
client.post('/purchase-orders', ...)

// After
client.post(`/${TENANT}/vendors`, ...)
client.post(`/${TENANT}/purchase-orders`, ...)
```

### Solution 2: Create Missing Controllers (Required) 🏗️

Create these controller files:

#### A. InvoiceController
```bash
# Create structure
mkdir -p src/modules/invoice
touch src/modules/invoice/invoice.controller.ts
touch src/modules/invoice/invoice.service.ts
touch src/modules/invoice/invoice.module.ts
```

```typescript
// src/modules/invoice/invoice.controller.ts
import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller(':tenant/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async create(@Body() createDto: any, @Request() req: any) {
    return this.invoiceService.create(createDto, req.user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FINANCE, UserRole.VENDOR)
  async findAll(@Request() req: any) {
    return this.invoiceService.findAll(req.user.role, req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.invoiceService.findOne(id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  async approve(@Param('id') id: string, @Body() dto: any) {
    return this.invoiceService.approve(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  async updateStatus(@Param('id') id: string, @Body() dto: { status: string }) {
    return this.invoiceService.updateStatus(id, dto.status);
  }
}
```

#### B. PaymentController
```bash
mkdir -p src/modules/payment
touch src/modules/payment/payment.controller.ts
touch src/modules/payment/payment.service.ts
touch src/modules/payment/payment.module.ts
```

```typescript
// src/modules/payment/payment.controller.ts
import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller(':tenant/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  async create(@Body() createDto: any, @Request() req: any) {
    return this.paymentService.create(createDto, req.user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FINANCE, UserRole.VENDOR)
  async findAll(@Request() req: any) {
    return this.paymentService.findAll(req.user.role, req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.paymentService.findOne(id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  async approve(@Param('id') id: string, @Body() dto: any) {
    return this.paymentService.approve(id, dto);
  }

  @Patch(':id/process')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  async process(@Param('id') id: string, @Body() dto: any) {
    return this.paymentService.process(id, dto);
  }
}
```

#### C. QuotationController
```bash
mkdir -p src/modules/quotation
touch src/modules/quotation/quotation.controller.ts
touch src/modules/quotation/quotation.service.ts
touch src/modules/quotation/quotation.module.ts
```

### Solution 3: Register Modules in AppModule 📝

```typescript
// src/app.module.ts
import { InvoiceModule } from './modules/invoice/invoice.module';
import { PaymentModule } from './modules/payment/payment.module';
import { QuotationModule } from './modules/quotation/quotation.module';

@Module({
  imports: [
    // ... existing modules
    InvoiceModule,
    PaymentModule,
    QuotationModule,
  ],
})
export class AppModule {}
```

---

## Implementation Priority

### Phase 1: Quick Wins (Fix Tests) - 1-2 hours
1. ✅ Add `TENANT` constant to all test files
2. ✅ Update all API calls to include `/${TENANT}/` prefix
3. ✅ Run tests to verify existing endpoints work

### Phase 2: Create Missing Controllers - 4-8 hours
1. ✅ Implement InvoiceController + Service
2. ✅ Implement PaymentController + Service
3. ✅ Implement QuotationController + Service
4. ✅ Register modules in AppModule
5. ✅ Run tests to verify new endpoints work

### Phase 3: Verification - 1 hour
1. ✅ Run corrected SQL verification script
2. ✅ Check table counts
3. ✅ Verify data integrity

---

## Expected Outcomes After Fix

### Before Fix
```sql
SELECT 'bids' as table_name, COUNT(*) as count FROM bids
-- Result: 0

SELECT 'invoices', COUNT(*) FROM invoices
-- Result: 0

SELECT 'payments', COUNT(*) FROM payments
-- Result: 0
```

### After Fix
```sql
SELECT 'bids' as table_name, COUNT(*) as count FROM bids
-- Result: > 0 (from bid-management tests)

SELECT 'invoices', COUNT(*) FROM invoices
-- Result: > 0 (from invoice-payment tests)

SELECT 'payments', COUNT(*) FROM payments
-- Result: > 0 (from invoice-payment tests)
```

---

## Verification Commands

### 1. Test Individual Suites
```bash
# Test bids (after fixing tenant param)
npx jest test/bid-management.spec.ts --verbose

# Test goods receipts (already has tenant)
npx jest test/goods-receipt.spec.ts --verbose

# Test invoices/payments (after creating controllers)
npx jest test/invoice-payment.spec.ts --verbose
```

### 2. Check Database
```bash
# Run corrected verification SQL
psql $DATABASE_URL -f test/verify-data-storage-corrected.sql

# Or check counts directly
psql $DATABASE_URL -c "SELECT 'bids', COUNT(*) FROM bids UNION ALL SELECT 'invoices', COUNT(*) FROM invoices UNION ALL SELECT 'payments', COUNT(*) FROM payments;"
```

### 3. Check API Endpoints
```bash
# List all registered routes
npm run start:dev
# Then check logs for registered routes

# Or test endpoints directly
curl -X GET http://localhost:3000/health
curl -X GET http://localhost:3000/api/v1/test-tenant/bids \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Conclusion

**Root Cause**: Tests calling incorrect URLs without tenant parameter + missing controllers

**Impact**: 404 errors → No data stored → Empty tables

**Solution**: 
1. Fix test URLs to include tenant parameter (quick fix)
2. Create missing Invoice, Payment, Quotation controllers (required for full functionality)
3. Verify with SQL queries and re-run tests

**Estimated Time**: 5-11 hours total for complete fix
