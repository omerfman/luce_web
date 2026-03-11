/**
 * Garanti Troy INTEMA VITRA Taksit Debug
 * 
 * 1.646,66 TL harcamasının nasıl parse edildiğini kontrol eder
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EKSTRELER_PATH = path.join(__dirname, '..', 'ekstreler');
const testFile = 'GARANTİ TROY OCAK 2026.xls';

console.log('🔍 INTEMA VITRA Taksit Debug\n');
console.log('='.repeat(80));

const filePath = path.join(EKSTRELER_PATH, testFile);

if (!fs.existsSync(filePath)) {
  console.log(`\n⚠️  Dosya bulunamadı: ${testFile}`);
  process.exit(1);
}

const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];

console.log(`\n📄 Dosya: ${testFile}`);
console.log(`📊 Sheet: "${sheetName}"\n`);

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

// Tüm INTEMA VITRA harcamalarını bul
console.log('🔍 Tüm INTEMA VITRA harcamalarını arıyoruz...\n');

const intemaItems: any[] = [];

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  if (!row || row.length < 5) continue;
  
  const tarih = row[0];
  const işlem = row[1];
  const tutar = row[4];
  
  if (!işlem) continue;
  
  const işlemStr = String(işlem).toUpperCase();
  if (!işlemStr.includes('INTEMA') && !işlemStr.includes('VITRA')) continue;
  
  // Tutarı parse et
  let parsedAmount: number = 0;
  if (typeof tutar === 'number') {
    parsedAmount = Math.abs(tutar);
  } else if (tutar) {
    const tutarStr = String(tutar).replace(/\./g, '').replace(',', '.');
    parsedAmount = Math.abs(parseFloat(tutarStr));
  }
  
  intemaItems.push({
    satır: i + 1,
    tarih,
    işlem: String(işlem),
    tutar: parsedAmount
  });
}

console.log(`✅ ${intemaItems.length} adet INTEMA VITRA harcaması bulundu\n`);

for (const item of intemaItems) {
  console.log(`Satır ${item.satır}:`);
  console.log(`  Tarih: ${item.tarih}`);
  console.log(`  İşlem: "${item.işlem}"`);
  console.log(`  Tutar: ${item.tutar.toFixed(2)} TL`);
  
  // Taksit bilgisini çıkar
  const installmentInfo = extractGarantiInstallmentInfo(item.işlem);
  
  if (installmentInfo.isInstallment) {
    const totalAmount = item.tutar * installmentInfo.installmentTotal!;
    console.log(`  ✅ Taksit: ${installmentInfo.installmentCurrent}/${installmentInfo.installmentTotal}`);
    console.log(`  💰 Toplam: ${totalAmount.toFixed(2)} TL`);
    console.log(`  🏷️  Temiz ad: "${installmentInfo.cleanName}"`);
  } else {
    console.log(`  ❌ Taksit bilgisi YOK`);
  }
  
  console.log('');
}

console.log('');
