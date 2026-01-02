# TÜM TEST VERİLERİNİ TEMİZLEME REHBERİ

## 📋 Genel Bakış

Bu rehber, sistemdeki tüm test/demo verilerini temizleyip projeyi gerçek verilerle kullanıma hazırlamak için hazırlanmıştır.

**Temizlenecek Veriler:**
- ✅ Tüm faturalar (invoices)
- ✅ Tüm ödemeler (payments)
- ✅ Tüm gayri resmi ödemeler (informal_payments)
- ✅ Fatura-proje bağlantıları (invoice_project_links)
- ✅ İlişkili aktivite logları (activity_logs)
- ✅ Storage'daki tüm PDF dosyaları

**Korunacak Veriler:**
- ✅ Kullanıcılar (users)
- ✅ Roller (roles)
- ✅ Şirketler (companies)
- ✅ Projeler (projects) - isteğe bağlı
- ✅ İzinler (permissions)
- ✅ Tedarikçiler (suppliers) ✨
- ✅ Taşeronlar (subcontractors) ✨

---

## ⚠️ ÖNEMLİ UYARILAR

1. **Bu işlem GERİ ALINAMAZ!** Silinen veriler kurtarılamaz.
2. Önce **backup almanızı** şiddetle tavsiye ederiz.
3. İşlemi **test ortamında** deneyip sonra production'da yapın.
4. Tüm kullanıcılara sistemi kullanmamalarını bildirin.

---

## 🔄 TEMİZLEME ADIMLARI

### Adım 1: Backup Alın (ÖNERİLİR)

#### Supabase Dashboard'dan Backup
```bash
# 1. Supabase Dashboard > Settings > Database
# 2. "Backups" sekmesine git
# 3. "Create Backup" butonuna tıkla
# 4. Backup tamamlanana kadar bekle
```

#### pg_dump ile Manuel Backup
```bash
pg_dump -h [SUPABASE_HOST] -U postgres -d postgres -t invoices -t suppliers -t subcontractors -t payments -t informal_payments > backup_test_data.sql
```

---

### Adım 2: SQL Script ile Database Temizleme

#### 2.1. Script'i Test Edin (Güvenli Mod)

```sql
-- scripts/clean-all-test-data.sql dosyasını açın

-- Son satırları şu şekilde ayarlayın:
-- COMMIT; satırını yorum satırı yapın (-- ekleyin)
ROLLBACK; -- Bu satırı aktif tutun

-- Script'i Supabase SQL Editor'de çalıştırın
-- Raporu kontrol edin, hiçbir veri silinmeyecek (ROLLBACK sayesinde)
```

#### 2.2. Gerçek Temizlemeyi Yapın

```sql
-- scripts/clean-all-test-data.sql dosyasını açın

-- Son satırları şu şekilde ayarlayın:
COMMIT; -- Bu satırı aktif edin
-- ROLLBACK; satırını yorum satırı yapın

-- Script'i Supabase SQL Editor'de çalıştırın
-- ⚠️ Bu sefer veriler gerçekten silinecek!
```

#### 2.3. Sonucu Doğrulayın

Script otomatik olarak bir rapor gösterecektir:
```
========================================
VERİ TEMİZLEME RAPORU
========================================
Kalan Faturalar: 0
Kalan Tedarikçiler: 0
Kalan Taşeronlar: 0
Kalan Ödemeler: 0
Kalan Gayri Resmi Ödemeler: 0
Kalan Fatura-Proje Bağlantıları: 0
İlişkili Aktivite Logları: 0
========================================
✅ TÜM TEST VERİLERİ BAŞARIYLA TEMİZLENDİ!
========================================
```

---

### Adım 3: Storage'daki PDF Dosyalarını Silin

#### Seçenek A: TypeScript Script (ÖNERİLİR)

```bash
# 1. .env.local dosyasında SUPABASE_SERVICE_ROLE_KEY olduğundan emin olun
# Supabase Dashboard > Settings > API > service_role key

# 2. Script'i çalıştırın
npx tsx scripts/clean-storage-files.ts

# 3. Onay sorusuna 'y' yazın
# Script tüm PDF dosyalarını silecektir
```

#### Seçenek B: Manuel Silme (Supabase Dashboard)

```bash
# 1. Supabase Dashboard'a git
# 2. Storage > invoices bucket'ını aç
# 3. Tüm klasörleri seç (Ctrl+A veya Cmd+A)
# 4. "Delete" butonuna tıkla
# 5. Onaylayın
```

---

### Adım 4: Verifıkasyon (Doğrulama)

Aşağıdaki sorguları Supabase SQL Editor'de çalıştırın:

```sql
-- Tüm sayılar 0 olmalı (faturalar ve ödemeler için)
SELECT 
  (SELECT COUNT(*) FROM invoices) AS invoices,
  (SELECT COUNT(*) FROM payments) AS payments,
  (SELECT COUNT(*) FROM informal_payments) AS informal_payments,
  (SELECT COUNT(*) FROM invoice_project_links) AS links;

-- Kullanıcılar korunmalı (0'dan büyük olmalı)
SELECT COUNT(*) AS users FROM users;

-- Tedarikçiler korunmalı (0'dan büyük olmalı)
SELECT COUNT(*) AS suppliers FROM suppliers;

-- Taşeronlar korunmalı (0'dan büyük olmalı)
SELECT COUNT(*) AS subcontractors FROM subcontractors;

-- Projeler (isteğe bağlı korunur)
SELECT COUNT(*) AS projects FROM projects;
```

**Beklenen Sonuç:**
```
invoices: 0
payments: 0
informal_payments: 0
links: 0
users: > 0 (örn: 3)
suppliers: > 0 (korundu) ✨
subcontractors: > 0 (korundu) ✨
projects: > 0 veya 0 (tercihinize göre)
```

---

## 🎯 HATA ÇÖZÜMLEME

### Hata 1: "Foreign key constraint violation"

**Sebep:** İlişkili tablolarda bağımlılık var.

**Çözüm:**
```sql
-- Script doğru sırada siliyor, ancak sorun yaşarsanız:
-- Önce bağımlı kayıtları manuel silin

DELETE FROM invoice_project_links;
DELETE FROM payments WHERE invoice_id IS NOT NULL;
DELETE FROM informal_payments;
-- Sonra invoices'ı silin
DELETE FROM invoices;
```

### Hata 2: "Permission denied"

**Sebep:** RLS policies aktif ve yeterli yetkiniz yok.

**Çözüm:**
```sql
-- Supabase Dashboard'dan "service_role" yetkisiyle bağlanın
-- VEYA script'i Supabase SQL Editor'de çalıştırın (otomatik service_role)
```

### Hata 3: Storage script "SUPABASE_SERVICE_ROLE_KEY not found"

**Sebep:** .env.local dosyasında service role key eksik.

**Çözüm:**
```bash
# .env.local dosyasını açın ve ekleyin:
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Key'i Supabase Dashboard > Settings > API > service_role kısmından alın
```

### Hata 4: Storage'da bazı dosyalar silinemiyor

**Sebep:** Dosya izinleri veya RLS policy sorunu.

**Çözüm:**
```bash
# Manuel olarak Supabase Dashboard'dan silin
# VEYA Supabase CLI kullanın:
supabase storage rm --bucket invoices --recursive .
```

---

## 📊 BAŞARI KRİTERLERİ
ödeme sayısı: **0**
- ✅ Tüm gayri resmi ödeme sayısı: **0**
- ✅ Fatura-proje bağlantıları: **0**
- ✅ Storage'da 0 dosya
- ✅ Kullanıcılar korunmuş (> 0)
- ✅ Tedarikçiler korunmuş (> 0) ✨
- ✅ Taşeronlar korunmuş (> 0) ✨
- ✅ Tüm taşeron sayısı: **0**
- ✅ Tüm ödeme sayısı: **0**
- ✅ Storage'da 0 dosya
- ✅ Kullanıcılar korunmuş (> 0)
- ✅ Projeler korunmuş (isteğe bağlı)
- ✅ Roller ve izinler sağlam
- ✅ Uygulama hata vermeden açılıyor

---

## 🚀 TEMİZLEME SONRASI

### 1. Sistemi Test Edin

```bash
# Uygulamayı başlatın
npm run dev

# Kontrol listesi:
- [ ] Login sayfası çalışıyor
- [ ] Dashboard açılıyor
- [ ] Faturalar sayfası boş görünüyor
- [ ] Yeni fatura yükleyebiliyor musunuz?
- [ ] Projeler sayfası çalışıyor
- [ ] Tedarikçiler sayfası boş görünüyor
```

### 2. İlk Gerçek Veriyi Yükleyin

```bash
# Test amaçlı ilk gerçek faturayı yükleyin:
1. Faturalar > Yeni Fatura Ekle
2. Gerçek bir PDF yükleyin
3. QR kod taramasını test edin
4. Bilgileri kontrol edin
5. Kaydedin

# Sorun yoksa diğer faturaları yükleyebilirsiniz
```

### 3. Production Checklist

- [ ] Tüm test verileri silindi
- [ ] Storage temizlendi
- [ ] Backup alındı
- [ ] İlk gerçek fatura başarıyla yüklendi
- [ ] Kullanıcılar bilgilendirildi
- [ ] Yetkilendirme kontrol edildi
- [ ] Production URL ayarlandı (Vercel)
- [ ] Analytics ve monitoring aktif

---

## 🔐 GÜVENLİK NOTLARI

1. **Service Role Key:** Script çalıştırdıktan sonra .env.local'deki `SUPABASE_SERVICE_ROLE_KEY`'i güvende tutun. Bu key tüm RLS policies'i bypass eder.

2. **Backup:** İlk gerçek verileri yükledikten sonra düzenli backup almayı unutmayın.

3. **RLS Policies:** Temizleme işlemi RLS policies'i etkilemez, tüm güvenlik kuralları aynen kalır.

4. **Audit Logs:** Kritik işlemler için activity_logs tablosuna kayıt düşmeye devam eder.

---

## 📞 DESTEK

Sorun yaşarsanız:

1. Yukarıdaki "HATA ÇÖZÜMLEME" bölümünü kontrol edin
2. Supabase Dashboard > Logs kısmından hata mesajlarını inceleyin
3. Script'leri tekrar gözden geçirin
4. Gerekirse backup'tan geri yükleyin

---

## 📁 DOSYALAR

```
scripts/
├── clean-all-test-data.sql       # Database temizleme SQL script'i
├── clean-storage-files.ts         # Storage temizleme TypeScript script'i
└── CLEAN_TEST_DATA_GUIDE.md      # Bu rehber
```

---

**Hazırlayan:** GitHub Copilot  
**Tarih:** 2 Ocak 2026  
**Versiyon:** 1.0

---

## ✅ HIZLI BAŞLANGIÇ

Acele ediyorsanız bu 4 adımı takip edin:

```bash
# 1. SQL Script'i çalıştır (Supabase Dashboard > SQL Editor)
# scripts/clean-all-test-data.sql dosyasını kopyala-yapıştır

# 2. Storage'ı temizle
npx tsx scripts/clean-storage-files.ts

# 3. Doğrulama yap
# Yukarıdaki doğrulama sorgularını çalıştır

# 4. İlk gerçek faturayı yükle
# Uygulama üzerinden test et
```

**🎉 Tebrikler! Sisteminiz gerçek verilerle kullanıma hazır.**
