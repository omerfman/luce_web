# 📱 PWA (Progressive Web App) Test ve Kullanım Rehberi

## 🎉 Tebrikler! Uygulamanız artık bir PWA!

Luce Mimarlık İş Akışı Sistemi artık Progressive Web App olarak çalışmakta ve mobil cihazlarda native app gibi kullanılabilir.

---

## 🚀 Hızlı Başlangıç

### Local Test (Geliştirme)

1. **Production Build Alın:**
   ```bash
   npm run build
   ```

2. **Production Server Başlatın:**
   ```bash
   npm run start
   ```

3. **Tarayıcıda Açın:**
   - Chrome/Edge: http://localhost:3000
   - DevTools ile test edin (F12)

---

## 📊 PWA Özelliklerini Test Etme

### 1️⃣ Chrome DevTools ile Test

#### Manifest Kontrolü
1. F12 > **Application** sekmesi
2. Sol menüden **Manifest** seçin
3. Görmelisiniz:
   - ✅ Name: "Luce Mimarlık İş Akışı Sistemi"
   - ✅ Short name: "Luce İş Akışı"
   - ✅ Theme color: #1e40af
   - ✅ Display: standalone
   - ✅ Icons: 10 adet (72x72 - 512x512)

#### Service Worker Kontrolü
1. F12 > **Application** sekmesi
2. Sol menüden **Service Workers** seçin
3. Görmelisiniz:
   - ✅ Status: **activated and running**
   - ✅ Source: sw.js
   - ✅ Update on reload (gerekirse)

#### Cache Storage
1. F12 > **Application** > **Cache Storage**
2. Görmelisiniz:
   - `next-data` - Sayfa verileri
   - `static-style-assets` - CSS dosyaları
   - `static-js-assets` - JavaScript dosyaları
   - `static-image-assets` - Resimler
   - `apis` - API istekleri (5 dakika)

### 2️⃣ Lighthouse Audit

1. F12 > **Lighthouse** sekmesi
2. Categories: **Progressive Web App** seçili
3. **Analyze page load** tıklayın
4. **Hedef Skorlar:**
   - 🎯 PWA: 90+ 
   - ⚡ Performance: 70+
   - ♿ Accessibility: 90+
   - ✅ Best Practices: 90+

---

## 📲 Mobil Cihaza Yükleme

### Android (Chrome)

1. **Chrome'da Siteyi Açın**
   - Üretim URL'sine gidin (örn: https://luce-web.vercel.app)

2. **Yükleme İstemi**
   - Adres çubuğunda "+" veya "Install" ikonu görünür
   - Veya: ⋮ (menü) > "Add to Home Screen"

3. **Yükleme Sonrası**
   - Ana ekranda uygulama ikonu belirir
   - Standalone mode (tam ekran, browser bar yok)
   - Uygulama çekmecesinde görünür

### iOS (Safari)

1. **Safari'de Siteyi Açın**
   - Üretim URL'sine gidin

2. **Paylaş Menüsü**
   - Alt ortadaki paylaş ikonuna (📤) tıklayın
   - "Add to Home Screen" seçin

3. **İsim ve İkon Ayarı**
   - Varsayılan: "Luce İş Akışı"
   - Add tıklayın

4. **Yükleme Sonrası**
   - Ana ekranda uygulama ikonu belirir
   - Standalone mode (browser bar yok)

### Desktop (Chrome, Edge)

1. **Tarayıcıda Siteyi Açın**
   - Adres çubuğunun sağında "Install" ikonu (💻+)
   
2. **Yükleme**
   - İkona tıklayın > "Install" onaylayın

3. **Uygulama Olarak Çalışır**
   - Başlat menüsünde/Application'da görünür
   - Ayrı pencerede, browser UI'sız açılır
   - Taskbar'a sabitlenebilir

---

## 🔌 Offline Özelliklerini Test Etme

### Test Senaryosu 1: Network Kapatma

1. **Uygulamayı Normal Açın**
   ```
   http://localhost:3000/dashboard
   ```

2. **DevTools Network Kontrolü**
   - F12 > Network sekmesi
   - Throttling: **Offline** seçin

3. **Sayfada Gezinin**
   - ✅ Önceden ziyaret edilen sayfalar açılır (cache'den)
   - ✅ Static dosyalar (CSS, JS, resimler) yüklenir
   - ⚠️ API istekleri başarısız olabilir (NetworkFirst stratejisi)
   - ✅ Offline sayfası gösterilir (/offline)

### Test Senaryosu 2: Gerçek Bağlantı Kesme

1. **Uygulamayı yükleyin (Ana Ekrana Ekle)**
2. **Birkaç sayfayı ziyaret edin** (cache'e alınsın)
3. **WiFi/Mobil veriyi kapatın**
4. **Uygulamayı açın**
   - Static sayfalar çalışmalı
   - Offline uyarısı gösterilmeli

---

## 🎨 PWA Özellikleri

### ✅ Implement Edilenler

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| **Manifest** | Uygulama meta verileri, iconlar | ✅ |
| **Service Worker** | Offline çalışma, cache yönetimi | ✅ |
| **Install Prompt** | Ana ekrana ekleme | ✅ |
| **Standalone Mode** | Tam ekran (browser bar yok) | ✅ |
| **Offline Fallback** | Bağlantı koptuğunda /offline sayfası | ✅ |
| **App Shortcuts** | Sağ tık menüde kısayollar (Projeler, Faturalar, Dashboard) | ✅ |
| **Theme Color** | Status bar rengi (#1e40af) | ✅ |
| **Icons** | 72x72 - 512x512 + maskable | ✅ |
| **Responsive** | Mobil uyumlu tasarım | ✅ |
| **Cache Strategy** | Network First (API), Cache First (static) | ✅ |

### 📦 Cache Stratejileri

#### CacheFirst (Önce cache, sonra network)
- **Font'lar** → 365 gün
- **Audio/Video** → 24 saat
- Hızlı yükleme, nadiren değişen dosyalar

#### StaleWhileRevalidate (Cache kullan, arka planda güncelle)
- **Google Fonts CSS** → 7 gün
- **CSS/JS** → 24 saat
- **Resimler** → 24 saat
- **Next.js Image** → 24 saat
- Hızlı + güncel

#### NetworkFirst (Önce network, başarısızsa cache)
- **API İstekleri** → 5 dakika, 10s timeout
- **Sayfalar** → 24 saat, 10s timeout
- Her zaman güncel veri hedefi

---

## 🐛 Sorun Giderme

### Service Worker Kayıtlı Değil

**Çözüm:**
```bash
# Production build gerekli (development'ta disable)
npm run build
npm run start
```

### Cache Temizleme

**Chrome DevTools:**
1. F12 > Application > Storage
2. "Clear site data" tıklayın
3. Sayfayı yenileyin (Ctrl+Shift+R)

**Komut satırı:**
```javascript
// Console'da çalıştırın
caches.keys().then(keys => keys.forEach(key => caches.delete(key)))
```

### Install Butonu Görünmüyor

**Kontrol Listesi:**
- [ ] HTTPS bağlantısı (localhost veya production)
- [ ] Service Worker aktif
- [ ] Manifest.json erişilebilir
- [ ] Daha önce yüklenmemiş (kaldırıp deneyin)
- [ ] Chrome: chrome://flags/#bypass-app-banner-engagement-checks

### iOS'ta Çalışmıyor

**iOS Sınırlamaları:**
- ❌ Push Notifications desteklenmiyor
- ❌ Background Sync desteklenmiyor
- ✅ Basic PWA özellikleri çalışır
- ⚠️ Safari'de manuel ekleme gerekli ("Add to Home Screen")

---

## 📈 Production Deployment

### Vercel'e Deploy

1. **Git'e Push Edin**
   ```bash
   git add .
   git commit -m "feat: PWA support eklendi"
   git push origin main
   ```

2. **Vercel Otomatik Deploy Eder**
   - HTTPS otomatik aktif
   - Service Worker çalışır
   - PWA özellikleri aktif

3. **Test Edin**
   ```
   https://your-domain.vercel.app
   ```

### Production Checklist

- [ ] Build başarılı (`npm run build`)
- [ ] Service Worker oluştu (public/sw.js)
- [ ] Manifest erişilebilir (/manifest.json)
- [ ] Icons yüklendi (public/icons/)
- [ ] HTTPS aktif (Vercel otomatik)
- [ ] Lighthouse PWA skoru 90+
- [ ] Mobil cihazda test edildi

---

## 📚 İleri Seviye

### Push Notifications (Gelecek)

```javascript
// İleride eklenebilir (sadece Android)
if ('Notification' in window && 'serviceWorker' in navigator) {
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      // Push notification logic
    }
  });
}
```

### Background Sync (Gelecek)

```javascript
// Offline iken yapılan işlemleri online olunca gönder
if ('serviceWorker' in navigator && 'SyncManager' in window) {
  navigator.serviceWorker.ready.then(registration => {
    return registration.sync.register('sync-invoices');
  });
}
```

### App Update Notification

Service Worker güncellendiğinde kullanıcıya bildir:
```javascript
// pages/_app.tsx veya layout.tsx
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }
}, []);
```

---

## 🔗 Yararlı Kaynaklar

- [PWA Builder](https://www.pwabuilder.com/) - PWA test ve validate
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) - Otomatik PWA audit
- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [Can I Use - PWA](https://caniuse.com/?search=pwa) - Browser desteği
- [What PWA Can Do Today](https://whatpwacando.today/) - PWA API'ları

---

## 📊 Beklenen Metrikler

### Lighthouse Skorları (Hedef)
- **PWA:** 90-100
- **Performance:** 70-90
- **Accessibility:** 90-100
- **Best Practices:** 90-100
- **SEO:** 80-90

### Yükleme Süreleri
- **First Contentful Paint:** < 2s
- **Time to Interactive:** < 4s
- **Largest Contentful Paint:** < 3s

### Cache Verimliliği
- **Tekrar Ziyaret:** 70%+ cache hit
- **Offline Erişim:** Temel sayfalar erişilebilir
- **Bandwidth Tasarrufu:** %30-50

---

## 🎯 Sonuç

✅ **PWA dönüşümü başarıyla tamamlandı!**

Uygulamanız artık:
- 📱 Mobil cihazlara yüklenebilir
- 🚀 Hızlı yüklenir (cache sayesinde)
- 🔌 Offline çalışır (sınırlı)
- 💻 Desktop uygulaması gibi kullanılır
- 🎨 Native app deneyimi sunar

**Sıradaki Adımlar:**
1. Production'a deploy edin (Vercel)
2. Gerçek cihazlarda test edin
3. Kullanıcı geri bildirimlerini toplayın
4. Lighthouse skorlarını optimize edin
5. İleri seviye PWA özelliklerini ekleyin (push, background sync)

---

**Son Güncelleme:** 28 Ocak 2026  
**Versiyon:** 1.0.0  
**Durum:** ✅ Production Ready
