/**
 * YKB Excel dosyasını test et
 */

import { parseStatementExcel } from '../lib/excel-parser';
import * as fs from 'fs';
import * as path from 'path';

async function testParse() {
  const filePath = path.join(__dirname, '..', 'ekstreler', 'YKB OCAK 2026 KK.xls');
  
  console.log('📄 Testing file:', filePath);
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ File not found:', filePath);
    return;
  }
  
  const buffer = fs.readFileSync(filePath);
  
  try {
    console.log('\n🚀 Starting parse...\n');
    const parsed = await parseStatementExcel(buffer, 'YKB OCAK 2026 KK.xls');
    
    console.log('\n✅ Parse successful!');
    console.log('Total items:', parsed.items.length);
    console.log('Total amount:', parsed.totalAmount);
    console.log('Card number:', parsed.detectedCardNumber);
    console.log('Month:', parsed.detectedMonth);
    
    if (parsed.items.length > 0) {
      console.log('\nFirst 3 items:');
      parsed.items.slice(0, 3).forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.transactionName} - ${item.amount} ${item.currency} - ${item.transactionDate}`);
      });
    }
  } catch (error: any) {
    console.error('\n❌ Parse failed:', error.message);
    console.error(error);
  }
}

testParse();
