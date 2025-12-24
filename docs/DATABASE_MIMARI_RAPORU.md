# 📊 LUCE MİMARLIK - DATABASE MİMARİ RAPORU

> **Son Güncelleme:** 24 Aralık 2025  
> **Proje:** Luce Mimarlık İç İş Akışı Sistemi  
> **Database:** Supabase (PostgreSQL)

---

## 📑 İÇİNDEKİLER

1. [Genel Bakış](#genel-bakış)
2. [Tablo Yapıları](#tablo-yapıları)
3. [İlişki Diyagramı](#ilişki-diyagramı)
4. [Sayfa Bazlı Database Kullanımı](#sayfa-bazlı-database-kullanımı)
5. [Foreign Key İlişkileri](#foreign-key-ilişkileri)
6. [Önemli Notlar](#önemli-notlar)

---

## 🎯 GENEL BAKIŞ

### Sistemin Temel Amacı
Luce Mimarlık için iç iş akışlarını yönetmek:
- ✅ Proje takibi
- ✅ Fatura yönetimi
- ✅ Taşeron ödemeleri
- ✅ Kullanıcı yetkilendirme
- ✅ Aktivite logları

### Multi-Tenancy Yapısı
Her şirket kendi verilerine erişir → **company_id** ile izolasyon

### Yetki Sistemi (RBAC)
Roller ve izinler → **roles** tablosu + JSONB permissions

---

## 📋 TABLO YAPILARI

### 1️⃣ **companies** (Şirketler)
**Amaç:** Multi-tenancy için şirket bilgileri

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | UUID | Primary Key |
| `name` | VARCHAR(100) | Şirket adı (unique) |
| `settings` | JSONB | Şirkete özel ayarlar |
| `created_at` | TIMESTAMPTZ | Oluşturma zamanı |

**İlişkiler:**
- `users` → Her kullanıcı bir şirkete bağlı
- `projects` → Her proje bir şirkete ait
- `invoices` → Her fatura bir şirkete ait
- `subcontractors` → Her taşeron bir şirkete ait
- `informal_payments` → Her ödeme bir şirkete ait
- `suppliers` → Her tedarikçi bir şirkete ait

---

### 2️⃣ **roles** (Roller)
**Amaç:** Kullanıcı rolleri ve izinleri

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | UUID | Primary Key |
| `company_id` | UUID | Şirket (NULL = global rol) |
| `name` | VARCHAR(50) | Rol adı |
| `permissions` | JSONB | İzin listesi |
| `created_at` | TIMESTAMPTZ | Oluşturma zamanı |

**Varsayılan Roller:**
1. `superadmin` → Tüm yetkiler
2. `şirket_yöneticisi` → Şirket içi tüm yetkiler
3. `muhasebe` → Fatura işlemleri
4. `mimar` → Proje + fatura okuma/atama
5. `insaat_muhendisi` → Proje güncelleme

**İzin Örneği (JSONB):**
```json
[
  {"resource": "invoices", "action": "create", "scope": "company"},
  {"resource": "projects", "action": "read", "scope": "company"}
]
```

---

### 3️⃣ **users** (Kullanıcılar)
**Amaç:** Kullanıcı profilleri (Supabase Auth ile entegre)

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | UUID | Supabase auth.users.id |
| `email` | VARCHAR(255) | Email (unique) |
| `name` | VARCHAR(100) | Ad Soyad |
| `company_id` | UUID | Bağlı şirket |
| `role_id` | UUID | Atanmış rol |
| `meta` | JSONB | Ek bilgiler |
| `created_at` | TIMESTAMPTZ | Kayıt tarihi |

**İlişkiler:**
- → `companies` (company_id)
- → `roles` (role_id)
- ← `invoices` (uploaded_by_user_id)
- ← `informal_payments` (created_by)
- ← `invoice_project_links` (linked_by_user_id)
- ← `audit_logs` (user_id)

---

### 4️⃣ **projects** (Projeler)
**Amaç:** Şirket projelerini takip etme

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | UUID | Primary Key |
| `company_id` | UUID | Şirket |
| `name` | VARCHAR(100) | Proje adı |
| `description` | TEXT | Açıklama |
| `start_date` | DATE | Başlangıç tarihi |
| `end_date` | DATE | Bitiş tarihi |
| `status` | ENUM | planned/active/on_hold/completed/cancelled |
| `created_at` | TIMESTAMPTZ | Oluşturma |
| `updated_at` | TIMESTAMPTZ | Son güncelleme |

**İlişkiler:**
- → `companies` (company_id)
- ← `invoices` (invoice_project_links üzerinden)
- ← `informal_payments` (project_id)
- ← `project_files` (project_id)

---

### 5️⃣ **invoices** (Faturalar)
**Amaç:** PDF fatura kayıtları ve tedarikçi bilgileri

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | UUID | Primary Key |
| `company_id` | UUID | Şirket |
| `uploaded_by_user_id` | UUID | Yükleyen kullanıcı |
| `supplier_id` | UUID | Tedarikçi (opsiyonel) |
| `pdf_url` | TEXT | Supabase Storage URL |
| `amount` | DECIMAL(15,2) | Tutar |
| `date` | DATE | Fatura tarihi |
| `processed` | BOOLEAN | Projeye atandı mı? |
| `metadata` | JSONB | Fatura no, vergi, notlar |
| `qr_metadata` | JSONB | QR kod verisi |
| `created_at` | TIMESTAMPTZ | Yüklenme zamanı |

**metadata Örneği:**
```json
{
  "invoice_number": "FTR-2025-001",
  "tax_amount": 324.00,
  "supplier_name": "ABC İnşaat Ltd.",
  "notes": "Malzeme faturası"
}
```

**İlişkiler:**
- → `companies` (company_id)
- → `users` (uploaded_by_user_id)
- → `suppliers` (supplier_id)
- ← `invoice_project_links` (invoice_id)

---

### 6️⃣ **invoice_project_links** (Fatura-Proje İlişkileri)
**Amaç:** Faturaları projelere bağlama

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | UUID | Primary Key |
| `invoice_id` | UUID | Fatura |
| `project_id` | UUID | Proje |
| `linked_by_user_id` | UUID | Bağlayan kullanıcı |
| `linked_at` | TIMESTAMPTZ | Bağlanma zamanı |

**Özel Özellik:** Bir fatura aynı projeye birden fazla kez atanamaz (UNIQUE constraint)

**Trigger:** Fatura bağlandığında `invoices.processed = TRUE` olur

---

### 7️⃣ **subcontractors** (Taşeronlar)
**Amaç:** Taşeron firma bilgileri

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | UUID | Primary Key |
| `company_id` | UUID | Şirket |
| `name` | TEXT | Taşeron adı |
| `contact_person` | TEXT | İletişim kişisi |
| `phone` | TEXT | Telefon |
| `email` | TEXT | Email |
| `tax_number` | TEXT | Vergi numarası |
| `address` | TEXT | Adres |
| `notes` | TEXT | Notlar |
| `is_active` | BOOLEAN | Aktif mi? (soft delete) |
| `created_at` | TIMESTAMPTZ | Oluşturma |
| `updated_at` | TIMESTAMPTZ | Güncelleme |

**İlişkiler:**
- → `companies` (company_id)
- ← `informal_payments` (subcontractor_id)

---

### 8️⃣ **informal_payments** (Gayri Resmi Ödemeler)
**Amaç:** Taşeronlara yapılan ödemeleri takip

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | UUID | Primary Key |
| `company_id` | UUID | Şirket |
| `project_id` | UUID | Proje (opsiyonel) |
| `subcontractor_id` | UUID | Taşeron |
| `amount` | DECIMAL(15,2) | Tutar |
| `description` | TEXT | İş açıklaması |
| `payment_date` | DATE | Ödeme tarihi |
| `payment_method` | TEXT | Nakit/Banka/Çek |
| `receipt_number` | TEXT | Makbuz no |
| `notes` | TEXT | Notlar |
| `created_by` | UUID | Oluşturan kullanıcı |
| `created_at` | TIMESTAMPTZ | Oluşturma |
| `updated_at` | TIMESTAMPTZ | Güncelleme |

**İlişkiler:**
- → `companies` (company_id)
- → `projects` (project_id) - SET NULL on delete
- → `subcontractors` (subcontractor_id) - RESTRICT on delete
- → `users` (created_by)

---

### 9️⃣ **suppliers** (Tedarikçiler)
**Amaç:** Fatura tedarikçi bilgilerini cache'leme

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | UUID | Primary Key |
| `company_id` | UUID | Şirket |
| `vkn` | VARCHAR(11) | Vergi Kimlik No |
| `name` | VARCHAR(255) | Firma ünvanı |
| `address` | TEXT | Adres |
| `tax_office` | VARCHAR(100) | Vergi dairesi |
| `phone` | VARCHAR(20) | Telefon |
| `email` | VARCHAR(255) | Email |
| `notes` | TEXT | Notlar |
| `created_at` | TIMESTAMPTZ | Oluşturma |
| `updated_at` | TIMESTAMPTZ | Güncelleme |

**Özellik:** Her company için her VKN bir kez kayıtlı olabilir

---

### 🔟 **project_files** (Proje Dosyaları)
**Amaç:** Projelere ait dosyaları saklama (3D, PDF, resim vb.)

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | UUID | Primary Key |
| `project_id` | UUID | Proje |
| `file_url` | TEXT | Supabase Storage URL |
| `file_name` | TEXT | Dosya adı |
| `file_type` | TEXT | Dosya tipi |
| `uploaded_by` | UUID | Yükleyen |
| `created_at` | TIMESTAMPTZ | Yükleme zamanı |

---

### 1️⃣1️⃣ **audit_logs** (Denetim Kayıtları)
**Amaç:** Tüm önemli işlemleri loglama

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | UUID | Primary Key |
| `user_id` | UUID | İşlemi yapan |
| `action` | VARCHAR(100) | İşlem türü |
| `target_type` | VARCHAR(50) | Hedef tür (invoice, project) |
| `target_id` | UUID | Hedef ID |
| `timestamp` | TIMESTAMPTZ | Zaman damgası |
| `details` | JSONB | Detaylar |

**Örnek action'lar:**
- `invoice_uploaded`
- `invoice_linked`
- `project_created`
- `user_role_changed`

---

### 1️⃣2️⃣ **user_presence** (Kullanıcı Varlığı)
**Amaç:** Online/offline durumu

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `user_id` | UUID | Kullanıcı |
| `is_online` | BOOLEAN | Online mı? |
| `last_seen` | TIMESTAMPTZ | Son görülme |
| `updated_at` | TIMESTAMPTZ | Güncelleme |

---

### 1️⃣3️⃣ **activity_logs** (Aktivite Logları)
**Amaç:** Kullanıcı aktivitelerini kaydetme

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | UUID | Primary Key |
| `user_id` | UUID | Kullanıcı |
| `action` | TEXT | İşlem |
| `description` | TEXT | Açıklama |
| `resource_type` | TEXT | Kaynak türü |
| `resource_id` | UUID | Kaynak ID |
| `metadata` | JSONB | Ek bilgi |
| `created_at` | TIMESTAMPTZ | Zaman |

---

## 🔗 İLİŞKİ DİYAGRAMI

```
┌─────────────┐
│  companies  │
└──────┬──────┘
       │
       ├──────────┬──────────┬──────────┬──────────┬──────────┐
       │          │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼          ▼
   ┌───────┐  ┌─────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────┐
   │ roles │  │  users  │ │ projects │ │ subcontractors│ │suppliers │
   └───┬───┘  └────┬────┘ └────┬─────┘ └──────┬───────┘ └────┬─────┘
       │           │           │              │              │
       └───────────┤           │              │              │
                   │           │              │              │
                   ▼           ▼              ▼              ▼
              ┌─────────┐  ┌──────────────┐  ┌──────────┐
              │invoices │  │project_files │  │ informal │
              └────┬────┘  └──────────────┘  │ payments │
                   │                          └──────────┘
                   │
                   ▼
       ┌──────────────────────┐
       │invoice_project_links │
       └──────────────────────┘

┌──────────────┐
│ audit_logs   │ ←─── Tüm önemli işlemleri loglar
└──────────────┘

┌──────────────┐
│activity_logs │ ←─── Kullanıcı aktivitelerini loglar
└──────────────┘

┌──────────────┐
│user_presence │ ←─── Online/offline durumu
└──────────────┘
```

---

## 📄 SAYFA BAZLI DATABASE KULLANIMI

### 🏠 **Dashboard (Ana Sayfa)**
**Dosya:** `app/dashboard/page.tsx`

**Kullandığı Tablolar:**
- `projects` → Proje sayısı
- `invoices` → Fatura istatistikleri
- `informal_payments` → Ödeme toplamları
- `users` → Kullanıcı bilgileri

**SQL Örneği:**
```sql
-- Aktif proje sayısı
SELECT COUNT(*) FROM projects 
WHERE company_id = 'xxx' AND status = 'active';

-- Toplam fatura tutarı
SELECT SUM(amount) FROM invoices 
WHERE company_id = 'xxx' AND processed = true;

-- Son 30 gün ödeme toplamı
SELECT SUM(amount) FROM informal_payments
WHERE company_id = 'xxx' 
AND payment_date >= NOW() - INTERVAL '30 days';
```

**Veri Akışı:**
1. Kullanıcı login olur → `users` tablosundan company_id alınır
2. Dashboard istatistikler yüklenir → Her tablo için COUNT/SUM sorguları
3. Son aktiviteler gösterilir → `audit_logs` tablosundan çekilir

---

### 📊 **Projeler Sayfası**
**Dosya:** `app/projects/page.tsx`

**Kullandığı Tablolar:**
- `projects` (ana veri)
- `invoice_project_links` → Fatura sayısı
- `informal_payments` → Ödeme sayısı
- `users` → Kullanıcı adları

**SQL Örneği:**
```sql
-- Tüm projeleri listele + fatura sayıları
SELECT 
  p.*,
  COUNT(DISTINCT ipl.invoice_id) as invoice_count,
  COUNT(DISTINCT ip.id) as payment_count
FROM projects p
LEFT JOIN invoice_project_links ipl ON p.id = ipl.project_id
LEFT JOIN informal_payments ip ON p.id = ip.project_id
WHERE p.company_id = 'xxx'
GROUP BY p.id
ORDER BY p.created_at DESC;
```

**Veri Akışı:**
1. Kullanıcının company_id'sine göre projeler çekilir
2. Her proje için ilişkili fatura ve ödeme sayıları hesaplanır
3. Proje detayında → `project_files` tablosundan dosyalar gösterilir

---

### 💰 **Faturalar Sayfası**
**Dosya:** `app/invoices/page.tsx`

**Kullandığı Tablolar:**
- `invoices` (ana veri)
- `suppliers` → Tedarikçi adı
- `invoice_project_links` → Proje ilişkisi
- `projects` → Proje adları
- `users` → Yükleyen kullanıcı

**SQL Örneği:**
```sql
-- Faturaları listele (tedarikçi ve proje bilgileriyle)
SELECT 
  i.*,
  s.name as supplier_name,
  s.vkn as supplier_vkn,
  u.name as uploaded_by_name,
  array_agg(p.name) as project_names
FROM invoices i
LEFT JOIN suppliers s ON i.supplier_id = s.id
LEFT JOIN users u ON i.uploaded_by_user_id = u.id
LEFT JOIN invoice_project_links ipl ON i.id = ipl.invoice_id
LEFT JOIN projects p ON ipl.project_id = p.id
WHERE i.company_id = 'xxx'
GROUP BY i.id, s.id, u.id
ORDER BY i.date DESC;
```

**Veri Akışı:**
1. PDF yükleme → `invoices` tablosuna kayıt + Supabase Storage'a dosya
2. QR kod okuma → `qr_metadata` sütununa JSON olarak kaydedilir
3. Tedarikçi seçimi → VKN ile `suppliers` tablosunda arama → yoksa oluştur
4. Projeye atama → `invoice_project_links` tablosuna kayıt + `processed = true`

---

### 💵 **Gayri Resmi Ödemeler**
**Dosya:** `app/informal-payments/page.tsx`

**Kullandığı Tablolar:**
- `informal_payments` (ana veri)
- `subcontractors` → Taşeron bilgileri
- `projects` → Proje adı
- `users` → Oluşturan kullanıcı

**SQL Örneği:**
```sql
-- Ödemeleri listele
SELECT 
  ip.*,
  s.name as subcontractor_name,
  s.phone as subcontractor_phone,
  p.name as project_name,
  u.name as created_by_name
FROM informal_payments ip
JOIN subcontractors s ON ip.subcontractor_id = s.id
LEFT JOIN projects p ON ip.project_id = p.id
JOIN users u ON ip.created_by = u.id
WHERE ip.company_id = 'xxx'
ORDER BY ip.payment_date DESC;
```

**Veri Akışı:**
1. Ödeme oluşturma → `informal_payments` tablosuna INSERT
2. Sözleşmeli ödeme → PDF oluşturulur (pdfmake ile)
3. Taşeron seçimi → `subcontractors` tablosundan dropdown
4. Proje seçimi → `projects` tablosundan dropdown (opsiyonel)

---

### 👷 **Taşeronlar Sayfası**
**Dosya:** `app/subcontractors/page.tsx`

**Kullandığı Tablolar:**
- `subcontractors` (ana veri)
- `informal_payments` → Toplam ödeme hesabı

**SQL Örneği:**
```sql
-- Taşeronları listele + ödeme toplamları
SELECT 
  s.*,
  COUNT(ip.id) as payment_count,
  COALESCE(SUM(ip.amount), 0) as total_paid
FROM subcontractors s
LEFT JOIN informal_payments ip ON s.id = ip.subcontractor_id
WHERE s.company_id = 'xxx' AND s.is_active = true
GROUP BY s.id
ORDER BY s.name;
```

**Veri Akışı:**
1. Yeni taşeron → `subcontractors` tablosuna INSERT
2. Güncelleme → UPDATE query
3. Silme → `is_active = false` (soft delete)

---

### 👤 **Kullanıcılar Sayfası**
**Dosya:** `app/users/page.tsx`

**Kullandığı Tablolar:**
- `users` (ana veri)
- `roles` → Rol adı ve izinleri
- `companies` → Şirket adı

**SQL Örneği:**
```sql
-- Kullanıcıları listele
SELECT 
  u.*,
  r.name as role_name,
  r.permissions,
  c.name as company_name
FROM users u
JOIN roles r ON u.role_id = r.id
JOIN companies c ON u.company_id = c.id
WHERE u.company_id = 'xxx'
ORDER BY u.created_at DESC;
```

**Veri Akışı:**
1. Yeni kullanıcı → Supabase Auth'a kayıt + `users` tablosuna INSERT
2. Rol atama → `role_id` güncellenir
3. İzin kontrolü → `roles.permissions` JSONB'den okunur

---

### 🎭 **Roller Sayfası**
**Dosya:** `app/roles/page.tsx`

**Kullandığı Tablolar:**
- `roles` (ana veri)
- `users` → Kaç kullanıcı bu rolde

**SQL Örneği:**
```sql
-- Rolleri listele + kullanıcı sayıları
SELECT 
  r.*,
  COUNT(u.id) as user_count
FROM roles r
LEFT JOIN users u ON r.id = u.role_id
WHERE r.company_id = 'xxx' OR r.company_id IS NULL
GROUP BY r.id;
```

**Veri Akışı:**
1. Rol oluşturma → `roles` tablosuna INSERT + JSONB permissions
2. İzin düzenleme → UPDATE permissions sütunu
3. Global roller → `company_id = NULL` (tüm şirketler için)

---

### 📜 **Aktivite Logları**
**Dosya:** `app/activity-logs/page.tsx`

**Kullandığı Tablolar:**
- `activity_logs` (ana veri)
- `users` → Kullanıcı adı

**SQL Örneği:**
```sql
-- Son aktiviteleri listele
SELECT 
  al.*,
  u.name as user_name,
  u.email as user_email
FROM activity_logs al
JOIN users u ON al.user_id = u.id
WHERE u.company_id = 'xxx'
ORDER BY al.created_at DESC
LIMIT 100;
```

**Veri Akışı:**
1. Her önemli işlem → `activity_logs` tablosuna INSERT
2. Filtre → action, resource_type, tarih aralığı
3. Detay görüntüleme → metadata JSONB'den bilgiler

---

## 🔑 FOREIGN KEY İLİŞKİLERİ

### Silme Davranışları (ON DELETE)

| Tablo | Foreign Key | ON DELETE | Açıklama |
|-------|-------------|-----------|----------|
| **users** | company_id | CASCADE | Şirket silinirse kullanıcılar da silinir |
| **users** | role_id | RESTRICT | Rolü kullanan kullanıcı varsa rol silinemez |
| **projects** | company_id | CASCADE | Şirket silinirse projeler de silinir |
| **invoices** | company_id | CASCADE | Şirket silinirse faturalar da silinir |
| **invoices** | uploaded_by_user_id | RESTRICT | Kullanıcı fatura yüklediyse silinemez |
| **invoices** | supplier_id | SET NULL | Tedarikçi silinirse fatura kalır, supplier_id NULL olur |
| **invoice_project_links** | invoice_id | CASCADE | Fatura silinirse link de silinir |
| **invoice_project_links** | project_id | CASCADE | Proje silinirse link de silinir |
| **subcontractors** | company_id | CASCADE | Şirket silinirse taşeronlar da silinir |
| **informal_payments** | company_id | CASCADE | Şirket silinirse ödemeler de silinir |
| **informal_payments** | project_id | SET NULL | Proje silinirse ödeme kalır, project_id NULL olur |
| **informal_payments** | subcontractor_id | RESTRICT | Taşeronun ödemesi varsa silinemez |
| **suppliers** | company_id | CASCADE | Şirket silinirse tedarikçiler de silinir |
| **audit_logs** | user_id | RESTRICT | Kullanıcı log'u varsa silinemez |

### Önemli Constraint'ler

1. **Unique Constraints:**
   - `companies.name` → Aynı isimde iki şirket olamaz
   - `users.email` → Aynı email ile iki kullanıcı olamaz
   - `roles (name, company_id)` → Aynı şirkette aynı isimli iki rol olamaz
   - `suppliers (company_id, vkn)` → Aynı şirkette aynı VKN iki kez olamaz
   - `invoice_project_links (invoice_id, project_id)` → Fatura aynı projeye iki kez atanamaz

2. **Check Constraints:**
   - `invoices.amount > 0` → Fatura tutarı negatif olamaz
   - `informal_payments.amount >= 0` → Ödeme tutarı negatif olamaz
   - `projects.end_date >= start_date` → Bitiş tarihi başlangıçtan önce olamaz

---

## 📝 ÖNEMLİ NOTLAR

### 🔒 RLS (Row Level Security) Politikaları
Her tablo için RLS aktif → Kullanıcılar sadece kendi şirketlerinin verilerini görür

**Örnek RLS Politikası:**
```sql
CREATE POLICY "Users can view own company data"
  ON projects FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );
```

### 🎯 RBAC (Role-Based Access Control)
İzin kontrolü iki katmanlı:
1. **RLS** → Database seviyesinde şirket izolasyonu
2. **Permissions** → Uygulama seviyesinde rol bazlı yetki kontrolü

**İzin Kontrolü Fonksiyonu:**
```sql
has_permission(user_id, 'invoices', 'create', 'company')
```

### 🔄 Trigger'lar
1. **update_updated_at_column()** → Her güncelleme öncesi `updated_at` otomatik güncellenir
2. **mark_invoice_processed()** → Fatura projeye atanınca `processed = true` olur

### 📦 JSONB Kullanımı
Esnek veri saklama için JSONB kullanılıyor:
- `companies.settings` → Şirket ayarları
- `roles.permissions` → İzin listesi
- `users.meta` → Kullanıcı metadata
- `invoices.metadata` → Fatura detayları
- `invoices.qr_metadata` → QR kod verisi
- `audit_logs.details` → Log detayları
- `activity_logs.metadata` → Aktivite detayları

### 🏢 Supplier (Tedarikçi) Sistemi
- VKN bazlı cache sistemi
- Faturaya tedarikçi atanırsa → `suppliers` tablosunda arama
- Bulunamazsa → API'den çekilip kaydedilir
- Sonraki faturalarda → Cache'ten okunur (API'ye gidilmez)

### 📈 Index'ler
Performance için stratejik index'ler:
- `company_id` → Tüm tablolarda (multi-tenancy için kritik)
- `email` → Kullanıcı arama
- `date` → Tarih bazlı sıralama/filtreleme
- `status` → Durum filtreleme
- **GIN Index** → JSONB sütunlar için (metadata, permissions)

### 📊 Audit Trail (İz Sürme)
İki tür log sistemi:
1. **audit_logs** → Kritik işlemler (CRUD operasyonları)
2. **activity_logs** → Kullanıcı aktiviteleri (sayfa ziyaretleri, arama vb.)

### ⚡ Performance İpuçları
1. **Partitioning** → `audit_logs` ve `activity_logs` için zaman bazlı partition önerilir
2. **Materialized Views** → Dashboard istatistikleri için kullanılabilir
3. **Connection Pooling** → Supabase otomatik sağlıyor
4. **Query Optimization** → LEFT JOIN yerine EXISTS kullan (RLS ile uyumlu)

---

## 🚀 YENİ ÖZELLİK GELİŞTİRİRKEN DİKKAT EDİLECEKLER

### ✅ Checklist
1. [ ] `company_id` ekle (multi-tenancy)
2. [ ] RLS politikaları oluştur
3. [ ] Foreign key ilişkilerini doğru belirle (CASCADE/RESTRICT/SET NULL)
4. [ ] Index'leri ekle (company_id, sık kullanılan filtreler)
5. [ ] `updated_at` trigger'ı ekle
6. [ ] Migration dosyası oluştur
7. [ ] Audit log entegrasyonu yap
8. [ ] TypeScript type'larını güncelle (types/supabase.ts)
9. [ ] Permission kontrolü ekle (RBAC)
10. [ ] Test senaryoları yaz

### 📋 Örnek Migration Template
```sql
-- Yeni tablo için migration
CREATE TABLE new_feature (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- diğer sütunlar
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index'ler
CREATE INDEX idx_new_feature_company_id ON new_feature(company_id);

-- RLS
ALTER TABLE new_feature ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company data"
  ON new_feature FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Trigger
CREATE TRIGGER update_new_feature_updated_at
  BEFORE UPDATE ON new_feature
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## 📞 DESTEK

**Sorular için:** Database mimarisi hakkında sorularınız varsa, bu raporu referans alarak detaylı sorabilirsiniz.

**Son Güncelleme:** 24 Aralık 2025

---

**© 2025 Luce Mimarlık - İç İş Akışı Sistemi**
