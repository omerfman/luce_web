-- Fix infinite recursion by making has_permission bypass RLS
-- The function needs to query users table without triggering RLS policies

-- Drop the problematic function
DROP FUNCTION IF EXISTS has_permission(UUID, TEXT, TEXT) CASCADE;

-- Recreate with proper security and RLS bypass
CREATE OR REPLACE FUNCTION has_permission(
  user_id UUID,
  p_resource TEXT,
  p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
-- This is critical: Set the search path for security
SET search_path = public
AS $$
DECLARE
  permission_id TEXT;
  has_perm BOOLEAN := FALSE;
  is_removed BOOLEAN := FALSE;
  user_company_id UUID;
  user_role_permissions JSONB;
  user_custom_permissions JSONB;
BEGIN
  -- Get user data WITHOUT triggering RLS (SECURITY DEFINER does this)
  -- We select directly without going through RLS policies
  SELECT 
    u.company_id,
    COALESCE(r.permissions, '[]'::jsonb),
    COALESCE(u.meta->'custom_permissions', '[]'::jsonb)
  INTO 
    user_company_id,
    user_role_permissions,
    user_custom_permissions
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  WHERE u.id = user_id;

  -- If user not found, return false
  IF user_company_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get permission ID for this resource+action
  SELECT id::text INTO permission_id
  FROM permissions
  WHERE resource = p_resource AND action = p_action
  LIMIT 1;

  -- Check role permissions
  has_perm := (
    user_role_permissions @> jsonb_build_array(
      jsonb_build_object('resource', p_resource, 'action', p_action)
    )
    OR user_role_permissions @> jsonb_build_array(
      jsonb_build_object('resource', '*', 'action', '*')
    )
    OR user_role_permissions @> jsonb_build_array(
      jsonb_build_object('resource', p_resource, 'action', '*')
    )
  );

  -- Check custom permissions (added)
  IF NOT has_perm AND permission_id IS NOT NULL THEN
    has_perm := user_custom_permissions ? permission_id;
  END IF;

  -- Check if permission was removed
  IF has_perm AND permission_id IS NOT NULL THEN
    is_removed := user_custom_permissions ? ('remove:' || permission_id);
  END IF;

  -- Return true if has permission and it's not removed
  RETURN has_perm AND NOT is_removed;
END;
$$;

-- Add helpful comment
COMMENT ON FUNCTION has_permission IS 'Check if a user has a specific permission (from role or custom permissions). Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION has_permission(UUID, TEXT, TEXT) TO authenticated;

-- Helper function to get user's company_id (also needs SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_user_company_id(user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM users WHERE id = user_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_user_company_id(UUID) TO authenticated;

-- ============================================
-- UPDATE ALL TABLE POLICIES TO USE HELPER FUNCTIONS
-- ============================================

-- INVOICES TABLE POLICIES
DROP POLICY IF EXISTS "Users with invoices.read can view invoices" ON invoices;
DROP POLICY IF EXISTS "Users with invoices.create can create invoices" ON invoices;
DROP POLICY IF EXISTS "Users with invoices.update can update invoices" ON invoices;
DROP POLICY IF EXISTS "Users with invoices.delete can delete invoices" ON invoices;

CREATE POLICY "Users with invoices.read can view invoices"
ON invoices FOR SELECT
USING (
  has_permission(auth.uid(), 'invoices', 'read')
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users with invoices.create can create invoices"
ON invoices FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'invoices', 'create')
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users with invoices.update can update invoices"
ON invoices FOR UPDATE
USING (
  has_permission(auth.uid(), 'invoices', 'update')
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users with invoices.delete can delete invoices"
ON invoices FOR DELETE
USING (
  has_permission(auth.uid(), 'invoices', 'delete')
  AND company_id = get_user_company_id(auth.uid())
);

-- INVOICE_PROJECT_LINKS TABLE POLICIES
DROP POLICY IF EXISTS "Users with invoices.read can view project links" ON invoice_project_links;
DROP POLICY IF EXISTS "Users with invoices.assign can assign projects" ON invoice_project_links;
DROP POLICY IF EXISTS "Users with invoices.assign can remove assignments" ON invoice_project_links;

CREATE POLICY "Users with invoices.read can view project links"
ON invoice_project_links FOR SELECT
USING (
  has_permission(auth.uid(), 'invoices', 'read')
  AND EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_project_links.invoice_id
    AND i.company_id = get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Users with invoices.assign can assign projects"
ON invoice_project_links FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'invoices', 'assign')
  AND EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_project_links.invoice_id
    AND i.company_id = get_user_company_id(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = invoice_project_links.project_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Users with invoices.assign can remove assignments"
ON invoice_project_links FOR DELETE
USING (
  has_permission(auth.uid(), 'invoices', 'assign')
  AND EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_project_links.invoice_id
    AND i.company_id = get_user_company_id(auth.uid())
  )
);

-- PROJECTS TABLE POLICIES
DROP POLICY IF EXISTS "Users with projects.read can view projects" ON projects;
DROP POLICY IF EXISTS "Users with projects.create can create projects" ON projects;
DROP POLICY IF EXISTS "Users with projects.update can update projects" ON projects;
DROP POLICY IF EXISTS "Users with projects.delete can delete projects" ON projects;

CREATE POLICY "Users with projects.read can view projects"
ON projects FOR SELECT
USING (
  has_permission(auth.uid(), 'projects', 'read')
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users with projects.create can create projects"
ON projects FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'projects', 'create')
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users with projects.update can update projects"
ON projects FOR UPDATE
USING (
  has_permission(auth.uid(), 'projects', 'update')
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users with projects.delete can delete projects"
ON projects FOR DELETE
USING (
  has_permission(auth.uid(), 'projects', 'delete')
  AND company_id = get_user_company_id(auth.uid())
);

-- USERS TABLE POLICIES
DROP POLICY IF EXISTS "Users with users.read can view users" ON users;
DROP POLICY IF EXISTS "Users with users.create can create users" ON users;
DROP POLICY IF EXISTS "Users with users.update can update users" ON users;
DROP POLICY IF EXISTS "Users with users.delete can delete users" ON users;

-- USERS TABLE POLICIES (recreated with helper function)
CREATE POLICY "Users with users.read can view users"
ON users FOR SELECT
USING (
  has_permission(auth.uid(), 'users', 'read')
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users with users.create can create users"
ON users FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'users', 'create')
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users with users.update can update users"
ON users FOR UPDATE
USING (
  has_permission(auth.uid(), 'users', 'update')
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users with users.delete can delete users"
ON users FOR DELETE
USING (
  has_permission(auth.uid(), 'users', 'delete')
  AND company_id = get_user_company_id(auth.uid())
);

-- COMPANIES TABLE POLICIES
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Users with companies.manage can manage companies" ON companies;

CREATE POLICY "Users can view their own company"
ON companies FOR SELECT
USING (
  id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users with companies.manage can manage companies"
ON companies FOR ALL
USING (
  has_permission(auth.uid(), 'companies', 'manage')
);
