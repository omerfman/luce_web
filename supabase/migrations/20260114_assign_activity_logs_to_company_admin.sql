-- ============================================================================
-- Assign Activity Logs Permissions to Company Admin Role
-- Created: 2026-01-14
-- Purpose: Company Admin rolüne activity_logs yetkilerini ata
-- Updated: Permission format fixed to match object structure
-- ============================================================================

-- Company Admin rolüne activity_logs read yetkisi ver (OBJE FORMATINDA)
DO $$
DECLARE
  v_role RECORD;
  v_current_permissions JSONB;
  v_new_permissions JSONB;
  v_activity_logs_permission JSONB := '{"scope": "company", "action": "read", "resource": "activity_logs"}'::jsonb;
BEGIN
  RAISE NOTICE 'Activity logs yetkilerini Company Admin rollerine ekliyoruz...';
  
  -- Tüm Company Admin ve Admin rollerini bul ve güncelle
  FOR v_role IN 
    SELECT id, name, permissions, company_id 
    FROM public.roles 
    WHERE (name = 'Company Admin' OR name = 'Admin') AND company_id IS NOT NULL
  LOOP
    v_current_permissions := COALESCE(v_role.permissions, '[]'::jsonb);
    
    -- activity_logs permission objesini ekle (eğer yoksa)
    IF NOT v_current_permissions @> jsonb_build_array(v_activity_logs_permission) THEN
      v_new_permissions := v_current_permissions || jsonb_build_array(v_activity_logs_permission);
      
      UPDATE public.roles
      SET permissions = v_new_permissions
      WHERE id = v_role.id;
      
      RAISE NOTICE '✅ activity_logs.read yetkisi eklendi: Rol = %, ID = %, Şirket ID = %', 
        v_role.name, v_role.id, v_role.company_id;
    ELSE
      RAISE NOTICE '⚠️  activity_logs.read yetkisi zaten mevcut: Rol = %, ID = %', v_role.name, v_role.id;
    END IF;
  END LOOP;
  
  -- Super Admin rollerine activity_logs.manage yetkisi ekle
  FOR v_role IN 
    SELECT id, name, permissions, company_id 
    FROM public.roles 
    WHERE name = 'Super Admin' AND company_id IS NULL
  LOOP
    v_current_permissions := COALESCE(v_role.permissions, '[]'::jsonb);
    v_activity_logs_permission := '{"scope": "all", "action": "manage", "resource": "activity_logs"}'::jsonb;
    
    -- activity_logs.manage yetkisini ekle (eğer yoksa)
    IF NOT v_current_permissions @> jsonb_build_array(v_activity_logs_permission) THEN
      v_new_permissions := v_current_permissions || jsonb_build_array(v_activity_logs_permission);
      
      UPDATE public.roles
      SET permissions = v_new_permissions
      WHERE id = v_role.id;
      
      RAISE NOTICE '✅ activity_logs.manage yetkisi Super Admin rolüne eklendi';
    ELSE
      RAISE NOTICE '⚠️  activity_logs.manage yetkisi Super Admin''de zaten mevcut';
    END IF;
  END LOOP;
  
END $$;

-- ============================================================================
-- Kontrol: Hangi rollere activity_logs yetkisi var?
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Activity Logs Yetkileri Kontrolü ===';
  
  FOR rec IN 
    SELECT 
      r.name as role_name,
      r.company_id,
      r.permissions
    FROM public.roles r
    WHERE r.permissions::text LIKE '%activity_logs%'
    ORDER BY r.name
  LOOP
    RAISE NOTICE 'Rol: %, Şirket: %, Yetkiler: %', 
      rec.role_name, 
      COALESCE(rec.company_id::TEXT, 'Super Admin (Global)'),
      rec.permissions;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ İşlem tamamlandı. Sayfayı yenileyerek test edebilirsiniz.';
END $$;
