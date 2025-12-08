-- Add missing roles table policies to fix RLS error

-- Drop any existing roles policies
DROP POLICY IF EXISTS "Users with roles.read can view roles" ON roles;
DROP POLICY IF EXISTS "Users with roles.create can create roles" ON roles;
DROP POLICY IF EXISTS "Users with roles.update can update roles" ON roles;
DROP POLICY IF EXISTS "Users with roles.delete can delete roles" ON roles;

-- ROLES TABLE POLICIES
CREATE POLICY "Users with roles.read can view roles"
ON roles FOR SELECT
USING (
  has_permission(auth.uid(), 'roles', 'read')
  -- Roles can be global (company_id IS NULL) or company-specific
  AND (company_id IS NULL OR company_id = get_user_company_id(auth.uid()))
);

CREATE POLICY "Users with roles.create can create roles"
ON roles FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'roles', 'create')
  -- Can only create roles for their own company or global roles if they have permission
  AND (company_id IS NULL OR company_id = get_user_company_id(auth.uid()))
);

CREATE POLICY "Users with roles.update can update roles"
ON roles FOR UPDATE
USING (
  has_permission(auth.uid(), 'roles', 'update')
  AND (company_id IS NULL OR company_id = get_user_company_id(auth.uid()))
);

CREATE POLICY "Users with roles.delete can delete roles"
ON roles FOR DELETE
USING (
  has_permission(auth.uid(), 'roles', 'delete')
  AND (company_id IS NULL OR company_id = get_user_company_id(auth.uid()))
);
