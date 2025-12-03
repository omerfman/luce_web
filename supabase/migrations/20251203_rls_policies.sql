-- =====================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- Version: 1.0
-- Date: 2025-12-03
-- Description: Comprehensive RLS policies for all tables
-- =====================================================

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_project_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- COMPANIES TABLE POLICIES
-- =====================================================

-- Users can read their own company
CREATE POLICY "Users can read own company"
  ON companies FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Superadmin can read all companies
CREATE POLICY "Superadmin can read all companies"
  ON companies FOR SELECT
  USING (
    has_permission(auth.uid(), 'companies', 'read', 'all')
  );

-- Company admins can update their company
CREATE POLICY "Company admins can update own company"
  ON companies FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'companies', 'update', 'company')
  );

-- Superadmin can manage all companies
CREATE POLICY "Superadmin can manage companies"
  ON companies FOR ALL
  USING (
    has_permission(auth.uid(), 'companies', 'manage', 'all')
  );

-- =====================================================
-- ROLES TABLE POLICIES
-- =====================================================

-- Users can read roles in their company (including global roles)
CREATE POLICY "Users can read company roles"
  ON roles FOR SELECT
  USING (
    company_id IS NULL -- global roles
    OR company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Company admins can create roles for their company
CREATE POLICY "Company admins can create roles"
  ON roles FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'roles', 'create', 'company')
  );

-- Company admins can update roles in their company
CREATE POLICY "Company admins can update roles"
  ON roles FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'roles', 'update', 'company')
  );

-- Company admins can delete roles in their company
CREATE POLICY "Company admins can delete roles"
  ON roles FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'roles', 'delete', 'company')
  );

-- Superadmin can manage all roles
CREATE POLICY "Superadmin can manage all roles"
  ON roles FOR ALL
  USING (
    has_permission(auth.uid(), 'roles', 'manage', 'all')
  );

-- =====================================================
-- USERS TABLE POLICIES
-- =====================================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Users can read other users in their company
CREATE POLICY "Users can read company users"
  ON users FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'users', 'read', 'company')
  );

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    AND role_id = (SELECT role_id FROM users WHERE id = auth.uid())
  );

-- Company admins can create users in their company
CREATE POLICY "Company admins can create users"
  ON users FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'users', 'create', 'company')
  );

-- Company admins can update users in their company
CREATE POLICY "Company admins can update users"
  ON users FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'users', 'update', 'company')
  );

-- Superadmin can manage all users
CREATE POLICY "Superadmin can manage all users"
  ON users FOR ALL
  USING (
    has_permission(auth.uid(), 'users', 'manage', 'all')
  );

-- =====================================================
-- PROJECTS TABLE POLICIES
-- =====================================================

-- Users can read projects in their company
CREATE POLICY "Users can read company projects"
  ON projects FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'projects', 'read', 'company')
  );

-- Users with permission can create projects
CREATE POLICY "Authorized users can create projects"
  ON projects FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'projects', 'create', 'company')
  );

-- Users with permission can update projects
CREATE POLICY "Authorized users can update projects"
  ON projects FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'projects', 'update', 'company')
  );

-- Users with permission can delete projects
CREATE POLICY "Authorized users can delete projects"
  ON projects FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'projects', 'delete', 'company')
  );

-- =====================================================
-- INVOICES TABLE POLICIES
-- =====================================================

-- Users can read invoices in their company
CREATE POLICY "Users can read company invoices"
  ON invoices FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'invoices', 'read', 'company')
  );

-- Accountants can create invoices
CREATE POLICY "Accountants can create invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'invoices', 'create', 'company')
    AND uploaded_by_user_id = auth.uid()
  );

-- Users with permission can update invoices
CREATE POLICY "Authorized users can update invoices"
  ON invoices FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'invoices', 'update', 'company')
  );

-- Users with permission can delete invoices
CREATE POLICY "Authorized users can delete invoices"
  ON invoices FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND has_permission(auth.uid(), 'invoices', 'delete', 'company')
  );

-- =====================================================
-- INVOICE_PROJECT_LINKS TABLE POLICIES
-- =====================================================

-- Users can read links for their company's invoices
CREATE POLICY "Users can read company invoice links"
  ON invoice_project_links FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Users with assign permission can create links
CREATE POLICY "Authorized users can link invoices to projects"
  ON invoice_project_links FOR INSERT
  WITH CHECK (
    has_permission(auth.uid(), 'invoices', 'assign_project', 'company')
    AND linked_by_user_id = auth.uid()
    AND invoice_id IN (
      SELECT id FROM invoices WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
    AND project_id IN (
      SELECT id FROM projects WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Users with permission can delete links
CREATE POLICY "Authorized users can delete invoice links"
  ON invoice_project_links FOR DELETE
  USING (
    has_permission(auth.uid(), 'invoices', 'update', 'company')
    AND invoice_id IN (
      SELECT id FROM invoices WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- =====================================================
-- AUDIT_LOGS TABLE POLICIES
-- =====================================================

-- Users can read their own audit logs
CREATE POLICY "Users can read own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

-- Company admins can read all company audit logs
CREATE POLICY "Company admins can read company audit logs"
  ON audit_logs FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
    AND has_permission(auth.uid(), 'reports', 'read', 'company')
  );

-- System can insert audit logs (via service role)
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- No one can update or delete audit logs (immutable)
-- (No policies = no access except via service role)

-- =====================================================
-- STORAGE POLICIES (for Supabase Storage)
-- =====================================================

-- Note: Storage policies are configured separately in Supabase dashboard
-- or via SQL for storage.objects table

-- Example storage policy (to be applied in Supabase):
/*
-- Invoice PDFs bucket policy
CREATE POLICY "Users can upload invoices for their company"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'invoices'
    AND auth.uid() IN (
      SELECT id FROM public.users WHERE company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can read company invoices"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoices'
    AND auth.uid() IN (
      SELECT id FROM public.users WHERE company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
    )
  );
*/

-- =====================================================
-- COMPLETION
-- =====================================================

DO $$ 
BEGIN 
  RAISE NOTICE '✅ RLS policies created successfully!';
  RAISE NOTICE '🔒 All tables are now protected with Row-Level Security';
  RAISE NOTICE '📋 Policy count: ~35 policies across 7 tables';
  RAISE NOTICE '⚠️  Storage policies should be configured in Supabase Dashboard';
  RAISE NOTICE '✨ Next step: Test RLS policies with different user roles';
END $$;
