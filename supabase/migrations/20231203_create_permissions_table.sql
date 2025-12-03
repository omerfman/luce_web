-- Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'company',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(resource, action, scope)
);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Create policy: everyone can read permissions
CREATE POLICY "Anyone can read permissions"
  ON public.permissions
  FOR SELECT
  USING (true);

-- Create policy: only authenticated users can manage permissions
CREATE POLICY "Authenticated users can manage permissions"
  ON public.permissions
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Insert default permissions
INSERT INTO public.permissions (resource, action, scope, description) VALUES
  -- Invoice permissions
  ('invoices', 'create', 'company', 'Fatura oluşturabilir'),
  ('invoices', 'read', 'company', 'Şirket faturalarını görüntüleyebilir'),
  ('invoices', 'read', 'all', 'Tüm faturaları görüntüleyebilir'),
  ('invoices', 'update', 'company', 'Şirket faturalarını düzenleyebilir'),
  ('invoices', 'update', 'all', 'Tüm faturaları düzenleyebilir'),
  ('invoices', 'delete', 'company', 'Şirket faturalarını silebilir'),
  ('invoices', 'delete', 'all', 'Tüm faturaları silebilir'),
  ('invoices', 'manage', 'company', 'Şirket faturalarını tam yönetebilir'),
  ('invoices', 'manage', 'all', 'Tüm faturaları tam yönetebilir'),
  
  -- Project permissions
  ('projects', 'create', 'company', 'Proje oluşturabilir'),
  ('projects', 'read', 'company', 'Şirket projelerini görüntüleyebilir'),
  ('projects', 'read', 'all', 'Tüm projeleri görüntüleyebilir'),
  ('projects', 'update', 'company', 'Şirket projelerini düzenleyebilir'),
  ('projects', 'update', 'all', 'Tüm projeleri düzenleyebilir'),
  ('projects', 'delete', 'company', 'Şirket projelerini silebilir'),
  ('projects', 'delete', 'all', 'Tüm projeleri silebilir'),
  ('projects', 'manage', 'company', 'Şirket projelerini tam yönetebilir'),
  ('projects', 'manage', 'all', 'Tüm projeleri tam yönetebilir'),
  
  -- User permissions
  ('users', 'create', 'company', 'Kullanıcı oluşturabilir'),
  ('users', 'read', 'company', 'Şirket kullanıcılarını görüntüleyebilir'),
  ('users', 'read', 'all', 'Tüm kullanıcıları görüntüleyebilir'),
  ('users', 'update', 'company', 'Şirket kullanıcılarını düzenleyebilir'),
  ('users', 'update', 'all', 'Tüm kullanıcıları düzenleyebilir'),
  ('users', 'delete', 'company', 'Şirket kullanıcılarını silebilir'),
  ('users', 'delete', 'all', 'Tüm kullanıcıları silebilir'),
  ('users', 'manage', 'company', 'Şirket kullanıcılarını tam yönetebilir'),
  ('users', 'manage', 'all', 'Tüm kullanıcıları tam yönetebilir'),
  
  -- Role permissions
  ('roles', 'create', 'company', 'Rol oluşturabilir'),
  ('roles', 'read', 'company', 'Şirket rollerini görüntüleyebilir'),
  ('roles', 'read', 'all', 'Tüm rolleri görüntüleyebilir'),
  ('roles', 'update', 'company', 'Şirket rollerini düzenleyebilir'),
  ('roles', 'update', 'all', 'Tüm rolleri düzenleyebilir'),
  ('roles', 'delete', 'company', 'Şirket rollerini silebilir'),
  ('roles', 'delete', 'all', 'Tüm rolleri silebilir'),
  ('roles', 'manage', 'company', 'Şirket rollerini tam yönetebilir'),
  ('roles', 'manage', 'all', 'Tüm rolleri tam yönetebilir'),
  
  -- Company permissions
  ('companies', 'create', 'all', 'Şirket oluşturabilir'),
  ('companies', 'read', 'company', 'Kendi şirketini görüntüleyebilir'),
  ('companies', 'read', 'all', 'Tüm şirketleri görüntüleyebilir'),
  ('companies', 'update', 'company', 'Kendi şirketini düzenleyebilir'),
  ('companies', 'update', 'all', 'Tüm şirketleri düzenleyebilir'),
  ('companies', 'delete', 'all', 'Şirket silebilir'),
  ('companies', 'manage', 'company', 'Kendi şirketini tam yönetebilir'),
  ('companies', 'manage', 'all', 'Tüm şirketleri tam yönetebilir'),
  
  -- Report permissions
  ('reports', 'read', 'company', 'Şirket raporlarını görüntüleyebilir'),
  ('reports', 'read', 'all', 'Tüm raporları görüntüleyebilir'),
  ('reports', 'create', 'company', 'Şirket raporu oluşturabilir'),
  ('reports', 'create', 'all', 'Tüm şirketler için rapor oluşturabilir'),
  
  -- Wildcard permissions (Super Admin)
  ('*', '*', 'all', 'Tüm yetkilere sahip (Super Admin)')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON public.permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON public.permissions(action);
