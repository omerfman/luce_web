-- Reset super admin password to a known value
-- You can use this in Supabase SQL Editor or via admin API

-- Option 1: Get user ID for manual password reset in Dashboard
SELECT 
    id,
    email,
    created_at
FROM auth.users
WHERE email IN ('superadmin@luce.com', 'omerfarukadam.tr@gmail.com')
ORDER BY created_at;

-- Instructions:
-- 1. Copy the user ID from above
-- 2. Go to: https://supabase.com/dashboard/project/plwmqofncmkgxhushucg/auth/users
-- 3. Find the user by email
-- 4. Click "..." menu → "Update user"
-- 5. Set new password: admin123456
-- 6. Save

-- Then login with:
-- Email: superadmin@luce.com (or omerfarukadam.tr@gmail.com)
-- Password: admin123456
