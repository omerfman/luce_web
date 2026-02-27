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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
function parseGarantiStatement(data: any[][]): ParsedStatement {
  console.log('📋 Parsing Garanti format statement (multi-card support)...');
  
  // Türkçe normalization helper
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
  
  // Tüm kart bölümlerini tespit et
  const cardSections: Array<{ rowIndex: number; cardNumber: string; fullCardNumber: string }> = [];
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowStr = row.join(' ');
    
    if (rowStr.includes('Numaralı Kart') || rowStr.includes('Numarali Kart')) {
      const match = rowStr.match(/(\d{4}\s+\*{4}\s+\*{4}\s+\d{4})/);
      if (match) {
        const fullCardNumber = match[1];
        const lastFour = fullCardNumber.split(/\s+/).pop() || '';
        cardSections.push({ rowIndex: i, cardNumber: lastFour, fullCardNumber });
        console.log(`  💳 Found card: ${fullCardNumber} at row ${i + 1}`);
      }
    }
  }
  
  if (cardSections.length === 0) {
    throw new Error('No card sections found');
  }
  
  console.log(`  📊 Total cards: ${cardSections.length}`);
  
  const allItems: ParsedStatementItem[] = [];
  let globalRowNumber = 1;
  
  // Her kart için parse yap
  for (let cardIdx = 0; cardIdx < cardSections.length; cardIdx++) {
    const cardSection = cardSections[cardIdx];
    const nextCardRow = cardIdx < cardSections.length - 1 ? cardSections[cardIdx + 1].rowIndex : data.length;
    
    console.log(`\n  🎯 Processing card ${cardIdx + 1}/${cardSections.length}: ${cardSection.fullCardNumber}`);
    
    // Header satırını bul
    let headerRowIndex = -1;
    for (let i = cardSection.rowIndex + 1; i < Math.min(cardSection.rowIndex + 5, nextCardRow); i++) {
      const rowStr = normalizeTurkish(data[i].join(' '));
      if (rowStr.includes('tarih') && rowStr.includes('islem') && rowStr.includes('tutar')) {
        headerRowIndex = i;
        break;
      }
    }
    
    if (headerRowIndex === -1) {
      console.log(`     ⚠️  Header not found, skipping`);
      continue;
    }
    
    const dataStartRow = headerRowIndex + 1;
    let cardItemCount = 0;
    
    for (let i = dataStartRow; i < nextCardRow; i++) {
      const row = data[i];
      
      const hasData = row.some((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== '');
      if (!hasData) break;
      
      const tarih = row[0];
      const işlem = row[1];
      const etiket = row[2];
      const tutar = row[4];
      
      if (!tarih || !işlem || tutar === undefined || tutar === null) continue;
      
      let parsedAmount: number;
      if (typeof tutar === 'number') {
        parsedAmount = tutar;
      } else {
        const tutarStr = String(tutar).replace(/\./g, '').replace(',', '.');
        parsedAmount = parseFloat(tutarStr);
      }
      
      if (isNaN(parsedAmount) || parsedAmount === 0) continue;
      
      const transactionType: 'expense' | 'payment' = parsedAmount > 0 ? 'payment' : 'expense';
      
      let transactionDate: string;
      if (typeof tarih === 'number') {
        const date = XLSX.SSF.parse_date_code(tarih);
        transactionDate = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      } else {
        const dateStr = String(tarih).trim();
        const parts = dateStr.split(/[\/\.]/);
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          let year = parts[2];
          if (year.length === 2) year = '20' + year;
          transactionDate = `${year}-${month}-${day}`;
        } else {
          transactionDate = new Date().toISOString().split('T')[0];
        }
      }
      
      const installmentInfo = extractGarantiInstallmentInfo(String(işlem));
      const finalName = installmentInfo.cleanName || String(işlem);
      
      const item: ParsedStatementItem = {
        rowNumber: globalRowNumber++,
        transactionName: finalName.trim(),
        amount: Math.abs(parsedAmount),
        currency: 'TL',
        transactionDate,
        transactionType,
        cardLastFour: cardSection.cardNumber,
        fullCardNumber: cardSection.fullCardNumber,
        description: etiket ? String(etiket) : undefined,
        isInstallment: installmentInfo.isInstallment,
        installmentCurrent: installmentInfo.installmentCurrent,
        installmentTotal: installmentInfo.installmentTotal,
        rawData: { tarih, islem: işlem, etiket, tutar }
      };
      
      allItems.push(item);
      cardItemCount++;
      
      if (cardItemCount <= 3) {
        console.log(`     ✅ ${item.transactionType === 'payment' ? '💰' : '💸'} ${item.transactionName.substring(0, 40)}`);
      }
    }
    
    console.log(`     📊 Items: ${cardItemCount}`);
  }
  
  console.log(`\n  📊 TOTAL: ${allItems.length} items from ${cardSections.length} card(s)`);
  
  const payments = allItems.filter(i => i.transactionType === 'payment');
  const expenses = allItems.filter(i => i.transactionType === 'expense');
  const installments = allItems.filter(i => i.isInstallment);
  const uniqueCards = [...new Set(allItems.map(i => i.fullCardNumber))];
  
  console.log(`  💰 Payments: ${payments.length}, 💸 Expenses: ${expenses.length}, 📅 Installments: ${installments.length}`);
  console.log(`  💳 Cards: ${uniqueCards.join(', ')}`);
  
  const totalAmount = allItems.reduce((sum, item) => sum + item.amount, 0);
  
  // Ay bilgisini ilk işlemin tarihinden al
  let detectedMonth: string | undefined;
  if (allItems.length > 0 && allItems[0].transactionDate) {
    const firstDate = allItems[0].transactionDate;
    detectedMonth = firstDate.substring(0, 8) + '01'; // YYYY-MM-01
  }
  
  return {
    items: allItems,
    totalTransactions: allItems.length,
    totalAmount,
    detectedCardNumber: cardSections[0].cardNumber,
    detectedMonth,
    headerRow: 6,
    columns: { date: 0, transactionName: 1, description: 2, amount: 4 }
  };
}

/**
 * Kart numarasından bilgileri parse eder
 * 
 * Format örnekleri:
 * - "5258 64** **** 7608" → { lastFour: "7608", full: "5258 64** **** 7608", holderName: undefined }
 * - "FARUK ASARKAYA / Ek Kart / 5258 64** **** 7755" → { lastFour: "7755", full: "5258 64** **** 7755", holderName: "FARUK ASARKAYA / Ek Kart" }
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
 * YKB formatındaki Excel'i parse eder
 * 
 * YKB özel özellikleri:
 * - Birden fazla kart olabilir (kart bazında gruplama gerekli)
 * - Tutar sütununda "+" = payment (borç ödemesi), yoksa expense (harcama)
 * - "Önceki Dönem Borcu" satırını atla (işlem değil)
 */
function parseYKBStatement(rows: any[][]): ParsedStatement {
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
  
  // Header satırını bul
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
    throw new Error('YKB header satırı bulunamadı');
  }
  
  const headerRow = rows[headerRowIndex];
  
  // Sütun mapping
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
    throw new Error('YKB gerekli sütunlar bulunamadı');
  }
  
  // Data satırlarını parse et
  const items: ParsedStatementItem[] = [];
  let totalAmount = 0;
  let detectedCardNumber: string | undefined;
  
  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    
    // Boş satırları atla
    const hasData = row.some((cell: any) => 
      cell !== null && cell !== undefined && String(cell).trim() !== ''
    );
    if (!hasData) continue;
    
    // İşlem adı ve tutar alınabilmeli
    const transactionName = String(row[columns.transactionName!] || '').trim();
    const tutarStr = String(row[columns.amount!] || '').trim();
    
    if (!transactionName || !tutarStr) continue;
    
    // "Önceki Dönem Borcu" satırını atla
    if (transactionName.toLowerCase().includes('önceki dönem') || 
        transactionName.toLowerCase().includes('önc. dönem')) {
      continue;
    }
    
    // Tarih kontrolü - "-" olan satırları atla (metadata satırı olabilir)
    const dateStr = columns.date !== undefined ? String(row[columns.date] || '').trim() : '';
    if (dateStr === '-' || dateStr === '') {
      // Tarih yok ama işlem gibi görünüyorsa yine de al (bazı YKB formatlarında tarih yoktur)
      // continue; // Bu satırı comment'ledim - bazı geçerli işlemlerin tarihi olmayabilir
    }
    
    // Tutar parse - "+" işareti kontrolü
    const isPayment = tutarStr.startsWith('+');
    const cleanedAmount = tutarStr.replace(/^\+/, '').trim();
    const amount = parseAmount(cleanedAmount);
    
    // Sıfır tutarlı işlemleri atla
    if (amount === 0) continue;
    
    // Transaction type belirle
    const transactionType: 'expense' | 'payment' = isPayment ? 'payment' : 'expense';
    
    // Kart numarası parse
    const cardNoStr = columns.cardNumber !== undefined ? String(row[columns.cardNumber] || '').trim() : '';
    const cardInfo = parseYKBCardNumber(cardNoStr);
    
    // İlk kart numarasını otomatik tespit için sakla
    if (!detectedCardNumber && cardInfo.lastFour) {
      detectedCardNumber = cardInfo.lastFour;
    }
    
    // Açıklama (Sektör sütunu varsa)
    const description = columns.description !== undefined ? 
      String(row[columns.description] || '').trim() : undefined;
    
    // Tarih parse
    const transactionDate = dateStr ? parseDate(dateStr) : null;
    
    // Taksit bilgisi çıkar
    const installmentInfo = extractInstallmentInfo(transactionName, description);
    
    // Item oluştur
    const item: ParsedStatementItem = {
      rowNumber: rowIndex + 1,
      transactionName,
      amount: isPayment ? amount : -amount, // Harcamalar negatif, ödemeler pozitif
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
    detectedMonth: undefined, // YKB'de metadata'dan alınabilir ama şimdilik yok
    headerRow: headerRowIndex,
    columns
  };
}

// =====================================================
// COLUMN DETECTION
// =====================================================

/**
 * Header satırındaki sütunları analiz edip mapping oluşturur
 */
function detectColumns(headerRow: ExcelJS.Row): ColumnMapping {
  const mapping: ColumnMapping = {};
  const values = headerRow.values as any[];
  
  for (let i = 1; i < values.length; i++) {
    const cellValue = cellToString(values[i]).toLowerCase().trim()
      .replace(/i̇/g, 'i').replace(/İ/g, 'i'); // Türkçe Unicode normalization
    
    // İşlem Adı / İşlem / İşlemler
    if (cellValue === 'işlem' || cellValue === 'işlemler' || cellValue.includes('işlem adı')) {
      mapping.transactionName = i;
    }
    // İşlem Tutarı / Tutar
    else if (cellValue === 'tutar' || cellValue.includes('işlem tutarı')) {
      mapping.amount = i;
    }
    // Para Birimi
    else if (cellValue.includes('para birimi') || cellValue.includes('birim')) {
      mapping.currency = i;
    }
    // Tarih / İşlem Tarihi
    else if (cellValue.includes('tarih')) {
      mapping.date = i;
    }
    // Kart No
    else if (cellValue.includes('kart no') || cellValue === 'kart') {
      mapping.cardNumber = i;
    }
    // Açıklama
    else if (cellValue.includes('açıklama') || cellValue.includes('description')) {
      mapping.description = i;
    }
  }
  
  return mapping;
}

/**
 * Header satırını bulur (İşlem veya Tutar içeren ilk satır)
 */
function findHeaderRow(worksheet: ExcelJS.Worksheet): { row: ExcelJS.Row; rowNumber: number } | null {
  for (let rowNum = 1; rowNum <= Math.min(20, worksheet.rowCount); rowNum++) {
    const row = worksheet.getRow(rowNum);
    const values = row.values as any[];
    
    // Her değeri string'e çevir
    const stringValues: string[] = [];
    for (let i = 1; i < values.length; i++) {
      stringValues.push(cellToString(values[i]).toLowerCase());
    }
    
    // "İşlem" veya "Tutar" içeriyor mu?
    const hasIslem = stringValues.some(v => v.includes('işlem'));
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
 * Dosya uzantısını tespit eder
 */
function getFileExtension(file: File | Buffer, fileName?: string): string {
  if (file instanceof File) {
    return file.name.toLowerCase().split('.').pop() || '';
  }
  return fileName?.toLowerCase().split('.').pop() || 'xlsx';
}

/**
 * .xls formatındaki dosyaları parse eder (xlsx kütüphanesi ile)
 */
async function parseXlsFile(file: File | Buffer): Promise<ParsedStatement> {
  // Buffer'a çevir
  let buffer: Buffer;
  if (file instanceof File) {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } else {
    buffer = file;
  }

  // xlsx kütüphanesi ile oku
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  // İlk sheet'i al
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel dosyası boş veya geçersiz');
  }
  
  const worksheet = workbook.Sheets[sheetName];
  
  // Sheet'i array'e çevir (header dahil)
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
  
  if (!data || data.length === 0) {
    throw new Error('Excel dosyası boş veya geçersiz');
  }
  
  // YKB formatını tespit et
  const isYKB = detectYKBFormat(data);
  
  if (isYKB) {
    console.log('📋 YKB format detected, using specialized parser');
    return parseYKBStatement(data);
  }
  
  // Garanti formatını tespit et
  const isGaranti = detectGarantiFormat(data, sheetName);
  
  if (isGaranti) {
    console.log('📋 Garanti format detected, using specialized parser');
    return parseGarantiStatement(data);
  }
  
  console.log('📋 Using generic parser (not YKB or Garanti format)');
  
  // Header satırını bul
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    
    // Birden fazla dolu sütun var mı kontrol et
    const filledCells = row.filter((cell: any) => {
      const val = String(cell).toLowerCase().trim();
      return val.length > 0;
    });
    
    if (filledCells.length < 3) continue; // En az 3 dolu hücre olmalı
    
    // Her hücreyi kontrol et
    const cellValues = row.map((cell: any) => {
      const val = String(cell).toLowerCase().trim();
      // Türkçe Unicode normalization: İ → i (hem i̇ hem i)
      return val.replace(/i̇/g, 'i').replace(/İ/g, 'i');
    });
    
    const hasIslemCol = cellValues.some(v => 
      v === 'işlem' || 
      v === 'işlemler' || 
      v === 'işlem adı' ||
      v.includes('işlem') // işlem tarihi gibi
    );
    
    const hasTutarCol = cellValues.some(v => 
      v === 'tutar' || 
      v.includes('işlem tutarı')
    );
    
    // En az işlem VE tutar sütunu olmalı
    if (hasIslemCol && hasTutarCol) {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    throw new Error('Header satırı bulunamadı (İşlem ve Tutar içeren satır yok)');
  }
  
  const headerRow = data[headerRowIndex];
  
  // Sütünları tespit et
  const columns: ColumnMapping = {};
  for (let i = 0; i < headerRow.length; i++) {
    const cellValue = String(headerRow[i]).toLowerCase().trim()
      .replace(/i̇/g, 'i').replace(/İ/g, 'i'); // Türkçe Unicode normalization
    
    if (cellValue === 'işlem' || cellValue === 'işlemler' || cellValue.includes('işlem adı')) {
      columns.transactionName = i;
    } else if (cellValue === 'tutar' || cellValue.includes('işlem tutarı')) {
      columns.amount = i;
    } else if (cellValue.includes('para birimi') || cellValue.includes('birim')) {
      columns.currency = i;
    } else if (cellValue.includes('tarih')) {
      columns.date = i;
    } else if (cellValue.includes('kart no') || cellValue === 'kart') {
      columns.cardNumber = i;
    } else if (cellValue.includes('açıklama') || cellValue.includes('description')) {
      columns.description = i;
    }
  }
  
  // Zorunlu sütünları kontrol et
  if (columns.transactionName === undefined || columns.amount === undefined) {
    throw new Error('Gerekli sütunlar bulunamadı (İşlem Adı ve Tutar zorunlu)');
  }
  
  // Data satırlarını parse et
  const items: ParsedStatementItem[] = [];
  let totalAmount = 0;
  let detectedCardNumber: string | undefined;
  
  // İlk N satırdan kart numarasını otomatik tespit et
  detectedCardNumber = detectCardNumberFromRows(data, 20);
  
  for (let rowIndex = headerRowIndex + 1; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    
    // Boş satırı atla
    const transactionName = String(row[columns.transactionName] || '').trim();
    if (!transactionName || transactionName.length < 2) {
      continue;
    }
    
    // Toplam satırlarını atla
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
      // Excel serial date kontrolü
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
    
    // Kart numarası
    let cardLastFour: string | undefined;
    if (columns.cardNumber !== undefined) {
      const cardStr = String(row[columns.cardNumber] || '');
      cardLastFour = extractCardLastFour(cardStr);
      
      if (cardLastFour && !detectedCardNumber) {
        detectedCardNumber = cardLastFour;
      }
    }
    
    // Açıklama
    const description = columns.description !== undefined
      ? String(row[columns.description] || '').trim() || undefined
      : undefined;
    
    // Taksit bilgisi çıkar
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
  
  // Ekstre ayını tespit et
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
 * Excel dosyasını parse eder ve normalize edilmiş veri döndürür
 * 
 * @param file - Excel dosyası (File object veya Buffer)
 * @param fileName - Opsiyonel dosya adı (Buffer kullanıldığında)
 * @returns Parse edilmiş ekstre verisi
 */
export async function parseStatementExcel(
  file: File | Buffer,
  fileName?: string
): Promise<ParsedStatement> {
  // Dosya uzantısını tespit et
  const ext = getFileExtension(file, fileName);
  
  // .xls dosyaları için xlsx kütüphanesi kullan
  if (ext === 'xls') {
    return parseXlsFile(file);
  }
  
  // .xlsx dosyaları için ExcelJS kullan
  const workbook = new ExcelJS.Workbook();
  
  // File veya Buffer'dan oku
  if (file instanceof File) {
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer as any);
  } else {
    await workbook.xlsx.load(file as any);
  }
  
  // İlk worksheet'i al
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel dosyası boş veya geçersiz');
  }
  
  // Header satırını bul
  const headerInfo = findHeaderRow(worksheet);
  if (!headerInfo) {
    throw new Error('Header satırı bulunamadı (İşlem veya Tutar içeren satır yok)');
  }
  
  const { row: headerRow, rowNumber: headerRowNumber } = headerInfo;
  
  // Sütunları tespit et
  const columns = detectColumns(headerRow);
  
  // Zorunlu sütunların varlığını kontrol et
  if (!columns.transactionName || !columns.amount) {
    throw new Error('Gerekli sütunlar bulunamadı (İşlem Adı ve Tutar zorunlu)');
  }
  
  // Data satırlarını parse et
  const items: ParsedStatementItem[] = [];
  let totalAmount = 0;
  let detectedCardNumber: string | undefined;
  
  // İlk satırlardan kart numarasını tespit et
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
    
    // Boş satırları atla
    const transactionName = cellToString(values[columns.transactionName!]);
    if (!transactionName || transactionName.length < 2) {
      continue;
    }
    
    // Toplam/summary satırlarını atla
    const lowerName = transactionName.toLowerCase();
    if (
      lowerName.includes('toplam') ||
      lowerName.includes('total') ||
      lowerName.includes('summary') ||
      lowerName.includes('bakiye')
    ) {
      continue;
    }
    
    // Tutarı parse et
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
    let transactionDate = new Date().toISOString().split('T')[0]; // Default: bugün
    if (columns.date) {
      const dateStr = cellToString(values[columns.date]);
      const parsed = parseDate(dateStr);
      if (parsed) {
        transactionDate = parsed;
      }
    }
    
    // Kart numarası
    let cardLastFour: string | undefined;
    if (columns.cardNumber) {
      const cardStr = cellToString(values[columns.cardNumber]);
      cardLastFour = extractCardLastFour(cardStr);
      
      // İlk bulduğumuz kart numarasını kaydet
      if (cardLastFour && !detectedCardNumber) {
        detectedCardNumber = cardLastFour;
      }
    }
    
    // Açıklama
    const description = columns.description
      ? cellToString(values[columns.description])
      : undefined;
    
    // Taksit bilgisi çıkar
    const installmentInfo = extractInstallmentInfo(transactionName, description);
    
    // Raw data (tüm sütunlar)
    const rawData: Record<string, any> = {};
    for (let i = 1; i < values.length; i++) {
      rawData[`col_${i}`] = cellToString(values[i]);
    }
    
    // Item oluştur
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
  
  // Ekstre ayını tespit et (en yaygın tarih ayı)
  let detectedMonth: string | undefined;
  if (items.length > 0) {
    const monthCounts = new Map<string, number>();
    items.forEach(item => {
      const month = item.transactionDate.substring(0, 7); // YYYY-MM
      monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
    });
    
    // En çok geçen ayı bul
    let maxCount = 0;
    monthCounts.forEach((count, month) => {
      if (count > maxCount) {
        maxCount = count;
        detectedMonth = `${month}-01`; // YYYY-MM-01 formatı
      }
    });
  }
  
  return {
    items,
    totalTransactions: items.length,
    totalAmount: Math.round(totalAmount * 100) / 100, // 2 ondalık
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
 * Parse edilmiş veriyi validate eder
 */
export function validateParsedStatement(parsed: ParsedStatement): string[] {
  const errors: string[] = [];
  
  if (parsed.items.length === 0) {
    errors.push('Hiç işlem bulunamadı');
  }
  
  if (parsed.totalTransactions === 0) {
    errors.push('Toplam işlem sayısı 0');
  }
  
  // Her item'ı kontrol et
  parsed.items.forEach((item) => {
    if (!item.transactionName) {
      errors.push(`Satır ${item.rowNumber}: İşlem adı boş`);
    }
    
    if (item.amount === 0) {
      errors.push(`Satır ${item.rowNumber}: Tutar 0`);
    }
    
    if (!item.transactionDate || item.transactionDate === '1970-01-01') {
      errors.push(`Satır ${item.rowNumber}: Geçersiz tarih`);
    }
  });
  
  return errors;
}

/**
 * Dosya uzantısından format kontrolü
 */
export function isSupportedFileFormat(fileName: string): boolean {
  const ext = fileName.toLowerCase().split('.').pop();
  return ext === 'xlsx' || ext === 'xls';
}
