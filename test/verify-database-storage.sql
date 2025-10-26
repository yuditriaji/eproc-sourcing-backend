-- Database Storage Verification SQL Script
-- Verifies that Invoice, Payment, and Quotation data is stored correctly

-- ============================================================================
-- PART 1: Check Table Existence and Structure
-- ============================================================================

-- Check if tables exist
SELECT 
  table_name,
  table_schema
FROM information_schema.tables 
WHERE table_name IN ('invoices', 'payments', 'quotations', 'bids', 'purchase_orders', 'goods_receipts')
ORDER BY table_name;

-- ============================================================================
-- PART 2: Count ALL Records (including soft-deleted)
-- ============================================================================

SELECT 'invoices (all)' as table_name, COUNT(*) as total_count FROM invoices
UNION ALL
SELECT 'invoices (active)', COUNT(*) FROM invoices WHERE "deletedAt" IS NULL
UNION ALL
SELECT 'payments (all)', COUNT(*) FROM payments
UNION ALL
SELECT 'payments (active)', COUNT(*) FROM payments WHERE "deletedAt" IS NULL
UNION ALL
SELECT 'quotations (all)', COUNT(*) FROM quotations
UNION ALL
SELECT 'quotations (active)', COUNT(*) FROM quotations WHERE "deletedAt" IS NULL
UNION ALL
SELECT 'bids (all)', COUNT(*) FROM bids
UNION ALL
SELECT 'purchase_orders (all)', COUNT(*) FROM purchase_orders
UNION ALL
SELECT 'goods_receipts (all)', COUNT(*) FROM goods_receipts;

-- ============================================================================
-- PART 3: Count by Tenant
-- ============================================================================

-- Invoices by tenant
SELECT 
  'invoices' as entity_type,
  "tenantId",
  COUNT(*) as count
FROM invoices
WHERE "deletedAt" IS NULL
GROUP BY "tenantId"
ORDER BY count DESC
LIMIT 10;

-- Payments by tenant
SELECT 
  'payments' as entity_type,
  "tenantId",
  COUNT(*) as count
FROM payments
WHERE "deletedAt" IS NULL
GROUP BY "tenantId"
ORDER BY count DESC
LIMIT 10;

-- Quotations by tenant
SELECT 
  'quotations' as entity_type,
  "tenantId",
  COUNT(*) as count
FROM quotations
WHERE "deletedAt" IS NULL
GROUP BY "tenantId"
ORDER BY count DESC
LIMIT 10;

-- ============================================================================
-- PART 4: Recent Records (Last 24 hours)
-- ============================================================================

SELECT 
  'invoices' as type,
  COUNT(*) as recent_count
FROM invoices
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
  AND "deletedAt" IS NULL

UNION ALL

SELECT 
  'payments' as type,
  COUNT(*) as recent_count
FROM payments
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
  AND "deletedAt" IS NULL

UNION ALL

SELECT 
  'quotations' as type,
  COUNT(*) as recent_count
FROM quotations
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
  AND "deletedAt" IS NULL;

-- ============================================================================
-- PART 5: Sample Data (Last 5 invoices)
-- ============================================================================

SELECT 
  id,
  "tenantId",
  "invoiceNumber",
  "vendorId",
  "totalAmount",
  status,
  "createdAt"
FROM invoices
WHERE "deletedAt" IS NULL
ORDER BY "createdAt" DESC
LIMIT 5;

-- ============================================================================
-- PART 6: Sample Data (Last 5 payments)
-- ============================================================================

SELECT 
  id,
  "tenantId",
  "paymentNumber",
  "poId",
  amount,
  status,
  "createdAt"
FROM payments
WHERE "deletedAt" IS NULL
ORDER BY "createdAt" DESC
LIMIT 5;

-- ============================================================================
-- PART 7: Sample Data (Last 5 quotations)
-- ============================================================================

SELECT 
  id,
  "tenantId",
  "quotationNumber",
  "vendorId",
  amount,
  status,
  "createdAt"
FROM quotations
WHERE "deletedAt" IS NULL
ORDER BY "createdAt" DESC
LIMIT 5;

-- ============================================================================
-- PART 8: Check Column Names (in case of schema mismatch)
-- ============================================================================

SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('invoices', 'payments', 'quotations')
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- SUMMARY QUERY
-- ============================================================================

WITH counts AS (
  SELECT 'invoices' as table_name, COUNT(*) as total, COUNT(*) FILTER (WHERE "deletedAt" IS NULL) as active FROM invoices
  UNION ALL
  SELECT 'payments', COUNT(*), COUNT(*) FILTER (WHERE "deletedAt" IS NULL) FROM payments
  UNION ALL
  SELECT 'quotations', COUNT(*), COUNT(*) FILTER (WHERE "deletedAt" IS NULL) FROM quotations
  UNION ALL
  SELECT 'bids', COUNT(*), COUNT(*) FROM bids
  UNION ALL
  SELECT 'purchase_orders', COUNT(*), COUNT(*) FROM purchase_orders
  UNION ALL
  SELECT 'goods_receipts', COUNT(*), COUNT(*) FROM goods_receipts
)
SELECT 
  table_name,
  total as total_records,
  active as active_records,
  (total - active) as soft_deleted
FROM counts
ORDER BY table_name;
