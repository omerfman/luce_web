-- =====================================================
-- DEBUG QUERIES FOR NURAKS MOBİLYA ISSUE
-- =====================================================
-- Run these in Supabase SQL Editor to find the root cause
-- =====================================================

-- Query 1: Check supplier status
SELECT 
  id, 
  name, 
  vkn, 
  is_current_account,
  company_id
FROM suppliers 
WHERE id = 'c872e152-50ed-4bec-937d-4ba290211d21';

-- Query 2: Count invoices by supplier_id (direct link)
SELECT 
  COUNT(*) as invoice_count,
  SUM(amount) as total_amount
FROM invoices
WHERE supplier_id = 'c872e152-50ed-4bec-937d-4ba290211d21'
  AND status IN ('approved', 'pending');

-- Query 3: Get supplier VKN from Query 1, then find invoices by VKN
SELECT 
  i.id,
  i.invoice_number,
  i.invoice_date,
  i.amount,
  i.supplier_id,
  i.supplier_vkn,
  i.supplier_name,
  i.company_id,
  i.status
FROM invoices i
WHERE i.supplier_vkn = (
  SELECT vkn FROM suppliers WHERE id = 'c872e152-50ed-4bec-937d-4ba290211d21'
)
AND i.status IN ('approved', 'pending')
ORDER BY i.invoice_date DESC;

-- Query 4: Find invoices by name (case insensitive)
SELECT 
  i.id,
  i.invoice_number,
  i.invoice_date,
  i.amount,
  i.supplier_id,
  i.supplier_vkn,
  i.supplier_name,
  i.company_id,
  i.status
FROM invoices i
WHERE i.supplier_name ILIKE '%NURAKS%'
  AND i.status IN ('approved', 'pending')
ORDER BY i.invoice_date DESC;

-- Query 5: Check company_id match
SELECT 
  s.company_id as supplier_company_id,
  COUNT(i.id) as invoice_count_same_company,
  SUM(i.amount) as total_amount
FROM suppliers s
LEFT JOIN invoices i ON (
  i.supplier_vkn = s.vkn 
  AND i.company_id = s.company_id
  AND i.status IN ('approved', 'pending')
)
WHERE s.id = 'c872e152-50ed-4bec-937d-4ba290211d21'
GROUP BY s.company_id;

-- Query 6: FIX - Update invoices to link supplier_id
UPDATE invoices i
SET supplier_id = 'c872e152-50ed-4bec-937d-4ba290211d21'
FROM suppliers s
WHERE s.id = 'c872e152-50ed-4bec-937d-4ba290211d21'
  AND i.supplier_id IS NULL
  AND (
    (i.supplier_vkn = s.vkn) OR
    (i.supplier_name ILIKE '%NURAKS%')
  )
  AND i.company_id = s.company_id;

-- Query 7: Verify fix worked
SELECT 
  COUNT(*) as updated_invoice_count,
  SUM(amount) as total_amount
FROM invoices
WHERE supplier_id = 'c872e152-50ed-4bec-937d-4ba290211d21'
  AND status IN ('approved', 'pending');
