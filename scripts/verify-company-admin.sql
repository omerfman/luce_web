-- Check if Company Admin user exists in users table
SELECT 
    u.id,
    u.email,
    u.name,
    r.name as role,
    c.name as company,
    u.is_active
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
LEFT JOIN companies c ON u.company_id = c.id
WHERE u.email = 'admin@testcompany.com';

-- If no results, the user profile was not created
-- Run this to create it:

INSERT INTO users (id, email, name, role_id, company_id, is_active)
SELECT 
    '4e6b1e4a-1886-40b8-ac25-b1c76100556d'::uuid,
    'admin@testcompany.com',
    'Test Company Admin',
    r.id,
    c.id,
    true
FROM roles r, companies c
WHERE r.name = 'Company Admin'
  AND c.name = 'Test Şirketi'
ON CONFLICT (id) DO UPDATE
SET 
    role_id = EXCLUDED.role_id,
    company_id = EXCLUDED.company_id,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    is_active = EXCLUDED.is_active;

-- Verify
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
