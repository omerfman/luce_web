/**
 * Excel Parser for Credit Card Statements
 * 
 * Bu modül farklı banka formatlarındaki kredi kartı ekstrelerini
 * parse eder ve normalize edilmiş veri döndürür.
 * 
 * Desteklenen formatlar:
 * - Denizbank (.xlsx)
 * - Garanti (.xls)
 * - YKB (.xls)
 * - QNB Finansbank / M&S (.xls)
 */

import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface ColumnMapping {
  transactionName?: number;  // İşlem Adı / İşlem
  amount?: number;           // İşlem Tutarı / Tutar
  currency?: number;         // Para Birimi
  date?: number;             // Tarih / İşlem Tarihi
  cardNumber?: number;       // Kart No
  description?: number;      // Açıklama
}

export interface ParsedStatementItem {
  rowNumber: number;
  transactionName: string;
  amount: number;
  currency: string;
  transactionDate: string;  // ISO date string
  
  // İşlem tipi
  transactionType?: 'expense' | 'payment';  // expense = harcama, payment = borç ödemesi
  
  // Kart bilgileri
  cardLastFour?: string;
  fullCardNumber?: string;     // Tam kart no (maskelenmiş): "5258 64** **** 7608"
  cardHolderName?: string;     // Kart sahibi (ek kart ise): "FARUK ASARKAYA / Ek Kart"
  
  description?: string;
  
  // Taksit bilgileri
  isInstallment?: boolean;
  installmentCurrent?: number;  // Kaçıncı taksit (örn: 3)
  installmentTotal?: number;    // Toplam taksit (örn: 6)
  installmentTotalAmount?: number; // Taksit toplamı (örn: 32631.33)
  
  rawData: Record<string, any>;
}

export interface ParsedStatement {
  items: ParsedStatementItem[];
  totalTransactions: number;
  totalAmount: number;
  detectedCardNumber?: string; // Son 4 hane
  detectedMonth?: string;      // YYYY-MM-01
  headerRow: number;
  columns: ColumnMapping;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Excel cell değerini string'e çevirir (Rich Text desteği ile)
 */
function cellToString(cellValue: any): string {
  if (cellValue === null || cellValue === undefined) {
    return '';
  }
  
  // Rich Text objesi
  if (typeof cellValue === 'object' && 'richText' in cellValue) {
    return cellValue.richText.map((rt: any) => rt.text).join('');
  }
  
  // Text objesi
  if (typeof cellValue === 'object' && 'text' in cellValue) {
    return cellValue.text;
  }
  
  // Date objesi
  if (cellValue instanceof Date) {
    return cellValue.toISOString();
  }
  
  // Normal string/number
  return String(cellValue).trim();
}

/**
 * Tarih string'ini ISO formatına çevirir
 * Örnekler: "31.12.2025", "2025-12-31", "31/12/2025"
 */
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Excel serial date (say olarak gelirse)
  if (!isNaN(Number(dateStr))) {
    const excelEpoch = new Date(1900, 0, 1);
    const days = parseInt(dateStr) - 2; // Excel'in bug'ı için -2
    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  // DD.MM.YYYY formatı
  const ddmmyyyyPattern = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
  const match1 = dateStr.match(ddmmyyyyPattern);
  if (match1) {
    const [, day, month, year] = match1;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // DD/MM/YYYY formatı
  const ddmmyyyySlash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match2 = dateStr.match(ddmmyyyySlash);
  if (match2) {
    const [, day, month, year] = match2;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // YYYY-MM-DD formatı (zaten ISO)
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (isoPattern.test(dateStr)) {
    return dateStr;
  }
  
  return null;
}

/**
 * Tutar string'ini decimal'e çevirir
 * Örnekler: "-7,815.83", "20000", "-11.366,70"
 */
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
  // Sadece nokta var: 1,234.56 → 1234.56
  else if (cleaned.includes('.') && !cleaned.includes(',')) {
    // Eğer noktadan önce 3 basamak varsa binlik ayracıdır
    const parts = cleaned.split('.');
    if (parts.length === 2 && parts[1].length === 2) {
      // 1234.56 gibi (ondalık ayracı)
      // Değiştirme
    } else {
      // 1.234.56 veya 1.234 gibi (binlik ayracı)
      cleaned = cleaned.replace(/\./g, '');
    }
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Kart numarasından son 4 haneyi çıkarır
 * Örnekler: "5584 60** **** 6268" → "6268", "****1234" → "1234"
 */
function extractCardLastFour(cardStr: string): string | undefined {
  if (!cardStr) return undefined;
  
  // Son 4 rakamı bul
  const match = cardStr.match(/(\d{4})\D*$/);
  if (match) {
    return match[1];
  }
  
  return undefined;
}

/**
 * Taksit bilgisini çıkarır
 * 
 * Desteklenen formatlar:
 * 1. YKB: "OZEN MOTORLU ARACLAR ISTANBUL TR 5350 TL'lik işlemin 1/5 taksidi"
 * 2. Garanti: "ÇALIKLAR İNŞAAT YAPI İSTANBUL TR 90754,42 TL'lik işlemin 3/3 taksidi"
 * 3. "BETEK-YAPIDEK SPOT BOYA V(4/5) İSTANBUL"
 * 4. Denizbank: İşlem adı "Peş. Taksit 2.Tk" + Açıklama "Taksit 2 / 6" (Toplam olmayabilir)
 */
interface InstallmentInfo {
  isInstallment: boolean;
  current?: number;
  total?: number;
  totalAmount?: number;
}

function extractInstallmentInfo(
  transactionName: string,
  description?: string
): InstallmentInfo {
  const result: InstallmentInfo = { isInstallment: false };
  
  // Format 1: "1/5 taksidi" veya "3/3 taksit" (YKB/Garanti)
  // Türkçe karakter varyasyonları: taksit, taksiti, taksidi, taksıtı
  const taksitPattern = /(\d+)\/(\d+)\s*taks[iı][tı]?[iı]?d?[iı]?/i;
  let match = transactionName.match(taksitPattern);
  if (match) {
    result.isInstallment = true;
    result.current = parseInt(match[1]);
    result.total = parseInt(match[2]);
    
    // Toplam tutarı bulmaya çalış (YKB/Garanti format): "5350 TL'lik işlemin"
    const amountPattern = /([\d.,]+)\s*TL['"]?lik\s+işlemin/i;
    const amountMatch = transactionName.match(amountPattern);
    if (amountMatch) {
      const totalAmount = parseAmount(amountMatch[1]);
      result.totalAmount = totalAmount;
      console.log(`    📝 Found installment total in transaction name: ${totalAmount} TL`);
    }
    
    return result;
  }
  
  // Format 2: "(4/5)" parantez içinde
  const parenPattern = /\((\d+)\/(\d+)\)/;
  match = transactionName.match(parenPattern);
  if (match) {
    result.isInstallment = true;
    result.current = parseInt(match[1]);
    result.total = parseInt(match[2]);
    return result;
  }
  
  // Format 3: Denizbank - açıklama sütununda
  if (description) {
    // "Taksit 2 / 6 - Toplam: 32.631,33 TL" (toplam varsa)
    const denizbankPatternWithTotal = /Taksit\s+(\d+)\s*\/\s*(\d+)\s*-\s*Toplam:\s*([\d.,]+)/i;
    match = description.match(denizbankPatternWithTotal);
    if (match) {
      result.isInstallment = true;
      result.current = parseInt(match[1]);
      result.total = parseInt(match[2]);
      result.totalAmount = parseAmount(match[3]);
      console.log(`    📝 Denizbank installment with total: ${result.current}/${result.total}, total: ${result.totalAmount} TL`);
      return result;
    }
    
    // İşlem adında "Peş. Taksit" veya "Taksit" var mı? (toplam yoksa)
    if (transactionName.match(/Peş\.\s*Taksit/i) || transactionName.match(/Taksit[\s\d.]+Anapara/i)) {
      // Açıklamadan sadece taksit bilgisini çıkar (toplam yok)
      const simplePattern = /Taksit\s+(\d+)\s*\/\s*(\d+)/i;
      match = description.match(simplePattern);
      if (match) {
        result.isInstallment = true;
        result.current = parseInt(match[1]);
        result.total = parseInt(match[2]);
        // totalAmount yok - statement-matcher.ts'de hesaplanacak
        console.log(`    📝 Denizbank installment WITHOUT total: ${result.current}/${result.total} (will calculate)`);
      }
    }
  }
  
  return result;
}

/**
 * İlk N satırdan kart numarasını otomatik tespit eder
 */
function detectCardNumberFromRows(rows: any[][], maxRows: number = 20): string | undefined {
  for (let i = 0; i < Math.min(maxRows, rows.length); i++) {
    const rowStr = rows[i].join(' ');
    
    // "5584 60** **** 8546" formatı
    const pattern1 = /\d{4}\s+\d{2}\*\*\s+\*{4}\s+(\d{4})/;
    const match1 = rowStr.match(pattern1);
    if (match1) {
      return match1[1];
    }
    
    // "9792 **** **** 7037" formatı
    const pattern2 = /\d{4}\s+\*{4}\s+\*{4}\s+(\d{4})/;
    const match2 = rowStr.match(pattern2);
    if (match2) {
      return match2[1];
    }
    
    // "****6436" formatı
    const pattern3 = /\*{4,}\s*(\d{4})/;
    const match3 = rowStr.match(pattern3);
    if (match3) {
      return match3[1];
    }
  }

  return undefined;
}

/**
 * YKB (Yapı Kredi) formatını tespit eder
 * 
 * YKB özellikleri:
 * - İlk satırda "Hesap Özeti" başlığı
 * - "Kart No", "Müşteri Adı Soyadı", "Hesap Özeti Tutarı" metadata satırları
 * - Header: "İşlem Tarihi", "İşlemler", "Tutar", "Kart No" gibi sütunlar
 * - Kart No sütununda birden fazla kart olabilir (Ana + Ek kartlar)
 * - Tutar sütununda "+" işareti ödeme (payment), yoksa harcama (expense)
 */
function detectYKBFormat(rows: any[][]): boolean {
  if (rows.length < 10) return false;
  
  // Türkçe normalizasyon helper - tüm Türkçe karakterleri ASCII'ye çevir
  const normalizeTurkish = (text: string) => 
    text.toLowerCase()
      .replace(/İ/g, 'i')
      .replace(/i̇/g, 'i')
      .replace(/ş/g, 's')
      .replace(/Ş/g, 's')
      .replace(/ğ/g, 'g')
      .replace(/Ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/Ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/Ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'c');
  
  // İlk 10 satıra bak (YKB metadata yukarıda olur)
  const firstRows = rows.slice(0, 10).map(row => normalizeTurkish(row.join(' ')));
  
  // "Hesap Özeti" → "hesap ozeti"
  const hasHesapOzeti = firstRows.some(row => row.includes('hesap ozeti'));
  
  // "Müşteri Adı Soyadı" → "musteri adi" VEYA "Asgari Ödeme" → "asgari odeme"
  const hasYKBMetadata = firstRows.some(row => 
    row.includes('musteri adi') || 
    row.includes('asgari odeme') ||
    row.includes('odenmesi gereken')
  );
  
  // Header satırında "İşlem Tarihi" + "İşlemler" + "Kart No" → "islem tarihi" + "islemler" + "kart no"
  let hasYKBHeaders = false;
  for (let i = 5; i < Math.min(30, rows.length); i++) {
    const rowStr = normalizeTurkish(rows[i].join(' '));
    
    if (rowStr.includes('islem tarihi') && 
        rowStr.includes('islemler') && 
        rowStr.includes('kart no')) {
      hasYKBHeaders = true;
      console.log(`  ✅ YKB headers found at row ${i}`);
      break;
    }
  }
  
  const result = hasHesapOzeti && hasYKBMetadata && hasYKBHeaders;
  console.log(`  YKB Detection: hesapOzeti=${hasHesapOzeti}, metadata=${hasYKBMetadata}, headers=${hasYKBHeaders} → ${result}`);
  
  return result;
}

/**
 * Garanti Bankası formatını tespit eder
 * 
 * Garanti özellikleri:
 * - Satır 4: "XXXX **** **** YYYY Numaralı Kart TL Ekstre Bilgileri"
 * - Satır 6: Header (Tarih, İşlem, Etiket, Bonus/Mil, Tutar(TL))
 * - Sheet adı: "Ekstre Islemleri - TL"
 */
function detectGarantiFormat(rows: any[][], sheetName?: string): boolean {
  if (rows.length < 7) return false;
  
  // Türkçe normalizasyon helper
  const normalizeTurkish = (text: string) => 
    text.toLowerCase()
      .replace(/İ/g, 'i')
      .replace(/i̇/g, 'i')
      .replace(/ş/g, 's')
      .replace(/Ş/g, 's')
      .replace(/ğ/g, 'g')
      .replace(/Ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/Ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/Ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'c');
  
  // Sheet adı kontrolü (opsiyonel ama güçlü bir gösterge)
  const hasGarantiSheetName = sheetName ? normalizeTurkish(sheetName).includes('ekstre islemleri') : false;
  
  // Satır 4: Kart numarası bilgisi
  // Örnek: "9792 **** **** 7037 Numaralı Kart TL Ekstre Bilgileri"
  const row4Str = normalizeTurkish(rows[3]?.join(' ') || '');
  const hasCardInfo = row4Str.includes('numarali kart') || row4Str.includes('ekstre bilgileri');
  
  // Satır 6: Header satırı
  // Kolonlar: Tarih, İşlem, Etiket, Bonus/Mil, Tutar(TL)
  const row6 = rows[5] || [];
  const row6Str = normalizeTurkish(row6.join(' '));
  
  const hasGarantiHeaders = 
    row6Str.includes('tarih') &&
    row6Str.includes('islem') &&
    row6Str.includes('etiket') &&
    row6Str.includes('tutar');
  
  const result = (hasGarantiSheetName || hasCardInfo) && hasGarantiHeaders;
  
  console.log(`  Garanti Detection: sheetName=${hasGarantiSheetName}, cardInfo=${hasCardInfo}, headers=${hasGarantiHeaders} → ${result}`);
  
  if (result) {
    console.log(`  ✅ Garanti format detected!`);
  }
  
  return result;
}

/**
 * Garanti'den kart numarasını parse eder
 * 
 * Format: "9792 **** **** 7037 Numaralı Kart TL Ekstre Bilgileri"
 * Çıktı: { lastFour: "7037", fullCardNumber: "9792 **** **** 7037" }
 */
function parseGarantiCardNumber(cardInfoStr: string): {
  lastFour?: string;
  fullCardNumber?: string;
} {
  if (!cardInfoStr) return {};
  
  // Pattern: "XXXX **** **** YYYY"
  const match = cardInfoStr.match(/(\d{4}\s+\*{4}\s+\*{4}\s+\d{4})/);
  if (!match) return {};
  
  const fullCardNumber = match[1];
  const lastFour = fullCardNumber.split(' ').pop();
  
  return {
    lastFour,
    fullCardNumber
  };
}

/**
 * Garanti taksit bilgisini parse eder
 * 
 * Format: "INTEMA VITRA-CALIKLAR MAR(2/3) İSTANBUL"
 * Çıktı: { isInstallment: true, current: 2, total: 3 }
 */
function extractGarantiInstallmentInfo(işlemAdı: string): {
  isInstallment: boolean;
  installmentCurrent?: number;
  installmentTotal?: number;
  cleanName?: string;  // Taksit bilgisi temizlenmiş isim
} {
  if (!işlemAdı) {
    return { isInstallment: false };
  }
  
  // Pattern: (X/Y) formatı
  const match = işlemAdı.match(/\((\d+)\/(\d+)\)/);
  
  if (!match) {
    return { isInstallment: false };
  }
  
  const current = parseInt(match[1], 10);
  const total = parseInt(match[2], 10);
  
  // Taksit bilgisini temizle
  const cleanName = işlemAdı.replace(/\(\d+\/\d+\)/, '').trim();
  
  return {
    isInstallment: true,
    installmentCurrent: current,
    installmentTotal: total,
    cleanName
  };
}

/**
 * Garanti formatındaki ekstreleri parse eder
 */
