/**
 * Test YKB Parser
 * YKB dosyasını parse edip sonuçları göster
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseStatementExcel } from '../lib/excel-parser';

async function testYKBParser() {
  const filePath = path.join(__dirname, '..', 'ekstreler', 'ŞAHSİ YKB OCAK 2026 KK.xls');
  
  console.log('📄 Testing file:', filePath);
  console.log('Exists:', fs.existsSync(filePath));
  console.log('');
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ File not found!');
    return;
  }
  
  try {
    const buffer = fs.readFileSync(filePath);
    
    console.log('📊 Parsing...\n');
    const result = await parseStatementExcel(buffer, 'ŞAHSİ YKB OCAK 2026 KK.xls');
    
    console.log('✅ Parse successful!\n');
    console.log('📋 Summary:');
    console.log(`  Total items: ${result.items.length}`);
    console.log(`  Total amount: ${result.totalAmount}`);
    console.log(`  Detected card: ${result.detectedCardNumber}`);
    console.log(`  Header row: ${result.headerRow}`);
    console.log('');
    
    // Unique card numbers
    const uniqueCards = new Set<string>();
    const paymentCount = result.items.filter(item => item.transactionType === 'payment').length;
    const expenseCount = result.items.filter(item => item.transactionType === 'expense').length;
    
    result.items.forEach(item => {
      if (item.fullCardNumber) {
        uniqueCards.add(item.fullCardNumber);
      }
    });
    
    console.log('💳 Unique Cards:', uniqueCards.size);
    uniqueCards.forEach(card => {
      console.log(`   - ${card}`);
    });
    console.log('');
    
    console.log('📊 Transaction Types:');
    console.log(`   Payments: ${paymentCount}`);
    console.log(`   Expenses: ${expenseCount}`);
    console.log('');
    
    // Sample items
    console.log('📝 Sample items (first 5):');
    result.items.slice(0, 5).forEach((item, idx) => {
      console.log(`\n${idx + 1}. ${item.transactionName}`);
      console.log(`   Amount: ${item.amount} ${item.currency}`);
      console.log(`   Type: ${item.transactionType || 'not set'}`);
      console.log(`   Card: ${item.fullCardNumber || 'N/A'}`);
      console.log(`   Holder: ${item.cardHolderName || 'N/A'}`);
      console.log(`   Date: ${item.transactionDate}`);
      if (item.isInstallment) {
        console.log(`   Installment: ${item.installmentCurrent}/${item.installmentTotal}`);
      }
    });
    
    // Installment items
    const installmentItems = result.items.filter(item => item.isInstallment);
    console.log(`\n\n📅 Installment items: ${installmentItems.length}`);
    installmentItems.forEach((item, idx) => {
      console.log(`\n${idx + 1}. ${item.transactionName}`);
      console.log(`   ${item.installmentCurrent}/${item.installmentTotal} Taksit`);
      if (item.installmentTotalAmount) {
        console.log(`   Total: ${item.installmentTotalAmount}`);
      }
    });
    
  } catch (error: any) {
    console.error('❌ Parse error:', error.message);
    console.error(error.stack);
  }
}

testYKBParser();
