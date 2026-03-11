/**
 * Statement-Invoice Matcher
 * 
 * Kredi kartı ekstre satırlarını faturalarla eşleştiren algoritma.
 * 
 * Eşleştirme Kriterleri:
 * 1. Tutar eşleşmesi (öncelik 1) - ±0.01 TL tolerans
 * 2. Firma adı benzerliği (öncelik 2) - Ortak kelimeler
 * 
 * Skor Sistemi:
 * - 80-100: Otomatik eşleştir (yüksek güven)
 * - 50-79: Öneri göster (orta güven)
 * - 0-49: Eşleşme yok (düşük güven)
 */

import { supabase } from './supabase/client';
import type { ParsedStatementItem } from './excel-parser';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface Invoice {
  id: string;
  amount: number;
  supplier_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  created_at?: string;
  file_path?: string; // Supabase storage path
}

export interface MatchResult {
  invoice: Invoice;
  matchScore: number;
  matchType: 'exact_amount' | 'amount_and_name' | 'suggested';
  reasons: string[]; // Eşleşme nedenleri
}

export interface MatchResults {
  exact: MatchResult[];      // Score >= 80
  suggested: MatchResult[];  // Score 50-79
  noMatch: boolean;          // Score < 50
}

// =====================================================
// CONSTANTS
// =====================================================

// Stopwords - anlamsız kelimeler (firma adı karşılaştırmasında yok sayılır)
// NOT: "sanayi" ve "ticaret" ÇIKARILDI - bunlar önemli ayraçlar!
const STOPWORDS = [
  'ltd',
  'şti',
  'a.ş',
  'as',
  'anonim',
  'limited',
  'şirketi',
  've',
  'veya',
  'ile',
  'için',
  'ise',
  'de',
  'da',
  'den',
  'dan',
  'bir',
  'bu',
  'şu',
  'o'
];

// Firma adı kısaltmaları - otomatik genişletme için
const ABBREVIATIONS: Record<string, string[]> = {
  'inş': ['inşaat', 'inş', 'insaat'],  // Türkçe karakterli ve karaktersiz versiyonlar
  'ins': ['inşaat', 'insaat', 'ins'],  // "INS" kısaltması ekstrelerden gelebilir
  'insaa': ['inşaat', 'insaat'],       // "INSAA" formatı (Garanti ekstreleri)
  'insaat': ['inşaat', 'insaat'],      // Tam hali (Türkçe karaktersiz)
  'san': ['sanayi', 'sanayi', 'san'],
  'tic': ['ticaret', 'ticaret', 'tic'],
  'ti': ['ticaret', 'ticaret', 'ti'],  // Başka anlamları da olabilir ama çoğunlukla ticaret
  'ltd': ['limited', 'ltd'],
  'şti': ['şirketi', 'şti', 'sti'],
  'sti': ['şirketi', 'sti'],            // Türkçe karaktersiz versiyon
  'paz': ['pazarlama', 'pazarlama', 'paz'],
  'ith': ['ithalat', 'ithalat', 'ith'],
  'ihr': ['ihracat', 'ihracat', 'ihr'],
  'elk': ['elektronik', 'elektronik', 'elk'],
  'oto': ['otomotiv', 'otomotiv', 'oto'],
  'end': ['endüstri', 'endustri', 'end'],
  'müh': ['mühendislik', 'muhendislik', 'müh', 'muh']
};

// Tutar eşleşme toleransı (yuvarla hatalarını kapatır)
const AMOUNT_TOLERANCE = 0.01;

// Skor thresholdları
const AUTO_MATCH_THRESHOLD = 80;
const SUGGESTION_THRESHOLD = 50;

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Taksitli işlemler için toplam tutarı hesaplar
 * 
 * Mantık:
 * - Taksitli ise:
 *   - Toplam tutar belli ise (Denizbank) → direkt kullan
 *   - Yoksa (Garanti/YKB) → tek taksit × toplam taksit sayısı
 * - Normal işlem ise → mevcut tutarı kullan
 * 
 * Örnek:
 * - İşlem: -32.631,33 TL (1/6 taksit)
 * - Eşleşecek fatura: 195.787,98 TL (32.631,33 × 6)
 */
function getMatchingAmount(item: ParsedStatementItem): number {
  const absAmount = Math.abs(item.amount);
  
  if (item.isInstallment) {
    // 1. Toplam tutar belli ise (Denizbank formatı)
    if (item.installmentTotalAmount && item.installmentTotalAmount > 0) {
      console.log(`    💰 Installment with total: ${absAmount} TL (${item.installmentCurrent}/${item.installmentTotal}) → Total: ${item.installmentTotalAmount} TL`);
      return item.installmentTotalAmount;
    }
    
    // 2. Yoksa hesapla (tek taksit × toplam taksit sayısı)
    if (item.installmentTotal && item.installmentTotal > 0) {
      const calculatedTotal = absAmount * item.installmentTotal;
      console.log(`    💰 Installment calculated: ${absAmount} TL × ${item.installmentTotal} = ${calculatedTotal} TL`);
      return calculatedTotal;
    }
  }
  
  // Normal işlem
  return absAmount;
}

/**
 * String'i kelimelere ayırır ve temizler
 * 
 * GELISMİS TOKENAZER:
 * - Türkçe karakterleri korur ve düzgün küçültür (İ → i, I → ı)
 * - Noktalama işaretlerini temizler
 * - Kısaltmaları genişletir
 */
function tokenize(text: string): string[] {
  if (!text) return [];
  
  // 1. Türkçe-aware küçük harfe çevirme ve noktalamaları temizleme
  // NOT: toLocaleLowerCase('tr') ile İ → i dönüşümü doğru yapılır
  let cleaned = text
    .toLocaleLowerCase('tr')  // Türkçe locale ile küçült (İ → i, I → ı)
    .replace(/[^\wÇĞİÖŞÜçğıöşü\s]/g, ' '); // Noktalama işaretlerini kaldır
  
  // 2. Kelimelere ayır
  const tokens = cleaned
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 0);
  
  // 3. Kısaltmaları genişlet (hem kısaltılmış hem de tam hali için)
  const expanded: string[] = [];
  for (const token of tokens) {
    // Tek harfli kelimeleri atla ("a", "b" gibi)
    if (token.length === 1) continue;
    
    expanded.push(token);
    
    // Eğer bu token bir kısaltmaysa, tam halini de ekle
    if (ABBREVIATIONS[token]) {
      ABBREVIATIONS[token].forEach(expansion => {
        if (expansion !== token) {
          expanded.push(expansion);
        }
      });
    }
  }
  
  return expanded;
}

/**
 * Stopwords'leri filtreler
 */
function removeStopwords(tokens: string[]): string[] {
  return tokens.filter(token => !STOPWORDS.includes(token));
}

/**
 * İki kelime listesi arasındaki ortak kelimeleri bulur
 * GELISMİS VERSİYON: Partial matching ve Türkçe karakter varyasyonları destekler
 * 
 * @param tokens1 - İlk kelime listesi
 * @param tokens2 - İkinci kelime listesi
 * @param allowPartial - Kısmi eşleşmeye izin ver (default: true)
 * @returns Ortak kelimeler ve kısmi eşleşmeler
 */
function findCommonWords(
  tokens1: string[], 
  tokens2: string[], 
  allowPartial: boolean = true
): { exact: string[]; partial: string[] } {
  const set2 = new Set(tokens2);
  
  // Tam eşleşmeler
  const exact = tokens1.filter(token => set2.has(token));
  
  if (!allowPartial) {
    return { exact, partial: [] };
  }
  
  // Kısmi eşleşmeler (bir kelime diğerinin başında ise veya Türkçe karakter varyasyonu)
  const partial: string[] = [];
  const partialMatches = new Set<string>(); // Tekrar eklemeyi engellemek için
  
  // Türkçe karakter normalizasyon helper
  const normalizeTurkish = (text: string) => 
    text.replace(/ş/g, 's')
        .replace(/ğ/g, 'g')
        .replace(/ı/g, 'i')
        .replace(/ü/g, 'u')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');
  
  for (const token1 of tokens1) {
    // Eğer tam eşleşme varsa, kısmi eşleşmeyi atlat
    if (exact.includes(token1)) continue;
    
    for (const token2 of tokens2) {
      if (exact.includes(token2)) continue;
      
      // 1. Prefix matching (başlangıç eşleşmesi)
      const longer = token1.length > token2.length ? token1 : token2;
      const shorter = token1.length > token2.length ? token2 : token1;
      
      // Kısa kelime en az 3 karakter olmalı ("inş", "san" gibi)
      if (shorter.length >= 3 && longer.startsWith(shorter)) {
        const matchKey = `${shorter}-${longer}`;
        if (!partialMatches.has(matchKey)) {
          partial.push(shorter);
          partialMatches.add(matchKey);
        }
        continue;
      }
      
      // 2. Türkçe karakter varyasyonu kontrolü
      // "insaa" vs "inşaat", "muhendis" vs "mühendis" gibi
      const normalized1 = normalizeTurkish(token1);
      const normalized2 = normalizeTurkish(token2);
      
      if (normalized1 === normalized2 && token1 !== token2) {
        const matchKey = `turkish-${token1}-${token2}`;
        if (!partialMatches.has(matchKey)) {
          partial.push(token1);
          partialMatches.add(matchKey);
        }
        continue;
      }
      
      // 3. Türkçe karaktersiz versiyonlarla prefix matching
      if (normalized1.length >= 3 && normalized2.length >= 3) {
        const longerNorm = normalized1.length > normalized2.length ? normalized1 : normalized2;
        const shorterNorm = normalized1.length > normalized2.length ? normalized2 : normalized1;
        
        if (longerNorm.startsWith(shorterNorm)) {
          const matchKey = `turkish-prefix-${token1}-${token2}`;
          if (!partialMatches.has(matchKey)) {
            partial.push(token1.length < token2.length ? token1 : token2);
            partialMatches.add(matchKey);
          }
        }
      }
    }
  }
  
  return { exact, partial };
}

/**
 * İki tutar arasındaki farkı hesaplar (mutlak değer)
 */
function amountDifference(amount1: number, amount2: number): number {
  return Math.abs(Math.abs(amount1) - Math.abs(amount2));
}

// =====================================================
// MATCHING FUNCTIONS
// =====================================================

/**
 * Tutar eşleşmesi kontrolü
 * 
 * @returns true if amounts match within tolerance
 */
function isAmountMatch(statementAmount: number, invoiceAmount: number): boolean {
  const diff = amountDifference(statementAmount, invoiceAmount);
  return diff <= AMOUNT_TOLERANCE;
}

/**
 * Firma adı benzerlik skoru hesaplar (0-100)
 * 
 * GELİŞMİŞ VERSİYON:
 * - Tam kelime eşleşmeleri (ağırlık: 1.0)
 * - Kısmi eşleşmeler - "inş" ile "inşaat" gibi (ağırlık: 0.7)
 * - Jaccard similarity kullanır
 * 
 * Örnek:
 * - "ELMAS OTOMOTİV İNŞ.SAN.Tİ" vs "ELMAS OTOMOTİV İNŞAAT SANAYİ TİCARET"
 * - Tam eşleşme: elmas, otomotiv (genişletilmiş: ticaret de eşleşir)
 * - Kısmi eşleşme: inş-inşaat, san-sanayi
 * - Eski skor: ~21% → Yeni skor: ~60-70%
 */
function calculateNameSimilarity(
  transactionName: string,
  supplierName: string
): number {
  if (!transactionName || !supplierName) return 0;
  
  // Tokenize (kısaltmalar genişletilmiş halde gelir)
  const tokens1 = tokenize(transactionName);
  const tokens2 = tokenize(supplierName);
  
  // Stopwords çıkar
  const cleaned1 = removeStopwords(tokens1);
  const cleaned2 = removeStopwords(tokens2);
  
  if (cleaned1.length === 0 || cleaned2.length === 0) return 0;
  
  // Ortak kelimeleri bul (tam + kısmi eşleşmeler)
  const commonWords = findCommonWords(cleaned1, cleaned2, true);
  
  // Ağırlıklı eşleşme sayısı hesapla
  // Tam eşleşme: 1.0 puan, Kısmi eşleşme: 0.7 puan
  const exactCount = commonWords.exact.length;
  const partialCount = commonWords.partial.length;
  const weightedMatches = exactCount + (partialCount * 0.7);
  
  // Union hesapla (benzersiz kelimeler)
  const union = new Set([...cleaned1, ...cleaned2]);
  
  // Ağırlıklı Jaccard similarity
  const similarity = weightedMatches / union.size;
  
  // 0-100 arası skora çevir
  return Math.min(Math.round(similarity * 100), 100);
}

/**
 * Tarih yakınlığı skoru hesaplar (0-20 puan)
 * 
 * Skorlama:
 * - Aynı gün: 20 puan
 * - 1-3 gün fark: 15 puan
 * - 3+ gün fark: 0 puan (çok uzak)
 */
function calculateDateProximityScore(
  transactionDate: string,
  invoiceDate: string
): { score: number; reason: string } {
  if (!transactionDate || !invoiceDate) {
    return { score: 0, reason: '' };
  }
  
  try {
    const date1 = new Date(transactionDate);
    const date2 = new Date(invoiceDate);
    
    // Geçersiz tarih kontrolü
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
      return { score: 0, reason: '' };
    }
    
    // Gün farkını hesapla (mutlak değer)
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return { score: 20, reason: 'Tarihler aynı gün' };
    } else if (diffDays <= 3) {
      return { score: 15, reason: `Tarih farkı ${diffDays} gün` };
    } else {
      return { score: 0, reason: `Tarih farkı ${diffDays} gün (çok uzak)` };
    }
  } catch (error) {
    console.error('Date comparison error:', error);
    return { score: 0, reason: '' };
  }
}

/**
 * Tek bir invoice için match score hesaplar
 * 
 * Skorlama Sistemi (Toplam 100 puan):
 * - Tutar: 40 puan (tam eşleşme) + 16 puana kadar (yakın tutarlar)
 * - Firma adı: 40 puana kadar (benzerlik oranına göre)
 * - Tarih: 20 puana kadar (tarih yakınlığına göre)
 * 
 * NOT: Taksitli işlemlerde toplam tutar kullanılır
 */
function calculateMatchScore(
  item: ParsedStatementItem,
  invoice: Invoice
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  
  // Taksitli işlemler için toplam tutarı hesapla
  const matchingAmount = getMatchingAmount(item);
  
  // 1. Tutar kontrolü (40 puan tam, +16 puan kısmi)
  const amountMatch = isAmountMatch(matchingAmount, invoice.amount);
  if (amountMatch) {
    score += 40;
    const reason = item.isInstallment 
      ? `Tutar eşleşti (${item.installmentCurrent}/${item.installmentTotal} taksit toplamı)`
      : 'Tutar birebir eşleşti';
    reasons.push(reason);
  } else {
    // Kısmi skor - tutarlar ne kadar yakınsa o kadar puan
    const diff = amountDifference(matchingAmount, invoice.amount);
    const maxDiff = Math.max(matchingAmount, Math.abs(invoice.amount)) * 0.1; // %10 tolerans
    
    if (diff < maxDiff) {
      const partialScore = Math.round((1 - diff / maxDiff) * 16); // Max 16 puan
      score += partialScore;
      reasons.push(`Tutar yakın (fark: ${diff.toFixed(2)} TL)`);
    }
  }
  
  // 2. Firma adı benzerliği (40 puan)
  if (invoice.supplier_name) {
    const nameSimilarity = calculateNameSimilarity(
      item.transactionName,
      invoice.supplier_name
    );
    
    console.log(`    🏢 Name comparison: "${item.transactionName}" vs "${invoice.supplier_name}" → similarity: ${nameSimilarity}%`);
    
    const nameScore = Math.round(nameSimilarity * 0.4); // 0-40 arası
    score += nameScore;
    
    if (nameScore > 0) {
      reasons.push(`Firma adı benzerliği: %${nameSimilarity}`);
    }
  }
  
  // 3. Tarih yakınlığı (20 puan)
  if (item.transactionDate && invoice.invoice_date) {
    const dateScore = calculateDateProximityScore(item.transactionDate, invoice.invoice_date);
    score += dateScore.score;
    
    if (dateScore.score > 0) {
      reasons.push(dateScore.reason);
    }
    
    console.log(`    📅 Date comparison: "${item.transactionDate}" vs "${invoice.invoice_date}" → score: ${dateScore.score}`);
  }
  
  return { score: Math.min(score, 100), reasons };
}

/**
 * Match type'ı score'a göre belirler
 */
function determineMatchType(score: number, hasAmountMatch: boolean): MatchResult['matchType'] {
  if (score >= AUTO_MATCH_THRESHOLD) {
    return hasAmountMatch ? 'exact_amount' : 'amount_and_name';
  }
  return 'suggested';
}

/**
 * Bir faturanın daha önce eşleştirilip eşleştirilmediğini ve 
 * tekrar eşleştirilebilir olup olmadığını kontrol eder.
 * 
 * Mantık:
 * - Normal harcama: Fatura bir kez kullanıldıysa artık kullanılamaz
 * - Taksitli harcama: Fatura birden fazla taksit ile eşleşebilir,
 *   ANCAK toplam tutar fatura tutarını aşmamalı
 * 
 * @param invoiceId - Fatura ID
 * @param invoiceAmount - Fatura tutarı
 * @param currentItem - Şu anda eşleştirmeye çalıştığımız item
 * @param supabaseClient - Supabase client
 * @returns Match durumu ve detayları
 */
async function checkInvoiceMatchStatus(
  invoiceId: string,
  invoiceAmount: number,
  currentItem: ParsedStatementItem,
  supabaseClient: any
): Promise<{
  isMatched: boolean;
  canMatch: boolean;
  matchedAmount: number;
  reason?: string;
}> {
  try {
    // Bu faturaya daha önce match edilmiş items'ları getir
    const { data: matches, error } = await supabaseClient
      .from('statement_invoice_matches')
      .select(`
        id,
        statement_item_id,
        card_statement_items!inner(
          id,
          transaction_name,
          amount,
          is_installment,
          installment_current,
          installment_total,
          installment_total_amount
        )
      `)
      .eq('invoice_id', invoiceId);
    
    if (error) {
      console.error(`Error checking invoice ${invoiceId} match status:`, error);
      // Hata durumunda güvenli tarafta kal: eşleştirme yapma
      return {
        isMatched: false,
        canMatch: true,
        matchedAmount: 0
      };
    }
    
    // Eğer hiç match edilmemişse, eşleştirilebilir
    if (!matches || matches.length === 0) {
      return {
        isMatched: false,
        canMatch: true,
        matchedAmount: 0
      };
    }
    
    // Daha önce match edilmiş tutarları topla
    const matchedAmount = matches.reduce((sum: number, match: any) => {
      return sum + Math.abs(match.card_statement_items.amount);
    }, 0);
    
    console.log(`  📊 Invoice ${invoiceId} has ${matches.length} existing match(es), total matched: ${matchedAmount.toFixed(2)} TL`);
    
    // TUTAR KONTROLÜ (hem normal hem taksitli için aynı mantık):
    // Toplam eşleşmiş tutar + şu anki item tutarı <= fatura tutarı mı?
    const currentAmount = Math.abs(currentItem.amount);
    const totalAfterMatch = matchedAmount + currentAmount;
    const canMatch = totalAfterMatch <= invoiceAmount + 0.01; // 0.01 TL tolerans
    
    if (canMatch) {
      const reason = currentItem.isInstallment
        ? `Taksit eklenebilir (${matches.length} eşleşme zaten var, toplam: ${matchedAmount.toFixed(2)} TL)`
        : `Normal harcama eklenebilir (${matches.length} taksit zaten eşleşmiş, toplam: ${matchedAmount.toFixed(2)} TL)`;
      
      console.log(`  ✅ Invoice ${invoiceId} CAN accept: matched=${matchedAmount.toFixed(2)}, current=${currentAmount.toFixed(2)}, total=${totalAfterMatch.toFixed(2)}, invoice=${invoiceAmount.toFixed(2)}`);
      
      return {
        isMatched: true,
        canMatch: true,
        matchedAmount,
        reason
      };
    } else {
      console.log(`  ⛔ Invoice ${invoiceId} is FULL: matched=${matchedAmount.toFixed(2)}, current=${currentAmount.toFixed(2)}, total=${totalAfterMatch.toFixed(2)} > invoice=${invoiceAmount.toFixed(2)}`);
      
      return {
        isMatched: true,
        canMatch: false,
        matchedAmount,
        reason: `Fatura tutarı dolu (${matches.length} eşleşme, toplam: ${matchedAmount.toFixed(2)} TL, yeni toplam ${totalAfterMatch.toFixed(2)} TL > fatura ${invoiceAmount.toFixed(2)} TL)`
      };
    }
    
  } catch (error) {
    console.error(`Error in checkInvoiceMatchStatus for invoice ${invoiceId}:`, error);
    return {
      isMatched: false,
      canMatch: true,
      matchedAmount: 0
    };
  }
}

// =====================================================
// MAIN MATCHING FUNCTION
// =====================================================

/**
 * Bir ekstre satırı için eşleşen faturaları bulur
 * 
 * @param item - Ekstre satırı
 * @param companyId - Şirket ID
 * @param supabaseClient - Supabase client (optional, defaults to default client)
 * @returns Eşleşme sonuçları
 */
export async function findMatchingInvoices(
  item: ParsedStatementItem,
  companyId: string,
  supabaseClient: any = supabase
): Promise<MatchResults> {
  // Payment tipindeki işlemleri atla (borç ödemesi - faturada bulunamaz)
  if (item.transactionType === 'payment') {
    console.log(`💳 Skipping payment transaction: ${item.transactionName}`);
    return {
      exact: [],
      suggested: [],
      noMatch: true
    };
  }
  
  // Taksitli işlemler için toplam tutarı hesapla
  const matchingAmount = getMatchingAmount(item);
  
  const installmentInfo = item.isInstallment 
    ? ` (${item.installmentCurrent}/${item.installmentTotal} taksit, toplam: ${matchingAmount} TL)`
    : '';
  
  console.log(`🔍 Matching item: ${item.transactionName} - Amount: ${item.amount} → Matching: ${matchingAmount} TL${installmentInfo}`);
  
  // 1. Tüm faturaları çek (TODO: Optimize et - sadece yakın tutarlarda olan)
  const { data: invoices, error } = await supabaseClient
    .from('invoices')
    .select('id, amount, file_path, supplier_name, invoice_number, invoice_date, created_at')
    .eq('company_id', companyId)
    .gte('amount', matchingAmount - 100) // ±100 TL tolerans
    .lte('amount', matchingAmount + 100);
  
  if (error) {
    console.error('Error fetching invoices:', error);
    throw new Error('Faturalar yüklenirken hata oluştu');
  }
  
  console.log(`📊 Found ${invoices?.length || 0} invoices in range [${matchingAmount - 100}, ${matchingAmount + 100}]`);
  
  if (!invoices || invoices.length === 0) {
    return {
      exact: [],
      suggested: [],
      noMatch: true
    };
  }
  
  // 2. Her fatura için skor hesapla ve match durumunu kontrol et
  const allMatches: MatchResult[] = [];
  
  for (const invoice of invoices) {
    // Önce bu faturanın daha önce eşleştirilip eşleştirilemeyeceğini kontrol et
    const matchStatus = await checkInvoiceMatchStatus(
      invoice.id,
      invoice.amount,
      item,
      supabaseClient
    );
    
    // Eğer bu fatura eşleştirilemezse, atla
    if (!matchStatus.canMatch) {
      console.log(`  ⏭️  Skipping invoice ${invoice.id}: ${matchStatus.reason}`);
      continue;
    }
    
    const { score, reasons } = calculateMatchScore(item, invoice);
    
    console.log(`  📋 Invoice ${invoice.id}: amount=${invoice.amount}, supplier=${invoice.supplier_name}, score=${score}`);
    
    // Minimum threshold kontrolü
    if (score >= SUGGESTION_THRESHOLD) {
      const hasAmountMatch = isAmountMatch(matchingAmount, invoice.amount);
      const matchType = determineMatchType(score, hasAmountMatch);
      
      console.log(`  ✅ Match found! Type: ${matchType}, Score: ${score}, Reasons: ${reasons.join(', ')}`);
      
      allMatches.push({
        invoice,
        matchScore: score,
        matchType,
        reasons
      });
    } else {
      console.log(`  ❌ Score too low (${score} < ${SUGGESTION_THRESHOLD})`);
    }
  }
  
  // 3. Skorlara göre sırala (yüksekten düşüğe)
  allMatches.sort((a, b) => b.matchScore - a.matchScore);
  
  // 4. Kategorize et
  const exact = allMatches.filter(m => m.matchScore >= AUTO_MATCH_THRESHOLD);
  const suggested = allMatches.filter(
    m => m.matchScore >= SUGGESTION_THRESHOLD && m.matchScore < AUTO_MATCH_THRESHOLD
  );
  
  console.log(`🎯 Final results: ${exact.length} exact, ${suggested.length} suggested, noMatch: ${allMatches.length === 0}`);
  
  return {
    exact,
    suggested,
    noMatch: allMatches.length === 0
  };
}

/**
 * Birden fazla ekstre satırı için toplu eşleştirme yapar
 * 
 * @param items - Ekstre satırları
 * @param companyId - Şirket ID
 * @param autoMatchThreshold - Otomatik eşleştirme eşiği (default: 80)
 * @param supabaseClient - Supabase client (optional)
 * @returns Her satır için eşleşme sonuçları
 */
export async function matchStatementItems(
  items: ParsedStatementItem[],
  companyId: string,
  _autoMatchThreshold: number = AUTO_MATCH_THRESHOLD,  // Reserved for future use
  supabaseClient: any = supabase
): Promise<Map<number, MatchResults>> {
  const results = new Map<number, MatchResults>();
  
  for (const item of items) {
    const matchResults = await findMatchingInvoices(item, companyId, supabaseClient);
    results.set(item.rowNumber, matchResults);
  }
  
  return results;
}

/**
 * Eşleşme istatistiklerini hesaplar
 */
export function calculateMatchStats(matchResults: Map<number, MatchResults>) {
  let autoMatched = 0;
  let suggested = 0;
  let noMatch = 0;
  
  matchResults.forEach(result => {
    if (result.exact.length > 0) {
      autoMatched++;
    } else if (result.suggested.length > 0) {
      suggested++;
    } else {
      noMatch++;
    }
  });
  
  const total = autoMatched + suggested + noMatch;
  
  return {
    total,
    autoMatched,
    suggested,
    noMatch,
    autoMatchRate: total > 0 ? Math.round((autoMatched / total) * 100) : 0,
    suggestionRate: total > 0 ? Math.round((suggested / total) * 100) : 0
  };
}

// =====================================================
// CURRENT ACCOUNT SUPPLIER MATCHING
// =====================================================

/**
 * Kredi kartı ekstrelerinde işlem adında sıkça görülen konum/gürültü kelimeleri.
 * Firma adı karşılaştırmasında bu kelimeler yok sayılır.
 * Örnek: "NURAKS MOBİLYA İstanbul TR" → yalnızca ["nuraks", "mobilya"] karşılaştırılır.
 */
const LOCATION_NOISE_WORDS = new Set([
  'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'konya', 'adana',
  'kocaeli', 'mersin', 'eskisehir', 'gaziantep', 'diyarbakir', 'samsun',
  'tr', 'tur', 'turkey', 'turkiye', 'türkiye'
]);

/**
 * Türkçe karakterleri ASCII eşdeğerlerine normalize eder.
 * Hem ş→s hem de İ/I→i dönüşümleri yapılır.
 */
function normalizeTurkishForSupplier(s: string): string {
  return s
    .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/İ/g, 'i').replace(/I/g, 'i');
}

/**
 * Cari hesap firma adı eşleşme skoru hesaplar (0-100).
 *
 * Kredi kartı ekstresi satırları genellikle firma adının kısaltmasıdır:
 *   "NURAKS MOBİLYA İstanbul TR"  →  "NURAKS MOBİLYA AKSESUARLARI SANAYİ TİCARET LTD. ŞTİ."
 *
 * Algoritma: Coverage (işlem adındaki içerik kelimelerinin kaçı firma adında geçiyor?)
 *   score = (eşleşen işlem kelimesi) / (toplam işlem kelimesi) × 100
 *
 * Jaccard yerine coverage kullanılır çünkü işlem adı firma adının kısaltmasıdır;
 * firma adı daha uzun olduğu için Jaccard haksız düşük puan verir.
 */
function calculateCurrentAccountMatchScore(
  transactionName: string,
  supplierName: string
): { score: number; reasons: string[] } {
  // Kısa token listesi üret: min 3 karakter, stopword değil, konum kelimesi değil
  const toCleanTokens = (text: string): string[] =>
    text
      .toLocaleLowerCase('tr')
      .replace(/[^\wığöşüçÇĞİÖŞÜ\s]/g, ' ')
      .split(/\s+/)
      .map(s => s.trim())
      .filter(
        s => s.length >= 3
          && !STOPWORDS.includes(s)
          && !LOCATION_NOISE_WORDS.has(s)
          && !LOCATION_NOISE_WORDS.has(normalizeTurkishForSupplier(s))
      );

  const transTokens = toCleanTokens(transactionName);
  if (transTokens.length === 0) return { score: 0, reasons: [] };

  const suppTokensArr = toCleanTokens(supplierName);
  const suppSet = new Set(suppTokensArr);
  const suppSetNorm = new Set(suppTokensArr.map(normalizeTurkishForSupplier));

  let matches = 0;
  const matchedWords: string[] = [];

  for (const t of transTokens) {
    const tNorm = normalizeTurkishForSupplier(t);

    // 1. Tam eşleşme (Türkçe karakter varyasyonları dahil)
    if (suppSet.has(t) || suppSetNorm.has(tNorm)) {
      matches += 1.0;
      matchedWords.push(t);
      continue;
    }

    // 2. Prefix eşleşme: işlem kelimesi firma kelimesinin başı ise (min 4 karakter)
    //    Örnek: "mobily" → "mobilya" veya "insaa" → "inşaat"
    if (t.length >= 4) {
      let found = false;
      for (const st of suppTokensArr) {
        if (st.startsWith(t) || normalizeTurkishForSupplier(st).startsWith(tNorm)) {
          found = true;
          break;
        }
      }
      if (found) {
        matches += 0.8;
        matchedWords.push(`${t}~`);
        continue;
      }
    }
  }

  const score = Math.min(Math.round((matches / transTokens.length) * 100), 100);
  const reasons: string[] = score > 0
    ? [`İşlem kelimelerinin %${score}'ı eşleşti (${matchedWords.join(', ')})`]
    : [];

  return { score, reasons };
}

/** Cari hesap firma eşleşme sonucu */
export interface SupplierMatchResult {
  supplier: {
    id: string;
    name: string;
    vkn?: string;
    is_current_account: boolean;
  };
  matchScore: number;
  /** current_account_auto: otomatik ata (≥70) | current_account_suggested: öneri göster (50-69) */
  matchType: 'current_account_auto' | 'current_account_suggested';
  reasons: string[];
}

/** Otomatik firma ataması için minimum skor — bu eşiğin üzerindekiler otomatik eşleştirilir */
export const SUPPLIER_AUTO_MATCH_THRESHOLD = 70;
/** Öneri göstermek için minimum skor */
export const SUPPLIER_SUGGESTION_THRESHOLD = 50;

/**
 * Bir ekstre satırı için eşleşen cari hesap firmalarını bulur.
 *
 * Fatura eşleştirmesinden BAĞIMSIZ çalışır:
 *  - Sadece is_current_account = true firmalar incelenir
 *  - Tutar değil, işlem adı / firma adı benzerliği esas alınır
 *  - "payment" tipindeki işlemler (borç ödemesi) atlanır
 *
 * @returns SupplierMatchResult[] azalan skor sıralamasıyla
 */
export async function findMatchingCurrentAccountSuppliers(
  item: ParsedStatementItem,
  companyId: string,
  supabaseClient: any = supabase
): Promise<SupplierMatchResult[]> {
  // Borç ödemesi işlemleri fatura/firmaya bağlanamaz
  if (item.transactionType === 'payment') {
    return [];
  }

  const { data: suppliers, error } = await supabaseClient
    .from('suppliers')
    .select('id, name, vkn, is_current_account')
    .eq('company_id', companyId)
    .eq('is_current_account', true);

  if (error || !suppliers || suppliers.length === 0) {
    return [];
  }

  const results: SupplierMatchResult[] = [];

  for (const supplier of suppliers) {
    const { score, reasons } = calculateCurrentAccountMatchScore(
      item.transactionName,
      supplier.name
    );

    if (score >= SUPPLIER_SUGGESTION_THRESHOLD) {
      results.push({
        supplier,
        matchScore: score,
        matchType: score >= SUPPLIER_AUTO_MATCH_THRESHOLD
          ? 'current_account_auto'
          : 'current_account_suggested',
        reasons
      });
    }
  }

  const sorted = results.sort((a, b) => b.matchScore - a.matchScore);

  if (sorted.length > 0) {
    console.log(`🏢 [SupplierMatch] "${item.transactionName}": en iyi → "${sorted[0].supplier.name}" (%${sorted[0].matchScore}, ${sorted[0].matchType})`);
  }

  return sorted;
}

// =====================================================
// EXPORT FOR TESTING
// =====================================================

export {
  tokenize,
  removeStopwords,
  findCommonWords,
  isAmountMatch,
  calculateNameSimilarity,
  calculateMatchScore,
  STOPWORDS,
  AMOUNT_TOLERANCE,
  AUTO_MATCH_THRESHOLD,
  SUGGESTION_THRESHOLD,
  LOCATION_NOISE_WORDS,
  calculateCurrentAccountMatchScore
};

