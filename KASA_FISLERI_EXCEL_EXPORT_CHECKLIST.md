# Kasa Fişleri Excel Export Özelliği - Geliştirme Checklist

## Proje Özeti
Petty-cash (Kasa Fişleri) sayfasına, Faturalar sayfasındaki ile aynı özelliklere sahip Excel indirme özelliği eklenmesi.

## Özellikler
- ✅ Excel formatında (.xlsx) indirme
- ✅ Satır renkleri (zebra striping)
- ✅ AutoFilter (sütun filtreleme)
- ✅ Başlık satırı formatlaması (koyu mavi arka plan, beyaz yazı)
- ✅ Toplam satırı (yeşil arka plan)
- ✅ Para birimi formatlaması
- ✅ Sütun genişlikleri otomatik ayarlama
- ✅ Tarih bazlı dosya adlandırma

## Analiz Sonuçları

### Invoices Sayfası Excel Export Özellikleri
- **Kütüphane**: ExcelJS
- **Fonksiyon**: `handleExportExcel()` (satır 869)
- **Buton**: "📊 Excel İndir" (satır 1267-1270)
- **Koşul**: `assignedCount > 0` (en az 1 fatura olmalı)

### Petty-Cash Sayfası Mevcut Yapısı
- **Dosya**: `app/petty-cash/page.tsx`
- **Veri Kaynağı**: `/api/petty-cash` endpoint
- **Veri Yapısı**: 
  - transaction_name
  - amount
  - currency
  - transaction_date
  - notes
  - card_statements (ilişkili ekstre)
  - projects (ilişkili proje)

## Geliştirme Adımları

### ✅ Adım 1: Analiz ve Planlama
- [✅] Invoices sayfasındaki Excel export kodunu inceleme
- [✅] Petty-cash sayfasının mevcut yapısını anlama
- [✅] Gerekli değişiklikleri belirleme
- [✅] Checklist dosyası oluşturma

### ✅ Adım 2: Import ve Bağımlılıklar
- [✅] ExcelJS kütüphanesini petty-cash sayfasına import etme
- [✅] Gerekli türleri kontrol etme

### ✅ Adım 3: Excel Export Fonksiyonu Oluşturma
- [✅] `handleExportExcel()` fonksiyonunu ekleme
- [✅] Veri dönüşüm mantığını yazma (PettyCashReceipt -> Excel satırları)
- [✅] Başlık satırını formatlama
- [✅] Veri satırlarını formatlama (zebra striping)
- [✅] Toplam satırını ekleme
- [✅] AutoFilter özelliğini ekleme
- [✅] Sütun genişliklerini ayarlama
- [✅] Dosya adlandırma ve indirme işlemi

### ✅ Adım 4: UI Güncelleme
- [✅] Excel indirme butonunu ekleme
- [✅] Buton konumunu belirleme (Header sağ tarafına eklendi)
- [✅] Buton görünürlük koşulunu ekleme (data.items.length > 0)

### 🔄 Adım 5: Test ve Kontrol
- [ ] Sayfayı tarayıcıda açma
- [ ] Excel dosyasını indirme
- [ ] Satır renklerini kontrol etme
- [ ] Filter özelliğini test etme
- [ ] Toplam hesaplamalarını doğrulama
- [ ] Para birimi formatını kontrol etme
- [ ] Farklı proje filtrelerini test etme

## Teknik Detaylar

### Excel Sütun Yapısı (Planlanan)
1. **Sıra**: Satır numarası
2. **İşlem Adı**: transaction_name
3. **Proje**: projects.name
4. **Tutar**: amount (TL formatında)
5. **Tarih**: transaction_date
6. **Ekstre**: card_statements.file_name
7. **Kart**: Son 4 hane
8. **Notlar**: notes

### Renk Şeması (Invoices ile aynı)
- **Başlık Satırı**: `#4472C4` (Mavi) - Beyaz yazı
- **Çift Satırlar**: `#F2F2F2` (Açık gri)
- **Tek Satırlar**: `#FFFFFF` (Beyaz)
- **Toplam Satırı**: `#2E7D32` (Yeşil) - Beyaz yazı

### Dosya Adlandırma
Format: `KasaFisleri_YYYY-MM-DD_[ProjeFiltreAdi].xlsx`

## Kod Referansları

### Invoices Excel Export (Referans)
- **Dosya**: `app/invoices/page.tsx`
- **Satırlar**: 869-1138
- **Önemli Özellikler**:
  - Zebra striping (869-1051)
  - AutoFilter (1109-1112)
  - Toplam satırı (1053-1107)
  - Dosya indirme (1124-1132)

### Petty-Cash Mevcut Kod
- **Dosya**: `app/petty-cash/page.tsx`
- **Veri Yükleme**: `loadData()` fonksiyonu (satır 74-103)
- **Tablo Render**: Satır 213-278

## Notlar ve İyileştirmeler

### Ek Özellikler (Opsiyonel)
- [ ] Yalnızca seçili satırları export etme
- [ ] Tarih aralığı filtreleme
- [ ] Çoklu para birimi desteği
- [ ] Grafik ekleme

### Performans Düşünceleri
- ExcelJS büyük veri setleri için optimize edilmiştir
- Sayfalama mevcut (20 kayıt/sayfa)
- Tüm verileri export etmek için API'ye pagination olmadan istek yapılmalı mı? (Şu an sadece mevcut sayfadaki veriler export edilecek)

## İmplementasyon Notları

### API Değişikliği Gerekli mi?
Mevcut `/api/petty-cash` endpoint pagination ile çalışıyor. Eğer **TÜM** kasa fişlerini export etmek isteniyorsa:
- Option 1: API'ye `limit=all` parametresi eklemek
- Option 2: Yalnızca ekranda görünen verileri export etmek (Invoices sayfası gibi)

**Karar**: Invoices sayfası gibi, yalnızca ekranda görünen (filtrelenmiş) verileri export et.

## Tamamlanma Durumu

- **Başlangıç**: 04.03.2026
- **Durum**: ✅ Tamamlandı (Test Aşamasında)
- **Tamamlanan**: %95 (Kod implementasyonu tamamlandı, test bekliyor)
- **Kalan**: Kullanıcı testi

## Yapılan İşlemler Özeti

### 1. ExcelJS Kütüphanesi Eklendi
```tsx
import ExcelJS from 'exceljs';
```

### 2. handleExportExcel() Fonksiyonu Oluşturuldu
- **Satır**: 112-318
- **Özellikler**:
  - Veri dönüşümü (PettyCashReceipt -> Excel formatı)
  - 8 sütunlu yapı: Sıra, İşlem Adı, Proje, Tutar, Tarih, Ekstre, Kart, Notlar
  - Zebra striping (tek/çift satır renkleri)
  - Başlık satırı formatlaması (mavi arka plan)
  - Toplam satırı (yeşil arka plan)
  - AutoFilter özelliği
  - Dosya adlandırma (proje filtresine göre dinamik)

### 3. Excel İndir Butonu Eklendi
- **Konum**: Header sağ tarafı
- **Görünürlük Koşulu**: `data.items.length > 0`
- **Icon**: 📊 Excel İndir
- **Variant**: ghost

### 4. Excel Dosyası Özellikleri
- **Format**: .xlsx
- **Dosya Adı**: `KasaFisleri_YYYY-MM-DD_[ProjeAdi].xlsx`
- **Worksheet Adı**: "Kasa Fişleri"
- **Alfabetik Sıralama**: Hayır (ekranda görünen sırayla)
- **Toplam Hesaplama**: Evet (tüm tutarların toplamı)

## Test Senaryoları

Aşağıdaki senaryoları test etmeniz önerilir:

1. **Boş Liste**: Hiç kasa fişi yokken butonun görünmemesi
2. **Veri ile Liste**: Kasa fişi varken butonun görünmesi
3. **Excel İndirme**: Butona tıkladığınızda dosyanın indirilmesi
4. **Satır Renkleri**: Tek satırlar beyaz, çift satırlar açık gri
5. **Başlık Formatı**: Mavi arka plan, beyaz yazı, kalın
6. **Toplam Satırı**: Yeşil arka plan, doğru toplam hesaplama
7. **Para Birimi**: TL sembolü ve virgül formatı
8. **AutoFilter**: Her sütunda filtre dropdown'u
9. **Proje Filtresi**: Proje seçiliyken dosya adında proje isminin olması
10. **Sütun Genişlikleri**: Tüm verilerin rahatça görünmesi

---

**Son Güncelleme**: 04.03.2026 - İmplementasyon Tamamlandı
**Geliştirici**: GitHub Copilot
