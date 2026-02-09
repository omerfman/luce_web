-- ============================================================================
-- Add rejection fields to invoices table
-- ============================================================================
-- This migration adds support for rejecting invoices when there are errors
-- or incorrect service charges. Rejected invoices are considered invalid
-- and excluded from all calculations.
-- ============================================================================

-- Add rejection fields to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS is_rejected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Add index for filtering rejected invoices
CREATE INDEX IF NOT EXISTS idx_invoices_is_rejected ON public.invoices(is_rejected) WHERE is_rejected = TRUE;

-- Add comment
COMMENT ON COLUMN public.invoices.is_rejected IS 'Fatura reddedildi mi? Reddedilen faturalar geçersiz sayılır ve hiçbir hesaba dahil edilmez.';
COMMENT ON COLUMN public.invoices.rejection_reason IS 'Faturanın reddedilme sebebi (hata, yanlış hizmet ücreti, vb.)';
COMMENT ON COLUMN public.invoices.rejected_by IS 'Faturayı reddeden kullanıcı';
COMMENT ON COLUMN public.invoices.rejected_at IS 'Faturanın reddedilme zamanı';

-- Verify the changes
DO $$
BEGIN
  RAISE NOTICE 'Invoice rejection fields added successfully!';
  RAISE NOTICE 'Columns added:';
  RAISE NOTICE '  - is_rejected (BOOLEAN)';
  RAISE NOTICE '  - rejection_reason (TEXT)';
  RAISE NOTICE '  - rejected_by (UUID)';
  RAISE NOTICE '  - rejected_at (TIMESTAMPTZ)';
END $$;
