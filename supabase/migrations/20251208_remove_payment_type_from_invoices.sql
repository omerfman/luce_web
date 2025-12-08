-- Remove payment_type column from invoices table
-- Payments are now tracked in the separate payments table

ALTER TABLE public.invoices DROP COLUMN IF EXISTS payment_type;

-- Add helpful comment
COMMENT ON TABLE public.invoices IS 'Invoice records. Payment information is tracked separately in the payments table.';
