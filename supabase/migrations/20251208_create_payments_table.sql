-- Create payments table for invoice payments
-- Each invoice can have multiple payments with different payment types

-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view payments in their company"
ON payments FOR SELECT
USING (
  has_permission(auth.uid(), 'invoices', 'read')
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users can create payments"
ON payments FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'invoices', 'update')
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users can update payments"
ON payments FOR UPDATE
USING (
  has_permission(auth.uid(), 'invoices', 'update')
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users can delete payments"
ON payments FOR DELETE
USING (
  has_permission(auth.uid(), 'invoices', 'delete')
  AND company_id = get_user_company_id(auth.uid())
);

-- Create indexes
CREATE INDEX idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX idx_payments_company_id ON public.payments(company_id);
CREATE INDEX idx_payments_payment_date ON public.payments(payment_date);

-- Add trigger for updated_at
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comment
COMMENT ON TABLE public.payments IS 'Stores payment records for invoices. Each invoice can have multiple payments with different payment types.';
