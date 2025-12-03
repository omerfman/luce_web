-- Check invoices table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

-- Check if there are any invoices
SELECT COUNT(*) as invoice_count FROM invoices;
