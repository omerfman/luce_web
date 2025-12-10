-- Create subcontractors table
-- Taşeronları yönetmek için kullanılır
-- Her şirket kendi taşeronlarını yönetir

CREATE TABLE IF NOT EXISTS subcontractors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  tax_number TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_subcontractors_company_id ON subcontractors(company_id);
CREATE INDEX idx_subcontractors_name ON subcontractors(name);
CREATE INDEX idx_subcontractors_is_active ON subcontractors(is_active);

-- Enable Row Level Security
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Company users can view their own company's subcontractors
CREATE POLICY "Users can view own company subcontractors"
  ON subcontractors FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Authenticated users can create subcontractors for their company
CREATE POLICY "Users can create subcontractors"
  ON subcontractors FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can update their own company's subcontractors
CREATE POLICY "Users can update own company subcontractors"
  ON subcontractors FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can delete their own company's subcontractors (soft delete recommended)
CREATE POLICY "Users can delete own company subcontractors"
  ON subcontractors FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_subcontractors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_subcontractors_updated_at
  BEFORE UPDATE ON subcontractors
  FOR EACH ROW
  EXECUTE FUNCTION update_subcontractors_updated_at();

-- Add comment to table
COMMENT ON TABLE subcontractors IS 'Stores subcontractor information for each company';
COMMENT ON COLUMN subcontractors.company_id IS 'Reference to the company that owns this subcontractor';
COMMENT ON COLUMN subcontractors.is_active IS 'Soft delete flag - false means inactive/deleted';
