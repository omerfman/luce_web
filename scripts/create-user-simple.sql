-- Direct insert for Company Admin user
-- First, get the Company Admin role ID and Test Şirketi ID

-- Create the user profile
INSERT INTO users (id, email, name, role_id, company_id, is_active)
VALUES (
    '4e6b1e4a-1886-40b8-ac25-b1c76100556d'::uuid,
    'admin@testcompany.com',
    'Test Company Admin',
    (SELECT id FROM roles WHERE name = 'Company Admin'),
    (SELECT id FROM companies WHERE name = 'Test Şirketi'),
    true
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role_id = EXCLUDED.role_id,
    company_id = EXCLUDED.company_id,
    is_active = EXCLUDED.is_active;

-- Show result
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
WHERE u.id = '4e6b1e4a-1886-40b8-ac25-b1c76100556d';
