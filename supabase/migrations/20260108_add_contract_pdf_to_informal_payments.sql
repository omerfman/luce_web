-- Add contract_pdf_url column to informal_payments table
-- This stores the Cloudinary URL for the contract payment PDF

ALTER TABLE informal_payments 
ADD COLUMN IF NOT EXISTS contract_pdf_url TEXT;

-- Add comment
COMMENT ON COLUMN informal_payments.contract_pdf_url IS 'Sözleşmeli ödeme PDF tutanağının Cloudinary URL''si';

-- Create index for queries with has_contract
CREATE INDEX IF NOT EXISTS idx_informal_payments_contract_pdf 
ON informal_payments(contract_pdf_url) 
WHERE contract_pdf_url IS NOT NULL;
