-- Add roles management permissions to Admin role
UPDATE roles
SET permissions = permissions || '[
  {"resource": "roles", "action": "create", "scope": "company"},
  {"resource": "roles", "action": "read", "scope": "company"},
  {"resource": "roles", "action": "update", "scope": "company"},
  {"resource": "roles", "action": "delete", "scope": "company"}
]'::jsonb
WHERE name = 'Admin' AND company_id IS NULL;

-- Verify
SELECT id, name, permissions 
FROM roles 
WHERE name = 'Admin';
