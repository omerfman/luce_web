/**
 * Test Installment Detection
 * Bir örnek ekstrede taksit algılamasını test eder
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

// Excel parser'ı import et
const { parseStatementExcel } = require('../lib/excel-parser');

async function testInstallmentDetection() {
  console.log('🧪 Testing installment detection...\n');
  
  // DenizBank 0387 Aralık 2025 dosyasını test et (taksit içeren)
  const filePath = path.join(__dirname, '..', 'ekstreler', 'DENİZBANK 0387 KART ARALIK 2025.xlsx');
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ Test file not found:', filePath);
    return;
  }
  
  console.log('📄 Testing file: DENİZBANK 0387 KART ARALIK 2025.xlsx\n');
  
  const buffer = fs.readFileSync(filePath);
  const parsed = await parseStatementExcel(buffer, 'test.xlsx');
  
  console.log(`✅ Parsed ${parsed.items.length} items\n`);
  console.log(`💳 Detected card: ${parsed.detectedCardNumber || 'Not detected'}`);
  console.log(`📅 Detected month: ${parsed.detectedMonth || 'Not detected'}\n`);
  
  // Taksitli işlemleri filtrele
  const installmentItems = parsed.items.filter(item => item.isInstallment);
  
  console.log(`📊 Found ${installmentItems.length} installment transactions:\n`);
  
  if (installmentItems.length === 0) {
    console.log('⚠️ No installments detected!');
  } else {
    installmentItems.forEach((item, index) => {
      console.log(`${index + 1}. ${item.transactionName}`);
      console.log(`   Row: ${item.rowNumber}`);
      console.log(`   Amount: ${item.amount} ${item.currency}`);
      console.log(`   Date: ${item.transactionDate}`);
      console.log(`   Installment: ${item.installmentCurrent}/${item.installmentTotal}`);
      if (item.installmentTotalAmount) {
        console.log(`   Total Amount: ${item.installmentTotalAmount}`);
      }
      if (item.description) {
        console.log(`   Description: ${item.description}`);
      }
      console.log('');
    });
  }
  
  // Normal işlemlerden birkaç örnek
  console.log('\n📋 Sample non-installment transactions:');
  const nonInstallment = parsed.items.filter(item => !item.isInstallment).slice(0, 5);
  nonInstallment.forEach((item, index) => {
    console.log(`${index + 1}. ${item.transactionName} - ${item.amount} ${item.currency}`);
  });
}

testInstallmentDetection().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
