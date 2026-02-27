/**
 * Debug script to analyze ELMAS OTOMOTİV matching issue
 * 
 * Harcama: ELMAS OTOMOTİV İNŞ.SAN.Tİ İSTANBUL TR - ₺24.270,88 - 18.02.2026
 * Fatura: FY22026000002148
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Try to load .env.local first, then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Environment variables missing!');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Inline helper functions to avoid import issues
const STOPWORDS = [
  'ltd', 'şti', 'a.ş', 'as', 'anonim', 'limited', 'şirketi',
  've', 'veya', 'ile', 'için', 'ise', 'de', 'da', 'den', 'dan', 'bir', 'bu', 'şu', 'o'
];

const ABBREVIATIONS: Record<string, string[]> = {
  'inş': ['inşaat', 'inş'],
  'san': ['sanayi', 'san'],
  'tic': ['ticaret', 'tic'],
  'ti': ['ticaret', 'ti'],
  'ltd': ['limited', 'ltd'],
  'şti': ['şirketi', 'şti'],
  'paz': ['pazarlama', 'paz'],
  'ith': ['ithalat', 'ith'],
  'ihr': ['ihracat', 'ihr'],
  'elk': ['elektronik', 'elk'],
  'oto': ['otomotiv', 'oto'],
  'end': ['endüstri', 'end'],
  'müh': ['mühendislik', 'müh']
};

function tokenize(text: string): string[] {
  if (!text) return [];
  
  let cleaned = text
    .toLocaleLowerCase('tr')  // Türkçe locale ile küçült (İ → i)
    .replace(/[^\wÇĞİÖŞÜçğıöşü\s]/g, ' ');
  
  const tokens = cleaned
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 0);
  
  const expanded: string[] = [];
  for (const token of tokens) {
    if (token.length === 1) continue;
    
    expanded.push(token);
    
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

function removeStopwords(tokens: string[]): string[] {
  return tokens.filter(token => !STOPWORDS.includes(token));
}

function findCommonWords(
  tokens1: string[], 
  tokens2: string[], 
  allowPartial: boolean = true
): { exact: string[]; partial: string[] } {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  const exact = tokens1.filter(token => set2.has(token));
  
  if (!allowPartial) {
    return { exact, partial: [] };
  }
  
  const partial: string[] = [];
  const partialMatches = new Set<string>();
  
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
      }
    }
  }
  
  return { exact, partial };
}

function calculateNameSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;
  
  const tokens1 = tokenize(name1);
  const tokens2 = tokenize(name2);
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

async function debugElmasMatch() {
  console.log('🔍 ELMAS OTOMOTİV Eşleştirme Analizi');
  console.log('=====================================\n');

  try {
    // 1. Faturayı bul
    console.log('1️⃣ Fatura bilgilerini getir...');
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('invoice_number', 'FY22026000002148')
      .single();

    if (invoiceError || !invoice) {
      console.error('❌ Fatura bulunamadı:', invoiceError);
      
      // Fatura numarasının bir kısmıyla ara
      console.log('\n🔍 Benzer fatura numaraları aranıyor...');
      const { data: similarInvoices } = await supabase
        .from('invoices')
        .select('invoice_number, supplier_name, amount, invoice_date')
        .ilike('invoice_number', '%2148%')
        .limit(10);
      
      console.log('Benzer faturalar:', similarInvoices);
      return;
    }

    console.log('✅ Fatura bulundu:');
    console.log('   ID:', invoice.id);
    console.log('   Fatura No:', invoice.invoice_number);
    console.log('   Tedarikçi:', invoice.supplier_name);
    console.log('   Tutar:', invoice.amount, 'TL');
    console.log('   Tarih:', invoice.invoice_date);
    console.log('   Company ID:', invoice.company_id);

    // 2. Statement'ı bul
    console.log('\n2️⃣ Card statement items içinde ELMAS OTOMOTİV aranıyor...');
    const { data: items, error: itemsError } = await supabase
      .from('card_statement_items')
      .select(`
        *,
        card_statements!inner(company_id)
      `)
      .eq('card_statements.company_id', invoice.company_id)
      .ilike('transaction_name', '%ELMAS%')
      .gte('amount', -25000)
      .lte('amount', -24000)
      .order('transaction_date', { ascending: false });

    if (itemsError || !items || items.length === 0) {
      console.error('❌ ELMAS OTOMOTİV harcaması bulunamadı:', itemsError);
      
      // Daha geniş arama
      console.log('\n🔍 Daha geniş arama yapılıyor (tüm ELMAS harcamaları)...');
      const { data: allElmas } = await supabase
        .from('card_statement_items')
        .select('transaction_name, amount, transaction_date, card_statement_id')
        .ilike('transaction_name', '%ELMAS%')
        .limit(20);
      
      console.log('Bulunan ELMAS harcamaları:', allElmas);
      return;
    }

    console.log(`✅ ${items.length} adet ELMAS harcaması bulundu\n`);

    // Her bir harcama için analiz yap
    for (const item of items) {
      console.log('─────────────────────────────────────');
      console.log('📋 Harcama Detayı:');
      console.log('   ID:', item.id);
      console.log('   İsim:', item.transaction_name);
      console.log('   Tutar:', item.amount, 'TL (mutlak:', Math.abs(item.amount), ')');
      console.log('   Tarih:', item.transaction_date);
      console.log('   Eşleşmiş mi?:', item.is_matched);

      // ParsedStatementItem formatına çevir
      const parsedItem: ParsedStatementItem = {
        rowNumber: item.row_number,
        transactionName: item.transaction_name,
        amount: item.amount,
        currency: item.currency,
        transactionDate: item.transaction_date,
        transactionType: item.transaction_type || 'expense',
        cardLastFour: item.card_last_four,
        fullCardNumber: item.full_card_number,
        cardHolderName: item.card_holder_name,
        description: item.description,
        isInstallment: item.is_installment || false,
        installmentCurrent: item.installment_current,
        installmentTotal: item.installment_total,
        installmentTotalAmount: item.installment_total_amount,
        rawData: item.raw_data
      };

      // 3. İsim benzerliği analizi
      console.log('\n🏢 İsim Benzerliği Analizi (GELİŞMİŞ ALGORITMA):');
      console.log('   Harcama:', item.transaction_name);
      console.log('   Fatura:', invoice.supplier_name);
      
      const itemTokens = tokenize(item.transaction_name);
      const invoiceTokens = tokenize(invoice.supplier_name);
      console.log('   Harcama tokens (genişletilmiş):', itemTokens);
      console.log('   Fatura tokens (genişletilmiş):', invoiceTokens);
      
      const itemCleaned = removeStopwords(itemTokens);
      const invoiceCleaned = removeStopwords(invoiceTokens);
      console.log('   Harcama (temizlenmiş):', itemCleaned);
      console.log('   Fatura (temizlenmiş):', invoiceCleaned);
      
      const commonWords = findCommonWords(itemCleaned, invoiceCleaned, true);
      console.log('   🎯 Tam eşleşen kelimeler:', commonWords.exact);
      console.log('   🔍 Kısmi eşleşen kelimeler:', commonWords.partial);
      
      const similarity = calculateNameSimilarity(item.transaction_name, invoice.supplier_name);
      console.log('   ✨ TOPLAM Benzerlik skoru:', similarity, '%', '(ESKİ: ~21%)');


      // 4. Tutar karşılaştırması
      console.log('\n💰 Tutar Karşılaştırması:');
      const itemAmount = Math.abs(item.amount);
      const diff = Math.abs(itemAmount - invoice.amount);
      console.log('   Harcama tutarı:', itemAmount, 'TL');
      console.log('   Fatura tutarı:', invoice.amount, 'TL');
      console.log('   Fark:', diff.toFixed(2), 'TL');
      console.log('   Eşleşme?:', diff <= 0.01 ? '✅ EVET' : '❌ HAYIR');

      // 5. Tarih karşılaştırması
      console.log('\n📅 Tarih Karşılaştırması:');
      console.log('   Harcama tarihi:', item.transaction_date);
      console.log('   Fatura tarihi:', invoice.invoice_date);
      
      if (item.transaction_date && invoice.invoice_date) {
        const date1 = new Date(item.transaction_date);
        const date2 = new Date(invoice.invoice_date);
        const diffTime = Math.abs(date2.getTime() - date1.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        console.log('   Gün farkı:', diffDays, 'gün');
        
        // Tarih skoru hesaplama
        let dateScore = 0;
        if (diffDays === 0) {
          dateScore = 20;
        } else if (diffDays <= 3) {
          dateScore = 15;
        }
        console.log('   Tarih skoru:', dateScore, '/20');
      }

      // 6. Manuel skor hesaplama
      console.log('\n🎯 Manuel Skor Hesaplama (Algoritma Simülasyonu):');
      let totalScore = 0;
      const reasons = [];
      
      // Tutar skoru (40 puan)
      if (diff <= 0.01) {
        totalScore += 40;
        reasons.push('✅ Tutar birebir eşleşti (+40 puan)');
      }
      
      // İsim skoru (40 puan)
      const nameScore = Math.round(similarity * 0.4);
      totalScore += nameScore;
      reasons.push(`🏢 Firma adı benzerliği: ${similarity}% (+${nameScore} puan)`);
      
      // Tarih skoru (20 puan)
      if (item.transaction_date && invoice.invoice_date) {
        const date1 = new Date(item.transaction_date);
        const date2 = new Date(invoice.invoice_date);
        const diffTime = Math.abs(date2.getTime() - date1.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        let dateScore = 0;
        if (diffDays === 0) {
          dateScore = 20;
          reasons.push('📅 Tarihler aynı gün (+20 puan)');
        } else if (diffDays <= 3) {
          dateScore = 15;
          reasons.push(`📅 Tarih farkı ${diffDays} gün (+15 puan)`);
        } else {
          reasons.push(`📅 Tarih farkı ${diffDays} gün (+0 puan - çok uzak)`);
        }
        totalScore += dateScore;
      }
      
      console.log('   Toplam skor:', totalScore, '/100');
      console.log('   Detaylar:');
      reasons.forEach(r => console.log('      ', r));
      
      console.log('\n📊 Sonuç:');
      if (totalScore >= 80) {
        console.log('   ✅ OTOMATIK EŞLEŞTİRME (≥80)');
      } else if (totalScore >= 50) {
        console.log('   💡 ÖNERİ GÖSTERİLECEK (50-79)');
      } else if (totalScore >= 35) {
        console.log('   ⚠️  DÜŞÜK SKOR AMA YENİ THRESHOLD İLE YAKALANACAK (35-49)');
      } else {
        console.log('   ❌ EŞLEŞTİRME YOK (<35)');
      }

      console.log('\n');
    }

  } catch (error) {
    console.error('❌ Hata:', error);
  }
}

// Run
debugElmasMatch().then(() => {
  console.log('\n✅ Analiz tamamlandı');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
