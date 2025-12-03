# 🎯 Supabase Kurulum Rehberi

## Adım 1: Database Setup

### SQL Script'i Çalıştır

1. Supabase Dashboard'u aç: https://supabase.com/dashboard
2. Projenizi seçin: `luce-workflow` veya benzeri
3. Sol menüden **SQL Editor**'ı seç
4. **New Query** butonuna tıkla
5. Aşağıdaki dosyanın içeriğini kopyala-yapıştır:
   
   📄 **File:** `scripts/setup-database.sql`

6. **Run** butonuna bas (veya Ctrl+Enter / Cmd+Enter)

### Beklenen Sonuç

SQL çalıştığında şu mesajları göreceksiniz:

```
NOTICE: ✅ Setup completed successfully!
NOTICE:    - Tables created: 7
NOTICE:    - Default roles: 5
NOTICE:    - Storage buckets: 1
NOTICE: 
NOTICE: 📝 Next steps:
NOTICE:    1. Create first company
NOTICE:    2. Invite first user (superadmin@luce.com)
NOTICE:    3. Assign Super Admin role
```

### Doğrulama

**Table Editor'da kontrol et:**
- Sol menü → **Table Editor**
- Görmelisiniz: `companies`, `roles`, `users`, `projects`, `invoices`, `invoice_project_links`, `audit_logs`

**Storage'ı kontrol et:**
- Sol menü → **Storage**
- Görmelisiniz: `invoices` bucket (🔒 Private)

---

## Adım 2: İlk Kullanıcı (Super Admin)

### 2.1: Email ile Kullanıcı Davet Et

1. Sol menü → **Authentication** → **Users**
2. **Invite user** butonuna tıkla
3. Email gir: `superadmin@luce.com`
4. **Send invite** butonuna tıkla

### 2.2: Magic Link ile Giriş Yap

1. Email'inizi kontrol edin (`superadmin@luce.com`)
2. "Confirm your mail" veya "Magic Link" email'i bulun
3. Email'deki linke tıklayın
4. Tarayıcı açılacak ve kimlik doğrulama yapılacak

### 2.3: Kullanıcıya Rol Ata

Email doğrulaması tamamlandıktan sonra:

1. Supabase Dashboard → **SQL Editor**
2. **New Query**
3. Aşağıdaki dosyanın içeriğini kopyala-yapıştır:
   
   📄 **File:** `scripts/setup-initial-user.sql`

4. **Run** butonuna bas

### Beklenen Sonuç

```
NOTICE: ✅ Luce Mimarlık şirketi oluşturuldu
NOTICE: ✅ Super Admin rolü bulundu
NOTICE: ✅ Kullanıcı bulundu
NOTICE: ✅ Kullanıcı profili oluşturuldu
NOTICE: 
NOTICE: ================================================
NOTICE: ✅ SETUP COMPLETED SUCCESSFULLY!
NOTICE: ================================================
```

Aşağıda 3 tablo görünecek:
- ✅ Company: Luce Mimarlık
- ✅ User Profile: superadmin@luce.com
- ✅ Permissions: [...Super Admin permissions...]

---

## Adım 3: Email Template Özelleştirme (Opsiyonel)

### Magic Link Email'ini Türkçeleştir

1. Sol menü → **Authentication** → **Email Templates**
2. **Magic Link** seçeneğini seç
3. Subject'i değiştir:
   ```
   Luce Mimarlık - Giriş Linkiniz
   ```
4. Body'yi özelleştir:
   ```html
   <h2>Merhaba!</h2>
   <p>Luce Mimarlık sistemine giriş yapmak için aşağıdaki linke tıklayın:</p>
   <p><a href="{{ .ConfirmationURL }}">Giriş Yap</a></p>
   <p>Bu link 1 saat geçerlidir.</p>
   <p>Bu isteği siz yapmadıysanız, bu emaili yok sayabilirsiniz.</p>
   ```
5. **Save** butonuna tıkla

---

## ✅ Kurulum Tamamlandı!

### Şimdi Ne Yapmalı?

**Local Test:**
```bash
cd luce_web
npm install
npm run dev
```

1. Tarayıcıda aç: http://localhost:3000
2. `/login` sayfasına git
3. Email gir: `superadmin@luce.com`
4. "Giriş Linki Gönder" butonuna tıkla
5. Email'deki Magic Link'e tıkla
6. Dashboard'a yönlendirileceksiniz ✨

**Kontrol Listesi:**
- [ ] Login sayfası açılıyor
- [ ] Magic Link email geliyor
- [ ] Callback sonrası dashboard yükleniyor
- [ ] Sidebar'da "Super Admin" görünüyor
- [ ] Sidebar'da "Luce Mimarlık" görünüyor
- [ ] Tüm menü itemları (Faturalar, Projeler, vb.) görünüyor

---

## 🚀 Production Deployment

Kurulum tamamlandıktan sonra:

**Windows:**
```bash
scripts\deploy.bat
```

**Mac/Linux:**
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

Veya manuel olarak `QUICKSTART.md` dosyasını takip edin.

---

## 🆘 Sorun Giderme

### "Unauthorized" Hatası
- `setup-database.sql` çalıştırıldı mı?
- RLS policies aktif mi?
- `setup-initial-user.sql` çalıştırıldı mı?

### Email Gelmiyor
- Spam klasörünü kontrol et
- Supabase → Auth → Settings → SMTP ayarlarını kontrol et
- Test email gönder: Dashboard → Auth → Users → [...] → Resend invite

### "Invalid token" Hatası
- `.env.local` dosyası doğru mu?
- Supabase URL ve Anon Key kopyala-yapıştır hatası var mı?
- Browser cache'i temizle

---

## 📞 Destek Linkleri

- **Supabase Dashboard:** https://supabase.com/dashboard
- **Supabase Docs:** https://supabase.com/docs
- **SQL Editor:** Dashboard → SQL Editor
- **Auth Settings:** Dashboard → Authentication → Settings
