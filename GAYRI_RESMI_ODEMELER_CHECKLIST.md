# Gayri Resmi Ödemeler & Taşeron Listesi - Geliştirme Checklist

**Başlangıç Tarihi:** 10 Aralık 2025  
**Durum:** Devam Ediyor  
**Son Güncelleme:** 10 Aralık 2025

---

## 📋 FAZA 1: VERİTABANI TASARIMI VE OLUŞTURMA

### 1.1 Taşeron Tablosu (subcontractors)
- [ ] Migration dosyası oluştur: `20251210_create_subcontractors.sql`
- [ ] Kolonlar:
  - [ ] `id` (uuid, primary key)
  - [ ] `company_id` (uuid, foreign key -> companies)
  - [ ] `name` (text, not null) - Taşeron firma adı
  - [ ] `contact_person` (text, nullable) - İletişim kişisi
  - [ ] `phone` (text, nullable) - Telefon
  - [ ] `email` (text, nullable) - E-posta
  - [ ] `tax_number` (text, nullable) - Vergi numarası
  - [ ] `address` (text, nullable) - Adres
  - [ ] `notes` (text, nullable) - Notlar
  - [ ] `is_active` (boolean, default true) - Aktif/Pasif
  - [ ] `created_at` (timestamp with time zone)
  - [ ] `updated_at` (timestamp with time zone)

- [ ] Indexes:
  - [ ] `idx_subcontractors_company_id` on company_id
  - [ ] `idx_subcontractors_name` on name
  - [ ] `idx_subcontractors_is_active` on is_active

- [ ] RLS Policies:
  - [ ] Enable RLS
  - [ ] SELECT: Company users can view own company subcontractors
  - [ ] INSERT: Authenticated users can create subcontractors
  - [ ] UPDATE: Authenticated users can update own company subcontractors
  - [ ] DELETE: Authenticated users can delete own company subcontractors

### 1.2 Gayri Resmi Ödemeler Tablosu (informal_payments)
- [ ] Migration dosyası oluştur: `20251210_create_informal_payments.sql`
- [ ] Kolonlar:
  - [ ] `id` (uuid, primary key)
  - [ ] `project_id` (uuid, foreign key -> projects, nullable)
  - [ ] `subcontractor_id` (uuid, foreign key -> subcontractors, not null)
  - [ ] `amount` (decimal(15,2), not null) - Ödeme tutarı
  - [ ] `description` (text, not null) - Açıklama
  - [ ] `payment_date` (date, not null) - Ödeme tarihi
  - [ ] `payment_method` (text, nullable) - Ödeme yöntemi (Nakit, Banka Transferi, vb.)
  - [ ] `receipt_number` (text, nullable) - Makbuz/Dekont numarası
  - [ ] `notes` (text, nullable) - Notlar
  - [ ] `created_by` (uuid, foreign key -> users)
  - [ ] `company_id` (uuid, foreign key -> companies)
  - [ ] `created_at` (timestamp with time zone)
  - [ ] `updated_at` (timestamp with time zone)

- [ ] Indexes:
  - [ ] `idx_informal_payments_company_id` on company_id
  - [ ] `idx_informal_payments_project_id` on project_id
  - [ ] `idx_informal_payments_subcontractor_id` on subcontractor_id
  - [ ] `idx_informal_payments_payment_date` on payment_date

- [ ] RLS Policies:
  - [ ] Enable RLS
  - [ ] SELECT: Company users can view own company payments
  - [ ] INSERT: Authenticated users can create payments
  - [ ] UPDATE: Authenticated users can update own company payments
  - [ ] DELETE: Authenticated users can delete own company payments

### 1.3 Migration'ları Yerel Supabase'de Test Et
- [ ] Local migration çalıştır
- [ ] RLS policies test et
- [ ] Foreign key ilişkilerini doğrula

---

## 📋 FAZA 2: TYPESCRIPT TİPLERİ VE İNTERFACELER

### 2.1 Types Tanımları (types/index.ts)
- [ ] `Subcontractor` interface ekle
  ```typescript
  export interface Subcontractor {
    id: string;
    company_id: string;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    tax_number?: string;
    address?: string;
    notes?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }
  ```

- [ ] `InformalPayment` interface ekle
  ```typescript
  export interface InformalPayment {
    id: string;
    project_id?: string;
    subcontractor_id: string;
    amount: number;
    description: string;
    payment_date: string;
    payment_method?: string;
    receipt_number?: string;
    notes?: string;
    created_by: string;
    company_id: string;
    created_at: string;
    updated_at: string;
    // Relations
    subcontractor?: Subcontractor;
    project?: Project;
    user?: User;
  }
  ```

- [ ] `PaymentMethod` enum ekle (opsiyonel)

---

## 📋 FAZA 3: SUPABASE HELPER FONKSIYONLARI

### 3.1 Taşeron Fonksiyonları (lib/supabase/subcontractors.ts)
- [ ] Dosya oluştur: `lib/supabase/subcontractors.ts`
- [ ] `getSubcontractors()` - Tüm aktif taşeronları getir
- [ ] `getSubcontractorById(id)` - ID ile taşeron getir
- [ ] `createSubcontractor(data)` - Yeni taşeron ekle
- [ ] `updateSubcontractor(id, data)` - Taşeron güncelle
- [ ] `deleteSubcontractor(id)` - Taşeron sil (soft delete: is_active = false)
- [ ] `searchSubcontractors(query)` - İsim ile arama

### 3.2 Gayri Resmi Ödemeler Fonksiyonları (lib/supabase/informal-payments.ts)
- [ ] Dosya oluştur: `lib/supabase/informal-payments.ts`
- [ ] `getInformalPayments(filters?)` - Tüm ödemeleri getir (filtreleme ile)
- [ ] `getInformalPaymentById(id)` - ID ile ödeme getir
- [ ] `getInformalPaymentsByProject(projectId)` - Projeye göre ödemeler
- [ ] `getInformalPaymentsBySubcontractor(subcontractorId)` - Taşerona göre ödemeler
- [ ] `createInformalPayment(data)` - Yeni ödeme ekle
- [ ] `updateInformalPayment(id, data)` - Ödeme güncelle
- [ ] `deleteInformalPayment(id)` - Ödeme sil
- [ ] `getTotalPaymentsBySubcontractor(subcontractorId)` - Taşeron bazlı toplam
- [ ] `getTotalPaymentsByProject(projectId)` - Proje bazlı toplam

---

## 📋 FAZA 4: SIDEBAR GÜNCELLEMESİ

### 4.1 Sidebar'a Yeni Menü Ekle (components/layout/Sidebar.tsx)
- [ ] "Gayri Resmi Ödemeler" menüsü ekle
  - [ ] Icon: Wallet veya CreditCard
  - [ ] Route: `/informal-payments`
  - [ ] Permission check: Authenticated users

- [ ] "Taşeron Listesi" menüsü ekle
  - [ ] Icon: Users veya Building2
  - [ ] Route: `/subcontractors`
  - [ ] Permission check: Authenticated users

- [ ] Menü sırasını ayarla (Faturalardan sonra)

---

## 📋 FAZA 5: TAŞERON LİSTESİ SAYFASI

### 5.1 Taşeron Listesi Sayfası (app/subcontractors/page.tsx)
- [ ] Dosya oluştur: `app/subcontractors/page.tsx`
- [ ] Sayfa yapısı:
  - [ ] Başlık: "Taşeron Listesi"
  - [ ] "Yeni Taşeron Ekle" butonu
  - [ ] Arama kutusu (isim, telefon, email)
  - [ ] Taşeron tablosu/kartları
  - [ ] Düzenle/Sil butonları

- [ ] Tablo kolonları:
  - [ ] Taşeron Adı
  - [ ] İletişim Kişisi
  - [ ] Telefon
  - [ ] E-posta
  - [ ] Vergi No
  - [ ] Durum (Aktif/Pasif)
  - [ ] İşlemler (Düzenle, Sil)

- [ ] Modal/Form:
  - [ ] Taşeron ekleme formu
  - [ ] Taşeron düzenleme formu
  - [ ] Form validasyonu
  - [ ] Success/Error mesajları

- [ ] State yönetimi:
  - [ ] Loading state
  - [ ] Error handling
  - [ ] Search state
  - [ ] Modal state (add/edit)

### 5.2 Taşeron Form Komponenti (opsiyonel ayrı component)
- [ ] `components/subcontractors/SubcontractorForm.tsx` (opsiyonel)
- [ ] Form fields ve validation
- [ ] Submit handler

---

## 📋 FAZA 6: GAYRİ RESMİ ÖDEMELER SAYFASI

### 6.1 Ödemeler Listesi Sayfası (app/informal-payments/page.tsx)
- [ ] Dosya oluştur: `app/informal-payments/page.tsx`
- [ ] Faturalar sayfasından kopyala ve modifiye et
- [ ] Sayfa yapısı:
  - [ ] Başlık: "Gayri Resmi Ödemeler"
  - [ ] "Yeni Ödeme Ekle" butonu
  - [ ] Filtreler:
    - [ ] Tarih aralığı
    - [ ] Taşeron seçimi (dropdown)
    - [ ] Proje seçimi (dropdown, opsiyonel)
    - [ ] Ödeme yöntemi
  - [ ] Ödemeler tablosu
  - [ ] Toplam tutar gösterimi

- [ ] Tablo kolonları:
  - [ ] Ödeme Tarihi
  - [ ] Taşeron Adı
  - [ ] Proje Adı (varsa)
  - [ ] Açıklama
  - [ ] Tutar
  - [ ] Ödeme Yöntemi
  - [ ] Makbuz No
  - [ ] İşlemler (Düzenle, Sil)

### 6.2 Ödeme Ekleme/Düzenleme Formu
- [ ] Modal yapısı (faturalar benzeri)
- [ ] Form alanları:
  - [ ] **Taşeron Seçimi (Dropdown)** - subcontractors'dan doldur
  - [ ] Proje Seçimi (Dropdown, opsiyonel)
  - [ ] Ödeme Tarihi (Date picker)
  - [ ] Tutar (Number input)
  - [ ] Açıklama (Textarea)
  - [ ] Ödeme Yöntemi (Dropdown: Nakit, Banka Transferi, Çek, vb.)
  - [ ] Makbuz/Dekont No (Text input)
  - [ ] Notlar (Textarea, opsiyonel)

- [ ] Form validasyonu:
  - [ ] Taşeron seçimi zorunlu
  - [ ] Tutar zorunlu ve pozitif
  - [ ] Açıklama zorunlu
  - [ ] Ödeme tarihi zorunlu

- [ ] Submit handler:
  - [ ] Create/Update işlemi
  - [ ] Success/Error mesajları
  - [ ] Form reset
  - [ ] Liste refresh

### 6.3 Ödeme İstatistikleri (Opsiyonel)
- [ ] Toplam ödeme tutarı
- [ ] Taşeron bazlı toplam
- [ ] Aylık/Yıllık istatistikler
- [ ] Grafikler (opsiyonel)

---

## 📋 FAZA 7: PROJE DETAY SAYFASINA ENTEGRASYON

### 7.1 Proje Özetine Gayri Resmi Ödemeler Ekle
- [ ] `app/projects/[id]/page.tsx` güncelle
- [ ] "Son Gayri Resmi Ödemeler" bölümü ekle
- [ ] Son 5 ödemeyi göster
- [ ] Toplam gayri resmi ödeme tutarı
- [ ] "Tümünü Gör" linki

---

## 📋 FAZA 8: PERMİSSIONS VE GÜVENLİK

### 8.1 Permission Kontrolleri
- [ ] Sadece authenticated kullanıcılar erişebilsin
- [ ] Company-scoped veri görüntüleme
- [ ] Create/Update/Delete için yetki kontrolü

### 8.2 RLS Politikalarını Doğrula
- [ ] Subcontractors RLS test
- [ ] Informal_payments RLS test
- [ ] Cross-company veri sızıntısı kontrolü

---

## 📋 FAZA 9: UI/UX İYİLEŞTİRMELERİ

### 9.1 Responsive Tasarım
- [ ] Mobile responsive kontrol (subcontractors)
- [ ] Mobile responsive kontrol (informal-payments)
- [ ] Tablet görünüm optimizasyonu

### 9.2 Loading States ve Error Handling
- [ ] Skeleton loaders
- [ ] Error boundary
- [ ] Empty state görselleri
- [ ] Success toast mesajları
- [ ] Error toast mesajları

---

## 📋 FAZA 10: TEST VE VALİDASYON

### 10.1 Fonksiyonel Testler
- [ ] Taşeron ekleme/düzenleme/silme test
- [ ] Ödeme ekleme/düzenleme/silme test
- [ ] Dropdown'ların doğru veri gösterimi
- [ ] Filtreleme çalışıyor mu?
- [ ] Arama çalışıyor mu?
- [ ] Form validasyonları çalışıyor mu?

### 10.2 Veri Bütünlüğü Testleri
- [ ] Foreign key ilişkileri
- [ ] Cascade delete davranışı
- [ ] RLS policies çalışıyor mu?
- [ ] Company isolation doğru mu?

### 10.3 Edge Cases
- [ ] Taşeron silindiğinde ödemeler ne olur?
- [ ] Boş liste durumu
- [ ] Çok sayıda kayıt performansı
- [ ] Duplicate taşeron kontrolü (varsa)

---

## 📋 FAZA 11: DEPLOYMENT HAZIRLIĞI

### 11.1 Code Quality
- [ ] ESLint hataları yok mu?
- [ ] TypeScript hataları yok mu?
- [ ] Console.log'lar temizlendi mi?
- [ ] Unused imports temizlendi mi?

### 11.2 Migration Dosyaları Hazırlığı
- [ ] Migration dosyaları production-ready
- [ ] Rollback planı hazır mı?
- [ ] Production Supabase için notlar eklendi mi?

### 11.3 Environment Variables
- [ ] Yeni env variable gerekiyor mu? (Yok)
- [ ] Mevcut env'ler yeterli mi? (Evet)

---

## 📋 FAZA 12: GIT VE DEPLOYMENT

### 12.1 Git İşlemleri
- [ ] Tüm değişiklikler commit edildi mi?
- [ ] Commit mesajları açıklayıcı mı?
- [ ] Branch temiz mi?

### 12.2 Production Deployment
- [ ] Production Supabase'de migration çalıştır:
  - [ ] `20251210_create_subcontractors.sql`
  - [ ] `20251210_create_informal_payments.sql`
- [ ] Git push to main
- [ ] Vercel otomatik deploy bekle
- [ ] Production'da test et

### 12.3 Post-Deployment Kontrol
- [ ] Sayfalar açılıyor mu?
- [ ] Veri ekleme/düzenleme çalışıyor mu?
- [ ] RLS policies çalışıyor mu?
- [ ] Error tracking kontrol

---

## 📝 NOTLAR

### Teknik Kararlar:
- **Taşeron silme:** Soft delete (is_active = false) kullanılacak
- **Ödeme yöntemi:** Enum yerine text olarak saklanacak (esneklik için)
- **Proje ilişkisi:** Nullable (projesiz ödemeler olabilir)
- **Form yapısı:** Faturalar benzeri modal form
- **Tablo yapısı:** Faturalar benzeri responsive tablo

### Veri İlişkileri:
```
companies (1) ─── (N) subcontractors
subcontractors (1) ─── (N) informal_payments
projects (1) ─── (N) informal_payments [opsiyonel]
users (1) ─── (N) informal_payments [created_by]
```

### Öncelikler:
1. **Yüksek:** Database + Types + Supabase Helpers
2. **Yüksek:** Taşeron Listesi Sayfası (temel CRUD)
3. **Yüksek:** Gayri Resmi Ödemeler Sayfası (form + liste)
4. **Orta:** Sidebar menü ekleme
5. **Orta:** Proje detay entegrasyonu
6. **Düşük:** İstatistikler ve grafikler

---

## ✅ TAMAMLANAN ADIMLAR

### FAZA 1: VERİTABANI TASARIMI VE OLUŞTURMA
- [x] **1.1 Taşeron Tablosu** - Migration dosyası oluşturuldu (`20251210_create_subcontractors.sql`)
  - [x] Tüm kolonlar tanımlandı (id, company_id, name, contact_person, phone, email, tax_number, address, notes, is_active, timestamps)
  - [x] Indexes oluşturuldu (company_id, name, is_active)
  - [x] RLS policies eklendi (SELECT, INSERT, UPDATE, DELETE)
  - [x] Update trigger eklendi (updated_at)

- [x] **1.2 Gayri Resmi Ödemeler Tablosu** - Migration dosyası oluşturuldu (`20251210_create_informal_payments.sql`)
  - [x] Tüm kolonlar tanımlandı (id, project_id, subcontractor_id, amount, description, payment_date, payment_method, receipt_number, notes, created_by, company_id, timestamps)
  - [x] Indexes oluşturuldu (company_id, project_id, subcontractor_id, payment_date, created_by)
  - [x] RLS policies eklendi (SELECT, INSERT, UPDATE, DELETE)
  - [x] Update trigger eklendi (updated_at)
  - [x] Foreign key constraints eklendi (RESTRICT on subcontractor delete)

- [ ] **1.3 Migration'ları Yerel Supabase'de Test Et** - BEKLİYOR

### FAZA 2: TYPESCRIPT TİPLERİ VE İNTERFACELER
- [x] **2.1 Types Tanımları** - `types/index.ts` güncellendi
  - [x] Subcontractor interface eklendi
  - [x] InformalPayment interface eklendi (relations ile birlikte)

### FAZA 3: SUPABASE HELPER FONKSIYONLARI
- [x] **3.1 Taşeron Fonksiyonları** - `lib/supabase/subcontractors.ts` oluşturuldu
  - [x] getSubcontractors() - Aktif taşeronları listele
  - [x] getSubcontractorById(id) - Tek taşeron getir
  - [x] createSubcontractor(data) - Yeni taşeron ekle
  - [x] updateSubcontractor(id, data) - Taşeron güncelle
  - [x] deleteSubcontractor(id) - Soft delete
  - [x] hardDeleteSubcontractor(id) - Hard delete
  - [x] searchSubcontractors(query) - İsim/telefon/email ile arama
  - [x] getAllSubcontractors() - Tüm taşeronlar (inactive dahil)
  - [x] reactivateSubcontractor(id) - Soft deleted taşeronu aktif et

- [x] **3.2 Gayri Resmi Ödemeler Fonksiyonları** - `lib/supabase/informal-payments.ts` oluşturuldu
  - [x] getInformalPayments(filters?) - Tüm ödemeler (filtreleme ile)
  - [x] getInformalPaymentById(id) - Tek ödeme getir
  - [x] getInformalPaymentsByProject(projectId) - Projeye göre
  - [x] getInformalPaymentsBySubcontractor(subcontractorId) - Taşerona göre
  - [x] createInformalPayment(data) - Yeni ödeme ekle
  - [x] updateInformalPayment(id, data) - Ödeme güncelle
  - [x] deleteInformalPayment(id) - Ödeme sil
  - [x] getTotalPaymentsBySubcontractor(subcontractorId) - Taşeron bazlı toplam
  - [x] getTotalPaymentsByProject(projectId) - Proje bazlı toplam
  - [x] getPaymentStatsBySubcontractor() - İstatistikler
  - [x] getPaymentStatsByMethod() - Ödeme yöntemine göre istatistikler
  - [x] getRecentInformalPayments(limit) - Son ödemeler

### FAZA 4: SIDEBAR GÜNCELLEMESİ
- [x] **4.1 Sidebar'a Yeni Menü** - `components/layout/Sidebar.tsx` güncellendi
  - [x] "Gayri Resmi Ödemeler" menüsü eklendi (WalletIcon ile)
  - [x] "Taşeron Listesi" menüsü eklendi (BuildingIcon ile)
  - [x] Icon bileşenleri oluşturuldu
  - [x] Menü sıralaması ayarlandı (Faturalardan sonra)

### FAZA 5: TAŞERON LİSTESİ SAYFASI
- [x] **5.1 Taşeron Listesi Sayfası** - `app/subcontractors/page.tsx` oluşturuldu
  - [x] Sayfa yapısı (başlık, yeni ekle butonu, arama, tablo)
  - [x] Tablo kolonları (isim, iletişim, telefon, email, vergi no, işlemler)
  - [x] Modal/Form (ekleme ve düzenleme)
  - [x] Form validasyonu
  - [x] Success/Error mesajları (react-hot-toast)
  - [x] State yönetimi (loading, error, search, modal)
  - [x] CRUD işlemleri (ekle, düzenle, sil)
  - [x] Arama fonksiyonu
  - [x] Empty state tasarımı

### FAZA 6: GAYRİ RESMİ ÖDEMELER SAYFASI
- [x] **6.1 Ödemeler Listesi Sayfası** - `app/informal-payments/page.tsx` oluşturuldu
  - [x] Sayfa yapısı (başlık, toplam tutar, yeni ekle butonu)
  - [x] Filtreler (taşeron, proje, tarih aralığı, ödeme yöntemi)
  - [x] Tablo kolonları (tarih, taşeron, proje, açıklama, tutar, ödeme yöntemi, makbuz no, işlemler)
  - [x] Toplam tutar gösterimi
  - [x] Empty state tasarımı

- [x] **6.2 Ödeme Ekleme/Düzenleme Formu**
  - [x] Modal yapısı
  - [x] Form alanları:
    - [x] Taşeron Seçimi (Dropdown - subcontractors'dan)
    - [x] Proje Seçimi (Dropdown - opsiyonel)
    - [x] Ödeme Tarihi (Date picker)
    - [x] Tutar (Number input)
    - [x] Açıklama (Textarea)
    - [x] Ödeme Yöntemi (Dropdown: Nakit, Banka Transferi, Çek, Senet)
    - [x] Makbuz/Dekont No (Text input)
    - [x] Notlar (Textarea)
  - [x] Form validasyonu (taşeron, tutar, açıklama zorunlu)
  - [x] Submit handler (create/update)
  - [x] Success/Error mesajları

### FAZA 7-9: DİĞER İYİLEŞTİRMELER
- [ ] **7.1 Proje Detay Entegrasyonu** - BEKLİYOR (opsiyonel)
- [x] **8.1 Permission Kontrolleri** - Mevcut auth sistem kullanıldı
- [ ] **9.1 Responsive Tasarım** - BEKLİYOR (test edilecek)

### KODLAMA AŞAMASI TAMAMLANDI ✅
**Toplam Oluşturulan Dosyalar:**
1. `supabase/migrations/20251210_create_subcontractors.sql`
2. `supabase/migrations/20251210_create_informal_payments.sql`
3. `lib/supabase/subcontractors.ts`
4. `lib/supabase/informal-payments.ts`
5. `app/subcontractors/page.tsx`
6. `app/informal-payments/page.tsx`
7. `types/index.ts` (güncellendi)
8. `components/layout/Sidebar.tsx` (güncellendi)

---

**Son Güncelleme:** 10 Aralık 2025  
**Geliştirici Notu:** Her adım tamamlandıkça [ ] işareti [x] olacak. Yarım kalırsa bu dosyadan devam edilebilir.

---

## 🎉 LOCAL GELİŞTİRME TAMAMLANDI

### ✅ Yapılan İşlemler:
1. ✅ Veritabanı migration dosyaları oluşturuldu
2. ✅ TypeScript type'ları tanımlandı
3. ✅ Supabase helper fonksiyonları yazıldı
4. ✅ Sidebar menüleri eklendi
5. ✅ Taşeron Listesi sayfası oluşturuldu
6. ✅ Gayri Resmi Ödemeler sayfası oluşturuldu
7. ✅ TypeScript hataları giderildi
8. ✅ Development server çalıştırıldı ve test edildi

### 📦 Oluşturulan Dosyalar:
- `supabase/migrations/20251210_create_subcontractors.sql`
- `supabase/migrations/20251210_create_informal_payments.sql`
- `lib/supabase/subcontractors.ts`
- `lib/supabase/informal-payments.ts`
- `app/subcontractors/page.tsx`
- `app/informal-payments/page.tsx`
- `types/index.ts` (güncellendi)
- `components/layout/Sidebar.tsx` (güncellendi)

### ⏭️ SONRAKI ADIMLAR (Deployment):

#### 1️⃣ Local Supabase Migration Test
```bash
# Supabase CLI ile local test (opsiyonel)
# Supabase Studio'da manuel olarak çalıştırılabilir
```

#### 2️⃣ Git Commit ve Push
```bash
cd "d:\islerim\Luce Mimarlık\web_site\luce_web"
git add .
git commit -m "feat: Add informal payments and subcontractors management

- Add subcontractors table with RLS policies
- Add informal_payments table with foreign keys
- Create Subcontractor and InformalPayment types
- Add helper functions for CRUD operations
- Create subcontractors management page
- Create informal payments management page
- Add new sidebar menu items
- Update TypeScript types"

git push origin main
```

#### 3️⃣ Production Supabase Migration
**Supabase Dashboard → SQL Editor → New Query:**

1. Önce taşeron tablosunu oluştur:
```sql
-- supabase/migrations/20251210_create_subcontractors.sql dosyasının içeriğini kopyala yapıştır
```

2. Sonra gayri resmi ödemeler tablosunu oluştur:
```sql
-- supabase/migrations/20251210_create_informal_payments.sql dosyasının içeriğini kopyala yapıştır
```

3. Tabloları ve RLS'i doğrula:
```sql
-- Tabloları kontrol et
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('subcontractors', 'informal_payments');

-- RLS politikalarını kontrol et
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('subcontractors', 'informal_payments');
```

#### 4️⃣ Vercel Auto Deploy
- GitHub'a push yaptıktan sonra Vercel otomatik deploy edecek
- Deploy tamamlandığında production'da test et

#### 5️⃣ Production Test Checklist
- [ ] Taşeron Listesi sayfası açılıyor mu?
- [ ] Yeni taşeron eklenebiliyor mu?
- [ ] Taşeron düzenlenebiliyor mu?
- [ ] Taşeron silinebiliyor mu? (soft delete)
- [ ] Arama çalışıyor mu?
- [ ] Gayri Resmi Ödemeler sayfası açılıyor mu?
- [ ] Yeni ödeme eklenebiliyor mu?
- [ ] Taşeron dropdown'u dolduruluyor mu?
- [ ] Proje dropdown'u dolduruluyor mu?
- [ ] Filtreler çalışıyor mu?
- [ ] Ödeme düzenlenebiliyor mu?
- [ ] Ödeme silinebiliyor mu?
- [ ] Toplam tutar doğru hesaplanıyor mu?
- [ ] RLS policies çalışıyor mu? (farklı şirket verileri görülmemeli)

---

**🚀 SİSTEM HAZIR! Deployment için yukarıdaki adımları takip edin.**

---
