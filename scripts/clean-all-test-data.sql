-- =====================================================
-- TÜM TEST VERİLERİNİ TEMİZLE
-- =====================================================
-- UYARI: Bu script TÜM faturaları, ödemeleri ve ilişkili verileri SİLER!
-- Gerçek verilerle çalışmaya başlamadan önce çalıştırılmalıdır.
-- =====================================================
-- Tarih: 2 Ocak 2026
-- Amaç: Test/demo verilerini temizleyip sistemi production'a hazırlamak
-- =====================================================

-- Transaction başlat
BEGIN;

-- =====================================================
-- 1. FATURA İLİŞKİLİ VERİLERİ SİL
-- =====================================================

-- 1.1. Fatura-Proje bağlantılarını sil
DELETE FROM invoice_project_links;

-- 1.2. Ödemeleri sil
DELETE FROM payments WHERE invoice_id IS NOT NULL;

-- 1.3. Gayri resmi ödemeleri sil
DELETE FROM informal_payments;

-- 1.4. Faturaları sil
DELETE FROM invoices;

-- =====================================================
-- 2. TEDARİKÇİ VERİLERİNİ TEMİZLE (ATLANDI - KORUNACAK)
-- =====================================================

-- NOT: Tedarikçiler ve taşeronlar SİLİNMEZ, sistemde kalır
-- Sadece faturalarla ilişkileri kopar

-- 2.1. Taşeron bağlantılarını kopar (opsiyonel)
-- UPDATE suppliers SET subcontractor_id = NULL WHERE subcontractor_id IS NOT NULL;

-- 2.2. Taşeronları sil (YAPILMAYACAK - korundular)
-- DELETE FROM subcontractors;

-- 2.3. Tedarikçileri sil (YAPILMAYACAK - korundular)
-- DELETE FROM suppliers;

-- =====================================================
-- 3. AKTİVİTE LOGLARIarını TEMİZLE (opsiyonel)
-- =====================================================

-- 3.1. Fatura ile ilgili aktivite loglarını sil
-- NOT: activity_logs tablosu yoksa bu satırı yorum satırı olarak bırakın
-- DELETE FROM activity_logs 
-- WHERE action IN (
--   'invoice.uploaded', 
--   'invoice.deleted', 
--   'invoice.linked', 
--   'invoice.unlinked',
--   'payment.created',
--   'payment.updated',
--   'payment.deleted',
--   'informal_payment.created',
--   'informal_payment.updated',
--   'informal_payment.deleted',
--   'supplier.created',
--   'supplier.updated',
--   'supplier.assigned',
--   'subcontractor.created'
-- );

-- =====================================================
-- 4. PROJE VERİLERİNİ TEMİZLE (İSTEĞE BAĞLI)
-- =====================================================

-- Dikkat: Projeleri silmek isterseniz aşağıdaki satırların yorumunu kaldırın
-- Bu durumda TÜM projeler silinecektir!

-- DELETE FROM project_files;
-- DELETE FROM projects;

-- =====================================================
-- 5. VERİ BÜTÜNLÜĞÜ KONTROLLERI
-- =====================================================

-- Sequence'leri sıfırla (gerekirse)
-- ALTER SEQUENCE invoices_id_seq RESTART WITH 1;

-- =====================================================
-- 6. SONUÇ RAPORU
-- =====================================================

DO $$
DECLARE
  v_invoices_count INT;
  v_suppliers_count INT;
  v_subcontractors_count INT;
  v_payments_count INT;
  v_informal_payments_count INT;
  v_links_count INT;
  -- v_activity_logs_count INT;
BEGIN
  SELECT COUNT(*) INTO v_invoices_count FROM invoices;
  SELECT COUNT(*) INTO v_suppliers_count FROM suppliers;
  SELECT COUNT(*) INTO v_subcontractors_count FROM subcontractors;
  SELECT COUNT(*) INTO v_payments_count FROM payments;
  SELECT COUNT(*) INTO v_informal_payments_count FROM informal_payments;
  SELECT COUNT(*) INTO v_links_count FROM invoice_project_links;
  -- SELECT COUNT(*) INTO v_activity_logs_count FROM activity_logs 
  --   WHERE action LIKE '%invoice%' OR action LIKE '%payment%' OR action LIKE '%supplier%';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERİ TEMİZLEME RAPORU';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Kalan Faturalar: %', v_invoices_count;
  RAISE NOTICE 'Kalan Tedarikçiler: %', v_suppliers_count;
  RAISE NOTICE 'Kalan Taşeronlar: %', v_subcontractors_count;
  RAISE NOTICE 'Kalan Ödemeler: %', v_payments_count;
  RAISE NOTICE 'Kalan Gayri Resmi Ödemeler: %', v_informal_payments_count;
  RAISE NOTICE 'Kalan Fatura-Proje Bağlantıları: %', v_links_count;
  -- RAISE NOTICE 'İlişkili Aktivite Logları: %', v_activity_logs_count;
  RAISE NOTICE '========================================';
  
  IF v_invoices_count = 0 THEN
    RAISE NOTICE '✅ TÜM FATURA VERİLERİ BAŞARIYLA TEMİZLENDİ!';
    RAISE NOTICE 'ℹ️  Tedarikçiler ve taşeronlar korundu (silinmedi).';
  ELSE
    RAISE WARNING '⚠️ Bazı faturalar hala mevcut. Kontrol edin.';
  END IF;
END $$;

-- Transaction'ı onayla
-- ⚠️ DİKKAT: Bu satır aktif! Silme işlemi GERÇEKTEN yapılacak!
COMMIT;

-- Transaction'ı iptal etmek için (test amaçlı - şu anda pasif):
-- ROLLBACK;

-- =====================================================
-- KULLANIM TALİMATLARI
-- =====================================================
-- 
-- 1. Önce bu script'i ROLLBACK ile test edin:
--    - Script'in sonundaki COMMIT; satırını yorum satırı yapın
--    - ROLLBACK; satırını aktif edin
--    - Script'i çalıştırın ve raporu kontrol edin
--
-- 2. Sonuçlardan emin olduğunuzda:
--    - ROLLBACK; satırını yorum satırı yapın
--    - COMMIT; satırını aktif edin
--    - Script'i tekrar çalıştırın
--
-- 3. Storage'daki PDF dosyalarını manuel temizleyin:
--    - Supabase Dashboard > Storage > invoices bucket
--    - Tüm dosyaları seç ve sil
--    - VEYA aşağıdaki script'i kullanın
--
-- =====================================================

-- =====================================================
-- STORAGE TEMİZLEME (SUPABASE DASHBOARD'DA ÇALIŞTIRIN)
-- =====================================================

-- NOT: Bu bölüm Supabase SQL Editor'de çalışmayabilir.
-- Storage dosyalarını manuel olarak temizlemek için:
-- 1. Supabase Dashboard'a git
-- 2. Storage menüsüne tıkla
-- 3. 'invoices' bucket'ını aç
-- 4. Tüm klasörleri ve dosyaları seç
-- 5. "Delete" butonuna tıkla

-- Alternatif: API ile silme (TypeScript kod örneği)
/*
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function deleteAllInvoicePDFs() {
  const { data: files, error } = await supabase.storage
    .from('invoices')
    .list();
  
  if (error) {
    console.error('Error listing files:', error);
    return;
  }
  
  for (const file of files) {
    await supabase.storage
      .from('invoices')
      .remove([file.name]);
    console.log(`Deleted: ${file.name}`);
  }
  
  console.log('✅ All invoice PDFs deleted!');
}

deleteAllInvoicePDFs();
*/

-- =====================================================
-- VERİFİKASYON SORULARI (TEMİZLEME SONRASI)
-- =====================================================

-- Tüm faturaların silindiğini doğrula
SELECT COUNT(*) AS total_invoices FROM invoices;
-- Beklenen: 0

-- Tedarikçilerin korunduğunu doğrula (silinmedi)
SELECT COUNT(*) AS total_suppliers FROM suppliers;
-- Beklenen: > 0 (tedarikçiler korunur)

-- Taşeronların korunduğunu doğrula (silinmedi)
SELECT COUNT(*) AS total_subcontractors FROM subcontractors;
-- Beklenen: > 0 (taşeronlar korunur)

-- Tüm ödemelerin silindiğini doğrula
SELECT COUNT(*) AS total_payments FROM payments;
-- Beklenen: 0

-- Tüm gayri resmi ödemelerin silindiğini doğrula
SELECT COUNT(*) AS total_informal_payments FROM informal_payments;
-- Beklenen: 0

-- Tüm fatura-proje bağlantılarının silindiğini doğrula
SELECT COUNT(*) AS total_links FROM invoice_project_links;
-- Beklenen: 0

-- Kullanıcıların korunduğunu doğrula (silinmemeli)
SELECT COUNT(*) AS total_users FROM users;
-- Beklenen: > 0 (kullanıcılar korunur)

-- Projelerin durumu (isteğe bağlı silindi mi?)
SELECT COUNT(*) AS total_projects FROM projects;
-- Not: Projeleri silmediyseniz > 0 olmalı

-- =====================================================
-- NOTLAR
-- =====================================================
-- 
-- ✅ Silinecek Veriler:
--   - Tüm faturalar (invoices)
--   - Tüm ödemeler (payments)
--   - Tüm gayri resmi ödemeler (informal_payments)
--   - Tüm fatura-proje bağlantıları (invoice_project_links)
--   - İlişkili aktivite logları (activity_logs)
--   - Storage'daki tüm PDF dosyaları (manuel)
--
-- ⚠️ Korunacak Veriler:
--   - Kullanıcılar (users)
--   - Roller (roles)
--   - Şirketler (companies)
--   - Projeler (projects) - isteğe bağlı
--   - İzinler (permissions)
--   - Tedarikçiler (suppliers) ✨
--   - Taşeronlar (subcontractors) ✨
--
-- 🔒 Güvenlik:
--   - RLS policies değiştirilmez
--   - Tablo yapıları korunur
--   - Foreign key constraints korunur
--   - Sequence'ler devam eder (istenirse sıfırlanabilir)
--
-- =====================================================
