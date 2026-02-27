import * as XLSX from 'xlsx';

const filePath = 'ekstreler/DENİZBANK 8546 BATUHAN ERCİYAS.xlsx';

console.log(`📄 Analyzing: ${filePath}\n`);

const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
console.log(`📊 Sheet: ${sheetName}\n`);

const worksheet = workbook.Sheets[sheetName];

// Read with raw: true to see actual numbers
const dataRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

// Read with raw: false to see formatted strings
const dataFormatted = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

console.log('🔍 Looking for SAVAŞ BOYA and STAR ALÜMİNYUM entries:\n');

for (let i = 0; i < dataRaw.length; i++) {
  const row = dataRaw[i] as any[];
  const rowStr = row.join(' ').toUpperCase();
  
  if (rowStr.includes('SAVAŞ BOYA') || rowStr.includes('STAR ALÜMİNYUM')) {
    console.log(`\n📍 Row ${i + 1}:`);
    console.log('  RAW:', dataRaw[i]);
    console.log('  FORMATTED:', dataFormatted[i]);
    
    // Find amount column
    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (typeof cell === 'number' && cell > 100) {
        console.log(`  📊 Column ${j} (likely amount):`);
        console.log(`    - Raw number: ${cell}`);
        console.log(`    - Formatted: ${(dataFormatted[i] as any[])[j]}`);
        console.log(`    - Type: ${typeof cell}`);
      }
    }
  }
}

console.log('\n\n📋 First 20 rows for context:');
for (let i = 0; i < Math.min(20, dataRaw.length); i++) {
  console.log(`Row ${i + 1}:`, dataRaw[i]);
}
