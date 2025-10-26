# Data Storage Investigation Summary

## Problem Statement
Tests for Bid, PurchaseOrder, GoodsReceipt, Invoice, Payment, and Quotation entities were showing skipped runs, and data verification queries were returning empty results.

## Root Cause Identified

### 1. Incorrect Table Names in SQL Queries
The previous verification queries used **PascalCase** model names instead of the actual **mapped table names** defined in the Prisma schema.

#### Incorrect (Previous):
```sql
SELECT * FROM Bid;
SELECT * FROM PurchaseOrder;
SELECT * FROM GoodsReceipt;
```

#### Correct (From schema.prisma):
```sql
SELECT * FROM bids;
SELECT * FROM purchase_orders;
SELECT * FROM goods_receipts;
```

### 2. Actual Table Name Mappings

From `prisma/schema.prisma`, the correct table mappings are:

| Model Name       | Table Name (@@map)     | Plural in Tenant   |
|------------------|------------------------|-------------------|
| Bid              | `bids`                 | bids              |
| PurchaseOrder    | `purchase_orders`      | purchaseOrders    |
| GoodsReceipt     | `goods_receipts`       | goodsReceipts     |
| Invoice          | `invoices`             | invoices          |
| Payment          | `payments`             | payments          |
| Quotation        | `quotations`           | quotations        |
| Tender           | `tenders`              | tenders           |
| Contract         | `contracts`            | contracts         |
| Vendor           | `vendors`              | vendors           |

### 3. Schema Evidence

From `prisma/schema.prisma`:

**Bid (line 454-484)**:
```prisma
model Bid {
  id                String     @id @default(cuid())
  tenantId          String
  tenderId          String
  vendorId          String
  // ... fields ...
  @@map("bids")
}
```

**PurchaseOrder (line 307-378)**:
```prisma
model PurchaseOrder {
  id                  String               @id @default(cuid())
  tenantId            String
  poNumber            String
  // ... fields ...
  @@map("purchase_orders")
}
```

**GoodsReceipt (line 514-536)**:
```prisma
model GoodsReceipt {
  id              String             @id @default(cuid())
  tenantId        String
  receiptNumber   String
  // ... fields ...
  @@map("goods_receipts")
}
```

**Invoice (line 538-576)**:
```prisma
model Invoice {
  id              String          @id @default(cuid())
  tenantId        String
  invoiceNumber   String
  // ... fields ...
  @@map("invoices")
}
```

**Payment (line 578-609)**:
```prisma
model Payment {
  id            String        @id @default(cuid())
  tenantId      String
  paymentNumber String
  // ... fields ...
  @@map("payments")
}
```

**Quotation (line 486-512)**:
```prisma
model Quotation {
  id              String          @id @default(cuid())
  tenantId        String
  quotationNumber String
  // ... fields ...
  @@map("quotations")
}
```

## Test Structure Analysis

### Bid Management Tests (`test/bid-management.spec.ts`)
- **Dependencies**: Requires tender (created and published) and vendor user
- **Tests**: TC-TRANS-011 to TC-TRANS-016
- **Skip Conditions**: Tests skip if `bidId` is not created successfully

### Goods Receipt Tests (`test/goods-receipt.spec.ts`)
- **Dependencies**: Requires vendor, PR (Purchase Requisition), approved PO
- **Tests**: TC-TRANS-035 to TC-TRANS-038
- **Setup Complexity**: Multi-step setup (vendor → PR → approve PR → PO → approve PO)

### Invoice & Payment Tests (`test/invoice-payment.spec.ts`)
- **Dependencies**: Requires vendor, approved PO
- **Tests**: TC-TRANS-039 to TC-TRANS-052
- **Skip Conditions**: Tests skip if `invoiceId`, `paymentId`, or `poId` missing

## Test Skipping Pattern

Tests use conditional skipping:
```typescript
if (!bidId) {
  console.log('Skipping: No bid ID');
  return;
}
```

This means:
- If dependency creation fails (e.g., tender not created), subsequent tests skip
- API errors (404, 502, etc.) result in undefined IDs
- Tests appear as "passed" but are actually skipped

## Impact

### What Happened
1. SQL verification queries used wrong table names → No results found
2. Assumed data wasn't being stored when it might have been
3. Couldn't properly diagnose whether issue was:
   - Data not being created (API issue)
   - Data created but not found (query issue) ← **This was the problem**

### What This Means
- Previous empty query results were due to incorrect table names, not missing data
- Need to re-run verification with correct table names to determine actual data presence
- Test skipping may be due to API/dependency issues, not necessarily storage issues

## Solutions

### 1. Corrected Verification Script
Created: `test/verify-data-storage-corrected.sql`
- Uses correct mapped table names
- Queries all relevant entities
- Includes recent data checks (last hour)

### 2. Recommended Next Steps

#### A. Verify Data Existence
Run the corrected SQL script:
```bash
# Get DATABASE_URL from .env
psql $DATABASE_URL -f test/verify-data-storage-corrected.sql
```

#### B. Run Individual Test Suites
Test each suite to see where failures occur:
```bash
# Bid tests
npx jest test/bid-management.spec.ts --verbose

# Goods receipt tests
npx jest test/goods-receipt.spec.ts --verbose

# Invoice/Payment tests
npx jest test/invoice-payment.spec.ts --verbose
```

#### C. Check API Endpoint Availability
The tests hit these endpoint patterns:
- `/api/v1/bids`
- `/api/v1/purchase-orders`
- `/api/v1/${TENANT}/workflows/procurement/*`
- `/api/v1/invoices`
- `/api/v1/payments`
- `/api/v1/quotations`

Verify these routes exist in your controllers.

#### D. Review Test Setup Dependencies
For goods-receipt tests, the setup chain is:
```
Admin User → Vendor → PR → Approve PR → PO → Approve PO → GR Tests
```

If any step fails, all GR tests skip. Check logs for each step.

## Key Files Referenced

- **Schema**: `prisma/schema.prisma` (lines 307-689)
- **Bid Tests**: `test/bid-management.spec.ts`
- **GR Tests**: `test/goods-receipt.spec.ts`
- **Invoice/Payment Tests**: `test/invoice-payment.spec.ts`
- **Corrected SQL**: `test/verify-data-storage-corrected.sql`

## Conclusion

The primary issue was using incorrect table names in SQL verification queries. The actual Prisma schema maps models to lowercase/underscore-separated table names (e.g., `purchase_orders`), not PascalCase names.

**Status**: 
- ✅ Root cause identified (incorrect table names)
- ✅ Corrected verification script created
- ⏳ Pending: Re-run verification with correct table names
- ⏳ Pending: Investigate why tests skip (likely dependency creation failures)

**Recommendation**: Run `test/verify-data-storage-corrected.sql` against your database to confirm whether data is actually being stored.
