-- ============================================================================
-- LUCE MİMARLIK - FIX USER ASSIGNMENT
-- ============================================================================
-- Bu script mevcut kullanıcıya (omerfarukadam.tr@gmail.com) şirket ve rol atar
-- 
-- KULLANIM:
-- Supabase Dashboard → SQL Editor → Bu scripti çalıştır
-- ============================================================================

DO $$
DECLARE
    luce_company_id UUID;
    superadmin_role_id UUID;
    user_auth_id UUID;
    user_email TEXT := 'omerfarukadam.tr@gmail.com';
BEGIN
    -- ========================================================================
    -- STEP 1: Get or Create Company
    -- ========================================================================
    
    SELECT id INTO luce_company_id 
    FROM companies 
    WHERE name = 'Luce Mimarlık' 
    LIMIT 1;
    
    IF luce_company_id IS NULL THEN
        INSERT INTO companies (name, tax_number, address, phone, email)
        VALUES (
            'Luce Mimarlık',
            '0000000000',
            'İstanbul, Türkiye',
            '+905551234567',
            'info@lucemimarlik.com'
        )
        RETURNING id INTO luce_company_id;
        
        RAISE NOTICE '✅ Luce Mimarlık şirketi oluşturuldu: %', luce_company_id;
    ELSE
        RAISE NOTICE '✅ Luce Mimarlık şirketi bulundu: %', luce_company_id;
    END IF;
    
    -- ========================================================================
    -- STEP 2: Get Super Admin Role
    -- ========================================================================
    
    SELECT id INTO superadmin_role_id
    FROM roles
    WHERE name = 'Super Admin'
    LIMIT 1;
    
    IF superadmin_role_id IS NULL THEN
        RAISE EXCEPTION 'HATA: Super Admin rolü bulunamadı!';
    END IF;
    
    RAISE NOTICE '✅ Super Admin rolü bulundu: %', superadmin_role_id;
    
    -- ========================================================================
    -- STEP 3: Find User from auth.users
    -- ========================================================================
    
    SELECT id INTO user_auth_id
    FROM auth.users
    WHERE email = user_email
    LIMIT 1;
    
    IF user_auth_id IS NULL THEN
        RAISE EXCEPTION 'HATA: % kullanıcısı auth.users tablosunda bulunamadı!', user_email;
    END IF;
    
    RAISE NOTICE '✅ Kullanıcı bulundu (auth.users): %', user_auth_id;
    
    -- ========================================================================
    -- STEP 4: Create or Update User Profile
    -- ========================================================================
    
    IF EXISTS (SELECT 1 FROM users WHERE id = user_auth_id) THEN
        -- Update existing user
        UPDATE users
        SET 
            company_id = luce_company_id,
            role_id = superadmin_role_id,
            name = 'Ömer Faruk Adam',
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
            'Ömer Faruk Adam',
            user_email,
            true
        );
        
        RAISE NOTICE '✅ Kullanıcı profili oluşturuldu';
    END IF;
    
    -- ========================================================================
    -- STEP 5: Verification
    -- ========================================================================
    
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '✅ USER ASSIGNMENT COMPLETED!';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Summary:';
    RAISE NOTICE '   Company: Luce Mimarlık (%)', luce_company_id;
    RAISE NOTICE '   User: % (%)', user_email, user_auth_id;
    RAISE NOTICE '   Role: Super Admin (%)', superadmin_role_id;
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Next: Refresh browser and login again';
    RAISE NOTICE '';
    
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
    '✅ User Profile' as status,
    u.id, 
    u.name, 
    u.email, 
    u.is_active,
    c.name as company_name,
    r.name as role_name,
    r.permissions
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.email = 'omerfarukadam.tr@gmail.com';
