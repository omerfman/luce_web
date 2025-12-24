# LUCE MİMARLIK - DATABASE MİMARİSİ RAPORU

**Hazırlanma Tarihi:** 24 Aralık 2025  
**Proje:** Luce Mimarlık İç İş Akışı Sistemi  
**Database:** PostgreSQL (Supabase)

---

## İÇİNDEKİLER

1. [Genel Bakış](#genel-bakış)
2. [Tablo Yapıları](#tablo-yapıları)
3. [İlişki Diyagramı](#ilişki-diyagramı)
4. [Sayfa Bazlı Veri Akışları](#sayfa-bazlı-veri-akışları)
5. [Foreign Key İlişkileri](#foreign-key-ilişkileri)
6. [Önemli Notlar](#önemli-notlar)

---

## GENEL BAKIŞ

### Sistem Mimarisi
- **Database Tipi:** PostgreSQL 
- **Hosting:** Supabase
- **Güvenlik:** Row Level Security (RLS) aktif
- **Multi-Tenancy:** Şirket bazlı veri izolasyonu (company_id)
- **Authentication:** Supabase Auth (auth.users)

### Ana Özellikler
- Rol tabanlı erişim kontrolü (RBAC)
- Şirket bazlı veri izolasyonu
- Audit log sistemi
- Kullanıcı aktivite takibi
- Dosya yönetimi (Cloudinary entegrasyonu)

---

## TABLO YAPILARI

### 1. COMPANIES (Şirketler)
**Amaç:** Multi-tenancy için şirket bilgilerini tutar.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Birincil anahtar |
| name | VARCHAR(100) | Şirket adı (benzersiz) |
| settings | JSONB | Şirkete özel ayarlar |
| created_at | TIMESTAMPTZ | Oluşturma tarihi |

**İlişkiler:**
- 1:N → users, projects, invoices, suppliers, subcontractors

---

### 2. ROLES (Roller)
**Amaç:** Kullanıcı rollerini ve izinlerini tanımlar (RBAC).

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Birincil anahtar |
| company_id | UUID | FK → companies (NULL ise global rol) |
| name | VARCHAR(50) | Rol adı (örn: "Admin", "Kullanıcı") |
| permissions | JSONB | İzin listesi (JSON array) |
| created_at | TIMESTAMPTZ | Oluşturma tarihi |

**İlişkiler:**
- N:1 → companies (company_id)
- 1:N → users

**Özel Durum:** 
- `company_id = NULL` → Super Admin (sistem geneli)
- `company_id != NULL` → Şirket rolü

---

### 3. USERS (Kullanıcılar)
**Amaç:** Kullanıcı profilleri (auth.users ile senkron).

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | PK & FK → auth.users |
| email | VARCHAR(255) | E-posta (benzersiz) |
| name | VARCHAR(100) | Kullanıcı adı |
| company_id | UUID | FK → companies |
| role_id | UUID | FK → roles |
| meta | JSONB | Kullanıcıya özel metadata |
| last_seen_at | TIMESTAMPTZ | Son görülme zamanı |
| created_at | TIMESTAMPTZ | Oluşturma tarihi |

**İlişkiler:**
- 1:1 → auth.users (id)
- N:1 → companies (company_id)
- N:1 → roles (role_id)
- 1:N → invoices, projects, activity logs

---

### 4. PERMISSIONS (İzinler)
**Amaç:** Sistem genelinde kullanılabilir izin kayıtları.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Birincil anahtar |
| resource | TEXT | Kaynak (örn: "invoices", "projects") |
| action | TEXT | İşlem (örn: "create", "read", "delete") |
| scope | TEXT | Kapsam ("company", "all") |
| description | TEXT | Açıklama |
| created_at | TIMESTAMPTZ | Oluşturma tarihi |

**Örnekler:**
- `invoices:create:company` → Şirket faturası oluştur
- `projects:read:all` → Tüm projeleri görüntüle
- `*:*:all` → Tüm yetkiler (Super Admin)

---

### 5. PROJECTS (Projeler)
**Amaç:** Şirket projelerini yönetir.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Birincil anahtar |
| company_id | UUID | FK → companies |
| name | VARCHAR(100) | Proje adı |
| description | TEXT | Proje açıklaması |
| start_date | DATE | Başlangıç tarihi |
| end_date | DATE | Bitiş tarihi |
| status | ENUM | 'planned', 'active', 'on_hold', 'completed', 'cancelled' |
| created_at | TIMESTAMPTZ | Oluşturma tarihi |
| updated_at | TIMESTAMPTZ | Güncelleme tarihi |

**İlişkiler:**
- N:1 → companies (company_id)
- 1:N → invoice_project_links, project_files, informal_payments

**Constraint:**
- `end_date >= start_date` (bitiş başlangıçtan önce olamaz)

---

### 6. INVOICES (Faturalar)
**Amaç:** Yüklenen faturaları ve bilgilerini tutar.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Birincil anahtar |
| company_id | UUID | FK → companies |
| uploaded_by_user_id | UUID | FK → users |
| supplier_id | UUID | FK → suppliers |
| pdf_url | TEXT | Supabase Storage URL |
| invoice_number | TEXT | Fatura numarası |
| amount | DECIMAL(15,2) | Toplam tutar |
| date | DATE | Fatura tarihi |
| supplier_name | TEXT | Tedarikçi adı |
| goods_services_total | DECIMAL(12,2) | Mal/hizmet toplamı (KDV hariç) |
| vat_amount | DECIMAL(12,2) | KDV tutarı |
| withholding_amount | DECIMAL(12,2) | Tevkifat tutarı |
| processed | BOOLEAN | Projeye atanmış mı? |
| qr_metadata | JSONB | QR kod bilgileri |
| metadata | JSONB | Ek bilgiler |
| created_at | TIMESTAMPTZ | Oluşturma tarihi |

**İlişkiler:**
- N:1 → companies (company_id)
- N:1 → users (uploaded_by_user_id)
- N:1 → suppliers (supplier_id)
- 1:N → invoice_project_links, payments

**Trigger:**
- `invoice_project_links` eklendiğinde `processed = TRUE` yapılır

---

### 7. INVOICE_PROJECT_LINKS (Fatura-Proje Bağlantıları)
**Amaç:** Faturaları projelere bağlar (many-to-many).

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Birincil anahtar |
| invoice_id | UUID | FK → invoices |
| project_id | UUID | FK → projects |
| linked_by_user_id | UUID | FK → users |
| linked_at | TIMESTAMPTZ | Bağlanma zamanı |

**İlişkiler:**
- N:1 → invoices (invoice_id)
- N:1 → projects (project_id)
- N:1 → users (linked_by_user_id)

**Constraint:**
- UNIQUE (invoice_id, project_id) → Aynı fatura bir projeye 1 kez

---

### 8. PAYMENTS (Ödemeler)
**Amaç:** Faturalara ait ödeme kayıtları.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Birincil anahtar |
| invoice_id | UUID | FK → invoices |
| company_id | UUID | FK → companies |
| payment_type | TEXT | Ödeme tipi (Nakit, Banka, Çek vb.) |
| amount | DECIMAL(15,2) | Ödeme tutarı |
| payment_date | DATE | Ödeme tarihi |
| description | TEXT | Açıklama |
| created_by | UUID | FK → users |
| created_at | TIMESTAMPTZ | Oluşturma tarihi |
| updated_at | TIMESTAMPTZ | Güncelleme tarihi |

**İlişkiler:**
- N:1 → invoices (invoice_id)
- N:1 → companies (company_id)
- N:1 → users (created_by)

**Not:** Bir fatura birden fazla ödemeye bölünebilir.

---

### 9. SUPPLIERS (Tedarikçiler)
**Amaç:** Tedarikçi firma bilgilerini cache'ler (VKN bazlı).

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Birincil anahtar |
| company_id | UUID | FK → companies |
| vkn | VARCHAR(11) | Vergi Kimlik Numarası |
| name | VARCHAR(255) | Firma ünvanı |
| supplier_type | VARCHAR(20) | 'pending', 'subcontractor', 'invoice_company' |
| subcontractor_id | UUID | FK → subcontractors |
| address | TEXT | Adres |
| tax_office | VARCHAR(100) | Vergi dairesi |
| phone | VARCHAR(20) | Telefon |
| email | VARCHAR(255) | E-posta |
| notes | TEXT | Notlar |
| is_active | BOOLEAN | Aktif mi? |
| created_at | TIMESTAMPTZ | Oluşturma tarihi |
| updated_at | TIMESTAMPTZ | Güncelleme tarihi |

**İlişkiler:**
- N:1 → companies (company_id)
- N:1 → subcontractors (subcontractor_id)
- 1:N → invoices

**Constraint:**
- UNIQUE (company_id, vkn)

**Supplier Type Açıklaması:**
- `pending`: Henüz sınıflandırılmamış
- `subcontractor`: Taşeron firma
- `invoice_company`: Fatura firması

---

### 10. SUBCONTRACTORS (Taşeronlar)
**Amaç:** Taşeron firma bilgileri.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Birincil anahtar |
| company_id | UUID | FK → companies |
| supplier_id | UUID | FK → suppliers |
| name | TEXT | Taşeron adı |
| contact_person | TEXT | İletişim kişisi |
| phone | TEXT | Telefon |
| email | TEXT | E-posta |
| tax_number | TEXT | Vergi numarası |
| address | TEXT | Adres |
| notes | TEXT | Notlar |
| is_active | BOOLEAN | Aktif mi? |
| created_at | TIMESTAMPTZ | Oluşturma tarihi |
| updated_at | TIMESTAMPTZ | Güncelleme tarihi |

**İlişkiler:**
- N:1 → companies (company_id)
- N:1 → suppliers (supplier_id)
- 1:N → informal_payments

**Not:** suppliers ve subcontractors arasında iki yönlü ilişki var.

---

### 11. INFORMAL_PAYMENTS (Gayri Resmi Ödemeler)
**Amaç:** Taşeronlara yapılan gayri resmi ödemeleri takip eder.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Birincil anahtar |
| project_id | UUID | FK → projects (NULL olabilir) |
| supplier_id | UUID | FK → suppliers |
| company_id | UUID | FK → companies |
| amount | DECIMAL(15,2) | Ödeme tutarı |
| description | TEXT | Açıklama |
| payment_date | DATE | Ödeme tarihi |
| payment_method | TEXT | Ödeme yöntemi |
| receipt_number | TEXT | Fiş numarası |
| notes | TEXT | Notlar |
| created_by | UUID | FK → users |
| created_at | TIMESTAMPTZ | Oluşturma tarihi |
| updated_at | TIMESTAMPTZ | Güncelleme tarihi |

**İlişkiler:**
- N:1 → projects (project_id) - NULL olabilir
- N:1 → suppliers (supplier_id)
- N:1 → companies (company_id)
- N:1 → users (created_by)

---

### 12. PROJECT_FILES (Proje Dosyaları)
**Amaç:** Teknik ofis dosyalarını saklar.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Birincil anahtar |
| project_id | UUID | FK → projects |
| company_id | UUID | FK → companies |
| category | TEXT | 'statik', 'mimari', 'mekanik', 'elektrik', vb. |
| file_name | TEXT | Dosya adı |
| file_url | TEXT | Cloudinary URL |
| file_type | TEXT | Dosya tipi (PDF, DWG, vb.) |
| file_size | BIGINT | Dosya boyutu (byte) |
| cloudinary_public_id | TEXT | Cloudinary ID (silmek için) |
| uploaded_by | UUID | FK → users |
| created_at | TIMESTAMPTZ | Oluşturma tarihi |
| updated_at | TIMESTAMPTZ | Güncelleme tarihi |

**İlişkiler:**
- N:1 → projects (project_id)
- N:1 → companies (company_id)
- N:1 → users (uploaded_by)

**Kategoriler:**
- statik, mimari, mekanik, elektrik, zemin_etudu, geoteknik, ic_tasarim, 3d

---

### 13. USER_ACTIVITY_LOGS (Kullanıcı Aktivite Logları)
**Amaç:** Kullanıcı giriş/çıkış/aktivite kayıtları (sadece Super Admin görür).

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Birincil anahtar |
| user_id | UUID | FK → users |
| activity_type | TEXT | 'login', 'logout', 'heartbeat' |
| ip_address | TEXT | IP adresi |
| user_agent | TEXT | Tarayıcı bilgisi |
| timestamp | TIMESTAMPTZ | Zaman damgası |
| metadata | JSONB | Ek bilgiler |

**İlişkiler:**
- N:1 → users (user_id)

**RLS:** Sadece Super Admin okuyabilir.

---

## İLİŞKİ DİYAGRAMI

```
┌─────────────────┐
│   auth.users    │
│  (Supabase)     │
└────────┬────────┘
         │ 1:1
         ▼
┌─────────────────┐         ┌──────────────┐
│   COMPANIES     │◄───────┤   USERS      │
│                 │  N:1    │              │
│  - id           │         │  - id (PK)   │
│  - name         │         │  - email     │
│  - settings     │         │  - name      │
└────────┬────────┘         │  - company_id│
         │                  │  - role_id   │
         │ 1:N              │  - meta      │
         ▼                  └──────┬───────┘
┌─────────────────┐               │
│     ROLES       │               │ 1:N
│                 │               │
│  - id           │◄──────────────┘
│  - company_id   │         
│  - name         │         
│  - permissions  │         
└─────────────────┘         

         companies (1:N relations)
         ├─► projects
         ├─► invoices
         ├─► suppliers
         ├─► subcontractors
         └─► payments

┌─────────────────┐         ┌──────────────┐
│   PROJECTS      │         │   INVOICES   │
│                 │         │              │
│  - id           │         │  - id        │
│  - company_id   │         │  - company_id│
│  - name         │         │  - supplier_id
│  - status       │         │  - amount    │
└────────┬────────┘         │  - processed │
         │                  └──────┬───────┘
         │                         │
         │    ┌────────────────────┘
         │    │
         ▼    ▼
┌─────────────────────────────┐
│ INVOICE_PROJECT_LINKS       │
│                             │
│  - invoice_id (FK)          │
│  - project_id (FK)          │
│  - linked_by_user_id (FK)   │
│                             │
│  UNIQUE(invoice_id, project)│
└─────────────────────────────┘

┌──────────────┐         ┌──────────────┐
│  SUPPLIERS   │◄────┐   │SUBCONTRACTORS│
│              │ N:1 │   │              │
│  - id        │     └───┤  - supplier_id
│  - vkn       │         │  - name      │
│  - supplier_ │         │  - tax_number│
│    type      │         └──────┬───────┘
└──────┬───────┘                │
       │                        │
       │ 1:N                    │ 1:N
       ▼                        ▼
┌──────────────┐         ┌──────────────┐
│   INVOICES   │         │INFORMAL_     │
│              │         │PAYMENTS      │
│  - supplier_ │         │              │
│    id        │         │  - supplier_ │
└──────────────┘         │    id        │
                         │  - project_id│
                         └──────────────┘

┌──────────────┐
│   PAYMENTS   │
│              │
│  - invoice_id│──┐
│  - payment_  │  │
│    type      │  │ N:1
│  - amount    │  │
└──────────────┘  │
                  ▼
         ┌──────────────┐
         │   INVOICES   │
         └──────────────┘

┌──────────────┐
│PROJECT_FILES │
│              │
│  - project_id│──┐
│  - category  │  │ N:1
│  - file_url  │  │
└──────────────┘  │
                  ▼
         ┌──────────────┐
         │   PROJECTS   │
         └──────────────┘
```

---

## SAYFA BAZLI VERİ AKIŞLARI

### 1. DASHBOARD SAYFASI (`/dashboard`)

**Kullanılan Tablolar:**
- `users` (mevcut kullanıcı)
- `companies` (şirket bilgisi)
- `roles` (rol bilgisi)

**Veri Akışı:**
```sql
-- Kullanıcı bilgisi
SELECT u.*, c.name as company_name, r.name as role_name
FROM users u
JOIN companies c ON u.company_id = c.id
JOIN roles r ON u.role_id = r.id
WHERE u.id = [auth.uid()];
```

**Gösterilen Veriler:**
- Hoş geldin mesajı
- Şirket adı
- Kullanıcı rolü
- İstatistik kartları (henüz placeholder)

---

### 2. ACTIVITY LOGS SAYFASI (`/activity-logs`)

**Kullanılan Tablolar:**
- `user_activity_logs`
- `users`

**Join İşlemi:**
```sql
SELECT 
  ual.*,
  u.name as user_name,
  u.email as user_email
FROM user_activity_logs ual
LEFT JOIN users u ON ual.user_id = u.id
ORDER BY ual.timestamp DESC
LIMIT 500;
```

**Özellikler:**
- Sadece Super Admin erişebilir
- Login/logout/heartbeat kayıtları
- IP ve user agent bilgisi
- Filtreleme (all, login, logout, offline)
- Otomatik offline detection (5 dk)

**Veri Akışı:**
1. Super Admin kontrolü (role.name === 'Super Admin' && role.company_id === null)
2. Activity logları çekilir
3. Her 5 dakikada `detect_and_log_offline_users()` çalışır
4. Loglar yenilenir

---

### 3. INFORMAL PAYMENTS SAYFASI (`/informal-payments`)

**Kullanılan Tablolar:**
- `informal_payments`
- `suppliers` (subcontractor type)
- `projects`
- `users`

**Ana Sorgu:**
```sql
SELECT 
  ip.*,
  s.name as supplier_name,
  s.vkn,
  p.name as project_name,
  u.name as created_by_name
FROM informal_payments ip
LEFT JOIN suppliers s ON ip.supplier_id = s.id
LEFT JOIN projects p ON ip.project_id = p.id
LEFT JOIN users u ON ip.created_by = u.id
WHERE ip.company_id = [user.company_id]
ORDER BY ip.payment_date DESC;
```

**Özellikler:**
- Taşeronlara yapılan ödemeler
- Projeye bağlı veya bağımsız olabilir
- Filtreleme: taşeron, proje, tarih aralığı, ödeme yöntemi
- CRUD işlemleri (yetki kontrolü ile)

**Veri Akışı:**
1. Kullanıcının company_id'si alınır
2. O şirketin suppliers tablosundan `supplier_type = 'subcontractor'` olanlar çekilir
3. Ödemeler listelenir
4. Filtreler uygulanır

---

### 4. INVOICES SAYFASI (`/invoices`)

**Kullanılan Tablolar:**
- `invoices`
- `suppliers`
- `invoice_project_links`
- `projects`
- `payments`
- `users`

**Ana Sorgu:**
```sql
SELECT 
  i.*,
  s.name as supplier_name,
  s.vkn,
  u.name as uploaded_by_name,
  COALESCE(
    json_agg(
      json_build_object(
        'id', p.id,
        'name', p.name
      )
    ) FILTER (WHERE p.id IS NOT NULL),
    '[]'
  ) as projects
FROM invoices i
LEFT JOIN suppliers s ON i.supplier_id = s.id
LEFT JOIN users u ON i.uploaded_by_user_id = u.id
LEFT JOIN invoice_project_links ipl ON i.id = ipl.invoice_id
LEFT JOIN projects p ON ipl.project_id = p.id
WHERE i.company_id = [user.company_id]
GROUP BY i.id, s.name, s.vkn, u.name
ORDER BY i.date DESC;
```

**Tab'lar:**
- **Pending**: processed = false
- **Assigned**: processed = true
- **All**: tümü

**Özellikler:**
- QR kod okuma (fatura bilgilerini otomatik doldurma)
- PDF yükleme (Supabase Storage)
- Projeye atama (çoklu seçim)
- Ödeme kayıtları (payments tablosu)
- Toplu fatura ekleme (Excel)
- Rapor oluşturma (PDF)

**Veri Akışı:**
1. Fatura yükleme → QR okuma → Supplier oluşturma/bulma → Invoice kaydı
2. Projeye atama → invoice_project_links kaydı → processed = true
3. Ödeme ekleme → payments tablosuna kayıt

---

### 5. PROJECTS SAYFASI (`/projects`)

**Kullanılan Tablolar:**
- `projects`
- `companies`

**Ana Sorgu:**
```sql
SELECT *
FROM projects
WHERE company_id = [user.company_id]
ORDER BY name;
```

**Özellikler:**
- CRUD işlemleri
- Durum yönetimi (planned, active, on_hold, completed, cancelled)
- Tarih kontrolü (end_date >= start_date)
- Otomatik sıralama (sayı + alfabetik)

**Detay Sayfası (`/projects/[id]`):**
```sql
-- Proje bilgisi
SELECT * FROM projects WHERE id = [id];

-- Bağlı faturalar
SELECT i.*, s.name as supplier_name
FROM invoices i
JOIN invoice_project_links ipl ON i.id = ipl.invoice_id
LEFT JOIN suppliers s ON i.supplier_id = s.id
WHERE ipl.project_id = [id];

-- Proje dosyaları
SELECT * FROM project_files
WHERE project_id = [id]
ORDER BY category, created_at DESC;

-- Gayri resmi ödemeler
SELECT ip.*, s.name as supplier_name
FROM informal_payments ip
LEFT JOIN suppliers s ON ip.supplier_id = s.id
WHERE ip.project_id = [id];
```

---

### 6. ROLES SAYFASI (`/roles`)

**Kullanılan Tablolar:**
- `roles`
- `permissions` (referans için)

**Ana Sorgu:**
```sql
SELECT *
FROM roles
WHERE (
  company_id = [user.company_id] 
  OR company_id IS NULL
)
AND name != 'Super Admin'
ORDER BY name;
```

**Özellikler:**
- Rol oluşturma (sadece company scope)
- İzin yönetimi (checkboxlar)
- Super Admin rolü listede görünmez
- Yetki kontrolü (roles:create, roles:update, roles:delete)

**İzin Yapısı (JSON):**
```json
[
  {
    "resource": "invoices",
    "action": "create",
    "scope": "company"
  },
  {
    "resource": "projects",
    "action": "read",
    "scope": "company"
  }
]
```

---

### 7. SUBCONTRACTORS SAYFASI (`/subcontractors`)

**Kullanılan Tablolar:**
- `suppliers`
- `subcontractors`

**Ana Sorgu:**
```sql
-- Bekleyen tedarikçiler
SELECT * FROM suppliers
WHERE company_id = [user.company_id]
AND supplier_type = 'pending'
AND is_active = true;

-- Taşeronlar
SELECT s.*, sub.*
FROM suppliers s
LEFT JOIN subcontractors sub ON s.subcontractor_id = sub.id
WHERE s.company_id = [user.company_id]
AND s.supplier_type = 'subcontractor'
AND s.is_active = true;

-- Fatura firmaları
SELECT * FROM suppliers
WHERE company_id = [user.company_id]
AND supplier_type = 'invoice_company'
AND s.is_active = true;
```

**Tab'lar:**
- **Pending**: Henüz sınıflandırılmamış
- **Subcontractors**: Taşeronlar
- **Invoice Companies**: Fatura firmaları

**Özellikler:**
- Tedarikçi sınıflandırma (pending → subcontractor/invoice_company)
- Yeni taşeron ekleme
- İstatistikler
- Toplu seçim ve atama

**Veri Akışı:**
1. Fatura ekleme → VKN'den supplier otomatik oluşturulur (type: pending)
2. Kullanıcı supplier'ı sınıflandırır (subcontractor veya invoice_company)
3. Subcontractor seçilirse → subcontractors tablosuna kayıt + iki yönlü bağlantı

---

### 8. USERS SAYFASI (`/users`)

**Kullanılan Tablolar:**
- `users`
- `roles`
- `companies`
- `permissions`
- `auth.users` (signup için)

**Ana Sorgu:**
```sql
SELECT 
  u.*,
  r.name as role_name,
  r.permissions as role_permissions,
  c.name as company_name
FROM users u
JOIN roles r ON u.role_id = r.id
JOIN companies c ON u.company_id = c.id
WHERE r.name != 'Super Admin'
ORDER BY u.created_at DESC;
```

**Özellikler:**
- Kullanıcı oluşturma (Supabase Auth)
- Rol atama
- Şirket atama
- Özel izinler (custom_permissions)
- Durum gösterimi (online/offline, son görülme)

**Kullanıcı Presence:**
```sql
SELECT 
  id, 
  name, 
  email,
  last_seen_at,
  CASE 
    WHEN last_seen_at > NOW() - INTERVAL '2 minutes' THEN 'online'
    ELSE 'offline'
  END as status
FROM users;
```

**Veri Akışı:**
1. Admin kullanıcı oluşturur
2. Supabase Auth'a kayıt (email + password)
3. users tablosuna profil kaydı
4. Rol ve şirket ataması
5. RLS politikaları otomatik uygulanır

---

## FOREIGN KEY İLİŞKİLERİ

### Cascade Davranışları

| Ana Tablo | Bağımlı Tablo | FK Sütun | ON DELETE |
|-----------|---------------|----------|-----------|
| **companies** | users | company_id | CASCADE |
| **companies** | projects | company_id | CASCADE |
| **companies** | invoices | company_id | CASCADE |
| **companies** | suppliers | company_id | CASCADE |
| **companies** | subcontractors | company_id | CASCADE |
| **companies** | payments | company_id | CASCADE |
| **roles** | users | role_id | RESTRICT |
| **users** | invoices | uploaded_by_user_id | RESTRICT |
| **users** | invoice_project_links | linked_by_user_id | RESTRICT |
| **users** | informal_payments | created_by | RESTRICT |
| **users** | project_files | uploaded_by | RESTRICT |
| **users** | user_activity_logs | user_id | CASCADE |
| **projects** | invoice_project_links | project_id | CASCADE |
| **projects** | project_files | project_id | CASCADE |
| **projects** | informal_payments | project_id | SET NULL |
| **invoices** | invoice_project_links | invoice_id | CASCADE |
| **invoices** | payments | invoice_id | CASCADE |
| **suppliers** | invoices | supplier_id | RESTRICT |
| **suppliers** | informal_payments | supplier_id | RESTRICT |
| **subcontractors** | suppliers | supplier_id | SET NULL |

### Cascade Açıklaması:

- **CASCADE**: Ana kayıt silindiğinde bağımlı kayıtlar da silinir
- **RESTRICT**: Bağımlı kayıt varsa ana kayıt silinemez
- **SET NULL**: Ana kayıt silindiğinde FK NULL yapılır

### Önemli İlişki Detayları:

1. **companies CASCADE:**
   - Şirket silindiğinde tüm verileri temizlenir (users, projects, invoices, vb.)
   - Multi-tenancy güvenliği

2. **users RESTRICT:**
   - Kullanıcı silinmeden önce ilişkili kayıtlar (faturalar, loglar) temizlenmeli
   - Veri kaybı önleme

3. **projects → informal_payments SET NULL:**
   - Proje silinse bile ödeme kaydı korunur
   - project_id NULL yapılır

4. **suppliers ↔ subcontractors (iki yönlü):**
   - supplier.subcontractor_id → subcontractors.id (SET NULL)
   - subcontractor.supplier_id → suppliers.id (SET NULL)
   - Döngüsel silme problemini önler

---

## ÖNEMLİ NOTLAR

### 1. Row Level Security (RLS)

Tüm tablolarda RLS aktif. Temel politika:
```sql
-- Örnek: Şirket bazlı izolasyon
company_id IN (
  SELECT company_id FROM users WHERE id = auth.uid()
)
```

**İstisna:** Super Admin (`role.company_id IS NULL`) tüm verilere erişebilir.

### 2. Yetki Kontrolü

İki katmanlı:
1. **RLS (Database)**: Satır bazlı filtreleme
2. **RBAC (Application)**: İşlem bazlı kontrol (create, read, update, delete)

```typescript
// Örnek kontrol
if (!hasPermission('invoices', 'create')) {
  throw new Error('Yetkiniz yok');
}
```

### 3. Triggers ve Functions

**Otomatik Güncellenen Alanlar:**
- `updated_at` → Her UPDATE'te güncellenir
- `last_seen_at` → Heartbeat ile güncellenir
- `processed` → invoice_project_links eklenince TRUE olur

**Özel Fonksiyonlar:**
- `update_user_last_seen(uuid)` → Kullanıcı son görülme
- `log_user_activity(...)` → Aktivite kaydı
- `detect_and_log_offline_users()` → Offline detection
- `sync_supplier_subcontractor()` → Supplier-subcontractor senkronizasyonu

### 4. JSONB Kullanımı

**Nerede kullanılıyor:**
- `companies.settings` → Şirket ayarları
- `users.meta` → Kullanıcı metadata
- `roles.permissions` → İzin listesi
- `invoices.metadata` → Fatura ek bilgileri
- `invoices.qr_metadata` → QR kod verisi
- `user_activity_logs.metadata` → Log detayları

**Avantajlar:**
- Esneklik (şema değişikliği gerekmez)
- GIN index ile hızlı arama

### 5. Supplier Sistemi

**Akış:**
```
Fatura Yükleme
    ↓
VKN Kontrolü (suppliers tablosu)
    ↓
Bulunamazsa → Yeni supplier (type: pending)
    ↓
Kullanıcı Sınıflandırır
    ├─► Subcontractor → subcontractors tablosuna kayıt
    └─► Invoice Company → Sadece supplier kaydı kalır
```

**Neden iki tablo?**
- `suppliers`: Hafif cache (VKN + ad)
- `subcontractors`: Detaylı taşeron bilgileri

### 6. Invoice-Project İlişkisi

**Many-to-Many:**
- Bir fatura birden fazla projeye atanabilir
- Bir projede birden fazla fatura olabilir
- `invoice_project_links` pivot table

**processed Flag:**
- `false`: Henüz atanmamış (Pending tab)
- `true`: En az 1 projeye atanmış (Assigned tab)

### 7. Indexes

**Önemli indexler:**
```sql
-- Şirket bazlı sorgular için
CREATE INDEX idx_[table]_company_id ON [table](company_id);

-- Tarih aralığı sorguları için
CREATE INDEX idx_invoices_date ON invoices(date DESC);
CREATE INDEX idx_informal_payments_payment_date ON informal_payments(payment_date);

-- JSONB için
CREATE INDEX idx_roles_permissions ON roles USING GIN (permissions);
CREATE INDEX idx_invoices_metadata ON invoices USING GIN (metadata);

-- Arama için
CREATE INDEX idx_suppliers_vkn ON suppliers(vkn);
CREATE INDEX idx_suppliers_name ON suppliers(name);
```

### 8. Veri Tutarlılığı

**Constraints:**
- UNIQUE (invoice_id, project_id) → Tekrar atama önleme
- UNIQUE (company_id, vkn) → Aynı VKN 1 kez
- CHECK (amount > 0) → Negatif tutar önleme
- CHECK (end_date >= start_date) → Mantıksal tarih kontrolü

### 9. Audit Trail

**Kim ne yaptı?**
- `uploaded_by_user_id` (invoices)
- `linked_by_user_id` (invoice_project_links)
- `created_by` (informal_payments, payments, project_files)
- `user_activity_logs` (tüm aktiviteler)

### 10. Performance Optimizasyonu

**Öneriler:**
- Tarih aralığı sorgularında index kullanılıyor
- JSONB'de GIN index var
- JOIN'ler FK indexleri sayesinde hızlı
- RLS politikaları optimize edilmiş
- Limit kullanımı (activity logs: 500)

---

## SONUÇ

Bu database mimarisi:
- ✅ Multi-tenancy (şirket izolasyonu)
- ✅ RBAC (rol tabanlı erişim)
- ✅ Audit trail (kim ne yaptı)
- ✅ Veri tutarlılığı (constraints, triggers)
- ✅ Esneklik (JSONB, optional relations)
- ✅ Performans (indexler, RLS optimizasyonu)
- ✅ Güvenlik (RLS, yetki kontrolleri)

**Toplam Tablo Sayısı:** 13 ana tablo + auth.users (Supabase)  
**Toplam Migration:** 27 dosya  
**Database Boyutu:** Küçük-orta ölçekli (100K kayıt altı için optimize)

---

**Hazırlayan:** GitHub Copilot  
**Tarih:** 24 Aralık 2025  
**Versiyon:** 1.0
