/**
 * Test Invoice Query
 * Fatura query'sinin supplier_name ve invoice_number getirip getirmediğini test eder
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInvoiceQuery() {
  console.log('🔍 Testing invoice query...\n');

  // Bir örnek tutar seçelim: 150000 (loglardan)
  const testAmount = 150000;
  
  try {
    // Aynı query'yi çalıştıralım
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('id, amount, pdf_url, supplier_name, invoice_number, invoice_date, created_at')
      .gte('amount', testAmount - 100)
      .lte('amount', testAmount + 100)
      .limit(5);

    if (error) {
      console.error('❌ Query error:', error);
      return;
    }

    console.log(`✅ Found ${invoices?.length || 0} invoices\n`);
    
    if (invoices && invoices.length > 0) {
      invoices.forEach((invoice, i) => {
        console.log(`\n📋 Invoice ${i + 1}:`);
        console.log('  ID:', invoice.id);
        console.log('  Amount:', invoice.amount);
        console.log('  Supplier Name:', invoice.supplier_name || 'NULL/UNDEFINED');
        console.log('  Invoice Number:', invoice.invoice_number || 'NULL/UNDEFINED');
        console.log('  Invoice Date:', invoice.invoice_date || 'NULL/UNDEFINED');
        console.log('  PDF URL:', invoice.pdf_url || 'NULL/UNDEFINED');
        console.log('  Created At:', invoice.created_at);
        console.log('  ---');
        console.log('  Raw Data:', JSON.stringify(invoice, null, 2));
      });
    }

    // Şimdi de tüm kolonları çekelim
    console.log('\n\n🔍 Testing with SELECT * ...\n');
    
    const { data: allColumns, error: err2 } = await supabase
      .from('invoices')
      .select('*')
      .eq('amount', testAmount)
      .limit(1)
      .single();

    if (err2) {
      console.error('❌ SELECT * error:', err2);
    } else {
      console.log('✅ Full invoice data:');
      console.log(JSON.stringify(allColumns, null, 2));
      console.log('\n📋 Available columns:', Object.keys(allColumns || {}));
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testInvoiceQuery();
