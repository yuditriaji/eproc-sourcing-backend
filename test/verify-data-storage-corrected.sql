-- Data Storage Verification (Corrected Table Names)
-- This script verifies data presence using the actual mapped table names from schema.prisma

-- Check counts in all relevant tables
SELECT 'bids' as table_name, COUNT(*) as count FROM bids
UNION ALL
SELECT 'purchase_orders', COUNT(*) FROM purchase_orders
UNION ALL
SELECT 'goods_receipts', COUNT(*) FROM goods_receipts
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'quotations', COUNT(*) FROM quotations
UNION ALL
SELECT 'tenders', COUNT(*) FROM tenders
UNION ALL
SELECT 'vendors', COUNT(*) FROM vendors
UNION ALL
SELECT 'contracts', COUNT(*) FROM contracts;

-- Sample bid data with all fields
SELECT 
  id,
  "tenantId",
  "tenderId",
  "vendorId",
  status,
  "bidAmount",
  "submittedAt",
  "createdAt"
FROM bids
ORDER BY "createdAt" DESC
LIMIT 5;

-- Sample purchase order data
SELECT 
  id,
  "tenantId",
  "poNumber",
  title,
  amount,
  status,
  "orderDate",
  "createdAt"
FROM purchase_orders
ORDER BY "createdAt" DESC
LIMIT 5;

-- Sample goods receipt data
SELECT 
  id,
  "tenantId",
  "receiptNumber",
  "poId",
  status,
  "receivedDate",
  "createdAt"
FROM goods_receipts
ORDER BY "createdAt" DESC
LIMIT 5;

-- Sample invoice data
SELECT 
  id,
  "tenantId",
  "invoiceNumber",
  "vendorId",
  amount,
  "totalAmount",
  status,
  "invoiceDate",
  "createdAt"
FROM invoices
ORDER BY "createdAt" DESC
LIMIT 5;

-- Sample payment data
SELECT 
  id,
  "tenantId",
  "paymentNumber",
  "poId",
  amount,
  status,
  "paymentType",
  "requestedDate",
  "createdAt"
FROM payments
ORDER BY "createdAt" DESC
LIMIT 5;

-- Sample quotation data
SELECT 
  id,
  "tenantId",
  "quotationNumber",
  "vendorId",
  amount,
  status,
  "createdAt"
FROM quotations
ORDER BY "createdAt" DESC
LIMIT 5;

-- Check for any recent test data (created in last hour)
SELECT 
  'bids' as table_name,
  COUNT(*) as recent_count
FROM bids
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
  'purchase_orders',
  COUNT(*)
FROM purchase_orders
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
  'goods_receipts',
  COUNT(*)
FROM goods_receipts
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
  'invoices',
  COUNT(*)
FROM invoices
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
  'payments',
  COUNT(*)
FROM payments
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
  'quotations',
  COUNT(*)
FROM quotations
WHERE "createdAt" > NOW() - INTERVAL '1 hour';
