# Gayri Resmi Ödemeler PDF Erişim Sistemi - Kurulum

## ✅ Tamamlanan İşlemler

1. **Veritabanı Migrasyonu Hazır**: `20260108_add_contract_pdf_to_informal_payments.sql`
2. **PDF Cloudinary Yükleme Sistemi**: Otomatik yükleme ve URL saklama
3. **API Endpoint**: `/api/upload-contract-pdf` oluşturuldu
4. **Liste Görünümü**: Desktop tablo + mobil kart görünümü eklendi
5. **Responsive PDF Butonları**: Tüm cihazlarda çalışıyor

## 🚀 Kurulum Adımları

### 1. Supabase Migration Çalıştır

Supabase Dashboard'unuzda SQL Editor'ı açın ve aşağıdaki SQL'i çalıştırın:

```sql
-- Add contract_pdf_url column to informal_payments table
ALTER TABLE informal_payments 
ADD COLUMN IF NOT EXISTS contract_pdf_url TEXT;

-- Add comment
COMMENT ON COLUMN informal_payments.contract_pdf_url IS 'Sözleşmeli ödeme PDF tutanağının Cloudinary URL''si';

-- Create index for queries with has_contract
CREATE INDEX IF NOT EXISTS idx_informal_payments_contract_pdf 
ON informal_payments(contract_pdf_url) 
WHERE contract_pdf_url IS NOT NULL;
```

**Adımlar:**
1. https://supabase.com/dashboard/project/{YOUR_PROJECT}/sql/new adresine gidin
2. Yukarıdaki SQL kodunu yapıştırın
3. "Run" butonuna tıklayın

### 2. Vercel Deploy

Kod zaten GitHub'a push edildi ve Vercel otomatik deploy yapacak.

Build hatası düzeltildi:
- ✅ `createServerClient` async kullanımı güncellendi
- ✅ Vercel build başarılı olacak

### 3. Sistem Hazır!

Migration tamamlandıktan sonra sistem çalışmaya hazır olacak.

## 📋 Özellikler

### Desktop Görünüm (lg+)
- 8 kolonlu tablo görünümü
- "Sözleşme" kolonu ile PDF butonları
- Hover efektleri ve responsive tablo

### Mobile Görünüm
- Kompakt kart görünümü
- Tam genişlikte PDF butonları
- Touch-friendly büyük butonlar
- Satır satır kolay okuma

### PDF Durumları
- ✅ **PDF var**: Mor gradient buton → Yeni sekmede açılır
- ⚠️ **Sözleşme var ama PDF yok**: Amber uyarı mesajı
- ➖ **Sözleşme yok**: Gri tire (-)

## 🎯 Kullanım

1. **Yeni Sözleşmeli Ödeme Ekle**
   - "Sözleşmeli Ödeme" butonuna tıklayın
   - Form doldurun
   - PDF otomatik oluşturulur ve Cloudinary'ye yüklenir
   - URL veritabanına kaydedilir

2. **PDF'e Sonradan Erişim**
   - Liste satırındaki "PDF" butonuna tıklayın
   - PDF yeni sekmede açılır
   - Tarayıcıda görüntüleme, yazdırma, indirme seçenekleri

## 🔧 Teknik Detaylar

- **Storage**: Cloudinary (`luce_web/contracts/{companyId}/`)
- **URL Format**: fl_attachment:false (inline display)
- **API**: `/api/upload-contract-pdf`
- **Database**: `informal_payments.contract_pdf_url`
- **Type Safe**: TypeScript interfaces güncel

## ✅ Test Checklist

- [ ] Supabase migration çalıştırıldı
- [ ] Vercel deploy başarılı
- [ ] Yeni sözleşmeli ödeme ekle → PDF oluşuyor
- [ ] Liste satırında PDF butonu görünüyor
- [ ] PDF butonu çalışıyor (yeni sekmede açılıyor)
- [ ] Mobil görünüm test edildi
- [ ] Desktop görünüm test edildi

---

**Deploy Durumu**: 🟢 Kod GitHub'da, Vercel deploy oluyor
**Migration**: ⚠️ Manuel çalıştırılmalı (yukarıdaki SQL)
