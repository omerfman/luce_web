-- =====================================================
-- CARİ HESAP SİSTEMİ - SUPPLIERS TABLE GÜNCELLEMESİ
-- =====================================================
-- Version: 1.0
-- Date: 2026-03-11
-- Description: Suppliers tablosuna cari hesap yönetimi için kolonlar ekleniyor
-- =====================================================

-- Cari hesap flag ve notlar kolonu ekle
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS is_current_account BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS current_account_notes TEXT;

-- Yorum ekle
COMMENT ON COLUMN suppliers.is_current_account IS 'Firma cari hesap olarak mı takip ediliyor? (Parçalı ödemeler için)';
COMMENT ON COLUMN suppliers.current_account_notes IS 'Cari hesap açıklaması/notları';

-- Index oluştur (performans için)
CREATE INDEX IF NOT EXISTS idx_suppliers_current_account 
ON suppliers(company_id, is_current_account) 
WHERE is_current_account = TRUE;

-- Index açıklaması
COMMENT ON INDEX idx_suppliers_current_account IS 'Cari hesap olan firmaları hızlı listeleme için';

-- Örnek: Mevcut bir supplier'ı cari hesap olarak işaretle (test için - kaldırılabilir)
-- UPDATE suppliers 
-- SET is_current_account = TRUE, 
--     current_account_notes = 'Parçalı ödeme yapılan firma'
-- WHERE vkn = '1234567890' AND company_id = 'your-company-id';
