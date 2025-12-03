# 🔧 Supabase Manual Configuration Guide

## ⚡ Quick Links

**Your Supabase Project:**
- Dashboard: https://supabase.com/dashboard/project/plwmqofncmkgxhushucg
- Auth Settings: https://supabase.com/dashboard/project/plwmqofncmkgxhushucg/auth/url-configuration
- Email Templates: https://supabase.com/dashboard/project/plwmqofncmkgxhushucg/auth/templates

---

## 📋 Required Configuration Steps

### ✅ Step 1: Redirect URLs

1. **Go to URL Configuration:**
   ```
   https://supabase.com/dashboard/project/plwmqofncmkgxhushucg/auth/url-configuration
   ```

2. **Add these Redirect URLs:**
   ```
   http://localhost:3000/**
   http://localhost:3000/auth/callback
   http://localhost:3000/reset-password
   ```

3. **For production (after Vercel deployment):**
   ```
   https://your-vercel-app.vercel.app/**
   https://your-vercel-app.vercel.app/auth/callback
   https://your-vercel-app.vercel.app/reset-password
   ```

---

### ✅ Step 2: Site URL

1. **Still in URL Configuration:**
   
2. **Set Site URL to:**
   ```
   http://localhost:3000
   ```

3. **For production, change to:**
   ```
   https://your-vercel-app.vercel.app
   ```

---

### ✅ Step 3: Email Provider (Verify)

1. **Go to Authentication Providers:**
   ```
   https://supabase.com/dashboard/project/plwmqofncmkgxhushucg/auth/providers
   ```

2. **Verify Email is enabled:**
   - ✅ Email should have a green checkmark
   - ✅ "Enable Email provider" should be ON
   - ✅ "Confirm email" should be ON (users verify their email)

---

### ⚙️ Step 4: Email Confirmations (Optional)

**For admin-created users (auto-confirm):**

1. **Go to Authentication Settings:**
   ```
   https://supabase.com/dashboard/project/plwmqofncmkgxhushucg/settings/auth
   ```

2. **Find "Email Confirmations"**
   - Keep "Enable email confirmations" = ✅ ON
   - This is good! Users who self-register must verify email

**Note:** When you create users via script with `email_confirm: true`, they are auto-confirmed.

---

### 📧 Step 5: Email Templates (Optional Turkish)

1. **Go to Email Templates:**
   ```
   https://supabase.com/dashboard/project/plwmqofncmkgxhushucg/auth/templates
   ```

2. **Customize "Confirm signup" template:**

**Subject:**
```
Luce Mimarlık - Email Doğrulama
```

**Body (HTML):**
```html
<h2>Merhaba!</h2>
<p>Luce Mimarlık sistemine kayıt olduğunuz için teşekkürler.</p>
<p>Email adresinizi doğrulamak için aşağıdaki linke tıklayın:</p>
<p><a href="{{ .ConfirmationURL }}">Email'imi Doğrula</a></p>
<p>Bu link 24 saat geçerlidir.</p>
<p>Eğer bu kaydı siz yapmadıysanız, bu email'i yok sayabilirsiniz.</p>
<br>
<p>Luce Mimarlık</p>
```

3. **Customize "Reset Password" template:**

**Subject:**
```
Luce Mimarlık - Şifre Sıfırlama
```

**Body (HTML):**
```html
<h2>Şifre Sıfırlama İsteği</h2>
<p>Hesabınız için şifre sıfırlama talebinde bulundunuz.</p>
<p>Yeni şifre belirlemek için aşağıdaki linke tıklayın:</p>
<p><a href="{{ .ConfirmationURL }}">Şifreyi Sıfırla</a></p>
<p>Bu link 1 saat geçerlidir.</p>
<p>Eğer bu isteği siz yapmadıysanız, hesabınız güvende - bu email'i yok sayabilirsiniz.</p>
<br>
<p>Luce Mimarlık</p>
```

---

## ✅ Verification Checklist

After configuration, verify:

- [ ] Redirect URLs include `http://localhost:3000/**`
- [ ] Site URL is `http://localhost:3000`
- [ ] Email provider is enabled
- [ ] Email confirmations are enabled
- [ ] Email templates are customized (optional)

---

## 🧪 Test the Configuration

```bash
# Create a test user
node scripts/manage-users.js create-user "test@luce.com" "test123" "Test User" "Admin"

# Try to login
# Go to: http://localhost:3000/login
# Email: test@luce.com
# Password: test123
```

---

## 🆘 Troubleshooting

### "Invalid redirect URL" error

**Solution:** Add the redirect URL to allowed list:
1. Go to: https://supabase.com/dashboard/project/plwmqofncmkgxhushucg/auth/url-configuration
2. Add `http://localhost:3000/**`

### Email not arriving

**Solution:** Check spam folder or use Supabase test SMTP:
1. Supabase uses built-in SMTP by default
2. For production, configure custom SMTP in Settings → Auth

### "Email not confirmed" error

**Solution:** Either:
- Wait for user to click email confirmation link
- Or create users via script (auto-confirmed): `email_confirm: true`

---

## 📞 Support

- **Supabase Docs:** https://supabase.com/docs/guides/auth
- **Auth Configuration:** https://supabase.com/docs/guides/auth/auth-email

---

✅ After completing these steps, your authentication system will be fully configured!
