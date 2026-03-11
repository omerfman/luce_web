# CARİ HESAP SİSTEMİ GELİŞTİRME CHECKLIST

## 📋 PROJE ÖZETİ

### Problem Tanımı
Bazı firmalar ödemeyi parça parça alıyor ancak faturayı toplu kesiyor (ya da tersi). Bu durumda kredi kartı ekstresi detayında her ödeme ile her faturayı birebir eşleştirmek mümkün olmuyor. 

**Örnek Senaryo:**
- 3 Ödeme: 1.000₺ + 1.500₺ + 2.000₺ = 4.500₺
- 1 Fatura: 4.500₺ (Toplam)

Ya da tersi:
- 1 Ödeme: 5.000₺
- 2 Fatura: 3.000₺ + 2.000₺ = 5.000₺

### Çözüm: Cari Hesap Sistemi
Belirli firmaları "Cari Hesap" olarak işaretleyeceğiz. Bu firmalar için:
- Ödemelerin toplam tutarı ile faturaların toplam tutarı karşılaştırılacak
- Bakiye hesaplanacak (toplam ödemeler - toplam faturalar)
- Hareket geçmişi görsel tablo ile gösterilecek
- Açık olup olmadığı tespit edilecek

### Piyasa Analizi - Cari Hesap Sistemleri Nasıl Çalışır?

1. **Muhasebe Programları (Netsis, Logo, ETA)**
   - Borç/Alacak mantığı
   - Tarih bazlı hareket kayıtları
   - Kümülatif bakiye gösterimi
   - Renk kodlu bakiye durumu

2. **Excel Tabanlı Sistemler**
   - Basit tablo yapısı: Tarih | Belge | Borç | Alacak | Bakiye
   - Son satırda toplam

3. **Modern SaaS Uygulamaları (Parasut, e-Fatura)**
   - Widget/Kart bazlı görsel gösterim
   - Filtre ve arama özellikleri
   - PDF/Excel export
   - Mobil uyumluluk

### Hedef Kullanıcı Deneyimi

**Kredi Kartı Ekstresi Detay Sayfasında:**
- Firma cari hesap olarak işaretliyse, eşleştirme sırasında uyarı göster
- "Bu firma cari hesaptır, toplam ödemeler ve faturalar karşılaştırılacak" mesajı
- Cari hesap detayını göster butonu

**Supplier Detay Sayfasında:**
- Cari hesap toggle switch'i
- Cari hesap aktifse: Hareket tablosu göster
- Bakiye durumu: Renk kodlu badge (yeşil: denk, sarı: fazla ödeme, kırmızı: eksik ödeme)

---

## ✅ CHECKLIST

### ADIM 1: Database Değişiklikleri
#### Phase 1: Cari Hesap Temel Altyapısı
- [x] **1.1** Suppliers tablosuna `is_current_account` boolean kolonu ekle (default: false) ✅
- [x] **1.2** Suppliers tablosuna `current_account_notes` text kolonu ekle (opsiyonel açıklama) ✅
- [x] **1.3** Index oluştur: `idx_suppliers_current_account` ✅
- [x] **1.4** Migration dosyası oluştur ✅
- [ ] **1.5** Migration'ı çalıştır (Production'a deploy edildiğinde otomatik çalışacak)

#### Phase 2: Faturasız Eşleştirme (Supplier-Only Matching)
- [x] **1.6** `statement_invoice_matches` tablosuna `supplier_id` kolonu ekle (UUID, FK) ✅
  - Migration: `20260311_add_supplier_match_to_statements.sql`
- [x] **1.7** `invoice_id` kolonunu nullable yap ✅
  - Artık fatura olmadan da eşleştirme yapılabilir
- [x] **1.8** Constraint ekle: `CHECK (invoice_id IS NOT NULL OR supplier_id IS NOT NULL)` ✅
  - En az birisi dolu olmalı (XOR mantığı)
- [x] **1.9** Unique index oluştur: `idx_statement_item_invoice_unique` ✅
  - Aynı statement item birden fazla faturaya eşleşemesin
- [x] **1.10** Unique index oluştur: `idx_statement_item_supplier_unique` ✅
  - Aynı statement item birden fazla firmaya eşleşemesin
- [x] **1.11** Trigger güncelle: `update_statement_item_matched_at` ✅
  - Hem invoice hem de supplier eşleştirmelerinde çalışacak şekilde
- [ ] **1.12** Migration'ı production'da çalıştır

### ADIM 2: Backend API Geliştirmeleri
- [x] **2.1** Supplier'ı cari hesap olarak işaretleme/kaldırma API endpoint'i ✅
  - `PATCH /api/suppliers/[id]/current-account`
  - Body: `{ is_current_account: boolean, notes?: string }`
- [x] **2.2** Cari hesap özeti API endpoint'i ✅
  - `GET /api/suppliers/[id]/current-account-summary`
  - Response: Ödemeler listesi, faturalar listesi, bakiye, hareket tablosu
- [x] **2.3** Kredi kartı eşleştirme API'sine cari hesap kontrolü ekle ✅
  - Supplier cari hesap ise, faturasız eşleştirmeye izin ver
  - Validation: Sadece `is_current_account = true` olan firmalar için supplier-only matching
- [x] **2.4** Cari hesap hareket tablosu verisi hazırla ✅
  - Ödeme ve faturaları tarih sırasına göre sırala
  - Kümülatif bakiye hesapla
  - Format: `{ date, type, document_no, debit, credit, balance }`
- [x] **2.5** Eşleştirme önerisi API'sine cari hesap firma önerileri ekle ✅
  - `GET /api/card-statements/[id]/suggestions` → `currentAccountSuppliers` array döndürür
  - İsim benzerliği algoritması (50+ puan threshold)
  - Sadece `is_current_account = true` olan firmalar
- [x] **2.6** Cari hesap özet API'yi supplier-only matches'i dahil edecek şekilde güncelle ✅
  - Hem faturaya bağlı hem de doğrudan firmaya bağlı ödemeleri al
#### Phase 1: Cari Hesap Uyarısı ve Bilgilendirme
- [x] **4.1** Eşleştirme modalına cari hesap kontrolü ekle ✅
  - Seçilen supplier cari hesap mı kontrol et
  - Eğer cari hesapsa uyarı göster
- [x] **4.2** Cari hesap uyarı UI'ı ekle ✅
  - "⚠️ Bu firma cari hesaptır. Ödemeler ve faturalar topluca değerlendirilir."
  - "Cari Hesap Detayını Gör" butonu
- [x] **4.3** Cari hesap detay modal'ı ekle ✅
  - Supplier detay sayfasına yönlendirme
  - Özet bilgileri göster (toplam ödeme, fatura, bakiye)
- [x] **4.4** Manuel eşleştirme akışını güncelle ✅
  - Cari hesap firmaları için özel mantık
  - Eşleştirme yapılsa da bakiye kontrolü devam etsin

#### Phase 2: Faturasız Eşleştirme (Supplier-Only Matching)
- [x] **4.5** `handleMatch` fonksiyonunu güncelle ✅
  - Yeni parametre: `supplierId?: string | null`
  - API'ye hem `invoiceId` hem de `supplierId` gönder
- [x] **4.6** Otomatik önerilere cari hesap firmalarını ekle ✅
  - İsim benzerliği ile önerilen firmalar (mor tema)
  - "Firmaya Bağla" butonu
  - Eşleşme skoru gösterimi
- [x] **4.7** Manuel arama bölümüne cari hesap arama ekle ✅
  - Yeni input: "Cari Hesap Firması Ara (Faturasız Bağlama)"
  - `searchSuppliersManually()` fonksiyonu
  - Sadece `is_current_account = true` olan firmalarda arama
  - Mor tema ile fatura aramasından ayırt edilebilir
  - "Firmaya Bağla" butonları `handleMatch(itemId, null, undefined, 'manual', supplierId)` parametreleri ile
  - Renk kodlu durum göstergesi
  - Son hareket tarihi

### ADIM 4: Kredi Kartı Ekstresi Detay Sayfası Entegrasyonu
- [x] **4.1** Eşleştirme modalına cari hesap kontrolü ekle ✅
  - Seçilen supplier cari hesap mı kontrol et
  - Eğer cari hesapsa uyarı göster
- [x] **4.2** Cari hesap uyarı UI'ı ekle ✅
  - "⚠️ Bu firma cari hesaptır. Ödemeler ve faturalar topluca değerlendirilir."
  - "Cari Hesap Detayını Gör" butonu
- [x] **4.3** Cari hesap detay modal'ı ekle ✅
  - Supplier detay sayfasına yönlendirme
  - Özet bilgileri göster (toplam ödeme, fatura, bakiye)
- [x] **4.4** Manuel eşleştirme akışını güncelle ✅
  - Cari hesap firmaları için özel mantık
  - Eşleştirme yapılsa da bakiye kontrolü devam etsin

### ADIM 5: Supplier Detay Sayfası Entegrasyonu
- [x] **5.1** Supplier detay sayfasına "Cari Hesap" toggle ekle ✅
  - Switch component
  - Aktif/pasif durumu göster
  - Değişiklik yaptığında API çağrısı yap
- [x] **5.2** Cari hesap notları input alanı ekle ✅
  - Textarea, opsiyonel
  - "Bu firma neden cari hesap?" tarzı açıklama için
- [x] **5.3** Cari hesap aktifse hareket tablosu göster ✅
  - CurrentAccountTable component'ini kullan
  - Yükleme durumu (loading state)
- [x] **5.4** Cari hesap özet kartı ekle ✅
  - CurrentAccountSummaryCard component'ini kullan
  - Sayfa üst kısmında prominent olarak göster
- [x] **5.5** Bakiye durumuna göre renk kodlu badge ekle ✅
  - Yeşil: Bakiye denk (±50₺ tolerance)
  - Sarı: Fazla ödeme var (müşteri lehine)
  - Kırmızı: Eksik ödeme var (firma lehine)

### ADIM 6: Raporlama ve Filtreleme
- [ ] **6.1** Suppliers listesine "Cari Hesap" filtresi ekle
  - Checkbox: "Sadece Cari Hesap Firmalarını Göster"
- [ ] **6.2** Cari hesap durum kolonu ekle (suppliers listesine)
  - Badge ile göster
- [ ] **6.3** Cari hesap raporu endpoint'i
  - Tüm cari hesap firmalarının bakiye özeti
  - Excel export özelliği
- [ ] **6.4** Dashboard'a cari hesap widget'ı ekle
  - Toplam cari hesap firma sayısı
  - Toplam açık bakiye (pozitif/negatif)
  - En yüksek açık bakiyeli firmalar

### ADIM 7: Test ve Validasyon
- [ ] **7.1** Unit test: Bakiye hesaplama fonksiyonu
- [ ] **7.2** Integration test: API endpoint'leri
- [ ] **7.3** Manuel test: Kredi kartı ekstresi eşleştirme akışı
- [ ] **7.4** Manuel test: Supplier detay sayfası
- [ ] **7.5** Edge case testleri:
  - Hiç fatura olmayan cari hesap
  - Hiç ödeme olmayan cari hesap
  - Çok sayıda hareket olan cari hesap (performans)
- [ ] **7.6** Mobil responsive test
- [ ] **7.7** Permission testleri (farklı roller ile)

### ADIM 8: Dokümantasyon
- [ ] **8.1** Kullanım kılavuzu hazırla (ekran görüntüleri ile)
- [ ] **8.2** API dokümantasyonu güncelle
- [ ] **8.3** Database schema dokümantasyonu güncelle
- [ ] **8.4** Changelog güncelle

### ADIM 9: Deployment
- [ ] **9.1** Dev environment'a deploy
- [ ] **9.2** Staging test
- [ ] **9.3** Production deployment
- [ ] **9.4** Post-deployment smoke test
- [ ] **9.5** Kullanıcılara duyuru

---

## 📊 VERİ MODELİ

### Suppliers Table (Güncellenecek)
```sql
ALTER TABLE suppliers 
ADD COLUMN is_current_account BOOLEAN DEFAULT FALSE,
ADD COLUMN current_account_notes TEXT;

CREATE INDEX idx_suppliers_current_account ON suppliers(is_current_account);
```

### Cari Hesap Hareket Tablosu Veri Yapısı
```typescript
interface CurrentAccountMovement {
  date: string; // ISO date
  type: 'payment' | 'invoice'; // Ödeme mi fatura mı
  documentType: 'Kredi Kartı Ödemesi' | 'Fatura' | 'Gayri Resmi Ödeme';
  documentNo: string; // Fatura no veya ödeme ref no
  debit: number; // Borç (faturalar)
  credit: number; // Alacak (ödemeler)
  balance: number; // Kümülatif bakiye
  notes?: string;
  relatedId: string; // invoice_id veya payment_id
}

interface CurrentAccountSummary {
  supplierId: string;
  supplierName: string;
  isCurrentAccount: boolean;
  totalPayments: number; // Toplam ödemeler
  totalInvoices: number; // Toplam faturalar
  balance: number; // Bakiye (ödemeler - faturalar)
  balanceStatus: 'balanced' | 'overpaid' | 'underpaid';
  movements: CurrentAccountMovement[];
  lastMovementDate: string | null;
}
```

---

## 🎨 UI/UX TASARIM PRENSİPLERİ

### Renk Kodları
- **Yeşil (#10B981)**: Bakiye denk (±50₺ tolerance)
- **Sarı (#F59E0B)**: Fazla ödeme (müşteri lehine, bizim borç)
- **Kırmızı (#EF4444)**: Eksik ödeme (firma lehine, bizim alacak)

### Hareket Tablosu Görünümü
```
┌────────────┬──────────────────────┬────────────┬──────────┬──────────┬──────────┐
│ TARİH      │ BELGE TİPİ           │ BELGE NO   │ BORÇ     │ ALACAK   │ BAKİYE   │
├────────────┼──────────────────────┼────────────┼──────────┼──────────┼──────────┤
│ 01.01.2025 │ Fatura               │ FA2025001  │ 1.000₺   │ -        │ -1.000₺  │
│ 05.01.2025 │ Kredi Kartı Ödemesi  │ KK-001     │ -        │ 500₺     │ -500₺    │
│ 10.01.2025 │ Kredi Kartı Ödemesi  │ KK-002     │ -        │ 500₺     │ 0₺       │
└────────────┴──────────────────────┴────────────┴──────────┴──────────┴──────────┘
                                                   TOPLAM:    1.000₺     1.000₺    0₺
```

### Bakiye Badge Görünümü
```tsx
// Denk
<Badge className="bg-green-100 text-green-800">✓ Bakiye Denk: 0₺</Badge>

// Fazla ödeme
<Badge className="bg-yellow-100 text-yellow-800">⚠️ Fazla Ödeme: +250₺</Badge>

// Eksik ödeme
<Badge className="bg-red-100 text-red-800">⚠️ Eksik Ödeme: -1.500₺</Badge>
```

---

## 🔍 TEST SENARYOLARI

### Senaryo 1: Parçalı Ödeme, Toplu Fatura
- 3 ödeme: 1.000₺, 1.500₺, 2.000₺
- 1 fatura: 4.500₺
- Beklenen: Bakiye denk (0₺)

### Senaryo 2: Toplu Ödeme, Parçalı Fatura
- 1 ödeme: 5.000₺
- 2 fatura: 3.000₺, 2.000₺
- Beklenen: Bakiye denk (0₺)

### Senaryo 3: Fazla Ödeme
- Ödemeler: 6.000₺
- Faturalar: 5.000₺
- Beklenen: Fazla ödeme (+1.000₺, sarı badge)

### Senaryo 4: Eksik Ödeme
- Ödemeler: 4.000₺
- Faturalar: 5.000₺
- Beklenen: Eksik ödeme (-1.000₺, kırmızı badge)

### Senaryo 5: Karmaşık Hareket
- 5 ödeme, 7 fatura, farklı tarihler
- Beklenen: Tüm hareketler doğru sırayla, bakiye doğru hesaplanmış

---

## 📝 NOTLAR

- **Tolerance Değeri**: Bakiye "denk" sayılması için ±50₺ tolerance kullanılacak (kuruş farklarını tolere etmek için)
- **Tarih Sıralaması**: Hareketler tarih sırasına göre gösterilecek, aynı tarihteki hareketlerde önce faturalar sonra ödemeler
- **Performance**: Çok sayıda hareketi olan firmalar için pagination düşünülmeli (ilk 100 hareket)
- **Export**: Cari hesap raporu Excel formatında export edilebilmeli
- **Notification**: Cari hesap dengesizliği belirli bir eşiği geçerse (örn: 5.000₺) kullanıcıya bildirim gösterilebilir
- **History**: Cari hesap durumu değişikliklerinin loglanması düşünülebilir (audit trail)

---

## 🚀 DEPLOYMENT STRATEJİSİ

1. **Phase 1**: Database değişiklikleri (migration)
2. **Phase 2**: Backend API'ler
3. **Phase 3**: UI component'leri
4. **Phase 4**: Sayfa entegrasyonları
5. **Phase 5**: Test ve bug fix
6. **Phase 6**: Production deployment

**Tahmini Süre**: 2-3 iş günü
**Risk Seviyesi**: Düşük (mevcut sisteme ekleme yapılıyor, değiştirme değil)

---

## 📞 DESTEK VE SORULAR

Bu sistem hakkında sorularınız için:
- İletişim: GitHub Issues
- Dokümantasyon: `/docs/CARI_HESAP_KULLANIM_KILAVUZU.md` (oluşturulacak)
