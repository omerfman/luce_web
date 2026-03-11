/**
 * INTEMA VITRA - Gerçek API Testi
 * 
 * Gerçek findMatchingInvoices fonksiyonunu kullanarak test eder
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { findMatchingInvoices } from '../lib/statement-matcher';
import type { ParsedStatementItem } from '../lib/excel-parser';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Environment variables missing!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRealMatching() {
  console.log('🧪 INTEMA VITRA - Gerçek Eşleştirme Testi\n');
  console.log('═'.repeat(80));
  
  // INTEMA VITRA harcaması
  const item: ParsedStatementItem = {
    rowNumber: 9,
    transactionName: 'INTEMA VITRA-CALIKLAR MAR İSTANBUL',
    amount: 1646.66,
    currency: 'TRY',
    transactionDate: '2026-01-14',
    transactionType: 'expense',
    cardLastFour: '1234',
    isInstallment: true,
    installmentCurrent: 2,
    installmentTotal: 3,
    installmentTotalAmount: 4939.98,
    rawData: {}
  };
  
  console.log('\n📋 HARCAMA:');
  console.log(`   • İşlem Adı: "${item.transactionName}"`);
  console.log(`   • Tutar: ${item.amount} TL (${item.installmentCurrent}/${item.installmentTotal} taksit)`);
  console.log(`   • Toplam: ${item.installmentTotalAmount} TL`);
  console.log(`   • Tarih: ${item.transactionDate}\n`);
  
  // Company ID al (ilk company'yi kullan)
  console.log('🏢 Şirket bilgisi alınıyor...');
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .limit(1);
  
  if (!companies || companies.length === 0) {
    console.error('❌ Şirket bulunamadı!');
    return;
  }
  
  const companyId = companies[0].id;
  console.log(`   ✅ Şirket: ${companies[0].name} (${companyId})\n`);
  
  // CAL2025000003998 faturasını bul
  console.log('📄 CAL2025000003998 faturası kontrol ediliyor...');
  const { data: invoiceCheck } = await supabase
    .from('invoices')
    .select('id, invoice_number, amount, supplier_name')
    .eq('invoice_number', 'CAL2025000003998')
    .maybeSingle();
  
  if (invoiceCheck) {
    console.log(`   ✅ Fatura bulundu!`);
    console.log(`      • Tutar: ${invoiceCheck.amount} TL`);
    console.log(`      • Tedarikçi: ${invoiceCheck.supplier_name || '(yok)'}\n`);
  } else {
    console.log('   ❌ Fatura bulunamadı!\n');
  }
  
  console.log('═'.repeat(80));
  console.log('🔍 FİNDMATCHINGINVOICES ÇAĞRILIYOR...\n');
  
  try {
    const matchResults = await findMatchingInvoices(item, companyId, supabase);
    
    console.log('═'.repeat(80));
    console.log('📊 SONUÇLAR\n');
    
    console.log(`✅ Exact Matches: ${matchResults.exact.length}`);
    if (matchResults.exact.length > 0) {
      matchResults.exact.forEach((match, index) => {
        console.log(`\n   ${index + 1}. ${match.invoice.invoice_number}`);
        console.log(`      • Tedarikçi: ${match.invoice.supplier_name}`);
        console.log(`      • Tutar: ${match.invoice.amount} TL`);
        console.log(`      • Skor: ${match.matchScore}/100`);
        console.log(`      • Sebepler: ${match.reasons.join(', ')}`);
      });
    }
    
    console.log(`\n⚠️  Suggested Matches: ${matchResults.suggested.length}`);
    if (matchResults.suggested.length > 0) {
      matchResults.suggested.forEach((match, index) => {
        console.log(`\n   ${index + 1}. ${match.invoice.invoice_number}`);
        console.log(`      • Tedarikçi: ${match.invoice.supplier_name}`);
        console.log(`      • Tutar: ${match.invoice.amount} TL`);
        console.log(`      • Skor: ${match.matchScore}/100`);
        console.log(`      • Sebepler: ${match.reasons.join(', ')}`);
      });
    }
    
    console.log(`\n❌ No Match: ${matchResults.noMatch}\n`);
    
    console.log('═'.repeat(80));
    console.log('🎓 SONUÇ\n');
    
    // CAL2025000003998 sonuçlarda var mı?
    const calInvoice = [...matchResults.exact, ...matchResults.suggested]
      .find(m => m.invoice.invoice_number === 'CAL2025000003998');
    
    if (calInvoice) {
      console.log('✅ CAL2025000003998 BULUNDU!');
      console.log(`   • Skor: ${calInvoice.matchScore}/100`);
      console.log(`   • Tip: ${calInvoice.matchType}`);
      console.log(`   • Sebepler: ${calInvoice.reasons.join(', ')}\n`);
      
      if (calInvoice.matchScore < 40) {
        console.log('⚠️  Ancak skor threshold altında (< 40)');
        console.log('   → UI\'da görüntülenmeyecek!\n');
      } else if (calInvoice.matchScore < 80) {
        console.log('✅ Skor yeterli! (40-79)');
        console.log('   → UI\'da "Suggested Matches" bölümünde görünecek\n');
      } else {
        console.log('✅ Skor çok iyi! (≥ 80)');
        console.log('   → UI\'da "Exact Matches" bölümünde görünecek\n');
      }
    } else {
      console.log('❌ CAL2025000003998 SONUÇLARDA YOK!');
      console.log('\n💡 Muhtemel Sebepler:');
      console.log('   1. Fatura aralık dışında ([4839.98 - 5039.98] TL)');
      console.log('   2. Fatura zaten başka harcamayla eşleştirilmiş');
      console.log('   3. Skor çok düşük (< SUGGESTION_THRESHOLD)\n');
      
      if (invoiceCheck) {
        const amountDiff = Math.abs(item.installmentTotalAmount! - invoiceCheck.amount);
        console.log(`   → Tutar kontrolü: ${amountDiff.toFixed(2)} TL fark`);
        
        if (amountDiff > 100) {
          console.log('   ❌ Tutar aralık DIŞINDA! (±100 TL tolerans)');
        } else {
          console.log('   ✅ Tutar aralık içinde');
          console.log('   → Muhtemelen EŞLEŞTİRİLMİŞ veya SKOR DÜŞÜK\n');
        }
      }
    }
    
  } catch (error: any) {
    console.error('\n❌ HATA:', error.message);
    console.error(error);
  }
}

testRealMatching()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
