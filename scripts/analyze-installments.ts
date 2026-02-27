/**
 * Analyze Card Statement Formats
 * Tüm ekstreleri inceler ve taksit bilgilerini analiz eder
 */

require('dotenv').config({ path: '.env.local' });
const ExcelJS = require('exceljs');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const EKSTRELER_PATH = path.join(__dirname, '..', 'ekstreler');

async function analyzeAllStatements() {
  const files = fs.readdirSync(EKSTRELER_PATH).filter(f => 
    f.endsWith('.xls') || f.endsWith('.xlsx')
  );

  console.log(`📊 Analyzing ${files.length} statement files...\n`);

  for (const file of files) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📄 File: ${file}`);
    console.log(`${'='.repeat(80)}`);
    
    const filePath = path.join(EKSTRELER_PATH, file);
    
    try {
      let workbook;
      let worksheet;
      
      if (file.endsWith('.xlsx')) {
        workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        worksheet = workbook.worksheets[0];
      } else {
        const wb = xlsx.readFile(filePath);
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        
        // Find card number in first 10 rows
        console.log('\n🔍 First 10 rows (looking for card number):');
        for (let i = 0; i < Math.min(10, data.length); i++) {
          const row = data[i];
          const rowStr = row.join(' | ');
          console.log(`  Row ${i + 1}: ${rowStr}`);
          
          // Look for card number patterns
          const cardMatch = rowStr.match(/\d{4}[*\s]+\d{4}[*\s]+\d{4}[*\s]+(\d{4})/);
          if (cardMatch) {
            console.log(`    ✅ Found card: ****${cardMatch[1]}`);
          }
        }
        
        // Find transaction data
        console.log('\n💳 Sample transactions (looking for installments):');
        let transactionCount = 0;
        for (let i = 0; i < data.length && transactionCount < 20; i++) {
          const row = data[i];
          const rowStr = row.join(' | ');
          
          // Look for installment patterns
          if (rowStr.match(/\d+\/\d+/) || rowStr.match(/taksit/i)) {
            console.log(`\n  Row ${i + 1}: ${rowStr}`);
            
            // Extract installment info
            const taksitMatch = rowStr.match(/(\d+)\/(\d+)\s*taksit/i);
            const parenMatch = rowStr.match(/\((\d+)\/(\d+)\)/);
            
            if (taksitMatch) {
              console.log(`    📌 Taksit: ${taksitMatch[1]}/${taksitMatch[2]}`);
            } else if (parenMatch) {
              console.log(`    📌 Taksit: ${parenMatch[1]}/${parenMatch[2]}`);
            }
            
            transactionCount++;
          }
        }
        
        continue;
      }
      
      console.log('\n🔍 First 10 rows (looking for card number):');
      let rowNum = 0;
      worksheet.eachRow((row, rowIndex) => {
        if (rowIndex <= 10) {
          const values = row.values;
          const rowStr = values.slice(1).join(' | ');
          console.log(`  Row ${rowIndex}: ${rowStr}`);
          
          // Look for card number
          const cardMatch = rowStr.match(/\d{4}[*\s]+\d{4}[*\s]+\d{4}[*\s]+(\d{4})/);
          if (cardMatch) {
            console.log(`    ✅ Found card: ****${cardMatch[1]}`);
          }
        }
      });
      
      console.log('\n💳 Sample transactions (looking for installments):');
      let transactionCount = 0;
      worksheet.eachRow((row, rowIndex) => {
        if (transactionCount >= 20) return;
        
        const values = row.values;
        const rowStr = values.slice(1).join(' | ');
        
        if (rowStr.match(/\d+\/\d+/) || rowStr.match(/taksit/i)) {
          console.log(`\n  Row ${rowIndex}: ${rowStr}`);
          
          const taksitMatch = rowStr.match(/(\d+)\/(\d+)\s*taksit/i);
          const parenMatch = rowStr.match(/\((\d+)\/(\d+)\)/);
          
          if (taksitMatch) {
            console.log(`    📌 Taksit: ${taksitMatch[1]}/${taksitMatch[2]}`);
          } else if (parenMatch) {
            console.log(`    📌 Taksit: ${parenMatch[1]}/${parenMatch[2]}`);
          }
          
          transactionCount++;
        }
      });
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
}

analyzeAllStatements().then(() => {
  console.log('\n✅ Analysis complete!');
}).catch(err => {
  console.error('Fatal error:', err);
});
