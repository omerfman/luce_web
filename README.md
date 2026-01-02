# Luce Mimarlık - İç İş Akışı ve Proje Yönetim Sistemi

> **Production-Ready Internal Workflow System** 🚀  
> Güvenli, ölçeklenebilir, multi-tenant mimari ile geliştirilmiş iş akışı sistemi

---

## ⚡ Hızlı Başlangıç

```bash
npm install
cp .env.local.example .env.local
# .env.local dosyasını Supabase credentials ile doldur
npm run dev
```

📖 **Detaylı kurulum:** [`QUICKSTART.md`](./QUICKSTART.md)  
🚀 **Production deployment:** [`docs/PRODUCTION_CHECKLIST.md`](./docs/PRODUCTION_CHECKLIST.md)

---

## 🚀 Teknoloji Yığını

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, TailwindCSS
- **Backend:** Supabase (PostgreSQL), Next.js API Routes
- **Auth:** Supabase Auth (Magic Link + JWT)
- **Storage:** Supabase Storage (fotoğraf, PDF)
- **Deployment:** Vercel
- **Monitoring:** Sentry (planlı)

## 🎯 Özellikler

### ✅ MVP Tamamlandı (Production Ready)

**Kimlik Doğrulama:**
- Magic Link (şifresiz) giriş
- JWT session yönetimi
- Otomatik token yenileme
- Güvenli çıkış yapma

**Yetkilendirme:**
- Rol tabanlı erişim (RBAC)
- Granular permissions (JSON-based)
- 5 varsayılan rol (Super Admin → Görüntüleyici)
- Permission-based UI rendering

**Fatura Yönetimi:**
- CRUD operasyonları
- PDF yükleme (max 5MB)
- Proje bağlantıları
- Şirket bazlı izolasyon

**Proje Yönetimi:**
- Proje oluşturma/düzenleme
- Status tracking (Aktif/Tamamlandı/Askıda)
- Fatura entegrasyonu
- Muhasebe özeti (toplam tutar, ortalama, trend)

**Güvenlik:**
- Row-Level Security (35+ policy)
- XSS/CSRF koruması
- Company-based data isolation
- Audit logging (trigger-based)
- HTTPS zorunlu (production)

## 📂 Proje Yapısı

```
luce_web/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth sayfaları
│   ├── (dashboard)/       # Korumalı dashboard sayfaları
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/            # React komponentleri
│   ├── ui/               # Temel UI komponentleri
│   ├── layout/           # Layout komponentleri
## 🔧 Kurulum

### Gereksinimler
- Node.js >= 18.17.0
- npm >= 9.0.0
- Supabase account (free tier yeterli)
- Vercel account (deployment için)

### Development Setup

**1. Bağımlılıkları yükle:**
```bash
npm install
```

**2. Environment variables:**
```bash
cp .env.local.example .env.local
```

`.env.local` dosyasını düzenle:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

**3. Supabase Database:**

SQL dosyalarını **sırasıyla** çalıştır:
```bash
# Supabase Dashboard → SQL Editor
# 1. supabase/migrations/20251203_initial_schema.sql
# 2. supabase/migrations/20251203_rls_policies.sql
# 3. supabase/migrations/20251203_storage_setup.sql
```

**4. Development server:**
```bash
npm run dev
```

→ http://localhost:3000

---

## 🚀 Production Deployment

### Vercel (Önerilen)

**1. GitHub'a Push:**
```bash
git init
git add .
git commit -m "Initial: Luce Workflow MVP"
git push -u origin main
```

**2. Vercel Deployment:**
1. [vercel.com](https://vercel.com) → "New Project"
2. GitHub repo'yu import et
3. Environment Variables ekle:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy → ~2 dakika

**3. İlk Kullanıcı Oluştur:**
```sql
-- Supabase SQL Editor
-- 1. Şirket oluştur
INSERT INTO companies (name, tax_number, address, phone, email)
VALUES ('Luce Mimarlık', '1234567890', 'İstanbul', '+905...', 'info@example.com')
RETURNING id;

-- 2. User'a şirket ve Super Admin rolü ata
UPDATE users 
SET company_id = 'YUKARDAKI_UUID', 
    role_id = (SELECT id FROM roles WHERE name = 'Super Admin')
WHERE email = 'your-email@example.com';
```

📋 **Deployment Checklist:** [`docs/PRODUCTION_CHECKLIST.md`](./docs/PRODUCTION_CHECKLIST.md)

---

## 🗂️ Proje Yapısı

```
luce_web/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing page (redirect)
│   ├── login/                   # Magic Link login
│   ├── auth/callback/           # Auth callback handler
│   ├── dashboard/               # Dashboard (protected)
│   ├── invoices/                # Invoice management
│   ├── projects/                # Project management
│   │   └── [id]/               # Project detail
│   └── globals.css
├── components/
│   ├── ui/                      # Base UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   └── FileUploader.tsx
│   └── layout/
│       └── Sidebar.tsx          # Main navigation
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Client-side Supabase
│   │   ├── server.ts           # Server-side Supabase
│   │   └── storage.ts          # File upload utilities
│   ├── auth/
│   │   ├── AuthContext.tsx     # Auth state management
│   │   └── server-auth.ts      # Server-side auth helpers
│   ├── utils.ts                # General utilities
│   ├── validation.ts           # Zod schemas
│   └── permissions.ts          # Permission checks
├── types/
│   ├── index.ts                # Common types
│   └── supabase.ts             # Database types
├── supabase/migrations/
│   ├── 20251203_initial_schema.sql
│   ├── 20251203_rls_policies.sql
│   └── 20251203_storage_setup.sql
├── middleware.ts               # Auth middleware
├── vercel.json                 # Vercel config + security
├── QUICKSTART.md              # 5-minute setup guide
├── CHECKLIST.md               # Feature progress (150+ tasks)
└── docs/
    ├── DEPLOYMENT.md          # Detailed deployment guide
    ├── PRODUCTION_CHECKLIST.md # Go-live checklist
    └── progress_log.md        # Change history
```

---

## 🔐 Güvenlik

### Aktif Korumalar
- ✅ Row-Level Security (35+ policy)
- ✅ RBAC with granular permissions
- ✅ XSS/CSRF protection
- ✅ Input validation (Zod)
- ✅ File type/size validation
- ✅ Company-based data isolation
- ✅ HTTPS zorunlu (Vercel)
- ✅ Security headers (vercel.json)
- ✅ Audit logging (trigger-based)

### İsteğe Bağlı (Phase 10-11)
- ⏳ Rate limiting (Upstash Redis)
- ⏳ Sentry error tracking
- ⏳ Advanced audit log UI

---

## 📊 Database Schema

**7 Tablo:**
- `companies` - Multi-tenant şirketler
- `roles` - Rol tanımları (JSONB permissions)
- `users` - Kullanıcı profilleri (auth.users → FK)
- `projects` - Proje takibi (status: active/completed/on_hold)
- `invoices` - Faturalar + PDF paths
- `invoice_project_links` - M:N ilişki
- `audit_logs` - İmmutable audit trail

**Varsayılan Roller:**
1. Super Admin (tüm yetkiler)
2. Admin (şirket yönetimi)
3. Muhasebeci (fatura CRUD)
4. Proje Yöneticisi (proje + fatura görüntüleme)
5. Görüntüleyici (sadece okuma)

---

## 📚 Dokümantasyon

### Başlangıç
- **[QUICKSTART.md](./QUICKSTART.md)** - 5 dakikada çalıştır
- **[PRODUCTION_CHECKLIST.md](./docs/PRODUCTION_CHECKLIST.md)** - Canlıya alma

### Teknik
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Detaylı deployment
- **[CHECKLIST.md](./CHECKLIST.md)** - Özellik listesi (16 faz, 150+ görev)
- **[progress_log.md](./docs/progress_log.md)** - Değişiklik geçmişi

---

## 🧪 Development Commands

```bash
npm run dev          # Development server (localhost:3000)
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint check
npm run type-check   # TypeScript validation
npm run format       # Prettier format
npm run clean:storage # Storage'daki tüm PDF'leri sil
npm run clean:help   # Temizleme rehberini göster
```

---

## 🗑️ Test Verilerini Temizleme

**Gerçek verilerle çalışmaya başlamadan önce tüm test verilerini temizleyin:**

```bash
# 1. Rehberi oku
npm run clean:help

# 2. SQL script'i çalıştır (Supabase Dashboard > SQL Editor)
# scripts/clean-all-test-data.sql

# 3. Storage'ı temizle
npm run clean:storage
```

📖 **Detaylı rehber:** [`scripts/CLEAN_TEST_DATA_GUIDE.md`](./scripts/CLEAN_TEST_DATA_GUIDE.md)

**Temizlenecekler:**
- ✅ Tüm faturalar ve PDF'ler
- ✅ Tüm ödemeler
- ✅ İlişkili aktivite logları

**Korunacaklar:**
- ✅ Kullanıcılar ve roller
- ✅ Şirket bilgileri
- ✅ Tedarikçiler ve taşeronlar ✨
- ✅ Projeler (isteğe bağlı)
- ✅ Tüm sistem ayarları

---

## 🤝 Katkıda Bulunma

Bu proje Luce Mimarlık için özel olarak geliştirilmiştir. İç kullanım amaçlıdır.

---

## 📞 Destek

**Acil Durum:**
1. Vercel Dashboard → Rollback
2. Supabase Dashboard → Backups
3. GitHub → Revert commit

**Dokümantasyon:**
- Supabase: https://supabase.com/docs
- Next.js: https://nextjs.org/docs
- Vercel: https://vercel.com/docs

---

## 📝 Lisans

Private - Luce Mimarlık © 2025

---

**Sistem Durumu:** ✅ Production Ready  
**Son Güncelleme:** 2025-12-03  
**Versiyon:** MVP 1.0

