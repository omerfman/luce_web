# PROJE İLERLEME GÜNLÜĞÜ

## 2025-12-03 - Proje Başlangıcı

### ✅ CHECKLIST.md Oluşturuldu
**Tamamlanan:** CHECKLIST.md dosyası oluşturuldu ve tüm MVP + güvenlik adımları tanımlandı.

**Kararlar:**
- 16 ana faz belirlendi (kurulum → üretim hazırlığı)
- Toplam ~150 görev checkbox olarak tanımlandı
- Her faz kendi içinde modüler ve sıralı ilerleme sağlayacak
- Güvenlik kontrolleri (RLS, RBAC, Storage policy) ayrı fazlar olarak ayrıştırıldı
- İleri özellikler backlog olarak ayrıldı

**Önemli Konfigürasyonlar:**
- Phase 3: Row-Level Security tüm tablolar için ayrı ayrı planlandı
- Phase 10: Güvenlik sertleştirme kapsamlı (XSS, CSRF, rate limiting, etc.)
- Phase 12: Backup ve disaster recovery stratejisi dahil edildi
- Phase 13: Test coverage (unit, integration, e2e) planlandı

**Sonraki Adım:** Phase 1 başlatılacak - Next.js projesi kurulumu, TypeScript ve Tailwind yapılandırması.

---

### ✅ PHASE 1 TAMAMLANDI - Proje Kurulumu ve Altyapı
**Tamamlanan:** Next.js 14 projesi (App Router), TypeScript, TailwindCSS kurulumu tamamlandı.

**Oluşturulan Dosyalar:**
- `package.json` - Tüm bağımlılıklar ve scriptler
- `tsconfig.json` - TypeScript strict mode, path aliases
- `next.config.js` - Security headers, image optimization
- `tailwind.config.js` - Özel renk paleti, spacing, plugins
- `.eslintrc.json` - Code quality rules
- `.prettierrc.js` - Code formatting
- `.gitignore` - Git ignore patterns
- `.env.example` - Environment variables template
- `postcss.config.js` - PostCSS config
- `app/layout.tsx` - Root layout (metadata, Inter font)
- `app/page.tsx` - Ana sayfa (login'e redirect)
- `app/login/page.tsx` - Login sayfası placeholder
- `app/globals.css` - Global styles + Tailwind utilities
- `types/index.ts` - Tüm TypeScript type definitions
- `types/supabase.ts` - Supabase database types
- `lib/utils.ts` - Utility fonksiyonlar (formatCurrency, formatDate, etc.)
- `lib/validation.ts` - Zod schemas, sanitization
- `README.md` - Kapsamlı kurulum ve kullanım dökümanı
- `docs/progress_log.md` - Bu dosya

**Önemli Kararlar:**
1. **Güvenlik Headers:** next.config.js içinde HSTS, X-Frame-Options, CSP benzeri headerlar eklendi
2. **TypeScript Strict Mode:** Kod kalitesi için strict typing aktif
3. **Path Aliases:** Import'ları temiz tutmak için `@/` prefix kullanımı
4. **Tailwind Custom Config:** Luce Mimarlık için özelleştirilebilir renk paleti
5. **Zod Validation:** Tüm formlar için type-safe validation
6. **Component Utilities:** cn() fonksiyonu (clsx + tailwind-merge)

**Bağımlılıklar:**
- Next.js 14.2 (App Router)
- React 18.3
- TypeScript 5.3
- Supabase JS Client 2.39
- Zod 3.22 (validation)
- TailwindCSS 3.4 + plugins (forms, typography)
- date-fns 3.3 (date utilities)

**Güvenlik Önlemleri (Bu Fazda):**
- ✅ Security headers (HSTS, XSS protection, etc.)
- ✅ Input sanitization utilities (XSS koruması)
- ✅ File validation schemas (5MB limit, PDF only)
- ✅ Environment variables template (.env.example)
- ✅ .gitignore ile hassas dosyaların korunması

**Sonraki Adım:** Phase 2 başlatılacak - Supabase entegrasyonu ve veritabanı şeması oluşturma.

---

### ✅ PHASE 2 TAMAMLANDI - Supabase Entegrasyonu ve Veritabanı Şeması
**Tamamlanan:** Supabase client kurulumu, veritabanı şeması ve migration dosyaları oluşturuldu.

**Oluşturulan Dosyalar:**
- `lib/supabase/client.ts` - Supabase client (anon + service role)
- `supabase/migrations/20251203_initial_schema.sql` - Veritabanı şeması
- `supabase/migrations/20251203_rls_policies.sql` - RLS politikaları
- `supabase/README.md` - Migration kılavuzu

**Veritabanı Şeması (7 Tablo):**
1. `companies` - Şirket bilgileri, settings (JSON)
2. `roles` - Rol ve izinler (RBAC), permissions (JSON array)
3. `users` - Kullanıcı profilleri (auth.users ile ilişkili)
4. `projects` - Projeler, status enum, tarih validasyonları
5. `invoices` - Faturalar, PDF URL, metadata (JSON)
6. `invoice_project_links` - Fatura-Proje ilişkileri, unique constraint
7. `audit_logs` - Denetim kayıtları, immutable

**Foreign Key İlişkileri:**
- users → companies (ON DELETE CASCADE)
- users → roles (ON DELETE RESTRICT)
- projects → companies (ON DELETE CASCADE)
- invoices → companies, users (ON DELETE CASCADE/RESTRICT)
- invoice_project_links → invoices, projects, users

**Indexler:**
- Company_id bazlı indexler tüm tablolarda
- JSONB fields için GIN indexes (permissions, metadata)
- Tarih bazlı indexler (invoice.date DESC)
- Composite indexler (target_type, target_id)

**Varsayılan Roller (Seed Data):**
- superadmin - Tüm yetkiler
- şirket_yöneticisi - Şirket yönetimi
- muhasebe - Fatura yönetimi
- mimar - Proje + fatura görüntüleme/atama
- insaat_muhendisi - Proje + fatura görüntüleme/atama

**Utility Fonksiyonlar:**
- `get_user_permissions(uuid)` - Kullanıcının izinlerini döndürür
- `has_permission(uuid, resource, action, scope)` - İzin kontrolü
- `mark_invoice_processed()` - Trigger: fatura atandığında processed=true

**Önemli Özellikler:**
- Automatic `updated_at` trigger for projects
- Automatic `processed` flag for invoices (via trigger)
- UUID primary keys (uuid-ossp extension)
- Check constraints (amount > 0, end_date >= start_date)
- JSONB validation ready

**Sonraki Adım:** Phase 3 tamamlandı (RLS policies migration'da zaten var)

---

### ✅ PHASE 3 TAMAMLANDI - Row-Level Security (RLS)
**Tamamlanan:** Tüm tablolar için kapsamlı RLS politikaları oluşturuldu.

**RLS Politikaları (Toplam ~35 Policy):**

**Companies:**
- Users can read own company
- Superadmin can read all
- Company admins can update own company
- Superadmin can manage all

**Roles:**
- Users can read company + global roles
- Company admins can CRUD company roles
- Superadmin can manage all roles

**Users:**
- Users can read own profile
- Users can read company users (with permission)
- Users can update own profile (limited fields)
- Company admins can CRUD company users
- Superadmin can manage all

**Projects:**
- Users can read company projects (with permission)
- Authorized users can CRUD (permission-based)

**Invoices:**
- Users can read company invoices (with permission)
- Accountants can create invoices
- Authorized users can update/delete

**Invoice_Project_Links:**
- Users can read company links
- Users with assign_project permission can link
- Authorized users can delete links

**Audit_Logs:**
- Users can read own logs
- Company admins can read company logs
- System can insert (immutable, no update/delete)

**Güvenlik Özellikleri:**
- Company-based data isolation (tüm tablolarda)
- Permission-based access control (has_permission function)
- Hierarchical permissions (action='manage' tüm işlemleri kapsar)
- Scope-based access (own, company, all)
- Audit trail immutability

**Storage Policies (Planlandı):**
- Invoice PDF bucket policies (ayrıca Supabase Dashboard'dan yapılandırılacak)
- Company-based file access
- Signed URLs for secure downloads

**Sonraki Adım:** Phase 4 başlatılacak - Authentication ve Authorization implementasyonu.

---

### ✅ PHASE 4 TAMAMLANDI - Authentication & Authorization
**Tamamlanan:** Supabase Auth entegrasyonu, protected routes, RBAC middleware ve permission sistemi.

**Oluşturulan Dosyalar:**
- `lib/supabase/server.ts` - Server-side Supabase client (SSR için)
- `middleware.ts` - Auth middleware (protected routes)
- `lib/auth/AuthContext.tsx` - User context provider
- `app/auth/callback/route.ts` - Auth callback handler
- `app/dashboard/page.tsx` - Dashboard sayfası (örnek)
- `lib/permissions.ts` - Permission utility fonksiyonları
- `lib/auth/server-auth.ts` - Server-side auth helpers

**Auth Sistemi Özellikleri:**

**1. Supabase Auth (Magic Link):**
- Email-based passwordless authentication
- OTP (One-Time Password) ile giriş
- Automatic email gönderimi
- Session management (automatic refresh)
- Secure cookie handling

**2. Middleware (Protected Routes):**
- Automatic session refresh
- Public/private route ayrımı
- Unauthenticated → /login redirect
- Authenticated + /login → /dashboard redirect
- Cookie synchronization (request & response)

**3. AuthContext (Client-Side):**
- User state management
- Role and company loading
- Permissions caching
- Real-time auth state changes
- `hasPermission()` helper function
- `signOut()` function

**4. RBAC Implementation:**
- Permission-based access control
- Resource + Action + Scope model
- Hierarchical permissions (manage > specific actions)
- Scope levels: own, company, all
- Server-side permission verification

**5. Permission Utilities:**
- `checkPermission()` - Permission validator
- `isSuperAdmin()` - Admin check
- `isCompanyAdmin()` - Company admin check
- `getPermissionDescription()` - Turkish descriptions
- `formatPermission()` - Display formatting

**6. Server-Side Auth:**
- `checkServerPermission()` - API route permission check
- `withPermission()` - Middleware wrapper
- `getCurrentUser()` - Get authenticated user with relations
- Error handling & unauthorized responses

**Güvenlik Özellikleri:**
- ✅ Secure session cookies (HttpOnly, SameSite)
- ✅ Automatic token refresh
- ✅ CSRF protection via SameSite cookies
- ✅ Server-side permission validation
- ✅ Client-side permission UI masking
- ✅ Protected API routes
- ✅ Error messages (no sensitive data leak)

**Auth Flow:**
1. User enters email → Login page
2. Supabase sends magic link email
3. User clicks link → /auth/callback
4. Session created → Redirect to /dashboard
5. Middleware protects all routes
6. AuthContext loads user + permissions
7. UI adapts based on permissions

**MFA Altyapı Planı:**
- Supabase Auth MFA ready (phase 16'da eklenebilir)
- TOTP (Time-based OTP) desteği
- SMS OTP entegrasyonu (3rd party)
- Backup codes sistemi
- MFA enforcement by role

**Sonraki Adım:** Phase 5 başlatılacak - Supabase Storage ve dosya yönetimi.

---

### ✅ PHASE 5-8 TAMAMLANDI - Storage, UI Components, Invoice & Project Management
**Tamamlanan:** Dosya yükleme, UI komponent kütüphanesi, fatura ve proje yönetimi modülleri.

**Phase 5 - Supabase Storage:**
- `supabase/migrations/20251203_storage_setup.sql` - Storage bucket ve policies
- `lib/supabase/storage.ts` - Upload, download, signed URL utilities
- `components/ui/FileUploader.tsx` - Drag-drop file uploader
- Bucket: "invoices" (private, 5MB limit, PDF only)
- Company-based folder structure (company_id/year/month/)
- Storage statistics view

**Phase 6 - UI Components:**
- `components/ui/Card.tsx` - Card, CardHeader, CardTitle, etc.
- `components/ui/Button.tsx` - Primary, secondary, danger, ghost variants
- `components/ui/Input.tsx` - Input, Textarea with labels & errors
- `components/ui/Modal.tsx` - Headless UI modal with transitions
- `components/layout/Sidebar.tsx` - Full sidebar navigation

**Phase 7 - Invoice Management:**
- `app/invoices/page.tsx` - Invoice list & creation
- PDF upload with validation
- Invoice metadata (supplier, invoice_number, notes)
- Permission-based UI (canCreate, canUpdate)
- Real-time invoice list from Supabase
- Invoice status (processed/pending)

**Phase 8 - Project Management:**
- `app/projects/page.tsx` - Project list & creation
- `app/projects/[id]/page.tsx` - Project detail & accounting
- Financial summary (total, average, count)
- Top 5 invoices widget
- Monthly expense tracking
- Project-invoice relationship display

**Özellikler:**
- ✅ Drag-drop PDF upload
- ✅ File validation (size, type, extension)
- ✅ Company-based storage isolation
- ✅ Responsive sidebar navigation
- ✅ Modal-based forms
- ✅ Permission-based UI visibility
- ✅ Real-time data from Supabase
- ✅ Financial calculations & widgets
- ✅ Project status management

**Sonraki Adım:** Phase 9-16 - Kullanıcı/Rol yönetimi, güvenlik sertleştirme, testing, deployment.

---

