-- ============================================================================
-- LUCE MİMARLIK - INITIAL USER SETUP
-- ============================================================================
-- Bu script ilk şirketi ve Super Admin kullanıcısını oluşturur
-- 
-- ÖNCELİKLE: setup-database.sql scriptini çalıştırmış olmalısınız!
--
-- KULLANIM:
-- 1. Supabase Dashboard → Authentication → Users → "Invite user"
-- 2. Email: superadmin@luce.com
-- 3. Email'deki Magic Link'e tıklayarak ilk girişi yapın
-- 4. Bu scripti Supabase SQL Editor'da çalıştırın
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Luce Mimarlık Company
-- ============================================================================

DO $$
DECLARE
    luce_company_id UUID;
    superadmin_role_id UUID;
    user_auth_id UUID;
BEGIN
    -- Check if company already exists
    SELECT id INTO luce_company_id 
    FROM companies 
    WHERE name = 'Luce Mimarlık' 
    LIMIT 1;
    
    -- Create company if it doesn't exist
    IF luce_company_id IS NULL THEN
        INSERT INTO companies (name, tax_number, address, phone, email)
        VALUES (
            'Luce Mimarlık',
            '0000000000',  -- Gerçek vergi numarasını güncelleyebilirsiniz
            'İstanbul, Türkiye',
            '+905551234567',  -- Gerçek telefonu güncelleyebilirsiniz
            'info@lucemimarlik.com'
        )
        RETURNING id INTO luce_company_id;
        
        RAISE NOTICE '✅ Luce Mimarlık şirketi oluşturuldu: %', luce_company_id;
    ELSE
        RAISE NOTICE 'ℹ️  Luce Mimarlık şirketi zaten mevcut: %', luce_company_id;
    END IF;
    
    -- ========================================================================
    -- STEP 2: Get Super Admin Role ID
    -- ========================================================================
    
    SELECT id INTO superadmin_role_id
    FROM roles
    WHERE name = 'Super Admin'
    LIMIT 1;
    
    IF superadmin_role_id IS NULL THEN
        RAISE EXCEPTION 'HATA: Super Admin rolü bulunamadı! setup-database.sql çalıştırıldı mı?';
    END IF;
    
    RAISE NOTICE '✅ Super Admin rolü bulundu: %', superadmin_role_id;
    
    -- ========================================================================
    -- STEP 3: Find and Update User
    -- ========================================================================
    
    -- Get user ID from auth.users
    SELECT id INTO user_auth_id
    FROM auth.users
    WHERE email = 'superadmin@luce.com'
    LIMIT 1;
    
    IF user_auth_id IS NULL THEN
        RAISE EXCEPTION 'HATA: superadmin@luce.com kullanıcısı bulunamadı! 
        Lütfen önce Supabase Dashboard → Authentication → Users → Invite User ile kullanıcıyı davet edin.';
    END IF;
    
    RAISE NOTICE '✅ Kullanıcı bulundu: %', user_auth_id;
    
    -- Check if user profile exists
    IF EXISTS (SELECT 1 FROM users WHERE id = user_auth_id) THEN
        -- Update existing user
        UPDATE users
        SET 
            company_id = luce_company_id,
            role_id = superadmin_role_id,
            name = 'Super Admin',
            is_active = true,
            updated_at = NOW()
        WHERE id = user_auth_id;
        
        RAISE NOTICE '✅ Kullanıcı profili güncellendi';
    ELSE
        -- Create new user profile
        INSERT INTO users (id, company_id, role_id, name, email, is_active)
        VALUES (
            user_auth_id,
            luce_company_id,
            superadmin_role_id,
            'Super Admin',
            'superadmin@luce.com',
            true
        );
        
        RAISE NOTICE '✅ Kullanıcı profili oluşturuldu';
    END IF;
    
    -- ========================================================================
    -- STEP 4: Verification
    -- ========================================================================
    
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '✅ SETUP COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Setup Summary:';
    RAISE NOTICE '   Company: Luce Mimarlık (%)', luce_company_id;
    RAISE NOTICE '   User: superadmin@luce.com (%)', user_auth_id;
    RAISE NOTICE '   Role: Super Admin (%)', superadmin_role_id;
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Next Steps:';
    RAISE NOTICE '   1. Login: http://localhost:3000/login';
    RAISE NOTICE '   2. Email: superadmin@luce.com';
    RAISE NOTICE '   3. Check email for Magic Link';
    RAISE NOTICE '   4. Start using the system!';
    RAISE NOTICE '';
    
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check company
SELECT 
    '✅ Company' as check_type,
    id, name, email 
FROM companies 
WHERE name = 'Luce Mimarlık';

-- Check user profile
SELECT 
    '✅ User Profile' as check_type,
    u.id, u.name, u.email, u.is_active,
    c.name as company_name,
    r.name as role_name
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.email = 'superadmin@luce.com';

-- Check user permissions
SELECT 
    '✅ Permissions' as check_type,
    get_user_permissions(
        (SELECT id FROM users WHERE email = 'superadmin@luce.com')
    ) as user_permissions;
