# Kasa Fişleri Sistemi - Geliştirme ve İyileştirme Checklist

## 📋 Genel Bakış
Bu döküman, kredi kartı ekstrelerindeki faturalarla eşleşmeyen harcamaların projelere atanması ve "kasa fişi" olarak takip edilmesi sisteminin geliştirilmesi için hazırlanmıştır.

## 🎯 Sistem Amacı
- Harcamaların **kime** ve **hangi proje için** yapıldığını analiz etmek
- Kredi kartı ekstrelerini daha kolay takip etmek
- Faturalarla eşleşmeyen harcamaları kategorize etmek
- Proje bazlı maliyet analizlerini iyileştirmek

---

## ✅ Tamamlanan İşler

### 1. Veritabanı Yapısı
- [x] `card_statement_items` tablosuna `project_id` kolonu eklendi
- [x] Index oluşturuldu (project_id için)
- [x] Migration dosyası hazırlandı ve SQL hatası düzeltildi
- [x] TypeScript type'ları güncellendi (`project_id` ve `projects` alanları)

### 2. API Endpoints
- [x] **PATCH** `/api/card-statements/[id]/items/[itemId]` - Projeye atama
- [x] **GET** `/api/petty-cash` - Kasa fişleri listesi (proje filtresi ile)

### 3. UI Sayfaları
- [x] **Ekstrelerde Projeye Atama**: Dropdown ile proje seçimi
- [x] **Kasa Fişleri Sayfası** (`/petty-cash`): Liste, istatistikler, filtreleme
- [x] **Proje Detay Sayfası**: Kasa fişleri kartı ve toplam tutar
- [x] **Sidebar**: Kasa Fişleri menü öğesi eklendi

---

## 🚀 Yüksek Öncelik İyileştirmeler

### Phase 1: Görsel ve UX İyileştirmeleri

#### 1.1 Ekstrelerde Görsel İyileştirmeler
- [ ] **Kasa Fişi Badge'i**: Projeye atanmış itemlar için "💼 Kasa Fişi" badge'i ekle
  - [ ] Badge'de proje adını göster
  - [ ] Badge rengi: mor/purple (kasa fişini diğerlerinden ayırt etmek için)
  - [ ] Hover'da tam proje adını göster (truncate edilmişse)

- [ ] **Proje Kolonu Görünürlüğü**:
  - [ ] Proje adını daha belirgin göster (bold font)
  - [ ] Projeye atanmış olan satırlara arka plan rengi (açık mor: `bg-purple-50`)
  - [ ] "Projeye atanmadı" yerine "-" veya daha minimal görünüm

- [ ] **Inline Edit İyileştirmesi**:
  - [ ] Dropdown yerine inline edit icon (✏️) ekle
  - [ ] Icon'a tıklayınca dropdown açılsın
  - [ ] Seçim yapılınca otomatik kaydet + toast bildirimi

#### 1.2 Filtreleme ve Sıralama
- [ ] **Yeni Filtreler**:
  - [ ] "Kasa Fişleri" checkbox filtresi (sadece projeye atanmış olanlar)
  - [ ] "Atanmamış Harcamalar" checkbox filtresi (eşleşmemiş ve projeye atanmamış)
  - [ ] Proje seçim dropdown'u (tüm projeler listesi)
  - [ ] Filtreleri URL parametrelerine ekle (bookmark/share için)

- [ ] **Sıralama Seçenekleri**:
  - [ ] Proje adına göre sıralama
  - [ ] Tutara göre sıralama
  - [ ] Tarihe göre sıralama (default: tarih desc)

#### 1.3 Stats Kartlarına İyileştirmeler
- [ ] **Yeni Stats Kartı**: "Kasa Fişleri"
  - [ ] Toplam kasa fişi sayısı
  - [ ] Toplam tutar
  - [ ] Renk: mor/purple
  
- [ ] **Mevcut Kartlara Eklemeler**:
  - [ ] "Eşleşmedi" kartının altına → "X adet projeye atandı" bilgisi
  - [ ] Yüzdelik gösterimi: "Eşleşmemiş harcamaların %Y'si projeye atandı"

### Phase 2: Toplu İşlemler

#### 2.1 Toplu Proje Atama
- [ ] **Checkbox Sistemi**:
  - [ ] Tablo başlığına "Tümünü Seç" checkbox'u
  - [ ] Her satıra checkbox ekle (sadece atama yapılabilir itemlar için)
  - [ ] Seçili item sayısını göster (örn: "5 işlem seçildi")

- [ ] **Toplu Atama UI**:
  - [ ] Seçili itemlar olduğunda "Toplu Atama" butonu göster
  - [ ] Butona tıklayınca proje seçim dropdown'u aç
  - [ ] Proje seçildiğinde tüm seçili itemları ata
  - [ ] Progress bar göster (çok sayıda item varsa)

- [ ] **Akıllı Öneriler**:
  - [ ] Aynı firmaya ait harcamaları grupla
  - [ ] "Bu firmaya ait X harcamayı [Proje A]'ya atamak ister misiniz?" önerisi
  - [ ] Son kullanılan projeler listesi (quick access)

### Phase 3: Kasa Fişleri Sayfası İyileştirmeleri

#### 3.1 Gelişmiş Filtreleme
- [ ] **Tarih Aralığı Seçici**:
  - [ ] Başlangıç - Bitiş tarihi seçimi
  - [ ] Hızlı seçenekler: "Bu Ay", "Bu Yıl", "Son 3 Ay", "Son 6 Ay"
  - [ ] Tarih filtresi aktifken badge göster

- [ ] **Tutar Filtresi**:
  - [ ] Min-Max tutar aralığı
  - [ ] Hızlı seçenekler: "0-1000₺", "1000-5000₺", "5000₺+"

- [ ] **Firma/İşlem Adı Araması**:
  - [ ] Search input (debounced)
  - [ ] Fuzzy search (benzer isimleri bul)

#### 3.2 Sıralama ve Gruplama
- [ ] **Sıralama Seçenekleri**:
  - [ ] Tarihe göre (artan/azalan)
  - [ ] Tutara göre (artan/azalan)
  - [ ] Proje adına göre (A-Z, Z-A)
  - [ ] Firma adına göre (A-Z, Z-A)

- [ ] **Gruplama**:
  - [ ] Proje bazında grupla (accordion)
  - [ ] Ay bazında grupla
  - [ ] Her grubun toplamını göster

#### 3.3 Export ve Raporlama
- [ ] **Excel Export**:
  - [ ] "Excel'e Aktar" butonu
  - [ ] Filtrelenmiş sonuçları export et
  - [ ] Kolonlar: Tarih, İşlem Adı, Proje, Tutar, Ekstre, Notlar

- [ ] **PDF Rapor**:
  - [ ] Proje bazlı özet rapor
  - [ ] Aylık breakdown
  - [ ] Grafikler ekle

#### 3.4 Özet İstatistikler
- [ ] **Proje Bazlı Özet**:
  - [ ] Her proje için toplam kasa fişi sayısı ve tutar
  - [ ] Pasta grafik (proje dağılımı)
  - [ ] Bar chart (aylık trend)

- [ ] **Top Harcamalar**:
  - [ ] En yüksek 10 harcama
  - [ ] En çok harcama yapılan firmalar

### Phase 4: Proje Detay Sayfası İyileştirmeleri

#### 4.1 Kasa Fişleri Bölümü
- [ ] **Genişletilmiş Liste**:
  - [ ] Son 10 → Tüm kasa fişlerini göster (paginated)
  - [ ] Inline tablo (tarih, işlem adı, tutar)
  - [ ] "Tümünü Görüntüle" butonu (kasa fişleri sayfasına filtreli link)

- [ ] **Hızlı İstatistikler**:
  - [ ] Bu ay eklenen kasa fişi sayısı
  - [ ] Bu ay toplam tutar
  - [ ] Trend: geçen aya göre artış/azalış

#### 4.2 Grafik ve Analizler
- [ ] **Aylık Kasa Fişi Grafiği**:
  - [ ] Son 12 ay trend grafiği
  - [ ] Bar chart veya line chart
  - [ ] Hover'da detaylar

- [ ] **Kategori Breakdown** (gelecek için):
  - [ ] Kategori sistemi eklendiğinde
  - [ ] Kasa fişlerini kategorilere göre grupla

---

## 🎨 Orta Öncelik İyileştirmeler

### Phase 5: Kullanıcı Deneyimi İyileştirmeleri

#### 5.1 Toast Bildirimleri
- [ ] Başarılı atama: "✅ Kasa fişi [Proje A]'ya atandı"
- [ ] Hata durumu: "❌ Atama başarısız: [hata mesajı]"
- [ ] Toplu atama: "✅ 5 kasa fişi [Proje A]'ya atandı"
- [ ] Atama kaldırma: "ℹ️ Proje ataması kaldırıldı"

#### 5.2 Loading States
- [ ] Skeleton loader (ilk yüklemede)
- [ ] Inline spinner (proje değiştirirken)
- [ ] Disable state (işlem sırasında dropdown/button'lar)
- [ ] Progress bar (toplu atama sırasında)

#### 5.3 Empty States
- [ ] **Ekstrelerde**: "Henüz kasa fişi yok"
  - [ ] İkon + açıklama
  - [ ] "Eşleşmeyen harcamaları projelere atayın" mesajı
  
- [ ] **Kasa Fişleri Sayfası**: "Henüz kasa fişi oluşturulmadı"
  - [ ] "Ekstrelere Git" butonu
  - [ ] Nasıl kullanılır açıklaması

- [ ] **Proje Detay**: "Bu projede kasa fişi yok"
  - [ ] "Ekstre detaylarından atama yapabilirsiniz" mesajı

#### 5.4 Tooltip'ler ve Yardım
- [ ] "❓ Kasa Fişi Nedir?" tooltip'i (sayfaların üstünde)
- [ ] Açıklama text: "Faturalarla eşleşmeyen ancak projelere atanan harcamalardır"
- [ ] Inline help: Dropdown yanında "ℹ️" icon, hover'da açıklama

#### 5.5 Mobil Uyumluluk
- [ ] Responsive tablo tasarımı
  - [ ] Mobilde kart görünümü
  - [ ] Swipe gesture'lar
  
- [ ] Touch-friendly UI
  - [ ] Büyük touch target'lar (44x44px minimum)
  - [ ] Bottom sheet modal'lar (dropdown yerine)
  
- [ ] Mobil navigasyon
  - [ ] Hamburger menü
  - [ ] Sticky header

### Phase 6: Gelişmiş Özellikler

#### 6.1 Arama ve Filtreleme
- [ ] Global arama (tüm kasa fişlerinde)
- [ ] Arama geçmişi (son aramalar)
- [ ] Kaydedilmiş filtreler ("Favori Filtreler")

#### 6.2 Klavye Kısayolları
- [ ] `j` / `k` - Liste navigasyonu (yukarı/aşağı)
- [ ] `p` - Proje atama modal'ını aç
- [ ] `/` - Arama barına odaklan
- [ ] `Esc` - Modal'ı kapat

#### 6.3 Toplu Düzenleme
- [ ] Seçili itemların notlarını toplu düzenle
- [ ] Seçili itemları toplu sil (soft delete)
- [ ] Undo/Redo fonksiyonu

#### 6.4 Otomatik Atama
- [ ] AI/ML tabanlı proje önerisi
- [ ] Firma adına göre otomatik atama kuralları
- [ ] Kullanıcı tanımlı kurallar ("X firması her zaman [Proje A]'ya atansın")

---

## 🔧 Teknik İyileştirmeler

### Phase 7: Performance ve Optimizasyon

#### 7.1 Database Optimizations
- [ ] Composite index (project_id + transaction_date)
- [ ] Materialized view (kasa fişi istatistikleri için)
- [ ] Query optimization (N+1 problem'i kontrol et)

#### 7.2 Caching
- [ ] Projeler listesini cache'le (React Query)
- [ ] Stats'ları cache'le (5 dakika TTL)
- [ ] Infinite scroll için pagination cache

#### 7.3 Code Quality
- [ ] Shared component'ler oluştur (ProjectSelect, PettyCashBadge vb.)
- [ ] Custom hooks (useProjectAssignment, usePettyCash)
- [ ] Error boundary ekle
- [ ] Unit test'ler yaz

---

## 📱 Kullanıcı Eğitimi ve Dokümantasyon

### Phase 8: Onboarding

#### 8.1 İlk Kullanım Tutorial
- [ ] Walkthrough modal (ilk giriş)
- [ ] Adım adım rehber:
  1. Ekstre yükle
  2. Otomatik eşleştirme
  3. Eşleşmeyen harcamaları projeye ata
  4. Kasa fişlerini görüntüle

#### 8.2 Dokümantasyon
- [ ] Kullanım kılavuzu sayfası (`/docs/petty-cash`)
- [ ] Video tutorial (Loom veya Vimeo)
- [ ] SSS (Sıkça Sorulan Sorular)

---

## 🎯 KPI'lar ve Başarı Metrikleri

### Ölçülecek Metrikler
- [ ] Atama oranı: Eşleşmeyen harcamaların yüzde kaçı projeye atanıyor?
- [ ] Kullanım sıklığı: Kasa fişleri sayfası ziyaret sayısı
- [ ] Ortalama atama süresi: Bir harcamayı projeye atama ne kadar sürüyor?
- [ ] User satisfaction: Anket veya NPS skoru

---

## 🐛 Bilinen Sorunlar ve Düzeltilecekler

### Acil Düzeltmeler
- [x] **SQL Hatası**: UUID-text type mismatch düzeltildi
- [ ] **Session Warning**: `card-statements/[id]/page.tsx:265` - kullanılmayan session değişkeni

### Orta Öncelik
- [ ] **API Error Handling**: Tüm endpoint'lerde detaylı error handling
- [ ] **Type Safety**: Invoice type'larını gözden geçir
- [ ] **Consistency**: Tüm sayfalarda aynı formatı kullan (formatCurrency, formatDate)

---

## 📅 Önerilen Geliştirme Sırası

1. **Hafta 1**: Phase 1 (Görsel İyileştirmeler)
2. **Hafta 2**: Phase 2 (Toplu İşlemler) + Phase 3 (Kasa Fişleri Sayfası)
3. **Hafta 3**: Phase 4 (Proje Detay İyileştirmeleri) + Phase 5 (UX İyileştirmeleri)
4. **Hafta 4**: Phase 6 (Gelişmiş Özellikler) + Phase 7 (Teknik İyileştirmeler)
5. **Hafta 5**: Phase 8 (Onboarding & Dokümantasyon) + Test & Bug Fix

---

## 📝 Notlar

### Önemli Kararlar
- **One-to-One İlişki**: Kasa fişleri tek bir projeye atanacak (faturalardan farklı)
- **Kasa Fişi Tanımı**: Faturalarla eşleşmeyen ancak projeye atanan harcamalar
- **Renk Sistemi**: Mor/Purple = Kasa Fişleri (diğer renklerden ayırt etmek için)

### Gelecek Özellikler (Backlog)
- [ ] Kategori sistemi (Malzeme, Yemek, Ulaşım vb.)
- [ ] Kasa fişi onay sistemi (Proje yöneticisi onayı)
- [ ] Bütçe takibi (Proje bazlı kasa fişi limiti)
- [ ] Recurring kasa fişleri (Aylık sabit harcamalar)
- [ ] Multi-currency desteği
- [ ] OCR ile fotoğraf çekip kasa fişi oluşturma

---

**Son Güncelleme**: 26 Şubat 2026
**Durum**: ✅ Temel sistem kuruldu, iyileştirmeler devam ediyor
