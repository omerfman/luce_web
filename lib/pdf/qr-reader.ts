import { InvoiceQRData } from '@/types';

// Load PDF.js from CDN
async function loadPdfJs() {
  if ((window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Extract QR code from PDF file
 * Scans first 3 pages of PDF for QR codes
 */
export async function extractQRFromPDF(file: File): Promise<string | null> {
  try {
    console.log('Starting PDF QR extraction for file:', file.name, 'Size:', file.size);
    const pdfjsLib: any = await loadPdfJs();
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    console.log('PDF loaded successfully. Total pages:', pdf.numPages);
    
    // Scan all pages (not just first 3) since QR might be anywhere
    const maxPages = pdf.numPages;
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`Scanning page ${pageNum}/${maxPages} for QR code...`);
      const page = await pdf.getPage(pageNum);
      const qrData = await scanPageForQR(page);
      
      if (qrData) {
        console.log(`✅ QR code found on page ${pageNum}:`, qrData.substring(0, 100) + '...');
        return qrData;
      } else {
        console.log(`❌ No QR code on page ${pageNum}`);
      }
    }
    
    console.warn('⚠️ No QR code found in any of the scanned pages');
    return null;
  } catch (error) {
    console.error('Error extracting QR from PDF:', error);
    return null;
  }
}

/**
 * Scan a single PDF page for QR code
 */
async function scanPageForQR(page: any): Promise<string | null> {
  try {
    // Dynamic import to avoid webpack issues
    const jsQR = (await import('jsqr')).default;
    
    // Try multiple scales for better detection
    const scales = [5.0, 4.0, 3.0, 2.0, 1.5]; // Even higher scales
    
    for (const scale of scales) {
      const viewport = page.getViewport({ scale });
      
      console.log(`Trying scale ${scale}. Dimensions:`, viewport.width, 'x', viewport.height);
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        console.error('Failed to get canvas context');
        continue;
      }
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Try to render with different settings
      const renderTask = page.render({
        canvasContext: context,
        viewport: viewport,
        intent: 'print', // Use print intent for better quality
        annotationMode: 2, // Render all annotations (0=disable, 1=enable, 2=enable_forms, 3=enable_storage)
        includeAnnotationStorage: true,
      });
      
      try {
        await renderTask.promise;
      } catch (renderError) {
        console.error('Render error at scale', scale, renderError);
        continue;
      }
      
      console.log('Page rendered with annotations, scanning for QR code...');
      
      // DEBUG: Save canvas as image to check what we're scanning
      if (scale === 5.0) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          console.log('Canvas preview (first 100 chars):', dataUrl.substring(0, 100));
          console.log('Full canvas size:', canvas.width, 'x', canvas.height);
          // You can paste this in browser console: document.body.innerHTML = '<img src="' + dataUrl + '">'
        } catch {
          console.log('Could not create debug image');
        }
      }
      
      // Get image data for QR scanning
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // First, try full page scan
      console.log('Attempting full page QR scan...');
      let qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });
      
      if (qrCode) {
        console.log(`✅ QR code detected at scale ${scale}!`);
        return qrCode.data;
      }
      
      // If not found, try scanning top-right quadrant (where QR usually is)
      console.log('Trying top-right quadrant scan...');
      const quadrantWidth = Math.floor(canvas.width / 2);
      const quadrantHeight = Math.floor(canvas.height / 2);
      const topRightData = context.getImageData(quadrantWidth, 0, quadrantWidth, quadrantHeight);
      
      qrCode = jsQR(topRightData.data, topRightData.width, topRightData.height, {
        inversionAttempts: 'attemptBoth',
      });
      
      if (qrCode) {
        console.log(`✅ QR code detected in top-right quadrant at scale ${scale}!`);
        return qrCode.data;
      }
      
      // Try top-left quadrant
      console.log('Trying top-left quadrant scan...');
      const topLeftData = context.getImageData(0, 0, quadrantWidth, quadrantHeight);
      
      qrCode = jsQR(topLeftData.data, topLeftData.width, topLeftData.height, {
        inversionAttempts: 'attemptBoth',
      });
      
      if (qrCode) {
        console.log(`✅ QR code detected in top-left quadrant at scale ${scale}!`);
        return qrCode.data;
      }
      
      console.log(`No QR code at scale ${scale}, trying next...`);
    }
    
    console.log('No QR code detected on this page with any scale');
    return null;
  } catch (error) {
    console.error('Error scanning page for QR:', error);
    return null;
  }
}

/**
 * Parse Turkish e-invoice QR code data
 * Supports multiple formats used in Turkey
 */
export function parseInvoiceQR(qrData: string): InvoiceQRData {
  console.log('Parsing QR data:', qrData);
  
  const result: InvoiceQRData = {
    rawData: qrData,
  };
  
  // Try different formats
  
  // Format 1: Key-Value pairs (GİB standard)
  // Example: VKN:1234567890\nNO:FTR2025000001\nTARIH:10.12.2025\nTUTAR:1000.00
  const kvFormat = parseKeyValueFormat(qrData);
  if (kvFormat.invoiceNumber || kvFormat.totalAmount) {
    return { ...result, ...kvFormat };
  }
  
  // Format 2: Pipe-separated
  // Example: 1234567890|FTR2025000001|10.12.2025|1000.00|180.00
  const pipeFormat = parsePipeFormat(qrData);
  if (pipeFormat.invoiceNumber || pipeFormat.totalAmount) {
    return { ...result, ...pipeFormat };
  }
  
  // Format 3: JSON format
  // Example: {"vkn":"1234567890","no":"FTR2025000001","tarih":"10.12.2025","tutar":1000.00}
  const jsonFormat = parseJSONFormat(qrData);
  if (jsonFormat.invoiceNumber || jsonFormat.totalAmount) {
    return { ...result, ...jsonFormat };
  }
  
  // Format 4: URL format (some e-invoice systems use URLs)
  // Example: https://portal.example.com/fatura?vkn=123&no=FTR001&tutar=1000
  const urlFormat = parseURLFormat(qrData);
  if (urlFormat.invoiceNumber || urlFormat.totalAmount) {
    return { ...result, ...urlFormat };
  }
  
  console.warn('Could not parse QR data with known formats');
  return result;
}

/**
 * Parse Key-Value format
 * VKN:1234567890
 * NO:FTR2025000001
 * TARIH:10.12.2025
 */
function parseKeyValueFormat(data: string): Partial<InvoiceQRData> {
  const result: Partial<InvoiceQRData> = {};
  
  console.log('Trying Key-Value format parsing...');
  
  // Tax Number (VKN or TCKN) - many variations
  const vknMatch = data.match(/(?:VKN|TCKN|vergiNo|vergi_no|VergiKimlikNo)[:\s=]*(\d{10,11})/i);
  if (vknMatch) {
    result.taxNumber = vknMatch[1];
    console.log('Found Tax Number:', vknMatch[1]);
  }
  
  // Invoice Number - many variations
  const noMatch = data.match(/(?:NO|faturaNo|fatura_no|belgeNo|belge_no|FaturaNumarasi|SeriNo|seri_no)[:\s=]*([A-Z0-9-]+)/i);
  if (noMatch) {
    result.invoiceNumber = noMatch[1];
    console.log('Found Invoice Number:', noMatch[1]);
  }
  
  // Invoice Date - many variations
  const tarihMatch = data.match(/(?:TARIH|tarih|date|FaturaTarihi|fatura_tarihi|BelgeTarihi)[:\s=]*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i);
  if (tarihMatch) {
    result.invoiceDate = normalizeDateFormat(tarihMatch[1]);
    console.log('Found Date:', tarihMatch[1], '→', result.invoiceDate);
  }
  
  // Total Amount - many variations
  const tutarMatch = data.match(/(?:TUTAR|toplam|total|ToplamTutar|toplam_tutar|OdenecekTutar|odenecek|GenelToplam)[:\s=]*([\d.,]+)/i);
  if (tutarMatch) {
    result.totalAmount = parseAmount(tutarMatch[1]);
    console.log('Found Total Amount:', tutarMatch[1], '→', result.totalAmount);
  }
  
  // VAT Amount - many variations
  const kdvMatch = data.match(/(?:KDV|kdv|vat|KDVTutari|kdv_tutari|KDVToplami|VergiTutari)[:\s=]*([\d.,]+)/i);
  if (kdvMatch) {
    result.vatAmount = parseAmount(kdvMatch[1]);
    console.log('Found VAT Amount:', kdvMatch[1], '→', result.vatAmount);
  }
  
  // Goods/Services Total (before VAT) - many variations
  const malHizmetMatch = data.match(/(?:MAL|malHizmet|mal_hizmet|goods|MalHizmetToplami|matrah|Matrah|KDVMatrahi)[:\s=]*([\d.,]+)/i);
  if (malHizmetMatch) {
    result.goodsServicesTotal = parseAmount(malHizmetMatch[1]);
    console.log('Found Goods/Services Total:', malHizmetMatch[1], '→', result.goodsServicesTotal);
  }
  
  // Withholding - many variations
  const tevkifatMatch = data.match(/(?:TEVKIFAT|tevkifat|withholding|TevkifatTutari|stopaj|Stopaj)[:\s=]*([\d.,]+)/i);
  if (tevkifatMatch) {
    result.withholdingAmount = parseAmount(tevkifatMatch[1]);
    console.log('Found Withholding:', tevkifatMatch[1], '→', result.withholdingAmount);
  }
  
  // E-tag/UUID - many variations
  const etagMatch = data.match(/(?:ETAG|etag|uuid|UUID|FaturaUUID|belge_uuid)[:\s=]*([a-f0-9-]+)/i);
  if (etagMatch) {
    result.etag = etagMatch[1];
    console.log('Found ETAG:', etagMatch[1]);
  }
  
  // Supplier Name - many variations
  const supplierMatch = data.match(/(?:TEDARIKCI|tedarikci|supplier|firma|Firma|SaticiAdi|satici|Unvan)[:\s=]*([^\n|]+)/i);
  if (supplierMatch) {
    result.supplierName = supplierMatch[1].trim();
    console.log('Found Supplier Name:', supplierMatch[1].trim());
  }
  
  const fieldCount = Object.keys(result).length;
  console.log(`Key-Value parsing found ${fieldCount} fields`);
  
  return result;
}

/**
 * Parse Pipe-separated format
 * 1234567890|FTR2025000001|10.12.2025|1000.00|180.00
 */
function parsePipeFormat(data: string): Partial<InvoiceQRData> {
  const result: Partial<InvoiceQRData> = {};
  const parts = data.split('|');
  
  console.log('Trying Pipe format parsing. Parts count:', parts.length);
  
  if (parts.length < 3) return result;
  
  // Common pattern: VKN|InvoiceNo|Date|Total|VAT
  if (parts[0]?.match(/^\d{10,11}$/)) {
    result.taxNumber = parts[0];
    console.log('Found Tax Number (pipe):', parts[0]);
  }
  
  if (parts[1]?.match(/^[A-Z0-9-]+$/i)) {
    result.invoiceNumber = parts[1];
    console.log('Found Invoice Number (pipe):', parts[1]);
  }
  
  if (parts[2]?.match(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/)) {
    result.invoiceDate = normalizeDateFormat(parts[2]);
    console.log('Found Date (pipe):', parts[2], '→', result.invoiceDate);
  }
  
  if (parts[3]) {
    result.totalAmount = parseAmount(parts[3]);
    console.log('Found Total (pipe):', parts[3], '→', result.totalAmount);
  }
  
  if (parts[4]) {
    result.vatAmount = parseAmount(parts[4]);
    console.log('Found VAT (pipe):', parts[4], '→', result.vatAmount);
  }
  
  const fieldCount = Object.keys(result).length;
  console.log(`Pipe parsing found ${fieldCount} fields`);
  
  return result;
}

/**
 * Parse JSON format
 * {"vkn":"1234567890","no":"FTR2025000001"}
 */
function parseJSONFormat(data: string): Partial<InvoiceQRData> {
  try {
    console.log('Trying JSON format parsing...');
    
    // JSON string içindeki kontrolsüz karakterleri temizle (newline, tab, etc.)
    // Ama string değerlerinin içindeki boşlukları koruyalım
    let cleanedData = data
      .replace(/\n/g, ' ')      // Yeni satırları boşluğa çevir
      .replace(/\r/g, ' ')      // Carriage return'ü boşluğa çevir
      .replace(/\t/g, ' ')      // Tab'ları boşluğa çevir
      .replace(/\s+/g, ' ')     // Çoklu boşlukları tek boşluğa indir
      .trim();                  // Baş ve sondaki boşlukları temizle
    
    // Sondaki virgülü temizle: "value",} → "value"}
    cleanedData = cleanedData.replace(/,(\s*[}\]])/g, '$1');
    
    console.log('Cleaned JSON data:', cleanedData.substring(0, 200));
    
    const json = JSON.parse(cleanedData);
    const result: Partial<InvoiceQRData> = {};
    
    // Tax Number - many field names (vkntckn = Satıcı VKN, VKNTCKN büyük harfle de gelebilir)
    if (json.vkn || json.VKN || json.vkntckn || json.VKNTCKN || json.taxNumber) {
      result.taxNumber = json.vkn || json.VKN || json.vkntckn || json.VKNTCKN || json.taxNumber;
      console.log('Found Tax Number (JSON):', result.taxNumber);
    }
    
    // Buyer VKN - avkntckn
    if (json.avkntckn || json.buyerVKN) {
      result.buyerVKN = json.avkntckn || json.buyerVKN;
      console.log('Found Buyer VKN (JSON):', result.buyerVKN);
    }
    
    // Invoice Scenario - senaryo
    if (json.senaryo || json.scenario) {
      result.scenario = json.senaryo || json.scenario;
      console.log('Found Scenario (JSON):', result.scenario);
    }
    
    // Invoice Type - tip
    if (json.tip || json.type) {
      result.type = json.tip || json.type;
      console.log('Found Type (JSON):', result.type);
    }
    
    // Currency - parabirimi
    if (json.parabirimi || json.currency) {
      result.currency = json.parabirimi || json.currency;
      console.log('Found Currency (JSON):', result.currency);
    }
    
    // Invoice Number - many field names
    if (json.no || json.invoiceNumber || json.faturaNo || json.belgeNo) {
      result.invoiceNumber = json.no || json.invoiceNumber || json.faturaNo || json.belgeNo;
      console.log('Found Invoice Number (JSON):', result.invoiceNumber);
    }
    
    // Invoice Date - many field names
    if (json.tarih || json.date || json.invoiceDate || json.faturaTarihi) {
      result.invoiceDate = normalizeDateFormat(json.tarih || json.date || json.invoiceDate || json.faturaTarihi);
      console.log('Found Date (JSON):', result.invoiceDate);
    }
    
    // Total Amount - many field names: odenecek, vergidahil, toplam, tutar
    if (json.odenecek || json.vergidahil || json.tutar || json.total || json.totalAmount || json.toplamTutar) {
      const amountValue = json.odenecek || json.vergidahil || json.tutar || json.total || json.totalAmount || json.toplamTutar;
      // Boşlukları ve yeni satırları temizle
      const cleanValue = String(amountValue).trim();
      result.totalAmount = parseAmount(cleanValue);
      console.log('Found Total Amount (JSON):', amountValue, '→ (cleaned):', cleanValue, '→', result.totalAmount);
    }
    
    // VAT Amount - hesaplananKDV, kdv, vat (parantezli field'lar için dinamik arama)
    let kdvValue = null;
    
    // Önce dinamik olarak parantezli KDV field'ını ara: hesaplananKDV(20), hesaplananKDV(10), vb.
    const hesaplananKdvKey = Object.keys(json).find(k => k.startsWith('hesaplananKDV') || k.startsWith('hesaplanankdv'));
    if (hesaplananKdvKey) {
      kdvValue = json[hesaplananKdvKey];
      console.log('Found VAT Amount (hesaplananKDV):', hesaplananKdvKey, '=', kdvValue);
    }
    
    // Alternatif: kdv, vat gibi standart field'lar
    if (!kdvValue) {
      const kdvKeys = Object.keys(json).find(k => k.toLowerCase().includes('hesaplanankdv') || k === 'kdv' || k === 'vat');
      if (kdvKeys) {
        kdvValue = json[kdvKeys];
        console.log('Found VAT Amount (standard):', kdvKeys, '=', kdvValue);
      }
    }
    
    if (kdvValue !== null) {
      // Boşlukları ve yeni satırları temizle
      const cleanKdvValue = String(kdvValue).trim();
      result.vatAmount = parseAmount(cleanKdvValue);
      console.log('Final VAT Amount:', kdvValue, '→ (cleaned):', cleanKdvValue, '→', result.vatAmount);
    }
    
    // Goods/Services Total - malHizmet, malhizmettoplam, matrah
    // malHizmet = KDV hariç tutar (en yaygın)
    let goodsValue = null;
    
    if (json.malHizmet) {
      goodsValue = json.malHizmet;
      console.log('Found Goods/Services (malHizmet):', goodsValue);
    } else if (json.malhizmettoplam || json.matrah) {
      goodsValue = json.malhizmettoplam || json.matrah;
      console.log('Found Goods/Services (malhizmettoplam/matrah):', goodsValue);
    }
    
    // malHizmetKDV(20) gibi parantezli field'ları da kontrol et
    if (!goodsValue) {
      const malHizmetKdvKey = Object.keys(json).find(k => k.startsWith('malHizmetKDV') || k.startsWith('malhizmetkdv'));
      if (malHizmetKdvKey) {
        goodsValue = json[malHizmetKdvKey];
        console.log('Found Goods/Services (malHizmetKDV):', malHizmetKdvKey, '=', goodsValue);
      }
    }
    
    // kdvmatrah(20) gibi parantezli field'ları kontrol et
    if (!goodsValue) {
      const kdvMatrahKey = Object.keys(json).find(k => k.toLowerCase().startsWith('kdvmatrah'));
      if (kdvMatrahKey) {
        goodsValue = json[kdvMatrahKey];
        console.log('Found Goods/Services (kdvmatrah):', kdvMatrahKey, '=', goodsValue);
      }
    }
    
    if (goodsValue !== null) {
      // Boşlukları ve yeni satırları temizle
      const cleanValue = String(goodsValue).trim();
      result.goodsServicesTotal = parseAmount(cleanValue);
      console.log('Final Goods/Services Total:', goodsValue, '→ (cleaned):', cleanValue, '→', result.goodsServicesTotal);
    }
    
    // Supplier Name - unvan, tedarikci, supplier, supplierName, satici
    if (json.unvan || json.tedarikci || json.supplier || json.supplierName || json.satici) {
      result.supplierName = json.unvan || json.tedarikci || json.supplier || json.supplierName || json.satici;
      console.log('Found Supplier Name (JSON):', result.supplierName);
    }
    
    // ETTN/UUID (büyük harfle de gelebilir)
    if (json.ettn || json.ETTN || json.uuid || json.UUID) {
      result.etag = json.ettn || json.ETTN || json.uuid || json.UUID;
      console.log('Found ETTN (JSON):', result.etag);
    }
    
    // Tevkifat Hesaplama - eğer tip TEVKIFAT ise vergidahil - odenecek farkını hesapla
    if (result.type && result.type.toUpperCase().includes('TEVKIFAT')) {
      const vergidahilValue = json.vergidahil || json.total || json.totalAmount;
      const odenecekValue = json.odenecek || json.payable;
      
      if (vergidahilValue && odenecekValue) {
        const vergidahil = parseAmount(String(vergidahilValue));
        const odenecek = parseAmount(String(odenecekValue));
        
        if (vergidahil && odenecek) {
          result.withholdingAmount = vergidahil - odenecek;
          console.log('Calculated Withholding (Tevkifat):', 
            `vergidahil (${vergidahil}) - odenecek (${odenecek}) = ${result.withholdingAmount}`);
          
          // Ödenecek tutarı totalAmount olarak güncelle (tevkifat sonrası ödenecek)
          result.totalAmount = odenecek;
          console.log('Updated Total Amount to payable amount:', result.totalAmount);
        }
      }
    }
    
    const fieldCount = Object.keys(result).length;
    console.log(`JSON parsing found ${fieldCount} fields`);
    
    return result;
  } catch (error) {
    console.log('JSON parsing failed:', error);
    return {};
  }
}

/**
 * Parse URL format
 * https://portal.example.com/fatura?vkn=123&no=FTR001
 */
function parseURLFormat(data: string): Partial<InvoiceQRData> {
  try {
    const url = new URL(data);
    const params = url.searchParams;
    const result: Partial<InvoiceQRData> = {};
    
    const vkn = params.get('vkn') || params.get('VKN') || params.get('taxNumber');
    if (vkn) result.taxNumber = vkn;
    
    const no = params.get('no') || params.get('invoiceNumber') || params.get('faturaNo');
    if (no) result.invoiceNumber = no;
    
    const tarih = params.get('tarih') || params.get('date') || params.get('invoiceDate');
    if (tarih) result.invoiceDate = normalizeDateFormat(tarih);
    
    const tutar = params.get('tutar') || params.get('total') || params.get('totalAmount');
    if (tutar) result.totalAmount = parseAmount(tutar);
    
    const kdv = params.get('kdv') || params.get('vat') || params.get('vatAmount');
    if (kdv) result.vatAmount = parseAmount(kdv);
    
    return result;
  } catch {
    return {};
  }
}

/**
 * Normalize date format to YYYY-MM-DD
 * Handles: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
 */
function normalizeDateFormat(dateStr: string): string {
  const cleaned = dateStr.trim();
  
  // Already in ISO format
  if (cleaned.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return cleaned;
  }
  
  // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const parts = cleaned.split(/[./-]/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return cleaned;
}

/**
 * Parse amount from Turkish or English format
 * Handles: 1.000,00 or 1,000.00 or 1000.00 or 1000 or 15090.4
 */
function parseAmount(amountStr: string): number {
  const cleaned = amountStr.trim();
  
  // If it's already a clean number (e.g., "15090.4", "3018.08")
  // Just parse it directly
  const directParse = parseFloat(cleaned);
  if (!isNaN(directParse) && !cleaned.includes(',') && cleaned.split('.').length <= 2) {
    // It's a simple decimal number like "15090.4" or "3018.08"
    console.log(`Parsing simple decimal: "${cleaned}" → ${directParse}`);
    return directParse;
  }
  
  // Turkish format: 1.000,50 → 1000.50
  if (cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
    const result = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    console.log(`Parsing Turkish format: "${cleaned}" → ${result}`);
    return result;
  }
  
  // English format with thousands separator: 1,000.50 → 1000.50
  if (cleaned.includes(',')) {
    const result = parseFloat(cleaned.replace(/,/g, ''));
    console.log(`Parsing English format: "${cleaned}" → ${result}`);
    return result;
  }
  
  // Fallback
  console.log(`Parsing fallback: "${cleaned}" → ${directParse}`);
  return directParse;
}
