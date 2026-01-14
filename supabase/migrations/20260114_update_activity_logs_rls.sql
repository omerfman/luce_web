-- ============================================================================
-- Update Activity Logs RLS Policies
-- Created: 2026-01-14
-- Purpose: Fix RLS policies for proper access control
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Company admins can view company logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Super Admin can view all activity logs" ON public.activity_logs;

-- Recreate policies in correct priority order

-- Policy 1: Super Admin can view all logs (highest priority)
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

-- Policy 3: Regular users can view only their own activity logs
CREATE POLICY "Users can view their own activity logs"
ON public.activity_logs FOR SELECT
USING (
  user_id = auth.uid()
  AND NOT EXISTS (
    -- Sadece özel izni olmayanlar için
    SELECT 1 WHERE 
      has_permission(auth.uid(), 'activity_logs', 'read')
      OR has_permission(auth.uid(), 'activity_logs', 'manage')
      OR has_permission(auth.uid(), '*', '*')
  )
);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Activity Logs RLS politikaları güncellendi!';
  RAISE NOTICE '🔒 Super Admin: Tüm logları görebilir';
  RAISE NOTICE '🔒 Company Admin: Kendi şirketinin tüm loglarını görebilir';
  RAISE NOTICE '🔒 Normal Kullanıcı: Sadece kendi loglarını görebilir';
END $$;
