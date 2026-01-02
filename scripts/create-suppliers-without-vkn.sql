-- ================================================
-- VKN'siz Faturalardan Supplier Kayıtları Oluştur
-- ================================================
-- 
-- Amaç: invoices tablosunda VKN'si olmayan ama firma ismi olan
-- kayıtlar için suppliers tablosuna "pending" kayıtları oluşturur.
--
-- Çalıştırma: Supabase SQL Editor'de çalıştırın
-- ================================================

-- 1. DURUM ANALİZİ
-- ================================================

-- VKN'siz ama firma isimli faturalar
SELECT 
  supplier_name,
  COUNT(*) as fatura_sayisi,
  MIN(created_at) as ilk_fatura,
  MAX(created_at) as son_fatura
FROM invoices
WHERE (supplier_vkn IS NULL OR supplier_vkn = '')
  AND supplier_name IS NOT NULL
  AND supplier_name != ''
  AND supplier_name != 'Bilinmeyen Tedarikçi'
GROUP BY supplier_name
ORDER BY COUNT(*) DESC;


-- 2. SUPPLIER KAYITLARI OLUŞTUR
-- ================================================

-- VKN'siz firma isimlerini suppliers tablosuna ekle
-- VKN olmadığı için NULL olarak kaydet, supplier_type = 'pending'
INSERT INTO suppliers (company_id, vkn, name, supplier_type, is_active, created_at, updated_at)
SELECT DISTINCT
  i.company_id,
  NULL as vkn, -- VKN yok
  i.supplier_name as name,
  'pending' as supplier_type,
  true as is_active,
  NOW() as created_at,
  NOW() as updated_at
FROM invoices i
WHERE (i.supplier_vkn IS NULL OR i.supplier_vkn = '')
  AND i.supplier_name IS NOT NULL
  AND i.supplier_name != ''
  AND i.supplier_name != 'Bilinmeyen Tedarikçi'
  AND NOT EXISTS (
    -- Aynı isimde zaten kayıt varsa ekleme
    SELECT 1 FROM suppliers s
    WHERE s.company_id = i.company_id
      AND s.name = i.supplier_name
      AND s.vkn IS NULL -- VKN'siz olanları kontrol et
  );

-- Kaç kayıt eklendi?
SELECT COUNT(*) as yeni_eklenen_kayit_sayisi
FROM suppliers
WHERE created_at > NOW() - INTERVAL '10 seconds';


-- 3. DOĞRULAMA
-- ================================================

-- Yeni eklenen kayıtları göster
SELECT 
  s.name,
  s.vkn,
  s.supplier_type,
  COUNT(i.id) as fatura_sayisi
FROM suppliers s
LEFT JOIN invoices i ON (
  (i.supplier_name = s.name AND i.company_id = s.company_id)
)
WHERE s.created_at > NOW() - INTERVAL '1 minute'
GROUP BY s.id, s.name, s.vkn, s.supplier_type
ORDER BY COUNT(i.id) DESC;

-- Toplam supplier sayısı
SELECT 
  supplier_type,
  COUNT(*) as sayisi
FROM suppliers
GROUP BY supplier_type
ORDER BY supplier_type;


-- 4. FATURA LİNKLEMESİ (Opsiyonel)
-- ================================================

-- Yeni oluşturulan supplier'ların ID'lerini faturalara bağla
-- supplier_id kolonunu doldur (eğer varsa)
UPDATE invoices
SET supplier_id = s.id
FROM suppliers s
WHERE invoices.supplier_name = s.name
  AND invoices.company_id = s.company_id
  AND (invoices.supplier_vkn IS NULL OR invoices.supplier_vkn = '')
  AND s.vkn IS NULL
  AND invoices.supplier_id IS NULL;

-- Kaç fatura linklendi?
SELECT COUNT(*) as linklenen_fatura_sayisi
FROM invoices
WHERE supplier_id IS NOT NULL
  AND updated_at > NOW() - INTERVAL '10 seconds';


-- 5. ÖZET RAPOR
-- ================================================

-- Supplier türlerine göre dağılım
SELECT 
  CASE 
    WHEN vkn IS NULL THEN 'VKN Yok'
    WHEN vkn IS NOT NULL THEN 'VKN Var'
  END as vkn_durumu,
  supplier_type,
  COUNT(*) as sayisi
FROM suppliers
GROUP BY 
  CASE 
    WHEN vkn IS NULL THEN 'VKN Yok'
    WHEN vkn IS NOT NULL THEN 'VKN Var'
  END,
  supplier_type
ORDER BY vkn_durumu, supplier_type;

-- Pending supplier'lar ve fatura sayıları
SELECT 
  s.name,
  s.vkn,
  COUNT(DISTINCT i.id) as fatura_sayisi,
  MIN(i.invoice_date) as ilk_fatura_tarihi,
  MAX(i.invoice_date) as son_fatura_tarihi
FROM suppliers s
LEFT JOIN invoices i ON (
  (i.supplier_vkn = s.vkn AND s.vkn IS NOT NULL) OR
  (i.supplier_name = s.name AND s.vkn IS NULL)
) AND i.company_id = s.company_id
WHERE s.supplier_type = 'pending'
GROUP BY s.id, s.name, s.vkn
ORDER BY COUNT(DISTINCT i.id) DESC
LIMIT 50;

-- ================================================
-- NOT: 
-- - VKN'siz firmalar için VKN NULL olarak kaydedilir
-- - Bu firmalar "Taşeron ve Firma Yönetimi" sayfasında görünür
-- - VKN sonradan manuel eklenebilir
-- - Unique constraint (company_id, vkn) nedeniyle aynı firma
--   birden fazla kez eklenemez
-- ================================================
