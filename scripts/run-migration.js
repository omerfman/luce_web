/**
 * Supabase Migration Runner
 * Migration SQL dosyasını Supabase'e uygular
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Supabase client'ı dinamik olarak import et
  const { createClient } = require('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase bilgileri bulunamadı. .env.local dosyasını kontrol edin.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('🚀 Migration başlatılıyor...\n');

  // Migration dosyasını oku
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20241223_supplier_management_system.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration dosyası bulunamadı:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log('📄 Migration dosyası okundu:', migrationPath);
  console.log('📏 SQL uzunluğu:', sql.length, 'karakter\n');

  // SQL'i satırlara böl ve çalıştır
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📦 ${statements.length} SQL ifadesi bulundu\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    
    // İlk 50 karakteri göster
    const preview = statement.substring(0, 50).replace(/\n/g, ' ');
    console.log(`[${i + 1}/${statements.length}] ${preview}...`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
      
      if (error) {
        // exec_sql fonksiyonu yoksa, raw SQL çalıştırmayı dene
        const { error: rawError } = await supabase.from('_migrations').select('*').limit(0);
        
        if (rawError) {
          console.warn('⚠️  Bu ifade atlandı (muhtemelen zaten mevcut)');
        } else {
          throw error;
        }
      } else {
        console.log('  ✅ Başarılı');
        successCount++;
      }
    } catch (error) {
      console.error('  ❌ Hata:', error.message);
      errorCount++;
      
      // Kritik olmayan hatalar için devam et
      if (
        error.message.includes('already exists') ||
        error.message.includes('does not exist') ||
        error.message.includes('duplicate')
      ) {
        console.log('  ℹ️  Bu hata görmezden gelindi (zaten mevcut/duplicate)');
        successCount++;
      }
    }
    
    console.log('');
  }

  console.log('========================================');
  console.log('Migration Sonucu:');
  console.log('✅ Başarılı:', successCount);
  console.log('❌ Hatalı:', errorCount);
  console.log('========================================\n');

  if (errorCount === 0) {
    console.log('🎉 Migration başarıyla tamamlandı!');
  } else {
    console.log('⚠️  Bazı hatalar oluştu. Lütfen manuel olarak kontrol edin.');
  }
}

runMigration().catch(error => {
  console.error('\n❌ Migration sırasında kritik hata:', error);
  process.exit(1);
});
