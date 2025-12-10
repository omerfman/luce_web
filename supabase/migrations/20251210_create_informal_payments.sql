-- Create informal_payments table
-- Gayri resmi ödemeleri yönetmek için kullanılır
-- Taşeronlara yapılan ödemeleri takip eder

CREATE TABLE IF NOT EXISTS informal_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE RESTRICT,
  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
  description TEXT NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT,
  receipt_number TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_informal_payments_company_id ON informal_payments(company_id);
CREATE INDEX idx_informal_payments_project_id ON informal_payments(project_id);
CREATE INDEX idx_informal_payments_subcontractor_id ON informal_payments(subcontractor_id);
CREATE INDEX idx_informal_payments_payment_date ON informal_payments(payment_date);
CREATE INDEX idx_informal_payments_created_by ON informal_payments(created_by);

-- Enable Row Level Security
ALTER TABLE informal_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Company users can view their own company's payments
CREATE POLICY "Users can view own company payments"
  ON informal_payments FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Authenticated users can create payments for their company
CREATE POLICY "Users can create payments"
  ON informal_payments FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Users can update their own company's payments
CREATE POLICY "Users can update own company payments"
  ON informal_payments FOR UPDATE
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

-- Users can delete their own company's payments
CREATE POLICY "Users can delete own company payments"
  ON informal_payments FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_informal_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_informal_payments_updated_at
  BEFORE UPDATE ON informal_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_informal_payments_updated_at();

-- Add comments to table
COMMENT ON TABLE informal_payments IS 'Stores informal payments made to subcontractors';
COMMENT ON COLUMN informal_payments.project_id IS 'Optional reference to project - can be null for non-project payments';
COMMENT ON COLUMN informal_payments.subcontractor_id IS 'Reference to subcontractor - RESTRICT prevents deletion if payments exist';
COMMENT ON COLUMN informal_payments.amount IS 'Payment amount - must be non-negative';
COMMENT ON COLUMN informal_payments.payment_method IS 'Payment method (e.g., Nakit, Banka Transferi, Çek)';
COMMENT ON COLUMN informal_payments.receipt_number IS 'Receipt or transaction number for tracking';
