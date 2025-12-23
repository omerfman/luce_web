-- Fix subcontractor and supplier schema issues
-- Date: 2024-12-23
-- Purpose: Kalıcı ve doğru mimari için schema düzeltmeleri

-- ========================================
-- 1. SUBCONTRACTORS TABLOSUNA VKN EKLE
-- ========================================
-- subcontractors tablosunda 'tax_number' var ama 'vkn' yok
-- Yeni kod 'vkn' kullanıyor, ekleyelim

ALTER TABLE subcontractors 
ADD COLUMN IF NOT EXISTS vkn VARCHAR(11);

-- Mevcut tax_number değerlerini vkn'ye kopyala
UPDATE subcontractors 
SET vkn = tax_number 
WHERE tax_number IS NOT NULL AND vkn IS NULL;

-- Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_subcontractors_vkn ON subcontractors(vkn);

-- Comment ekle
COMMENT ON COLUMN subcontractors.vkn IS 'Vergi Kimlik Numarası (10-11 haneli, opsiyonel)';

-- ========================================
-- 2. SUPPLIERS TABLOSUNDA VKN'Yİ NULLABLE YAP
-- ========================================
-- VKN her zaman bilinmiyor, NULL olabilmeli

-- Önce unique constraint'i kaldır (çünkü vkn null olabilecek)
ALTER TABLE suppliers 
DROP CONSTRAINT IF EXISTS suppliers_company_vkn_unique;

-- VKN kolonunu nullable yap
ALTER TABLE suppliers 
ALTER COLUMN vkn DROP NOT NULL;

-- Yeni partial unique index ekle (sadece vkn NOT NULL olanlar için)
-- Bu sayede: aynı company'de aynı VKN bir kez, ama NULL VKN birden fazla olabilir
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_company_vkn_unique 
ON suppliers(company_id, vkn) 
WHERE vkn IS NOT NULL;

-- Comment güncelle
COMMENT ON COLUMN suppliers.vkn IS 'Vergi Kimlik Numarası (10-11 haneli, opsiyonel - her zaman bilinmiyor)';

-- ========================================
-- 3. DATA İNTEGRİTY KONTROLÜ
-- ========================================

-- Suppliers'da VKN varsa ama isim "Bilinmeyen" olanları logla
DO $$
DECLARE
  unknown_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unknown_count
  FROM suppliers 
  WHERE vkn IS NOT NULL 
  AND (name = 'Bilinmeyen Tedarikçi' OR name IS NULL OR name = '');
  
  IF unknown_count > 0 THEN
    RAISE NOTICE 'Uyarı: % adet supplier VKN var ama isim eksik/bilinmeyen', unknown_count;
  END IF;
END $$;

-- ========================================
-- 4. YARDIMCI FONKSİYON: VKN VALİDASYON
-- ========================================

CREATE OR REPLACE FUNCTION validate_vkn(vkn_value VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  -- VKN null ise geçerli (opsiyonel)
  IF vkn_value IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- VKN 10 veya 11 haneli olmalı
  IF LENGTH(vkn_value) NOT IN (10, 11) THEN
    RETURN FALSE;
  END IF;
  
  -- Sadece rakam olmalı
  IF vkn_value !~ '^[0-9]+$' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Yorum ekle
COMMENT ON FUNCTION validate_vkn IS 'VKN formatını kontrol eder (10-11 hane, sadece rakam, veya NULL)';

-- ========================================
-- 5. TRIGGER: VKN OTOMATİK TRİMLEME
-- ========================================

-- VKN'de baştaki/sondaki boşlukları temizle
CREATE OR REPLACE FUNCTION trim_vkn_before_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vkn IS NOT NULL THEN
    NEW.vkn = TRIM(NEW.vkn);
    
    -- Boş string ise NULL yap
    IF NEW.vkn = '' THEN
      NEW.vkn = NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Suppliers için trigger
DROP TRIGGER IF EXISTS trigger_trim_vkn_suppliers ON suppliers;
CREATE TRIGGER trigger_trim_vkn_suppliers
  BEFORE INSERT OR UPDATE OF vkn ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION trim_vkn_before_insert();

-- Subcontractors için trigger
DROP TRIGGER IF EXISTS trigger_trim_vkn_subcontractors ON subcontractors;
CREATE TRIGGER trigger_trim_vkn_subcontractors
  BEFORE INSERT OR UPDATE OF vkn ON subcontractors
  FOR EACH ROW
  EXECUTE FUNCTION trim_vkn_before_insert();

-- ========================================
-- 6. VIEW: SUPPLIER-SUBCONTRACTOR İLİŞKİSİ
-- ========================================

-- Gelişmiş supplier view (subcontractor ile birlikte)
CREATE OR REPLACE VIEW v_suppliers_with_details AS
SELECT 
  s.id,
  s.company_id,
  s.vkn,
  s.name,
  s.supplier_type,
  s.is_active,
  s.subcontractor_id,
  sc.name AS subcontractor_name,
  sc.contact_person,
  sc.phone,
  sc.email,
  -- İstatistikler
  (SELECT COUNT(*) FROM invoices WHERE supplier_id = s.id) AS invoice_count,
  s.created_at,
  s.updated_at
FROM suppliers s
LEFT JOIN subcontractors sc ON s.subcontractor_id = sc.id;

-- Yorum ekle
COMMENT ON VIEW v_suppliers_with_details IS 'Supplier bilgileri ile subcontractor detayları birleşik view';

-- ========================================
-- 7. KONTROL SORGUSU
-- ========================================

-- Migration sonrası kontrol
DO $$
DECLARE
  supplier_count INTEGER;
  subcontractor_count INTEGER;
  supplier_with_vkn INTEGER;
  supplier_without_vkn INTEGER;
BEGIN
  -- Toplam sayıları al
  SELECT COUNT(*) INTO supplier_count FROM suppliers;
  SELECT COUNT(*) INTO subcontractor_count FROM subcontractors;
  SELECT COUNT(*) INTO supplier_with_vkn FROM suppliers WHERE vkn IS NOT NULL;
  SELECT COUNT(*) INTO supplier_without_vkn FROM suppliers WHERE vkn IS NULL;
  
  -- Rapor
  RAISE NOTICE '=== MIGRATION TAMAMLANDI ===';
  RAISE NOTICE 'Toplam Supplier: %', supplier_count;
  RAISE NOTICE 'Toplam Subcontractor: %', subcontractor_count;
  RAISE NOTICE 'VKN ile Supplier: %', supplier_with_vkn;
  RAISE NOTICE 'VKN olmayan Supplier: %', supplier_without_vkn;
  RAISE NOTICE '============================';
END $$;
