-- Transaction type (harcama vs ödeme) ve card grouping için kolonlar ekle

-- 1. Transaction type ekle
ALTER TABLE card_statement_items
  ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(20) DEFAULT 'expense' CHECK (transaction_type IN ('expense', 'payment'));

-- 2. Full card number (maskelenmiş) - gruplamak için
-- Örnek: "5258 64** **** 7608" veya "FARUK ASARKAYA / Ek Kart / 5258 64** **** 7755"
ALTER TABLE card_statement_items
  ADD COLUMN IF NOT EXISTS full_card_number TEXT;

-- 3. Card holder name (ek kart bilgisi için)
-- Örnek: "FARUK ASARKAYA / Ek Kart"
ALTER TABLE card_statement_items
  ADD COLUMN IF NOT EXISTS card_holder_name TEXT;

-- Comments
COMMENT ON COLUMN card_statement_items.transaction_type IS 'İşlem tipi: expense (harcama) veya payment (kredi kartı borç ödemesi)';
COMMENT ON COLUMN card_statement_items.full_card_number IS 'Tam kart numarası (maskelenmiş): "5258 64** **** 7608"';
COMMENT ON COLUMN card_statement_items.card_holder_name IS 'Kart sahibi adı (ek kart ise): "FARUK ASARKAYA / Ek Kart"';

-- Index ekle (filtreleme performansı için)
CREATE INDEX IF NOT EXISTS idx_card_statement_items_transaction_type ON card_statement_items(transaction_type);
CREATE INDEX IF NOT EXISTS idx_card_statement_items_full_card_number ON card_statement_items(full_card_number);
