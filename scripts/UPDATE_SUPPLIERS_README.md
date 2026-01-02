# Supplier İsimlerini Güncelleme - Tek Seferlik İşlem

## 📋 Amaç

Önceden eklenen faturalardaki gerçek firma isimlerini kullanarak `suppliers` tablosunda "Bilinmeyen Tedarikçi" olarak kayıtlı firmaların isimlerini günceller.

## 🎯 Ne Yapıyor?

1. `suppliers` tablosunda `name = 'Bilinmeyen Tedarikçi'` olan kayıtları bulur
2. Her VKN için `invoices` tablosunda gerçek firma isimlerini arar
3. Bulduğu gerçek firma isimlerini `suppliers` tablosuna yazar
4. Güncelleme raporu gösterir

## 🚀 Çalıştırma Seçenekleri

### Seçenek 1: SQL Script (Önerilen) ⚡

**Avantajlar:**
- En hızlı yöntem
- Tek SQL sorgusuyla toplu güncelleme
- Database'de direkt çalışır

**Adımlar:**
1. Supabase Dashboard'a git: https://supabase.com/dashboard
2. Project → SQL Editor
3. `scripts/update-supplier-names-from-invoices.sql` dosyasını aç
4. İçeriği SQL Editor'e yapıştır
5. "Run" butonuna bas

**Script içeriği:**
```sql
-- Durum analizi
SELECT COUNT(*) FROM suppliers WHERE name = 'Bilinmeyen Tedarikçi';

-- Güncelleme
UPDATE suppliers
SET name = subquery.real_supplier_name, updated_at = NOW()
FROM (
  SELECT DISTINCT ON (s.id)
    s.id as supplier_id,
    i.supplier_name as real_supplier_name
  FROM suppliers s
  INNER JOIN invoices i ON i.supplier_vkn = s.vkn AND i.company_id = s.company_id
  WHERE s.name = 'Bilinmeyen Tedarikçi'
    AND i.supplier_name IS NOT NULL 
    AND i.supplier_name != ''
    AND i.supplier_name != 'Bilinmeyen Tedarikçi'
  ORDER BY s.id, i.created_at DESC
) as subquery
WHERE suppliers.id = subquery.supplier_id;

-- Sonuçları kontrol et
SELECT * FROM suppliers WHERE updated_at > NOW() - INTERVAL '1 minute';
```

---

### Seçenek 2: TypeScript Script 🔧

**Avantajlar:**
- Detaylı log ve raporlama
- Hata ayıklama kolaylığı
- Adım adım işlem görünürlüğü

**Gereksinimler:**
```bash
npm install tsx @supabase/supabase-js
```

**Çalıştırma:**
```bash
# 1. Environment variables'ları ayarla (.env.local)
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key

# 2. Script'i çalıştır
npx tsx scripts/update-supplier-names.ts
```

**Beklenen çıktı:**
```
🔍 Supplier isim güncelleme scripti başlatılıyor...

1️⃣ "Bilinmeyen Tedarikçi" kayıtları aranıyor...
   📊 15 adet "Bilinmeyen Tedarikçi" bulundu

🔍 VKN: 1234567890 işleniyor...
   ✅ Gerçek firma ismi bulundu: "ABC İnşaat Ltd."
   ✅ Güncellendi: "Bilinmeyen Tedarikçi" → "ABC İnşaat Ltd."

...

============================================================
📊 ÖZET RAPOR
============================================================
✅ Güncellenen kayıt: 12
⚠️  Atlanan kayıt: 3
📝 Toplam işlenen: 15
============================================================

📌 Kalan "Bilinmeyen Tedarikçi" sayısı: 3

✨ Script başarıyla tamamlandı!
```

---

## ⚠️ Önemli Notlar

### Güvenlik
- Script **idempotent**'tir (birden fazla çalıştırılabilir)
- Sadece `name = 'Bilinmeyen Tedarikçi'` olanları günceller
- Mevcut gerçek firma isimlerini değiştirmez

### Kapsam
- ✅ **VKN'si olan** tedarikçiler güncellenir
- ❌ **VKN'si olmayan** tedarikçiler için manuel işlem gerekir

### Atlanan Kayıtlar
Şu durumlarda kayıt atlanır:
- VKN'ye sahip hiç fatura yoksa
- Tüm faturalarda supplier_name boş veya "Bilinmeyen Tedarikçi" ise

---

## 🔍 Manuel Kontrol

Güncellemeden önce durum kontrolü:

```sql
-- Kaç tane "Bilinmeyen Tedarikçi" var?
SELECT COUNT(*) 
FROM suppliers 
WHERE name = 'Bilinmeyen Tedarikçi';

-- Bu VKN'lere ait faturalarda gerçek isimler var mı?
SELECT 
  s.vkn,
  s.name as supplier_name,
  i.supplier_name as invoice_name,
  COUNT(*) as fatura_sayisi
FROM suppliers s
LEFT JOIN invoices i ON i.supplier_vkn = s.vkn
WHERE s.name = 'Bilinmeyen Tedarikçi'
  AND i.supplier_name IS NOT NULL
  AND i.supplier_name != 'Bilinmeyen Tedarikçi'
GROUP BY s.vkn, s.name, i.supplier_name;
```

Güncellemeden sonra kontrol:

```sql
-- Güncellenmiş kayıtları göster
SELECT 
  vkn,
  name,
  supplier_type,
  updated_at
FROM suppliers
WHERE updated_at > NOW() - INTERVAL '5 minutes'
ORDER BY updated_at DESC;
```

---

## 📊 Beklenen Sonuçlar

**Önce:**
```
suppliers tablosu:
vkn         | name                  | supplier_type
------------|-----------------------|--------------
1234567890  | Bilinmeyen Tedarikçi | pending
9876543210  | Bilinmeyen Tedarikçi | pending

invoices tablosu:
supplier_vkn | supplier_name
-------------|------------------
1234567890   | ABC İnşaat Ltd.
1234567890   | ABC İnşaat Ltd.
9876543210   | XYZ Yapı A.Ş.
```

**Sonra:**
```
suppliers tablosu:
vkn         | name              | supplier_type
------------|-------------------|--------------
1234567890  | ABC İnşaat Ltd.  | pending
9876543210  | XYZ Yapı A.Ş.    | pending
```

---

## 🆘 Sorun Giderme

### "No rows updated"
- Tüm supplier'lar zaten güncellenmiş olabilir
- `invoices` tablosunda gerçek firma isimleri olmayabilir

### "Permission denied"
- Supabase'de RLS politikalarını kontrol edin
- SQL Editor'de çalıştırıyorsanız, otomatik olarak admin yetkileriniz vardır
- TypeScript script için service role key gerekebilir (production'da kullanmayın!)

### VKN'siz Faturalar
VKN olmayan ama firma ismi olan faturalar için:
```sql
SELECT 
  supplier_name,
  COUNT(*) as fatura_sayisi
FROM invoices
WHERE (supplier_vkn IS NULL OR supplier_vkn = '')
  AND supplier_name IS NOT NULL
  AND supplier_name != ''
  AND supplier_name != 'Bilinmeyen Tedarikçi'
GROUP BY supplier_name
ORDER BY COUNT(*) DESC;
```

Bu firmalar için manuel olarak `suppliers` tablosuna eklenebilir.

---

## ✅ Checklist

- [ ] Script dosyalarını kontrol ettim
- [ ] Supabase credentials hazır
- [ ] Backup aldım (opsiyonel ama önerilen)
- [ ] SQL veya TypeScript seçeneğini belirledim
- [ ] Script'i çalıştırdım
- [ ] Sonuçları kontrol ettim
- [ ] Taşeron sayfasında değişiklikleri doğruladım

---

## 📅 Çalıştırma Zamanı

**Ne zaman çalıştırılmalı:**
- ✅ İlk deployment sonrası (tek sefer)
- ✅ Eski fatura verisi yüklendikten sonra
- ❌ Her deployment'ta (gerek yok)

**Sonraki kullanımlarda:**
Bu script'e artık gerek yok çünkü yeni kod otomatik olarak supplier isimlerini güncelliyor.

---

**Hazırlayan:** GitHub Copilot  
**Tarih:** 2026-01-02  
**Versiyon:** 1.0
