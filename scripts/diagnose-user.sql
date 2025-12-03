-- ============================================================================
-- Step-by-step diagnosis and fix
-- ============================================================================

-- Step 1: Check if roles exist
SELECT id, name FROM roles ORDER BY name;

-- Step 2: Check if companies exist
SELECT id, name FROM companies ORDER BY name;

-- Step 3: Check if user exists in users table
SELECT * FROM users WHERE id = '4e6b1e4a-1886-40b8-ac25-b1c76100556d';

-- Step 4: Get the exact IDs we need
DO $$
DECLARE
    v_role_id UUID;
    v_company_id UUID;
BEGIN
    -- Get Company Admin role
    SELECT id INTO v_role_id FROM roles WHERE name = 'Company Admin';
    
    -- Get Test Şirketi
    SELECT id INTO v_company_id FROM companies WHERE name = 'Test Şirketi';
    
    RAISE NOTICE '';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Database Status:';
    RAISE NOTICE '==============================================';
    
    IF v_role_id IS NULL THEN
        RAISE NOTICE '❌ Company Admin role NOT FOUND!';
    ELSE
        RAISE NOTICE '✅ Company Admin role ID: %', v_role_id;
    END IF;
    
    IF v_company_id IS NULL THEN
        RAISE NOTICE '❌ Test Şirketi NOT FOUND!';
    ELSE
        RAISE NOTICE '✅ Test Şirketi ID: %', v_company_id;
    END IF;
    
    RAISE NOTICE '';
    
    IF v_role_id IS NOT NULL AND v_company_id IS NOT NULL THEN
        RAISE NOTICE 'Manual INSERT command:';
        RAISE NOTICE '';
        RAISE NOTICE 'INSERT INTO users (id, email, name, role_id, company_id, is_active)';
        RAISE NOTICE 'VALUES (';
        RAISE NOTICE '  ''4e6b1e4a-1886-40b8-ac25-b1c76100556d''::uuid,';
        RAISE NOTICE '  ''admin@testcompany.com'',';
        RAISE NOTICE '  ''Test Company Admin'',';
        RAISE NOTICE '  ''%''::uuid,', v_role_id;
        RAISE NOTICE '  ''%''::uuid,', v_company_id;
        RAISE NOTICE '  true';
        RAISE NOTICE ');';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '==============================================';
END $$;
