-- ============================================================================
-- LUCE MİMARLIK - DATABASE SETUP SCRIPT
-- ============================================================================
-- Bu script tüm migration'ları ve initial data'yı sırasıyla yükler
-- 
-- KULLANIM:
-- 1. Supabase Dashboard → SQL Editor
-- 2. Bu dosyanın tamamını kopyala-yapıştır
-- 3. "Run" butonuna bas
-- 
-- NOT: Script idempotent değildir - sadece 1 kez çalıştırın!
-- ============================================================================

-- ============================================================================
-- PART 1: INITIAL SCHEMA (20251203_initial_schema.sql)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('active', 'completed', 'on_hold');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLE: companies
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    tax_number VARCHAR(50),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

-- ============================================================================
-- TABLE: roles
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, description, permissions) VALUES
    ('Super Admin', 'Tüm yetkilere sahip sistem yöneticisi', 
     '[
        {"resource": "*", "action": "*", "scope": "all"}
     ]'::jsonb),
    ('Admin', 'Şirket yöneticisi - şirket içi tüm yetkiler',
     '[
        {"resource": "companies", "action": "update", "scope": "own"},
        {"resource": "users", "action": "*", "scope": "company"},
        {"resource": "roles", "action": "read", "scope": "all"},
        {"resource": "projects", "action": "*", "scope": "company"},
        {"resource": "invoices", "action": "*", "scope": "company"}
     ]'::jsonb),
    ('Muhasebeci', 'Fatura ve finans yönetimi',
     '[
        {"resource": "invoices", "action": "*", "scope": "company"},
        {"resource": "projects", "action": "read", "scope": "company"},
        {"resource": "projects", "action": "link_invoice", "scope": "company"}
     ]'::jsonb),
    ('Proje Yöneticisi', 'Proje yönetimi ve fatura görüntüleme',
     '[
        {"resource": "projects", "action": "*", "scope": "company"},
        {"resource": "invoices", "action": "read", "scope": "company"},
        {"resource": "invoices", "action": "link_project", "scope": "company"}
     ]'::jsonb),
    ('Görüntüleyici', 'Sadece okuma yetkisi',
     '[
        {"resource": "projects", "action": "read", "scope": "company"},
        {"resource": "invoices", "action": "read", "scope": "company"}
     ]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- TABLE: users
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- TABLE: projects
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status project_status DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    budget DECIMAL(15, 2),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- ============================================================================
-- TABLE: invoices
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'TRY',
    invoice_date DATE NOT NULL,
    due_date DATE,
    status VARCHAR(50) DEFAULT 'pending',
    pdf_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_invoice_per_company UNIQUE(company_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);

-- ============================================================================
-- TABLE: invoice_project_links
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoice_project_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    allocated_amount DECIMAL(15, 2),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_invoice_project UNIQUE(invoice_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_links_invoice ON invoice_project_links(invoice_id);
CREATE INDEX IF NOT EXISTS idx_links_project ON invoice_project_links(project_id);

-- ============================================================================
-- TABLE: audit_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ============================================================================
-- FUNCTIONS: Permission Helpers
-- ============================================================================

-- Get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_permissions JSONB;
BEGIN
    SELECT r.permissions INTO user_permissions
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = user_uuid;
    
    RETURN COALESCE(user_permissions, '[]'::jsonb);
END;
$$;

-- Check if user has permission
CREATE OR REPLACE FUNCTION has_permission(
    user_uuid UUID,
    resource_name TEXT,
    action_name TEXT,
    scope_name TEXT DEFAULT 'company'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_perms JSONB;
    perm JSONB;
BEGIN
    user_perms := get_user_permissions(user_uuid);
    
    -- Check for wildcard permission
    IF user_perms @> '[{"resource": "*", "action": "*"}]'::jsonb THEN
        RETURN true;
    END IF;
    
    -- Check specific permission
    FOR perm IN SELECT * FROM jsonb_array_elements(user_perms)
    LOOP
        IF (perm->>'resource' = resource_name OR perm->>'resource' = '*')
           AND (perm->>'action' = action_name OR perm->>'action' = '*')
           AND (perm->>'scope' = scope_name OR perm->>'scope' = 'all')
        THEN
            RETURN true;
        END IF;
    END LOOP;
    
    RETURN false;
END;
$$;

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$ 
BEGIN
    DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
    CREATE TRIGGER update_companies_updated_at
        BEFORE UPDATE ON companies
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();

    DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
    CREATE TRIGGER update_roles_updated_at
        BEFORE UPDATE ON roles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();

    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();

    DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
    CREATE TRIGGER update_projects_updated_at
        BEFORE UPDATE ON projects
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();

    DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
    CREATE TRIGGER update_invoices_updated_at
        BEFORE UPDATE ON invoices
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

-- ============================================================================
-- TRIGGER: Auto-mark invoice as processed
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_invoice_processed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE invoices
    SET status = 'processed',
        metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{processed_at}',
            to_jsonb(NOW())
        )
    WHERE id = NEW.invoice_id
      AND status = 'pending';
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_mark_invoice_processed ON invoice_project_links;
CREATE TRIGGER auto_mark_invoice_processed
    AFTER INSERT ON invoice_project_links
    FOR EACH ROW EXECUTE FUNCTION mark_invoice_processed();

-- ============================================================================
-- PART 2: RLS POLICIES (20251203_rls_policies.sql)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_project_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN 
              ('companies', 'roles', 'users', 'projects', 'invoices', 'invoice_project_links', 'audit_logs'))
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS select_own_company ON ' || r.tablename;
        EXECUTE 'DROP POLICY IF EXISTS insert_own_company ON ' || r.tablename;
        EXECUTE 'DROP POLICY IF EXISTS update_own_company ON ' || r.tablename;
        EXECUTE 'DROP POLICY IF EXISTS delete_own_company ON ' || r.tablename;
        EXECUTE 'DROP POLICY IF EXISTS select_all_companies ON ' || r.tablename;
        EXECUTE 'DROP POLICY IF EXISTS insert_all_companies ON ' || r.tablename;
        EXECUTE 'DROP POLICY IF EXISTS update_all_companies ON ' || r.tablename;
        EXECUTE 'DROP POLICY IF EXISTS delete_all_companies ON ' || r.tablename;
    END LOOP;
END $$;

-- ============================================================================
-- COMPANIES POLICIES
-- ============================================================================

CREATE POLICY select_own_company ON companies
    FOR SELECT
    USING (
        id = (SELECT company_id FROM users WHERE id = auth.uid())
        OR has_permission(auth.uid(), 'companies', 'read', 'all')
    );

CREATE POLICY update_own_company ON companies
    FOR UPDATE
    USING (
        id = (SELECT company_id FROM users WHERE id = auth.uid())
        AND has_permission(auth.uid(), 'companies', 'update', 'own')
    );

-- ============================================================================
-- ROLES POLICIES
-- ============================================================================

CREATE POLICY select_all_roles ON roles
    FOR SELECT
    USING (true);

-- ============================================================================
-- USERS POLICIES
-- ============================================================================

CREATE POLICY select_own_company_users ON users
    FOR SELECT
    USING (
        company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        OR has_permission(auth.uid(), 'users', 'read', 'all')
    );

CREATE POLICY insert_company_users ON users
    FOR INSERT
    WITH CHECK (
        company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        AND has_permission(auth.uid(), 'users', 'create', 'company')
    );

CREATE POLICY update_company_users ON users
    FOR UPDATE
    USING (
        company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        AND has_permission(auth.uid(), 'users', 'update', 'company')
    );

CREATE POLICY delete_company_users ON users
    FOR DELETE
    USING (
        company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        AND has_permission(auth.uid(), 'users', 'delete', 'company')
    );

-- ============================================================================
-- PROJECTS POLICIES
-- ============================================================================

CREATE POLICY select_own_company_projects ON projects
    FOR SELECT
    USING (
        company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        OR has_permission(auth.uid(), 'projects', 'read', 'all')
    );

CREATE POLICY insert_company_projects ON projects
    FOR INSERT
    WITH CHECK (
        company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        AND has_permission(auth.uid(), 'projects', 'create', 'company')
    );

CREATE POLICY update_company_projects ON projects
    FOR UPDATE
    USING (
        company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        AND has_permission(auth.uid(), 'projects', 'update', 'company')
    );

CREATE POLICY delete_company_projects ON projects
    FOR DELETE
    USING (
        company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        AND has_permission(auth.uid(), 'projects', 'delete', 'company')
    );

-- ============================================================================
-- INVOICES POLICIES
-- ============================================================================

CREATE POLICY select_own_company_invoices ON invoices
    FOR SELECT
    USING (
        company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        OR has_permission(auth.uid(), 'invoices', 'read', 'all')
    );

CREATE POLICY insert_company_invoices ON invoices
    FOR INSERT
    WITH CHECK (
        company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        AND has_permission(auth.uid(), 'invoices', 'create', 'company')
    );

CREATE POLICY update_company_invoices ON invoices
    FOR UPDATE
    USING (
        company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        AND has_permission(auth.uid(), 'invoices', 'update', 'company')
    );

CREATE POLICY delete_company_invoices ON invoices
    FOR DELETE
    USING (
        company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        AND has_permission(auth.uid(), 'invoices', 'delete', 'company')
    );

-- ============================================================================
-- INVOICE_PROJECT_LINKS POLICIES
-- ============================================================================

CREATE POLICY select_own_company_links ON invoice_project_links
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM invoices i
            WHERE i.id = invoice_project_links.invoice_id
            AND i.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        )
    );

CREATE POLICY insert_company_links ON invoice_project_links
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM invoices i
            WHERE i.id = invoice_project_links.invoice_id
            AND i.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        )
        AND has_permission(auth.uid(), 'invoices', 'link_project', 'company')
    );

CREATE POLICY delete_company_links ON invoice_project_links
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM invoices i
            WHERE i.id = invoice_project_links.invoice_id
            AND i.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        )
        AND has_permission(auth.uid(), 'invoices', 'delete', 'company')
    );

-- ============================================================================
-- AUDIT_LOGS POLICIES
-- ============================================================================

CREATE POLICY select_own_company_audit_logs ON audit_logs
    FOR SELECT
    USING (
        company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        OR has_permission(auth.uid(), 'audit_logs', 'read', 'all')
    );

CREATE POLICY insert_audit_logs ON audit_logs
    FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- PART 3: STORAGE SETUP (20251203_storage_setup.sql)
-- ============================================================================

-- Create storage bucket for invoices
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'invoices',
    'invoices',
    false,
    5242880, -- 5MB
    ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for invoices bucket
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Company users can upload invoices" ON storage.objects;
    DROP POLICY IF EXISTS "Company users can view own invoices" ON storage.objects;
    DROP POLICY IF EXISTS "Company users can delete own invoices" ON storage.objects;
END $$;

CREATE POLICY "Company users can upload invoices"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'invoices'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (
        SELECT company_id::text 
        FROM users 
        WHERE id = auth.uid()
    )
);

CREATE POLICY "Company users can view own invoices"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'invoices'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (
        SELECT company_id::text 
        FROM users 
        WHERE id = auth.uid()
    )
);

CREATE POLICY "Company users can delete own invoices"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'invoices'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (
        SELECT company_id::text 
        FROM users 
        WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'invoices', 'delete', 'company')
);

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================

-- Verify setup
DO $$
DECLARE
    table_count INTEGER;
    role_count INTEGER;
    bucket_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('companies', 'roles', 'users', 'projects', 'invoices', 'invoice_project_links', 'audit_logs');
    
    SELECT COUNT(*) INTO role_count FROM roles;
    
    SELECT COUNT(*) INTO bucket_count FROM storage.buckets WHERE id = 'invoices';
    
    RAISE NOTICE '✅ Setup completed successfully!';
    RAISE NOTICE '   - Tables created: %', table_count;
    RAISE NOTICE '   - Default roles: %', role_count;
    RAISE NOTICE '   - Storage buckets: %', bucket_count;
    RAISE NOTICE '';
    RAISE NOTICE '📝 Next steps:';
    RAISE NOTICE '   1. Create first company';
    RAISE NOTICE '   2. Invite first user (superadmin@luce.com)';
    RAISE NOTICE '   3. Assign Super Admin role';
END $$;
