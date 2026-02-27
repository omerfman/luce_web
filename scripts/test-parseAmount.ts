// Test parseAmount function with fixed logic

function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  
  // String'i temizle
  let cleaned = String(amountStr).trim();
  
  // Türk formatı: 1.234,56 → 1234.56
  if (cleaned.includes('.') && cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  // Sadece virgül var: 1234,56 → 1234.56
  else if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
  }
  // Sadece nokta var: Ondalık mı binlik mi?
  else if (cleaned.includes('.') && !cleaned.includes(',')) {
    const parts = cleaned.split('.');
    
    if (parts.length === 2) {
      const afterDot = parts[1];
      
      // Noktadan sonra 1-2 hane varsa → ondalık ayracı (örn: 751.1, 1234.56, 1234567.89)
      // Noktadan sonra 3 hane varsa → binlik ayracı (örn: 1.234, 12.345)
      if (afterDot.length <= 2) {
        // Ondalık ayracı - değiştirme yapma
      } else {
        // Binlik ayracı (örn: 1.234 → 1234)
        cleaned = cleaned.replace(/\./g, '');
      }
    } else if (parts.length > 2) {
      // Birden fazla nokta var (örn: 1.234.567) - binlik ayracı
      cleaned = cleaned.replace(/\./g, '');
    }
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Test cases
const testCases = [
  { input: '-751.1', expected: -751.1, description: 'SAVAŞ BOYA case (negative decimal)' },
  { input: '-2215.7', expected: -2215.7, description: 'STAR ALÜMİNYUM case (negative decimal)' },
  { input: '-430', expected: -430, description: 'Integer without decimal (negative)' },
  { input: '-38800', expected: -38800, description: 'Large integer (negative)' },
  { input: '1234.56', expected: 1234.56, description: 'Standard decimal' },
  { input: '1.234', expected: 1234, description: 'Thousand separator (3 digits after dot)' },
  { input: '1.234.567', expected: 1234567, description: 'Multiple thousand separators' },
  { input: '1234,56', expected: 1234.56, description: 'Turkish format comma' },
  { input: '1.234,56', expected: 1234.56, description: 'Turkish format both' },
  { input: '12.5', expected: 12.5, description: 'Small decimal' },
  { input: '1234567.89', expected: 1234567.89, description: 'Large number with decimal (7 digits)' },
  { input: '751.1', expected: 751.1, description: 'DenizBank case positive' },
  { input: '2215.7', expected: 2215.7, description: 'DenizBank case positive' },
];

console.log('🧪 Testing parseAmount function\n');

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = parseAmount(test.input);
  const isCorrect = Math.abs(result - test.expected) < 0.01;
  
  if (isCorrect) {
    console.log(`✅ ${test.description}`);
    console.log(`   Input: "${test.input}" → Output: ${result} (Expected: ${test.expected})`);
    passed++;
  } else {
    console.log(`❌ ${test.description}`);
    console.log(`   Input: "${test.input}" → Output: ${result} (Expected: ${test.expected})`);
    failed++;
  }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('✅ All tests passed!');
} else {
  console.log('❌ Some tests failed');
  process.exit(1);
}
