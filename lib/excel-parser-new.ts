/**
 * Excel Parser for Credit Card Statements
 * 
 * Bu modÃ¼l farklÄ± banka formatlarÄ±ndaki kredi kartÄ± ekstrelerini
 * parse eder ve normalize edilmiÅŸ veri dÃ¶ndÃ¼rÃ¼r.
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
  transactionName?: number;  // Ä°ÅŸlem AdÄ± / Ä°ÅŸlem
  amount?: number;           // Ä°ÅŸlem TutarÄ± / Tutar
  currency?: number;         // Para Birimi
  date?: number;             // Tarih / Ä°ÅŸlem Tarihi
  cardNumber?: number;       // Kart No
  description?: number;      // AÃ§Ä±klama
}

export interface ParsedStatementItem {
  rowNumber: number;
  transactionName: string;
  amount: number;
  currency: string;
  transactionDate: string;  // ISO date string
  
  // Ä°ÅŸlem tipi
  transactionType?: 'expense' | 'payment';  // expense = harcama, payment = borÃ§ Ã¶demesi
  
  // Kart bilgileri
  cardLastFour?: string;
  fullCardNumber?: string;     // Tam kart no (maskelenmiÅŸ): "5258 64** **** 7608"
  cardHolderName?: string;     // Kart sahibi (ek kart ise): "FARUK ASARKAYA / Ek Kart"
  
  description?: string;
  
  // Taksit bilgileri
  isInstallment?: boolean;
  installmentCurrent?: number;  // KaÃ§Ä±ncÄ± taksit (Ã¶rn: 3)
  installmentTotal?: number;    // Toplam taksit (Ã¶rn: 6)
  installmentTotalAmount?: number; // Taksit toplamÄ± (Ã¶rn: 32631.33)
  
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
 * Excel cell deÄŸerini string'e Ã§evirir (Rich Text desteÄŸi ile)
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
 * Tarih string'ini ISO formatÄ±na Ã§evirir
 * Ã–rnekler: "31.12.2025", "2025-12-31", "31/12/2025"
 */
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Excel serial date (say olarak gelirse)
  if (!isNaN(Number(dateStr))) {
    const excelEpoch = new Date(1900, 0, 1);
    const days = parseInt(dateStr) - 2; // Excel'in bug'Ä± iÃ§in -2
    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  // DD.MM.YYYY formatÄ±
  const ddmmyyyyPattern = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
  const match1 = dateStr.match(ddmmyyyyPattern);
  if (match1) {
    const [, day, month, year] = match1;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // DD/MM/YYYY formatÄ±
  const ddmmyyyySlash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match2 = dateStr.match(ddmmyyyySlash);
  if (match2) {
    const [, day, month, year] = match2;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // YYYY-MM-DD formatÄ± (zaten ISO)
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (isoPattern.test(dateStr)) {
    return dateStr;
  }
  
  return null;
}

/**
 * Tutar string'ini decimal'e Ã§evirir
 * Ã–rnekler: "-7,815.83", "20000", "-11.366,70"
 */
function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  
  // String'i temizle
  let cleaned = String(amountStr).trim();
  
  // TÃ¼rk formatÄ±: 1.234,56 â†’ 1234.56
  if (cleaned.includes('.') && cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  // Sadece virgÃ¼l var: 1234,56 â†’ 1234.56
  else if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
  }
  // Sadece nokta var: 1,234.56 â†’ 1234.56
  else if (cleaned.includes('.') && !cleaned.includes(',')) {
    // EÄŸer noktadan Ã¶nce 3 basamak varsa binlik ayracÄ±dÄ±r
    const parts = cleaned.split('.');
    if (parts.length === 2 && parts[1].length === 2) {
      // 1234.56 gibi (ondalÄ±k ayracÄ±)
      // DeÄŸiÅŸtirme
    } else {
      // 1.234.56 veya 1.234 gibi (binlik ayracÄ±)
      cleaned = cleaned.replace(/\./g, '');
    }
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Kart numarasÄ±ndan son 4 haneyi Ã§Ä±karÄ±r
 * Ã–rnekler: "5584 60** **** 6268" â†’ "6268", "****1234" â†’ "1234"
 */
function extractCardLastFour(cardStr: string): string | undefined {
  if (!cardStr) return undefined;
  
  // Son 4 rakamÄ± bul
  const match = cardStr.match(/(\d{4})\D*$/);
  if (match) {
    return match[1];
  }
  
  return undefined;
}

/**
 * Taksit bilgisini Ã§Ä±karÄ±r
 * 
 * Desteklenen formatlar:
 * 1. YKB: "OZEN MOTORLU ARACLAR ISTANBUL TR 5350 TL'lik iÅŸlemin 1/5 taksidi"
 * 2. Garanti: "Ã‡ALIKLAR Ä°NÅAAT YAPI Ä°STANBUL TR 90754,42 TL'lik iÅŸlemin 3/3 taksidi"
 * 3. "BETEK-YAPIDEK SPOT BOYA V(4/5) Ä°STANBUL"
 * 4. Denizbank: Ä°ÅŸlem adÄ± "PeÅŸ. Taksit 2.Tk" + AÃ§Ä±klama "Taksit 2 / 6" (Toplam olmayabilir)
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
  // TÃ¼rkÃ§e karakter varyasyonlarÄ±: taksit, taksiti, taksidi, taksÄ±tÄ±
  const taksitPattern = /(\d+)\/(\d+)\s*taks[iÄ±][tÄ±]?[iÄ±]?d?[iÄ±]?/i;
  let match = transactionName.match(taksitPattern);
  if (match) {
    result.isInstallment = true;
    result.current = parseInt(match[1]);
    result.total = parseInt(match[2]);
    
    // Toplam tutarÄ± bulmaya Ã§alÄ±ÅŸ (YKB/Garanti format): "5350 TL'lik iÅŸlemin"
    const amountPattern = /([\d.,]+)\s*TL['"]?lik\s+iÅŸlemin/i;
    const amountMatch = transactionName.match(amountPattern);
    if (amountMatch) {
      const totalAmount = parseAmount(amountMatch[1]);
      result.totalAmount = totalAmount;
      console.log(`    ğŸ“ Found installment total in transaction name: ${totalAmount} TL`);
    }
    
    return result;
  }
  
  // Format 2: "(4/5)" parantez iÃ§inde
  const parenPattern = /\((\d+)\/(\d+)\)/;
  match = transactionName.match(parenPattern);
  if (match) {
    result.isInstallment = true;
    result.current = parseInt(match[1]);
    result.total = parseInt(match[2]);
    return result;
  }
  
  // Format 3: Denizbank - aÃ§Ä±klama sÃ¼tununda
  if (description) {
    // "Taksit 2 / 6 - Toplam: 32.631,33 TL" (toplam varsa)
    const denizbankPatternWithTotal = /Taksit\s+(\d+)\s*\/\s*(\d+)\s*-\s*Toplam:\s*([\d.,]+)/i;
    match = description.match(denizbankPatternWithTotal);
    if (match) {
      result.isInstallment = true;
      result.current = parseInt(match[1]);
      result.total = parseInt(match[2]);
      result.totalAmount = parseAmount(match[3]);
      console.log(`    ğŸ“ Denizbank installment with total: ${result.current}/${result.total}, total: ${result.totalAmount} TL`);
      return result;
    }
    
    // Ä°ÅŸlem adÄ±nda "PeÅŸ. Taksit" veya "Taksit" var mÄ±? (toplam yoksa)
    if (transactionName.match(/PeÅŸ\.\s*Taksit/i) || transactionName.match(/Taksit[\s\d.]+Anapara/i)) {
      // AÃ§Ä±klamadan sadece taksit bilgisini Ã§Ä±kar (toplam yok)
      const simplePattern = /Taksit\s+(\d+)\s*\/\s*(\d+)/i;
      match = description.match(simplePattern);
      if (match) {
        result.isInstallment = true;
        result.current = parseInt(match[1]);
        result.total = parseInt(match[2]);
        // totalAmount yok - statement-matcher.ts'de hesaplanacak
        console.log(`    ğŸ“ Denizbank installment WITHOUT total: ${result.current}/${result.total} (will calculate)`);
      }
    }
  }
  
  return result;
}

/**
 * Ä°lk N satÄ±rdan kart numarasÄ±nÄ± otomatik tespit eder
 */
function detectCardNumberFromRows(rows: any[][], maxRows: number = 20): string | undefined {
  for (let i = 0; i < Math.min(maxRows, rows.length); i++) {
    const rowStr = rows[i].join(' ');
    
    // "5584 60** **** 8546" formatÄ±
    const pattern1 = /\d{4}\s+\d{2}\*\*\s+\*{4}\s+(\d{4})/;
    const match1 = rowStr.match(pattern1);
    if (match1) {
      return match1[1];
    }
    
    // "9792 **** **** 7037" formatÄ±
    const pattern2 = /\d{4}\s+\*{4}\s+\*{4}\s+(\d{4})/;
    const match2 = rowStr.match(pattern2);
    if (match2) {
      return match2[1];
    }
    
    // "****6436" formatÄ±
    const pattern3 = /\*{4,}\s*(\d{4})/;
    const match3 = rowStr.match(pattern3);
    if (match3) {
      return match3[1];
    }
  }

  return undefined;
}

/**
 * YKB (YapÄ± Kredi) formatÄ±nÄ± tespit eder
 * 
 * YKB Ã¶zellikleri:
 * - Ä°lk satÄ±rda "Hesap Ã–zeti" baÅŸlÄ±ÄŸÄ±
 * - "Kart No", "MÃ¼ÅŸteri AdÄ± SoyadÄ±", "Hesap Ã–zeti TutarÄ±" metadata satÄ±rlarÄ±
 * - Header: "Ä°ÅŸlem Tarihi", "Ä°ÅŸlemler", "Tutar", "Kart No" gibi sÃ¼tunlar
 * - Kart No sÃ¼tununda birden fazla kart olabilir (Ana + Ek kartlar)
 * - Tutar sÃ¼tununda "+" iÅŸareti Ã¶deme (payment), yoksa harcama (expense)
 */
function detectYKBFormat(rows: any[][]): boolean {
  if (rows.length < 10) return false;
  
  // TÃ¼rkÃ§e normalizasyon helper - tÃ¼m TÃ¼rkÃ§e karakterleri ASCII'ye Ã§evir
  const normalizeTurkish = (text: string) => 
    text.toLowerCase()
      .replace(/Ä°/g, 'i')
      .replace(/iÌ‡/g, 'i')
      .replace(/ÅŸ/g, 's')
      .replace(/Å/g, 's')
      .replace(/ÄŸ/g, 'g')
      .replace(/Ä/g, 'g')
      .replace(/Ã¼/g, 'u')
      .replace(/Ãœ/g, 'u')
      .replace(/Ã¶/g, 'o')
      .replace(/Ã–/g, 'o')
      .replace(/Ã§/g, 'c')
      .replace(/Ã‡/g, 'c');
  
  // Ä°lk 10 satÄ±ra bak (YKB metadata yukarÄ±da olur)
  const firstRows = rows.slice(0, 10).map(row => normalizeTurkish(row.join(' ')));
  
  // "Hesap Ã–zeti" â†’ "hesap ozeti"
  const hasHesapOzeti = firstRows.some(row => row.includes('hesap ozeti'));
  
  // "MÃ¼ÅŸteri AdÄ± SoyadÄ±" â†’ "musteri adi" VEYA "Asgari Ã–deme" â†’ "asgari odeme"
  const hasYKBMetadata = firstRows.some(row => 
    row.includes('musteri adi') || 
    row.includes('asgari odeme') ||
    row.includes('odenmesi gereken')
  );
  
  // Header satÄ±rÄ±nda "Ä°ÅŸlem Tarihi" + "Ä°ÅŸlemler" + "Kart No" â†’ "islem tarihi" + "islemler" + "kart no"
  let hasYKBHeaders = false;
  for (let i = 5; i < Math.min(30, rows.length); i++) {
    const rowStr = normalizeTurkish(rows[i].join(' '));
    
    if (rowStr.includes('islem tarihi') && 
        rowStr.includes('islemler') && 
        rowStr.includes('kart no')) {
      hasYKBHeaders = true;
      console.log(`  âœ… YKB headers found at row ${i}`);
      break;
    }
  }
  
  const result = hasHesapOzeti && hasYKBMetadata && hasYKBHeaders;
  console.log(`  YKB Detection: hesapOzeti=${hasHesapOzeti}, metadata=${hasYKBMetadata}, headers=${hasYKBHeaders} â†’ ${result}`);
  
  return result;
}

/**
 * Garanti BankasÄ± formatÄ±nÄ± tespit eder
 * 
 * Garanti Ã¶zellikleri:
 * - SatÄ±r 4: "XXXX **** **** YYYY NumaralÄ± Kart TL Ekstre Bilgileri"
 * - SatÄ±r 6: Header (Tarih, Ä°ÅŸlem, Etiket, Bonus/Mil, Tutar(TL))
 * - Sheet adÄ±: "Ekstre Islemleri - TL"
 */
function detectGarantiFormat(rows: any[][], sheetName?: string): boolean {
  if (rows.length < 7) return false;
  
  // TÃ¼rkÃ§e normalizasyon helper
  const normalizeTurkish = (text: string) => 
    text.toLowerCase()
      .replace(/Ä°/g, 'i')
      .replace(/iÌ‡/g, 'i')
      .replace(/ÅŸ/g, 's')
      .replace(/Å/g, 's')
      .replace(/ÄŸ/g, 'g')
      .replace(/Ä/g, 'g')
      .replace(/Ã¼/g, 'u')
      .replace(/Ãœ/g, 'u')
      .replace(/Ã¶/g, 'o')
      .replace(/Ã–/g, 'o')
      .replace(/Ã§/g, 'c')
      .replace(/Ã‡/g, 'c');
  
  // Sheet adÄ± kontrolÃ¼ (opsiyonel ama gÃ¼Ã§lÃ¼ bir gÃ¶sterge)
  const hasGarantiSheetName = sheetName ? normalizeTurkish(sheetName).includes('ekstre islemleri') : false;
  
  // SatÄ±r 4: Kart numarasÄ± bilgisi
  // Ã–rnek: "9792 **** **** 7037 NumaralÄ± Kart TL Ekstre Bilgileri"
  const row4Str = normalizeTurkish(rows[3]?.join(' ') || '');
  const hasCardInfo = row4Str.includes('numarali kart') || row4Str.includes('ekstre bilgileri');
  
  // SatÄ±r 6: Header satÄ±rÄ±
  // Kolonlar: Tarih, Ä°ÅŸlem, Etiket, Bonus/Mil, Tutar(TL)
  const row6 = rows[5] || [];
  const row6Str = normalizeTurkish(row6.join(' '));
  
  const hasGarantiHeaders = 
    row6Str.includes('tarih') &&
    row6Str.includes('islem') &&
    row6Str.includes('etiket') &&
    row6Str.includes('tutar');
  
  const result = (hasGarantiSheetName || hasCardInfo) && hasGarantiHeaders;
  
  console.log(`  Garanti Detection: sheetName=${hasGarantiSheetName}, cardInfo=${hasCardInfo}, headers=${hasGarantiHeaders} â†’ ${result}`);
  
  if (result) {
    console.log(`  âœ… Garanti format detected!`);
  }
  
  return result;
}

/**
 * Garanti'den kart numarasÄ±nÄ± parse eder
 * 
 * Format: "9792 **** **** 7037 NumaralÄ± Kart TL Ekstre Bilgileri"
 * Ã‡Ä±ktÄ±: { lastFour: "7037", fullCardNumber: "9792 **** **** 7037" }
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
 * Format: "INTEMA VITRA-CALIKLAR MAR(2/3) Ä°STANBUL"
 * Ã‡Ä±ktÄ±: { isInstallment: true, current: 2, total: 3 }
 */
function extractGarantiInstallmentInfo(iÅŸlemAdÄ±: string): {
  isInstallment: boolean;
  installmentCurrent?: number;
  installmentTotal?: number;
  cleanName?: string;  // Taksit bilgisi temizlenmiÅŸ isim
} {
  if (!iÅŸlemAdÄ±) {
    return { isInstallment: false };
  }
  
  // Pattern: (X/Y) formatÄ±
  const match = iÅŸlemAdÄ±.match(/\((\d+)\/(\d+)\)/);
  
  if (!match) {
    return { isInstallment: false };
  }
  
  const current = parseInt(match[1], 10);
  const total = parseInt(match[2], 10);
  
  // Taksit bilgisini temizle
  const cleanName = iÅŸlemAdÄ±.replace(/\(\d+\/\d+\)/, '').trim();
  
  return {
    isInstallment: true,
    installmentCurrent: current,
    installmentTotal: total,
    cleanName
  };
}

/**
 * Garanti formatÄ±ndaki ekstreleri parse eder
 */

// PLACEHOLDER_FOR_NEW_FUNCTION

 * Format Ã¶rnekleri:
 * - "5258 64** **** 7608" â†’ { lastFour: "7608", full: "5258 64** **** 7608", holderName: undefined }
 * - "FARUK ASARKAYA / Ek Kart / 5258 64** **** 7755" â†’ { lastFour: "7755", full: "5258 64** **** 7755", holderName: "FARUK ASARKAYA / Ek Kart" }
 */
function parseYKBCardNumber(cardNoStr: string): {
  lastFour?: string;
  fullCardNumber?: string;
  holderName?: string;
} {
  if (!cardNoStr) return {};
  
  const cleaned = cardNoStr.trim();
  
  // Pattern 1: "FARUK ASARKAYA / Ek Kart / 5258 64** **** 7755"
  const ekKartPattern = /^(.+?)\s*\/\s*Ek\s+Kart\s*\/\s*(.+)$/i;
  const ekKartMatch = cleaned.match(ekKartPattern);
  if (ekKartMatch) {
    const holderName = ekKartMatch[1].trim() + ' / Ek Kart';
    const cardNumber = ekKartMatch[2].trim();
    const lastFourMatch = cardNumber.match(/(\d{4})$/);
    
    return {
      lastFour: lastFourMatch ? lastFourMatch[1] : undefined,
      fullCardNumber: cardNumber,
      holderName
    };
  }
  
  // Pattern 2: "5258 64** **** 7608" (ana kart)
  const cardPattern = /\d{4}\s+[\d\*]{2,}\s+\*{4}\s+(\d{4})/;
  const cardMatch = cleaned.match(cardPattern);
  if (cardMatch) {
    return {
      lastFour: cardMatch[1],
      fullCardNumber: cleaned,
      holderName: undefined
    };
  }
  
  return {};
}

/**
 * YKB formatÄ±ndaki Excel'i parse eder
 * 
 * YKB Ã¶zel Ã¶zellikleri:
 * - Birden fazla kart olabilir (kart bazÄ±nda gruplama gerekli)
 * - Tutar sÃ¼tununda "+" = payment (borÃ§ Ã¶demesi), yoksa expense (harcama)
 * - "Ã–nceki DÃ¶nem Borcu" satÄ±rÄ±nÄ± atla (iÅŸlem deÄŸil)
 */
function parseYKBStatement(rows: any[][]): ParsedStatement {
  // TÃ¼rkÃ§e normalizasyon helper
  const normalizeTurkish = (text: string) => 
    text.toLowerCase()
      .replace(/Ä°/g, 'i')
      .replace(/iÌ‡/g, 'i')
      .replace(/ÅŸ/g, 's')
      .replace(/Å/g, 's')
      .replace(/ÄŸ/g, 'g')
      .replace(/Ä/g, 'g')
      .replace(/Ã¼/g, 'u')
      .replace(/Ãœ/g, 'u')
      .replace(/Ã¶/g, 'o')
      .replace(/Ã–/g, 'o')
      .replace(/Ã§/g, 'c')
      .replace(/Ã‡/g, 'c');
  
  // Header satÄ±rÄ±nÄ± bul
  let headerRowIndex = -1;
  for (let i = 5; i < Math.min(30, rows.length); i++) {
    const row = rows[i];
    const rowStr = normalizeTurkish(row.join(' '));
    
    if (rowStr.includes('islem tarihi') && 
        rowStr.includes('islemler') && 
        rowStr.includes('kart no')) {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    throw new Error('YKB header satÄ±rÄ± bulunamadÄ±');
  }
  
  const headerRow = rows[headerRowIndex];
  
  // SÃ¼tun mapping
  const columns: ColumnMapping = {};
  for (let i = 0; i < headerRow.length; i++) {
    const cellValue = normalizeTurkish(String(headerRow[i]).trim());
    
    if (cellValue.includes('islem tarihi') || cellValue === 'tarih') {
      columns.date = i;
    } else if (cellValue === 'islemler' || cellValue === 'islem') {
      columns.transactionName = i;
    } else if (cellValue === 'tutar') {
      columns.amount = i;
    } else if (cellValue.includes('kart no') || cellValue === 'kart') {
      columns.cardNumber = i;
    } else if (cellValue.includes('sektor') || cellValue.includes('kategori')) {
      columns.description = i;
    }
  }
  
  if (columns.transactionName === undefined || columns.amount === undefined) {
    throw new Error('YKB gerekli sÃ¼tunlar bulunamadÄ±');
  }
  
  // Data satÄ±rlarÄ±nÄ± parse et
  const items: ParsedStatementItem[] = [];
  let totalAmount = 0;
  let detectedCardNumber: string | undefined;
  
  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    
    // BoÅŸ satÄ±rlarÄ± atla
    const hasData = row.some((cell: any) => 
      cell !== null && cell !== undefined && String(cell).trim() !== ''
    );
    if (!hasData) continue;
    
    // Ä°ÅŸlem adÄ± ve tutar alÄ±nabilmeli
    const transactionName = String(row[columns.transactionName!] || '').trim();
    const tutarStr = String(row[columns.amount!] || '').trim();
    
    if (!transactionName || !tutarStr) continue;
    
    // "Ã–nceki DÃ¶nem Borcu" satÄ±rÄ±nÄ± atla
    if (transactionName.toLowerCase().includes('Ã¶nceki dÃ¶nem') || 
        transactionName.toLowerCase().includes('Ã¶nc. dÃ¶nem')) {
      continue;
    }
    
    // Tarih kontrolÃ¼ - "-" olan satÄ±rlarÄ± atla (metadata satÄ±rÄ± olabilir)
    const dateStr = columns.date !== undefined ? String(row[columns.date] || '').trim() : '';
    if (dateStr === '-' || dateStr === '') {
      // Tarih yok ama iÅŸlem gibi gÃ¶rÃ¼nÃ¼yorsa yine de al (bazÄ± YKB formatlarÄ±nda tarih yoktur)
      // continue; // Bu satÄ±rÄ± comment'ledim - bazÄ± geÃ§erli iÅŸlemlerin tarihi olmayabilir
    }
    
    // Tutar parse - "+" iÅŸareti kontrolÃ¼
    const isPayment = tutarStr.startsWith('+');
    const cleanedAmount = tutarStr.replace(/^\+/, '').trim();
    const amount = parseAmount(cleanedAmount);
    
    // SÄ±fÄ±r tutarlÄ± iÅŸlemleri atla
    if (amount === 0) continue;
    
    // Transaction type belirle
    const transactionType: 'expense' | 'payment' = isPayment ? 'payment' : 'expense';
    
    // Kart numarasÄ± parse
    const cardNoStr = columns.cardNumber !== undefined ? String(row[columns.cardNumber] || '').trim() : '';
    const cardInfo = parseYKBCardNumber(cardNoStr);
    
    // Ä°lk kart numarasÄ±nÄ± otomatik tespit iÃ§in sakla
    if (!detectedCardNumber && cardInfo.lastFour) {
      detectedCardNumber = cardInfo.lastFour;
    }
    
    // AÃ§Ä±klama (SektÃ¶r sÃ¼tunu varsa)
    const description = columns.description !== undefined ? 
      String(row[columns.description] || '').trim() : undefined;
    
    // Tarih parse
    const transactionDate = dateStr ? parseDate(dateStr) : null;
    
    // Taksit bilgisi Ã§Ä±kar
    const installmentInfo = extractInstallmentInfo(transactionName, description);
    
    // Item oluÅŸtur
    const item: ParsedStatementItem = {
      rowNumber: rowIndex + 1,
      transactionName,
      amount: isPayment ? amount : -amount, // Harcamalar negatif, Ã¶demeler pozitif
      currency: 'TL',
      transactionDate: transactionDate || '',
      transactionType,
      cardLastFour: cardInfo.lastFour,
      fullCardNumber: cardInfo.fullCardNumber,
      cardHolderName: cardInfo.holderName,
      description,
      isInstallment: installmentInfo.isInstallment,
      installmentCurrent: installmentInfo.current,
      installmentTotal: installmentInfo.total,
      installmentTotalAmount: installmentInfo.totalAmount,
      rawData: {
        date: dateStr,
        transactionName,
        amount: tutarStr,
        cardNo: cardNoStr,
        description,
        rowIndex
      }
    };
    
    items.push(item);
    totalAmount += Math.abs(amount);
  }
  
  return {
    items,
    totalTransactions: items.length,
    totalAmount,
    detectedCardNumber,
    detectedMonth: undefined, // YKB'de metadata'dan alÄ±nabilir ama ÅŸimdilik yok
    headerRow: headerRowIndex,
    columns
  };
}

// =====================================================
// COLUMN DETECTION
// =====================================================

/**
 * Header satÄ±rÄ±ndaki sÃ¼tunlarÄ± analiz edip mapping oluÅŸturur
 */
function detectColumns(headerRow: ExcelJS.Row): ColumnMapping {
  const mapping: ColumnMapping = {};
  const values = headerRow.values as any[];
  
  for (let i = 1; i < values.length; i++) {
    const cellValue = cellToString(values[i]).toLowerCase().trim()
      .replace(/iÌ‡/g, 'i').replace(/Ä°/g, 'i'); // TÃ¼rkÃ§e Unicode normalization
    
    // Ä°ÅŸlem AdÄ± / Ä°ÅŸlem / Ä°ÅŸlemler
    if (cellValue === 'iÅŸlem' || cellValue === 'iÅŸlemler' || cellValue.includes('iÅŸlem adÄ±')) {
      mapping.transactionName = i;
    }
    // Ä°ÅŸlem TutarÄ± / Tutar
    else if (cellValue === 'tutar' || cellValue.includes('iÅŸlem tutarÄ±')) {
      mapping.amount = i;
    }
    // Para Birimi
    else if (cellValue.includes('para birimi') || cellValue.includes('birim')) {
      mapping.currency = i;
    }
    // Tarih / Ä°ÅŸlem Tarihi
    else if (cellValue.includes('tarih')) {
      mapping.date = i;
    }
    // Kart No
    else if (cellValue.includes('kart no') || cellValue === 'kart') {
      mapping.cardNumber = i;
    }
    // AÃ§Ä±klama
    else if (cellValue.includes('aÃ§Ä±klama') || cellValue.includes('description')) {
      mapping.description = i;
    }
  }
  
  return mapping;
}

/**
 * Header satÄ±rÄ±nÄ± bulur (Ä°ÅŸlem veya Tutar iÃ§eren ilk satÄ±r)
 */
function findHeaderRow(worksheet: ExcelJS.Worksheet): { row: ExcelJS.Row; rowNumber: number } | null {
  for (let rowNum = 1; rowNum <= Math.min(20, worksheet.rowCount); rowNum++) {
    const row = worksheet.getRow(rowNum);
    const values = row.values as any[];
    
    // Her deÄŸeri string'e Ã§evir
    const stringValues: string[] = [];
    for (let i = 1; i < values.length; i++) {
      stringValues.push(cellToString(values[i]).toLowerCase());
    }
    
    // "Ä°ÅŸlem" veya "Tutar" iÃ§eriyor mu?
    const hasIslem = stringValues.some(v => v.includes('iÅŸlem'));
    const hasTutar = stringValues.some(v => v.includes('tutar'));
    
    if (hasIslem || hasTutar) {
      return { row, rowNumber: rowNum };
    }
  }
  
  return null;
}

// =====================================================
// MAIN PARSER FUNCTION
// =====================================================

/**
 * Dosya uzantÄ±sÄ±nÄ± tespit eder
 */
function getFileExtension(file: File | Buffer, fileName?: string): string {
  if (file instanceof File) {
    return file.name.toLowerCase().split('.').pop() || '';
  }
  return fileName?.toLowerCase().split('.').pop() || 'xlsx';
}

/**
 * .xls formatÄ±ndaki dosyalarÄ± parse eder (xlsx kÃ¼tÃ¼phanesi ile)
 */
async function parseXlsFile(file: File | Buffer): Promise<ParsedStatement> {
  // Buffer'a Ã§evir
  let buffer: Buffer;
  if (file instanceof File) {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } else {
    buffer = file;
  }

  // xlsx kÃ¼tÃ¼phanesi ile oku
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  // Ä°lk sheet'i al
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel dosyasÄ± boÅŸ veya geÃ§ersiz');
  }
  
  const worksheet = workbook.Sheets[sheetName];
  
  // Sheet'i array'e Ã§evir (header dahil)
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
  
  if (!data || data.length === 0) {
    throw new Error('Excel dosyasÄ± boÅŸ veya geÃ§ersiz');
  }
  
  // YKB formatÄ±nÄ± tespit et
  const isYKB = detectYKBFormat(data);
  
  if (isYKB) {
    console.log('ğŸ“‹ YKB format detected, using specialized parser');
    return parseYKBStatement(data);
  }
  
  // Garanti formatÄ±nÄ± tespit et
  const isGaranti = detectGarantiFormat(data, sheetName);
  
  if (isGaranti) {
    console.log('ğŸ“‹ Garanti format detected, using specialized parser');
    return parseGarantiStatement(data);
  }
  
  console.log('ğŸ“‹ Using generic parser (not YKB or Garanti format)');
  
  // Header satÄ±rÄ±nÄ± bul
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    
    // Birden fazla dolu sÃ¼tun var mÄ± kontrol et
    const filledCells = row.filter((cell: any) => {
      const val = String(cell).toLowerCase().trim();
      return val.length > 0;
    });
    
    if (filledCells.length < 3) continue; // En az 3 dolu hÃ¼cre olmalÄ±
    
    // Her hÃ¼creyi kontrol et
    const cellValues = row.map((cell: any) => {
      const val = String(cell).toLowerCase().trim();
      // TÃ¼rkÃ§e Unicode normalization: Ä° â†’ i (hem iÌ‡ hem i)
      return val.replace(/iÌ‡/g, 'i').replace(/Ä°/g, 'i');
    });
    
    const hasIslemCol = cellValues.some(v => 
      v === 'iÅŸlem' || 
      v === 'iÅŸlemler' || 
      v === 'iÅŸlem adÄ±' ||
      v.includes('iÅŸlem') // iÅŸlem tarihi gibi
    );
    
    const hasTutarCol = cellValues.some(v => 
      v === 'tutar' || 
      v.includes('iÅŸlem tutarÄ±')
    );
    
    // En az iÅŸlem VE tutar sÃ¼tunu olmalÄ±
    if (hasIslemCol && hasTutarCol) {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    throw new Error('Header satÄ±rÄ± bulunamadÄ± (Ä°ÅŸlem ve Tutar iÃ§eren satÄ±r yok)');
  }
  
  const headerRow = data[headerRowIndex];
  
  // SÃ¼tÃ¼nlarÄ± tespit et
  const columns: ColumnMapping = {};
  for (let i = 0; i < headerRow.length; i++) {
    const cellValue = String(headerRow[i]).toLowerCase().trim()
      .replace(/iÌ‡/g, 'i').replace(/Ä°/g, 'i'); // TÃ¼rkÃ§e Unicode normalization
    
    if (cellValue === 'iÅŸlem' || cellValue === 'iÅŸlemler' || cellValue.includes('iÅŸlem adÄ±')) {
      columns.transactionName = i;
    } else if (cellValue === 'tutar' || cellValue.includes('iÅŸlem tutarÄ±')) {
      columns.amount = i;
    } else if (cellValue.includes('para birimi') || cellValue.includes('birim')) {
      columns.currency = i;
    } else if (cellValue.includes('tarih')) {
      columns.date = i;
    } else if (cellValue.includes('kart no') || cellValue === 'kart') {
      columns.cardNumber = i;
    } else if (cellValue.includes('aÃ§Ä±klama') || cellValue.includes('description')) {
      columns.description = i;
    }
  }
  
  // Zorunlu sÃ¼tÃ¼nlarÄ± kontrol et
  if (columns.transactionName === undefined || columns.amount === undefined) {
    throw new Error('Gerekli sÃ¼tunlar bulunamadÄ± (Ä°ÅŸlem AdÄ± ve Tutar zorunlu)');
  }
  
  // Data satÄ±rlarÄ±nÄ± parse et
  const items: ParsedStatementItem[] = [];
  let totalAmount = 0;
  let detectedCardNumber: string | undefined;
  
  // Ä°lk N satÄ±rdan kart numarasÄ±nÄ± otomatik tespit et
  detectedCardNumber = detectCardNumberFromRows(data, 20);
  
  for (let rowIndex = headerRowIndex + 1; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    
    // BoÅŸ satÄ±rÄ± atla
    const transactionName = String(row[columns.transactionName] || '').trim();
    if (!transactionName || transactionName.length < 2) {
      continue;
    }
    
    // Toplam satÄ±rlarÄ±nÄ± atla
    const lowerName = transactionName.toLowerCase();
    if (
      lowerName.includes('toplam') ||
      lowerName.includes('total') ||
      lowerName.includes('summary') ||
      lowerName.includes('bakiye')
    ) {
      continue;
    }
    
    // Tutar
    const amountStr = String(row[columns.amount] || '');
    const amount = parseAmount(amountStr);
    
    if (amount === 0) {
      continue;
    }
    
    // Para birimi
    const currency = columns.currency !== undefined
      ? String(row[columns.currency] || 'TRY').toUpperCase()
      : 'TRY';
    
    // Tarih
    let transactionDate = new Date().toISOString().split('T')[0];
    if (columns.date !== undefined) {
      const dateValue = row[columns.date];
      // Excel serial date kontrolÃ¼
      if (typeof dateValue === 'number') {
        const date = XLSX.SSF.parse_date_code(dateValue);
        if (date) {
          transactionDate = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        }
      } else {
        const parsed = parseDate(String(dateValue));
        if (parsed) {
          transactionDate = parsed;
        }
      }
    }
    
    // Kart numarasÄ±
    let cardLastFour: string | undefined;
    if (columns.cardNumber !== undefined) {
      const cardStr = String(row[columns.cardNumber] || '');
      cardLastFour = extractCardLastFour(cardStr);
      
      if (cardLastFour && !detectedCardNumber) {
        detectedCardNumber = cardLastFour;
      }
    }
    
    // AÃ§Ä±klama
    const description = columns.description !== undefined
      ? String(row[columns.description] || '').trim() || undefined
      : undefined;
    
    // Taksit bilgisi Ã§Ä±kar
    const installmentInfo = extractInstallmentInfo(transactionName, description);
    
    // Raw data
    const rawData: Record<string, any> = {};
    row.forEach((cell, index) => {
      rawData[`col_${index}`] = String(cell || '');
    });
    
    // Item ekle
    const item: ParsedStatementItem = {
      rowNumber: rowIndex + 1,
      transactionName,
      amount,
      currency,
      transactionDate,
      cardLastFour,
      description,
      rawData
    };
    
    // Taksit bilgilerini ekle
    if (installmentInfo.isInstallment) {
      item.isInstallment = true;
      item.installmentCurrent = installmentInfo.current;
      item.installmentTotal = installmentInfo.total;
      item.installmentTotalAmount = installmentInfo.totalAmount;
    }
    
    items.push(item);
    
    totalAmount += amount;
  }
  
  // Ekstre ayÄ±nÄ± tespit et
  let detectedMonth: string | undefined;
  if (items.length > 0) {
    const monthCounts = new Map<string, number>();
    items.forEach(item => {
      const month = item.transactionDate.substring(0, 7);
      monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
    });
    
    let maxCount = 0;
    monthCounts.forEach((count, month) => {
      if (count > maxCount) {
        maxCount = count;
        detectedMonth = `${month}-01`;
      }
    });
  }
  
  return {
    items,
    totalTransactions: items.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
    detectedCardNumber,
    detectedMonth,
    headerRow: headerRowIndex + 1,
    columns
  };
}

/**
 * Excel dosyasÄ±nÄ± parse eder ve normalize edilmiÅŸ veri dÃ¶ndÃ¼rÃ¼r
 * 
 * @param file - Excel dosyasÄ± (File object veya Buffer)
 * @param fileName - Opsiyonel dosya adÄ± (Buffer kullanÄ±ldÄ±ÄŸÄ±nda)
 * @returns Parse edilmiÅŸ ekstre verisi
 */
export async function parseStatementExcel(
  file: File | Buffer,
  fileName?: string
): Promise<ParsedStatement> {
  // Dosya uzantÄ±sÄ±nÄ± tespit et
  const ext = getFileExtension(file, fileName);
  
  // .xls dosyalarÄ± iÃ§in xlsx kÃ¼tÃ¼phanesi kullan
  if (ext === 'xls') {
    return parseXlsFile(file);
  }
  
  // .xlsx dosyalarÄ± iÃ§in ExcelJS kullan
  const workbook = new ExcelJS.Workbook();
  
  // File veya Buffer'dan oku
  if (file instanceof File) {
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer as any);
  } else {
    await workbook.xlsx.load(file as any);
  }
  
  // Ä°lk worksheet'i al
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel dosyasÄ± boÅŸ veya geÃ§ersiz');
  }
  
  // Header satÄ±rÄ±nÄ± bul
  const headerInfo = findHeaderRow(worksheet);
  if (!headerInfo) {
    throw new Error('Header satÄ±rÄ± bulunamadÄ± (Ä°ÅŸlem veya Tutar iÃ§eren satÄ±r yok)');
  }
  
  const { row: headerRow, rowNumber: headerRowNumber } = headerInfo;
  
  // SÃ¼tunlarÄ± tespit et
  const columns = detectColumns(headerRow);
  
  // Zorunlu sÃ¼tunlarÄ±n varlÄ±ÄŸÄ±nÄ± kontrol et
  if (!columns.transactionName || !columns.amount) {
    throw new Error('Gerekli sÃ¼tunlar bulunamadÄ± (Ä°ÅŸlem AdÄ± ve Tutar zorunlu)');
  }
  
  // Data satÄ±rlarÄ±nÄ± parse et
  const items: ParsedStatementItem[] = [];
  let totalAmount = 0;
  let detectedCardNumber: string | undefined;
  
  // Ä°lk satÄ±rlardan kart numarasÄ±nÄ± tespit et
  const allRows: any[][] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <20) {
      allRows.push(row.values as any[]);
    }
  });
  detectedCardNumber = detectCardNumberFromRows(allRows, 20);
  
  for (let rowNum = headerRowNumber + 1; rowNum <= worksheet.rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const values = row.values as any[];
    
    // BoÅŸ satÄ±rlarÄ± atla
    const transactionName = cellToString(values[columns.transactionName!]);
    if (!transactionName || transactionName.length < 2) {
      continue;
    }
    
    // Toplam/summary satÄ±rlarÄ±nÄ± atla
    const lowerName = transactionName.toLowerCase();
    if (
      lowerName.includes('toplam') ||
      lowerName.includes('total') ||
      lowerName.includes('summary') ||
      lowerName.includes('bakiye')
    ) {
      continue;
    }
    
    // TutarÄ± parse et
    const amountStr = cellToString(values[columns.amount!]);
    const amount = parseAmount(amountStr);
    
    // Tutar 0 ise atla
    if (amount === 0) {
      continue;
    }
    
    // Para birimi
    const currency = columns.currency
      ? cellToString(values[columns.currency]).toUpperCase() || 'TRY'
      : 'TRY';
    
    // Tarih
    let transactionDate = new Date().toISOString().split('T')[0]; // Default: bugÃ¼n
    if (columns.date) {
      const dateStr = cellToString(values[columns.date]);
      const parsed = parseDate(dateStr);
      if (parsed) {
        transactionDate = parsed;
      }
    }
    
    // Kart numarasÄ±
    let cardLastFour: string | undefined;
    if (columns.cardNumber) {
      const cardStr = cellToString(values[columns.cardNumber]);
      cardLastFour = extractCardLastFour(cardStr);
      
      // Ä°lk bulduÄŸumuz kart numarasÄ±nÄ± kaydet
      if (cardLastFour && !detectedCardNumber) {
        detectedCardNumber = cardLastFour;
      }
    }
    
    // AÃ§Ä±klama
    const description = columns.description
      ? cellToString(values[columns.description])
      : undefined;
    
    // Taksit bilgisi Ã§Ä±kar
    const installmentInfo = extractInstallmentInfo(transactionName, description);
    
    // Raw data (tÃ¼m sÃ¼tunlar)
    const rawData: Record<string, any> = {};
    for (let i = 1; i < values.length; i++) {
      rawData[`col_${i}`] = cellToString(values[i]);
    }
    
    // Item oluÅŸtur
    const item: ParsedStatementItem = {
      rowNumber: rowNum,
      transactionName,
      amount,
      currency,
      transactionDate,
      cardLastFour,
      description,
      rawData
    };
    
    // Taksit bilgilerini ekle
    if (installmentInfo.isInstallment) {
      item.isInstallment = true;
      item.installmentCurrent = installmentInfo.current;
      item.installmentTotal = installmentInfo.total;
      item.installmentTotalAmount = installmentInfo.totalAmount;
    }
    
    items.push(item);
    
    totalAmount += amount;
  }
  
  // Ekstre ayÄ±nÄ± tespit et (en yaygÄ±n tarih ayÄ±)
  let detectedMonth: string | undefined;
  if (items.length > 0) {
    const monthCounts = new Map<string, number>();
    items.forEach(item => {
      const month = item.transactionDate.substring(0, 7); // YYYY-MM
      monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
    });
    
    // En Ã§ok geÃ§en ayÄ± bul
    let maxCount = 0;
    monthCounts.forEach((count, month) => {
      if (count > maxCount) {
        maxCount = count;
        detectedMonth = `${month}-01`; // YYYY-MM-01 formatÄ±
      }
    });
  }
  
  return {
    items,
    totalTransactions: items.length,
    totalAmount: Math.round(totalAmount * 100) / 100, // 2 ondalÄ±k
    detectedCardNumber,
    detectedMonth,
    headerRow: headerRowNumber,
    columns
  };
}

// =====================================================
// VALIDATION FUNCTIONS
// =====================================================

/**
 * Parse edilmiÅŸ veriyi validate eder
 */
export function validateParsedStatement(parsed: ParsedStatement): string[] {
  const errors: string[] = [];
  
  if (parsed.items.length === 0) {
    errors.push('HiÃ§ iÅŸlem bulunamadÄ±');
  }
  
  if (parsed.totalTransactions === 0) {
    errors.push('Toplam iÅŸlem sayÄ±sÄ± 0');
  }
  
  // Her item'Ä± kontrol et
  parsed.items.forEach((item) => {
    if (!item.transactionName) {
      errors.push(`SatÄ±r ${item.rowNumber}: Ä°ÅŸlem adÄ± boÅŸ`);
    }
    
    if (item.amount === 0) {
      errors.push(`SatÄ±r ${item.rowNumber}: Tutar 0`);
    }
    
    if (!item.transactionDate || item.transactionDate === '1970-01-01') {
      errors.push(`SatÄ±r ${item.rowNumber}: GeÃ§ersiz tarih`);
    }
  });
  
  return errors;
}

/**
 * Dosya uzantÄ±sÄ±ndan format kontrolÃ¼
 */
export function isSupportedFileFormat(fileName: string): boolean {
  const ext = fileName.toLowerCase().split('.').pop();
  return ext === 'xlsx' || ext === 'xls';
}

