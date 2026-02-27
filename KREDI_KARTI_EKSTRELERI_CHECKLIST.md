# Kredi Kartı Ekstreleri Yönetim Sistemi - Geliştirme Checklist

## 🎯 PROJE AMACI

Kredi kartı ekstrelerini Excel formatında yükleyip, her satırdaki harcamaları sistemimizdeki faturalar ile otomatik eşleştirmek.

### Eşleşme Kriterleri:
1. **Öncelik 1**: Tutar eşleşmesi (birebir)
2. **Öncelik 2**: Firma adı benzerliği (ortak anlamlı kelimeler - "Ltd", "Şti" hariç)

### Teknik Gereksinimler:
- Excel parsing (.xlsx ve .xls desteği)
- Kart numarası takibi (son 4 hane)
- Firma adı benzerlik algoritması
- Eşleşme skorlama sistemi

---

## 📊 EKSTRE YAPISI ANALIZI

### Ortak Sütunlar (Tüm Bankalar):
- **İşlem Adı** / İşlem: Firma adı veya işlem açıklaması
- **İşlem Tutarı** / Tutar: Harcama miktarı
- **Para Birimi**: TL, USD, EUR vb.
- **Tarih** / İşlem Tarihi: İşlem tarihi
- **Kart No**: Kart numarasının son 4 hanesi (bazı dosyalarda)

### Özel Durumlar:
- İlk 1-5 satır banka logosu/bilgi içerebilir
- Header satırı "İşlem" veya "Tutar" kelimesi içerir
- .xls (eski) ve .xlsx (yeni) formatları desteklenmeli

---

## ✅ ADIMLAR

### FAZ 1: DATABASE ŞEMASI ✅ TAMAMLANDI
- [x] **1.1** `card_statements` tablosu oluştur
- [x] **1.2** `card_statement_items` tablosu oluştur
- [x] **1.3** `statement_invoice_matches` tablosu oluştur
- [x] **1.4** Indexler ekle
- [x] **1.5** RLS Policies oluştur

---

### FAZ 2: MIGRATION DOSYASI ✅ TAMAMLANDI
- [x] **2.1** Migration dosyası oluştur: `supabase/migrations/20260225_create_card_statements.sql`
- [ ] **2.2** Migration'ı test et (local veya test DB)
- [ ] **2.3** Production'a uygula

---

### FAZ 3: EXCEL PARSING UTILITY ✅ TAMAMLANDI
- [x] **3.1** `lib/excel-parser.ts` oluştur
- [x] **3.2** Sütun eşleştirme fonksiyonu
- [x] **3.3** Data validation

---

### FAZ 4: EŞLEŞME ALGORİTMASI ✅ TAMAMLANDI
- [x] **4.1** `lib/statement-matcher.ts` oluştur
- [x] **4.2** Tutar eşleşmesi (Öncelik 1)
- [x] **4.3** Firma adı benzerliği (Öncelik 2)
- [x] **4.4** Kombine eşleşme skoru
- [x] **4.5** Otomatik eşleşme threshold

---

### FAZ 5: TYPE DEFINITIONS ✅ TAMAMLANDI
- [x] **5.1** `types/card-statement.ts` oluştur

---

### ~~FAZ 5: STORAGE KURULUMU~~ ❌ GEREKSİZ
Excel dosyaları parse edildikten sonra DB'ye kaydediliyor, storage'a gerek yok.
Sadece `file_name` referans için saklanıyor.

---

### FAZ 6: BACKEND API ROUTES ✅ TAMAMLANDI
- [x] **6.1** `app/api/card-statements/upload/route.ts`
- [x] **6.2** `app/api/card-statements/route.ts` (List)
- [x] **6.3** `app/api/card-statements/[id]/route.ts` (Detail, Delete)
- [x] **6.4** `app/api/card-statements/match/route.ts` (Create/Delete match)
- [x] **6.5** `app/api/card-statements/[id]/suggestions/route.ts` (Get suggestions)

---

### FAZ 7: UI SAYFASI
- [ ] **7.1** `app/card-statements/page.tsx` oluştur (Ana liste)
  - Ekstreler listesi
  - Upload modal
  - Kart numarası girişi (son 4 hane)
  - Kart sahibi adı
  - Dönem seçimi (YYYY-MM)
  - Filtreleme ve arama

- [ ] **7.2** `app/card-statements/[id]/page.tsx` (Detay sayfası)
  - Ekstre özet bilgileri
  - Satır listesi (tablo)
  - Her satır için:
    * İşlem adı
    * Tutar
    * Tarih
    * Eşleşme durumu (icon)
    * Eşleşen fatura (link)
    * Eşleşme skoru
  - Manuel eşleştirme modal

---

### FAZ 8: UI COMPONENTS
- [ ] **8.1** `StatementUploadModal` component
  - Dosya seçici
  - Kart numarası input (4 hane)
  - Kart sahibi input
  - Dönem seçici
  - Upload progress

- [ ] **8.2** `StatementItemRow` component
  - Satır görünümü
  - Eşleşme badge
  - "Eşleştir" butonu
  - Fatura linki

- [ ] **8.3** `ManualMatchModal` component
  - Fatura arama
  - Eşleşme öneri listesi (skorlu)
  - Manuel seçim

- [ ] **8.4** `MatchScoreBadge` component
  - Renk kodlu skor gösterimi
  - 80+: Yeşil (Otomatik)
  - 50-79: Sarı (Öneri)
  - <50: Kırmızı (Eşleşmedi)

---

### FAZ 9: TYPE DEFINITIONS
- [ ] **9.1** `types/card-statement.ts` oluştur
  ```typescript
  export interface CardStatement {
    id: string;
    company_id: string;
    uploaded_by_user_id: string;
    file_name: string;
    file_url: string;
    card_last_four: string;
    card_holder_name: string;
    statement_month: string;
    total_transactions: number;
    total_amount: number;
    matched_count: number;
    uploaded_at: string;
    created_at: string;
  }
  
  export interface CardStatementItem {
    id: string;
    statement_id: string;
    row_number: number;
    transaction_name: string;
    amount: number;
    currency: string;
    transaction_date: string;
    card_last_four?: string;
    description?: string;
    raw_data: any;
    is_matched: boolean;
    match_confidence: number;
    created_at: string;
  }
  
  export interface StatementInvoiceMatch {
    id: string;
    statement_item_id: string;
    invoice_id: string;
    match_type: 'exact_amount' | 'amount_and_name' | 'manual';
    match_score: number;
    matched_by_user_id?: string;
    matched_at: string;
    notes?: string;
    invoice?: Invoice; // Populated
  }
  ```

---

### FAZ 10: SUPABASE FUNCTIONS (Optional)
- [ ] **10.1** Database function: `match_statement_items()`
  - PostgreSQL function
  - Toplu eşleştirme
  - Performance optimization

---

### FAZ 11: PERMISSIONS
- [ ] **11.1** Yeni permission group ekle
  ```typescript
  {
    resource: 'card_statements',
    actions: ['create', 'read', 'update', 'delete', 'match']
  }
  ```

- [ ] **11.2** Rollere yetki ata
  - Admin: Tüm yetkiler
  - Muhasebe: Tüm yetkiler
  - Mimar/Mühendis: Sadece okuma

---

### FAZ 12: TEST VE VALIDATION
- [ ] **12.1** Farklı banka formatlarını test et
  - Denizbank
  - Garanti
  - YKB
  - QNB Finansbank (M&S)

- [ ] **12.2** Edge cases test
  - Boş satırlar
  - Hatalı format
  - Negatif tutarlar
  - Farklı para birimleri

- [ ] **12.3** Eşleşme algoritması test
  - Birebir tutar eşleşmesi
  - Benzer isimler
  - Stopwords filtreleme

---

### FAZ 13: DOKÜMANTASYON
- [ ] **13.1** Kullanım kılavuzu yaz
- [ ] **13.2** API dokümantasyonu
- [ ] **13.3** README güncelle

---

## 🔄 ÖRNEK KULLANIM AKIŞI

1. Kullanıcı "Ekstreler" sayfasına girer
2. "Ekstre Yükle" butonuna tıklar
3. Modal açılır:
   - Excel dosyası seçer
   - Kart numarası girer (son 4 hane): "0387"
   - Kart sahibi: "Luce Mimarlık"
   - Dönem: "Aralık 2025"
4. "Yükle" butonuna tıklar
5. Sistem:
   - Dosyayı storage'a yükler
   - Parse eder
   - Her satırı DB'ye kaydeder
   - Otomatik eşleştirme yapar
6. Liste sayfasında yeni ekstre görünür:
   - "DENİZBANK 0387 KART ARALIK 2025.xlsx"
   - 20 işlem, 15 eşleşti (%75)
7. Kullanıcı detaya tıklar
8. Satır listesi:
   ```
   # | Firma Adı            | Tutar      | Tarih      | Eşleşme
   --|----------------------|------------|------------|----------
   1 | STARWOOD ORMAN ÜRÜ   | -7,815.83  | 18.12.2025 | ✅ 95%
   2 | Satış Faizi          | -11,366.70 | 31.12.2025 | ❌ -
   3 | Hesaptan Ödeme       | 20,000.00  | 31.01.2026 | ⚠️  65%
   ```
9. Eşleşmemiş satıra tıklar
10. "Manuel Eşleştir" modal açılır
11. Fatura arar veya önerilerden seçer
12. Onaylar → DB'ye kaydedilir

---

## 📊 DATABASE DİYAGRAMI

```
card_statements
├─ id (PK)
├─ company_id (FK → companies)
├─ file_name
├─ card_last_four
└─ statement_month

card_statement_items
├─ id (PK)
├─ statement_id (FK → card_statements)
├─ transaction_name
├─ amount
├─ transaction_date
└─ is_matched

statement_invoice_matches
├─ id (PK)
├─ statement_item_id (FK → card_statement_items)
├─ invoice_id (FK → invoices)
├─ match_type
└─ match_score
```

---

## 🎯 BAŞARI KRİTERLERİ

- [ ] Farklı banka formatlarından Excel parse edilebiliyor
- [ ] Header satırı otomatik bulunuyor
- [ ] Tutar eşleşmesi çalışıyor (±0.01 TL tolerans)
- [ ] Firma adı benzerliği hesaplanıyor
- [ ] Otomatik eşleştirme %60+ başarılı
- [ ] Manuel eşleştirme yapılabiliyor
- [ ] Kart numarası takibi var
- [ ] UI responsive ve kullanıcı dostu

---

## 📝 NOTLAR

- Excel formatı her banka için farklı olabilir (dinamik algılama önemli)
- Stopwords listesi genişletilebilir
- Eşleşme algoritması zaman içinde geliştirilebilir (ML?)
- Dönem bilgisi dosya adından çıkarılabilir (fallback)
- Kart numarası opsiyonel olabilir (tüm ekstreden çıkar)
