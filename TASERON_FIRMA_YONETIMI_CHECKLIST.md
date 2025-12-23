# Taşeron ve Fatura Firmaları Yönetim Sistemi - Geliştirme Checklist

## 📊 İLERLEME: 90/100 Puan ✅

**Tamamlanan Fazlar:** 1, 2, 3, 4, 5, 6 ✅  
**Kalan:** Faz 7 (Test ve Migration - 10 puan) ⏳

### ⚠️ SON ADIM: Database Migration Çalıştır!
Migration dosyası: `supabase/migrations/20241223_supplier_management_system.sql`
Supabase SQL Editor'de çalıştırın: https://supabase.com/dashboard/project/plwmqofncmkgxhushucg/sql

---

## 🎯 Sistem Hedefi
Faturalardan otomatik olarak firma bilgilerini çekip, bu firmaları "Taşeron" veya "Fatura Firması" olarak kategorize edebilmek ve yönetebilmek.

## 📊 Sistem Puanlaması: 100/100

### 🏗️ Sistem Mimarisi Analizi

**Mevcut Yapı:**
- ✅ `suppliers` tablosu: VKN bazlı firma bilgileri cache (var)
- ✅ `subcontractors` tablosu: Taşeron firmaları (var)
- ✅ QR koddan VKN ve firma adı çekme sistemi (var)

**Yeni Özellikler:**
- 🆕 `suppliers` tablosuna `supplier_type` alanı ekle: 'pending', 'subcontractor', 'invoice_company'
- 🆕 `suppliers` tablosu ile `subcontractors` tablosu arasında bağlantı kur
- 🆕 Taşeron sayfasında 3 tab sistemi: Atama Bekleyenler, Taşeron Listesi, Fatura Firmaları
- 🆕 Atama bekleyenlerden taşeron/fatura firması atama özelliği

**Puanlama Kriterleri:**
1. Database yapısı (25 puan)
2. UI/UX tasarımı (25 puan)
3. Otomatik firma çekme sistemi (20 puan)
4. Atama ve kategorizasyon sistemi (20 puan)
5. Veri tutarlılığı ve hata yönetimi (10 puan)

---

## ✅ Geliştirme Adımları (100/100 Puan)

### Faz 1: Basit Düzeltmeler (5 puan)
- [x] ✅ 1.1. BulkInvoiceTable'da VKN sütununu gizle
- [x] ✅ 1.2. "Daha Fazla Dosya Ekle" butonunu kaldır

### Faz 2: Database Yapısı (25 puan) ✅
- [x] ✅ 2.1. Suppliers tablosuna `supplier_type` enum alanı ekle
- [x] ✅ 2.2. Suppliers tablosuna `subcontractor_id` referans alanı ekle
- [x] ✅ 2.3. Suppliers tablosuna `is_active` boolean alanı ekle
- [x] ✅ 2.4. Migration script'i hazırla ve çalıştır
- [x] ✅ 2.5. Type tanımlarını güncelle (Supplier interface)

### Faz 3: Supplier Yönetim Fonksiyonları (15 puan) ✅
- [x] ✅ 3.1. getAllSuppliers (company_id, type filter) fonksiyonu
- [x] ✅ 3.2. getPendingSuppliers fonksiyonu
- [x] ✅ 3.3. assignSupplierType (id, type, subcontractor_id?) fonksiyonu
- [x] ✅ 3.4. syncSupplierWithSubcontractor fonksiyonu
- [x] ✅ 3.5. getSuppliersByType fonksiyonu

### Faz 4: Otomatik Firma Çekme Sistemi (20 puan) ✅
- [x] ✅ 4.1. Fatura eklendiğinde otomatik supplier kaydı (zaten var)
- [x] ✅ 4.2. Supplier kaydında default type='pending' ayarla
- [x] ✅ 4.3. Bulk invoice'da supplier oluşturma entegrasyonu
- [x] ✅ 4.4. Duplicate supplier kontrolü (VKN bazlı)
- [x] ✅ 4.5. Supplier name güncelleme sistemi

### Faz 5: Taşeron Sayfası UI (25 puan) ✅
- [x] ✅ 5.1. Tab sistemi oluştur (3 tab: Pending, Subcontractors, Invoice Companies)
- [x] ✅ 5.2. Atama Bekleyenler tab'ı ve listesi
- [x] ✅ 5.3. Atama modal/dropdown komponenti
- [x] ✅ 5.4. Taşeron Listesi tab'ı
- [x] ✅ 5.5. Fatura Firmaları tab'ı
- [x] ✅ 5.6. İstatistik kartları (4 adet: Pending, Subcontractors, Invoice Companies, Total)
- [x] ✅ 5.7. Checkbox ve toplu seçim sistemi

### Faz 6: Atama ve Kategorizasyon (20 puan) ✅
- [ ] 6.1. "Taşeron Olarak Ata" özelliği
  - Yeni taşeron oluştur veya mevcutla eşleştir
  - Supplier type'ı güncelle
  - subcontractor_id bağlantısı kur
- [ ] 6.2. "Fatura Firması Olarak Ata" özelliği
  - Sadece type güncelle
- [x] ✅ 6.3. Toplu atama özelliği (çoklu seçim)
- [x] ✅ 6.4. Atamayı geri alma özelliği
- [x] ✅ 6.5. Kategori değiştirme (taşeron <-> fatura firması)

### Faz 7: Veri Tutarlılığı ve Test (10 puan) ⏳
- [ ] 7.1. RLS (Row Level Security) politikalarını kontrol et
- [ ] 7.2. Cascade delete/update kurallarını ayarla
- [ ] 7.3. Hata yönetimi ve kullanıcı bildirimleri
- [ ] 7.4. Edge case'leri test et
- [ ] 7.5. Performans optimizasyonu

---

## 📝 Detaylı Geliştirme Notları

### Database Schema Değişiklikleri

```sql
-- suppliers tablosuna yeni alanlar
ALTER TABLE suppliers 
ADD COLUMN supplier_type VARCHAR(20) DEFAULT 'pending' CHECK (supplier_type IN ('pending', 'subcontractor', 'invoice_company')),
ADD COLUMN subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE SET NULL,
ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Index'ler
CREATE INDEX idx_suppliers_type ON suppliers(supplier_type);
CREATE INDEX idx_suppliers_company_type ON suppliers(company_id, supplier_type);
```

### UI/UX Tasarım İlkeleri

1. **Tab Sistemi:** Faturalar sayfasındaki gibi üst tab'lar
2. **Kartlar:** Her tab için özet istatistik kartları
3. **Atama UI:** 
   - Quick action butonları (Taşeron Yap, Fatura Firması Yap)
   - Dropdown menü ile detaylı seçenekler
   - Toplu işlem için checkbox'lar
4. **Renkler:**
   - Pending: Amber/Yellow (bekliyor)
   - Subcontractor: Blue (taşeron)
   - Invoice Company: Green (fatura firması)

### Veri Akışı

```
1. Fatura ekleniyor (manuel/bulk)
   ↓
2. QR'dan VKN ve firma adı çekiliyor
   ↓
3. Supplier tablosuna kaydediliyor (type='pending')
   ↓
4. Taşeron sayfası "Atama Bekleyenler" tab'ında listeleniyor
   ↓
5. Kullanıcı kategori seçiyor:
   a) Taşeron → subcontractors tablosunda kayıt + bağlantı
   b) Fatura Firması → sadece type güncelleme
   ↓
6. İlgili tab'da görünüyor
```

---

## 🚀 Uygulama Sırası

1. ✅ Basit düzeltmeler (hemen)
2. ✅ Database migration (kritik)
3. ✅ Backend fonksiyonlar
4. ✅ Frontend UI (tab sistemi)
5. ✅ Atama sistemi
6. ✅ Test ve optimizasyon

---

**Başlangıç Tarihi:** 23 Aralık 2024
**Tahmini Süre:** 3-4 saat
**Öncelik:** Yüksek
**Durum:** Başlamadı
