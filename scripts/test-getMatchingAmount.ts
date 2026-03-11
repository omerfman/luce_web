/**
 * getMatchingAmount Fonksiyon Testi
 * 
 * statement-matcher'daki getMatchingAmount fonksiyonunu test eder
 */

import type { ParsedStatementItem } from '../lib/excel-parser';

// getMatchingAmount fonksiyonunu simüle et
function getMatchingAmount(item: ParsedStatementItem): number {
  const absAmount = Math.abs(item.amount);
  
  if (item.isInstallment) {
    // 1. Toplam tutar belli ise (Denizbank formatı)
    if (item.installmentTotalAmount && item.installmentTotalAmount > 0) {
      console.log(`    💰 Installment with total: ${absAmount} TL (${item.installmentCurrent}/${item.installmentTotal}) → Total: ${item.installmentTotalAmount} TL`);
      return item.installmentTotalAmount;
    }
    
    // 2. Yoksa hesapla (tek taksit × toplam taksit sayısı)
    if (item.installmentTotal && item.installmentTotal > 0) {
      const calculatedTotal = absAmount * item.installmentTotal;
      console.log(`    💰 Installment calculated: ${absAmount} TL × ${item.installmentTotal} = ${calculatedTotal} TL`);
      return calculatedTotal;
    }
  }
  
  // Normal işlem
  console.log(`    💰 Normal transaction: ${absAmount} TL`);
  return absAmount;
}

// INTEMA VITRA harcamasını simüle et
const testItem: ParsedStatementItem = {
  rowNumber: 3,
  transactionName: "INTEMA VITRA-CALIKLAR MAR İSTANBUL",
  amount: 1646.66,
  currency: "TL",
  transactionDate: "2026-01-27",
  transactionType: "expense",
  cardLastFour: "8399",
  fullCardNumber: "9792 **** **** 8399",
  description: "Ev / Dekorasyon",
  isInstallment: true,
  installmentCurrent: 2,
  installmentTotal: 3
};

console.log('🧪 getMatchingAmount Fonksiyon Testi\n');
console.log('='.repeat(80));

console.log('\n📋 Test Item:');
console.log(`   transactionName: "${testItem.transactionName}"`);
console.log(`   amount: ${testItem.amount} TL`);
console.log(`   isInstallment: ${testItem.isInstallment}`);
console.log(`   installmentCurrent: ${testItem.installmentCurrent}`);
console.log(`   installmentTotal: ${testItem.installmentTotal}`);
console.log(`   installmentTotalAmount: ${testItem.installmentTotalAmount || 'undefined'}`);

console.log('\n🔍 getMatchingAmount() çağrılıyor...\n');

const matchingAmount = getMatchingAmount(testItem);

console.log(`\n✅ Sonuç: ${matchingAmount.toFixed(2)} TL`);

if (matchingAmount === 4939.98) {
  console.log('\n✅ TEST BAŞARILI! Sistem doğru tutarı hesaplıyor.\n');
} else {
  console.log(`\n❌ TEST BAŞARISIZ! Beklenen: 4939.98 TL, Bulunan: ${matchingAmount.toFixed(2)} TL\n`);
  process.exit(1);
}

console.log('='.repeat(80));
console.log('');
