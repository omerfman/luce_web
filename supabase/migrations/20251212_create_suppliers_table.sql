-- Create suppliers table for caching supplier information
-- VKN ile firma adını saklayacağız, tekrar API'ye gitmeyelim

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vkn VARCHAR(11) NOT NULL, -- Vergi Kimlik Numarası (10 or 11 digit)
  name VARCHAR(255) NOT NULL, -- Firma adı
  address TEXT, -- Adres (opsiyonel)
  tax_office VARCHAR(100), -- Vergi dairesi (opsiyonel)
  phone VARCHAR(20), -- Telefon
  email VARCHAR(255), -- E-posta
  notes TEXT, -- Notlar
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Her company için her VKN bir kez
  CONSTRAINT suppliers_company_vkn_unique UNIQUE (company_id, vkn)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_vkn ON suppliers(vkn);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- Comments
COMMENT ON TABLE suppliers IS 'Tedarikçi firma bilgileri cache (VKN bazlı)';
COMMENT ON COLUMN suppliers.vkn IS 'Vergi Kimlik Numarası (10-11 haneli)';
COMMENT ON COLUMN suppliers.name IS 'Firma ünvanı';
COMMENT ON COLUMN suppliers.address IS 'Firma adresi';
COMMENT ON COLUMN suppliers.tax_office IS 'Vergi dairesi';

-- RLS Policies
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Users can view suppliers in their company
DROP POLICY IF EXISTS suppliers_select_policy ON suppliers;
CREATE POLICY suppliers_select_policy ON suppliers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.company_id = suppliers.company_id
    )
  );

-- Users can insert suppliers in their company
DROP POLICY IF EXISTS suppliers_insert_policy ON suppliers;
CREATE POLICY suppliers_insert_policy ON suppliers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.company_id = suppliers.company_id
    )
  );

-- Users can update suppliers in their company
DROP POLICY IF EXISTS suppliers_update_policy ON suppliers;
CREATE POLICY suppliers_update_policy ON suppliers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.company_id = suppliers.company_id
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
