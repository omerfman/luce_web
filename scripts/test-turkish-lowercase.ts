/**
 * Test Turkish lowercase İ character
 */

const testStr = 'İşlem Tarihi';
const lowered = testStr.toLowerCase();

console.log('Original:', testStr);
console.log('Lowercased:', lowered);
console.log('Chars:', Array.from(lowered).map(c => `${c} (${c.charCodeAt(0)})`).join(', '));
console.log('');
console.log('Test includes "işlem tarihi":', lowered.includes('işlem tarihi'));
console.log('Test includes "i̇şlem tarihi":', lowered.includes('i̇şlem tarihi'));

// Row 15 test
const row15 = [
  'İşlem Tarihi',
  'İşlemler',
  'Sektör',
  'Tutar',
  'Kart No',
  'Puan',
  'Tutar / Taksit'
];

const rowStr = row15.join(' ').toLowerCase();
console.log('\nRow string:', rowStr);
console.log('');
console.log('Has "işlem tarihi":', rowStr.includes('işlem tarihi'));
console.log('Has "işlemler":', rowStr.includes('işlemler'));
console.log('Has "kart no":', rowStr.includes('kart no'));
console.log('');
console.log('All three?', 
  rowStr.includes('işlem tarihi') && 
  rowStr.includes('işlemler') && 
  rowStr.includes('kart no')
);
