-- =====================================================
-- CARİ HESAP - match_type'a 'current_account_auto' ekle
-- =====================================================
-- Version: 1.0
-- Date: 2026-03-11
-- Description: statement_invoice_matches.match_type CHECK constraint'ine cari hesap otomatik eşleştirme değeri eklendi
-- =====================================================

-- Mevcut constraint'i kaldır
ALTER TABLE statement_invoice_matches
DROP CONSTRAINT IF EXISTS statement_invoice_matches_match_type_check;

-- Yeni constraint ekle ('current_account_auto' ile)
ALTER TABLE statement_invoice_matches
ADD CONSTRAINT statement_invoice_matches_match_type_check
CHECK (
  match_type IN (
    'exact_amount', 
    'amount_and_name', 
    'manual', 
    'suggested',
    'current_account_auto'  -- Yeni: Cari hesap otomatik eşleştirme
  )
);

-- Yorum güncelle
COMMENT ON COLUMN statement_invoice_matches.match_type IS 'exact_amount: Sadece tutar, amount_and_name: Tutar+isim, manual: Manuel, suggested: Öneri, current_account_auto: Cari hesap oto-eşleşme';
