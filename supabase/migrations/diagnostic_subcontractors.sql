-- Diagnostic script: Check subcontractors table structure and triggers
-- Date: 2026-01-20

-- ============================================================================
-- 1. Check subcontractors table columns
-- ============================================================================
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'subcontractors'
ORDER BY ordinal_position;

-- ============================================================================
-- 2. Check triggers on subcontractors table
-- ============================================================================
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'subcontractors';

-- ============================================================================
-- 3. Check RLS policies on subcontractors table
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'subcontractors';

-- ============================================================================
-- 4. Try to see function definition for log_subcontractor_changes
-- ============================================================================
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'log_subcontractor_changes';
