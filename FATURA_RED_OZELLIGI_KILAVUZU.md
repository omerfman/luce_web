# Fatura Red Özelliği Kullanım Kılavuzu

## 📋 Genel Bakış

Fatura Red özelliği, hatalı veya yanlış hizmet/ücret içeren faturaları sisteme işaretleyip geçersiz kılmanızı sağlar. Reddedilen faturalar:
- ❌ Geçersiz sayılır
- 🚫 Hiçbir hesaba dahil edilmez
- 📊 Dashboard ve raporlarda ayrı gösterilir
- 🔄 Geri alınabilir (ihtiyaç halinde)

---

## 🎯 Kullanım Alanları

### Ne Zaman Bir Faturayı Reddetmelisiniz?

1. **Hatalı Fatura Bilgileri**
   - Yanlış tutar yazılmış
   - KDV hesabı hatalı
   - Tevkifat tutarı yanlış

2. **Yanlış Hizmet/Ürün**
   - Talep edilmeyen bir hizmet için fatura kesilmiş
   - Yanlış tedarikçiden gelen fatura
   - Mükerrer (duplicate) fatura

3. **Anlaşmazlık**
   - Tedarikçi ile anlaşmazlık olan fatura
   - İtiraz edilen fatura tutarı

---

## 🔧 Nasıl Kullanılır?

### 1️⃣ Fatura Reddetme

#### Adım 1: Faturalar Sayfasına Gidin
```
https://luce-web.vercel.app/invoices
```

#### Adım 2: Reddetmek İstediğiniz Faturayı Bulun
- Fatura listesinde ilgili faturayı bulun
- Sağ taraftaki **İşlemler** sütununda "**Reddet**" butonuna tıklayın

#### Adım 3: Red Sebebini Girin
- Açılan modal'da fatura bilgilerini kontrol edin
- **Red Sebebi** alanına detaylı bir açıklama girin
  - ✅ İyi örnek: "KDV tutarı yanlış hesaplanmış. 18% yerine 20% uygulanmış."
  - ✅ İyi örnek: "Bu hizmet için onay verilmedi, yanlış firma tarafından kesilmiş."
  - ❌ Kötü örnek: "Yanlış" (çok kısa ve belirsiz)

#### Adım 4: Onayla
- "**Faturayı Reddet**" butonuna tıklayın
- Fatura artık reddedildi olarak işaretlenecek

---

### 2️⃣ Fatura Reddini Geri Alma

Eğer hatalı red işlemi yaptıysanız veya durum düzeldiyse:

#### Adım 1: Reddedilen Faturalar Sekmesine Gidin
- Faturalar sayfasında üstteki "**Reddedilen Faturalar**" sekmesine tıklayın

#### Adım 2: Geri Almak İstediğiniz Faturayı Bulun
- İlgili faturanın yanındaki "**Geri Al**" butonuna tıklayın

#### Adım 3: Onayla
- Onay dialogunda "**Evet**" seçeneğini seçin
- Fatura normal duruma geri dönecek

---

## 📊 Reddedilen Faturaları Görüntüleme

### Dashboard'da
Ana dashboard'da (**https://luce-web.vercel.app/dashboard**):
- "**Reddedilen Faturalar**" kartında toplam sayı ve tutar görüntülenir
- Karta tıklayarak doğrudan reddedilen faturalar listesine gidebilirsiniz

### Faturalar Sayfasında
- "**Reddedilen Faturalar**" sekmesi altında tüm reddedilen faturalar listelenir
- Her faturanın yanında red sebebi gösterilir
- Kırmızı arka plan ile işaretlenmiştir

### Proje Özeti Sayfasında
Her proje için (**https://luce-web.vercel.app/projects/[id]**):
- ❌ **Reddedilen Faturalar** kartı gösterilir (eğer varsa)
- Proje bazında reddedilen fatura sayısı ve toplam tutar
- "Bu faturalar geçersiz sayılır ve hesaplamalara dahil edilmez" notu

### Tedarikçi Özeti Sayfasında
Her tedarikçi için (**https://luce-web.vercel.app/suppliers/[id]**):
- ❌ **Reddedilen** kartı gösterilir (eğer varsa)
- Tedarikçi bazında reddedilen fatura sayısı ve toplam tutar
- "Geçersiz faturalar" etiketi

---

## 🔐 Yetkiler

### Kim Fatura Reddedebilir?
- ✅ `invoices.update` yetkisine sahip kullanıcılar
- ✅ Şirket Yöneticileri
- ✅ Muhasebe personeli (genellikle)

### Kim Red İşlemini Geri Alabilir?
- ✅ `invoices.update` yetkisine sahip kullanıcılar
- ✅ Aynı yetkiler reddetme ile aynı

---

## 📈 Hesaplamalara Etkisi

### Reddedilen Faturalar HANGİ Hesaplamalara DAHİL DEĞİLDİR?

1. **Dashboard İstatistikleri**
   - Toplam fatura tutarı
   - Bu ay toplam harcama
   - Genel bakış rakamları

2. **Proje Özeti**
   - Proje toplam maliyeti
   - Net bakiye hesabı
   - Tedarikçi bazlı harcama tablosu

3. **Tedarikçi Özeti**
   - Tedarikçi toplam cirosu
   - Net bakiye (eğer hem supplier hem subcontractor ise)

4. **Raporlar ve Excel Export**
   - Proje fatura raporları
   - Excel çıktıları

### Reddedilen Faturalar NEREDE GÖSTERİLİR?

- ✅ Dashboard'da ayrı bir kart olarak
- ✅ Proje özetinde ayrı bir kart olarak (varsa)
- ✅ Tedarikçi özetinde ayrı bir kart olarak (varsa)
- ✅ Faturalar sayfasında "Reddedilen Faturalar" sekmesinde

---

## 🗄️ Teknik Detaylar

### Database Yapısı
Faturalar tablosuna eklenen alanlar:
```sql
is_rejected         BOOLEAN    -- Fatura reddedildi mi?
rejection_reason    TEXT       -- Red sebebi
rejected_by         UUID       -- Reddeden kullanıcı ID
rejected_at         TIMESTAMPTZ -- Reddedilme zamanı
```

### API Endpoints

#### Fatura Reddet
```http
POST /api/invoices/[id]/reject
Content-Type: application/json

{
  "rejection_reason": "Red sebebi açıklaması"
}
```

#### Fatura Reddini Geri Al
```http
DELETE /api/invoices/[id]/reject
```

### Aktivite Logları
Her red ve geri alma işlemi `activity_logs` tablosuna kaydedilir:
- İşlem yapan kullanıcı
- İşlem zamanı
- Red sebebi (metadata'da)

---

## 💡 İpuçları ve En İyi Uygulamalar

### ✅ Yapılması Gerekenler

1. **Detaylı Red Sebebi Yazın**
   - Net ve anlaşılır olsun
   - İleride referans alınabilecek bilgiler ekleyin
   - Örnek: "24.12.2025 tarihli toplantıda iptal edilen X hizmeti için kesilmiş"

2. **Reddedilen Faturaları Düzenli Kontrol Edin**
   - Dashboard'daki "Reddedilen Faturalar" kartını takip edin
   - Gerekirse tedarikçi ile iletişime geçin

3. **Alternatif Düşünün**
   - Faturayı tamamen silmek yerine reddetmeyi tercih edin
   - Red işlemi geri alınabilir, silme kalıcıdır

### ❌ Yapılmaması Gerekenler

1. **Gereksiz Red İşlemi**
   - Küçük hatalar için reddetme yerine düzenleme yapın
   - Red işlemi ciddi durumlar için kullanılmalı

2. **Belirsiz Red Sebebi**
   - "Yanlış", "Hata" gibi çok genel ifadeler kullanmayın
   - Gelecekte bu bilgiye ihtiyaç duyulabilir

3. **İletişimsiz Red**
   - Tedarikçiyi bilgilendirmeden fatura reddetmeyin
   - Red sebebini tedarikçi ile paylaşın

---

## 🆘 Sık Sorulan Sorular

### S: Reddedilen faturayı silebilir miyim?
**C:** Evet, `invoices.delete` yetkiniz varsa silebilirsiniz. Ancak silme kalıcıdır ve geri alınamaz. Red işlemi daha güvenlidir.

### S: Reddedilen fatura proje ile ilişkilendirilmiş olabilir mi?
**C:** Evet. Reddedilen bir fatura hala projeye atanmış olabilir ama hesaplamalara dahil edilmez.

### S:Red sebebini sonradan değiştirebilir miyim?
**C:** Hayır, şu anda red sebebi düzenlenemez. İhtiyaç halinde redi geri alıp yeniden reddetmeniz gerekir.

### S: Reddedilen faturanın ödeme kayıtları ne olur?
**C:** Ödeme kayıtları silinmez, fakat bu ödemeler de hesaplamalara dahil edilmez.

### S: Red işlemini kim yaptı nasıl öğrenirim?
**C:** Aktivite loglarına (`activity_logs` tablosu) bakarak hangi kullanıcının ne zaman reddettiğini görebilirsiniz.

---

## 📁 İlgili Dosyalar

### Frontend
- `app/invoices/page.tsx` - Fatura listesi ve red UI
- `app/dashboard/page.tsx` - Dashboard reddedilen fatura kartı
- `app/projects/[id]/page.tsx` - Proje özeti reddedilen fatura kartı
- `app/suppliers/[id]/page.tsx` - Tedarikçi özeti reddedilen fatura kartı

### Backend
- `app/api/invoices/[id]/reject/route.ts` - Red API endpoint
- `app/api/dashboard/stats/route.ts` - Dashboard istatistikleri
- `app/api/projects/[id]/summary/route.ts` - Proje özeti API
- `app/api/suppliers/[id]/summary/route.ts` - Tedarikçi özeti API

### Database
- `supabase/migrations/20260210_add_invoice_rejection_fields.sql` - Migration

### Types
- `types/index.ts` - Invoice type definition (rejection fields)

---

## 🚀 Sonraki Adımlar

Bu özellik başarıyla uygulandı ve aşağıdaki alanlarda çalışmaktadır:
- ✅ Fatura reddetme ve geri alma
- ✅ Dashboard'da gösterim
- ✅ Proje özetinde gösterim
- ✅ Tedarikçi özetinde gösterim
- ✅ Hesaplamalardan hariç tutma

### Gelecek İyileştirmeler (Opsiyonel)
- [ ] Red sebebini düzenleyebilme
- [ ] Toplu red işlemi
- [ ] Red onay süreci (approval workflow)
- [ ] E-posta bildirimi (tedarikçiye)
- [ ] Red istatistikleri raporu

---

## 📞 Destek

Herhangi bir sorunla karşılaşırsanız veya öneriniz varsa lütfen bizimle iletişime geçin.

**Tarih:** 10 Şubat 2026  
**Versiyon:** 1.0  
**Durum:** ✅ Aktif ve Kullanıma Hazır
