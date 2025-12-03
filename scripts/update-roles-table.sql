-- Add company_id to roles table
ALTER TABLE roles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX IF NOT EXISTS idx_roles_company ON roles(company_id);

-- Update RLS policies for roles table
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view roles from their company or global roles
DROP POLICY IF EXISTS select_roles ON roles;
CREATE POLICY select_roles ON roles
    FOR SELECT
    USING (
        company_id IS NULL 
        OR company_id = get_my_company_id()
    );

-- Policy: Only super admins can create global roles, company admins can create company roles
DROP POLICY IF EXISTS insert_roles ON roles;
CREATE POLICY insert_roles ON roles
    FOR INSERT
    WITH CHECK (
        (company_id IS NULL AND has_permission(auth.uid(), '*', '*', 'all'))
        OR (company_id = get_my_company_id() AND has_permission(auth.uid(), 'roles', 'create', 'company'))
    );

-- Policy: Only super admins can update global roles, company admins can update company roles
DROP POLICY IF EXISTS update_roles ON roles;
CREATE POLICY update_roles ON roles
    FOR UPDATE
    USING (
        (company_id IS NULL AND has_permission(auth.uid(), '*', '*', 'all'))
        OR (company_id = get_my_company_id() AND has_permission(auth.uid(), 'roles', 'update', 'company'))
    );

-- Policy: Only super admins can delete global roles, company admins can delete company roles
DROP POLICY IF EXISTS delete_roles ON roles;
CREATE POLICY delete_roles ON roles
    FOR DELETE
    USING (
        (company_id IS NULL AND has_permission(auth.uid(), '*', '*', 'all'))
        OR (company_id = get_my_company_id() AND has_permission(auth.uid(), 'roles', 'delete', 'company'))
    );

-- Verify
SELECT 'Roles table updated!' as status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'roles' 
ORDER BY ordinal_position;
