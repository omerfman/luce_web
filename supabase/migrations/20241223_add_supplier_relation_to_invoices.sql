-- ========================================
-- Invoices Tablosuna Supplier İlişkisi ve PDF URL Ekle
-- ========================================

-- 1. Supplier ilişkisi için supplier_id kolonu ekle
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- 2. NOT: file_path kolonu zaten var (ilk schema'da), bu adımı atla
-- PDF dosyası Cloudinary'de saklanır, file_path'e URL yazılır

-- 3. Index'ler oluştur (performans için)
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON invoices(supplier_id);

-- 4. Mevcut faturaları supplier'larla eşleştir (VKN bazlı)
-- supplier_vkn varsa ve suppliers tablosunda eşleşen kayıt varsa, supplier_id'yi set et
UPDATE invoices i
SET supplier_id = s.id
FROM suppliers s
WHERE i.supplier_vkn = s.vkn 
  AND i.company_id = s.company_id
  AND i.supplier_id IS NULL
  AND i.supplier_vkn IS NOT NULL;

-- 5. Yorumlar ekle
COMMENT ON COLUMN invoices.supplier_id IS 'Supplier tablosu ile ilişki (cache için)';
COMMENT ON COLUMN invoices.file_path IS 'PDF dosyasının Cloudinary URL''si (önceki: pdf_url)';

-- ========================================
-- Migration tamamlandı!
-- ========================================
