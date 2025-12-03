# Luce Mimarlık - Quick Start Guide

## 🚀 Hızlı Başlangıç (5 Dakika)

### 1️⃣ Supabase Kurulumu

**a) Proje Oluştur:**
1. [supabase.com](https://supabase.com) → "New Project"
2. Organization seç veya oluştur
3. Proje adı: `luce-workflow`
4. Database Password: Güçlü bir şifre seç (kaydet!)
5. Region: `Europe West (Frankfurt)` → Create

**b) API Credentials:**
1. Supabase Dashboard → Settings → API
2. Kopyala:
   - Project URL: `https://xxxxx.supabase.co`
   - `anon` `public` key: `eyJhbGc...`

### 2️⃣ Database Setup

**SQL Editor'da sırasıyla çalıştır:**

```sql
-- 1. Schema (Tables)
-- İçeriği kopyala: supabase/migrations/20251203_initial_schema.sql
-- SQL Editor'a yapıştır → Run

-- 2. RLS Policies (Security)
-- İçeriği kopyala: supabase/migrations/20251203_rls_policies.sql
-- SQL Editor'a yapıştır → Run

-- 3. Storage Bucket
-- İçeriği kopyala: supabase/migrations/20251203_storage_setup.sql
-- SQL Editor'a yapıştır → Run
```

**Kontrol:** Table Editor'da 7 tablo görmeli:
- companies, roles, users, projects, invoices, invoice_project_links, audit_logs

### 3️⃣ Local Development

**a) Bağımlılıkları Yükle:**
```bash
npm install
```

**b) Environment Variables:**
```bash
# .env.local.example dosyasını kopyala
cp .env.local.example .env.local

# .env.local dosyasını düzenle:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

**c) Development Sunucuyu Başlat:**
```bash
npm run dev
```

→ Tarayıcıda aç: http://localhost:3000

### 4️⃣ İlk Kullanıcı (Super Admin)

**a) Email ile Kayıt:**
1. Tarayıcıda → `/login`
2. Email gir → "Giriş Linki Gönder"
3. Email'deki Magic Link'e tıkla
4. Dashboard yüklenecek (henüz veri yok)

**b) Şirket ve Rol Ata:**

Supabase SQL Editor:
```sql
-- 1. Şirket oluştur
INSERT INTO companies (name, tax_number, address, phone, email)
VALUES ('Luce Mimarlık', '1234567890', 'İstanbul', '+905555555555', 'info@lucemimarlik.com')
RETURNING id; -- Bu ID'yi kopyala!

-- 2. User'a şirket ve Super Admin rolü ata
UPDATE users 
SET 
  company_id = 'YUKARDAKI_UUID', -- Buraya yapıştır
  role_id = (SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1)
WHERE email = 'senin-email@example.com'; -- Kayıt olduğun email
```

**c) Sayfayı Yenile:**
- Dashboard'da kullanıcı bilgileri görünmeli
- Sidebar'da tüm menüler aktif olmalı

### 5️⃣ İlk Veri Girişi

**Fatura Oluştur:**
1. Sidebar → "Faturalar"
2. "Yeni Fatura" → Form doldur
3. PDF yükle (max 5MB)
4. Kaydet

**Proje Oluştur:**
1. Sidebar → "Projeler"
2. "Yeni Proje" → Form doldur
3. Kaydet

---

## 🌐 Production Deployment (Vercel)

### 1️⃣ GitHub'a Push

```bash
git init
git add .
git commit -m "Initial: Luce Workflow MVP"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/luce-workflow.git
git push -u origin main
```

### 2️⃣ Vercel Deployment

1. [vercel.com](https://vercel.com) → "New Project"
2. GitHub repository'yi import et
3. Framework: Next.js (otomatik)
4. **Environment Variables ekle:**
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...
   ```
5. Deploy → Bekle (~2 dakika)

### 3️⃣ Production Test

1. Vercel URL'yi aç (örn: `luce-workflow.vercel.app`)
2. `/login` → Email gir
3. Magic Link ile giriş
4. Fatura/Proje CRUD test et

---

## 📋 Sonraki Adımlar

✅ **MVP Hazır!** Sistem production'da kullanılabilir.

**Opsiyonel Geliştirmeler:**
- Kullanıcı/Rol yönetim arayüzü (şu anda SQL ile)
- Sentry error tracking
- Rate limiting (Upstash Redis)
- Test suite (Jest + Playwright)
- Performance optimizations

---

## 🆘 Sorun Giderme

**"Unauthorized" hatası:**
- RLS policies çalıştırıldı mı? (`20251203_rls_policies.sql`)
- User'a `company_id` ve `role_id` atandı mı?

**"Invalid token" hatası:**
- `.env.local` doğru mu?
- Supabase anon key doğru kopyalandı mı?

**PDF upload çalışmıyor:**
- Storage migration çalıştırıldı mı? (`20251203_storage_setup.sql`)
- Supabase Dashboard → Storage → "invoices" bucket var mı?

**Build hatası:**
```bash
npm run type-check # Type errors'ı gösterir
npm run lint        # Linting errors
```

---

## 📞 Destek

- **Detaylı Deployment:** `docs/DEPLOYMENT.md`
- **Production Checklist:** `docs/PRODUCTION_CHECKLIST.md`
- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs

**İyi çalışmalar! 🎉**
