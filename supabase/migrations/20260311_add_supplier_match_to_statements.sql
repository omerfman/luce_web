-- =====================================================
-- CARİ HESAP GELİŞTİRME - STATEMENT MATCHES GÜNCELLEMESİ
-- =====================================================
-- Version: 2.0
-- Date: 2026-03-11
-- Description: Kredi kartı harcamalarını fatura olmadan doğrudan firmaya bağlama
-- =====================================================

-- statement_invoice_matches tablosuna supplier_id ekle
ALTER TABLE statement_invoice_matches
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE;

-- invoice_id'yi nullable yap (eğer değilse)
ALTER TABLE statement_invoice_matches
ALTER COLUMN invoice_id DROP NOT NULL;

-- En az birinin olması gerektiğini kontrol et
ALTER TABLE statement_invoice_matches
DROP CONSTRAINT IF EXISTS statement_invoice_matches_match_target;

ALTER TABLE statement_invoice_matches
ADD CONSTRAINT statement_invoice_matches_match_target
CHECK (
  (invoice_id IS NOT NULL AND supplier_id IS NULL) OR
  (invoice_id IS NULL AND supplier_id IS NOT NULL)
);

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_statement_invoice_matches_supplier
ON statement_invoice_matches(supplier_id);

-- Yorum güncelle
COMMENT ON COLUMN statement_invoice_matches.supplier_id IS 'Cari hesap firması ile doğrudan eşleşme (fatura olmadan)';
COMMENT ON CONSTRAINT statement_invoice_matches_match_target ON statement_invoice_matches IS 'En az biri dolu olmalı: invoice_id veya supplier_id';

-- Unique constraint'i güncelle (aynı item hem invoice hem supplier ile eşleşebilir - birden fazla)
-- Eski constraint'i kaldır
ALTER TABLE statement_invoice_matches
DROP CONSTRAINT IF EXISTS statement_invoice_matches_unique;

-- Yeni unique constraint - sadece aynı çifti tekrar etmesin
CREATE UNIQUE INDEX IF NOT EXISTS idx_statement_invoice_matches_unique_invoice
ON statement_invoice_matches(statement_item_id, invoice_id)
WHERE invoice_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_statement_invoice_matches_unique_supplier
ON statement_invoice_matches(statement_item_id, supplier_id)
WHERE supplier_id IS NOT NULL;

-- Trigger güncelleme - supplier_id için de çalışmalı
DROP TRIGGER IF EXISTS update_statement_matched_count ON statement_invoice_matches;

CREATE OR REPLACE FUNCTION update_statement_matched_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Yeni eşleşme eklendi
    UPDATE card_statements
    SET matched_count = (
      SELECT COUNT(DISTINCT si.id)
      FROM card_statement_items si
      INNER JOIN statement_invoice_matches sim ON sim.statement_item_id = si.id
      WHERE si.statement_id = (
        SELECT statement_id FROM card_statement_items WHERE id = NEW.statement_item_id
      )
    )
    WHERE id = (
      SELECT statement_id FROM card_statement_items WHERE id = NEW.statement_item_id
    );
    
    -- İlgili statement_item'ı matched olarak işaretle
    UPDATE card_statement_items
    SET is_matched = TRUE,
        match_confidence = NEW.match_score
    WHERE id = NEW.statement_item_id;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Eşleşme silindi
    UPDATE card_statements
    SET matched_count = (
      SELECT COUNT(DISTINCT si.id)
      FROM card_statement_items si
      INNER JOIN statement_invoice_matches sim ON sim.statement_item_id = si.id
      WHERE si.statement_id = (
        SELECT statement_id FROM card_statement_items WHERE id = OLD.statement_item_id
      )
    )
    WHERE id = (
      SELECT statement_id FROM card_statement_items WHERE id = OLD.statement_item_id
    );
    
    -- Eğer bu item'ın başka eşleşmesi yoksa, matched'i false yap
    UPDATE card_statement_items
    SET is_matched = FALSE,
        match_confidence = 0
    WHERE id = OLD.statement_item_id
      AND NOT EXISTS (
        SELECT 1 FROM statement_invoice_matches 
        WHERE statement_item_id = OLD.statement_item_id
      );
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_statement_matched_count
AFTER INSERT OR DELETE ON statement_invoice_matches
FOR EACH ROW
EXECUTE FUNCTION update_statement_matched_count();

-- View güncelleme - supplier bilgisini de göster
CREATE OR REPLACE VIEW v_statement_matches_detail AS
SELECT 
  sim.id,
  sim.statement_item_id,
  sim.invoice_id,
  sim.supplier_id,
  sim.match_type,
  sim.match_score,
  sim.matched_by_user_id,
  sim.matched_at,
  sim.notes,
  -- Invoice bilgileri
  i.invoice_number,
  i.invoice_date,
  i.supplier_name AS invoice_supplier_name,
  i.amount AS invoice_amount,
  -- Supplier bilgileri (doğrudan eşleşme için)
  s.name AS direct_supplier_name,
  s.vkn AS supplier_vkn,
  s.is_current_account,
  -- Statement item bilgileri
  si.transaction_name,
  si.amount AS statement_amount,
  si.transaction_date
FROM statement_invoice_matches sim
LEFT JOIN invoices i ON sim.invoice_id = i.id
LEFT JOIN suppliers s ON sim.supplier_id = s.id
INNER JOIN card_statement_items si ON sim.statement_item_id = si.id;

COMMENT ON VIEW v_statement_matches_detail IS 'Eşleşmelerin detaylı görünümü (fatura veya firma bazlı)';
