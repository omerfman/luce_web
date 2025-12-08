# Proje Dosya Yönetim Sistemi - Kurulum Rehberi

## 🎯 Özellikler

- ✅ 8 Teknik Ofis Kategorisi (Statik, Mimari, Mekanik, Elektrik, Zemin Etüdü, Geoteknik, İç Tasarım, 3 Boyut)
- ✅ Cloudinary ile dosya depolama
- ✅ Drag & drop dosya yükleme
- ✅ Çoklu dosya desteği
- ✅ Dosya arama, filtreleme ve sıralama
- ✅ Kullanıcı bazlı yetkilendirme
- ✅ Şirket bazlı veri izolasyonu (RLS)
- ✅ Responsive tasarım

## 📋 Gereksinimler

- Node.js 18+
- Supabase hesabı
- Cloudinary hesabı

## 🚀 Kurulum Adımları

### 1. Database Migration

Supabase SQL Editor'de aşağıdaki migration'ı çalıştırın:

```bash
# Migration dosyasını Supabase'e yükleyin
supabase/migrations/20251208_create_project_files.sql
```

Veya Supabase Dashboard > SQL Editor'de dosya içeriğini kopyalayıp çalıştırın.

### 2. Cloudinary Kurulumu

1. [Cloudinary](https://cloudinary.com) hesabı oluşturun (ücretsiz)
2. Dashboard'dan aşağıdaki bilgileri alın:
   - Cloud Name
   - API Key
   - API Secret

### 3. Environment Variables

`.env.local` dosyası oluşturun ve aşağıdaki değişkenleri ekleyin:

```bash
# Supabase (Mevcut)
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cloudinary (Yeni)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 4. Dependencies

Cloudinary paketi zaten yüklü:

```bash
npm install
```

### 5. Development Server

```bash
npm run dev
```

## 📁 Dosya Yapısı

```
app/projects/[id]/
├── page.tsx                 # Proje özet sayfası
├── layout.tsx              # Dual sidebar layout
├── statik/page.tsx         # Statik dosyalar
├── mimari/page.tsx         # Mimari dosyalar
├── mekanik/page.tsx        # Mekanik dosyalar
├── elektrik/page.tsx       # Elektrik dosyalar
├── zemin_etudu/page.tsx    # Zemin etüdü dosyalar
├── geoteknik/page.tsx      # Geoteknik dosyalar
├── ic_tasarim/page.tsx     # İç tasarım dosyalar
└── 3d/page.tsx             # 3D dosyalar

components/projects/
├── FileUpload.tsx          # Dosya yükleme component'i
├── FileList.tsx            # Dosya listesi component'i
└── TechnicalOfficeSidebar.tsx  # Kategori navigation

lib/
├── cloudinary/
│   └── upload.ts           # Cloudinary utilities
└── supabase/
    └── project-files.ts    # Database operations
```

## 🔐 Güvenlik

- ✅ Row Level Security (RLS) aktif
- ✅ Şirket bazlı veri izolasyonu
- ✅ Sadece kendi yüklediğiniz dosyaları silebilirsiniz
- ✅ Dosya tipi validasyonu (client & server)
- ✅ Dosya boyutu limitleri (50MB default, 100MB for 3D)

## 📝 Desteklenen Dosya Tipleri

### Dökümanlar
- PDF, DOC, DOCX

### CAD Dosyaları
- DWG, DXF

### Görseller
- JPG, JPEG, PNG, GIF

### Arşivler
- ZIP, RAR, 7Z

## 🧪 Test Etme

1. Bir projeye gidin
2. Sol sidebar'dan bir teknik ofis kategorisi seçin
3. Dosya yükleyin (drag & drop veya click)
4. Dosyanın listelendiğini kontrol edin
5. Arama ve filtreleme özelliklerini test edin
6. İndirme butonuna tıklayın
7. Silme butonuna tıklayın (sadece kendi dosyalarınızı silebilirsiniz)

## 🚢 Production Deployment

### 1. Vercel Environment Variables

Vercel Dashboard > Settings > Environment Variables:

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

### 2. Production Migration

Production Supabase'de migration'ı çalıştırın:
- Supabase Dashboard > SQL Editor
- `20251208_create_project_files.sql` içeriğini yapıştırın
- Run

### 3. Deploy

```bash
git add .
git commit -m "feat: Add project file management system"
git push origin main
```

Vercel otomatik deploy edecektir.

## 📊 İstatistikler

Proje özet sayfasında:
- Toplam dosya sayısı
- Toplam dosya boyutu
- Kategori bazlı dağılım
- Hızlı erişim linkleri

## 🐛 Troubleshooting

### Dosya yüklenmiyor
- Cloudinary environment variables'larını kontrol edin
- Browser console'da hata mesajlarını kontrol edin
- Dosya boyutunun limitler içinde olduğundan emin olun

### Dosyalar görünmüyor
- RLS policy'lerini kontrol edin
- Company ID'nin doğru olduğundan emin olun
- Browser console'da network hatalarını kontrol edin

### Migration hataları
- Supabase'de table'ın zaten var olmadığından emin olun
- SQL syntax hatalarını kontrol edin
- Migration'ı parça parça çalıştırmayı deneyin

## 📚 Daha Fazla Bilgi

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js File Upload](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#formdata)
