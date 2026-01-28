# PWA Mobil Kullanım Rehberi

## 🎯 Ana Ekrana Ekleme (2 Yöntem)

### Yöntem 1: Install Butonu (Önerilen) ✨

1. **Login sayfasına git**: https://luce-web.vercel.app/login
2. **Sağ üstteki mavi "Uygulamayı Yükle" butonunu gör**
3. **Butona dokun**:
   - **Android**: Install dialog açılır → "Yükle" tıkla
   - **iOS**: Nasıl yüklenir talimatları gösterilir → Adımları takip et
4. **Ana ekrana eklendi!** 🎉

### Yöntem 2: Tarayıcı Menüsü (Geleneksel)

#### Android Chrome
1. https://luce-web.vercel.app adresine git
2. Sağ üst köşedeki **⋮** menüye dokun
3. **"Add to Home screen"** veya **"Ana ekrana ekle"** seç
4. İsmi onayla → **"Add"** tıkla
5. Ana ekranında Luce ikonu görünecek

#### iOS Safari
1. https://luce-web.vercel.app adresine git
2. Alt orta **Paylaş** butonuna dokun: **⎙**
3. Aşağı kaydır → **"Add to Home Screen"** bul
4. İsmi onayla → **"Add"** tıkla
5. Ana ekranında Luce ikonu görünecek

---

## ⚠️ ÖNEMLİ: İlk Kurulum Adımları

### Eğer Daha Önce Eklemiş ve Sorun Yaşıyorsan

#### 1. Eski PWA'yı Kaldır
- Ana ekrandaki Luce ikonunu bul
- Uzun bas → **"Remove"** veya **"Sil"**

#### 2. Tarayıcı Cache'ini Temizle (KRİTİK!)

**Android Chrome**:
```
1. Chrome → Settings (Ayarlar)
2. Site settings → All sites
3. "luce-web.vercel.app" ara ve tıkla
4. "Clear & reset" tıkla
5. Chrome'u TAMAMEN kapat (recent apps'ten de kapat)
6. Chrome'u tekrar aç
```

**iOS Safari**:
```
1. Settings (Ayarlar) → Safari
2. "Clear History and Website Data"
3. Onayla
4. Safari'yi TAMAMEN kapat
5. Safari'yi tekrar aç
```

#### 3. Yeniden Ekle
- Yukarıdaki yöntemlerden birini kullan
- Install butonu veya tarayıcı menüsü

---

## ✅ Standalone Mode Kontrol

### PWA Doğru Çalışıyor mu?

**PWA ikonundan açtığında**:
- ✅ Tarayıcı adres çubuğu YOK
- ✅ Tarayıcı menü (⋮) YOK
- ✅ Tam ekran uygulama görünümü
- ✅ Status bar (saat, batarya) + uygulama

**Eğer tarayıcı UI görüyorsan** → Cache temizleme adımlarını uygula

---

## 🔧 Sorun Giderme

### Sorun 1: "Install butonu görünmüyor"

**Çözüm**:
1. Login sayfasında olduğundan emin ol
2. Sayfayı yenile (F5 veya pull-to-refresh)
3. HTTPS bağlantısı olduğunu kontrol et
4. Eğer zaten yüklüyse buton gizlenir (normal davranış)

### Sorun 2: "Ana ekrana ekle seçeneği yok"

**Android Chrome**:
- Chrome güncel mi? → Play Store'dan güncelle
- HTTPS bağlantısı var mı? → URL'de kilit simgesi olmalı

**iOS Safari**:
- Safari kullanıyor musun? (Chrome/Firefox çalışmaz)
- iOS 11.3+ gerekli → iOS'u güncelle

### Sorun 3: "Eklendi ama tarayıcıda açılıyor"

**Çözüm**:
1. PWA'yı ana ekrandan sil
2. Tarayıcı cache'ini temizle (yukarıdaki adımlar)
3. 5 dakika bekle (Vercel deploy sürer)
4. Tarayıcıyı TAMAMEN kapat ve tekrar aç
5. Yeniden ana ekrana ekle

### Sorun 4: "Logo yanlış görünüyor"

**Mevcut Durum**:
- **Mobil**: Luce'nin gerçek logosu ✅
- **Desktop**: "L" harfi (geçici)

**Not**: Mobil için doğru logo görünüyor, sorun yok.

---

## 📱 Platform-Specific Notlar

### Android Chrome (Önerilen)
- ✅ Tam PWA desteği
- ✅ Install butonu çalışır
- ✅ Standalone mode
- ✅ Push notifications (gelecekte)

### iOS Safari
- ⚠️ iOS 16.4+ önerilir
- ⚠️ Install butonu çalışmaz (Safari limitasyonu)
- ⚠️ Sadece "Add to Home Screen" yöntemi
- ✅ Standalone mode desteklenir

### Samsung Internet
- ✅ Chrome benzeri PWA desteği
- ⚠️ Install butonu bazı durumlarda görünmeyebilir
- ✅ "Add to Home screen" çalışır

---

## 🎓 İyi Bilinen Durumlar

### "User Engagement" Gereksinimi
Bazı Android cihazlarda:
- İlk ziyarette install prompt görünmeyebilir
- 2-3 gün ara ile siteyi ziyaret et
- Her ziyarette 30+ saniye kal
- Sonra install prompt görünür

### Cache Kalıcılığı
- Eski manifest cache'de kalabilir
- **Çözüm**: Tarayıcı cache temizleme (yukarıdaki adımlar)
- **Önemli**: Tarayıcıyı TAMAMEN kapatıp açmak gerekir

### PWA Güncellemeleri
- Uygulama otomatik güncellenir
- Değişiklikler 24 saat içinde yansır
- Manuel güncelleme: PWA'yı kapat-aç

---

## 📊 Beklenen Davranışlar

### PWA İçinde
- ✅ Tüm sayfalar standalone mode
- ✅ Navigation app içinde kalır
- ✅ External linkler tarayıcıda açılır
- ✅ Offline sayfa gösterilir (internet yoksa)

### Ana Ekran
- ✅ Luce logosu (mavi arka plan)
- ✅ "Luce" veya "Luce Mimarlık İş Akışı" adı
- ✅ Normal uygulama gibi görünür

### Uygulama Açıldığında
- ✅ Splash screen (mavi arka plan + logo)
- ✅ Login veya Dashboard (oturum durumuna göre)
- ✅ Tam ekran (tarayıcı UI yok)

---

## 🚀 Test Checklist

Aşağıdaki adımları sırayla dene:

1. **Cache Temizle**
   - [ ] Tarayıcı settings → luce-web.vercel.app → Clear & reset
   - [ ] Tarayıcıyı TAMAMEN kapat

2. **Tarayıcıyı Aç**
   - [ ] https://luce-web.vercel.app/login adresine git
   - [ ] 30 saniye bekle (Service Worker kaydı için)

3. **Install Et**
   - [ ] Install butonu gör → Tıkla VEYA
   - [ ] Tarayıcı menüsü → Add to Home screen

4. **Ana Ekrandan Aç**
   - [ ] Luce ikonuna dokun
   - [ ] Tarayıcı UI yok ✅
   - [ ] Splash screen gör ✅
   - [ ] Uygulama açılır ✅

5. **Test Et**
   - [ ] Login yap
   - [ ] Dashboard'a git
   - [ ] Projelere göz at
   - [ ] Hala standalone mode ✅

---

## 📞 Destek

### Sorun Devam Ediyorsa

**Lütfen şunları paylaş**:
1. Cihaz: Android/iOS + version (örn: Android 14, iOS 17.2)
2. Tarayıcı: Chrome/Safari + version (örn: Chrome 120)
3. Davranış: "Tarayıcıda açılıyor" veya "Install butonu yok"
4. Screenshot: Ana ekran ve uygulama açılınca

### Debug Bilgileri

**Chrome Console'da çalıştır** (Desktop'ta mobil emulation):
```javascript
// 1. Service Worker durumu
navigator.serviceWorker.getRegistrations().then(r => 
  console.log('SW:', r[0]?.active?.state)
);

// 2. Standalone mode kontrolü
console.log('Standalone:', 
  window.matchMedia('(display-mode: standalone)').matches
);

// 3. Manifest yüklendi mi
fetch('/manifest.webmanifest').then(r => r.json()).then(console.log);
```

---

## 🎉 Başarılı Kurulum Göstergeleri

Aşağıdakileri görüyorsan **başarılı kurulum** ✅:

1. **Ana Ekran**:
   - Luce ikonu mavi arka planda
   - "Luce" veya tam isim altında

2. **İlk Açılış**:
   - Mavi splash screen + logo
   - 1-2 saniye yükleniyor göstergesi

3. **Uygulama İçi**:
   - Tam ekran (adres çubuğu yok)
   - Status bar üstte (saat, batarya)
   - Alt navigation app içinde

4. **Davranış**:
   - Recent apps'te ayrı uygulama olarak görünür
   - Tarayıcı recent apps'ten ayrı
   - Kapat-aç hızlı (cache var)

---

## 📅 Güncellemeler

### Son Güncellemeler (Ocak 2025)
- ✅ Install butonu eklendi (login sayfası)
- ✅ Logo.png manifest'e eklendi
- ✅ display_override optimize edildi
- ✅ Theme color iyileştirildi
- ✅ Service Worker deployment fix

### Gelecek Özellikler
- 🔄 Push notifications
- 🔄 Offline data sync
- 🔄 App shortcuts (long press menu)
- 🔄 Share target API

---

## ✨ PWA Avantajları

### Kullanıcı İçin
- 📱 Tam ekran uygulama deneyimi
- 🚀 Hızlı açılış (cache)
- 📡 Offline çalışma
- 🎨 Native app görünümü
- 💾 Hafıza tasarrufu (app store'dan indirmeye gerek yok)

### Geliştirici İçin
- 🔄 Otomatik güncellemeler
- 📊 Tek kod tabanı (web + mobile)
- 🌐 Cross-platform (Android + iOS)
- 🔧 Web teknolojileri (React, Next.js)

---

## 🔗 Faydalı Linkler

- **Canlı Site**: https://luce-web.vercel.app
- **Login Sayfası**: https://luce-web.vercel.app/login
- **Manifest**: https://luce-web.vercel.app/manifest.webmanifest
- **Service Worker**: https://luce-web.vercel.app/sw.js

---

## 📝 Notlar

1. **İlk kurulum için cache temizleme kritik!**
2. **Tarayıcıyı TAMAMEN kapatıp açmak gerekir**
3. **5 dakika bekle (Vercel deployment)**
4. **Install butonu en kolay yöntem (Android)**
5. **iOS'ta sadece Safari çalışır**

---

**Başarılar! 🚀**

Herhangi bir sorun yaşarsan yukarıdaki debug adımlarını dene ve sonuçları paylaş.
