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
