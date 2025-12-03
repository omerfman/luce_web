-- Create Company Admin user profile directly
-- Using actual company ID from your database

INSERT INTO users (id, email, name, role_id, company_id, is_active)
SELECT 
    '4e6b1e4a-1886-40b8-ac25-b1c76100556d'::uuid,
    'admin@testcompany.com',
    'Test Company Admin',
    (SELECT id FROM roles WHERE name = 'Company Admin' LIMIT 1),
    'f2342cab-aef7-46bc-be63-08bcd0496c9a'::uuid,  -- Test Şirketi ID
    true
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE id = '4e6b1e4a-1886-40b8-ac25-b1c76100556d'
);

-- Verify
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
