# Subcontractors Trigger Hatası Düzeltme Kılavuzu

## Sorun
Informal payments sayfasında yeni sözleşmeli ödeme oluştururken şu hata alınıyor:
```
Hata: record "new" has no field "created_by"
```

## Neden
`log_subcontractor_changes()` trigger fonksiyonu, `subcontractors` tablosunda var olmayan `created_by` alanına erişmeye çalışıyor.

## Çözüm
Migration dosyası oluşturuldu: `20260120_fix_subcontractor_trigger_created_by.sql`

## Adım Adım Uygulama

### Yöntem 1: Supabase Dashboard ile (Önerilen)

1. **Supabase Dashboard'a giriş yapın**
   - https://supabase.com/dashboard adresine gidin
   - Luce Web projenizi seçin

2. **SQL Editor'ı açın**
   - Sol menüden "SQL Editor" seçeneğine tıklayın

3. **Migration dosyasını kopyalayın**
   - `supabase/migrations/20260120_fix_subcontractor_trigger_created_by.sql` dosyasının içeriğini kopyalayın

4. **SQL'i çalıştırın**
   - SQL Editor'a yapıştırın
   - "Run" butonuna basın
   - ✅ başarı mesajını bekleyin

### Yöntem 2: Supabase CLI ile

Eğer Supabase CLI kurulu ise:

```powershell
cd "d:\islerim\Luce Mimarlık\web_site\luce_web"

# Migration'ı production'a uygula
supabase db push --linked
```

## Doğrulama

Migration uygulandıktan sonra:

1. https://luce-web.vercel.app/informal-payments sayfasına gidin
2. Yeni bir sözleşmeli ödeme oluşturmayı deneyin
3. "Kaydet ve Sözleşme Oluştur" butonuna basın
4. Hata almamalısınız

## Teknik Detaylar

### Değişiklik
`log_subcontractor_changes()` trigger fonksiyonundan `created_by` alanı referansları kaldırıldı.

**Eski Kod:**
```sql
IF NEW.created_by IS NOT NULL THEN
  SELECT name INTO v_created_by_name FROM users WHERE id = NEW.created_by;
  IF v_created_by_name IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{new,created_by_name}', to_jsonb(v_created_by_name));
  END IF;
END IF;
```

**Yeni Kod:**
```sql
-- Note: created_by field does not exist in subcontractors table
-- User info is captured via auth.uid() in v_user_id
```

Kullanıcı bilgisi zaten `auth.uid()` ile `v_user_id` değişkeninde yakalanıyor, `created_by` alanına gerek yok.

## İlgili Dosyalar
- `supabase/migrations/20260120_fix_subcontractor_trigger_created_by.sql` - Düzeltme migration'ı
- `lib/supabase/supplier-management.ts` - Subcontractor oluşturma fonksiyonu
- `components/informal-payments/ContractPaymentModal.tsx` - Form komponenti

## Notlar
- Bu değişiklik geriye dönük uyumludur
- Mevcut subcontractor kayıtları etkilenmez
- Activity logs sistemi normal çalışmaya devam eder
