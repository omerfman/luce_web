/**
 * Garanti Bankası Excel Ekstreleri Analizi
 * 
 * Test edilen dosyalar:
 * - GARANTİ BONUS TROY OCAK 2026.xls
 * - GARANTİ TROY OCAK 2026.xls
 * - M&S PLATINUM MC BARIŞ BAYSAL ŞAHSİ OCAK 2026.xls (aynı format)
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const EKSTRELER_PATH = path.join(__dirname, '..', 'ekstreler');

// Test edilecek dosyalar
const testFiles = [
  'GARANTİ BONUS TROY OCAK 2026.xls',
  'GARANTİ TROY OCAK 2026.xls',
  'M&S PLATINUM MC BARIŞ BAYSAL ŞAHSİ OCAK 2026.xls'
];

console.log('🔍 Garanti Bankası Ekstre Formatı Analizi\n');
console.log('=' .repeat(80));

for (const fileName of testFiles) {
  const filePath = path.join(EKSTRELER_PATH, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`\n⚠️  Dosya bulunamadı: ${fileName}`);
    continue;
  }
  
  console.log(`\n\n📄 Dosya: ${fileName}`);
  console.log('-'.repeat(80));
  
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    console.log(`\n📊 Sheet: "${sheetName}"`);
    
    // İlk 30 satırı analiz et
    console.log('\n📋 İlk 30 Satır:');
    let rowIndex = 0;
    let headerRowIndex = -1;
    let dataStartRowIndex = -1;
    
    for (let r = 1; r <= 30; r++) {
      const row: any = {};
      let hasData = false;
      
      // İlk 15 kolonu oku
      for (let c = 0; c < 15; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r: r - 1, c });
        const cell = worksheet[cellAddress];
        
        if (cell && cell.v) {
          hasData = true;
          const colLetter = String.fromCharCode(65 + c);
          row[colLetter] = cell.v;
        }
      }
      
      if (hasData) {
        console.log(`\nSatır ${r}:`, JSON.stringify(row, null, 2));
        
        // Header satırını tespit et
        const rowStr = JSON.stringify(row).toLowerCase();
        if (rowStr.includes('tarih') && rowStr.includes('açıklama')) {
          headerRowIndex = r;
          console.log(`  ⭐ HEADER SATIRI TESPİT EDİLDİ!`);
        }
        
        // Data başlangıcını tespit et (header'dan sonraki ilk veri satırı)
        if (headerRowIndex > 0 && dataStartRowIndex === -1 && r > headerRowIndex) {
          // Tarih formatına benzeyen bir şey var mı?
          const hasDate = Object.values(row).some((val: any) => {
            if (typeof val === 'string') {
              return /\d{2}[\.\/]\d{2}[\.\/]\d{2,4}/.test(val);
            }
            return false;
          });
          
          if (hasDate) {
            dataStartRowIndex = r;
            console.log(`  🎯 DATA BAŞLANGICI TESPİT EDİLDİ!`);
          }
        }
      }
    }
    
    console.log(`\n\n📌 Özet:`);
    console.log(`   Header satırı: ${headerRowIndex}`);
    console.log(`   Data başlangıcı: ${dataStartRowIndex}`);
    
    // Örnek veri satırlarını göster
    if (dataStartRowIndex > 0) {
      console.log('\n\n📊 İlk 10 İşlem:');
      console.log('='.repeat(120));
      
      for (let r = dataStartRowIndex; r < dataStartRowIndex + 10; r++) {
        const row: any = {};
        
        for (let c = 0; c < 10; c++) {
          const cellAddress = XLSX.utils.encode_cell({ r: r - 1, c });
          const cell = worksheet[cellAddress];
          
          if (cell && cell.v) {
            const colLetter = String.fromCharCode(65 + c);
            row[colLetter] = cell.v;
          }
        }
        
        if (Object.keys(row).length > 0) {
          console.log(`\nSatır ${r}:`, JSON.stringify(row, null, 2));
        } else {
          console.log(`\nSatır ${r}: [BOŞ - VERİ BİTTİ]`);
          break;
        }
      }
    }
    
    // Tüm unique kolonları listele
    console.log('\n\n📝 Tüm Kolonlar (ilk 40 satırından):');
    const allColumns = new Set<string>();
    for (let r = 0; r < 40; r++) {
      for (let c = 0; c < 20; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[cellAddress];
        if (cell && cell.v) {
          allColumns.add(`${String.fromCharCode(65 + c)}`);
        }
      }
    }
    console.log([...allColumns].sort().join(', '));
    
  } catch (error: any) {
    console.error(`  ❌ Hata: ${error.message}`);
  }
}

console.log('\n\n' + '='.repeat(80));
console.log('✅ Analiz Tamamlandı\n');
