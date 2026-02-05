-- Fix user creation trigger to handle service role insertions
-- When auth.uid() is NULL (service role), skip logging for user creation

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
    -- Skip logging if auth.uid() is NULL (service role creation)
    -- This happens when creating users via admin API
    IF v_user_id IS NULL THEN
      RETURN NULL;
    END IF;
    
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
      -- Skip logging if auth.uid() is NULL (service role update)
      IF v_user_id IS NULL THEN
        RETURN NULL;
      END IF;
      
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
    -- Skip logging if auth.uid() is NULL (service role deletion)
    IF v_user_id IS NULL THEN
      RETURN NULL;
    END IF;
    
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
