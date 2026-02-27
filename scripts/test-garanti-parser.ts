/**
 * Garanti Parser Test Script
 */

const path = require('path');
const fs = require('fs');

// Excel parser'ı import et
const { parseStatementExcel } = require('../lib/excel-parser');

const EKSTRELER_PATH = path.join(__dirname, '..', 'ekstreler');

// Test edilecek dosyalar
const testFiles = [
  'GARANTİ BONUS TROY OCAK 2026.xls',
  'GARANTİ TROY OCAK 2026.xls',
  'M&S PLATINUM MC BARIŞ BAYSAL ŞAHSİ OCAK 2026.xls'
];

async function testGarantiParser() {
  console.log('🧪 Garanti Parser Test\n');
  console.log('='.repeat(80));
  
  for (const fileName of testFiles) {
    const filePath = path.join(EKSTRELER_PATH, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.log(`\n⚠️  Dosya bulunamadı: ${fileName}`);
      continue;
    }
    
    console.log(`\n\n📄 Test: ${fileName}`);
    console.log('-'.repeat(80));
    
    try {
      // Dosyayı buffer olarak oku
      const buffer = fs.readFileSync(filePath);
      
      // Parse et
      const result = await parseStatementExcel(buffer, fileName);
      
      console.log(`\n✅ Parse başarılı!`);
      console.log(`   Banka: ${result.bankName}`);
      console.log(`   Kart Son 4: ${result.cardLastFour}`);
      console.log(`   Toplam İşlem: ${result.items.length}`);
      
      // İstatistikler
      const payments = result.items.filter((i: any) => i.transactionType === 'payment');
      const expenses = result.items.filter((i: any) => i.transactionType === 'expense');
      const installments = result.items.filter((i: any) => i.isInstallment);
      
      console.log(`\n   📊 İstatistikler:`);
      console.log(`      💰 Ödemeler: ${payments.length}`);
      console.log(`      💸 Harcamalar: ${expenses.length}`);
      console.log(`      📅 Taksitli: ${installments.length}`);
      
      // İlk 5 işlemi göster
      console.log(`\n   🔍 İlk 5 İşlem:`);
      result.items.slice(0, 5).forEach((item: any, index: number) => {
        const icon = item.transactionType === 'payment' ? '💰' : '💸';
        const installmentInfo = item.isInstallment 
          ? ` (${item.installmentCurrent}/${item.installmentTotal} taksit)`
          : '';
        console.log(`      ${index + 1}. ${icon} ${item.transactionName}${installmentInfo}`);
        console.log(`         ${item.amount} ${item.currency} - ${item.transactionDate}`);
        if (item.description) {
          console.log(`         Etiket: ${item.description}`);
        }
      });
      
      // Unique kartları göster
      const uniqueCards = [...new Set(result.items.map((i: any) => i.fullCardNumber).filter(Boolean))];
      if (uniqueCards.length > 0) {
        console.log(`\n   💳 Kartlar:`);
        uniqueCards.forEach(card => {
          const cardItems = result.items.filter((i: any) => i.fullCardNumber === card);
          console.log(`      ${card} (${cardItems.length} işlem)`);
        });
      }
      
      // Taksitli işlemleri detaylı göster
      if (installments.length > 0) {
        console.log(`\n   📅 Taksitli İşlemler:`);
        installments.slice(0, 5).forEach((item: any) => {
          console.log(`      • ${item.transactionName}`);
          console.log(`        ${item.installmentCurrent}/${item.installmentTotal} taksit - ${item.amount} TL`);
        });
        if (installments.length > 5) {
          console.log(`      ... ve ${installments.length - 5} taksit daha`);
        }
      }
      
    } catch (error: any) {
      console.error(`\n❌ Hata: ${error.message}`);
      if (error.stack) {
        console.error(`\nStack trace:\n${error.stack}`);
      }
    }
  }
  
  console.log('\n\n' + '='.repeat(80));
  console.log('✅ Test Tamamlandı\n');
}

// Test'i çalıştır
testGarantiParser().catch(console.error);
