/**
 * YKB Excel dosyasının ilk satırlarını incele
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

async function inspect() {
  const filePath = path.join(__dirname, '..', 'ekstreler', 'YKB OCAK 2026 KK.xls');
  
  console.log('📄 Inspecting file:', filePath);
  
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
  
  console.log('\n📊 First 20 rows:\n');
  
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    console.log(`Row ${i}:`, row);
    
    const rowStr = row.map((cell: any) => String(cell).toLowerCase().trim()).join('|');
    const hasIslem = rowStr.includes('işlem');
    const hasTarih = rowStr.includes('tarih');
    const hasTutar = rowStr.includes('tutar');
    
    if (hasIslem || hasTarih || hasTutar) {
      console.log(`   ⚠️  Contains: işlem=${hasIslem}, tarih=${hasTarih}, tutar=${hasTutar}`);
    }
  }
}

inspect();
