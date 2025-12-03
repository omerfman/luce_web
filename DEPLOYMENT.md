# 🚀 Deployment Kılavuzu

## Güvenlik Kontrol Listesi ✅

### 1. Ortam Değişkenleri
- ✅ `.env.local` dosyası `.gitignore`'a eklendi
- ✅ Hiçbir dosyada hardcoded key/token yok
- ✅ Tüm hassas bilgiler environment variables kullanıyor

### 2. GitHub'a Push Öncesi Kontroller
```bash
# .env.local dosyasının ignore edildiğini kontrol et
git check-ignore .env.local
# Çıktı: .env.local (OK!)

# Staged dosyalarda hassas bilgi aramak
git diff --cached | grep -i "supabase.*key\|password.*=\|secret"
# Çıktı olmamalı!
```

### 3. Vercel Deployment

#### Adım 1: GitHub Repository Oluştur
```bash
git init
git add .
git commit -m "Initial commit - Luce Mimarlık Web App"
git branch -M main
git remote add origin https://github.com/yourusername/luce-web.git
git push -u origin main
```

#### Adım 2: Vercel'e Deploy
1. [vercel.com](https://vercel.com) → "Add New Project"
2. GitHub repository'yi seç
3. **Environment Variables** ekle:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://plwmqofncmkgxhushucg.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[Supabase Dashboard'dan al]
   SUPABASE_SERVICE_ROLE_KEY=[Supabase Dashboard'dan al - GİZLİ!]
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   ```

#### Adım 3: Supabase Konfigürasyonu
1. Supabase Dashboard → Settings → API
2. **Anon Key** (public) ve **Service Role Key** (private) kopyala
3. Vercel environment variables'a yapıştır

#### Adım 4: Domain Ayarları
1. Vercel → Settings → Domains
2. Custom domain ekle (örn: luce.yourdomain.com)
3. DNS ayarlarını güncelle

## 🔐 Güvenlik En İyi Uygulamalar

### Asla GitHub'a Pushlama
- ❌ `.env.local`
- ❌ `.env.production`
- ❌ API keys, tokens, passwords
- ❌ Service role keys
- ❌ Database credentials

### Her Zaman Example Dosyalar Kullan
- ✅ `.env.example` (template)
- ✅ `.env.production.example` (production template)

### Vercel Environment Variables
- **Development**: `.env.local` kullan
- **Production**: Vercel dashboard'dan ayarla
- **Preview**: Branch başına ayrı env vars ayarlanabilir

## 📝 Post-Deployment Kontroller

### 1. Supabase RLS Policies
```sql
-- Tüm tabloların RLS aktif olduğunu kontrol et
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### 2. Authentication
- [ ] Email doğrulama çalışıyor
- [ ] Password reset çalışıyor
- [ ] Logout sonrası redirect doğru

### 3. Permissions
- [ ] Super Admin her şeyi görebiliyor
- [ ] Admin şirket içi işlemleri yapabiliyor
- [ ] Roller doğru çalışıyor

### 4. File Upload
- [ ] Invoice PDF yükleme çalışıyor
- [ ] Signed URLs oluşturuluyor
- [ ] PDF viewer açılıyor

## 🛠️ Troubleshooting

### Supabase Bağlantı Hatası
```bash
# .env.local'de URL ve keys doğru mu?
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Vercel Build Hatası
```bash
# Local'de build test et
npm run build

# Type check
npm run type-check
```

### RLS Policy Hatası
- Supabase Dashboard → Authentication → Policies
- Her tablo için SELECT/INSERT/UPDATE/DELETE policies kontrol et

## 📞 Destek

Sorun olursa:
1. Vercel logs kontrol et
2. Supabase logs kontrol et
3. Browser console errors kontrol et
