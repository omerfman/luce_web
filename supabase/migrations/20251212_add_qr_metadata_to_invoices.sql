-- Add QR code metadata fields to invoices table
-- QR'dan gelen ekstra bilgileri saklayacağız

-- Yeni kolonlar ekle
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS supplier_vkn VARCHAR(11), -- Satıcı VKN
ADD COLUMN IF NOT EXISTS buyer_vkn VARCHAR(11), -- Alıcı VKN (avkntckn)
ADD COLUMN IF NOT EXISTS invoice_scenario VARCHAR(50), -- senaryo (TICARIFATURA, TEMELFATURA)
ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20), -- tip (SATIS, ALIS)
ADD COLUMN IF NOT EXISTS invoice_ettn UUID, -- ettn (E-Fatura UUID)
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TRY'; -- para birimi

-- Yorumlar
COMMENT ON COLUMN invoices.supplier_vkn IS 'Satıcı Vergi Kimlik Numarası (QR''dan)';
COMMENT ON COLUMN invoices.buyer_vkn IS 'Alıcı Vergi Kimlik Numarası (QR''dan)';
COMMENT ON COLUMN invoices.invoice_scenario IS 'Fatura senaryosu: TICARIFATURA, TEMELFATURA, vb.';
COMMENT ON COLUMN invoices.invoice_type IS 'Fatura tipi: SATIS, ALIS';
COMMENT ON COLUMN invoices.invoice_ettn IS 'E-Fatura ETTN (Elektronik Fatura Takip Numarası)';
COMMENT ON COLUMN invoices.currency IS 'Para birimi kodu (TRY, USD, EUR, vb.)';

-- İndeksler (filtreleme ve arama için)
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_vkn ON invoices(supplier_vkn);
CREATE INDEX IF NOT EXISTS idx_invoices_buyer_vkn ON invoices(buyer_vkn);
CREATE INDEX IF NOT EXISTS idx_invoices_scenario ON invoices(invoice_scenario);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_ettn ON invoices(invoice_ettn);
CREATE INDEX IF NOT EXISTS idx_invoices_currency ON invoices(currency);

COMMENT ON INDEX idx_invoices_supplier_vkn IS 'Tedarikçi VKN ile arama için';
COMMENT ON INDEX idx_invoices_buyer_vkn IS 'Alıcı VKN ile arama için';
COMMENT ON INDEX idx_invoices_scenario IS 'Fatura senaryosu ile filtreleme için';
COMMENT ON INDEX idx_invoices_type IS 'Fatura tipi ile filtreleme için';
COMMENT ON INDEX idx_invoices_ettn IS 'E-Fatura ETTN (UUID) ile arama için';
COMMENT ON INDEX idx_invoices_currency IS 'Para birimi ile filtreleme için';
