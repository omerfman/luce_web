-- Fix subcontractor trigger: Remove created_by field reference
-- Date: 2026-01-20
-- Issue: Trigger trying to access non-existent 'created_by' field in subcontractors table

-- ============================================================================
-- Fix log_subcontractor_changes() trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION log_subcontractor_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_action TEXT;
  v_changes JSONB;
  v_description TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_company_id := NEW.company_id;
    v_description := get_action_description_tr('create', 'subcontractor', NEW.name);
    v_changes := jsonb_build_object('new', row_to_json(NEW));
    
    -- Note: created_by field does not exist in subcontractors table
    -- User info is captured via auth.uid() in v_user_id
    
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

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Subcontractor trigger fixed - created_by field reference removed';
END $$;
