-- ========================================
-- Customers and Outgoing Invoices System
-- Date: 2026-02-02
-- Purpose: Add customers table and outgoing invoices functionality
-- ========================================

-- ========================================
-- 1. CREATE CUSTOMERS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vkn VARCHAR(11) NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  tax_office VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: company başına VKN unique olmalı
  CONSTRAINT unique_customer_vkn_per_company UNIQUE (company_id, vkn)
);

-- Indexes for customers
CREATE INDEX idx_customers_company_id ON public.customers(company_id);
CREATE INDEX idx_customers_vkn ON public.customers(vkn);
CREATE INDEX idx_customers_name ON public.customers(name);
CREATE INDEX idx_customers_is_active ON public.customers(is_active);

COMMENT ON TABLE public.customers IS 'Müşteri bilgileri (giden faturalar için)';
COMMENT ON COLUMN public.customers.vkn IS 'Müşteri Vergi Kimlik Numarası (10-11 haneli)';

-- ========================================
-- 2. CREATE OUTGOING_INVOICES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.outgoing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Fatura bilgileri
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  
  -- Müşteri bilgileri (QR'dan gelen veriler)
  customer_name TEXT,
  customer_vkn VARCHAR(11),
  
  -- Mali bilgiler
  goods_services_total DECIMAL(12, 2),
  vat_amount DECIMAL(12, 2),
  withholding_amount DECIMAL(12, 2),
  
  -- E-Fatura bilgileri
  invoice_ettn TEXT,
  invoice_type TEXT,
  invoice_scenario TEXT,
  buyer_vkn VARCHAR(11),
  currency VARCHAR(3) DEFAULT 'TRY',
  
  -- Dosya bilgileri
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  
  -- QR metadata
  qr_metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: company başına fatura numarası unique
  CONSTRAINT unique_outgoing_invoice_number_per_company UNIQUE (company_id, invoice_number),
  
  -- Check constraints
  CONSTRAINT outgoing_invoices_amount_positive CHECK (amount > 0)
);

-- Indexes for outgoing_invoices
CREATE INDEX idx_outgoing_invoices_company_id ON public.outgoing_invoices(company_id);
CREATE INDEX idx_outgoing_invoices_customer_id ON public.outgoing_invoices(customer_id);
CREATE INDEX idx_outgoing_invoices_invoice_number ON public.outgoing_invoices(invoice_number);
CREATE INDEX idx_outgoing_invoices_invoice_date ON public.outgoing_invoices(invoice_date DESC);
CREATE INDEX idx_outgoing_invoices_customer_vkn ON public.outgoing_invoices(customer_vkn);
CREATE INDEX idx_outgoing_invoices_qr_metadata ON public.outgoing_invoices USING GIN (qr_metadata);

COMMENT ON TABLE public.outgoing_invoices IS 'Giden faturalar (müşterilere kesilen faturalar)';
COMMENT ON COLUMN public.outgoing_invoices.customer_vkn IS 'QR koddan alınan müşteri VKN (alıcı)';

-- ========================================
-- 3. CREATE OUTGOING_INVOICE_PROJECT_LINKS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.outgoing_invoice_project_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outgoing_invoice_id UUID NOT NULL REFERENCES public.outgoing_invoices(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_outgoing_invoice_project UNIQUE (outgoing_invoice_id, project_id)
);

-- Indexes
CREATE INDEX idx_outgoing_invoice_project_links_invoice ON public.outgoing_invoice_project_links(outgoing_invoice_id);
CREATE INDEX idx_outgoing_invoice_project_links_project ON public.outgoing_invoice_project_links(project_id);

COMMENT ON TABLE public.outgoing_invoice_project_links IS 'Giden fatura - proje ilişkileri';

-- ========================================
-- 4. UPDATE TRIGGERS
-- ========================================
-- Updated_at trigger for customers
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Updated_at trigger for outgoing_invoices
CREATE TRIGGER update_outgoing_invoices_updated_at
  BEFORE UPDATE ON public.outgoing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outgoing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outgoing_invoice_project_links ENABLE ROW LEVEL SECURITY;

-- Customers policies
CREATE POLICY "Users can view customers in their company"
  ON public.customers FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert customers in their company"
  ON public.customers FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update customers in their company"
  ON public.customers FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete customers in their company"
  ON public.customers FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- Outgoing invoices policies
CREATE POLICY "Users can view outgoing invoices in their company"
  ON public.outgoing_invoices FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert outgoing invoices in their company"
  ON public.outgoing_invoices FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update outgoing invoices in their company"
  ON public.outgoing_invoices FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete outgoing invoices in their company"
  ON public.outgoing_invoices FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- Outgoing invoice project links policies
CREATE POLICY "Users can view outgoing invoice project links in their company"
  ON public.outgoing_invoice_project_links FOR SELECT
  USING (
    outgoing_invoice_id IN (
      SELECT id FROM public.outgoing_invoices 
      WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert outgoing invoice project links in their company"
  ON public.outgoing_invoice_project_links FOR INSERT
  WITH CHECK (
    outgoing_invoice_id IN (
      SELECT id FROM public.outgoing_invoices 
      WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete outgoing invoice project links in their company"
  ON public.outgoing_invoice_project_links FOR DELETE
  USING (
    outgoing_invoice_id IN (
      SELECT id FROM public.outgoing_invoices 
      WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  );

-- ========================================
-- 6. SUCCESS MESSAGE
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '✅ Customers and Outgoing Invoices migration completed successfully!';
  RAISE NOTICE '   - customers table created';
  RAISE NOTICE '   - outgoing_invoices table created';
  RAISE NOTICE '   - outgoing_invoice_project_links table created';
  RAISE NOTICE '   - RLS policies enabled';
END $$;
