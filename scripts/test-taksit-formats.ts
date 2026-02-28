/**
 * Taksit Format Testi
 * 
 * Yeni eklenen taksit formatlarının doğru parse edildiğini test eder
 */

// Test edilecek formatlar
const testCases = [
  {
    name: 'Parantez içinde (eski format)',
    işlem: 'INTEMA VITRA-CALIKLAR MAR(2/3) İSTANBUL',
    expected: { isInstallment: true, current: 2, total: 3 }
  },
  {
    name: 'Boşluklu - büyük harf T',
    işlem: 'PARAM /NEYZEN INSAA ISTANBUL 2/3 Taksit',
    expected: { isInstallment: true, current: 2, total: 3 }
  },
  {
    name: 'Boşluklu - küçük harf t',
    işlem: 'FIRMA ADI 2/3 taksit',
    expected: { isInstallment: true, current: 2, total: 3 }
  },
  {
    name: 'Boşluksuz parantez',
    işlem: 'SIPAY ELEKTR/UNICO SIGORT(6/6) ISTANBUL',
    expected: { isInstallment: true, current: 6, total: 6 }
  },
  {
    name: 'Normal işlem (taksitsiz)',
    işlem: 'PARAM/ /TTS ISTANBUL',
    expected: { isInstallment: false }
  },
  {
    name: 'Başka rakam içeren ama taksitsiz',
    işlem: 'HGS-34HST753 İSTANBUL',
    expected: { isInstallment: false }
  }
];

// extractGarantiInstallmentInfo fonksiyonunu simüle et
function extractGarantiInstallmentInfo(işlemAdı: string): {
  isInstallment: boolean;
  installmentCurrent?: number;
  installmentTotal?: number;
  cleanName?: string;
} {
  if (!işlemAdı) {
    return { isInstallment: false };
  }
  
  // Pattern 1: (X/Y) formatı - parantez içinde
  const parenMatch = işlemAdı.match(/\((\d+)\/(\d+)\)/);
  
  if (parenMatch) {
    const current = parseInt(parenMatch[1], 10);
    const total = parseInt(parenMatch[2], 10);
    
    // Taksit bilgisini temizle
    const cleanName = işlemAdı.replace(/\(\d+\/\d+\)/, '').trim();
    
    return {
      isInstallment: true,
      installmentCurrent: current,
      installmentTotal: total,
      cleanName
    };
  }
  
  // Pattern 2: X/Y Taksit veya X/Y taksit formatı
  const spaceMatch = işlemAdı.match(/(\d+)\/(\d+)\s*[Tt]aksit/);
  
  if (spaceMatch) {
    const current = parseInt(spaceMatch[1], 10);
    const total = parseInt(spaceMatch[2], 10);
    
    // Taksit bilgisini temizle
    const cleanName = işlemAdı.replace(/\d+\/\d+\s*[Tt]aksit/g, '').trim();
    
    return {
      isInstallment: true,
      installmentCurrent: current,
      installmentTotal: total,
      cleanName
    };
  }
  
  return { isInstallment: false };
}

console.log('🧪 Taksit Format Testleri\n');
console.log('='.repeat(80));

let passedTests = 0;
let failedTests = 0;

for (const testCase of testCases) {
  const result = extractGarantiInstallmentInfo(testCase.işlem);
  
  const isPass = 
    result.isInstallment === testCase.expected.isInstallment &&
    (testCase.expected.isInstallment === false || 
      (result.installmentCurrent === testCase.expected.current &&
       result.installmentTotal === testCase.expected.total));
  
  if (isPass) {
    console.log(`\n✅ ${testCase.name}`);
    console.log(`   İşlem: "${testCase.işlem}"`);
    if (result.isInstallment) {
      console.log(`   Sonuç: ${result.installmentCurrent}/${result.installmentTotal} taksit`);
      console.log(`   Temiz isim: "${result.cleanName}"`);
    } else {
      console.log(`   Sonuç: Taksitsiz işlem`);
    }
    passedTests++;
  } else {
    console.log(`\n❌ ${testCase.name}`);
    console.log(`   İşlem: "${testCase.işlem}"`);
    console.log(`   Beklenen: ${JSON.stringify(testCase.expected)}`);
    console.log(`   Bulunan: ${JSON.stringify(result)}`);
    failedTests++;
  }
}

console.log('\n' + '='.repeat(80));
console.log(`\n📊 Test Sonuçları: ${passedTests} başarılı, ${failedTests} başarısız`);

if (failedTests === 0) {
  console.log('✅ Tüm testler başarıyla geçti!\n');
} else {
  console.log('⚠️  Bazı testler başarısız oldu!\n');
  process.exit(1);
}
