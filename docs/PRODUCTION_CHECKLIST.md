# 🚀 Production Deployment Checklist

## Pre-Deployment

### 1. Environment Setup
- [ ] Supabase projesi oluşturuldu
- [ ] Supabase URL ve Anon Key alındı
- [ ] `.env.local.example` dosyasından `.env.local` oluşturuldu
- [ ] Tüm environment variables doğru değerlerle dolduruldu

### 2. Database Migrations
Migration'ları **sırasıyla** çalıştırın:
```bash
# 1. Schema
psql -h db.xxxxx.supabase.co -U postgres -d postgres -f supabase/migrations/20251203_initial_schema.sql

# 2. RLS Policies
psql -h db.xxxxx.supabase.co -U postgres -d postgres -f supabase/migrations/20251203_rls_policies.sql

# 3. Storage Setup
psql -h db.xxxxx.supabase.co -U postgres -d postgres -f supabase/migrations/20251203_storage_setup.sql
```

- [ ] Schema migration başarılı
- [ ] RLS policies migration başarılı
- [ ] Storage setup migration başarılı
- [ ] Supabase Dashboard'da 7 tablo görünüyor
- [ ] `invoices` bucket oluştu (private)

### 3. Default Data Verification
Supabase SQL Editor'da kontrol edin:
```sql
-- Varsayılan rolleri kontrol et
SELECT * FROM roles ORDER BY created_at;

-- Beklenen sonuç: 5 rol (Super Admin, Admin, Muhasebeci, Proje Yöneticisi, Görüntüleyici)
```

- [ ] 5 varsayılan rol mevcut
- [ ] Permission JSON'ları doğru

### 4. First Admin User
İlk Super Admin kullanıcısını oluşturun:

1. Supabase Dashboard → Authentication → Users → Invite User
2. Email ile davet gönderin
3. Kullanıcı Magic Link ile giriş yaptıktan sonra SQL ile rol atayın:

```sql
-- 1. Şirket oluştur
INSERT INTO companies (name, tax_number, address, phone, email)
VALUES ('Luce Mimarlık', '1234567890', 'Adres', '+90...', 'info@lucemimarlik.com')
RETURNING id;

-- 2. User'a şirket ve Super Admin rolü ata (yukarıdaki company id'yi kullanın)
UPDATE users 
SET 
  company_id = 'COMPANY_UUID_BURAYA',
  role_id = (SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1)
WHERE email = 'admin@lucemimarlik.com';
```

- [ ] İlk şirket oluşturuldu
- [ ] Super Admin kullanıcı atandı
- [ ] Kullanıcı giriş yapabildi

### 5. Local Testing
```bash
npm install
npm run dev
```

Test senaryoları:
- [ ] Login sayfası açılıyor (`/login`)
- [ ] Magic Link email alındı
- [ ] Callback sonrası dashboard'a yönlendi
- [ ] Sidebar'da kullanıcı bilgisi görünüyor
- [ ] Permissions doğru çalışıyor (Super Admin tüm menüleri görmeli)
- [ ] Invoice oluşturulabiliyor
- [ ] PDF upload çalışıyor (5MB limit test edin)
- [ ] Project oluşturulabiliyor
- [ ] Project detay sayfası açılıyor

### 6. Build Verification
```bash
npm run build
```

- [ ] Build başarılı (hata yok)
- [ ] Type check başarılı (`npm run type-check`)
- [ ] Lint başarılı (`npm run lint`)

## Vercel Deployment

### 1. Repository Setup
```bash
git init
git add .
git commit -m "Initial commit: Luce Workflow MVP"
git branch -M main
git remote add origin https://github.com/yourusername/luce-workflow.git
git push -u origin main
```

- [ ] Git repository oluşturuldu
- [ ] GitHub'a push edildi

### 2. Vercel Project
1. [Vercel Dashboard](https://vercel.com) → New Project
2. GitHub repository'yi seç
3. Framework: Next.js (otomatik algılanır)
4. Root Directory: `.` (default)
5. Build Command: `next build` (default)
6. Output Directory: `.next` (default)

- [ ] Vercel projesi oluşturuldu

### 3. Environment Variables
Vercel Dashboard → Settings → Environment Variables:

**Production:**
```
NEXT_PUBLIC_SUPABASE_URL = your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key
```

- [ ] Environment variables eklendi
- [ ] Production için aktif

### 4. Deploy
- [ ] İlk deployment başlatıldı (otomatik)
- [ ] Deployment başarılı
- [ ] Production URL alındı (örn: `luce-workflow.vercel.app`)

### 5. Post-Deployment Tests
Production URL'de test edin:
- [ ] Site açılıyor
- [ ] Login çalışıyor
- [ ] Magic Link email geliyor
- [ ] Dashboard yükleniyor
- [ ] Invoice/Project CRUD çalışıyor
- [ ] PDF upload çalışıyor
- [ ] RLS politikaları aktif (başka şirketin verisini görmüyor)

## Security Checklist

### SSL/HTTPS
- [ ] Vercel otomatik HTTPS aktif
- [ ] `vercel.json` security headers mevcut:
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block

### Supabase Security
- [ ] RLS tüm tablolarda enable
- [ ] Service role key **asla** frontend'de kullanılmıyor
- [ ] Storage bucket "invoices" **private**
- [ ] Email templates özelleştirildi (Supabase → Auth → Email Templates)

### Authentication
- [ ] Magic Link rate limiting aktif (Supabase default: 5/saat)
- [ ] Session timeout ayarlandı (Supabase → Auth → Settings)
- [ ] Unauthorized redirect çalışıyor (middleware.ts)

### Database
- [ ] PostgreSQL password güçlü
- [ ] Connection pooling aktif (Supabase default)
- [ ] Backup otomatik (Supabase günlük snapshot)

## Performance Checklist

- [ ] `next.config.js` production optimizasyonları aktif
- [ ] Supabase connection pooling ayarlandı
- [ ] CDN (Vercel Edge) aktif
- [ ] Image optimization (Next.js Image component kullanılırsa)

## Monitoring & Maintenance

### Initial Setup
- [ ] Supabase Dashboard pin'lendi (sık kullanım için)
- [ ] Vercel Dashboard pin'lendi
- [ ] Production URL takım ile paylaşıldı

### Optional (Phase 11)
- [ ] Sentry kuruldu (hata izleme)
- [ ] Uptime monitoring (Vercel Analytics veya 3rd party)
- [ ] Database backup stratejisi dokümante edildi

## Rollback Plan

Acil durum için:
```bash
# Vercel'de previous deployment'a geri dön
vercel --prod rollback

# Veya Vercel Dashboard → Deployments → [...] → Promote to Production
```

- [ ] Rollback prosedürü test edildi (staging'de)
- [ ] Database migration rollback scriptleri hazır

## Go-Live

### T-1 Day (Canlıya almadan 1 gün önce)
- [ ] Tüm checklist maddeleri tamamlandı
- [ ] Staging/preview deployment test edildi
- [ ] Takıma training verildi
- [ ] İlk kullanıcılar oluşturuldu

### Launch Day
- [ ] Production deployment yapıldı
- [ ] DNS ayarları güncellendi (özel domain varsa)
- [ ] İlk 10 invoice test verisi oluşturuldu
- [ ] İlk 5 proje test verisi oluşturuldu
- [ ] Kullanıcılar davet edildi

### T+1 Day (Canlıya aldıktan 1 gün sonra)
- [ ] Supabase Dashboard kontrol (error log)
- [ ] Vercel Analytics kontrol
- [ ] Kullanıcı feedback toplandı
- [ ] Kritik bug yoksa ✅

---

## 🎉 Production Ready!

Bu checklist tamamlandıktan sonra sistem production'da kullanılabilir.

**Destek:**
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
- Vercel Docs: https://vercel.com/docs

**Acil Durum:**
1. Vercel Dashboard → Rollback
2. Supabase Dashboard → Database → Backups
3. GitHub → Previous commit revert
