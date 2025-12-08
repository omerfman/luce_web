# Proje Detay Sayfası Geliştirme Planı

## 📋 Genel Bakış
Projeler listesinden bir proje açıldığında:
- Proje özet sayfası (fatura bölümü olmadan)
- Teknik Ofis tabları (sidebar'da accordion)
- Her tab'de dosya yükleme (Cloudinary ile)

---

## ✅ TAMAMLANAN İŞLEMLER

### Faz 1: Analiz ve Planlama
- [x] Mevcut proje detay sayfasını analiz et
- [x] Sidebar yapısını planla
- [x] Dosya yükleme stratejisini belirle
- [x] Component mimarisini tasarla

---

## 🔄 DEVAM EDEN İŞLEMLER

### Faz 2: Database Yapısı

#### 2.1 Migration - Proje Dosyaları Tablosu
- [x] ✅ `project_files` tablosu oluştur
  - Kolonlar:
    - `id` (UUID, primary key)
    - `project_id` (UUID, foreign key -> projects)
    - `category` (TEXT: 'statik', 'mimari', 'mekanik', 'elektrik', 'zemin_etudu', 'geoteknik', 'ic_tasarim', '3d')
    - `file_name` (TEXT)
    - `file_url` (TEXT - Cloudinary URL)
    - `file_type` (TEXT - mime type)
    - `file_size` (BIGINT - bytes)
    - `uploaded_by` (UUID, foreign key -> users)
    - `uploaded_at` (TIMESTAMP WITH TIME ZONE)
    - `company_id` (UUID, foreign key -> companies)
    - `created_at` (TIMESTAMP WITH TIME ZONE)
    - `updated_at` (TIMESTAMP WITH TIME ZONE)

#### 2.2 RLS Policies
- [x] ✅ SELECT policy: Kullanıcı kendi şirketinin dosyalarını görebilir
- [x] ✅ INSERT policy: Yetkili kullanıcılar dosya yükleyebilir
- [x] ✅ DELETE policy: Yetkili kullanıcılar dosya silebilir
- [x] ✅ UPDATE policy: Yetkili kullanıcılar dosya bilgilerini güncelleyebilir

#### 2.3 Indexes
- [x] ✅ `project_id` index
- [x] ✅ `category` index
- [x] ✅ `company_id` index

---

### Faz 3: Cloudinary Entegrasyonu

#### 3.1 Cloudinary Kurulum
- [x] ✅ `npm install cloudinary` 
- [x] ✅ Environment variables ekle (.env.local):
  - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`

#### 3.2 Cloudinary Upload Utility
- [x] ✅ `lib/cloudinary/upload.ts` oluştur
  - Upload fonksiyonu
  - Delete fonksiyonu
  - Dosya tipi validasyonu
  - Dosya boyutu limiti (örn: 50MB)

#### 3.3 Upload API Route
- [x] ✅ `app/api/upload/route.ts` oluştur
  - POST: Dosya yükleme
  - DELETE: Dosya silme
  - Multipart/form-data desteği

---

### Faz 4: UI Components

#### 4.1 Proje Layout Güncellemesi
- [x] ✅ `app/projects/[id]/layout.tsx` oluştur
  - Sidebar ile proje-spesifik layout
  - Teknik Ofis accordion menüsü
  - Tab navigation

#### 4.2 Proje Özet Sayfası
- [x] ✅ `app/projects/[id]/page.tsx` güncelle
  - Fatura bölümünü kaldır
  - Proje genel bilgileri
  - Proje durumu
  - Müşteri bilgileri
  - İstatistikler (toplam dosya sayısı vs)

#### 4.3 Dosya Yükleme Component
- [x] ✅ `components/projects/FileUpload.tsx` oluştur
  - Drag & drop desteği
  - Çoklu dosya seçimi
  - Progress bar
  - Dosya önizleme
  - Dosya tipi ikonları
  - Yükleme validasyonu

#### 4.4 Dosya Listesi Component
- [x] ✅ `components/projects/FileList.tsx` oluştur
  - Dosya kartları
  - İndirme butonu
  - Silme butonu (yetkili kullanıcılar için)
  - Dosya bilgileri (boyut, yükleyen, tarih)
  - Filtreleme ve arama

#### 4.5 Teknik Ofis Tab Sayfaları
- [x] ✅ `app/projects/[id]/statik/page.tsx`
- [x] ✅ `app/projects/[id]/mimari/page.tsx`
- [x] ✅ `app/projects/[id]/mekanik/page.tsx`
- [x] ✅ `app/projects/[id]/elektrik/page.tsx`
- [x] ✅ `app/projects/[id]/zemin_etudu/page.tsx`
- [x] ✅ `app/projects/[id]/geoteknik/page.tsx`
- [x] ✅ `app/projects/[id]/ic_tasarim/page.tsx`
- [x] ✅ `app/projects/[id]/3d/page.tsx`

Not: Her sayfa aynı component'i kullanacak, sadece category prop'u farklı olacak.

---

### Faz 5: Teknik Ofis Sidebar

#### 5.1 Sidebar Component
- [x] ✅ `components/projects/TechnicalOfficeSidebar.tsx` oluştur
  - Accordion yapısı
  - "Teknik Ofis" ana başlığı
  - Alt kategoriler (8 tab)
  - Aktif tab highlight
  - Responsive tasarım

#### 5.2 Sidebar Navigation
- [x] ✅ Tab linkleri
- [x] ✅ Aktif route detection
- [x] ✅ İkonlar (her kategori için)
- [x] ✅ Badge (dosya sayısı gösterimi - opsiyonel)

---

### Faz 6: Backend İşlemleri

#### 6.1 Dosya CRUD İşlemleri
- [x] ✅ `lib/supabase/project-files.ts` oluştur
  - `uploadProjectFile()` - Dosya yükleme + DB kayıt
  - `getProjectFiles()` - Kategori bazlı dosya listesi
  - `deleteProjectFile()` - Dosya silme + Cloudinary'den silme
  - `getProjectFileStats()` - Dosya istatistikleri

#### 6.2 Permission Kontrolü
- [x] ✅ Dosya yükleme yetkisi kontrolü
- [x] ✅ Dosya silme yetkisi kontrolü
- [x] ✅ Proje erişim yetkisi kontrolü

---

### Faz 7: TypeScript Types

#### 7.1 Type Definitions
- [x] ✅ `types/index.ts` güncelle
  - `ProjectFile` interface
  - `TechnicalCategory` type
  - `FileUploadResponse` interface

---

### Faz 8: Testing

#### 8.1 Local Test
- [ ] Migration'ı local Supabase'de çalıştır
- [ ] Cloudinary credentials test et
- [ ] Dosya yükleme test et (her kategori)
- [ ] Dosya silme test et
- [ ] RLS policies test et (farklı kullanıcılarla)
- [ ] Responsive tasarım test et
- [ ] Dosya tipi validasyonu test et
- [ ] Dosya boyutu limiti test et

#### 8.2 Edge Cases
- [ ] Aynı isimde dosya yükleme
- [ ] Çok büyük dosya yükleme
- [ ] Desteklenmeyen dosya tipi
- [ ] Network hatası durumu
- [ ] Yetkisiz erişim denemeleri

---

### Faz 9: Production Deployment

#### 9.1 Environment Variables
- [ ] Vercel'de Cloudinary credentials ekle
- [ ] Production Supabase URL'i kontrol et

#### 9.2 Database Migration
- [ ] Production Supabase'de migration çalıştır
- [ ] RLS policies kontrol et

#### 9.3 Deploy
- [ ] Git commit & push
- [ ] Vercel auto-deploy
- [ ] Production test

---

## 📝 Notlar

### Cloudinary Klasör Yapısı
```
luce_web/
  projects/
    {project_id}/
      statik/
      mimari/
      mekanik/
      elektrik/
      zemin_etudu/
      geoteknik/
      ic_tasarim/
      3d/
```

### Desteklenen Dosya Tipleri
- **Dokümanlar:** PDF, DOC, DOCX
- **Çizimler:** DWG, DXF
- **Görseller:** JPG, JPEG, PNG, GIF
- **3D Modeller:** OBJ, FBX, 3DS (opsiyonel)
- **Diğer:** ZIP, RAR

### Dosya Boyutu Limitleri
- Genel: 50MB
- 3D dosyalar: 100MB (opsiyonel)

### URL Yapısı
- Proje özet: `/projects/[id]`
- Statik: `/projects/[id]/statik`
- Mimari: `/projects/[id]/mimari`
- vb...

---

## 🎨 UX İyileştirmeleri

### Kullanıcı Dostu Özellikler
1. **Drag & Drop:** Dosyaları sürükle bırak
2. **Progress Bar:** Yükleme ilerlemesi göster
3. **Önizleme:** Resimler için thumbnail
4. **Bildirimler:** Başarı/hata mesajları
5. **Filtreleme:** Dosya tipi, tarih, yükleyen kişi
6. **Arama:** Dosya adı ile arama
7. **Toplu İşlem:** Çoklu dosya seçimi ve silme
8. **Sıralama:** İsim, tarih, boyut

---

## 🔐 Güvenlik

1. **File Type Validation:** Server-side dosya tipi kontrolü
2. **File Size Limit:** Maksimum dosya boyutu
3. **RLS Policies:** Şirket bazlı erişim kontrolü
4. **Permission Check:** Yetki kontrolü
5. **Virus Scan:** Cloudinary otomatik tarama (varsayılan)
6. **Secure URLs:** Signed URLs kullanımı (gerekirse)

---

## 📊 Performans Optimizasyonu

1. **Lazy Loading:** Dosya listesi pagination
2. **Image Optimization:** Cloudinary transformations
3. **Caching:** Browser cache headers
4. **Compression:** Gzip/Brotli compression
5. **CDN:** Cloudinary CDN avantajı

---

**SON GÜNCELLEME:** 2025-12-08
**DURUM:** Faz 2 başlangıç - Database yapısı oluşturulacak
