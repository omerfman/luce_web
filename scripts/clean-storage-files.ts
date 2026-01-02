/**
 * STORAGE TEMİZLEME SCRIPT'İ
 * ===========================
 * Supabase Storage'daki tüm invoice PDF dosyalarını siler
 * 
 * KULLANIM:
 * 1. .env.local dosyanızda SUPABASE_SERVICE_ROLE_KEY olduğundan emin olun
 * 2. Terminal'de çalıştırın: npx tsx scripts/clean-storage-files.ts
 * 
 * UYARI: Bu işlem GERİ ALINAMAZ!
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

// Supabase client oluştur (Service Role Key gerekli)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Hata: SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY tanımlı değil!');
  console.error('');
  console.error('Çözüm:');
  console.error('1. .env.local dosyasını kontrol edin');
  console.error('2. NEXT_PUBLIC_SUPABASE_URL değişkenini ekleyin');
  console.error('3. SUPABASE_SERVICE_ROLE_KEY değişkenini ekleyin (Supabase Dashboard > Settings > API)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Onay isteme fonksiyonu
async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'evet');
    });
  });
}

// Tüm dosyaları recursive olarak listele
async function listAllFiles(bucket: string, path: string = ''): Promise<string[]> {
  const allFiles: string[] = [];
  
  const { data: items, error } = await supabase.storage
    .from(bucket)
    .list(path, {
      limit: 1000,
      offset: 0,
    });

  if (error) {
    throw new Error(`Liste alınamadı: ${error.message}`);
  }

  if (!items || items.length === 0) {
    return allFiles;
  }

  for (const item of items) {
    const fullPath = path ? `${path}/${item.name}` : item.name;
    
    if (item.id === null) {
      // Bu bir klasör, recursive olarak içini listele
      const subFiles = await listAllFiles(bucket, fullPath);
      allFiles.push(...subFiles);
    } else {
      // Bu bir dosya
      allFiles.push(fullPath);
    }
  }

  return allFiles;
}

// Ana fonksiyon
async function cleanStorageFiles() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('📦 SUPABASE STORAGE TEMİZLEME');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('Bu script tüm invoice PDF dosyalarını silecektir.');
  console.log('');

  try {
    // Bucket'taki dosyaları listele
    console.log('📋 Dosyalar listeleniyor...');
    const files = await listAllFiles('invoices');
    
    console.log('');
    console.log(`Toplam ${files.length} dosya bulundu.`);
    console.log('');

    if (files.length === 0) {
      console.log('✅ Storage zaten temiz, silinecek dosya yok.');
      return;
    }

    // İlk 10 dosyayı göster
    console.log('Örnek dosyalar:');
    files.slice(0, 10).forEach((file, index) => {
      console.log(`  ${index + 1}. ${file}`);
    });
    if (files.length > 10) {
      console.log(`  ... ve ${files.length - 10} dosya daha`);
    }
    console.log('');

    // Onay iste
    const confirmed = await askConfirmation(
      `⚠️  TÜM ${files.length} DOSYAYI SİLMEK İSTEDİĞİNİZDEN EMİN MİSİNİZ? (y/n): `
    );

    if (!confirmed) {
      console.log('');
      console.log('❌ İşlem iptal edildi.');
      return;
    }

    console.log('');
    console.log('🗑️  Dosyalar siliniyor...');
    console.log('');

    // Dosyaları 100'er 100'er sil (batch)
    const batchSize = 100;
    let deletedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      const { error } = await supabase.storage
        .from('invoices')
        .remove(batch);

      if (error) {
        console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} hatası:`, error.message);
        errorCount += batch.length;
      } else {
        deletedCount += batch.length;
        const progress = Math.min(((i + batchSize) / files.length) * 100, 100);
        process.stdout.write(`\r   İlerleme: ${progress.toFixed(1)}% (${deletedCount}/${files.length})`);
      }

      // Rate limiting için kısa bekle
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('');
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 SONUÇ RAPORU');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`✅ Başarıyla silinen dosyalar: ${deletedCount}`);
    if (errorCount > 0) {
      console.log(`❌ Silinemeyen dosyalar: ${errorCount}`);
    }
    console.log('');

    if (errorCount === 0) {
      console.log('🎉 Tüm dosyalar başarıyla silindi!');
    } else {
      console.log('⚠️  Bazı dosyalar silinemedi. Lütfen manuel kontrol edin.');
    }
    console.log('');

  } catch (error: any) {
    console.error('');
    console.error('❌ HATA:', error.message);
    console.error('');
    console.error('Olası çözümler:');
    console.error('1. SUPABASE_SERVICE_ROLE_KEY doğru mu kontrol edin');
    console.error('2. Storage bucket adı "invoices" olmalı');
    console.error('3. Internet bağlantınızı kontrol edin');
    console.error('4. Supabase Dashboard\'dan manuel silmeyi deneyin');
    console.error('');
    process.exit(1);
  }
}

// Script'i çalıştır
console.log('');
console.log('🚀 Storage temizleme script\'i başlatılıyor...');
console.log('');

cleanStorageFiles()
  .then(() => {
    console.log('✅ Script başarıyla tamamlandı.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script hatası:', error);
    process.exit(1);
  });
