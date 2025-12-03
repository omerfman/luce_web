-- =====================================================
-- SUPABASE STORAGE SETUP
-- =====================================================
-- Version: 1.0
-- Date: 2025-12-03
-- Description: Storage buckets and security policies
-- =====================================================

-- =====================================================
-- CREATE STORAGE BUCKET FOR INVOICES
-- =====================================================

-- Note: This SQL creates the bucket and policies
-- In Supabase Dashboard: Storage > Create Bucket > "invoices"
-- Settings: Private (not public), File size limit: 5MB, Allowed MIME types: application/pdf

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  false,  -- Private bucket
  5242880,  -- 5MB in bytes
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STORAGE POLICIES FOR INVOICES BUCKET
-- =====================================================

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload invoices for their company
CREATE POLICY "Users can upload company invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoices'
  AND auth.uid() IN (
    SELECT id FROM public.users 
    WHERE company_id = (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  )
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.users WHERE id = auth.uid()
  )
);

-- Policy: Users can read their company's invoices
CREATE POLICY "Users can read company invoices"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoices'
  AND auth.uid() IN (
    SELECT id FROM public.users
    WHERE company_id::text = (storage.foldername(name))[1]
  )
);

-- Policy: Users can update their company's invoices (metadata)
CREATE POLICY "Users can update company invoices"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'invoices'
  AND auth.uid() IN (
    SELECT id FROM public.users
    WHERE company_id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'invoices'
  AND auth.uid() IN (
    SELECT id FROM public.users
    WHERE company_id::text = (storage.foldername(name))[1]
  )
);

-- Policy: Users with permission can delete invoices
CREATE POLICY "Authorized users can delete company invoices"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoices'
  AND auth.uid() IN (
    SELECT u.id FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.company_id::text = (storage.foldername(name))[1]
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(r.permissions) AS perm
        WHERE perm->>'resource' = 'invoices'
          AND perm->>'action' IN ('delete', 'manage')
      )
  )
);

-- =====================================================
-- HELPER FUNCTIONS FOR STORAGE
-- =====================================================

-- Function to generate storage path for invoice
CREATE OR REPLACE FUNCTION generate_invoice_storage_path(
  p_company_id UUID,
  p_filename TEXT
)
RETURNS TEXT AS $$
BEGIN
  -- Format: company_id/year/month/timestamp_filename.pdf
  RETURN p_company_id::text || '/' || 
         TO_CHAR(NOW(), 'YYYY') || '/' ||
         TO_CHAR(NOW(), 'MM') || '/' ||
         EXTRACT(EPOCH FROM NOW())::bigint || '_' ||
         p_filename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION generate_invoice_storage_path IS 'Fatura için storage path oluşturur (organizasyon için)';

-- Function to get signed URL for private file
CREATE OR REPLACE FUNCTION get_invoice_signed_url(
  p_invoice_id UUID,
  p_expires_in INT DEFAULT 3600  -- 1 hour default
)
RETURNS TEXT AS $$
DECLARE
  v_pdf_url TEXT;
  v_company_id UUID;
  v_user_company_id UUID;
BEGIN
  -- Get invoice PDF URL and company_id
  SELECT pdf_url, company_id INTO v_pdf_url, v_company_id
  FROM invoices
  WHERE id = p_invoice_id;
  
  -- Get current user's company_id
  SELECT company_id INTO v_user_company_id
  FROM users
  WHERE id = auth.uid();
  
  -- Check if user has access to this invoice
  IF v_company_id != v_user_company_id THEN
    RAISE EXCEPTION 'Access denied to this invoice';
  END IF;
  
  -- Return the PDF URL (signed URL will be generated in application layer)
  RETURN v_pdf_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_invoice_signed_url IS 'Fatura PDF için signed URL döndürür (security check ile)';

-- =====================================================
-- STORAGE STATISTICS VIEW
-- =====================================================

CREATE OR REPLACE VIEW storage_stats AS
SELECT 
  (storage.foldername(name))[1] AS company_id,
  COUNT(*) AS file_count,
  SUM(metadata->>'size')::bigint AS total_size_bytes,
  ROUND(SUM(metadata->>'size')::bigint / 1024.0 / 1024.0, 2) AS total_size_mb,
  MIN(created_at) AS first_upload,
  MAX(created_at) AS last_upload
FROM storage.objects
WHERE bucket_id = 'invoices'
GROUP BY (storage.foldername(name))[1];

COMMENT ON VIEW storage_stats IS 'Şirket bazında storage kullanım istatistikleri';

-- Grant access to view
GRANT SELECT ON storage_stats TO authenticated;

-- =====================================================
-- COMPLETION
-- =====================================================

DO $$ 
BEGIN 
  RAISE NOTICE '✅ Storage bucket and policies created successfully!';
  RAISE NOTICE '📁 Bucket: invoices (private, 5MB limit, PDF only)';
  RAISE NOTICE '🔒 Company-based isolation enforced';
  RAISE NOTICE '📊 Storage statistics view available';
  RAISE NOTICE '⚠️  Remember to create bucket in Supabase Dashboard if not exists';
END $$;
