-- ============================================================================
-- Setup Supabase Storage for invoices
-- ============================================================================

-- Create invoices bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload invoices to their own company folder
DROP POLICY IF EXISTS "Users can upload invoices to own company" ON storage.objects;
CREATE POLICY "Users can upload invoices to own company"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text 
    FROM users 
    WHERE id = auth.uid()
  )
);

-- Policy: Users can view invoices from their own company
DROP POLICY IF EXISTS "Users can view own company invoices" ON storage.objects;
CREATE POLICY "Users can view own company invoices"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text 
    FROM users 
    WHERE id = auth.uid()
  )
);

-- Policy: Users can delete invoices from their own company (if they have permission)
DROP POLICY IF EXISTS "Users can delete own company invoices" ON storage.objects;
CREATE POLICY "Users can delete own company invoices"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text 
    FROM users 
    WHERE id = auth.uid()
  )
  AND has_permission(auth.uid(), 'invoices', 'delete', 'company')
);

-- Verify
SELECT 'Storage bucket and policies created!' as status;
SELECT * FROM storage.buckets WHERE id = 'invoices';
