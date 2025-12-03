-- =====================================================
-- LUCE MİMARLIK İÇ İŞ AKIŞI SİSTEMİ
-- DATABASE MIGRATION - INITIAL SCHEMA
-- =====================================================
-- Version: 1.0
-- Date: 2025-12-03
-- Description: Initial database schema with all tables and relationships
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE project_status AS ENUM (
  'planned',
  'active',
  'on_hold',
  'completed',
  'cancelled'
);

-- =====================================================
-- COMPANIES TABLE
-- =====================================================

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT companies_name_unique UNIQUE (name)
);

-- Index for faster lookups
CREATE INDEX idx_companies_name ON companies(name);

COMMENT ON TABLE companies IS 'Şirket bilgileri - multi-tenancy için';
COMMENT ON COLUMN companies.settings IS 'Şirkete özel ayarlar (JSON)';

-- =====================================================
-- ROLES TABLE
-- =====================================================

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT roles_name_company_unique UNIQUE (name, company_id)
);

-- Indexes
CREATE INDEX idx_roles_company_id ON roles(company_id);
CREATE INDEX idx_roles_permissions ON roles USING GIN (permissions);

COMMENT ON TABLE roles IS 'Roller ve izinler - RBAC için';
COMMENT ON COLUMN roles.company_id IS 'NULL ise global rol (superadmin gibi)';
COMMENT ON COLUMN roles.permissions IS 'İzin listesi JSON array formatında';

-- =====================================================
-- USERS TABLE (extends auth.users)
-- =====================================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT users_email_unique UNIQUE (email)
);

-- Indexes
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_email ON users(email);

COMMENT ON TABLE users IS 'Kullanıcı profilleri - auth.users ile ilişkili';
COMMENT ON COLUMN users.id IS 'Supabase Auth user ID ile aynı';
COMMENT ON COLUMN users.meta IS 'Kullanıcıya özel metadata (JSON)';

-- =====================================================
-- PROJECTS TABLE
-- =====================================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status project_status NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT projects_end_after_start CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- Indexes
CREATE INDEX idx_projects_company_id ON projects(company_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_dates ON projects(start_date, end_date);

COMMENT ON TABLE projects IS 'Şirket projeleri';
COMMENT ON CONSTRAINT projects_end_after_start ON projects IS 'Bitiş tarihi başlangıçtan önce olamaz';

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INVOICES TABLE
-- =====================================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  pdf_url TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  date DATE NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT invoices_amount_positive CHECK (amount > 0)
);

-- Indexes
CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_invoices_uploaded_by ON invoices(uploaded_by_user_id);
CREATE INDEX idx_invoices_date ON invoices(date DESC);
CREATE INDEX idx_invoices_processed ON invoices(processed);
CREATE INDEX idx_invoices_metadata ON invoices USING GIN (metadata);

COMMENT ON TABLE invoices IS 'Fatura kayıtları ve PDF dosyaları';
COMMENT ON COLUMN invoices.pdf_url IS 'Supabase Storage URL';
COMMENT ON COLUMN invoices.processed IS 'Fatura projeye atanmış mı?';
COMMENT ON COLUMN invoices.metadata IS 'Tedarikçi, fatura no, vergi, notlar (JSON)';

-- =====================================================
-- INVOICE_PROJECT_LINKS TABLE
-- =====================================================

CREATE TABLE invoice_project_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  linked_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT invoice_project_links_unique UNIQUE (invoice_id, project_id)
);

-- Indexes
CREATE INDEX idx_invoice_project_links_invoice ON invoice_project_links(invoice_id);
CREATE INDEX idx_invoice_project_links_project ON invoice_project_links(project_id);
CREATE INDEX idx_invoice_project_links_user ON invoice_project_links(linked_by_user_id);

COMMENT ON TABLE invoice_project_links IS 'Fatura-Proje ilişkilendirmeleri';
COMMENT ON CONSTRAINT invoice_project_links_unique ON invoice_project_links IS 'Bir fatura aynı projeye birden fazla kez atanamaz';

-- Trigger to mark invoice as processed
CREATE OR REPLACE FUNCTION mark_invoice_processed()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoices SET processed = TRUE WHERE id = NEW.invoice_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mark_invoice_processed
  AFTER INSERT ON invoice_project_links
  FOR EACH ROW
  EXECUTE FUNCTION mark_invoice_processed();

-- =====================================================
-- AUDIT_LOGS TABLE
-- =====================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details JSONB,
  
  -- Partition key for better performance
  CONSTRAINT audit_logs_timestamp_check CHECK (timestamp <= NOW())
);

-- Indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

COMMENT ON TABLE audit_logs IS 'Denetim kayıtları - tüm önemli işlemler loglanır';
COMMENT ON COLUMN audit_logs.action IS 'Örn: invoice_uploaded, invoice_linked, project_created';
COMMENT ON COLUMN audit_logs.target_type IS 'Örn: invoice, project, user, role';
COMMENT ON COLUMN audit_logs.details IS 'İşleme özel detaylar (JSON)';

-- =====================================================
-- INITIAL DATA - DEFAULT ROLES
-- =====================================================

-- Global roles (company_id = NULL)
INSERT INTO roles (id, company_id, name, permissions) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'superadmin', 
   '[
     {"resource": "companies", "action": "manage", "scope": "all"},
     {"resource": "users", "action": "manage", "scope": "all"},
     {"resource": "roles", "action": "manage", "scope": "all"},
     {"resource": "projects", "action": "manage", "scope": "all"},
     {"resource": "invoices", "action": "manage", "scope": "all"},
     {"resource": "reports", "action": "manage", "scope": "all"}
   ]'::jsonb),
  
  ('00000000-0000-0000-0000-000000000002', NULL, 'şirket_yöneticisi', 
   '[
     {"resource": "users", "action": "manage", "scope": "company"},
     {"resource": "roles", "action": "manage", "scope": "company"},
     {"resource": "projects", "action": "manage", "scope": "company"},
     {"resource": "invoices", "action": "manage", "scope": "company"},
     {"resource": "reports", "action": "read", "scope": "company"}
   ]'::jsonb),
  
  ('00000000-0000-0000-0000-000000000003', NULL, 'muhasebe', 
   '[
     {"resource": "invoices", "action": "create", "scope": "company"},
     {"resource": "invoices", "action": "read", "scope": "company"},
     {"resource": "invoices", "action": "update", "scope": "company"},
     {"resource": "projects", "action": "read", "scope": "company"}
   ]'::jsonb),
  
  ('00000000-0000-0000-0000-000000000004', NULL, 'mimar', 
   '[
     {"resource": "projects", "action": "create", "scope": "company"},
     {"resource": "projects", "action": "read", "scope": "company"},
     {"resource": "projects", "action": "update", "scope": "company"},
     {"resource": "invoices", "action": "read", "scope": "company"},
     {"resource": "invoices", "action": "assign_project", "scope": "company"}
   ]'::jsonb),
  
  ('00000000-0000-0000-0000-000000000005', NULL, 'insaat_muhendisi', 
   '[
     {"resource": "projects", "action": "read", "scope": "company"},
     {"resource": "projects", "action": "update", "scope": "company"},
     {"resource": "invoices", "action": "read", "scope": "company"},
     {"resource": "invoices", "action": "assign_project", "scope": "company"}
   ]'::jsonb);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to get user's permissions
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  user_permissions JSONB;
BEGIN
  SELECT r.permissions INTO user_permissions
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = user_uuid;
  
  RETURN COALESCE(user_permissions, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_permissions IS 'Kullanıcının tüm izinlerini döndürür';

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION has_permission(
  user_uuid UUID,
  resource_name TEXT,
  action_name TEXT,
  scope_name TEXT DEFAULT 'company'
)
RETURNS BOOLEAN AS $$
DECLARE
  user_permissions JSONB;
  permission_exists BOOLEAN;
BEGIN
  user_permissions := get_user_permissions(user_uuid);
  
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(user_permissions) AS perm
    WHERE perm->>'resource' = resource_name
      AND perm->>'action' IN (action_name, 'manage')
      AND (perm->>'scope' = scope_name OR perm->>'scope' = 'all')
  ) INTO permission_exists;
  
  RETURN permission_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_permission IS 'Kullanıcının belirli bir izne sahip olup olmadığını kontrol eder';

-- =====================================================
-- COMPLETION
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Database schema created successfully!';
  RAISE NOTICE '📊 Tables: companies, roles, users, projects, invoices, invoice_project_links, audit_logs';
  RAISE NOTICE '🔐 Default roles created: superadmin, şirket_yöneticisi, muhasebe, mimar, insaat_muhendisi';
  RAISE NOTICE '⚠️  Next step: Configure Row-Level Security (RLS) policies';
END $$;
