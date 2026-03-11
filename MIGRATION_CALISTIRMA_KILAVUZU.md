# 🚀 CARİ HESAP MİGRATION KILAVUZU

## Problem
Console'da şu hatalar görünüyor:
- `totalInvoices: 0` - Faturalar gelmiyor
- `totalPayments: -48775` - Yanlış hesaplama
- Aylık özette kredi kartı ödemeleri görünmüyor

## Çözüm: Migration'ları Çalıştır

### Adım 1: Supabase Dashboard'a Git
1. https://supabase.com/dashboard adresine git
2. Projenizi seçin (luce_web)
3. Sol menüden **SQL Editor** seçin

### Adım 2: İlk Migration'ı Çalıştır

**Dosya:** `supabase/migrations/20260311_add_current_account_to_suppliers.sql`

Kopyalayıp SQL Editor'a yapıştır ve **RUN** tıkla:

```sql
-- =====================================================
-- CARİ HESAP SİSTEMİ - SUPPLIERS TABLE GÜNCELLEMESİ
-- =====================================================

-- Cari hesap flag ve notlar kolonu ekle
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS is_current_account BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS current_account_notes TEXT;

-- Yorum ekle
COMMENT ON COLUMN suppliers.is_current_account IS 'Firma cari hesap olarak mı takip ediliyor? (Parçalı ödemeler için)';
COMMENT ON COLUMN suppliers.current_account_notes IS 'Cari hesap açıklaması/notları';

-- Index oluştur (performans için)
CREATE INDEX IF NOT EXISTS idx_suppliers_current_account 
ON suppliers(company_id, is_current_account) 
WHERE is_current_account = TRUE;

-- Index açıklaması
COMMENT ON INDEX idx_suppliers_current_account IS 'Cari hesap olan firmaları hızlı listeleme için';
```

### Adım 3: İkinci Migration'ı Çalıştır

**Dosya:** `supabase/migrations/20260311_add_supplier_match_to_statements.sql`

Kopyalayıp SQL Editor'a yapıştır ve **RUN** tıkla (dosya içeriği uzun olduğu için tam dosyayı aç):

```bash
Get-Content ".\supabase\migrations\20260311_add_supplier_match_to_statements.sql" | Set-Clipboard
```

PowerShell'de yukarıdaki komutu çalıştır, sonra Supabase SQL Editor'a yapıştır.

### Adım 4: Firmayı Cari Hesap Olarak İşaretle

NURAKS MOBİLYA firmasını cari hesap olarak işaretlemek için:

```sql
-- NURAKS MOBİLYA'yı cari hesap yap
UPDATE suppliers 
SET 
  is_current_account = TRUE,
  current_account_notes = 'Parçalı ödeme yapılan firma - Kredi kartı ile takip ediliyor'
WHERE id = 'c872e152-50ed-4bec-937d-4ba290211d21';

-- Kontrol et
SELECT 
  id, 
  name, 
  is_current_account, 
  current_account_notes 
FROM suppliers 
WHERE id = 'c872e152-50ed-4bec-937d-4ba290211d21';
```

### Adım 5: Test Et

1. Migration'lar başarıyla çalıştıktan sonra
2. Browser'da sayfayı yenile: http://localhost:3002/suppliers/c872e152-50ed-4bec-937d-4ba290211d21
3. Console'da şu log'ları göreceksin:

```
📊 [Current Account] Invoices loaded: { count: 19, ... }
📊 [Current Account] Card payments loaded: { totalCount: 3, ... }
💰 [Current Account] Calculations: { totalPayments: 48775, totalInvoices: 125728, ... }
```

4. Sayfada görmen gerekenler:
   - ✅ **Cari Hesap Özeti** kartında "Toplam Faturalar" değeri (0 değil)
   - ✅ **Aylık Özet** bölümünde "💳 Kredi Kartı" satırı
   - ✅ Doğru bakiye hesaplaması

## Sorun Giderme

### "column already exists" Hatası
Migration zaten çalışmış demektir. `IF NOT EXISTS` kullandığımız için sorun olmaz.

### "totalInvoices hala 0"
Faturaların `supplier_id` kolonu NULL olabilir. Elle bağla:

```sql
-- Faturalara supplier_id ekle (VKN'ye göre)
UPDATE invoices i
SET supplier_id = s.id
FROM suppliers s
WHERE i.supplier_vkn = s.vkn
  AND i.supplier_id IS NULL
  AND s.company_id = i.company_id;

-- Kontrol et
SELECT COUNT(*) FROM invoices 
WHERE supplier_id = 'c872e152-50ed-4bec-937d-4ba290211d21';
```

### Server Console Log'larını Görmek
Development server terminalinde (npm run dev çalışan terminal) şu log'ları göreceksin:

```
📊 [Current Account] Invoices loaded: ...
📊 [Current Account] Card payments loaded: ...
🔄 Supplier current account check: ...
```

Eğer bu log'lar görünmüyorsa, terminali paylaş.

## Özet

1. ✅ Migration 1: `20260311_add_current_account_to_suppliers.sql`
2. ✅ Migration 2: `20260311_add_supplier_match_to_statements.sql`  
3. ✅ Firmayı işaretle: `UPDATE suppliers SET is_current_account = TRUE ...`
4. ✅ Sayfayı yenile ve test et
5. ✅ Console log'larını kontrol et

Sorular:
- Migration çalıştırırken hata aldın mı?
- Server console'da (npm run dev terminali) ne yazıyor?
- Supplier'ı cari hesap olarak işaretledin mi?
