-- ============================================================================
-- Activity Logs System - Comprehensive Logging for All User Actions
-- Created: 2026-01-13
-- Purpose: Track all CRUD operations across the application
-- ============================================================================

-- Drop existing activity_logs table if exists (keeping user_activity_logs for backwards compatibility)
DROP TABLE IF EXISTS public.activity_logs CASCADE;

-- Create main activity_logs table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User and Company Context
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Action Details
  action_type TEXT NOT NULL CHECK (action_type IN (
    'create', 'update', 'delete', 'assign', 'unassign', 
    'upload', 'download', 'login', 'logout', 'view'
  )),
  
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'project', 'invoice', 'user', 'role', 'company',
    'subcontractor', 'informal_payment', 'payment', 'file',
    'invoice_project_link', 'supplier', 'system'
  )),
  
  resource_id UUID, -- ID of the affected resource (nullable for bulk operations)
  
  -- Details
  description TEXT NOT NULL, -- Human-readable description
  changes JSONB DEFAULT '{}'::jsonb, -- Old and new values for updates
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional context (IP, user agent, etc.)
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_company_id ON public.activity_logs(company_id);
CREATE INDEX idx_activity_logs_action_type ON public.activity_logs(action_type);
CREATE INDEX idx_activity_logs_resource_type ON public.activity_logs(resource_type);
CREATE INDEX idx_activity_logs_resource_id ON public.activity_logs(resource_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_composite ON public.activity_logs(company_id, resource_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Policy 1: Users can view their own activity logs
CREATE POLICY "Users can view their own activity logs"
ON public.activity_logs FOR SELECT
USING (
  user_id = auth.uid()
);

-- Policy 2: Company admins can view all logs in their company
CREATE POLICY "Company admins can view company logs"
ON public.activity_logs FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  )
  AND (
    has_permission(auth.uid(), 'activity_logs', 'read')
    OR has_permission(auth.uid(), 'activity_logs', 'manage')
    OR has_permission(auth.uid(), '*', '*')
  )
);

-- Policy 3: Super Admin can view all logs
CREATE POLICY "Super Admin can view all activity logs"
ON public.activity_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    INNER JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.name = 'Super Admin'
    AND r.company_id IS NULL
  )
);

-- Policy 4: System can insert logs (via triggers and functions)
CREATE POLICY "System can insert activity logs"
ON public.activity_logs FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get Turkish description for actions
CREATE OR REPLACE FUNCTION get_action_description_tr(
  p_action TEXT,
  p_resource TEXT,
  p_resource_name TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
BEGIN
  -- Basit ve anlaşılır Türkçe açıklamalar
  IF p_action = 'create' THEN
    CASE p_resource
      WHEN 'project' THEN 
        RETURN CASE WHEN p_resource_name IS NOT NULL 
          THEN format('"%s" adlı proje oluşturuldu', p_resource_name)
          ELSE 'Yeni proje oluşturuldu' END;
      WHEN 'invoice' THEN 
        RETURN CASE WHEN p_resource_name IS NOT NULL 
          THEN format('"%s" numaralı fatura eklendi', p_resource_name)
          ELSE 'Yeni fatura eklendi' END;
      WHEN 'user' THEN 
        RETURN CASE WHEN p_resource_name IS NOT NULL 
          THEN format('"%s" adlı kullanıcı eklendi', p_resource_name)
          ELSE 'Yeni kullanıcı eklendi' END;
      WHEN 'subcontractor' THEN 
        RETURN CASE WHEN p_resource_name IS NOT NULL 
          THEN format('"%s" adlı taşeron firma eklendi', p_resource_name)
          ELSE 'Yeni taşeron firma eklendi' END;
      WHEN 'informal_payment' THEN 
        RETURN 'Yeni gayri resmi ödeme kaydedildi';
      WHEN 'payment' THEN 
        RETURN 'Yeni ödeme kaydedildi';
      ELSE 
        RETURN 'Yeni kayıt oluşturuldu';
    END CASE;
  END IF;
  
  IF p_action = 'update' THEN
    CASE p_resource
      WHEN 'project' THEN 
        RETURN CASE WHEN p_resource_name IS NOT NULL 
          THEN format('"%s" projesinin bilgileri güncellendi', p_resource_name)
          ELSE 'Proje bilgileri güncellendi' END;
      WHEN 'invoice' THEN 
        RETURN CASE WHEN p_resource_name IS NOT NULL 
          THEN format('"%s" numaralı fatura güncellendi', p_resource_name)
          ELSE 'Fatura bilgileri güncellendi' END;
      WHEN 'user' THEN 
        RETURN CASE WHEN p_resource_name IS NOT NULL 
          THEN format('"%s" kullanıcısının bilgileri güncellendi', p_resource_name)
          ELSE 'Kullanıcı bilgileri güncellendi' END;
      WHEN 'subcontractor' THEN 
        RETURN CASE WHEN p_resource_name IS NOT NULL 
          THEN format('"%s" taşeron firmasının bilgileri güncellendi', p_resource_name)
          ELSE 'Taşeron firma bilgileri güncellendi' END;
      WHEN 'informal_payment' THEN 
        RETURN 'Gayri resmi ödeme güncellendi';
      ELSE 
        RETURN 'Kayıt güncellendi';
    END CASE;
  END IF;
  
  IF p_action = 'delete' THEN
    CASE p_resource
      WHEN 'project' THEN 
        RETURN CASE WHEN p_resource_name IS NOT NULL 
          THEN format('"%s" adlı proje silindi', p_resource_name)
          ELSE 'Proje silindi' END;
      WHEN 'invoice' THEN 
        RETURN CASE WHEN p_resource_name IS NOT NULL 
          THEN format('"%s" numaralı fatura silindi', p_resource_name)
          ELSE 'Fatura silindi' END;
      WHEN 'user' THEN 
        RETURN CASE WHEN p_resource_name IS NOT NULL 
          THEN format('"%s" adlı kullanıcı silindi', p_resource_name)
          ELSE 'Kullanıcı silindi' END;
      WHEN 'subcontractor' THEN 
        RETURN CASE WHEN p_resource_name IS NOT NULL 
          THEN format('"%s" adlı taşeron firma silindi', p_resource_name)
          ELSE 'Taşeron firma silindi' END;
      WHEN 'informal_payment' THEN 
        RETURN 'Gayri resmi ödeme silindi';
      ELSE 
        RETURN 'Kayıt silindi';
    END CASE;
  END IF;
  
  IF p_action = 'upload' THEN
    RETURN CASE WHEN p_resource_name IS NOT NULL 
      THEN format('"%s" dosyası yüklendi', p_resource_name)
      ELSE 'Dosya yüklendi' END;
  END IF;
  
  IF p_action = 'download' THEN
    RETURN CASE WHEN p_resource_name IS NOT NULL 
      THEN format('"%s" dosyası indirildi', p_resource_name)
      ELSE 'Dosya indirildi' END;
  END IF;
  
  IF p_action = 'assign' THEN
    RETURN 'Atama yapıldı';
  END IF;
  
  IF p_action = 'unassign' THEN
    RETURN 'Atama kaldırıldı';
  END IF;
  
  RETURN 'İşlem gerçekleştirildi';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
  p_user_id UUID,
  p_company_id UUID,
  p_action_type TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_changes JSONB DEFAULT '{}'::jsonb,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_description TEXT;
BEGIN
  -- Generate description if not provided
  IF p_description IS NULL THEN
    v_description := get_action_description_tr(p_action_type, p_resource_type);
  ELSE
    v_description := p_description;
  END IF;
  
  -- Insert log
  INSERT INTO public.activity_logs (
    user_id,
    company_id,
    action_type,
    resource_type,
    resource_id,
    description,
    changes,
    metadata
  ) VALUES (
    p_user_id,
    p_company_id,
    p_action_type,
    p_resource_type,
    p_resource_id,
    v_description,
    p_changes,
    p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

-- Projects Table Triggers
CREATE OR REPLACE FUNCTION log_project_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_action TEXT;
  v_changes JSONB;
  v_description TEXT;
  v_created_by_name TEXT;
  v_updated_by_name TEXT;
BEGIN
  -- Get user context
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_company_id := NEW.company_id;
    v_description := get_action_description_tr('create', 'project', NEW.name);
    v_changes := jsonb_build_object('new', row_to_json(NEW));
    
    -- Add created_by user name
    IF NEW.created_by IS NOT NULL THEN
      SELECT name INTO v_created_by_name FROM users WHERE id = NEW.created_by;
      IF v_created_by_name IS NOT NULL THEN
        v_changes := jsonb_set(v_changes, '{new,created_by_name}', to_jsonb(v_created_by_name));
      END IF;
    END IF;
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      v_action,
      'project',
      NEW.id,
      v_description,
      v_changes
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_company_id := NEW.company_id;
    v_description := get_action_description_tr('update', 'project', NEW.name);
    v_changes := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
    
    -- Add updated_by user name
    IF NEW.updated_by IS NOT NULL THEN
      SELECT name INTO v_updated_by_name FROM users WHERE id = NEW.updated_by;
      IF v_updated_by_name IS NOT NULL THEN
        v_changes := jsonb_set(v_changes, '{new,updated_by_name}', to_jsonb(v_updated_by_name));
      END IF;
    END IF;
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      v_action,
      'project',
      NEW.id,
      v_description,
      v_changes
    );
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_company_id := OLD.company_id;
    v_description := get_action_description_tr('delete', 'project', OLD.name);
    v_changes := jsonb_build_object('old', row_to_json(OLD));
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      v_action,
      'project',
      OLD.id,
      v_description,
      v_changes
    );
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Invoices Table Triggers
CREATE OR REPLACE FUNCTION log_invoice_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_action TEXT;
  v_changes JSONB;
  v_description TEXT;
  v_invoice_number TEXT;
  v_uploaded_by_name TEXT;
  v_created_by_name TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_company_id := NEW.company_id;
    v_invoice_number := COALESCE(NEW.invoice_number, 'N/A');
    v_description := get_action_description_tr('create', 'invoice', v_invoice_number);
    v_changes := jsonb_build_object('new', row_to_json(NEW));
    
    -- Add uploaded_by user name
    IF NEW.uploaded_by IS NOT NULL THEN
      SELECT name INTO v_uploaded_by_name FROM users WHERE id = NEW.uploaded_by;
      IF v_uploaded_by_name IS NOT NULL THEN
        v_changes := jsonb_set(v_changes, '{new,uploaded_by_name}', to_jsonb(v_uploaded_by_name));
      END IF;
    END IF;
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      v_action,
      'invoice',
      NEW.id,
      v_description,
      v_changes
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_company_id := NEW.company_id;
    v_invoice_number := COALESCE(NEW.invoice_number, 'N/A');
    v_description := get_action_description_tr('update', 'invoice', v_invoice_number);
    v_changes := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
    
    -- Add uploaded_by user name
    IF NEW.uploaded_by IS NOT NULL THEN
      SELECT name INTO v_uploaded_by_name FROM users WHERE id = NEW.uploaded_by;
      IF v_uploaded_by_name IS NOT NULL THEN
        v_changes := jsonb_set(v_changes, '{new,uploaded_by_name}', to_jsonb(v_uploaded_by_name));
      END IF;
    END IF;
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      v_action,
      'invoice',
      NEW.id,
      v_description,
      v_changes
    );
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_company_id := OLD.company_id;
    v_invoice_number := COALESCE(OLD.invoice_number, 'N/A');
    v_description := get_action_description_tr('delete', 'invoice', v_invoice_number);
    v_changes := jsonb_build_object('old', row_to_json(OLD));
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      v_action,
      'invoice',
      OLD.id,
      v_description,
      v_changes
    );
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Invoice Project Links Triggers
CREATE OR REPLACE FUNCTION log_invoice_project_link_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_action TEXT;
  v_description TEXT;
  v_invoice_number TEXT;
  v_project_name TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    -- Get invoice and project names
    SELECT i.invoice_number, i.company_id INTO v_invoice_number, v_company_id
    FROM invoices i WHERE i.id = NEW.invoice_id;
    
    SELECT p.name INTO v_project_name
    FROM projects p WHERE p.id = NEW.project_id;
    
    v_description := format('Fatura projeye atandı: %s → %s', 
      COALESCE(v_invoice_number, 'N/A'), 
      COALESCE(v_project_name, 'N/A')
    );
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      'assign',
      'invoice_project_link',
      NEW.id,
      v_description,
      jsonb_build_object(
        'invoice_id', NEW.invoice_id,
        'project_id', NEW.project_id
      )
    );
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Get invoice and project names
    SELECT i.invoice_number, i.company_id INTO v_invoice_number, v_company_id
    FROM invoices i WHERE i.id = OLD.invoice_id;
    
    SELECT p.name INTO v_project_name
    FROM projects p WHERE p.id = OLD.project_id;
    
    v_description := format('Fatura proje ataması kaldırıldı: %s → %s', 
      COALESCE(v_invoice_number, 'N/A'), 
      COALESCE(v_project_name, 'N/A')
    );
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      'unassign',
      'invoice_project_link',
      OLD.id,
      v_description,
      jsonb_build_object(
        'invoice_id', OLD.invoice_id,
        'project_id', OLD.project_id
      )
    );
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users Table Triggers
CREATE OR REPLACE FUNCTION log_user_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_action TEXT;
  v_changes JSONB;
  v_description TEXT;
  v_has_meaningful_change BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_company_id := NEW.company_id;
    v_description := get_action_description_tr('create', 'user', NEW.name);
    v_changes := jsonb_build_object('new', row_to_json(NEW));
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      v_action,
      'user',
      NEW.id,
      v_description,
      v_changes
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Sadece anlamlı değişiklikler varsa log tut
    -- last_seen_at, meta, metadata gibi teknik alanlar değişirse log tutma
    v_has_meaningful_change := (
      OLD.name IS DISTINCT FROM NEW.name OR
      OLD.email IS DISTINCT FROM NEW.email OR
      OLD.phone IS DISTINCT FROM NEW.phone OR
      OLD.role_id IS DISTINCT FROM NEW.role_id OR
      OLD.company_id IS DISTINCT FROM NEW.company_id OR
      OLD.is_active IS DISTINCT FROM NEW.is_active
    );
    
    -- Sadece anlamlı değişiklik varsa log tut
    IF v_has_meaningful_change THEN
      v_action := 'update';
      v_company_id := NEW.company_id;
      v_description := get_action_description_tr('update', 'user', NEW.name);
      v_changes := jsonb_build_object(
        'old', row_to_json(OLD),
        'new', row_to_json(NEW)
      );
      
      PERFORM log_activity(
        v_user_id,
        v_company_id,
        v_action,
        'user',
        NEW.id,
        v_description,
        v_changes
      );
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_company_id := OLD.company_id;
    v_description := get_action_description_tr('delete', 'user', OLD.name);
    v_changes := jsonb_build_object('old', row_to_json(OLD));
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      v_action,
      'user',
      OLD.id,
      v_description,
      v_changes
    );
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Payments Table Triggers
CREATE OR REPLACE FUNCTION log_payment_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_action TEXT;
  v_description TEXT;
  v_invoice_number TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    -- Get invoice info
    SELECT i.invoice_number, i.company_id INTO v_invoice_number, v_company_id
    FROM invoices i WHERE i.id = NEW.invoice_id;
    
    v_description := format('Ödeme eklendi: %s - %s TL (%s)', 
      COALESCE(v_invoice_number, 'N/A'),
      NEW.amount,
      NEW.payment_type
    );
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      'create',
      'payment',
      NEW.id,
      v_description,
      jsonb_build_object('new', row_to_json(NEW))
    );
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Get invoice info
    SELECT i.invoice_number, i.company_id INTO v_invoice_number, v_company_id
    FROM invoices i WHERE i.id = OLD.invoice_id;
    
    v_description := format('Ödeme silindi: %s - %s TL (%s)', 
      COALESCE(v_invoice_number, 'N/A'),
      OLD.amount,
      OLD.payment_type
    );
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      'delete',
      'payment',
      OLD.id,
      v_description,
      jsonb_build_object('old', row_to_json(OLD))
    );
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Subcontractors Table Triggers
CREATE OR REPLACE FUNCTION log_subcontractor_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_action TEXT;
  v_changes JSONB;
  v_description TEXT;
  v_created_by_name TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_company_id := NEW.company_id;
    v_description := get_action_description_tr('create', 'subcontractor', NEW.name);
    v_changes := jsonb_build_object('new', row_to_json(NEW));
    
    -- Add created_by user name if column exists
    IF NEW.created_by IS NOT NULL THEN
      SELECT name INTO v_created_by_name FROM users WHERE id = NEW.created_by;
      IF v_created_by_name IS NOT NULL THEN
        v_changes := jsonb_set(v_changes, '{new,created_by_name}', to_jsonb(v_created_by_name));
      END IF;
    END IF;
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      v_action,
      'subcontractor',
      NEW.id,
      v_description,
      v_changes
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_company_id := NEW.company_id;
    v_description := get_action_description_tr('update', 'subcontractor', NEW.name);
    v_changes := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      v_action,
      'subcontractor',
      NEW.id,
      v_description,
      v_changes
    );
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_company_id := OLD.company_id;
    v_description := get_action_description_tr('delete', 'subcontractor', OLD.name);
    v_changes := jsonb_build_object('old', row_to_json(OLD));
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      v_action,
      'subcontractor',
      OLD.id,
      v_description,
      v_changes
    );
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Informal Payments Table Triggers
CREATE OR REPLACE FUNCTION log_informal_payment_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_action TEXT;
  v_changes JSONB;
  v_description TEXT;
  v_project_name TEXT;
  v_supplier_name TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_company_id := NEW.company_id;
    v_description := get_action_description_tr('create', 'informal_payment');
    
    -- Get related names
    IF NEW.project_id IS NOT NULL THEN
      SELECT name INTO v_project_name FROM projects WHERE id = NEW.project_id;
    END IF;
    IF NEW.supplier_id IS NOT NULL THEN
      SELECT name INTO v_supplier_name FROM suppliers WHERE id = NEW.supplier_id;
    END IF;
    
    -- Add names to changes
    v_changes := jsonb_build_object('new', row_to_json(NEW));
    IF v_project_name IS NOT NULL THEN
      v_changes := jsonb_set(v_changes, '{new,project_name}', to_jsonb(v_project_name));
    END IF;
    IF v_supplier_name IS NOT NULL THEN
      v_changes := jsonb_set(v_changes, '{new,supplier_name}', to_jsonb(v_supplier_name));
    END IF;
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      v_action,
      'informal_payment',
      NEW.id,
      v_description,
      v_changes
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_company_id := NEW.company_id;
    v_description := get_action_description_tr('update', 'informal_payment');
    
    -- Get related names
    IF NEW.project_id IS NOT NULL THEN
      SELECT name INTO v_project_name FROM projects WHERE id = NEW.project_id;
    END IF;
    IF NEW.supplier_id IS NOT NULL THEN
      SELECT name INTO v_supplier_name FROM suppliers WHERE id = NEW.supplier_id;
    END IF;
    
    -- Add names to changes
    v_changes := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
    IF v_project_name IS NOT NULL THEN
      v_changes := jsonb_set(v_changes, '{new,project_name}', to_jsonb(v_project_name));
    END IF;
    IF v_supplier_name IS NOT NULL THEN
      v_changes := jsonb_set(v_changes, '{new,supplier_name}', to_jsonb(v_supplier_name));
    END IF;
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      v_action,
      'informal_payment',
      NEW.id,
      v_description,
      v_changes
    );
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_company_id := OLD.company_id;
    v_description := get_action_description_tr('delete', 'informal_payment');
    
    -- Get related names
    IF OLD.project_id IS NOT NULL THEN
      SELECT name INTO v_project_name FROM projects WHERE id = OLD.project_id;
    END IF;
    IF OLD.supplier_id IS NOT NULL THEN
      SELECT name INTO v_supplier_name FROM suppliers WHERE id = OLD.supplier_id;
    END IF;
    
    -- Add names to changes
    v_changes := jsonb_build_object('old', row_to_json(OLD));
    IF v_project_name IS NOT NULL THEN
      v_changes := jsonb_set(v_changes, '{old,project_name}', to_jsonb(v_project_name));
    END IF;
    IF v_supplier_name IS NOT NULL THEN
      v_changes := jsonb_set(v_changes, '{old,supplier_name}', to_jsonb(v_supplier_name));
    END IF;
    
    PERFORM log_activity(
      v_user_id,
      v_company_id,
      v_action,
      'informal_payment',
      OLD.id,
      v_description,
      v_changes
    );
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================

-- Projects
DROP TRIGGER IF EXISTS trigger_log_project_changes ON projects;
CREATE TRIGGER trigger_log_project_changes
AFTER INSERT OR UPDATE OR DELETE ON projects
FOR EACH ROW EXECUTE FUNCTION log_project_changes();

-- Invoices
DROP TRIGGER IF EXISTS trigger_log_invoice_changes ON invoices;
CREATE TRIGGER trigger_log_invoice_changes
AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION log_invoice_changes();

-- Invoice Project Links
DROP TRIGGER IF EXISTS trigger_log_invoice_project_link_changes ON invoice_project_links;
CREATE TRIGGER trigger_log_invoice_project_link_changes
AFTER INSERT OR DELETE ON invoice_project_links
FOR EACH ROW EXECUTE FUNCTION log_invoice_project_link_changes();

-- Users
DROP TRIGGER IF EXISTS trigger_log_user_changes ON users;
CREATE TRIGGER trigger_log_user_changes
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION log_user_changes();

-- Payments
DROP TRIGGER IF EXISTS trigger_log_payment_changes ON payments;
CREATE TRIGGER trigger_log_payment_changes
AFTER INSERT OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION log_payment_changes();

-- Subcontractors (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subcontractors') THEN
    DROP TRIGGER IF EXISTS trigger_log_subcontractor_changes ON subcontractors;
    CREATE TRIGGER trigger_log_subcontractor_changes
    AFTER INSERT OR UPDATE OR DELETE ON subcontractors
    FOR EACH ROW EXECUTE FUNCTION log_subcontractor_changes();
  END IF;
END $$;

-- Informal Payments (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'informal_payments') THEN
    DROP TRIGGER IF EXISTS trigger_log_informal_payment_changes ON informal_payments;
    CREATE TRIGGER trigger_log_informal_payment_changes
    AFTER INSERT OR UPDATE OR DELETE ON informal_payments
    FOR EACH ROW EXECUTE FUNCTION log_informal_payment_changes();
  END IF;
END $$;

-- ============================================================================
-- ADD PERMISSIONS
-- ============================================================================

-- Add activity_logs permission (only if not exists)
DO $$
BEGIN
  -- Insert activity_logs read permission if not exists
  IF NOT EXISTS (
    SELECT 1 FROM public.permissions 
    WHERE resource = 'activity_logs' AND action = 'read'
  ) THEN
    INSERT INTO public.permissions (resource, action, description)
    VALUES ('activity_logs', 'read', 'Aktivite loglarını görüntüleyebilir');
  END IF;

  -- Insert activity_logs manage permission if not exists
  IF NOT EXISTS (
    SELECT 1 FROM public.permissions 
    WHERE resource = 'activity_logs' AND action = 'manage'
  ) THEN
    INSERT INTO public.permissions (resource, action, description)
    VALUES ('activity_logs', 'manage', 'Tüm aktivite loglarını yönetebilir');
  END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE activity_logs IS 'Comprehensive activity logging for all user actions across the system';
COMMENT ON COLUMN activity_logs.action_type IS 'Type of action performed (create, update, delete, etc.)';
COMMENT ON COLUMN activity_logs.resource_type IS 'Type of resource affected (project, invoice, user, etc.)';
COMMENT ON COLUMN activity_logs.resource_id IS 'ID of the specific resource affected (nullable for bulk operations)';
COMMENT ON COLUMN activity_logs.description IS 'Human-readable description in Turkish';
COMMENT ON COLUMN activity_logs.changes IS 'JSONB containing old and new values for audit trail';
COMMENT ON COLUMN activity_logs.metadata IS 'Additional context like IP address, user agent, etc.';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Activity Logs System başarıyla oluşturuldu!';
  RAISE NOTICE '📊 Tablo: activity_logs';
  RAISE NOTICE '🔒 RLS Politikaları: Oluşturuldu';
  RAISE NOTICE '⚡ Trigger''lar: Projects, Invoices, Users, Payments, Links';
  RAISE NOTICE '🎯 Yetkiler: activity_logs.read, activity_logs.manage';
END $$;
