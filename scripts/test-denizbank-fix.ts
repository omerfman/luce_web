import { parseStatementExcel } from '../lib/excel-parser';
import * as fs from 'fs';

const filePath = 'ekstreler/DENİZBANK 8546 BATUHAN ERCİYAS.xlsx';

console.log(`📄 Testing: ${filePath}\n`);

async function test() {
  const fileBuffer = fs.readFileSync(filePath);
  const file = new File([fileBuffer], filePath, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  const result = await parseStatementExcel(file);
  
  console.log(`✅ Parsed ${result.items.length} items\n`);
  
  // SAVAŞ BOYA'yı bul
  const savas = result.items.find(item => item.transactionName.includes('SAVAŞ BOYA SAN.VE TİC'));
  if (savas) {
    console.log('🔍 SAVAŞ BOYA SAN.VE TİC.LTD:');
    console.log(`   Tutar: ${savas.amount} TL`);
    console.log(`   Beklenen: -751.10 TL (harcama)`);
    console.log(`   ${Math.abs(savas.amount - (-751.10)) < 0.01 ? '✅ DOĞRU' : '❌ YANLIŞ'}`);
  }
  
  // STAR ALÜMİNYUM'u bul
  const star = result.items.find(item => item.transactionName.includes('STAR ALÜMİNYUM'));
  if (star) {
    console.log('\n🔍 STAR ALÜMİNYUM:');
    console.log(`   Tutar: ${star.amount} TL`);
    console.log(`   Beklenen: -2215.70 TL (harcama)`);
    console.log(`   ${Math.abs(star.amount - (-2215.70)) < 0.01 ? '✅ DOĞRU' : '❌ YANLIŞ'}`);
  }
  
  console.log('\n📊 İlk 10 işlem:');
  result.items.slice(0, 10).forEach((item, i) => {
    console.log(`${i + 1}. ${item.transactionName.substring(0, 40).padEnd(40)} → ${item.amount.toFixed(2)} TL`);
  });
}

test().catch(console.error);
