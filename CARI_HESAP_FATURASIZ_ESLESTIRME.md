# CARİ HESAP FATURASIZ EŞLEŞTİRME ÖZELLİĞİ

## 📋 ÖZETBu belge, cari hesap sistemi için geliştirilen **faturasız eşleştirme** özelliğini açıklar. Bu özellik sayesinde kredi kartı işlemleri, faturaya ihtiyaç olmadan doğrudan cari hesap firmalarına bağlanabilir.

## 🎯 KULLANICIDAN GELEN TALEP

> "NURAKS MOBİLYA İstanbul TR ₺430,00 harcaması faturayla eşleşmeyecek. Doğrudan NURAKS MOBİLYA AKSESUARLARI SANAYİ TİCARET LTD. ŞTİ. firmasının cari hesabına dahil edilecek."

**Ana İhtiyaç:**
- İşlem adı ve firma ismi eşleşirse ve firma cari hesabı yapılan bir firma ise, otomatik olarak firmayla eşleşsin
- Fatura eşleşmesine gerek yok
- Eğer yoksa manuel olarak firmayla eşleşme seçeneği sunulsun
- Son olarak ödeme ve fatura toplamları karşılaştırılsın

## 🔧 TEKNİK UYGULAMA

### 1. Database Değişiklikleri

**Migration Dosyası:** `supabase/migrations/20260311_add_supplier_match_to_statements.sql`

```sql
-- 1. supplier_id kolonu ekle
ALTER TABLE statement_invoice_matches 
ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE;

-- 2. invoice_id artık opsiyonel
ALTER TABLE statement_invoice_matches 
ALTER COLUMN invoice_id DROP NOT NULL;

-- 3. Constraint: En az biri olmalı (XOR mantığı)
ALTER TABLE statement_invoice_matches 
ADD CONSTRAINT statement_invoice_matches_one_relation_check 
CHECK (
  (invoice_id IS NOT NULL AND supplier_id IS NULL) OR 
  (invoice_id IS NULL AND supplier_id IS NOT NULL)
);

-- 4. Unique indexes
CREATE UNIQUE INDEX idx_statement_item_invoice_unique 
ON statement_invoice_matches(statement_item_id, invoice_id) 
WHERE invoice_id IS NOT NULL;

CREATE UNIQUE INDEX idx_statement_item_supplier_unique 
ON statement_invoice_matches(statement_item_id, supplier_id) 
WHERE supplier_id IS NOT NULL;

-- 5. Trigger güncelleme
DROP TRIGGER IF EXISTS update_statement_item_matched_at ON statement_invoice_matches;

CREATE TRIGGER update_statement_item_matched_at
AFTER INSERT OR UPDATE OR DELETE ON statement_invoice_matches
FOR EACH ROW
EXECUTE FUNCTION update_card_statement_item_matched_at();
```

### 2. API Endpoint Güncellemeleri

#### A) Eşleştirme API (`/api/card-statements/match`)

**Eski imza:**
```typescript
POST /api/card-statements/match
Body: { statementItemId: string, invoiceId: string }
```

**Yeni imza:**
```typescript
POST /api/card-statements/match
Body: { 
  statementItemId: string, 
  invoiceId?: string | null,
  supplierId?: string | null // YENİ
}
```

**Validation:**
```typescript
// En az biri dolu olmalı
if (!invoiceId && !supplierId) {
  return error('invoiceId veya supplierId gerekli');
}

// İkisi de dolu olamaz
if (invoiceId && supplierId) {
  return error('Hem invoice hem supplier verilemez');
}

// Supplier-only matching için firma cari hesap olmalı
if (supplierId && !invoiceId) {
  const supplier = await supabase
    .from('suppliers')
    .select('is_current_account')
    .eq('id', supplierId)
    .single();
    
  if (!supplier.is_current_account) {
    return error('Sadece cari hesap firmaları için faturasız eşleştirme yapılabilir');
  }
}
```

#### B) Öneri API (`/api/card-statements/[id]/suggestions`)

**Yeni response alanı:**
```typescript
interface SuggestionsResponse {
  exactMatches: Invoice[];
  suggestedMatches: Invoice[];
  currentAccountSuppliers: Supplier[]; // YENİ
}
```

**İsim benzerliği algoritması:**
```typescript
function findMatchingCurrentAccountSuppliers(
  transactionName: string,
  suppliers: Supplier[]
): Array<Supplier & { matchScore: number }> {
  const results = [];
  const normalizedTxName = transactionName.toLowerCase();
  
  for (const supplier of suppliers) {
    if (!supplier.is_current_account) continue;
    
    const normalizedSupplierName = supplier.name.toLowerCase();
    let score = 0;
    
    // 1. Tam içerme kontrolü (80 puan)
    if (normalizedTxName.includes(normalizedSupplierName) || 
        normalizedSupplierName.includes(normalizedTxName)) {
      score += 80;
    }
    
    // 2. Kelime bazlı eşleşme
    const txWords = normalizedTxName.split(/\s+/);
    const supplierWords = normalizedSupplierName.split(/\s+/);
    
    for (const supplierWord of supplierWords) {
      if (supplierWord.length < 3) continue; // Kısa kelimeler atla
      
      for (const txWord of txWords) {
        if (txWord.includes(supplierWord) || supplierWord.includes(txWord)) {
          score += 20;
        }
      }
    }
    
    // 3. Threshold: 50+ puan
    if (score >= 50) {
      results.push({ ...supplier, matchScore: score });
    }
  }
  
  // Skora göre sırala (yüksekten düşüğe)
  return results.sort((a, b) => b.matchScore - a.matchScore);
}
```

#### C) Cari Hesap Özet API (`/api/suppliers/[id]/current-account-summary`)

**Güncelleme:**
Artık iki tip eşleştirmeyi de topluyor:

```typescript
// Tip 1: Faturaya bağlı eşleştirmeler (eski yöntem)
const cardPaymentsViaInvoice = await supabase
  .from('statement_invoice_matches')
  .select('*, statement_item!inner(*), invoice!inner(*)')
  .eq('invoice.supplier_id', supplierId);

// Tip 2: Doğrudan firmaya bağlı eşleştirmeler (YENİ)
const cardPaymentsViaSupplier = await supabase
  .from('statement_invoice_matches')
  .select('*, statement_item!inner(*)')
  .eq('supplier_id', supplierId)
  .is('invoice_id', null);

// Birleştir
const allPayments = [
  ...cardPaymentsViaInvoice,
  ...cardPaymentsViaSupplier
];
```

### 3. UI/UX Değişiklikleri

#### A) Kredi Kartı Ekstresi Detay Sayfası

**1. Otomatik Öneriler (Mor Tema)**

```tsx
{/* Cari Hesap Firmaları Önerileri */}
{suggestions?.currentAccountSuppliers && 
 suggestions.currentAccountSuppliers.length > 0 && (
  <div className="space-y-2">
    <h4 className="text-sm font-semibold text-purple-700">
      🔄 Cari Hesap Firmaları (Faturasız Eşleştirme)
    </h4>
    {suggestions.currentAccountSuppliers.map((supplier) => (
      <Card key={supplier.id} className="border-purple-200 bg-purple-50">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{supplier.name}</div>
            <div className="text-xs text-purple-600">
              ⓘ Bu eşleştirme fatura gerektirmez
            </div>
          </div>
          <Button
            className="bg-purple-600 hover:bg-purple-700"
            onClick={() => handleMatch(
              selectedItem.id, 
              null, // invoiceId yok
              supplier.matchScore, 
              'auto', 
              supplier.id // supplierId
            )}
          >
            Firmaya Bağla
          </Button>
        </div>
      </Card>
    ))}
  </div>
)}
```

**2. Manuel Arama**

```tsx
{/* Cari Hesap Firma Arama */}
<div className="pt-4 border-t border-gray-200">
  <label className="block text-sm font-medium text-purple-700 mb-2">
    🔄 Cari Hesap Firması Ara (Faturasız Bağlama)
  </label>
  <Input
    placeholder="Firma adı veya VKN..."
    value={searchSupplierQuery}
    onChange={(e) => {
      setSearchSupplierQuery(e.target.value);
      searchSuppliersManually(e.target.value);
    }}
    className="border-purple-300 focus:ring-purple-500"
  />
  
  {/* Sonuçlar */}
  {manualSupplierResults.map((supplier) => (
    <Card key={supplier.id} className="border-purple-200 bg-purple-50">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{supplier.name}</div>
          <div className="text-xs text-purple-700">
            ⓘ Bu eşleştirme fatura gerektirmez
          </div>
        </div>
        <Button
          className="bg-purple-600 hover:bg-purple-700"
          onClick={() => handleMatch(
            selectedItem.id, 
            null,
            undefined, 
            'manual', 
            supplier.id
          )}
        >
          Firmaya Bağla
        </Button>
      </div>
    </Card>
  ))}
</div>
```

**3. handleMatch Fonksiyonu**

```typescript
async function handleMatch(
  statementItemId: string,
  invoiceId: string | null, // Artık nullable
  matchScore?: number,
  matchType?: 'exact' | 'suggested' | 'auto' | 'manual',
  supplierId?: string | null // YENİ parametre
) {
  const response = await fetch('/api/card-statements/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      statementItemId,
      invoiceId,
      supplierId, // YENİ
      matchScore,
      matchType
    })
  });
  
  // ...success handling
}
```

#### B) Firma Sayfası - Cari Hesap Hareket Tablosu

Artık hareket tablosunda hem faturalı hem faturasız ödemeler görünür:

```
TARIH       BELGE TİPİ              BELGE NO                        BORÇ     ALACAK   BAKİYE
01.01.2025  Fatura                   FA2025001                      1.000₺   -        -1.000₺
05.01.2025  Kredi Kartı Ödemesi      NURAKS MOBİLYA İstanbul TR     -        430₺     -570₺
10.01.2025  Kredi Kartı Ödemesi      NURAKS MOB. Ankara → FA2025001 -        570₺     0₺
```

**Not:** Faturalı eşleştirmeler fatura numarası gösterir, faturasız olanlar sadece işlem adını gösterir.

## 📊 KULLANIM SENARYOLARI

### Senaryo 1: Otomatik Eşleşme

**Durum:**
- Kredi kartı işlemi: "NURAKS MOBİLYA İstanbul TR ₺430,00"
- Sistemdeki firma: "NURAKS MOBİLYA AKSESUARLARI SANAYİ TİCARET LTD. ŞTİ."
- Firma cari hesap: ✅ Evet

**Akış:**
1. Kullanıcı kredi kartı ekstresi detayına girer
2. İşleme tıklar → Modal açılır
3. Sistem otomatik olarak "NURAKS MOBİLYA AKSESUARLARI..." firmasını önerir (mor renkli kart)
4. Eşleşme skoru: 80+ (isim içerme)
5. Kullanıcı "Firmaya Bağla" butonuna tıklar
6. ✅ Eşleştirme tamamlanır (fatura gerekmez)
7. Firma cari hesabında görünür: "05.01.2025 | Kredi Kartı Ödemesi | NURAKS MOBİLYA İstanbul TR | Alacak: 430₺"

### Senaryo 2: Manuel Arama

**Durum:**
- Kredi kartı işlemi: "MOBILYA ALIS 123456 ₺850,00"
- İsim benzerliği düşük, otomatik öneri yok
- Kullanıcı hangi firma olduğunu biliyor

**Akış:**
1. Modal'da "Cari Hesap Firması Ara" bölümüne gider
2. "NURAKS" yazar
3. Sistem sadece cari hesap olan firmaları arar
4. Sonuç: "NURAKS MOBİLYA AKSESUARLARI SANAYİ TİCARET LTD. ŞTİ." (mor renkli)
5. "Firmaya Bağla" butonuna tıklar
6. ✅ Eşleştirme tamamlanır

### Senaryo 3: Cari Hesap Bakiye Kontrolü

**Durum:**
- Firma: NURAKS MOBİLYA
- Faturalı ödemeler: 2.000₺
- Faturasız ödemeler: 430₺ + 850₺ = 1.280₺
- **Toplam ödemeler: 3.280₺**
- Faturalar: 3.500₺
- **Bakiye: -220₺** (Eksik ödeme, firma lehine)

**Görünüm:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📊 CARİ HESAP ÖZETİ                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ Toplam Ödemeler: 3.280₺                                                 │
│ Toplam Faturalar: 3.500₺                                                │
│ Bakiye: ⚠️ Eksik Ödeme: -220₺ (Firma Lehine)                           │
│ Son Hareket: 10.01.2025                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## ✅ AVANTAJLAR

1. **Hızlı Eşleştirme**
   - Fatura aramaya gerek yok
   - İsim benzerliği ile otomatik öneriler
   - 2-3 tıkla tamamlanır

2. **Esneklik**
   - Kısmi ödemeler için ideal
   - Henüz fatura kesilmemiş ödemeler için kullanılabilir
   - Toplu/parçalı ödeme senaryolarını destekler

3. **Doğruluk**
   - Sadece cari hesap firmalar için etkin
   - Database constraint'leri ile veri bütünlüğü garanti
   - Aynı işlem birden fazla yere bağlanamaz

4. **Raporlama**
   - Tüm ödemeler firma cari hesabında görünür
   - Toplam borç/alacak hesabı otomatik
   - Bakiye durumu anlık takip edilir

## ⚠️ ÖNEMLİ NOTLAR

1. **Cari Hesap Zorunluluğu**
   - Faturasız eşleştirme sadece `is_current_account = true` olan firmalarda yapılabilir
   - Normal firmalar için fatura zorunlu (eski davranış)

2. **Bir İşlem, Bir Eşleştirme**
   - Kredi kartı işlemi ya faturaya ya firmaya bağlanır, ikisine birden bağlanamaz
   - Unique index'ler ile garanti altına alındı

3. **Bakiye Toleransı**
   - ±50₺ fark "Denk" sayılır
   - Yuvarlama hataları ve küçük farklar için

4. **Faturalı vs Faturasız Eşleştirme**
   - Faturalı: Hem firma hem fatura takibi
   - Faturasız: Sadece firma takibi
   - İkisi de cari hesapta aynı şekilde görünür

## 🚀 DEPLOYMENT

### Önkoşullar
1. `is_current_account` migration'ı çalıştırılmış olmalı
2. En az 1 firma cari hesap olarak işaretlenmiş olmalı

### Migration Sırası
1. `20260310_add_current_account_to_suppliers.sql` (Phase 1)
2. `20260311_add_supplier_match_to_statements.sql` (Phase 2 - Bu dosya)

### Test Adımları
1. Bir firmayı cari hesap olarak işaretle
2. Kredi kartı ekstresi detayına git
3. Eşleşmemiş bir işlem seç
4. Cari hesap önerilerini gör (mor tema)
5. "Firmaya Bağla" tıkla
6. Firma cari hesabına git → İşlem görünmeli
7. Bakiye doğru hesaplanmalı

## 📝 İLGİLİ DOSYALAR

- **Migration:** `supabase/migrations/20260311_add_supplier_match_to_statements.sql`
- **Match API:** `app/api/card-statements/match/route.ts`
- **Suggestions API:** `app/api/card-statements/[id]/suggestions/route.ts`
- **Current Account Summary API:** `app/api/suppliers/[id]/current-account-summary/route.ts`
- **Card Statements Page:** `app/card-statements/[id]/page.tsx`
- **Checklist:** `CARI_HESAP_SISTEMI_CHECKLIST.md`

## 💡 GELECEK GELİŞTİRMELER

- [ ] Toplu faturasız eşleştirme (bulk matching)
- [ ] Excel'den cari hesap hareketleri import
- [ ] Cari hesap ekstreleri PDF export
- [ ] Firma bazlı eşleştirme istatistikleri
- [ ] İsim eşleştirme algoritması iyileştirmeleri (fuzzy matching)

---

**Son Güncelleme:** 11 Mart 2026
**Durum:** ✅ Tamamlandı - Test Bekliyor
