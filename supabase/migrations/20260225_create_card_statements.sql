-- =====================================================
-- KREDİ KARTI EKSTRELERİ YÖNETİM SİSTEMİ
-- DATABASE MIGRATION
-- =====================================================
-- Version: 1.0
-- Date: 2026-02-25
-- Description: Kredi kartı ekstrelerini yönetmek ve faturalarla eşleştirmek için tablolar
-- =====================================================

-- =====================================================
-- CARD_STATEMENTS TABLE (Ekstre Başlıkları)
-- =====================================================

CREATE TABLE IF NOT EXISTS card_statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Dosya bilgileri (sadece referans için)
  file_name TEXT NOT NULL,
  
  -- Kart bilgileri
  card_last_four VARCHAR(4),
  card_holder_name TEXT,
  statement_month DATE, -- YYYY-MM-01 formatında
  
  -- İstatistikler
  total_transactions INT DEFAULT 0,
  total_amount DECIMAL(15, 2) DEFAULT 0,
  matched_count INT DEFAULT 0,
  
  -- Timestamps
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT card_statements_card_last_four_length CHECK (
    card_last_four IS NULL OR LENGTH(card_last_four) = 4
  )
);

-- Indexes
CREATE INDEX idx_card_statements_company_id ON card_statements(company_id);
CREATE INDEX idx_card_statements_uploaded_by ON card_statements(uploaded_by_user_id);
CREATE INDEX idx_card_statements_statement_month ON card_statements(statement_month);
CREATE INDEX idx_card_statements_card_last_four ON card_statements(card_last_four);

-- Comments
COMMENT ON TABLE card_statements IS 'Kredi kartı ekstresi dosyaları ve özet bilgileri';
COMMENT ON COLUMN card_statements.card_last_four IS 'Kart numarasının son 4 hanesi';
COMMENT ON COLUMN card_statements.statement_month IS 'Ekstre dönemi (örn: 2025-12-01)';
COMMENT ON COLUMN card_statements.matched_count IS 'Fatura ile eşleşen işlem sayısı';

-- =====================================================
-- CARD_STATEMENT_ITEMS TABLE (Ekstre Satırları)
-- =====================================================

CREATE TABLE IF NOT EXISTS card_statement_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  statement_id UUID NOT NULL REFERENCES card_statements(id) ON DELETE CASCADE,
  
  -- Excel satır bilgisi
  row_number INT NOT NULL,
  
  -- İşlem bilgileri
  transaction_name TEXT NOT NULL, -- Firma/işlem adı
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'TRY',
  transaction_date DATE NOT NULL,
  
  -- Ek bilgiler
  card_last_four VARCHAR(4),
  description TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb, -- Orijinal satır verisi
  
  -- Taksit bilgileri
  is_installment BOOLEAN DEFAULT FALSE,
  installment_current INT, -- Kaçıncı taksit (örn: 3)
  installment_total INT, -- Toplam taksit sayısı (örn: 6)
  installment_total_amount DECIMAL(15, 2), -- Taksit toplamı (örn: 32631.33)
  
  -- Eşleşme durumu
  is_matched BOOLEAN DEFAULT FALSE,
  match_confidence DECIMAL(5, 2) DEFAULT 0, -- 0-100 arası skor
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT card_statement_items_unique_row UNIQUE (statement_id, row_number)
);

-- Indexes
CREATE INDEX idx_card_statement_items_statement_id ON card_statement_items(statement_id);
CREATE INDEX idx_card_statement_items_amount ON card_statement_items(amount);
CREATE INDEX idx_card_statement_items_transaction_date ON card_statement_items(transaction_date);
CREATE INDEX idx_card_statement_items_is_matched ON card_statement_items(is_matched);
CREATE INDEX idx_card_statement_items_transaction_name ON card_statement_items USING gin(to_tsvector('turkish', transaction_name));

-- Comments
COMMENT ON TABLE card_statement_items IS 'Kredi kartı ekstresi satırları (işlemler)';
COMMENT ON COLUMN card_statement_items.transaction_name IS 'İşlem yapılan firma/yer adı';
COMMENT ON COLUMN card_statement_items.match_confidence IS 'Eşleşme güven skoru (0-100)';
COMMENT ON COLUMN card_statement_items.raw_data IS 'Excel satırındaki tüm veriler (JSON)';
COMMENT ON COLUMN card_statement_items.is_installment IS 'Taksitli işlem mi?';
COMMENT ON COLUMN card_statement_items.installment_current IS 'Kaçıncı taksit (örn: 3)';
COMMENT ON COLUMN card_statement_items.installment_total IS 'Toplam taksit sayısı (örn: 6)';
COMMENT ON COLUMN card_statement_items.installment_total_amount IS 'Taksit toplamı (tüm taksitlerin toplam tutarı)';

-- =====================================================
-- STATEMENT_INVOICE_MATCHES TABLE (Eşleşmeler)
-- =====================================================

CREATE TABLE IF NOT EXISTS statement_invoice_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  statement_item_id UUID NOT NULL REFERENCES card_statement_items(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  
  -- Eşleşme detayları
  match_type VARCHAR(20) NOT NULL CHECK (
    match_type IN ('exact_amount', 'amount_and_name', 'manual', 'suggested')
  ),
  match_score DECIMAL(5, 2) NOT NULL DEFAULT 0, -- 0-100 arası
  
  -- Manuel eşleşme için
  matched_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT statement_invoice_matches_unique UNIQUE (statement_item_id, invoice_id),
  CONSTRAINT statement_invoice_matches_score_range CHECK (match_score >= 0 AND match_score <= 100)
);

-- Indexes
CREATE INDEX idx_statement_invoice_matches_statement_item ON statement_invoice_matches(statement_item_id);
CREATE INDEX idx_statement_invoice_matches_invoice ON statement_invoice_matches(invoice_id);
CREATE INDEX idx_statement_invoice_matches_match_type ON statement_invoice_matches(match_type);
CREATE INDEX idx_statement_invoice_matches_matched_by ON statement_invoice_matches(matched_by_user_id);

-- Comments
COMMENT ON TABLE statement_invoice_matches IS 'Ekstre satırları ile faturalar arasındaki eşleşmeler';
COMMENT ON COLUMN statement_invoice_matches.match_type IS 'exact_amount: Sadece tutar, amount_and_name: Tutar+isim, manual: Manuel, suggested: Öneri';
COMMENT ON COLUMN statement_invoice_matches.match_score IS 'Eşleşme skoru (0-100), yüksek = daha güvenilir';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Ekstre satırı matched olunca, statement'in matched_count'unu artır
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_statement_matched_count
  AFTER INSERT OR DELETE ON statement_invoice_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_statement_matched_count();

-- Ekstre oluşturulunca istatistikleri hesapla
CREATE OR REPLACE FUNCTION calculate_statement_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE card_statements
  SET 
    total_transactions = (
      SELECT COUNT(*) FROM card_statement_items WHERE statement_id = NEW.statement_id
    ),
    total_amount = (
      SELECT COALESCE(SUM(amount), 0) FROM card_statement_items WHERE statement_id = NEW.statement_id
    )
  WHERE id = NEW.statement_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_statement_stats
  AFTER INSERT OR UPDATE OR DELETE ON card_statement_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_statement_stats();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE card_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_statement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE statement_invoice_matches ENABLE ROW LEVEL SECURITY;

-- card_statements policies
CREATE POLICY "Users can view own company statements"
  ON card_statements FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create statements for own company"
  ON card_statements FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own company statements"
  ON card_statements FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own company statements"
  ON card_statements FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- card_statement_items policies
CREATE POLICY "Users can view items from own company statements"
  ON card_statement_items FOR SELECT
  USING (
    statement_id IN (
      SELECT id FROM card_statements 
      WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create items for own company statements"
  ON card_statement_items FOR INSERT
  WITH CHECK (
    statement_id IN (
      SELECT id FROM card_statements 
      WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update items from own company statements"
  ON card_statement_items FOR UPDATE
  USING (
    statement_id IN (
      SELECT id FROM card_statements 
      WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete items from own company statements"
  ON card_statement_items FOR DELETE
  USING (
    statement_id IN (
      SELECT id FROM card_statements 
      WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- statement_invoice_matches policies
CREATE POLICY "Users can view matches from own company"
  ON statement_invoice_matches FOR SELECT
  USING (
    statement_item_id IN (
      SELECT si.id FROM card_statement_items si
      INNER JOIN card_statements s ON s.id = si.statement_id
      WHERE s.company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create matches for own company"
  ON statement_invoice_matches FOR INSERT
  WITH CHECK (
    statement_item_id IN (
      SELECT si.id FROM card_statement_items si
      INNER JOIN card_statements s ON s.id = si.statement_id
      WHERE s.company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update matches from own company"
  ON statement_invoice_matches FOR UPDATE
  USING (
    statement_item_id IN (
      SELECT si.id FROM card_statement_items si
      INNER JOIN card_statements s ON s.id = si.statement_id
      WHERE s.company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete matches from own company"
  ON statement_invoice_matches FOR DELETE
  USING (
    statement_item_id IN (
      SELECT si.id FROM card_statement_items si
      INNER JOIN card_statements s ON s.id = si.statement_id
      WHERE s.company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Kredi Kartı Ekstreleri migration tamamlandı!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Oluşturulan tablolar:';
  RAISE NOTICE '   - card_statements (ekstre başlıkları)';
  RAISE NOTICE '   - card_statement_items (ekstre satırları)';
  RAISE NOTICE '   - statement_invoice_matches (fatura eşleşmeleri)';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 RLS policies aktif';
  RAISE NOTICE '⚡ Triggers oluşturuldu (otomatik istatistik güncelleme)';
END $$;
