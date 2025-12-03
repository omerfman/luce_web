-- ============================================================================
-- Check existing roles and their permissions
-- ============================================================================

-- View all roles
SELECT 
    id,
    name,
    description,
    permissions
FROM roles
ORDER BY name;

-- View all companies
SELECT 
    id,
    name,
    created_at
FROM companies
ORDER BY name;

-- View all users with their roles and companies
SELECT 
    u.id,
    u.email,
    u.name,
    r.name as role_name,
    c.name as company_name,
    u.is_active
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
LEFT JOIN companies c ON u.company_id = c.id
ORDER BY u.email;
