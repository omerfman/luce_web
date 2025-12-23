-- Gayri Resmi Ödemeler tablosuna sözleşme alanı ekle
-- Date: 2024-12-23

-- has_contract kolonu ekle
ALTER TABLE informal_payments 
ADD COLUMN IF NOT EXISTS has_contract BOOLEAN DEFAULT FALSE;

-- Yorum ekle
COMMENT ON COLUMN informal_payments.has_contract IS 'Bu ödeme için sözleşme/tutanak oluşturuldu mu?';

-- Index ekle (raporlama için)
CREATE INDEX IF NOT EXISTS idx_informal_payments_has_contract 
ON informal_payments(has_contract) 
WHERE has_contract = true;
