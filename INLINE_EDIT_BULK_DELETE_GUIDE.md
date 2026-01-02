# Taşeron ve Firma Yönetimi - Inline Editing ve Toplu Silme Kılavuzu

## 📝 Genel Bakış

Taşeron ve Firma Yönetimi sayfasına eklenen yeni özellikler:

### ✅ Eklenen Özellikler

1. **Inline Editing (Satır İçi Düzenleme)**
   - Firma adı, VKN, telefon ve e-posta alanları direkt tablodan düzenlenebilir
   - Her satırda "Düzenle" butonu ile aktif edilir
   - Düzenleme modunda "Kaydet" ve "İptal" butonları görünür

2. **Toplu Silme (Bulk Delete)**
   - Her satırda checkbox ile çoklu seçim
   - Başlıktaki checkbox ile tüm sayfayı seçme
   - "Seçilenleri Sil" butonu ile toplu silme

3. **Geliştirilmiş Silme**
   - Tek tek silme butonu her satırda mevcut
   - Faturalarda kullanılan firmalar için güvenli silme (deaktif edilir)

---

## 🎯 Kullanım Senaryoları

### Scenario 1: Tek Firma Düzenleme

```
1. İlgili tab'a git (Bekleyenler / Taşeronlar / Fatura Firmaları)
2. Düzenlemek istediğin firmada "Düzenle" butonuna tıkla
3. Açılan input alanlarında değişiklikleri yap:
   - Firma Adı (zorunlu)
   - VKN (10-11 hane, opsiyonel)
   - Telefon (opsiyonel)
   - E-posta (opsiyonel)
4. "Kaydet" butonuna tıkla
5. Başarılı mesajı göründüğünde değişiklikler kaydedildi
```

**Validasyonlar:**
- Firma adı boş olamaz
- VKN sadece rakam ve 10-11 hane olmalı
- Aynı VKN zaten kayıtlıysa hata verir

### Scenario 2: Toplu Silme

```
1. İlgili tab'da silinecek firmaları seç (checkbox ile)
2. Üstteki amber renkli bildirimde "X firma seçildi" yazısını gör
3. "Seçilenleri Sil" butonuna tıkla
4. Onay penceresinde "OK" deyin
5. Silme işlemi tamamlandığında sonuç mesajını gör
```

**Önemli Notlar:**
- Faturalarda kullanılan firmalar silinemez, sadece deaktif edilir
- Başarılı ve başarısız silme sayıları ayrı gösterilir

### Scenario 3: Tümünü Seç/Temizle

```
1. Tablonun başlık satırındaki checkbox'a tıkla
2. Tüm sayfadaki firmalar seçilir
3. Tekrar tıklayarak seçimi temizle
```

---

## 🔧 Teknik Detaylar

### Yeni State Değişkenleri

```typescript
// Inline editing için
const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
const [editFormData, setEditFormData] = useState<{
  name: string;
  vkn: string;
  phone?: string;
  email?: string;
}>({ name: '', vkn: '', phone: '', email: '' });

// Toplu işlemler için (zaten mevcuttu)
const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
```

### Yeni Fonksiyonlar

#### 1. `startEdit(supplier: Supplier)`
Inline editing modunu başlatır:
```typescript
setEditingSupplier(supplier.id);
setEditFormData({
  name: supplier.name,
  vkn: supplier.vkn || '',
  phone: supplier.phone || '',
  email: supplier.email || '',
});
```

#### 2. `cancelEdit()`
Değişiklikleri iptal eder:
```typescript
setEditingSupplier(null);
setEditFormData({ name: '', vkn: '', phone: '', email: '' });
```

#### 3. `saveEdit(supplierId: string)`
Değişiklikleri Supabase'e kaydeder:
- Validasyon kontrolleri
- Supabase update query
- Başarılı/hatalı durum yönetimi

#### 4. `handleBulkDelete()`
Seçili firmaları toplu siler:
- Her firma için `deleteSupplier()` çağrısı
- Başarılı/başarısız sayaçlar
- Sonuç bildirimi

### Tablolarda Değişiklikler

#### Checkbox Kolonu Eklendi
```typescript
<th className="table-header w-12">
  <input
    type="checkbox"
    checked={selectedSuppliers.length === suppliers.length}
    onChange={handleSelectAllForTab}
    className="rounded border-secondary-300"
  />
</th>
```

#### Conditional Rendering (Düzenleme Modu)
```typescript
{editingSupplier === supplier.id ? (
  <input
    type="text"
    value={editFormData.name}
    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
    className="w-full rounded border border-secondary-300 px-2 py-1"
  />
) : (
  supplier.name
)}
```

#### Düzenle/Kaydet/İptal Butonları
```typescript
{editingSupplier === supplier.id ? (
  <>
    <button onClick={() => saveEdit(supplier.id)}>Kaydet</button>
    <button onClick={cancelEdit}>İptal</button>
  </>
) : (
  <>
    <button onClick={() => startEdit(supplier)}>Düzenle</button>
    <button onClick={() => handleDelete(supplier.id, supplier.name)}>Sil</button>
  </>
)}
```

---

## 🎨 UI/UX İyileştirmeleri

### Seçim Bildirimi
Firma seçildiğinde üstte amber renkli bildirim:
```typescript
{selectedSuppliers.length > 0 && (
  <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 border border-amber-200">
    <span className="text-sm font-medium text-amber-800">
      {selectedSuppliers.length} firma seçildi
    </span>
    <button onClick={handleBulkDelete} className="btn-sm btn-danger">
      Seçilenleri Sil
    </button>
  </div>
)}
```

### Buton Renkleri
- **Düzenle**: Mavi (`bg-blue-100`, `text-blue-700`)
- **Kaydet**: Yeşil (`bg-green-600`, `text-white`)
- **İptal**: Gri (`bg-secondary-200`, `text-secondary-700`)
- **Sil**: Kırmızı (`bg-red-100`, `text-red-700`)
- **Kaldır**: Amber (`bg-amber-100`, `text-amber-700`)

---

## ⚠️ Güvenlik ve Validasyon

### Supabase RLS Policies
```sql
-- Update policy (mevcut)
CREATE POLICY "Users can update own company suppliers"
ON suppliers FOR UPDATE
USING (company_id = auth.jwt()->>'company_id');

-- Delete policy (mevcut)
CREATE POLICY "Users can delete own company suppliers"
ON suppliers FOR DELETE
USING (company_id = auth.jwt()->>'company_id');
```

### Frontend Validasyon
1. **Firma Adı**: Boş olamaz
2. **VKN**: 10-11 hane rakam (varsa)
3. **Duplicate VKN**: Supabase unique constraint hatası yakalar

### Backend Silme Kontrolü
`lib/supabase/supplier-management.ts` içinde:
```typescript
// Faturalarda kullanılıyorsa silinemez
const { data: invoiceCount } = await supabase
  .from('invoices')
  .select('id', { count: 'exact' })
  .eq('supplier_vkn', supplier.vkn);

if (invoiceCount && invoiceCount > 0) {
  // Sadece deaktif et
  await supabase
    .from('suppliers')
    .update({ is_active: false })
    .eq('id', supplierId);
  
  throw new Error('Bu firma faturalarda kullanılmış. Deaktif edildi.');
}
```

---

## 📊 Hangi Tablolar Etkilendi

### 1. **Bekleyenler (Pending)** Tab
- ✅ Checkbox (tümünü seç)
- ✅ Toplu silme butonu
- ❌ Inline editing YOK (sadece "Taşeron" veya "Fatura Firması" olarak atama var)

### 2. **Taşeronlar (Subcontractors)** Tab
- ✅ Checkbox (tümünü seç)
- ✅ Inline editing (Ad, VKN, Telefon, E-posta)
- ✅ Toplu silme butonu
- ✅ Tek tek silme butonu

### 3. **Fatura Firmaları (Invoice Companies)** Tab
- ✅ Checkbox (tümünü seç)
- ✅ Inline editing (Ad, VKN)
- ✅ Toplu silme butonu
- ✅ Tek tek silme butonu
- ℹ️ Vergi Dairesi alanı düzenlenemez (inline editing dışında)

---

## 🧪 Test Senaryoları

### Test 1: Inline Editing - Başarılı Güncelleme
1. Taşeronlar tab'ına git
2. Herhangi bir firmada "Düzenle"ye tıkla
3. Firma adını değiştir
4. VKN'yi değiştir (10 hane)
5. "Kaydet"e tıkla
6. ✅ Başarı mesajı görünmeli
7. Sayfa yenilendiğinde değişiklikler gösterilmeli

### Test 2: Inline Editing - VKN Validasyonu
1. Düzenleme moduna geç
2. VKN alanına "12345" (5 hane) yaz
3. "Kaydet"e tıkla
4. ❌ "VKN 10 veya 11 haneli rakam olmalıdır" hatası görmeli

### Test 3: Toplu Silme - Kullanılmayan Firmalar
1. 3 firma seç (faturada kullanılmamış)
2. "Seçilenleri Sil" tıkla
3. Onay ver
4. ✅ "3 firma başarıyla silindi!" mesajı görmeli

### Test 4: Toplu Silme - Karışık Durum
1. 2 kullanılmamış + 1 faturada kullanılmış firma seç
2. "Seçilenleri Sil" tıkla
3. Onay ver
4. ⚠️ "2 firma silindi, 1 firma silinemedi" mesajı görmeli

### Test 5: Checkbox - Tümünü Seç
1. Başlık checkbox'ına tıkla
2. ✅ Tüm satırlar seçilmeli
3. Tekrar tıkla
4. ✅ Tüm seçim kalkmalı

---

## 🔄 Versiyon Geçmişi

### v2.0.0 (Bugün)
- ✅ Inline editing eklendi
- ✅ Toplu silme eklendi
- ✅ Checkbox kolonları eklendi
- ✅ Seçim bildirimi (amber banner)
- ✅ VKN validasyonu eklendi

### v1.0.0 (Önceki)
- Tek tek silme
- Manuel ekleme modal'ı
- Tab sistemi (Bekleyenler/Taşeronlar/Fatura Firmaları)
- Atama/Kaldırma işlemleri

---

## 📝 Notlar

1. **Pending Tab**: Inline editing YOK çünkü bu tab'daki firmalar henüz atanmamış durumda. Sadece "Taşeron" veya "Fatura Firması" olarak atama yapılabilir.

2. **Telefon ve E-posta**: Sadece Taşeronlar tab'ında inline düzenlenebilir. Fatura Firmaları tab'ında bu alanlar gösterilmiyor.

3. **Vergi Dairesi**: Fatura Firmaları tab'ında gösterilir ama inline editing dışında (modal ile düzenlenebilir).

4. **Performans**: Toplu silme işlemi sıralı (sequential) yapılır, paralel değil. Bu, her silme işleminin ayrı ayrı kontrol edilmesini sağlar.

5. **State Management**: `editingSupplier` state'i aynı anda sadece 1 satırın düzenlenmesine izin verir. Bu, UI karmaşıklığını önler.

---

## 🐛 Bilinen Sınırlamalar

1. Toplu işlemler sıralı olduğu için çok fazla firma seçilirse biraz yavaş olabilir
2. Inline editing sırasında başka satıra geçilemez (önce kaydet/iptal gerekli)
3. Vergi Dairesi inline editing'de yok (modal ile yapılmalı)
4. Silme işlemi faturalarda kullanılan firmaları korur (güvenlik özelliği)

---

## 🗑️ Silme İşlemleri Hakkında

**Önemli:** Faturalarda kullanılan tedarikçiler ve taşeronlar **silinemez**, sadece **deaktif edilir**. Bu, veri bütünlüğünü korumak içindir.

**Test verilerini temizleme:** Tüm faturaları silip sıfırdan başlamak istiyorsanız:
```bash
# Detaylı rehber için:
npm run clean:help

# veya
cat scripts/CLEAN_TEST_DATA_GUIDE.md
```

---

## 🚀 Gelecek İyileştirmeler (Opsiyonel)

- [ ] Toplu düzenleme (birden fazla firmayı aynı anda düzenle)
- [ ] Drag & drop ile sıralama
- [ ] Export to Excel (seçili firmalar)
- [ ] Vergi Dairesi inline editing ekle
- [ ] Undo/Redo özelliği
- [ ] Loading spinner'lar (saveEdit, bulkDelete sırasında)
- [ ] Toast notification yerine modern bildirim sistemi

---

**Hazırlayan**: GitHub Copilot  
**Tarih**: 2024  
**Dosya**: `app/subcontractors/page.tsx`
