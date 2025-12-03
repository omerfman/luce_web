# 🤖 Otomatik Kullanıcı Yönetimi Rehberi

## 🎯 Hazırlık (Bir Kerelik)

### Adım 1: Service Role Key Al

1. **Supabase Dashboard'a git:**
   ```
   https://supabase.com/dashboard/project/plwmqofncmkgxhushucg/settings/api
   ```

2. **"service_role" key'i kopyala:**
   - Sayfada "Project API keys" bölümünü bul
   - `service_role` → **"Reveal"** butonuna tıkla
   - Key'i kopyala (eyJ... ile başlar)

3. **`.env.local` dosyasına ekle:**
   ```bash
   # Dosyayı aç: .env.local
   # En alt satıra ekle:
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

✅ **Artık otomatik scriptler çalışacak!**

---

## 🚀 Kullanım

### Windows (PowerShell)

#### Kullanıcıya Rol Ata
```powershell
.\scripts\manage-users.ps1 -Command assign-role -Email "user@example.com" -Role "Admin"
```

**Parametreler:**
- `-Email`: Kullanıcı email'i (zorunlu)
- `-Role`: Rol adı (varsayılan: "Super Admin")
- `-CompanyName`: Şirket adı (varsayılan: "Luce Mimarlık")

**Örnekler:**
```powershell
# Super Admin ata
.\scripts\manage-users.ps1 -Command assign-role -Email "admin@luce.com"

# Muhasebeci ata
.\scripts\manage-users.ps1 -Command assign-role -Email "accountant@luce.com" -Role "Muhasebeci"

# Başka şirkete kullanıcı ata
.\scripts\manage-users.ps1 -Command assign-role -Email "user@other.com" -Role "Admin" -CompanyName "Other Company"
```

#### Kullanıcıları Listele
```powershell
.\scripts\manage-users.ps1 -Command list-users
```

Çıktı:
```
Email                    Name              Role         Active  Created
-----                    ----              ----         ------  -------
admin@luce.com          Admin User        Super Admin  ✅      03/12/2025
user@luce.com           Regular User      Muhasebeci   ✅      03/12/2025
```

#### Yeni Şirket Oluştur
```powershell
.\scripts\manage-users.ps1 -Command create-company -CompanyName "Yeni Şirket" -TaxNumber "1234567890" -Address "İstanbul" -Phone "+905551234567" -CompanyEmail "info@yeni.com"
```

---

### Node.js (Cross-platform)

#### Kullanıcıya Rol Ata
```bash
node scripts/manage-users.js assign-role user@example.com "Admin"
```

#### Kullanıcıları Listele
```bash
node scripts/manage-users.js list-users
```

#### Yeni Şirket Oluştur
```bash
node scripts/manage-users.js create-company "Yeni Şirket"
```

---

## 📋 Kullanım Senaryoları

### Senaryo 1: Yeni Çalışan Ekleme

```powershell
# 1. Supabase Dashboard'dan email ile davet gönder
# https://supabase.com/dashboard/project/plwmqofncmkgxhushucg/auth/users
# "Invite user" → Email gir

# 2. Kullanıcı Magic Link'e tıklayıp ilk girişi yapsın

# 3. Otomatik rol ataması:
.\scripts\manage-users.ps1 -Command assign-role -Email "yeni-calisan@luce.com" -Role "Proje Yöneticisi"

# ✅ Bitti! Kullanıcı artık sistemi kullanabilir
```

### Senaryo 2: Rol Değiştirme

```powershell
# Muhasebeci → Admin'e yükseltme
.\scripts\manage-users.ps1 -Command assign-role -Email "user@luce.com" -Role "Admin"
```

### Senaryo 3: Toplu Kullanıcı Kontrolü

```powershell
# Tüm kullanıcıları listele
.\scripts\manage-users.ps1 -Command list-users

# Çıktı:
# Email                Role           Active
# admin@luce.com      Super Admin    ✅
# user1@luce.com      Muhasebeci     ✅
# user2@luce.com      Admin          ❌  (deaktif)
```

---

## 🔒 Güvenlik Notları

### ⚠️ Service Role Key

**ÇOK ÖNEMLİ:**
- Service role key **tüm RLS politikalarını bypass eder**
- Bu key ile veritabanında **her şey** yapılabilir
- **ASLA** client-side kodda kullanmayın
- **ASLA** Git'e commit etmeyin
- Sadece server-side ve local scriptlerde kullanın

**`.gitignore` kontrol:**
```bash
# Bu satırlar .gitignore'da olmalı:
.env.local
.env*.local
.env
```

### ✅ Güvenli Kullanım

- ✅ Local development scriptleri (.env.local)
- ✅ Server-side API routes (Next.js API)
- ✅ CI/CD environment variables (Vercel secrets)
- ❌ Client-side components
- ❌ Public repositories
- ❌ Frontend JavaScript

---

## 🛠️ Sorun Giderme

### "Service Role Key not found"

```powershell
# .env.local dosyasını kontrol et:
Get-Content .env.local | Select-String "SERVICE_ROLE"

# Çıktı olmalı:
# SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

Yoksa [Adım 1](#adım-1-service-role-key-al)'e dön.

### "User not found in auth.users"

Kullanıcı önce sisteme giriş yapmalı:
1. Email davet gönderin (Supabase Dashboard)
2. Kullanıcı Magic Link'e tıklasın
3. İlk giriş yapsın
4. Sonra scripti çalıştırın

### PowerShell Execution Policy Hatası

```powershell
# Eğer "cannot be loaded because running scripts is disabled" hatası alırsanız:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 🎓 Gelişmiş Kullanım

### TypeScript API (Server-side)

```typescript
// lib/supabase/admin.ts kullanımı

import { assignUserRole, listCompanyUsers } from '@/lib/supabase/admin';

// API Route'da kullan:
export async function POST(request: Request) {
  const { email, role } = await request.json();
  
  await assignUserRole(email, 'Luce Mimarlık', role);
  
  return Response.json({ success: true });
}
```

### Toplu İşlem (Batch)

```powershell
# Birden fazla kullanıcıya aynı rolü ata
$users = @("user1@luce.com", "user2@luce.com", "user3@luce.com")

foreach ($email in $users) {
    .\scripts\manage-users.ps1 -Command assign-role -Email $email -Role "Görüntüleyici"
    Start-Sleep -Seconds 1  # Rate limiting
}
```

---

## 📞 Destek

**Scriptler çalışmıyorsa:**
1. `.env.local` dosyasında Service Role Key var mı?
2. PowerShell execution policy ayarlandı mı?
3. Node.js yüklü mü? (`node --version`)

**Hata mesajları:**
- "Unauthorized" → Service Role Key yanlış
- "Not found" → Kullanıcı/şirket/rol bulunamadı
- "CORS error" → Bu script sadece server-side çalışır

---

✅ **Artık kullanıcı yönetimini terminal'den yapabilirsiniz!**
