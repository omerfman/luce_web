-- Update RLS policies to be permission-based instead of role-based
-- Philosophy: Check if user HAS the permission, not what role they have

-- Helper function to check if user has a specific permission
CREATE OR REPLACE FUNCTION has_permission(
  user_id UUID,
  p_resource TEXT,
  p_action TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.id = user_id
    AND (
      -- Check role permissions
      r.permissions @> jsonb_build_array(
        jsonb_build_object('resource', p_resource, 'action', p_action)
      )
      -- OR check if wildcard permission exists in role
      OR r.permissions @> jsonb_build_array(
        jsonb_build_object('resource', '*', 'action', '*')
      )
      OR r.permissions @> jsonb_build_array(
        jsonb_build_object('resource', p_resource, 'action', '*')
      )
      -- Check custom permissions (added)
      OR u.meta->'custom_permissions' ? (
        SELECT id::text FROM permissions 
        WHERE resource = p_resource AND action = p_action
        LIMIT 1
      )
      -- Check if custom permission was NOT removed
      AND NOT (
        u.meta->'custom_permissions' ? ('remove:' || (
          SELECT id::text FROM permissions 
          WHERE resource = p_resource AND action = p_action
          LIMIT 1
        ))
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- INVOICES TABLE POLICIES
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view invoices in their company" ON invoices;
DROP POLICY IF EXISTS "Users can create invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete invoices" ON invoices;

-- Create new permission-based policies
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

-- ============================================
-- INVOICE_PROJECT_LINKS TABLE POLICIES
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view project links" ON invoice_project_links;
DROP POLICY IF EXISTS "Users can assign projects to invoices" ON invoice_project_links;
DROP POLICY IF EXISTS "Users can remove project assignments" ON invoice_project_links;

-- Create new permission-based policies
CREATE POLICY "Users with invoices.read can view project links"
ON invoice_project_links FOR SELECT
USING (
  has_permission(auth.uid(), 'invoices', 'read')
);

CREATE POLICY "Users with invoices.assign can assign projects"
ON invoice_project_links FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'invoices', 'assign')
);

CREATE POLICY "Users with invoices.assign can remove assignments"
ON invoice_project_links FOR DELETE
USING (
  has_permission(auth.uid(), 'invoices', 'assign')
);

-- ============================================
-- PROJECTS TABLE POLICIES
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view projects in their company" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can update projects" ON projects;
DROP POLICY IF EXISTS "Users can delete projects" ON projects;

-- Create new permission-based policies
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

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view users in their company" ON users;
DROP POLICY IF EXISTS "Users can create users" ON users;
DROP POLICY IF EXISTS "Users can update users" ON users;
DROP POLICY IF EXISTS "Users can delete users" ON users;

-- Create new permission-based policies
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

-- ============================================
-- ROLES TABLE POLICIES
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view roles" ON roles;
DROP POLICY IF EXISTS "Users can manage roles" ON roles;

-- Create new permission-based policies
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

-- ============================================
-- COMPANIES TABLE POLICIES
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their company" ON companies;
DROP POLICY IF EXISTS "Super admins can manage companies" ON companies;

-- Create new permission-based policies
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

-- Add helpful comments
COMMENT ON FUNCTION has_permission IS 'Check if a user has a specific permission (from role or custom permissions)';
