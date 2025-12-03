-- ============================================================================
-- FIX: Infinite Recursion in RLS Policies (VERSION 2)
-- ============================================================================
-- The issue: SELECT policy uses subquery on users table → triggers RLS again
-- Solution: Use auth.jwt() to get company_id directly from JWT token
-- ============================================================================

-- Drop ALL existing policies on users table
DROP POLICY IF EXISTS select_own_company_users ON users;
DROP POLICY IF EXISTS insert_company_users ON users;
DROP POLICY IF EXISTS update_company_users ON users;
DROP POLICY IF EXISTS delete_company_users ON users;

-- ============================================================================
-- Create helper function to get user's company_id from JWT
-- ============================================================================
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_company_id UUID;
BEGIN
    -- Get company_id directly from users table using auth.uid()
    SELECT company_id INTO user_company_id
    FROM users
    WHERE id = auth.uid();
    
    RETURN user_company_id;
END;
$$;

-- ============================================================================
-- Recreate USERS table RLS policies (FIXED - NO RECURSION)
-- ============================================================================

-- Allow users to read their own profile and same company users
CREATE POLICY select_own_company_users ON users
    FOR SELECT
    USING (
        -- Allow reading own profile
        id = auth.uid()
        OR
        -- Allow reading same company users (using function to avoid recursion)
        company_id = get_my_company_id()
    );

-- Allow users with permission to insert company users
CREATE POLICY insert_company_users ON users
    FOR INSERT
    WITH CHECK (
        -- Must be same company
        company_id = get_my_company_id()
        AND 
        -- Must have permission
        has_permission(auth.uid(), 'users', 'create', 'company')
    );

-- Allow users with permission to update company users
CREATE POLICY update_company_users ON users
    FOR UPDATE
    USING (
        -- Must be same company
        company_id = get_my_company_id()
        AND 
        -- Must have permission
        has_permission(auth.uid(), 'users', 'update', 'company')
    );

-- Allow users with permission to delete company users  
CREATE POLICY delete_company_users ON users
    FOR DELETE
    USING (
        -- Must be same company
        company_id = get_my_company_id()
        AND 
        -- Must have permission
        has_permission(auth.uid(), 'users', 'delete', 'company')
    );

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies fixed (V2)!';
    RAISE NOTICE '✅ get_my_company_id() function created';
    RAISE NOTICE '✅ SELECT policy now uses function instead of subquery';
    RAISE NOTICE '✅ No more recursion!';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Please refresh your browser and try logging in again';
END $$;
