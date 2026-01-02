# VKN'siz Faturalardan Supplier Kayıtları Oluşturma

## 🎯 Sorun

Taşeron ve Firma Yönetimi sayfasında bazı firmalar görünmüyor çünkü:
- Faturalarda firma isimleri var ✅
- Ama VKN bilgisi yok ❌
- Bu nedenle `suppliers` tablosunda kayıt yok ❌

## 💡 Çözüm

Bu script, VKN'si olmayan ama faturalarda ismi geçen firmaları `suppliers` tablosuna ekler.

## 🚀 Hızlı Çalıştırma

### 1️⃣ Supabase SQL Editor'e Git
https://supabase.com/dashboard → Projeniz → SQL Editor

### 2️⃣ Script'i Kopyala-Yapıştır
`scripts/create-suppliers-without-vkn.sql` dosyasının içeriğini kopyalayın

### 3️⃣ Run Butonuna Bas
Script çalıştırıldığında:
```
✅ 40 adet supplier kaydı oluşturuldu
```

### 4️⃣ Taşeron Sayfasını Yenile
Artık tüm firmalar "Bekleyen" (Pending) sekmesinde görünecek!

## 📋 Script Ne Yapıyor?

1. **Analiz:** VKN'siz ama isimli faturalar bulunur
2. **Oluşturma:** Her unique firma ismi için `suppliers` tablosuna kayıt eklenir
   - `vkn`: NULL
   - `name`: Faturadaki firma ismi
   - `supplier_type`: 'pending'
   - `is_active`: true
3. **Doğrulama:** Kaç kayıt eklendiğini gösterir

## 📊 Örnek Sonuç

**Script Çalıştırmadan ÖNCE:**
```
Taşeron ve Firma Yönetimi → Bekleyen
(Boş veya sadece birkaç kayıt)
```

**Script Çalıştırdıktan SONRA:**
```
Taşeron ve Firma Yönetimi → Bekleyen (40)
- TAŞKUM İNŞAAT MALZEMELERİ SANAYİ VE TİCARET LİMİTED ŞİRKETİ (7 fatura)
- ERDOĞAN ISITMA SİS.MÜH. VE İNŞ MAL. TİC.LTD.ŞTİ (4 fatura)
- ERPA ORMAN ÜRÜNLERI SAN. VE TIC. LTD. STI. (2 fatura)
- ... (37 firma daha)
```

## ⚠️ Önemli Notlar

### ✅ Güvenli
- **Duplicate kontrolü var:** Aynı firma birden fazla eklenmez
- **Idempotent:** Birden fazla çalıştırılabilir (zarar vermez)
- **Mevcut kayıtlara dokunmaz:** Sadece yeni kayıt ekler

### 📌 Kapsam
- ✅ VKN'si olmayan faturalar
- ✅ Firma ismi dolu olan faturalar
- ❌ "Bilinmeyen Tedarikçi" olarak kaydedilmiş olanlar (işlenmez)

### 🔄 Tekrar Çalıştırma
Script'i tekrar çalıştırabilirsiniz:
- Yeni fatura eklendiyse → Yeni firmalar eklenecek
- Eski faturalar için → Hiçbir şey olmayacak (zaten var)

## 🔍 Manuel Kontrol

### Önce: Kaç firma eklenecek?
```sql
SELECT COUNT(DISTINCT supplier_name) as firma_sayisi
FROM invoices
WHERE (supplier_vkn IS NULL OR supplier_vkn = '')
  AND supplier_name IS NOT NULL
  AND supplier_name != ''
  AND supplier_name != 'Bilinmeyen Tedarikçi'
  AND NOT EXISTS (
    SELECT 1 FROM suppliers s
    WHERE s.name = invoices.supplier_name
      AND s.company_id = invoices.company_id
      AND s.vkn IS NULL
  );
```

### Sonra: Kayıtlar eklendi mi?
```sql
SELECT 
  name,
  vkn,
  supplier_type,
  created_at
FROM suppliers
WHERE vkn IS NULL
ORDER BY created_at DESC
LIMIT 50;
```

### Fatura sayılarıyla birlikte göster:
```sql
SELECT 
  s.name,
  s.supplier_type,
  COUNT(i.id) as fatura_sayisi
FROM suppliers s
LEFT JOIN invoices i ON i.supplier_name = s.name 
  AND i.company_id = s.company_id
WHERE s.vkn IS NULL
GROUP BY s.id, s.name, s.supplier_type
ORDER BY COUNT(i.id) DESC;
```

## 🆘 Sorun Giderme

### "0 rows inserted"
**Olası nedenler:**
1. Tüm firmalar zaten eklenmiş ✅
2. Faturalarda VKN'siz firma yok
3. Tüm firmalar "Bilinmeyen Tedarikçi" olarak kayıtlı

**Kontrol için:**
```sql
-- Zaten kayıtlı VKN'siz firmalar
SELECT COUNT(*) FROM suppliers WHERE vkn IS NULL;

-- Faturalarda VKN'siz firma var mı?
SELECT COUNT(DISTINCT supplier_name) 
FROM invoices 
WHERE supplier_vkn IS NULL 
  AND supplier_name IS NOT NULL;
```

### "VKN her zaman NULL görünüyor"
Bu **normal**! VKN'siz faturalar için VKN bilgisi yok, NULL olması gerekiyor.

Daha sonra:
- Taşeron sayfasından VKN'yi manuel ekleyebilirsiniz
- Veya yeni faturalarda VKN'li gelirse otomatik güncellenecek

### "Duplicate key error"
Bu olmayacak çünkü script:
- `NOT EXISTS` ile kontrol yapıyor
- Aynı isimde kayıt varsa eklemiyor

## 📝 Sonraki Adımlar

Script çalıştırdıktan sonra:

1. **Taşeron Sayfasını Açın**
   - https://luce-web.vercel.app/subcontractors
   - "Bekleyen" (Pending) sekmesine gidin

2. **Firmaları Kategorize Edin**
   - Her firma için "Taşeron" veya "Fatura Firması" olarak atayın
   - Gerekirse VKN bilgisi ekleyin

3. **Otomatik Sistem Aktif**
   - Yeni faturalarda:
     - VKN varsa → Otomatik supplier kaydı oluşur ✅
     - VKN yoksa → Bu script tekrar çalıştırılmalı (veya manuel ekleme)

## 🎓 Ek Bilgi

### Neden VKN NULL Olabilir?
- E-fatura sistemi dışından gelen faturalar
- Bireysel kişilerden alınan faturalar
- Manuel girilen faturalar
- Eski sistemden aktarılan veriler

### VKN Sonradan Nasıl Eklenir?
1. Taşeron sayfasında firmayı bulun
2. "Düzenle" butonuna tıklayın
3. VKN alanını doldurun
4. Kaydedin

Sistem otomatik olarak:
- Aynı isimli faturalarda VKN'yi güncelleyecek
- İlgili istatistikleri yenileyecek

---

**Hazırlanma Tarihi:** 2026-01-02  
**Durum:** Production Ready ✅  
**Tekrar Çalıştırılabilir:** Evet ✅
