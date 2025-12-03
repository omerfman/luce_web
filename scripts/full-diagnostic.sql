-- Full diagnostic
SELECT 'Companies:' as info;
SELECT * FROM companies;

SELECT 'Roles:' as info;
SELECT * FROM roles;

SELECT 'Users:' as info;
SELECT * FROM users;

-- Try to insert with subquery
INSERT INTO users (id, email, name, role_id, company_id, is_active)
SELECT 
    '4e6b1e4a-1886-40b8-ac25-b1c76100556d'::uuid,
    'admin@testcompany.com',
    'Test Company Admin',
    r.id,
    c.id,
    true
FROM 
    (SELECT id FROM roles WHERE name = 'Company Admin' LIMIT 1) r,
    (SELECT id FROM companies WHERE name = 'Test Şirketi' LIMIT 1) c
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE id = '4e6b1e4a-1886-40b8-ac25-b1c76100556d'
);

-- Final verification
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
