-- Add new columns to invoices table for enhanced invoice data
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS supplier_name TEXT,
ADD COLUMN IF NOT EXISTS goods_services_total DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS withholding_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS payment_type TEXT;

-- Add comments to new columns
COMMENT ON COLUMN public.invoices.supplier_name IS 'Fatura firma adı / Tedarikçi adı';
COMMENT ON COLUMN public.invoices.goods_services_total IS 'Mal ve hizmet toplamı (KDV hariç)';
COMMENT ON COLUMN public.invoices.vat_amount IS 'KDV tutarı';
COMMENT ON COLUMN public.invoices.withholding_amount IS 'Tevkifat tutarı';
COMMENT ON COLUMN public.invoices.payment_type IS 'Ödeme tipi (Nakit, Kredi Kartı, Banka Transferi, Çek, Senet, Havale/EFT)';

-- Create index for supplier_name for faster filtering
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_name ON public.invoices(supplier_name);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_type ON public.invoices(payment_type);
