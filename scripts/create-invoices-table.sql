-- ============================================================================
-- Create invoices table and related tables
-- ============================================================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS invoice_project_links CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;

-- Invoices table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    uploaded_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, invoice_number)
);

-- Invoice-Project links (many-to-many)
CREATE TABLE invoice_project_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(invoice_id, project_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_uploaded_by ON invoices(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_invoice_project_links_invoice ON invoice_project_links(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_project_links_project ON invoice_project_links(project_id);

-- RLS Policies
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_project_links ENABLE ROW LEVEL SECURITY;

-- Invoices policies
DROP POLICY IF EXISTS select_own_company_invoices ON invoices;
CREATE POLICY select_own_company_invoices ON invoices
    FOR SELECT
    USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS insert_own_company_invoices ON invoices;
CREATE POLICY insert_own_company_invoices ON invoices
    FOR INSERT
    WITH CHECK (
        company_id = get_my_company_id()
        AND has_permission(auth.uid(), 'invoices', 'create', 'company')
    );

DROP POLICY IF EXISTS update_own_company_invoices ON invoices;
CREATE POLICY update_own_company_invoices ON invoices
    FOR UPDATE
    USING (
        company_id = get_my_company_id()
        AND has_permission(auth.uid(), 'invoices', 'update', 'company')
    );

DROP POLICY IF EXISTS delete_own_company_invoices ON invoices;
CREATE POLICY delete_own_company_invoices ON invoices
    FOR DELETE
    USING (
        company_id = get_my_company_id()
        AND has_permission(auth.uid(), 'invoices', 'delete', 'company')
    );

-- Invoice-Project links policies
DROP POLICY IF EXISTS select_own_company_invoice_links ON invoice_project_links;
CREATE POLICY select_own_company_invoice_links ON invoice_project_links
    FOR SELECT
    USING (
        invoice_id IN (
            SELECT id FROM invoices WHERE company_id = get_my_company_id()
        )
    );

DROP POLICY IF EXISTS insert_own_company_invoice_links ON invoice_project_links;
CREATE POLICY insert_own_company_invoice_links ON invoice_project_links
    FOR INSERT
    WITH CHECK (
        invoice_id IN (
            SELECT id FROM invoices WHERE company_id = get_my_company_id()
        )
        AND has_permission(auth.uid(), 'invoices', 'create', 'company')
    );

DROP POLICY IF EXISTS delete_own_company_invoice_links ON invoice_project_links;
CREATE POLICY delete_own_company_invoice_links ON invoice_project_links
    FOR DELETE
    USING (
        invoice_id IN (
            SELECT id FROM invoices WHERE company_id = get_my_company_id()
        )
        AND has_permission(auth.uid(), 'invoices', 'delete', 'company')
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Verify
SELECT 'Invoices table created!' as status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'invoices' 
ORDER BY ordinal_position;
