/**
 * Check Invoices Table Schema
 * Bu script invoices tablosunun gerçek yapısını kontrol eder
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkInvoicesSchema() {
  console.log('🔍 Checking invoices table schema...\n');

  // Option 1: Try to query and see what columns exist
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error querying invoices:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Found invoice sample:');
      console.log('Columns:', Object.keys(data[0]));
      console.log('\nSample data:', JSON.stringify(data[0], null, 2));
    } else {
      console.log('⚠️ No invoices found in database');
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }

  // Option 2: Use PostgREST information schema
  console.log('\n📋 Fetching table schema from information_schema...');
  
  try {
    const { data, error } = await supabase.rpc('get_table_columns', {
      table_name: 'invoices'
    });

    if (error) {
      console.error('RPC not available, skipping');
    } else {
      console.log('Schema:', data);
    }
  } catch (err) {
    // RPC might not exist, that's ok
  }
}

checkInvoicesSchema();
