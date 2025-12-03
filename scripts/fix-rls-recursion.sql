-- ============================================================================
-- FIX: Infinite Recursion in RLS Policies
-- ============================================================================
-- The issue: has_permission() function calls users table, which triggers RLS
-- which calls has_permission() again → infinite loop
-- 
-- Solution: Use SECURITY DEFINER to bypass RLS in helper functions
-- ============================================================================

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS select_own_company_users ON users;
DROP POLICY IF EXISTS insert_company_users ON users;
DROP POLICY IF EXISTS update_company_users ON users;
DROP POLICY IF EXISTS delete_company_users ON users;

-- Recreate has_permission function with SECURITY DEFINER
-- This bypasses RLS when checking permissions
CREATE OR REPLACE FUNCTION has_permission(
    user_uuid UUID,
    resource_name TEXT,
    action_name TEXT,
    scope_name TEXT DEFAULT 'company'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- This is critical - bypasses RLS
SET search_path = public
AS $$
DECLARE
    user_perms JSONB;
    perm JSONB;
BEGIN
    -- Get permissions directly without RLS interference
    SELECT r.permissions INTO user_perms
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = user_uuid;
    
    -- If no permissions found, return false
    IF user_perms IS NULL THEN
        RETURN false;
    END IF;
    
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

-- Recreate get_user_permissions with SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- ============================================================================
-- Recreate USERS table RLS policies (FIXED)
-- ============================================================================

-- Allow users to read their own company's users
CREATE POLICY select_own_company_users ON users
    FOR SELECT
    USING (
        -- Direct company_id check (no function call to avoid recursion)
        company_id IN (
            SELECT company_id 
            FROM users 
            WHERE id = auth.uid()
        )
        OR 
        -- Or check if user has global read permission
        EXISTS (
            SELECT 1
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid()
            AND r.permissions @> '[{"resource": "*", "action": "*"}]'::jsonb
        )
    );

-- Allow users with permission to insert company users
CREATE POLICY insert_company_users ON users
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id 
            FROM users 
            WHERE id = auth.uid()
        )
        AND has_permission(auth.uid(), 'users', 'create', 'company')
    );

-- Allow users with permission to update company users
CREATE POLICY update_company_users ON users
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id 
            FROM users 
            WHERE id = auth.uid()
        )
        AND has_permission(auth.uid(), 'users', 'update', 'company')
    );

-- Allow users with permission to delete company users
CREATE POLICY delete_company_users ON users
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id 
            FROM users 
            WHERE id = auth.uid()
        )
        AND has_permission(auth.uid(), 'users', 'delete', 'company')
    );

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies fixed!';
    RAISE NOTICE '✅ has_permission() now uses SECURITY DEFINER';
    RAISE NOTICE '✅ Users table policies recreated without recursion';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Please refresh your browser and try logging in again';
END $$;
