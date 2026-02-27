/**
 * Garanti Multi-Card Structure Analizi
 * Tek dosyada birden fazla kart kontrolü
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

console.log('🔍 Garanti Multi-Card Structure Analizi\n');
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
    
    // Sheet'i array'e çevir
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    console.log(`\n📊 Toplam Satır: ${data.length}`);
    
    // Tüm satırları tara ve "Numaralı Kart" içeren satırları bul
    const cardSections = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowStr = row.join(' ');
      
      // Kart numarası başlığını tespit et
      if (rowStr.includes('Numaralı Kart') && rowStr.includes('Ekstre Bilgileri')) {
        // Kart numarasını çıkar
        const match = rowStr.match(/(\d{4}\s+\*{4}\s+\*{4}\s+\d{4})/);
        const cardNumber = match ? match[1] : 'Bilinmeyen';
        
        cardSections.push({
          rowIndex: i,
          actualRow: i + 1, // Excel satır numarası (1-based)
          cardNumber: cardNumber,
          fullText: rowStr
        });
        
        console.log(`\n  🔹 Satır ${i + 1}: ${cardNumber}`);
        console.log(`     "${rowStr}"`);
      }
    }
    
    console.log(`\n\n📌 Toplam Kart Bölümü: ${cardSections.length}`);
    
    if (cardSections.length === 0) {
      console.log('  ⚠️  Hiç kart bölümü bulunamadı!');
      continue;
    }
    
    // Her kart bölümü için header ve veri satırlarını analiz et
    for (let idx = 0; idx < cardSections.length; idx++) {
      const section = cardSections[idx];
      const nextSectionRow = idx < cardSections.length - 1 
        ? cardSections[idx + 1].rowIndex 
        : data.length;
      
      console.log(`\n\n  🎯 Kart ${idx + 1}: ${section.cardNumber}`);
      console.log(`     Başlangıç: Satır ${section.actualRow}`);
      console.log(`     Bitiş: Satır ${nextSectionRow}`);
      console.log(`     Kapsam: ${nextSectionRow - section.rowIndex} satır`);
      
      // Header satırını bul (genellikle 2 satır sonra)
      let headerRow = null;
      let headerRowIndex = -1;
      
      // Türkçe normalize helper
      const normalizeTurkish = (text) => 
        text.toLowerCase()
          .replace(/İ/g, 'i')
          .replace(/i̇/g, 'i')
          .replace(/ş/g, 's')
          .replace(/Ş/g, 's')
          .replace(/ğ/g, 'g')
          .replace(/Ğ/g, 'g')
          .replace(/ü/g, 'u')
          .replace(/Ü/g, 'u')
          .replace(/ö/g, 'o')
          .replace(/Ö/g, 'o')
          .replace(/ç/g, 'c')
          .replace(/Ç/g, 'c');
      
      for (let i = section.rowIndex + 1; i < Math.min(section.rowIndex + 5, nextSectionRow); i++) {
        const row = data[i];
        const rowStr = normalizeTurkish(row.join(' '));
        
        if (rowStr.includes('tarih') && rowStr.includes('islem') && rowStr.includes('tutar')) {
          headerRow = row;
          headerRowIndex = i;
          console.log(`     📋 Header: Satır ${i + 1}`);
          console.log(`        ${JSON.stringify(row.slice(0, 5))}`);
          break;
        }
      }
      
      if (!headerRow) {
        console.log(`     ⚠️  Header bulunamadı!`);
        continue;
      }
      
      // Veri satırlarını say
      const dataStartRow = headerRowIndex + 1;
      let dataRowCount = 0;
      
      for (let i = dataStartRow; i < nextSectionRow; i++) {
        const row = data[i];
        const hasData = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
        
        if (hasData) {
          // Tarih var mı?
          const tarih = row[0];
          if (tarih && String(tarih).trim() !== '') {
            dataRowCount++;
            
            // İlk 3 ve son 2 satırı göster
            if (dataRowCount <= 3 || i >= nextSectionRow - 2) {
              console.log(`     ${dataRowCount === 1 ? '📊 İlk' : dataRowCount <= 3 ? '   ' : '📊 Son'} Satır ${i + 1}: ${String(tarih).substring(0, 12)} | ${String(row[1] || '').substring(0, 40)} | ${row[4]}`);
            } else if (dataRowCount === 4) {
              console.log(`     ... (${nextSectionRow - dataStartRow - 5} satır daha)`);
            }
          }
        } else {
          // Boş satır, veri bitti
          break;
        }
      }
      
      console.log(`     ✅ Toplam İşlem: ${dataRowCount}`);
    }
    
  } catch (error) {
    console.error(`  ❌ Hata: ${error.message}`);
  }
}

console.log('\n\n' + '='.repeat(80));
console.log('✅ Analiz Tamamlandı\n');
