-- Create accounting and project manager roles
-- First, create the roles

-- Muhasebeci (Accountant) role
INSERT INTO roles (id, name, company_id, permissions, description)
VALUES (
  gen_random_uuid(),
  'Muhasebeci',
  NULL, -- Global role, can be used by any company
  '[
    {"resource": "invoices", "action": "create", "scope": "company"},
    {"resource": "invoices", "action": "read", "scope": "company"},
    {"resource": "invoices", "action": "update", "scope": "company"},
    {"resource": "invoices", "action": "delete", "scope": "company"}
  ]'::jsonb,
  'Fatura girişi ve yönetimi yapabilir'
)
ON CONFLICT DO NOTHING;

-- Proje Yöneticisi (Project Manager) role
INSERT INTO roles (id, name, company_id, permissions, description)
VALUES (
  gen_random_uuid(),
  'Proje Yöneticisi',
  NULL, -- Global role
  '[
    {"resource": "projects", "action": "create", "scope": "company"},
    {"resource": "projects", "action": "read", "scope": "company"},
    {"resource": "projects", "action": "update", "scope": "company"},
    {"resource": "projects", "action": "delete", "scope": "company"},
    {"resource": "invoices", "action": "read", "scope": "company"},
    {"resource": "invoices", "action": "assign", "scope": "company"}
  ]'::jsonb,
  'Proje yönetimi ve fatura atama yetkisi'
)
ON CONFLICT DO NOTHING;

-- Verify
SELECT id, name, description, permissions 
FROM roles 
WHERE name IN ('Muhasebeci', 'Proje Yöneticisi');
