-- ================================================
-- Tek Seferlik Script: Supplier İsimlerini Güncelle
-- ================================================
-- 
-- Amaç: invoices tablosundaki gerçek firma isimlerini kullanarak
-- suppliers tablosunda "Bilinmeyen Tedarikçi" olarak kayıtlı
-- firmaların isimlerini günceller.
--
-- Çalıştırma: Supabase SQL Editor'de çalıştırın
-- ================================================

-- 1. DURUM ANALİZİ
-- ================================================

-- Kaç tane "Bilinmeyen Tedarikçi" var?
SELECT 
  COUNT(*) as bilinmeyen_tedarikci_sayisi,
  COUNT(DISTINCT vkn) as unique_vkn_sayisi
FROM suppliers
WHERE name = 'Bilinmeyen Tedarikçi';

-- Bu VKN'lere sahip faturalarda gerçek firma isimleri var mı?
SELECT 
  s.vkn,
  s.name as supplier_name,
  i.supplier_name as invoice_supplier_name,
  COUNT(*) as invoice_count
FROM suppliers s
LEFT JOIN invoices i ON i.supplier_vkn = s.vkn AND i.company_id = s.company_id
WHERE s.name = 'Bilinmeyen Tedarikçi'
  AND i.supplier_name IS NOT NULL 
  AND i.supplier_name != ''
  AND i.supplier_name != 'Bilinmeyen Tedarikçi'
GROUP BY s.vkn, s.name, i.supplier_name
ORDER BY s.vkn;


-- 2. GÜNCELLEME İŞLEMİ
-- ================================================

-- suppliers tablosundaki "Bilinmeyen Tedarikçi" kayıtlarını
-- invoices tablosundaki gerçek firma isimleriyle güncelle
UPDATE suppliers
SET 
  name = subquery.real_supplier_name,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (s.id)
    s.id as supplier_id,
    i.supplier_name as real_supplier_name
  FROM suppliers s
  INNER JOIN invoices i ON i.supplier_vkn = s.vkn AND i.company_id = s.company_id
  WHERE s.name = 'Bilinmeyen Tedarikçi'
    AND i.supplier_name IS NOT NULL 
    AND i.supplier_name != ''
    AND i.supplier_name != 'Bilinmeyen Tedarikçi'
  ORDER BY s.id, i.created_at DESC -- En son eklenen faturadaki ismi kullan
) as subquery
WHERE suppliers.id = subquery.supplier_id;

-- Kaç kayıt güncellendi?
SELECT 
  COUNT(*) as guncellenen_kayit_sayisi
FROM suppliers
WHERE updated_at > NOW() - INTERVAL '10 seconds';


-- 3. DOĞRULAMA
-- ================================================

-- Güncellemeden sonra "Bilinmeyen Tedarikçi" kalan var mı?
SELECT 
  COUNT(*) as kalan_bilinmeyen_tedarikci
FROM suppliers
WHERE name = 'Bilinmeyen Tedarikçi';

-- Güncellenmiş kayıtları göster
SELECT 
  s.vkn,
  s.name as guncellenmis_isim,
  s.supplier_type,
  COUNT(i.id) as fatura_sayisi
FROM suppliers s
LEFT JOIN invoices i ON i.supplier_vkn = s.vkn AND i.company_id = s.company_id
WHERE s.updated_at > NOW() - INTERVAL '1 minute'
GROUP BY s.id, s.vkn, s.name, s.supplier_type
ORDER BY s.updated_at DESC;


-- 4. EK KONTROL: VKN'siz ama isimli tedarikçiler
-- ================================================

-- VKN'si olmayan ama faturalarda ismi olan tedarikçileri kontrol et
SELECT 
  supplier_name,
  COUNT(*) as fatura_sayisi
FROM invoices
WHERE (supplier_vkn IS NULL OR supplier_vkn = '')
  AND supplier_name IS NOT NULL
  AND supplier_name != ''
  AND supplier_name != 'Bilinmeyen Tedarikçi'
GROUP BY supplier_name
ORDER BY COUNT(*) DESC;

-- ================================================
-- NOT: 
-- - Bu script sadece VKN'si olan tedarikçileri günceller
-- - VKN'siz faturalar için manuel işlem gerekebilir
-- - Script birden fazla çalıştırılabilir (idempotent)
-- ================================================
