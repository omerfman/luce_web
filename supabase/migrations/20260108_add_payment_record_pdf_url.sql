-- Add payment_record_pdf_url column to informal_payments table
-- Bu kolon sözleşmeli ödemelerin tutanak PDF'inin URL'sini saklar

ALTER TABLE informal_payments 
ADD COLUMN IF NOT EXISTS payment_record_pdf_url TEXT;

-- Yorum ekle
COMMENT ON COLUMN informal_payments.payment_record_pdf_url IS 'Sözleşmeli ödeme için oluşturulan tutanak PDF dosyasının URL adresi';

-- Index ekle (has_contract true olanlar için sık sık sorgulanacak)
CREATE INDEX IF NOT EXISTS idx_informal_payments_pdf_url 
ON informal_payments(payment_record_pdf_url) 
WHERE payment_record_pdf_url IS NOT NULL;
