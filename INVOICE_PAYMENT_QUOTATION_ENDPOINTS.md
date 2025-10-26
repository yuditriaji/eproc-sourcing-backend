# Invoice, Payment & Quotation Endpoints Documentation

## Overview

This document provides comprehensive information about the Invoice, Payment, and Quotation endpoints, including how to test them and verify data storage.

## Endpoints Summary

### Invoice Endpoints
- `POST /{tenant}/invoices` - Create invoice
- `GET /{tenant}/invoices` - List all invoices (with pagination and filtering)
- `GET /{tenant}/invoices/{id}` - Get invoice by ID
- `GET /{tenant}/invoices/{id}/items` - Get invoice items
- `PATCH /{tenant}/invoices/{id}` - Update invoice
- `PATCH /{tenant}/invoices/{id}/approve` - Approve invoice
- `PATCH /{tenant}/invoices/{id}/mark-paid` - Mark invoice as paid
- `PATCH /{tenant}/invoices/{id}/dispute` - Dispute invoice
- `PATCH /{tenant}/invoices/{id}/cancel` - Cancel invoice
- `DELETE /{tenant}/invoices/{id}` - Delete invoice

### Payment Endpoints
- `POST /{tenant}/payments` - Create payment
- `GET /{tenant}/payments` - List all payments (with pagination and filtering)
- `GET /{tenant}/payments/{id}` - Get payment by ID
- `PATCH /{tenant}/payments/{id}` - Update payment
- `PATCH /{tenant}/payments/{id}/approve` - Approve payment
- `PATCH /{tenant}/payments/{id}/process` - Process payment
- `PATCH /{tenant}/payments/{id}/receive` - Mark payment as received
- `PATCH /{tenant}/payments/{id}/fail` - Mark payment as failed
- `PATCH /{tenant}/payments/{id}/cancel` - Cancel payment
- `DELETE /{tenant}/payments/{id}` - Delete payment

### Quotation Endpoints
- `POST /{tenant}/quotations` - Create quotation
- `GET /{tenant}/quotations` - List all quotations (with pagination)
- `GET /{tenant}/quotations/{id}` - Get quotation by ID
- `PATCH /{tenant}/quotations/{id}` - Update quotation
- `DELETE /{tenant}/quotations/{id}` - Delete quotation

## Database Tables

The endpoints store data in the following PostgreSQL tables:
- `invoices` - Invoice records
- `payments` - Payment records
- `quotations` - Quotation records

All tables include:
- Soft delete support (`deletedAt` field)
- Tenant isolation (`tenantId` field)
- Audit timestamps (`createdAt`, `updatedAt`)

## Testing the Endpoints

### Method 1: Run Automated Tests

```bash
# Run all invoice and payment tests
npx jest test/invoice-payment.spec.ts --verbose

# Run endpoint storage verification test
npx jest test/verify-endpoints-storage.spec.ts --verbose

# Run all tests
npm test
```

### Method 2: Manual Testing with cURL

#### 1. Register and Login

```bash
# Register admin user
curl -X POST https://eproc-sourcing-backend.onrender.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "username": "admin",
    "password": "Admin@12345",
    "role": "ADMIN"
  }'

# Login
curl -X POST https://eproc-sourcing-backend.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Admin@12345"
  }'

# Save the accessToken from response
export TOKEN="<your-access-token>"
```

#### 2. Create Vendor

```bash
curl -X POST https://eproc-sourcing-backend.onrender.com/api/v1/test-tenant/vendors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Vendor",
    "registrationNumber": "REG-001",
    "taxId": "TAX-001",
    "contactEmail": "vendor@test.com",
    "status": "ACTIVE"
  }'

# Save the vendor ID from response
export VENDOR_ID="<vendor-id>"
```

#### 3. Create Purchase Order

```bash
curl -X POST https://eproc-sourcing-backend.onrender.com/api/v1/test-tenant/purchase-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Test PO",
    "description": "Test Purchase Order",
    "amount": 10000,
    "items": [
      {"name": "Item A", "quantity": 1, "unitPrice": 5000},
      {"name": "Item B", "quantity": 1, "unitPrice": 5000}
    ]
  }'

# Save the PO ID
export PO_ID="<po-id>"

# Approve the PO
curl -X PATCH https://eproc-sourcing-backend.onrender.com/api/v1/test-tenant/purchase-orders/$PO_ID/approve \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Create Invoice

```bash
curl -X POST https://eproc-sourcing-backend.onrender.com/api/v1/test-tenant/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "invoiceNumber": "INV-001",
    "poId": "'$PO_ID'",
    "vendorId": "'$VENDOR_ID'",
    "amount": 10000,
    "taxAmount": 1000,
    "totalAmount": 11000,
    "items": [
      {
        "itemNumber": 1,
        "description": "Item A",
        "quantity": 1,
        "unitPrice": 5000,
        "totalAmount": 5000
      },
      {
        "itemNumber": 2,
        "description": "Item B",
        "quantity": 1,
        "unitPrice": 5000,
        "totalAmount": 5000
      }
    ],
    "dueDate": "2025-12-31T00:00:00.000Z",
    "notes": "Test invoice"
  }'

# Save the invoice ID
export INVOICE_ID="<invoice-id>"
```

#### 5. Create Payment

```bash
curl -X POST https://eproc-sourcing-backend.onrender.com/api/v1/test-tenant/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "paymentNumber": "PAY-001",
    "invoiceId": "'$INVOICE_ID'",
    "poId": "'$PO_ID'",
    "amount": 11000,
    "paymentType": "FULL",
    "method": "BANK_TRANSFER",
    "reference": "REF-001",
    "notes": "Test payment"
  }'
```

#### 6. Create Quotation

```bash
curl -X POST https://eproc-sourcing-backend.onrender.com/api/v1/test-tenant/quotations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "quotationNumber": "QUO-001",
    "vendorId": "'$VENDOR_ID'",
    "amount": 15000,
    "items": [
      {
        "itemNumber": 1,
        "description": "Service A",
        "quantity": 1,
        "unitPrice": 7500,
        "totalAmount": 7500
      }
    ],
    "validUntil": "2025-12-31T00:00:00.000Z",
    "notes": "Test quotation"
  }'
```

### Method 3: Using Swagger UI

Visit: `https://eproc-sourcing-backend.onrender.com/api/v1/docs`

1. Click "Authorize" and enter your bearer token
2. Navigate to Invoice, Payment, or Quotation sections
3. Try out the endpoints directly from the UI

## Verifying Data Storage

### Option 1: SQL Queries

Run the comprehensive verification script:

```bash
# Connect to your PostgreSQL database
psql $DATABASE_URL

# Run the verification script
\i test/verify-database-storage.sql
```

Key queries to check:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('invoices', 'payments', 'quotations');

-- Count active records
SELECT 
  'invoices' as table_name, 
  COUNT(*) as count 
FROM invoices 
WHERE "deletedAt" IS NULL

UNION ALL

SELECT 'payments', COUNT(*) 
FROM payments 
WHERE "deletedAt" IS NULL

UNION ALL

SELECT 'quotations', COUNT(*) 
FROM quotations 
WHERE "deletedAt" IS NULL;

-- View recent records
SELECT id, "invoiceNumber", status, "createdAt"
FROM invoices
WHERE "deletedAt" IS NULL
ORDER BY "createdAt" DESC
LIMIT 5;
```

### Option 2: API Endpoints

```bash
# List all invoices
curl -X GET "https://eproc-sourcing-backend.onrender.com/api/v1/test-tenant/invoices?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# List all payments
curl -X GET "https://eproc-sourcing-backend.onrender.com/api/v1/test-tenant/payments?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# List all quotations
curl -X GET "https://eproc-sourcing-backend.onrender.com/api/v1/test-tenant/quotations?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

## Common Issues & Solutions

### Issue: SQL Query Returns 0 Records

**Possible causes:**
1. **Soft deletes**: Records have `deletedAt` set
   - Solution: Add `WHERE "deletedAt" IS NULL` to your query

2. **Wrong tenant**: Data is in a different tenant
   - Solution: Check `tenantId` in your query or list all tenants

3. **Case sensitivity**: PostgreSQL column names are case-sensitive when quoted
   - Solution: Use double quotes: `"deletedAt"` not `deletedAt`

4. **No data created yet**: Tests haven't run or API isn't accessible
   - Solution: Run the test suite or create data manually

### Issue: Tests Passing but No Data in Database

This is **IMPOSSIBLE** if tests are truly passing. If invoice-payment tests pass:
- Data **IS** being created
- Data **IS** being retrieved
- Database operations **ARE** working

Check:
1. Are you querying the correct database?
2. Are you using the correct table names?
3. Are you filtering by tenant correctly?

### Issue: API Returns 404

**Solutions:**
1. Verify the API is deployed and accessible
2. Check the correct base URL and API prefix
3. Ensure tenant exists in the system
4. Verify authentication token is valid

## Test Results

As of 2025-10-26, all Invoice & Payment tests are **PASSING**:

```
✅ test/invoice-payment.spec.ts - 20/20 tests passing
  ✓ TC-TRANS-039: Vendor creates invoice against PO
  ✓ TC-TRANS-040: Create InvoiceItem with budget tracing
  ✓ TC-TRANS-041: Invoice with budget deduction
  ✓ TC-TRANS-042: Approve invoice
  ✓ TC-TRANS-043: Mark invoice as paid
  ✓ TC-TRANS-044: Handle overdue invoice
  ✓ TC-TRANS-045: Dispute invoice
  ✓ TC-TRANS-046: Cancel invoice
  ✓ TC-TRANS-047: Request payment
  ✓ TC-TRANS-048: Approve payment
  ✓ TC-TRANS-049: Process payment
  ✓ TC-TRANS-050: Record payment receipt
  ✓ TC-TRANS-051: Failed payment
  ✓ TC-TRANS-052: Cancel payment
  ✓ Invoice and Payment listing tests
```

## Architecture

### Data Flow

```
1. Vendor creates Invoice → stored in `invoices` table
2. Admin creates Payment → stored in `payments` table
3. System creates Quotation → stored in `quotations` table
```

### Database Schema

```sql
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "poId" TEXT,
  "vendorId" TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  "taxAmount" DECIMAL,
  "totalAmount" DECIMAL NOT NULL,
  items JSONB,
  status TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "deletedAt" TIMESTAMP,
  -- ... more fields
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "paymentNumber" TEXT NOT NULL,
  "invoiceId" TEXT,
  "poId" TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  "paymentType" TEXT NOT NULL,
  method TEXT,
  status TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "deletedAt" TIMESTAMP,
  -- ... more fields
);

CREATE TABLE quotations (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "quotationNumber" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  items JSONB,
  status TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "deletedAt" TIMESTAMP,
  -- ... more fields
);
```

## Support

If you continue to see 0 records in your SQL queries:

1. Run the automated test: `npx jest test/invoice-payment.spec.ts`
2. Check test output for actual database operations
3. Use the SQL verification script: `test/verify-database-storage.sql`
4. Verify you're querying the correct database instance
5. Check for soft-deleted records (`deletedAt IS NOT NULL`)
