/**
 * YKB Excel Formatını Analiz Et
 * 
 * Amaç:
 * 1. Sütun yapısını anla
 * 2. Kart no dağılımını gör
 * 3. Tutar formatını anla (+ işareti kontrolü)
 * 4. Harcama vs Ödeme sayılarını gör
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

function analyzeYKBExcel(filePath: string) {
  console.log(`\n📄 Analyzing: ${path.basename(filePath)}`);
  console.log('='.repeat(80));
  
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { 
    type: 'buffer',
    cellDates: true,
    cellStyles: true
  });
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    raw: false,
    defval: ''
  }) as any[][];
  
  console.log(`\n📊 Total rows: ${rows.length}`);
  
  // İlk 20 satırı göster (başlıkları anlamak için)
  console.log('\n📋 First 20 rows (header detection):');
  rows.slice(0, 20).forEach((row, idx) => {
    console.log(`\nRow ${idx}:`, row);
  });
  
  // Başlık satırını bul (genelde "Tarih", "İşlem Açıklaması", "Tutar" gibi kelimeler içerir)
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const row = rows[i];
    const rowStr = row.join(' ').toLowerCase();
    
    // YKB header pattern: "tarih" ve ("tutar" veya "işlem" veya "açıklama")
    if ((rowStr.includes('tarih') || rowStr.includes('işlem tarihi')) && 
        (rowStr.includes('tutar') || rowStr.includes('işlem') || rowStr.includes('açıklama'))) {
      headerRowIndex = i;
      console.log(`\n✅ Header row found at index: ${i}`);
      console.log('Headers:', row);
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    console.log('❌ Could not find header row!');
    return;
  }
  
  const headers = rows[headerRowIndex];
  const dataRows = rows.slice(headerRowIndex + 1).filter(row => {
    // Boş satırları atla
    return row.some(cell => cell !== null && cell !== undefined && cell.toString().trim() !== '');
  });
  
  console.log(`\n📊 Data rows: ${dataRows.length}`);
  
  // Kart No sütununu bul
  const kartNoIndex = headers.findIndex((h: string) => 
    h && h.toString().toLowerCase().includes('kart')
  );
  
  // Tutar sütununu bul
  const tutarIndex = headers.findIndex((h: string) => 
    h && (h.toString().toLowerCase().includes('tutar') || h.toString().toLowerCase().includes('miktar'))
  );
  
  console.log(`\n🔍 Column indices:`);
  console.log(`   Kart No: ${kartNoIndex} (${headers[kartNoIndex]})`);
  console.log(`   Tutar: ${tutarIndex} (${headers[tutarIndex]})`);
  
  if (kartNoIndex === -1 || tutarIndex === -1) {
    console.log('❌ Required columns not found!');
    return;
  }
  
  // Kart no dağılımı
  const cardNumbers = new Map<string, number>();
  const paymentsByCard = new Map<string, number>();
  const expensesByCard = new Map<string, number>();
  
  dataRows.forEach(row => {
    const kartNo = row[kartNoIndex]?.toString().trim() || '';
    const tutarStr = row[tutarIndex]?.toString().trim() || '';
    
    if (!kartNo || !tutarStr) return;
    
    // Kart numarasını say
    cardNumbers.set(kartNo, (cardNumbers.get(kartNo) || 0) + 1);
    
    // + işareti kontrolü
    const isPayment = tutarStr.startsWith('+');
    
    if (isPayment) {
      paymentsByCard.set(kartNo, (paymentsByCard.get(kartNo) || 0) + 1);
    } else {
      expensesByCard.set(kartNo, (expensesByCard.get(kartNo) || 0) + 1);
    }
  });
  
  console.log(`\n💳 Unique cards: ${cardNumbers.size}`);
  console.log('\nCard distribution:');
  
  for (const [kartNo, count] of cardNumbers.entries()) {
    const payments = paymentsByCard.get(kartNo) || 0;
    const expenses = expensesByCard.get(kartNo) || 0;
    
    console.log(`\n  Card: ${kartNo}`);
    console.log(`    Total transactions: ${count}`);
    console.log(`    Payments (+): ${payments} (${((payments/count)*100).toFixed(1)}%)`);
    console.log(`    Expenses: ${expenses} (${((expenses/count)*100).toFixed(1)}%)`);
  }
  
  // Örnek işlemler
  console.log('\n\n📝 Sample transactions:');
  
  const samplePayments = dataRows.filter(row => 
    row[tutarIndex]?.toString().startsWith('+')
  ).slice(0, 3);
  
  const sampleExpenses = dataRows.filter(row => 
    row[tutarIndex] && !row[tutarIndex].toString().startsWith('+')
  ).slice(0, 3);
  
  console.log('\n💰 Sample PAYMENTS (+):');
  samplePayments.forEach((row, idx) => {
    console.log(`\n  ${idx + 1}.`);
    headers.forEach((header: string, i: number) => {
      if (row[i]) {
        console.log(`     ${header}: ${row[i]}`);
      }
    });
  });
  
  console.log('\n\n💸 Sample EXPENSES (no +):');
  sampleExpenses.forEach((row, idx) => {
    console.log(`\n  ${idx + 1}.`);
    headers.forEach((header: string, i: number) => {
      if (row[i]) {
        console.log(`     ${header}: ${row[i]}`);
      }
    });
  });
}

// Test dosyaları
const testFiles = [
  'ekstreler/ŞAHSİ YKB OCAK 2026 KK.xls',
  'ekstreler/YKB OCAK 2026 KK.xls',
];

testFiles.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    analyzeYKBExcel(fullPath);
  } else {
    console.log(`⚠️ File not found: ${file}`);
  }
});
