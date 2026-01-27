-- Add project_id column to payments table
-- This allows tracking which project a payment is allocated to when an invoice spans multiple projects

ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_project_id ON public.payments(project_id);

-- Add helpful comment
COMMENT ON COLUMN public.payments.project_id IS 'Optional: Links payment to a specific project when invoice is assigned to multiple projects';
