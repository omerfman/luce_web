# 🚀 GitHub ve Vercel Deployment Adımları

## ✅ Tamamlanan Adımlar
- [x] Güvenlik kontrolü yapıldı
- [x] `.env.local` ignore edildi
- [x] Git repository başlatıldı
- [x] İlk commit oluşturuldu

## 📝 Şimdi Yapılacaklar

### 1. GitHub Repository Oluştur
1. [github.com](https://github.com) → "New repository"
2. Repository adı: `luce-web` (veya istediğiniz ad)
3. **Private** seçin (güvenlik için)
4. README eklemeyin (zaten var)
5. "Create repository" tıklayın

### 2. GitHub'a Push
Terminal'de şu komutları çalıştırın:
```bash
# Main branch oluştur
git branch -M main

# GitHub repository'yi ekle (REPLACE with your URL)
git remote add origin https://github.com/KULLANICI_ADINIZ/luce-web.git

# Push et
git push -u origin main
```

### 3. Vercel'e Deploy

#### A. Vercel Hesabı
1. [vercel.com](https://vercel.com) → "Sign Up" veya "Login"
2. GitHub hesabınızla giriş yapın

#### B. Projeyi Import Et
1. Vercel Dashboard → "Add New" → "Project"
2. GitHub repository'nizi seçin (`luce-web`)
3. **Framework Preset**: Next.js (otomatik algılanır)
4. **Root Directory**: `./` (varsayılan)

#### C. Environment Variables Ekle
**ÖNEMLİ**: Deployment yapmadan önce bu değişkenleri ekleyin!

```bash
# Production için gerekli environment variables:

NEXT_PUBLIC_SUPABASE_URL=https://plwmqofncmkgxhushucg.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY=
# ↑ Supabase Dashboard → Settings → API → anon public

SUPABASE_SERVICE_ROLE_KEY=
# ↑ Supabase Dashboard → Settings → API → service_role (GİZLİ!)

NEXT_PUBLIC_APP_URL=
# ↑ Deployment sonrası Vercel size verecek (örn: https://luce-web.vercel.app)
```

#### D. Deploy
1. "Deploy" butonuna tıklayın
2. Build loglarını izleyin (~2-3 dakika)
3. Deployment tamamlandığında URL alacaksınız

### 4. Post-Deployment

#### A. App URL'i Güncelle
1. Deployment URL'i kopyalayın (örn: `https://luce-web.vercel.app`)
2. Vercel → Settings → Environment Variables
3. `NEXT_PUBLIC_APP_URL` değişkenini ekleyin/güncelleyin
4. Redeploy tetikleyin

#### B. Supabase Redirect URLs
1. Supabase Dashboard → Authentication → URL Configuration
2. **Site URL**: `https://luce-web.vercel.app`
3. **Redirect URLs** ekleyin:
   ```
   https://luce-web.vercel.app/auth/callback
   https://luce-web.vercel.app/login
   https://luce-web.vercel.app/dashboard
   ```

#### C. Test Et
1. Production URL'i aç: `https://luce-web.vercel.app`
2. Login sayfasını test et
3. Super Admin hesabıyla giriş yap
4. Tüm sayfaları kontrol et

### 5. Custom Domain (Opsiyonel)

#### A. Domain Ekle
1. Vercel → Settings → Domains
2. "Add" → Domain adınızı girin (örn: `app.lucemimarlik.com`)
3. DNS kayıtlarını göreceksiniz

#### B. DNS Ayarları
Domain sağlayıcınızda (GoDaddy, Namecheap, vb.):
```
Type: CNAME
Name: app
Value: cname.vercel-dns.com
```

#### C. SSL
Vercel otomatik SSL sertifikası sağlar (~5 dakika)

## 🔐 Güvenlik Kontrol Listesi

### Deployment Öncesi
- [x] `.env.local` GitHub'a push edilmedi
- [x] Hiçbir dosyada hardcoded key yok
- [x] Repository private olarak oluşturuldu

### Deployment Sonrası
- [ ] Environment variables Vercel'de doğru
- [ ] Supabase redirect URLs güncellendi
- [ ] Production'da login çalışıyor
- [ ] File upload çalışıyor
- [ ] RLS policies aktif

## 📊 Monitoring

### Vercel Analytics
- Otomatik aktif
- Dashboard → Analytics sekmesi

### Logs
- Vercel Dashboard → Deployments → Son deployment → "Logs"
- Realtime hata takibi

### Supabase Logs
- Supabase Dashboard → Logs
- Database, Auth, API istekleri

## 🆘 Sorun Giderme

### Build Hatası
```bash
# Local'de test et
npm run build
```

### Environment Variable Hatası
- Vercel → Settings → Environment Variables
- Tüm değişkenleri kontrol et
- Redeploy

### Authentication Hatası
- Supabase redirect URLs kontrol et
- Browser console errors bak
- Supabase Auth logs kontrol et

---

## 📞 Yardım

Sorun yaşarsanız:
1. Vercel build logs kontrol et
2. Browser console errors kontrol et
3. Supabase Dashboard → Logs

**Deployment başarılı olduğunda URL'i paylaşın!** 🎉
