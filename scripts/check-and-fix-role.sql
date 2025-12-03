-- Check what roles exist
SELECT id, name, description FROM roles ORDER BY name;

-- If "Company Admin" doesn't exist, let's check the exact name
SELECT name FROM roles WHERE name LIKE '%Admin%' OR name LIKE '%Company%';

-- Update user with Super Admin role temporarily (we know this exists)
UPDATE users 
SET role_id = (SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1)
WHERE id = '4e6b1e4a-1886-40b8-ac25-b1c76100556d';

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
