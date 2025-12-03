-- ============================================================================
-- Assign Company Admin Role to User
-- User ID: 4e6b1e4a-1886-40b8-ac25-b1c76100556d
-- Email: admin@testcompany.com
-- ============================================================================

-- Step 1: Create Test Şirketi (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Test Şirketi') THEN
        INSERT INTO companies (name) VALUES ('Test Şirketi');
    END IF;
END $$;

-- Step 2: Insert user profile with Company Admin role
INSERT INTO users (id, email, name, role_id, company_id, is_active)
SELECT 
    '4e6b1e4a-1886-40b8-ac25-b1c76100556d'::uuid,
    'admin@testcompany.com',
    'Test Company Admin',
    r.id,
    c.id,
    true
FROM roles r
CROSS JOIN companies c
WHERE r.name = 'Company Admin'
  AND c.name = 'Test Şirketi'
ON CONFLICT (id) DO UPDATE
SET 
    role_id = EXCLUDED.role_id,
    company_id = EXCLUDED.company_id,
    name = EXCLUDED.name,
    is_active = true;

-- Verify the user
SELECT 
    u.id,
    u.email,
    u.name,
    r.name as role,
    c.name as company,
    u.is_active
FROM users u
JOIN roles r ON u.role_id = r.id
JOIN companies c ON u.company_id = c.id
WHERE u.id = '4e6b1e4a-1886-40b8-ac25-b1c76100556d';
