/**
 * INTEMA VITRA Skorlama Testi
 * 
 * Bu harcama neden CAL2025000003998 ile eşleşmiyor?
 */

// ===== INLINE FUNCTIONS (lib/statement-matcher.ts'den kopyalandı) =====

interface ParsedStatementItem {
  rowNumber: number;
  transactionName: string;
  amount: number;
  currency: string;
  transactionDate: string;
  transactionType?: 'expense' | 'payment';
  isInstallment?: boolean;
  installmentCurrent?: number;
  installmentTotal?: number;
  installmentTotalAmount?: number;
  rawData: any;
}

interface Invoice {
  id: string;
  amount: number;
  supplier_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  created_at?: string;
  file_path?: string;
}

const STOPWORDS = [
  'ltd', 'şti', 'a.ş', 'as', 'anonim', 'limited', 'şirketi',
  've', 'veya', 'ile', 'için', 'ise', 'de', 'da', 'den', 'dan',
  'bir', 'bu', 'şu', 'o'
];

const ABBREVIATIONS: Record<string, string[]> = {
  'inş': ['inşaat', 'inş', 'insaat'],
  'ins': ['inşaat', 'insaat', 'ins'],
  'insaa': ['inşaat', 'insaat'],
  'insaat': ['inşaat', 'insaat'],
  'san': ['sanayi', 'sanayi', 'san'],
  'tic': ['ticaret', 'ticaret', 'tic'],
  'ti': ['ticaret', 'ticaret', 'ti'],
  'ltd': ['limited', 'ltd'],
  'şti': ['şirketi', 'şti', 'sti'],
  'sti': ['şirketi', 'sti'],
};

const AMOUNT_TOLERANCE = 0.01;

function getMatchingAmount(item: ParsedStatementItem): number {
  if (!item.isInstallment) {
    return Math.abs(item.amount);
  }
  
  if (item.installmentTotalAmount && item.installmentTotalAmount > 0) {
    return item.installmentTotalAmount;
  }
  
  if (item.installmentTotal && item.installmentTotal > 1) {
    return Math.abs(item.amount) * item.installmentTotal;
  }
  
  return Math.abs(item.amount);
}

function isAmountMatch(amount1: number, amount2: number): boolean {
  return Math.abs(amount1 - Math.abs(amount2)) <= AMOUNT_TOLERANCE;
}

function amountDifference(amount1: number, amount2: number): number {
  return Math.abs(amount1 - Math.abs(amount2));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

function expandAbbreviations(tokens: string[]): string[] {
  const expanded: string[] = [];
  
  for (const token of tokens) {
    expanded.push(token);
    
    const expansions = ABBREVIATIONS[token];
    if (expansions) {
      for (const exp of expansions) {
        if (exp !== token) {
          expanded.push(exp);
        }
      }
    }
  }
  
  return expanded;
}

function removeStopwords(tokens: string[]): string[] {
  return tokens.filter(token => !STOPWORDS.includes(token));
}

function findCommonWords(
  tokens1: string[], 
  tokens2: string[], 
  allowPartial: boolean = true
): { exact: string[]; partial: string[] } {
  const set2 = new Set(tokens2);
  const exact = tokens1.filter(token => set2.has(token));
  
  if (!allowPartial) {
    return { exact, partial: [] };
  }
  
  const partial: string[] = [];
  const partialMatches = new Set<string>();
  
  const normalizeTurkish = (text: string) => 
    text.replace(/ş/g, 's')
        .replace(/ğ/g, 'g')
        .replace(/ı/g, 'i')
        .replace(/ü/g, 'u')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');
  
  for (const token1 of tokens1) {
    if (exact.includes(token1)) continue;
    
    for (const token2 of tokens2) {
      if (exact.includes(token2)) continue;
      
      const longer = token1.length > token2.length ? token1 : token2;
      const shorter = token1.length > token2.length ? token2 : token1;
      
      if (shorter.length >= 3 && longer.startsWith(shorter)) {
        const matchKey = `${shorter}-${longer}`;
        if (!partialMatches.has(matchKey)) {
          partial.push(shorter);
          partialMatches.add(matchKey);
        }
        continue;
      }
      
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

function calculateNameSimilarity(name1: string, name2: string): number {
  const tokens1 = expandAbbreviations(tokenize(name1));
  const tokens2 = expandAbbreviations(tokenize(name2));
  
  const cleaned1 = removeStopwords(tokens1);
  const cleaned2 = removeStopwords(tokens2);
  
  if (cleaned1.length === 0 || cleaned2.length === 0) return 0;
  
  const commonWords = findCommonWords(cleaned1, cleaned2, true);
  
  const exactCount = commonWords.exact.length;
  const partialCount = commonWords.partial.length;
  const weightedMatches = exactCount + (partialCount * 0.7);
  
  const union = new Set([...cleaned1, ...cleaned2]);
  const similarity = weightedMatches / union.size;
  
  return Math.min(Math.round(similarity * 100), 100);
}

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
    
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
      return { score: 0, reason: '' };
    }
    
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
    return { score: 0, reason: '' };
  }
}

function calculateMatchScore(
  item: ParsedStatementItem,
  invoice: Invoice
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  
  const matchingAmount = getMatchingAmount(item);
  
  // 1. Tutar (40 puan + 16 kısmi)
  const amountMatch = isAmountMatch(matchingAmount, invoice.amount);
  if (amountMatch) {
    score += 40;
    const reason = item.isInstallment 
      ? `Tutar eşleşti (${item.installmentCurrent}/${item.installmentTotal} taksit toplamı)`
      : 'Tutar birebir eşleşti';
    reasons.push(reason);
  } else {
    const diff = amountDifference(matchingAmount, invoice.amount);
    const maxDiff = Math.max(matchingAmount, Math.abs(invoice.amount)) * 0.1;
    
    if (diff < maxDiff) {
      const partialScore = Math.round((1 - diff / maxDiff) * 16);
      score += partialScore;
      reasons.push(`Tutar yakın (fark: ${diff.toFixed(2)} TL)`);
    }
  }
  
  // 2. Firma adı (40 puan)
  if (invoice.supplier_name) {
    const nameSimilarity = calculateNameSimilarity(
      item.transactionName,
      invoice.supplier_name
    );
    
    const nameScore = Math.round(nameSimilarity * 0.4);
    score += nameScore;
    
    if (nameScore > 0) {
      reasons.push(`Firma adı benzerliği: %${nameSimilarity}`);
    }
  }
  
  // 3. Tarih (20 puan)
  if (item.transactionDate && invoice.invoice_date) {
    const dateScore = calculateDateProximityScore(item.transactionDate, invoice.invoice_date);
    score += dateScore.score;
    
    if (dateScore.score > 0) {
      reasons.push(dateScore.reason);
    }
  }
  
  return { score: Math.min(score, 100), reasons };
}

// ===== TEST =====

async function testScore() {
  console.log('🧪 INTEMA VITRA Skorlama Testi\n');
  console.log('═'.repeat(80));
  
  const item: ParsedStatementItem = {
    rowNumber: 9,
    transactionName: 'INTEMA VITRA-CALIKLAR MAR İSTANBUL',
    amount: 1646.66,
    currency: 'TRY',
    transactionDate: '2026-01-14',
    transactionType: 'expense',
    isInstallment: true,
    installmentCurrent: 2,
    installmentTotal: 3,
    installmentTotalAmount: 4939.98,
    rawData: {}
  };
  
  const invoice = {
    id: 'b8ed9b1f-d721-471f-aad9-c5f0676bbbbc',
    invoice_number: 'CAL2025000003998',
    amount: 4939.99,
    supplier_name: 'ÇALIKLAR İNŞAAT YAPI MALZEMELERİ SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
    invoice_date: '2025-12-07',
    file_path: '',
    created_at: '2026-01-03'
  };
  
  console.log('\n📋 HARCAMA:');
  console.log(`   • İşlem Adı: "${item.transactionName}"`);
  console.log(`   • Tutar: ${item.amount} TL`);
  console.log(`   • Taksit: ${item.installmentCurrent}/${item.installmentTotal}`);
  console.log(`   • Toplam: ${item.installmentTotalAmount} TL`);
  console.log(`   • Tarih: ${item.transactionDate}`);
  
  console.log('\n📄 FATURA:');
  console.log(`   • Fatura No: ${invoice.invoice_number}`);
  console.log(`   • Tedarikçi: "${invoice.supplier_name}"`);
  console.log(`   • Tutar: ${invoice.amount} TL`);
  console.log(`   • Tarih: ${invoice.invoice_date}`);
  
  console.log('\n' + '═'.repeat(80));
  console.log('🎯 SKOR HESAPLAMA\n');
  
  const { score, reasons } = calculateMatchScore(item, invoice);
  
  console.log(`📊 TOPLAM SKOR: ${score}/100`);
  console.log(`\n📝 Sebepler:`);
  reasons.forEach((reason, index) => {
    console.log(`   ${index + 1}. ${reason}`);
  });
  
  console.log('\n' + '═'.repeat(80));
  console.log('💡 ANALİZ\n');
  
  if (score >= 80) {
    console.log('✅ OTOMATIK EŞLEŞTİRME (Score ≥ 80)');
    console.log('   → Sistem otomatik eşleştirmeyi önerecek\n');
  } else if (score >= 40) {
    console.log('⚠️  ÖNERİ OLARAK GÖSTERİLECEK (40 ≤ Score < 80)');
    console.log('   → Kullanıcı manuel seçim yapabilir\n');
  } else {
    console.log('❌ EŞLEŞTİRME ÖNERİLMEYECEK (Score < 40)');
    console.log('   → Skor threshold altında!\n');
  }
  
  // Name matching detaylı analiz
  console.log('🔍 FİRMA ADI DETAY ANALİZİ:\n');
  
  const tokens1 = tokenize(item.transactionName);
  const tokens2 = tokenize(invoice.supplier_name);
  const expanded1 = expandAbbreviations(tokens1);
  const expanded2 = expandAbbreviations(tokens2);
  const cleaned1 = removeStopwords(expanded1);
  const cleaned2 = removeStopwords(expanded2);
  
  console.log(`   1. Tokenize:`);
  console.log(`      Harcama: [${tokens1.join(', ')}]`);
  console.log(`      Fatura: [${tokens2.slice(0, 8).join(', ')}...]\n`);
  
  console.log(`   2. Genişletme (ABBREVIATIONS):`);
  console.log(`      Harcama: [${expanded1.join(', ')}]`);
  console.log(`      Fatura: [${expanded2.slice(0, 10).join(', ')}...]\n`);
  
  console.log(`   3. Stopwords Temizleme:`);
  console.log(`      Harcama: [${cleaned1.join(', ')}]`);
  console.log(`      Fatura: [${cleaned2.join(', ')}]\n`);
  
  const commonWords = findCommonWords(cleaned1, cleaned2, true);
  
  console.log(`   4. Ortak Kelimeler:`);
  console.log(`      Tam eşleşme: [${commonWords.exact.join(', ')}]`);
  console.log(`      Kısmi eşleşme: [${commonWords.partial.join(', ')}]\n`);
  
  const exactCount = commonWords.exact.length;
  const partialCount = commonWords.partial.length;
  const union = new Set([...cleaned1, ...cleaned2]);
  
  console.log(`   5. Similarity Hesaplama:`);
  console.log(`      Tam eşleşme sayısı: ${exactCount}`);
  console.log(`      Kısmi eşleşme sayısı: ${partialCount}`);
  console.log(`      Weighted matches: ${exactCount} + (${partialCount} × 0.7) = ${exactCount + partialCount * 0.7}`);
  console.log(`      Union size: ${union.size}`);
  console.log(`      Similarity: ${((exactCount + partialCount * 0.7) / union.size * 100).toFixed(2)}%\n`);
  
  // Tutar analizi
  console.log('💰 TUTAR ANALİZİ:\n');
  const matchingAmount = getMatchingAmount(item);
  const amountDiff = amountDifference(matchingAmount, invoice.amount);
  console.log(`   Eşleşecek tutar: ${matchingAmount} TL`);
  console.log(`   Fatura tutarı: ${invoice.amount} TL`);
  console.log(`   Fark: ${amountDiff.toFixed(2)} TL`);
  
  if (isAmountMatch(matchingAmount, invoice.amount)) {
    console.log('   ✅ TUTAR EŞLEŞİYOR! (+40 puan)\n');
  } else {
    const maxDiff = Math.max(matchingAmount, Math.abs(invoice.amount)) * 0.1;
    const partialScore = Math.round((1 - amountDiff / maxDiff) * 16);
    console.log(`   ⚠️  Tutar tam eşleşmiyor (+${partialScore} puan)\n`);
  }
  
  // Tarih analizi
  console.log('📅 TARİH ANALİZİ:\n');
  const dateScore = calculateDateProximityScore(item.transactionDate, invoice.invoice_date);
  console.log(`   Harcama tarihi: ${item.transactionDate}`);
  console.log(`   Fatura tarihi: ${invoice.invoice_date}`);
  console.log(`   Skor: ${dateScore.score} puan`);
  console.log(`   ${dateScore.reason || '(Tarih farkı çok büyük)'}\n`);
  
  console.log('═'.repeat(80));
  console.log('\n🎓 SONUÇ:\n');
  
  if (score < 40) {
    console.log('❌ Eşleştirme ÖNERİLMEDİ (Score < 40)');
    console.log('\n💡 SORUN:');
    console.log('   • Firma adı benzerliği çok düşük');
    console.log('   • "INTEMA VITRA" kelimeleri faturada yok');
    console.log('   • Sadece "ÇALIKLAR" kelimesi ortak\n');
    
    console.log('✅ ÇÖZÜMLERexpresultionsresultsultsSULTSLER:');
    console.log('   1. Fatura tedarikçi adına "INTEMA VİTRA" ekleyin');
    console.log('   2. ABBREVIATIONS\'a ekleyin: "vitra": ["çaliklar"]');
    console.log('   3. Threshold değerini düşürün (SUGGESTION_THRESHOLD: 40 → 30)\n');
  } else if (score < 80) {
    console.log('✅ Eşleştirme ÖNERİ olarak gösterilecek! (40 ≤ Score < 80)');
    console.log('   → UI\'da suggestion listesinde görünür\n');
  } else {
    console.log('✅ Otomatik eşleştirme yapılacak! (Score ≥ 80)\n');
  }
}

testScore().catch(console.error);

