-- ========================================
-- Taşeron ve Fatura Firmaları Yönetim Sistemi
-- Database Migration Script
-- ========================================

-- 1. Suppliers tablosuna yeni alanlar ekle
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS supplier_type VARCHAR(20) DEFAULT 'pending' CHECK (supplier_type IN ('pending', 'subcontractor', 'invoice_company')),
ADD COLUMN IF NOT EXISTS subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Index'ler oluştur (performans için)
CREATE INDEX IF NOT EXISTS idx_suppliers_type ON suppliers(supplier_type);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_type ON suppliers(company_id, supplier_type);
CREATE INDEX IF NOT EXISTS idx_suppliers_subcontractor ON suppliers(subcontractor_id);

-- 3. Mevcut supplier kayıtlarını güncelle (eğer varsa)
-- Tüm mevcut kayıtlar 'pending' olarak işaretlenecek
UPDATE suppliers 
SET supplier_type = 'pending', 
    is_active = true
WHERE supplier_type IS NULL;

-- 4. RLS (Row Level Security) politikalarını güncelle
-- Suppliers tablosu için SELECT politikası
DROP POLICY IF EXISTS "Users can view suppliers in their company" ON suppliers;
CREATE POLICY "Users can view suppliers in their company" 
ON suppliers FOR SELECT 
TO authenticated 
USING (company_id IN (
  SELECT company_id FROM users WHERE id = auth.uid()
));

-- Suppliers tablosu için INSERT politikası
DROP POLICY IF EXISTS "Users can insert suppliers in their company" ON suppliers;
CREATE POLICY "Users can insert suppliers in their company" 
ON suppliers FOR INSERT 
TO authenticated 
WITH CHECK (company_id IN (
  SELECT company_id FROM users WHERE id = auth.uid()
));

-- Suppliers tablosu için UPDATE politikası
DROP POLICY IF EXISTS "Users can update suppliers in their company" ON suppliers;
CREATE POLICY "Users can update suppliers in their company" 
ON suppliers FOR UPDATE 
TO authenticated 
USING (company_id IN (
  SELECT company_id FROM users WHERE id = auth.uid()
))
WITH CHECK (company_id IN (
  SELECT company_id FROM users WHERE id = auth.uid()
));

-- Suppliers tablosu için DELETE politikası
DROP POLICY IF EXISTS "Users can delete suppliers in their company" ON suppliers;
CREATE POLICY "Users can delete suppliers in their company" 
ON suppliers FOR DELETE 
TO authenticated 
USING (company_id IN (
  SELECT company_id FROM users WHERE id = auth.uid()
));

-- 5. Subcontractors tablosuna supplier_id referansı ekle (iki yönlü bağlantı için)
ALTER TABLE subcontractors 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subcontractors_supplier ON subcontractors(supplier_id);

-- 6. Trigger: Supplier type değiştiğinde ilgili tabloları senkronize et
CREATE OR REPLACE FUNCTION sync_supplier_subcontractor()
RETURNS TRIGGER AS $$
BEGIN
  -- Eğer supplier taşeron olarak işaretlendiyse ve subcontractor_id varsa
  IF NEW.supplier_type = 'subcontractor' AND NEW.subcontractor_id IS NOT NULL THEN
    -- Subcontractor kaydının supplier_id'sini güncelle
    UPDATE subcontractors 
    SET supplier_id = NEW.id,
        tax_number = NEW.vkn,
        name = NEW.name,
        updated_at = NOW()
    WHERE id = NEW.subcontractor_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_sync_supplier_subcontractor ON suppliers;
CREATE TRIGGER trigger_sync_supplier_subcontractor
AFTER UPDATE ON suppliers
FOR EACH ROW
WHEN (OLD.supplier_type IS DISTINCT FROM NEW.supplier_type OR 
      OLD.subcontractor_id IS DISTINCT FROM NEW.subcontractor_id)
EXECUTE FUNCTION sync_supplier_subcontractor();

-- 7. View: Tüm firmaları tipine göre görüntüle
CREATE OR REPLACE VIEW v_supplier_overview AS
SELECT 
  s.id,
  s.company_id,
  s.vkn,
  s.name,
  s.supplier_type,
  s.is_active,
  s.subcontractor_id,
  s.created_at,
  s.updated_at,
  sc.name as subcontractor_name,
  sc.is_active as subcontractor_active,
  COUNT(DISTINCT i.id) as invoice_count,
  SUM(i.amount) as total_invoice_amount
FROM suppliers s
LEFT JOIN subcontractors sc ON s.subcontractor_id = sc.id
LEFT JOIN invoices i ON i.supplier_vkn = s.vkn AND i.company_id = s.company_id
GROUP BY s.id, s.company_id, s.vkn, s.name, s.supplier_type, s.is_active, 
         s.subcontractor_id, s.created_at, s.updated_at, sc.name, sc.is_active;

-- 8. İstatistik fonksiyonu: Supplier tipine göre sayıları getir
CREATE OR REPLACE FUNCTION get_supplier_stats(p_company_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'pending', COUNT(*) FILTER (WHERE supplier_type = 'pending'),
    'subcontractor', COUNT(*) FILTER (WHERE supplier_type = 'subcontractor'),
    'invoice_company', COUNT(*) FILTER (WHERE supplier_type = 'invoice_company'),
    'total', COUNT(*),
    'active', COUNT(*) FILTER (WHERE is_active = true)
  )
  INTO result
  FROM suppliers
  WHERE company_id = p_company_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- Migration tamamlandı!
-- ========================================
