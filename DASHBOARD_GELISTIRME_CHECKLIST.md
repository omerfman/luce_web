# 📊 DASHBOARD GELİŞTİRME CHECKLIST

## 🎯 Proje Analizi ve Planlama

### Sistem Yapısı Analizi ✅
- [x] Mevcut dashboard sayfası incelendi
- [x] Database tabloları analiz edildi:
  - `projects` - Proje bilgileri ve durumları
  - `invoices` - Fatura kayıtları (amount, vat_amount, withholding_amount)
  - `invoice_project_links` - Fatura-proje ilişkileri (many-to-many)
  - `informal_payments` - Gayri resmi ödemeler
  - `suppliers` - Tedarikçi bilgileri
  - `users` - Kullanıcı bilgileri
  - `activity_logs` - Sistem aktiviteleri
- [x] Mevcut API endpoint'leri incelendi
- [x] Type definitions kontrol edildi

### Dashboard Bileşenleri Tasarımı ✅
Modern bir dashboard şunları içermelidir:
- [ ] **Genel İstatistikler (Overview Cards)**
  - Toplam proje sayısı (aktif/tamamlanan/askıda)
  - Toplam fatura sayısı ve tutarı
  - Toplam gayri resmi ödeme tutarı
  - Bu ay toplam harcama
  - Bekleyen işlemler
  
- [ ] **Finansal Özet (Financial Summary)**
  - Toplam harcama (Grand Total)
  - Aylık harcama trendi (Chart)
  - Fatura vs Gayri Resmi ödeme karşılaştırması
  - KDV ve tevkifat toplamları
  
- [ ] **Proje Durumları (Project Status)**
  - Proje durumu dağılımı (Pie/Donut Chart)
  - Son eklenen projeler listesi
  - En yüksek harcamalı projeler
  
- [ ] **Son Aktiviteler (Recent Activities)**
  - Son yüklenen faturalar
  - Son eklenen ödemeler
  - Son sistem aktiviteleri
  
- [ ] **Tedarikçi İstatistikleri (Supplier Statistics)**
  - Toplam tedarikçi sayısı
  - En çok işlem yapılan tedarikçiler
  - Taşeron/Fatura firması dağılımı
  
- [ ] **Hızlı İşlemler (Quick Actions)**
  - Yeni fatura ekle
  - Yeni proje ekle
  - Yeni ödeme ekle
  - Raporları görüntüle

## 🔨 Implementasyon Adımları

### 1. API Endpoint Geliştirme
- [ ] `/api/dashboard/stats` endpoint'i oluştur
  - Genel istatistikleri getir
  - Finansal özeti hesapla
  - Proje durumlarını topla
- [ ] `/api/dashboard/recent` endpoint'i oluştur
  - Son faturalar (limit: 5)
  - Son ödemeler (limit: 5)
  - Son aktiviteler (limit: 10)
- [ ] `/api/dashboard/charts` endpoint'i oluştur
  - Aylık harcama verileri (son 6 ay)
  - Proje dağılımı
  - Tedarikçi istatistikleri

### 2. Type Definitions
- [ ] `DashboardStats` interface oluştur
- [ ] `DashboardChartData` interface oluştur
- [ ] `RecentActivity` interface oluştur

### 3. UI Components
- [ ] `StatCard` component - İstatistik kartları için
- [ ] `ChartCard` component - Grafik kartları için
- [ ] `RecentActivityCard` component - Son aktiviteler için
- [ ] `QuickActionButton` component - Hızlı işlem butonları için

### 4. Dashboard Page Güncelleme
- [ ] Layout düzenlemesi (Grid system)
- [ ] API çağrıları implementasyonu
- [ ] Loading states
- [ ] Error handling
- [ ] Responsive design
- [ ] Dark mode desteği (opsiyonel)

### 5. Grafik Kütüphanesi Entegrasyonu
- [ ] Recharts kütüphanesi kurulumu (tercih edilen)
- [ ] Line Chart - Aylık harcama trendi
- [ ] Pie Chart - Proje durumları
- [ ] Bar Chart - En yüksek harcamalı projeler

### 6. Test ve Optimizasyon
- [ ] API response sürelerini kontrol et
- [ ] Component performansını optimize et
- [ ] Mobile responsive test
- [ ] Cross-browser test
- [ ] Loading performance test

### 7. Build ve Deployment
- [ ] Local build testi
- [ ] TypeScript hata kontrolü
- [ ] ESLint uyarılarını düzelt
- [ ] Git commit ve push
- [ ] Vercel deployment kontrolü

## 📋 Teknik Gereksinimler

### Veri Toplama Stratejisi
```typescript
// Dashboard istatistikleri için gerekli sorgular:

// 1. Proje İstatistikleri
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'active') as active,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold
FROM projects 
WHERE company_id = ?

// 2. Finansal İstatistikler
SELECT 
  COUNT(*) as invoice_count,
  COALESCE(SUM(amount), 0) as total_amount,
  COALESCE(SUM(vat_amount), 0) as total_vat,
  COALESCE(SUM(withholding_amount), 0) as total_withholding
FROM invoices 
WHERE company_id = ?

// 3. Gayri Resmi Ödemeler
SELECT 
  COUNT(*) as payment_count,
  COALESCE(SUM(amount), 0) as total_amount
FROM informal_payments 
WHERE company_id = ?

// 4. Aylık Harcama (Son 6 Ay)
SELECT 
  DATE_TRUNC('month', invoice_date) as month,
  SUM(amount) as total
FROM invoices 
WHERE company_id = ? 
  AND invoice_date >= NOW() - INTERVAL '6 months'
GROUP BY month
ORDER BY month

// 5. Tedarikçi İstatistikleri
SELECT 
  COUNT(DISTINCT id) as total_suppliers,
  COUNT(*) FILTER (WHERE supplier_type = 'subcontractor') as subcontractors,
  COUNT(*) FILTER (WHERE supplier_type = 'invoice_company') as invoice_companies
FROM suppliers 
WHERE company_id = ?
```

### Performance Optimizasyonu
- [ ] API çağrılarını parallel yapma (Promise.all)
- [ ] Gereksiz re-render'ları önleme (React.memo)
- [ ] Büyük veri setleri için pagination
- [ ] Cache stratejisi (SWR veya React Query)

## 🎨 UI/UX Tasarım Prensipleri

### Renk Kodları
- **Primary (Mavi)**: `#2563eb` - Faturalar, önemli metrikler
- **Success (Yeşil)**: `#10b981` - Pozitif değerler, tamamlanan işlemler
- **Warning (Turuncu)**: `#f59e0b` - Bekleyen işlemler, uyarılar
- **Error (Kırmızı)**: `#ef4444` - Gayri resmi ödemeler, hata durumları
- **Secondary (Gri)**: `#6b7280` - İkincil bilgiler

### Grid Layout
```
[Ana Kullanıcı Kartı - Full Width]

[Stat Card] [Stat Card] [Stat Card] [Stat Card]

[Finansal Chart - 2/3] [Proje Durumları - 1/3]

[Son Aktiviteler - 1/2] [En Yüksek Projeler - 1/2]

[Hızlı İşlemler - Full Width]
```

## ✅ Tamamlanma Kriterleri

Dashboard başarılı sayılabilir için:
- [x] Tüm istatistikler doğru hesaplanmalı
- [ ] Gerçek zamanlı veri görüntülenmeli
- [ ] Responsive tasarım sorunsuz çalışmalı
- [ ] Loading durumları kullanıcı dostu olmalı
- [ ] Hata durumları düzgün handle edilmeli
- [ ] Build sırasında hata alınmamalı
- [ ] Vercel'de sorunsuz deploy olmalı

## 🚀 Bonus Özellikler (Opsiyonel)

- [ ] Grafiklerde interaktivite (hover, click)
- [ ] Tarih aralığı filtresi
- [ ] Excel/PDF export özelliği
- [ ] Real-time updates (Supabase subscriptions)
- [ ] Dark mode toggle
- [ ] Widget sıralama (drag & drop)
- [ ] Karşılaştırmalı analiz (geçen ay vs bu ay)
- [ ] Bildirim sistemi entegrasyonu

---

**Başlangıç Tarihi**: 23 Ocak 2026
**Hedef Tamamlanma**: 23 Ocak 2026
**Durum**: 🟡 Devam Ediyor
