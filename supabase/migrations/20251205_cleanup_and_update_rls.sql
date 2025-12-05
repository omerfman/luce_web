-- Clean up all existing has_permission functions and recreate properly
-- This fixes the "function is not unique" error

-- ============================================
-- STEP 1: Drop ALL existing has_permission functions
-- ============================================

-- Drop all variants of has_permission function
DROP FUNCTION IF EXISTS has_permission(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS has_permission(UUID, VARCHAR, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS has_permission CASCADE;

-- ============================================
-- STEP 2: Drop all existing RLS policies
-- ============================================

-- Invoices policies
DROP POLICY IF EXISTS "Users can view invoices in their company" ON invoices;
DROP POLICY IF EXISTS "Users can create invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete invoices" ON invoices;
DROP POLICY IF EXISTS "Users with invoices.read can view invoices" ON invoices;
DROP POLICY IF EXISTS "Users with invoices.create can create invoices" ON invoices;
DROP POLICY IF EXISTS "Users with invoices.update can update invoices" ON invoices;
DROP POLICY IF EXISTS "Users with invoices.delete can delete invoices" ON invoices;

-- Invoice_project_links policies
DROP POLICY IF EXISTS "Users can view project links" ON invoice_project_links;
DROP POLICY IF EXISTS "Users can assign projects to invoices" ON invoice_project_links;
DROP POLICY IF EXISTS "Users can remove project assignments" ON invoice_project_links;
DROP POLICY IF EXISTS "Users with invoices.read can view project links" ON invoice_project_links;
DROP POLICY IF EXISTS "Users with invoices.assign can assign projects" ON invoice_project_links;
DROP POLICY IF EXISTS "Users with invoices.assign can remove assignments" ON invoice_project_links;

-- Projects policies
DROP POLICY IF EXISTS "Users can view projects in their company" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can update projects" ON projects;
DROP POLICY IF EXISTS "Users can delete projects" ON projects;
DROP POLICY IF EXISTS "Users with projects.read can view projects" ON projects;
DROP POLICY IF EXISTS "Users with projects.create can create projects" ON projects;
DROP POLICY IF EXISTS "Users with projects.update can update projects" ON projects;
DROP POLICY IF EXISTS "Users with projects.delete can delete projects" ON projects;

-- Users policies
DROP POLICY IF EXISTS "Users can view users in their company" ON users;
DROP POLICY IF EXISTS "Users can create users" ON users;
DROP POLICY IF EXISTS "Users can update users" ON users;
DROP POLICY IF EXISTS "Users can delete users" ON users;
DROP POLICY IF EXISTS "Users with users.read can view users" ON users;
DROP POLICY IF EXISTS "Users with users.create can create users" ON users;
DROP POLICY IF EXISTS "Users with users.update can update users" ON users;
DROP POLICY IF EXISTS "Users with users.delete can delete users" ON users;

-- Roles policies
DROP POLICY IF EXISTS "Users can view roles" ON roles;
DROP POLICY IF EXISTS "Users can manage roles" ON roles;
DROP POLICY IF EXISTS "Users with roles.read can view roles" ON roles;
DROP POLICY IF EXISTS "Users with roles.create can create roles" ON roles;
DROP POLICY IF EXISTS "Users with roles.update can update roles" ON roles;
DROP POLICY IF EXISTS "Users with roles.delete can delete roles" ON roles;

-- Companies policies
DROP POLICY IF EXISTS "Users can view their company" ON companies;
DROP POLICY IF EXISTS "Super admins can manage companies" ON companies;
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Users with companies.manage can manage companies" ON companies;

-- ============================================
-- STEP 3: Create the new has_permission function
-- ============================================

CREATE OR REPLACE FUNCTION has_permission(
  user_id UUID,
  p_resource TEXT,
  p_action TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  permission_id TEXT;
  has_perm BOOLEAN := FALSE;
  is_removed BOOLEAN := FALSE;
BEGIN
  -- Get permission ID for this resource+action
  SELECT id::text INTO permission_id
  FROM permissions
  WHERE resource = p_resource AND action = p_action
  LIMIT 1;

  -- Check if user exists and get their permissions
  SELECT 
    -- Check role permissions
    COALESCE(
      r.permissions @> jsonb_build_array(
        jsonb_build_object('resource', p_resource, 'action', p_action)
      )
      OR r.permissions @> jsonb_build_array(
        jsonb_build_object('resource', '*', 'action', '*')
      )
      OR r.permissions @> jsonb_build_array(
        jsonb_build_object('resource', p_resource, 'action', '*')
      )
      -- Check custom permissions (added)
      OR (permission_id IS NOT NULL AND u.meta->'custom_permissions' ? permission_id),
      FALSE
    ),
    -- Check if permission was removed
    COALESCE(
      permission_id IS NOT NULL AND u.meta->'custom_permissions' ? ('remove:' || permission_id),
      FALSE
    )
  INTO has_perm, is_removed
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  WHERE u.id = user_id;

  -- Return true if has permission and it's not removed
  RETURN COALESCE(has_perm AND NOT is_removed, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comment
COMMENT ON FUNCTION has_permission IS 'Check if a user has a specific permission (from role or custom permissions)';

-- ============================================
-- STEP 4: Create all RLS policies
-- ============================================

-- INVOICES TABLE POLICIES
CREATE POLICY "Users with invoices.read can view invoices"
ON invoices FOR SELECT
USING (
  has_permission(auth.uid(), 'invoices', 'read')
  AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "Users with invoices.create can create invoices"
ON invoices FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'invoices', 'create')
  AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "Users with invoices.update can update invoices"
ON invoices FOR UPDATE
USING (
  has_permission(auth.uid(), 'invoices', 'update')
  AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "Users with invoices.delete can delete invoices"
ON invoices FOR DELETE
USING (
  has_permission(auth.uid(), 'invoices', 'delete')
  AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

-- INVOICE_PROJECT_LINKS TABLE POLICIES
CREATE POLICY "Users with invoices.read can view project links"
ON invoice_project_links FOR SELECT
USING (
  has_permission(auth.uid(), 'invoices', 'read')
  AND EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_project_links.invoice_id
    AND i.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  )
);

CREATE POLICY "Users with invoices.assign can assign projects"
ON invoice_project_links FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'invoices', 'assign')
  AND EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_project_links.invoice_id
    AND i.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = invoice_project_links.project_id
    AND p.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  )
);

CREATE POLICY "Users with invoices.assign can remove assignments"
ON invoice_project_links FOR DELETE
USING (
  has_permission(auth.uid(), 'invoices', 'assign')
  AND EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_project_links.invoice_id
    AND i.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  )
);

-- PROJECTS TABLE POLICIES
CREATE POLICY "Users with projects.read can view projects"
ON projects FOR SELECT
USING (
  has_permission(auth.uid(), 'projects', 'read')
  AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "Users with projects.create can create projects"
ON projects FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'projects', 'create')
  AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "Users with projects.update can update projects"
ON projects FOR UPDATE
USING (
  has_permission(auth.uid(), 'projects', 'update')
  AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "Users with projects.delete can delete projects"
ON projects FOR DELETE
USING (
  has_permission(auth.uid(), 'projects', 'delete')
  AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

-- USERS TABLE POLICIES
CREATE POLICY "Users with users.read can view users"
ON users FOR SELECT
USING (
  has_permission(auth.uid(), 'users', 'read')
  AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "Users with users.create can create users"
ON users FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'users', 'create')
  AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "Users with users.update can update users"
ON users FOR UPDATE
USING (
  has_permission(auth.uid(), 'users', 'update')
  AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "Users with users.delete can delete users"
ON users FOR DELETE
USING (
  has_permission(auth.uid(), 'users', 'delete')
  AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

-- ROLES TABLE POLICIES
CREATE POLICY "Users with roles.read can view roles"
ON roles FOR SELECT
USING (
  has_permission(auth.uid(), 'roles', 'read')
);

CREATE POLICY "Users with roles.create can create roles"
ON roles FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'roles', 'create')
);

CREATE POLICY "Users with roles.update can update roles"
ON roles FOR UPDATE
USING (
  has_permission(auth.uid(), 'roles', 'update')
);

CREATE POLICY "Users with roles.delete can delete roles"
ON roles FOR DELETE
USING (
  has_permission(auth.uid(), 'roles', 'delete')
);

-- COMPANIES TABLE POLICIES
CREATE POLICY "Users can view their own company"
ON companies FOR SELECT
USING (
  id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "Users with companies.manage can manage companies"
ON companies FOR ALL
USING (
  has_permission(auth.uid(), 'companies', 'manage')
);
