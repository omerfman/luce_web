/**
 * Debug matching issue: Birebir eşleşen faturalar neden eşleşmiyor?
 */

// Test senaryosu simülasyonu
console.log('🔍 Matching Debug - Senaryo Analizi\n');

console.log('SENARYO:');
console.log('1. Ekstre item: 10.000 TL, Tarih: 2026-02-20');
console.log('2. Fatura: 10.000 TL, Tarih: 2026-02-20');
console.log('3. Tedarikçi adı: EMEK ORMAN vs EMEK ORMAN\n');

// Tutar eşleşmesi
const AMOUNT_TOLERANCE = 0.01;
const itemAmount = 10000;
const invoiceAmount = 10000;
const amountDiff = Math.abs(itemAmount - invoiceAmount);
const amountMatch = amountDiff <= AMOUNT_TOLERANCE;

console.log('TUTAR KONTROLÜ:');
console.log(`  İşlem: ${itemAmount} TL`);
console.log(`  Fatura: ${invoiceAmount} TL`);
console.log(`  Fark: ${amountDiff} TL`);
console.log(`  Tolerans: ${AMOUNT_TOLERANCE} TL`);
console.log(`  → ${amountMatch ? '✅ EŞLEŞTI' : '❌ EŞLEŞMEDI'}\n`);

// Tarih eşleşmesi
const itemDate = new Date('2026-02-20');
const invoiceDate = new Date('2026-02-20');
const diffTime = Math.abs(invoiceDate.getTime() - itemDate.getTime());
const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

console.log('TARIH KONTROLÜ:');
console.log(`  İşlem: ${itemDate.toISOString().split('T')[0]}`);
console.log(`  Fatura: ${invoiceDate.toISOString().split('T')[0]}`);
console.log(`  Fark: ${diffDays} gün`);
console.log(`  → ${diffDays === 0 ? '✅ AYNI GÜN (20 puan)' : `⚠️  ${diffDays} gün fark`}\n`);

// İsim benzerliği
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\wÇĞİÖŞÜçğıöşü\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1);
}

const itemName = 'EMEK ORMAN                ISTANBUL      TUR';
const supplierName = 'EMEK ORMAN';
const tokens1 = tokenize(itemName);
const tokens2 = tokenize(supplierName);
const commonWords = tokens1.filter(t => tokens2.includes(t));
const union = new Set([...tokens1, ...tokens2]);
const similarity = commonWords.length / union.size;
const nameSimilarity = Math.round(similarity * 100);

console.log('FİRMA ADI KONTROLÜ:');
console.log(`  İşlem: "${itemName}"`);
console.log(`  Tokens: [${tokens1.join(', ')}]`);
console.log(`  Fatura: "${supplierName}"`);
console.log(`  Tokens: [${tokens2.join(', ')}]`);
console.log(`  Ortak: [${commonWords.join(', ')}]`);
console.log(`  Jaccard: ${commonWords.length}/${union.size} = ${similarity.toFixed(2)}`);
console.log(`  → Benzerlik: %${nameSimilarity}\n`);

// Skor hesaplama
let totalScore = 0;

// Tutar skoru (40 puan)
if (amountMatch) {
  totalScore += 40;
  console.log('SKOR HESAPLAMA:');
  console.log('  ✅ Tutar birebir eşleşti: +40 puan');
}

// İsim skoru (40 puan max)
const nameScore = Math.round(nameSimilarity * 0.4);
totalScore += nameScore;
console.log(`  ✅ Firma adı benzerliği (%${nameSimilarity}): +${nameScore} puan`);

// Tarih skoru (20 puan)
if (diffDays === 0) {
  totalScore += 20;
  console.log('  ✅ Tarihler aynı gün: +20 puan');
}

console.log(`\n📊 TOPLAM SKOR: ${totalScore}/100`);
console.log(`   Threshold: 80 (otomatik eşleştirme)`);
console.log(`   → ${totalScore >= 80 ? '✅ OTOMATİK EŞLEŞTİRİLMELİ' : '❌ EŞLEŞMEZ'}\n`);

// Olası sorunlar
console.log('🔍 OLASI SORUNLAR:');
console.log('1. ⚠️  Fatura daha önce başka bir işlemle eşleşmiş olabilir');
console.log('2. ⚠️  checkInvoiceMatchStatus fonksiyonu canMatch=false döndürüyor olabilir');
console.log('3. ⚠️  Tutar aralığı filtresi faturayı yakalayamıyor olabilir (±100 TL)');
console.log('4. ⚠️  Payment tipindeki işlemler atlanıyor (transactionType check)');
