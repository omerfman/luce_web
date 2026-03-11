/**
 * Garanti Troy Full Parse Test
 * 
 * Gerçek parseStatementExcel fonksiyonunu kullanarak test eder
 */

import { parseStatementExcel } from '../lib/excel-parser.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EKSTRELER_PATH = path.join(__dirname, '..', 'ekstreler');
const testFile = path.join(EKSTRELER_PATH, 'GARANTİ TROY OCAK 2026.xls');

console.log('🧪 Gerçek Parse Fonksiyonu Testi\n');
console.log('='.repeat(80));

async function testParse() {
  try {
    // Dosyayı buffer olarak oku
    const fileBuffer = fs.readFileSync(testFile);
    
    const result = await parseStatementExcel(fileBuffer, 'GARANTİ TROY OCAK 2026.xls');
    
    console.log(`\n✅ Parse başarılı!`);
    console.log(`📊 Toplam ${result.items.length} işlem bulundu\n`);
  
  // 1.646,66 TL harcamasını bul
  console.log('🔍 1.646,66 TL INTEMA VITRA harcamasını arıyoruz...\n');
  
  const intemaItems = result.items.filter(item => 
    item.transactionName.toUpperCase().includes('INTEMA') ||
    item.transactionName.toUpperCase().includes('VITRA')
  );
  
  console.log(`📋 ${intemaItems.length} adet INTEMA VITRA işlemi bulundu:\n`);
  
  for (const item of intemaItems) {
    if (Math.abs(item.amount - 1646.66) < 0.01) {
      console.log('🎯 HEDEF HARCAMA BULUNDU!\n');
      console.log('═'.repeat(80));
      console.log(JSON.stringify(item, null, 2));
      console.log('═'.repeat(80));
      
      console.log('\n📊 Analiz:');
      console.log(`   transactionName: "${item.transactionName}"`);
      console.log(`   amount: ${item.amount} TL`);
      console.log(`   isInstallment: ${item.isInstallment}`);
      
      if (item.isInstallment) {
        console.log(`   installmentCurrent: ${item.installmentCurrent}`);
        console.log(`   installmentTotal: ${item.installmentTotal}`);
        console.log(`   installmentTotalAmount: ${item.installmentTotalAmount || 'N/A'}`);
        
        const calculatedTotal = item.amount * (item.installmentTotal || 1);
        console.log(`\n💰 Eşleştirme Tutarı:`);
        console.log(`   ${item.amount.toFixed(2)} × ${item.installmentTotal} = ${calculatedTotal.toFixed(2)} TL`);
        
        console.log(`\n✅ Sistem ${calculatedTotal.toFixed(2)} TL tutarında fatura aramalı!`);
      } else {
        console.log(`\n❌ SORUN: isInstallment = false`);
        console.log(`   Sistem ${item.amount.toFixed(2)} TL ile arayacak (YANLIŞ!)`);
      }
      
      break;
    }
  }
  
  // Tüm INTEMA VITRA harcamalarını göster
  console.log('\n\n📋 Tüm INTEMA VITRA Harcamaları:');
  console.log('-'.repeat(80));
  
  for (const item of intemaItems) {
    const totalAmount = item.isInstallment && item.installmentTotal 
      ? item.amount * item.installmentTotal 
      : item.amount;
    
    console.log(`\n${item.transactionName}`);
    console.log(`  Tutar: ${item.amount.toFixed(2)} TL`);
    console.log(`  Taksit: ${item.isInstallment ? `${item.installmentCurrent}/${item.installmentTotal}` : 'Yok'}`);
    console.log(`  Toplam: ${totalAmount.toFixed(2)} TL`);
  }
  
} catch (error: any) {
  console.error('\n❌ Parse hatası:', error.message);
  console.error(error.stack);
  process.exit(1);
}

console.log('\n' + '='.repeat(80));
console.log('');}

testParse();