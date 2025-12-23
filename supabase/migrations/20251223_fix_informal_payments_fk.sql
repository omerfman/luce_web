-- Fix informal_payments foreign key to use suppliers instead of subcontractors
-- Date: 2025-12-23
-- Purpose: Align database schema with code implementation

-- Step 1: Drop old foreign key constraint
ALTER TABLE informal_payments 
DROP CONSTRAINT IF EXISTS informal_payments_subcontractor_id_fkey;

-- Step 2: Rename column for clarity (optional but recommended)
ALTER TABLE informal_payments 
RENAME COLUMN subcontractor_id TO supplier_id;

-- Step 3: Add new foreign key to suppliers table
ALTER TABLE informal_payments 
ADD CONSTRAINT informal_payments_supplier_id_fkey 
FOREIGN KEY (supplier_id) 
REFERENCES suppliers(id) 
ON DELETE RESTRICT;

-- Step 4: Update index name
DROP INDEX IF EXISTS idx_informal_payments_subcontractor_id;
CREATE INDEX idx_informal_payments_supplier_id ON informal_payments(supplier_id);

-- Step 5: Update comments
COMMENT ON COLUMN informal_payments.supplier_id IS 'Reference to supplier (tedarikçi/taşeron)';
COMMENT ON TABLE informal_payments IS 'Gayri resmi ödemeler - taşeronlara/tedarikçilere yapılan ödemeler';
