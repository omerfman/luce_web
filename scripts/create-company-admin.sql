-- ============================================================================
-- Create Test Company and Company Admin User
-- ============================================================================

-- Step 1: Create a test company (if not exists)
INSERT INTO companies (name, is_active)
VALUES ('Test Şirketi', true)
ON CONFLICT DO NOTHING;

-- Step 2: Get the role IDs and company ID
DO $$
DECLARE
    company_admin_role_id UUID;
    test_company_id UUID;
    new_user_id UUID;
BEGIN
    -- Get Company Admin role ID
    SELECT id INTO company_admin_role_id
    FROM roles
    WHERE name = 'Company Admin';
    
    IF company_admin_role_id IS NULL THEN
        RAISE EXCEPTION 'Company Admin role not found!';
    END IF;
    
    -- Get Test Company ID
    SELECT id INTO test_company_id
    FROM companies
    WHERE name = 'Test Şirketi';
    
    IF test_company_id IS NULL THEN
        RAISE EXCEPTION 'Test Şirketi not found!';
    END IF;
    
    RAISE NOTICE '✅ Company Admin Role ID: %', company_admin_role_id;
    RAISE NOTICE '✅ Test Şirketi ID: %', test_company_id;
    RAISE NOTICE '';
    RAISE NOTICE '📋 Next step: Create user in Supabase Auth with email/password';
    RAISE NOTICE 'Email: admin@testcompany.com';
    RAISE NOTICE 'Password: test123456';
    RAISE NOTICE '';
    RAISE NOTICE 'Then assign role with this SQL:';
    RAISE NOTICE 'UPDATE users SET role_id = ''%'', company_id = ''%'' WHERE email = ''admin@testcompany.com'';', company_admin_role_id, test_company_id;
END $$;
