# Supabase Migration Guide

## 📦 Migration Dosyaları

Bu klasör Supabase veritabanı için migration dosyalarını içerir.

### Dosyalar

1. **20251203_initial_schema.sql**
   - Tüm tabloların oluşturulması
   - Foreign key ilişkileri
   - Indexler ve constraint'ler
   - Varsayılan roller (seed data)
   - Utility fonksiyonlar

2. **20251203_rls_policies.sql**
   - Row-Level Security (RLS) politikaları
   - Her tablo için detaylı erişim kuralları
   - Company-based data isolation

## 🚀 Migration Nasıl Uygulanır?

### Yöntem 1: Supabase Dashboard (Önerilen)

1. [Supabase Dashboard](https://app.supabase.com) → Projenizi seçin
2. SQL Editor'e gidin
3. Her migration dosyasını sırayla kopyalayıp çalıştırın:
   - Önce `20251203_initial_schema.sql`
   - Sonra `20251203_rls_policies.sql`

### Yöntem 2: Supabase CLI

```bash
# Supabase CLI kurulumu (eğer yoksa)
npm install -g supabase

# Supabase login
supabase login

# Proje bağlantısı
supabase link --project-ref your-project-ref

# Migration'ları uygula
supabase db push
```

## ✅ Doğrulama

Migration başarılı olduktan sonra:

```sql
-- Tüm tabloları kontrol et
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- RLS aktif mi kontrol et
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Varsayılan rolleri kontrol et
SELECT name, permissions 
FROM roles 
WHERE company_id IS NULL;
```

## 📊 Oluşturulan Tablolar

- ✅ `companies` - Şirket bilgileri
- ✅ `roles` - Rol ve izinler
- ✅ `users` - Kullanıcı profilleri
- ✅ `projects` - Projeler
- ✅ `invoices` - Faturalar
- ✅ `invoice_project_links` - Fatura-Proje ilişkileri
- ✅ `audit_logs` - Denetim kayıtları

## 🔐 Varsayılan Roller

Migration otomatik olarak şu rolleri oluşturur:

1. **superadmin** - Tüm yetkiler
2. **şirket_yöneticisi** - Şirket yönetimi
3. **muhasebe** - Fatura yönetimi
4. **mimar** - Proje ve fatura görüntüleme/atama
5. **insaat_muhendisi** - Proje ve fatura görüntüleme/atama

## ⚠️ Önemli Notlar

- RLS tüm tablolarda aktif edilmiştir
- Storage policies ayrıca Supabase Dashboard'dan yapılandırılmalıdır
- `auth.users` tablosu Supabase tarafından otomatik yönetilir
- Service role key sadece server-side operasyonlarda kullanılmalıdır

## 🔄 Rollback

Eğer migration'ı geri almak isterseniz:

```sql
-- Tüm tabloları sil (DİKKATLİ KULLANIN!)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS invoice_project_links CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TYPE IF EXISTS project_status;
```

## 📞 Sorun Giderme

### Hata: "Extension uuid-ossp does not exist"
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Hata: "Permission denied for schema public"
Supabase project owner olarak giriş yaptığınızdan emin olun.

### RLS Policy Testi
```sql
-- Kullanıcı izinlerini test et
SELECT has_permission(
  'user-uuid-here'::uuid,
  'invoices',
  'create',
  'company'
);
```
