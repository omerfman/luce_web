-- Add notes and verification columns to card_statement_items

-- 1. Notes field for user comments/descriptions
ALTER TABLE card_statement_items
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Verification fields
ALTER TABLE card_statement_items
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE card_statement_items
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);

ALTER TABLE card_statement_items
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Comments
COMMENT ON COLUMN card_statement_items.notes IS 'Kullanıcı açıklamaları/notları';
COMMENT ON COLUMN card_statement_items.is_verified IS 'Harcama doğrulandı mı? (fatura yoksa bile kullanıcı onayladı)';
COMMENT ON COLUMN card_statement_items.verified_by IS 'Doğrulayan kullanıcı';
COMMENT ON COLUMN card_statement_items.verified_at IS 'Doğrulama tarihi';
