/**
 * Test YKB Detection Logic
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

function testDetection() {
  const filePath = path.join(__dirname, '..', 'ekstreler', 'ŞAHSİ YKB OCAK 2026 KK.xls');
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
  
  console.log('📋 First 20 rows:\n');
  
  rows.slice(0, 20).forEach((row, idx) => {
    console.log(`Row ${idx}:`, row);
  });
  
  console.log('\n\n🔍 Detection Tests:\n');
  
  // Test 1: İlk 5 satır
  const firstRows = rows.slice(0, 5).map(row => row.join(' ').toLowerCase());
  console.log('First 5 rows (joined & lowercased):');
  firstRows.forEach((row, idx) => {
    console.log(`  ${idx}: "${row}"`);
  });
  
  // Test 2: "Hesap Özeti" kontrolü
  const hasHesapOzeti = firstRows.some(row => row.includes('hesap özeti'));
  console.log(`\n✓ Has "hesap özeti": ${hasHesapOzeti}`);
  
  // Test 3: Metadata kontrolü
  const hasYKBMetadata = firstRows.some(row => 
    row.includes('müşteri adı') || 
    row.includes('asgari ödeme') ||
    row.includes('ödenmesi gereken')
  );
  console.log(`✓ Has YKB metadata: ${hasYKBMetadata}`);
  
  // Test 4: Header kontrolü
  let hasYKBHeaders = false;
  for (let i = 5; i < Math.min(30, rows.length); i++) {
    const rowStr = rows[i].join(' ').toLowerCase();
    
    if (rowStr.includes('işlem tarihi') && 
        rowStr.includes('işlemler') && 
        rowStr.includes('kart no')) {
      hasYKBHeaders = true;
      console.log(`✓ Found YKB headers at row ${i}: "${rowStr}"`);
      break;
    }
  }
  
  if (!hasYKBHeaders) {
    console.log('✗ YKB headers NOT found');
  }
  
  console.log(`\n🎯 Final Result: ${hasHesapOzeti && hasYKBMetadata && hasYKBHeaders ? 'YKB FORMAT' : 'NOT YKB'}`);
}

testDetection();
