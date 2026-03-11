/**
 * CAL2025000003998 Faturası Kontrolü
 * 
 * Bu faturanın:
 * - Tutarını
 * - Tedarikçi adını
 * - Eşleşme durumunu kontrol eder
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Try to load .env.local first, then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Environment variables missing!');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkInvoice() {
  console.log('🔍 CAL2025000003998 Faturası Kontrol Ediliyor...\n');
  
  // 1. Faturayı bul
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('invoice_number', 'CAL2025000003998')
    .maybeSingle();
  
  if (invoiceError) {
    console.error('❌ Error:', invoiceError);
    return;
  }
  
  if (!invoice) {
    console.log('❌ FATURA BULUNAMADI!');
    console.log('   ➡️  Belki fatura numarası yanlış girilmiş?');
    console.log('   ➡️  Veya fatura henüz sisteme yüklenmemiş?');
    return;
  }
  
  console.log('✅ Fatura Bulundu!\n');
  console.log('📋 Fatura Bilgileri:');
  console.log(`   • ID: ${invoice.id}`);
  console.log(`   • Fatura No: ${invoice.invoice_number}`);
  console.log(`   • Tutar: ${invoice.amount} ${invoice.currency || 'TRY'}`);
  console.log(`   • Tedarikçi: ${invoice.supplier_name || '(Yok)'}`);
  console.log(`   • Tarih: ${invoice.invoice_date || '(Yok)'}`);
  console.log(`   • Oluşturulma: ${new Date(invoice.created_at).toLocaleDateString('tr-TR')}\n`);
  
  // 2. Beklenen tutar
  const expectedAmount = 4939.98;
  const amountDiff = Math.abs(invoice.amount - expectedAmount);
  
  console.log('💰 Tutar Kontrolü:');
  console.log(`   • Beklenen: ${expectedAmount} TL (1.646,66 × 3 taksit)`);
  console.log(`   • Gerçek: ${invoice.amount} TL`);
  console.log(`   • Fark: ${amountDiff.toFixed(2)} TL`);
  
  if (amountDiff < 0.1) {
    console.log('   ✅ TUTAR DOĞRU!\n');
  } else if (amountDiff < 100) {
    console.log(`   ⚠️  Tutar tolerans içinde (±100 TL)\n`);
  } else {
    console.log(`   ❌ TUTAR EŞLEŞMİYOR! (Fark: ${amountDiff.toFixed(2)} TL)\n`);
  }
  
  // 3. Eşleşme kontrolü (bu fatura daha önce eşleştirilmiş mi?)
  const { data: matches, error: matchError } = await supabase
    .from('statement_invoice_matches')
    .select(`
      id,
      match_score,
      match_type,
      created_at,
      card_statement_items!inner (
        id,
        transaction_name,
        amount,
        is_installment,
        installment_current,
        installment_total
      )
    `)
    .eq('invoice_id', invoice.id);
  
  if (matchError) {
    console.log('⚠️  Eşleşme kontrolünde hata:', matchError.message);
  } else if (matches && matches.length > 0) {
    console.log('🔗 Eşleşme Durumu:');
    console.log(`   ⚠️  Bu fatura ZATEN ${matches.length} harcamayla eşleştirilmiş:\n`);
    
    matches.forEach((match: any, index: number) => {
      const item = match.card_statement_items;
      console.log(`   ${index + 1}. Eşleşme:`);
      console.log(`      • Harcama: ${item.transaction_name}`);
      console.log(`      • Tutar: ${item.amount} TL`);
      if (item.is_installment) {
        console.log(`      • Taksit: ${item.installment_current}/${item.installment_total}`);
      }
      console.log(`      • Skor: ${match.match_score}`);
      console.log(`      • Tip: ${match.match_type}`);
      console.log(`      • Tarih: ${new Date(match.created_at).toLocaleDateString('tr-TR')}\n`);
    });
    
    console.log('   ❗ Bu yüzden yeni eşleştirme yapılamıyor!\n');
  } else {
    console.log('🔗 Eşleşme Durumu:');
    console.log('   ✅ Fatura henüz eşleştirilmemiş (müsait)\n');
  }
  
  // 4. Firma adı benzerliği
  console.log('🏢 Firma Adı Kontrolü:');
  console.log(`   • Harcama: "INTEMA VITRA-CALIKLAR MAR"`);
  console.log(`   • Fatura: "${invoice.supplier_name || '(YOK)'}"`);
  
  if (!invoice.supplier_name || invoice.supplier_name.trim() === '') {
    console.log('   ❌ Faturada tedarikçi adı YOK!\n');
  } else {
    // Basit benzerlik kontrolü
    const expenseName = 'INTEMA VITRA-CALIKLAR MAR'.toLowerCase();
    const supplierName = invoice.supplier_name.toLowerCase();
    
    const hasIntema = supplierName.includes('intema');
    const hasVitra = supplierName.includes('vitra');
    const hasCaliklar = supplierName.includes('calik') || supplierName.includes('çalik');
    
    console.log(`   • "intema" geçiyor mu? ${hasIntema ? '✅' : '❌'}`);
    console.log(`   • "vitra" geçiyor mu? ${hasVitra ? '✅' : '❌'}`);
    console.log(`   • "çalıklar" geçiyor mu? ${hasCaliklar ? '✅' : '❌'}\n`);
    
    if (!hasIntema && !hasVitra && !hasCaliklar) {
      console.log('   ⚠️  Firma adı benzerliği DÜŞÜK olabilir!\n');
    }
  }
  
  // 5. Sonuç ve öneriler
  console.log('═'.repeat(60));
  console.log('📝 SONUÇ ve ÖNERİLER\n');
  
  if (!invoice) {
    console.log('1. ❌ Fatura sistemde bulunamadı');
    console.log('   → Fatura numarasını kontrol edin');
    console.log('   → Faturayı sisteme yükleyin\n');
  } else {
    let problemFound = false;
    
    if (amountDiff >= 100) {
      problemFound = true;
      console.log('1. ❌ Tutar eşleşmiyor');
      console.log(`   → Fatura tutarı: ${invoice.amount} TL`);
      console.log(`   → Beklenen: ${expectedAmount} TL`);
      console.log(`   → Farkı kontrol edin (belki KDV farkı?)\n`);
    }
    
    if (matches && matches.length > 0) {
      problemFound = true;
      console.log('2. ❌ Fatura zaten başka harcamayla eşleştirilmiş');
      console.log('   → Eski eşleşmeyi sil veya farklı fatura kullan\n');
    }
    
    if (!invoice.supplier_name || invoice.supplier_name.trim() === '') {
      problemFound = true;
      console.log('3. ❌ Faturada tedarikçi adı yok');
      console.log('   → Faturayı düzenleyerek tedarikçi adı ekleyin\n');
    }
    
    if (!problemFound) {
      console.log('✅ Tüm kontroller BAŞARILI!');
      console.log('   → Eşleştirme yapılabilir olmalı');
      console.log('   → UI\'dan tekrar deneyin veya skorlama algoritmasını kontrol edin\n');
    }
  }
}

checkInvoice()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
