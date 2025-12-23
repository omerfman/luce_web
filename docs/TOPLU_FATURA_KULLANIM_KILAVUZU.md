# Toplu Fatura Ekleme Sistemi - Kullanım Kılavuzu

## 📋 Genel Bakış

Toplu fatura ekleme sistemi, birden fazla PDF faturayı aynı anda sisteme yüklemenize, QR kodlarından bilgileri otomatik olarak okumanıza ve toplu kayıt yapmanıza olanak tanır.

## 🚀 Nasıl Kullanılır?

### 1. Toplu Fatura Ekle Butonuna Tıklayın

Faturalar sayfasında, sağ üst köşede bulunan **"📦 Toplu Fatura Ekle"** butonuna tıklayın.

### 2. PDF Dosyalarını Yükleyin

Modal açıldığında, iki şekilde dosya yükleyebilirsiniz:

- **Sürükle-Bırak:** PDF dosyalarınızı doğrudan yükleme alanına sürükleyin
- **Tıklayarak Seç:** Yükleme alanına tıklayın ve bilgisayarınızdan dosyaları seçin

**Özellikler:**
- Maksimum 50 dosya aynı anda yüklenebilir
- Her dosya maksimum 10MB olabilir
- Sadece PDF formatı kabul edilir

### 3. Otomatik QR Okuma

Dosyalar yüklendikten sonra sistem:

1. ✅ Her PDF'deki QR kodunu otomatik olarak tarar
2. ✅ Fatura numarası, tarihi, tutarlar gibi bilgileri çıkarır
3. ✅ VKN'den firma adını otomatik bulur (eğer daha önce sisteme eklenmişse)
4. ✅ Tüm bilgileri tabloda gösterir

**İşlem Durumları:**
- 🟦 **İşleniyor:** QR kod okunuyor
- 🟢 **QR Okundu:** Başarıyla okundu, bilgiler dolduruldu
- 🟡 **QR Okunamadı:** Manuel bilgi girişi gerekiyor

### 4. İstatistikleri İnceleyin

Üst kısımda 5 adet istatistik kartı görürsünüz:

- **Toplam:** Yüklenen toplam fatura sayısı
- **QR Okundu:** QR başarıyla okunan faturalar (başarı oranı ile)
- **QR Okunamadı:** Manuel giriş gerektiren faturalar
- **Hazır:** Kaydedilmeye hazır faturalar
- **Eksik Bilgi:** Hala eksik bilgi olan faturalar

### 5. Bilgileri Kontrol Edin ve Düzenleyin

Tablo üzerinde her fatura için aşağıdaki bilgileri görebilir ve düzenleyebilirsiniz:

| Alan | Açıklama | Gerekli |
|------|----------|---------|
| **Fatura No** | Fatura numarası | ✅ Evet |
| **Tarih** | Fatura tarihi | ✅ Evet |
| **Tedarikçi** | Firma adı | ✅ Evet |
| **VKN** | Vergi Kimlik No | ❌ İsteğe bağlı |
| **Mal/Hizmet** | KDV hariç tutar | ❌ İsteğe bağlı |
| **KDV** | KDV tutarı | ❌ İsteğe bağlı |
| **Toplam** | Genel toplam | ✅ Evet |

**Kırmızı hücreler:** Eksik veya hatalı bilgi içeren alanları gösterir.

### 6. VKN Bazlı Toplu Güncelleme

🎯 **Önemli Özellik:** Aynı VKN'ye sahip birden fazla fatura varsa:

1. Herhangi birinin **Tedarikçi** alanını doldurun
2. Sistem, aynı VKN'li **TÜM faturalarda** otomatik olarak tedarikçi adını güncelleyecektir
3. Bu sayede tekrar tekrar aynı firma adını girmenize gerek kalmaz

**Örnek:**
- 3 fatura aynı VKN'ye sahip (1234567890)
- İlk faturanın tedarikçi adını "ABC İnşaat Ltd." olarak girin
- Diğer 2 fatura da otomatik olarak "ABC İnşaat Ltd." olarak güncellenecektir

### 7. QR Okunamayan Faturalar

QR kodu okunamayan faturalar için:

1. ⚠️ Sarı renkte "QR Okunamadı" durumu görünür
2. PDF dosyası tabloda listelenmiştir
3. Tüm bilgileri **manuel olarak** girin
4. Gerekli alanları doldurduktan sonra fatura hazır hale gelir

### 8. Faturaları Kaydedin

Tüm faturalar hazır olduğunda:

1. Alt kısımdaki **"Faturaları Ekle (X)"** butonuna tıklayın
   - (X) = Kaydedilecek fatura sayısı
2. Sistem her faturayı sırayla kaydedecektir
3. Başarılı kayıtlar ✅ işareti ile gösterilir
4. Hata olan kayıtlar ❌ ile bildirilir

**Duplicate Kontrolü:**
- Sistem aynı fatura numarasını iki kez kaydetmez
- Eğer bir fatura numarası zaten sistemde varsa, o fatura atlanır ve hata mesajı gösterilir

### 9. Sonuç Bildirimi

Kayıt işlemi tamamlandığında:

- ✅ **Başarılı:** "X fatura başarıyla eklendi!" mesajı görünür
- ⚠️ **Kısmi Başarı:** Başarısız faturalar detaylı olarak listelenir
- ❌ **Hata:** Tüm hatalar açıkça gösterilir

## 💡 İpuçları ve En İyi Uygulamalar

### 1. QR Kod Kalitesi
- E-fatura PDF'lerinde QR kod genellikle ilk sayfadadır
- Taranmış (scan) PDF'lerde QR okuma başarısız olabilir
- Orijinal e-fatura PDF'lerini kullanın

### 2. Toplu İşlemler
- İlk seferde 5-10 faturayla test edin
- Sonra daha büyük grupları yükleyin
- Çok büyük dosyalar (>5MB) işlem süresini uzatabilir

### 3. VKN Yönetimi
- İlk kullanımda VKN'leri manuel girin
- Sistem VKN'leri cache'ler
- Bir sonraki seferde aynı VKN'ler otomatik tanınır

### 4. Hata Yönetimi
- Kırmızı işaretli alanları kontrol edin
- "Eksik Bilgi" sayısı 0 olmalıdır
- Şüpheli tutarları manuel kontrol edin

### 5. Performans
- Çok sayıda dosya yüklerken sabırlı olun
- QR okuma işlemi 3'er 3'er paralel çalışır
- Ortalama işlem süresi: 1-2 saniye/fatura

## 🔧 Teknik Detaylar

### Desteklenen QR Formatları
- Türkiye e-fatura standartı (GIB)
- TICARIFATURA, TEMELFATURA senaryoları
- SATIS, ALIS fatura tipleri

### Okunan QR Bilgileri
- VKN (vkntckn)
- Alıcı VKN (avkntckn)
- Fatura No (faturano)
- Tarih (tarih)
- Tutar (topkdvdahil)
- KDV Tutarı (hesaplanankdv)
- ETTN (E-Fatura UUID)
- Para Birimi (TRY, USD, EUR)

### Güvenlik
- Tüm dosyalar güvenli storage'a yüklenir
- SQL injection koruması
- Duplicate prevention
- Permission-based access control

## ❓ Sık Sorulan Sorular

**S: QR okunamadı, ne yapmalıyım?**
C: PDF taranmış bir belge olabilir. Bilgileri manuel olarak girin. Orijinal e-fatura PDF'sini kullanmayı deneyin.

**S: Aynı faturayı iki kez yükleyebilir miyim?**
C: Hayır. Sistem fatura numarasına göre duplicate kontrolü yapar ve aynı numarayı iki kez kaydetmez.

**S: Kaç tane fatura birden yükleyebilirim?**
C: Maksimum 50 fatura yükleyebilirsiniz. Daha fazlası için birkaç kez işlem yapın.

**S: VKN otomatik dolduruluyor mu?**
C: QR okuma başarılıysa VKN otomatik doldurulur. Firma adı daha önce sisteme girilmişse o da otomatik gelir.

**S: Toplu eklenen faturaları projelere atayabilir miyim?**
C: Evet. Faturalar eklendikten sonra, faturalar sayfasından her bir faturaya proje atayabilirsiniz.

**S: İşlemi iptal edebilir miyim?**
C: Evet. Modal kapatıldığında tüm veriler sıfırlanır. Kaydetmeden çıkarsanız hiçbir şey kaydedilmez.

## 📞 Destek

Sorun yaşarsanız:
1. Tarayıcı console'unu açın (F12)
2. Hata mesajlarını kontrol edin
3. Sistem yöneticinize başvurun
4. Gerekirse orijinal PDF dosyalarınızı paylaşın

---

**Sürüm:** 1.0
**Tarih:** 23 Aralık 2024
**Hazırlayan:** Luce Mimarlık Geliştirme Ekibi
