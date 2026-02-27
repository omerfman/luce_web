-- Taksit kolonlarını mevcut card_statement_items tablosuna ekle
ALTER TABLE card_statement_items
  ADD COLUMN IF NOT EXISTS is_installment BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS installment_current INT,
  ADD COLUMN IF NOT EXISTS installment_total INT,
  ADD COLUMN IF NOT EXISTS installment_total_amount DECIMAL(15, 2);

-- Comments ekle
COMMENT ON COLUMN card_statement_items.is_installment IS 'Taksitli işlem mi?';
COMMENT ON COLUMN card_statement_items.installment_current IS 'Kaçıncı taksit (örn: 3)';
COMMENT ON COLUMN card_statement_items.installment_total IS 'Toplam taksit sayısı (örn: 6)';
COMMENT ON COLUMN card_statement_items.installment_total_amount IS 'Taksit toplamı (tüm taksitlerin toplam tutarı)';
