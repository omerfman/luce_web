-- Add missing permissions that are used in the application but not in the database

-- Insert missing invoices.assign permission (used for assigning invoices to projects)
INSERT INTO public.permissions (resource, action, scope, description) VALUES
  ('invoices', 'assign', 'company', 'Faturayı projeye atayabilir')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- Insert missing invoices.export permission (used for PDF export functionality)
INSERT INTO public.permissions (resource, action, scope, description) VALUES
  ('invoices', 'export', 'company', 'Fatura raporlarını dışa aktarabilir')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- Insert missing projects.assign permission (for assigning projects to other resources)
INSERT INTO public.permissions (resource, action, scope, description) VALUES
  ('projects', 'assign', 'company', 'Proje atayabilir')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- Insert missing users.assign permission (for assigning users to projects or roles)
INSERT INTO public.permissions (resource, action, scope, description) VALUES
  ('users', 'assign', 'company', 'Kullanıcı atayabilir')
ON CONFLICT (resource, action, scope) DO NOTHING;
