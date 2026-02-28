/**
 * Garanti Troy Ekstre Test
 * 
 * Gerçek bir Garanti Troy ekstresini parse ederek taksit algılamasını test eder
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EKSTRELER_PATH = path.join(__dirname, '..', 'ekstreler');
const testFile = 'GARANTİ TROY OCAK 2026.xls';

console.log('🧪 Garanti Troy Ekstre Parse Testi\n');
console.log('='.repeat(80));

const filePath = path.join(EKSTRELER_PATH, testFile);

if (!fs.existsSync(filePath)) {
  console.log(`\n⚠️  Dosya bulunamadı: ${testFile}`);
  process.exit(1);
}

console.log(`\n📄 Dosya: ${testFile}\n`);

try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];
  
  console.log(`📊 Sheet: "${sheetName}"`);
  console.log(`📊 Toplam satır: ${data.length}`);
  
  // Taksitli işlemleri bul
  const installments: any[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 2) continue;
    
    const işlem = row[1];
    if (!işlem) continue;
    
    const işlemStr = String(işlem);
    
    // Taksit pattern'lerini ara
    const parenMatch = işlemStr.match(/\((\d+)\/(\d+)\)/);
    const spaceMatch = işlemStr.match(/(\d+)\/(\d+)\s*[Tt]aksit/);
    
    if (parenMatch || spaceMatch) {
      const match = parenMatch || spaceMatch;
      installments.push({
        satır: i + 1,
        işlem: işlemStr,
        current: parseInt(match![1]),
        total: parseInt(match![2]),
        tutar: row[4] || 'N/A',
        etiket: row[2] || 'N/A'
      });
    }
  }
  
  console.log(`\n✅ Taksitli işlem sayısı: ${installments.length}\n`);
  
  if (installments.length > 0) {
    console.log('📋 Taksitli İşlemler:\n');
    
    for (const item of installments) {
      console.log(`Satır ${item.satır}:`);
      console.log(`  İşlem: ${item.işlem}`);
      console.log(`  Taksit: ${item.current}/${item.total}`);
      console.log(`  Tutar: ${item.tutar}`);
      console.log(`  Etiket: ${item.etiket}`);
      
      // Toplam tutarı hesapla
      if (typeof item.tutar === 'number') {
        const monthlyAmount = Math.abs(item.tutar);
        const totalAmount = monthlyAmount * item.total;
        console.log(`  💰 Aylık: ${monthlyAmount.toFixed(2)} TL`);
        console.log(`  💰 Toplam: ${totalAmount.toFixed(2)} TL (${monthlyAmount.toFixed(2)} × ${item.total})`);
      }
      
      console.log('');
    }
  }
  
  // Özel olarak kullanıcının bahsettiği PARAM/NEYZEN örneğini ara
  console.log('\n🔍 "PARAM" veya "NEYZEN" içeren işlemleri arayalım:\n');
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 2) continue;
    
    const işlem = String(row[1] || '').toUpperCase();
    const etiket = String(row[2] || '').toUpperCase();
    
    if (işlem.includes('PARAM') || işlem.includes('NEYZEN') || 
        etiket.includes('PARAM') || etiket.includes('NEYZEN')) {
      console.log(`Satır ${i + 1}:`);
      console.log(`  İşlem: ${row[1]}`);
      console.log(`  Etiket: ${row[2] || 'N/A'}`);
      console.log(`  Tutar: ${row[4] || 'N/A'}`);
      console.log('');
    }
  }
  
  console.log('='.repeat(80));
  console.log('\n✅ Test tamamlandı!\n');
  
} catch (error: any) {
  console.error(`❌ Hata: ${error.message}`);
  process.exit(1);
}
