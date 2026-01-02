# Test Verilerini Temizleme - Hızlı Başlangıç

## 🎯 Ne Yapılacak?

Sistemdeki tüm test/demo verilerini temizleyip gerçek kullanıma hazırlama.

## ⚡ Hızlı Adımlar (5 Dakika)

### 1️⃣ SQL Script'i Çalıştır

```bash
# 1. Supabase Dashboard'a git
# 2. SQL Editor'ü aç
# 3. scripts/clean-all-test-data.sql dosyasını aç
# 4. İçeriği kopyala ve SQL Editor'e yapıştır
# 5. Çalıştır (Run)
```

### 2️⃣ Storage'ı Temizle

```bash
# Terminal'de çalıştır:
npm run clean:storage

# Onay sorusuna 'y' yaz
```

### 3️⃣ Doğrula

Supabase SQL Editor'de çalıştır:
```sql
SELECT 
  (SELECT COUNT(*) FROM invoices) AS invoices,
  (SELECT COUNT(*) FROM payments) AS payments;

-- Hepsi 0 olmalı
```

## ✅ Sonuç

- ✅ Tüm faturalar silindi
- ✅ Tüm PDF'ler silindi
- ✅ Tüm ödemeler silindi
- ✅ Kullanıcılar korundu
- ✅ Tedarikçiler korundu ✨
- ✅ Taşeronlar korundu ✨
- ✅ Projeler korundu
- ✅ Sistem ayarları korundu

## 📖 Detaylı Rehber

Daha fazla bilgi için:
```bash
npm run clean:help
# veya
cat scripts/CLEAN_TEST_DATA_GUIDE.md
```

## ⚠️ Önemli

- Bu işlem **GERİ ALINAMAZ**!
- Önce **backup** alın (önerilir)
- Test ortamında deneyin

## 🚀 Temizledikten Sonra

1. Uygulamayı aç: `npm run dev`
2. İlk gerçek faturayı yükle
3. Sistemi test et
4. Production'a geç 🎉

---

**Dosyalar:**
- `scripts/clean-all-test-data.sql` - Database temizleme
- `scripts/clean-storage-files.ts` - Storage temizleme
- `scripts/CLEAN_TEST_DATA_GUIDE.md` - Detaylı rehber
