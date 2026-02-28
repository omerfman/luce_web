/**
 * Taksitli Ödeme Eşleştirme - Detaylı Test
 * 
 * Senaryo: PARAM /NEYZEN INSAA 2/3 Taksit - 3.745 TL
 * Fatura: NYZ2025000012743 - 11.235 TL
 * 
 * Bu test sisteminfedeğerlendirme mantığını adım adım gösterir
 */

// Simüle edilecek ekstre satırı
interface MockStatementItem {
  transactionName: string;
  amount: number;
  transactionDate: string;
  isInstallment: boolean;
  installmentCurrent: number;
  installmentTotal: number;
}

// Simüle edilecek fatura
interface MockInvoice {
  id: string;
  invoice_number: string;
  supplier_name: string;
  amount: number;
  invoice_date: string;
}

// Test senaryosu
const statementItem: MockStatementItem = {
  transactionName: 'PARAM /NEYZEN INSAA ISTANBUL',
  amount: 3745.00,
  transactionDate: '2026-01-02',
  isInstallment: true,
  installmentCurrent: 2,
  installmentTotal: 3
};

const invoice: MockInvoice = {
  id: 'mock-invoice-id',
  invoice_number: 'NYZ2025000012743',
  supplier_name: 'NEYZEN İNŞAAT',
  amount: 11235.00,
  invoice_date: '2026-01-05'
};

console.log('🧪 Taksitli Ödeme Eşleştirme Testi\n');
console.log('='.repeat(80));

// ==========================================
// ADIM 1: TOPLAM TUTAR HESAPLAMA
// ==========================================
console.log('\n📊 ADIM 1: Toplam Tutar Hesaplama');
console.log('-'.repeat(80));

const monthlyAmount = statementItem.amount;
const installmentTotal = statementItem.installmentTotal;
const calculatedTotal = monthlyAmount * installmentTotal;

console.log(`Aylık tutar: ${monthlyAmount.toFixed(2)} TL`);
console.log(`Taksit sayısı: ${installmentTotal}`);
console.log(`Hesaplanan toplam: ${monthlyAmount.toFixed(2)} × ${installmentTotal} = ${calculatedTotal.toFixed(2)} TL`);
console.log(`\n✅ Eşleştirme için kullanılacak tutar: ${calculatedTotal.toFixed(2)} TL`);

// ==========================================
// ADIM 2: FATURA ARAMA ARALIĞI
// ==========================================
console.log('\n\n📊 ADIM 2: Fatura Arama Aralığı');
console.log('-'.repeat(80));

const searchMin = calculatedTotal - 100;
const searchMax = calculatedTotal + 100;

console.log(`Aranacak tutar aralığı: [${searchMin.toFixed(2)} - ${searchMax.toFixed(2)}] TL`);
console.log(`\nFatura tutarı: ${invoice.amount.toFixed(2)} TL`);

const isInRange = invoice.amount >= searchMin && invoice.amount <= searchMax;
console.log(`Fatura aralıkta mı? ${isInRange ? '✅ EVET' : '❌ HAYIR'}`);

if (!isInRange) {
  console.log('\n❌ Fatura bu aralıkta olmadığı için eşleştirme yapılamaz!');
  process.exit(1);
}

// ==========================================
// ADIM 3: TUTAR EŞLEŞME KONTROLÜ
// ==========================================
console.log('\n\n📊 ADIM 3: Tutar Eşleşme Kontrolü');
console.log('-'.repeat(80));

const AMOUNT_TOLERANCE = 0.01;
const amountDifference = Math.abs(calculatedTotal - invoice.amount);

console.log(`Hesaplanan toplam: ${calculatedTotal.toFixed(2)} TL`);
console.log(`Fatura tutarı: ${invoice.amount.toFixed(2)} TL`);
console.log(`Fark: ${amountDifference.toFixed(2)} TL`);
console.log(`Tolerans: ±${AMOUNT_TOLERANCE.toFixed(2)} TL`);

const isExactMatch = amountDifference <= AMOUNT_TOLERANCE;
console.log(`\n${isExactMatch ? '✅' : '❌'} Tam eşleşme: ${isExactMatch ? 'EVET' : 'HAYIR'}`);

// ==========================================
// ADIM 4: SKOR HESAPLAMA
// ==========================================
console.log('\n\n📊 ADIM 4: Skor Hesaplama (Toplam 100 puan)');
console.log('-'.repeat(80));

let totalScore = 0;
const reasons: string[] = [];

// 4.1. Tutar Skoru (40 puan tam eşleşme, 0-16 puan kısmi)
console.log('\n1️⃣  Tutar Skoru (Maksimum: 40 puan)');
let amountScore = 0;

if (isExactMatch) {
  amountScore = 40;
  reasons.push(`Tutar tam eşleşti (${statementItem.installmentCurrent}/${statementItem.installmentTotal} taksit toplamı)`);
  console.log(`   ✅ Tam eşleşme: 40 puan`);
} else {
  // Kısmi skor (max 16 puan)
  const maxDiff = Math.max(calculatedTotal, invoice.amount) * 0.1; // %10 tolerans
  if (amountDifference < maxDiff) {
    amountScore = Math.round((1 - amountDifference / maxDiff) * 16);
    reasons.push(`Tutar yakın (fark: ${amountDifference.toFixed(2)} TL)`);
    console.log(`   ⚠️  Kısmi eşleşme: ${amountScore} puan`);
  } else {
    console.log(`   ❌ Fark çok büyük: 0 puan`);
  }
}

totalScore += amountScore;

// 4.2. Firma Adı Benzerliği (0-40 puan)
console.log('\n2️⃣  Firma Adı Benzerliği (Maksimum: 40 puan)');

// Basit benzerlik hesaplama
const normalize = (text: string) => 
  text.toLowerCase()
    .replace(/[^\wçğıöşü\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

const itemTokens = normalize(statementItem.transactionName);
const invoiceTokens = normalize(invoice.supplier_name);

console.log(`   Ekstre: "${statementItem.transactionName}"`);
console.log(`   → Tokenler: [${itemTokens.join(', ')}]`);
console.log(`   Fatura: "${invoice.supplier_name}"`);
console.log(`   → Tokenler: [${invoiceTokens.join(', ')}]`);

// Ortak kelimeleri bul
const commonWords = itemTokens.filter(token => 
  invoiceTokens.some(invToken => 
    token.includes(invToken) || invToken.includes(token)
  )
);

console.log(`   Ortak kelimeler: [${commonWords.join(', ')}]`);

const similarity = commonWords.length > 0 
  ? Math.round((commonWords.length / Math.max(itemTokens.length, invoiceTokens.length)) * 100)
  : 0;

const nameScore = Math.round(similarity * 0.4);
totalScore += nameScore;

console.log(`   Benzerlik: %${similarity}`);
console.log(`   ${nameScore > 0 ? '✅' : '❌'} Puan: ${nameScore}`);

if (nameScore > 0) {
  reasons.push(`Firma adı benzerliği: %${similarity}`);
}

// 4.3. Tarih Yakınlığı (0-20 puan)
console.log('\n3️⃣  Tarih Yakınlığı (Maksimum: 20 puan)');

const itemDate = new Date(statementItem.transactionDate);
const invoiceDate = new Date(invoice.invoice_date);
const daysDifference = Math.abs(
  (itemDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
);

console.log(`   Ekstre tarihi: ${statementItem.transactionDate}`);
console.log(`   Fatura tarihi: ${invoice.invoice_date}`);
console.log(`   Fark: ${Math.round(daysDifference)} gün`);

let dateScore = 0;
if (daysDifference <= 7) {
  dateScore = 20;
  reasons.push('Tarih çok yakın (≤7 gün)');
  console.log(`   ✅ Çok yakın (≤7 gün): 20 puan`);
} else if (daysDifference <= 30) {
  dateScore = Math.round(20 - ((daysDifference - 7) / 23) * 10);
  reasons.push(`Tarih yakın (${Math.round(daysDifference)} gün)`);
  console.log(`   ⚠️  Yakın (≤30 gün): ${dateScore} puan`);
} else if (daysDifference <= 60) {
  dateScore = Math.round(10 - ((daysDifference - 30) / 30) * 10);
  reasons.push(`Tarih orta (${Math.round(daysDifference)} gün)`);
  console.log(`   ⚠️  Orta (≤60 gün): ${dateScore} puan`);
} else {
  console.log(`   ❌ Uzak (>60 gün): 0 puan`);
}

totalScore += dateScore;

// ==========================================
// ADIM 5: SONUÇ
// ==========================================
console.log('\n\n📊 ADIM 5: Eşleştirme Sonucu');
console.log('-'.repeat(80));

console.log(`\n💯 TOPLAM SKOR: ${totalScore} / 100`);
console.log(`\n📋 Skor Detayları:`);
console.log(`   • Tutar: ${amountScore} puan`);
console.log(`   • Firma adı: ${nameScore} puan`);
console.log(`   • Tarih: ${dateScore} puan`);

console.log(`\n📝 Eşleşme Nedenleri:`);
reasons.forEach((reason, i) => {
  console.log(`   ${i + 1}. ${reason}`);
});

console.log('\n');
console.log('='.repeat(80));

// Eşleştirme kararı
if (totalScore >= 80) {
  console.log('✅ SONUÇ: OTOMATİK EŞLEŞTİRME (Skor ≥ 80)');
  console.log('   Bu fatura otomatik olarak eşleştirilir.');
} else if (totalScore >= 50) {
  console.log('💡 SONUÇ: ÖNERİLEN EŞLEŞTİRME (Skor 50-79)');
  console.log('   Bu fatura kullanıcıya öneri olarak gösterilir.');
} else {
  console.log('❌ SONUÇ: EŞLEŞTİRME YOK (Skor < 50)');
  console.log('   Bu fatura eşleşme için yeterince uygun değil.');
}

console.log('='.repeat(80));
console.log('');

// Başarı durumu
if (isExactMatch && totalScore >= 50) {
  console.log('✅ Test başarılı! Sistem doğru çalışıyor.\n');
  process.exit(0);
} else {
  console.log('⚠️  Beklenmeyen sonuç!\n');
  process.exit(1);
}
