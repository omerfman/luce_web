-- ============================================================================
-- Create Company Admin User (Complete Process)
-- ============================================================================
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Create Test Company
INSERT INTO companies (name, is_active)
VALUES ('Test Şirketi', true)
ON CONFLICT DO NOTHING
RETURNING id, name;

-- Step 2: After creating user in Auth UI, update their profile
-- Replace 'USER_ID_FROM_AUTH' with actual user ID from Supabase Auth

-- First, let's prepare the IDs
DO $$
DECLARE
    company_admin_role_id UUID;
    test_company_id UUID;
BEGIN
    -- Get Company Admin role
    SELECT id INTO company_admin_role_id FROM roles WHERE name = 'Company Admin';
    
    -- Get Test Company
    SELECT id INTO test_company_id FROM companies WHERE name = 'Test Şirketi';
    
    RAISE NOTICE '';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'STEP-BY-STEP GUIDE TO CREATE COMPANY ADMIN';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE '';
    RAISE NOTICE '1. Go to Supabase Dashboard → Authentication → Users';
    RAISE NOTICE '   https://supabase.com/dashboard/project/plwmqofncmkgxhushucg/auth/users';
    RAISE NOTICE '';
    RAISE NOTICE '2. Click "Add User" → "Create new user"';
    RAISE NOTICE '   Email: admin@testcompany.com';
    RAISE NOTICE '   Password: test123456';
    RAISE NOTICE '   ✓ Auto Confirm User';
    RAISE NOTICE '';
    RAISE NOTICE '3. After creating, copy the User ID and run:';
    RAISE NOTICE '';
    RAISE NOTICE '   INSERT INTO users (id, email, name, role_id, company_id, is_active)';
    RAISE NOTICE '   VALUES (';
    RAISE NOTICE '     ''USER_ID_FROM_AUTH'',';
    RAISE NOTICE '     ''admin@testcompany.com'',';
    RAISE NOTICE '     ''Test Company Admin'',';
    RAISE NOTICE '     ''%'',', company_admin_role_id;
    RAISE NOTICE '     ''%'',', test_company_id;
    RAISE NOTICE '     true';
    RAISE NOTICE '   );';
    RAISE NOTICE '';
    RAISE NOTICE '4. Login credentials:';
    RAISE NOTICE '   Email: admin@testcompany.com';
    RAISE NOTICE '   Password: test123456';
    RAISE NOTICE '';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE '';
END $$;
