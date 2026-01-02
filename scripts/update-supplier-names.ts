/**
 * Tek Seferlik Script: Supplier İsimlerini Güncelle
 * 
 * Amaç: invoices tablosundaki gerçek firma isimlerini kullanarak
 * suppliers tablosunda "Bilinmeyen Tedarikçi" olarak kayıtlı
 * firmaların isimlerini günceller.
 * 
 * Çalıştırma: 
 * npx tsx scripts/update-supplier-names.ts
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Supabase credentials eksik!');
  console.error('NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY gerekli');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Invoice {
  supplier_vkn: string | null;
  supplier_name: string | null;
  company_id: string;
}

interface Supplier {
  id: string;
  vkn: string;
  name: string;
  company_id: string;
}

async function main() {
  console.log('🔍 Supplier isim güncelleme scripti başlatılıyor...\n');

  try {
    // 1. "Bilinmeyen Tedarikçi" olarak kayıtlı supplier'ları bul
    console.log('1️⃣ "Bilinmeyen Tedarikçi" kayıtları aranıyor...');
    const { data: unknownSuppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('name', 'Bilinmeyen Tedarikçi');

    if (suppliersError) {
      throw new Error(`Supplier sorgusu hatası: ${suppliersError.message}`);
    }

    if (!unknownSuppliers || unknownSuppliers.length === 0) {
      console.log('✅ Güncellenmesi gereken "Bilinmeyen Tedarikçi" kaydı bulunamadı!');
      return;
    }

    console.log(`   📊 ${unknownSuppliers.length} adet "Bilinmeyen Tedarikçi" bulundu\n`);

    // 2. Her bir supplier için faturalardan gerçek ismi bul
    let updatedCount = 0;
    let skippedCount = 0;

    for (const supplier of unknownSuppliers as Supplier[]) {
      console.log(`\n🔍 VKN: ${supplier.vkn} işleniyor...`);

      // Bu VKN'ye sahip faturalardan isim al
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('supplier_name, created_at')
        .eq('supplier_vkn', supplier.vkn)
        .eq('company_id', supplier.company_id)
        .not('supplier_name', 'is', null)
        .neq('supplier_name', '')
        .neq('supplier_name', 'Bilinmeyen Tedarikçi')
        .order('created_at', { ascending: false })
        .limit(1);

      if (invoicesError) {
        console.error(`   ❌ Fatura sorgusu hatası: ${invoicesError.message}`);
        skippedCount++;
        continue;
      }

      if (!invoices || invoices.length === 0) {
        console.log(`   ⚠️  Bu VKN için gerçek firma ismi bulunamadı`);
        skippedCount++;
        continue;
      }

      const realSupplierName = invoices[0].supplier_name;
      console.log(`   ✅ Gerçek firma ismi bulundu: "${realSupplierName}"`);

      // Supplier'ı güncelle
      const { error: updateError } = await supabase
        .from('suppliers')
        .update({ 
          name: realSupplierName,
          updated_at: new Date().toISOString()
        })
        .eq('id', supplier.id);

      if (updateError) {
        console.error(`   ❌ Güncelleme hatası: ${updateError.message}`);
        skippedCount++;
        continue;
      }

      console.log(`   ✅ Güncellendi: "${supplier.name}" → "${realSupplierName}"`);
      updatedCount++;
    }

    // 3. Özet rapor
    console.log('\n' + '='.repeat(60));
    console.log('📊 ÖZET RAPOR');
    console.log('='.repeat(60));
    console.log(`✅ Güncellenen kayıt: ${updatedCount}`);
    console.log(`⚠️  Atlanan kayıt: ${skippedCount}`);
    console.log(`📝 Toplam işlenen: ${unknownSuppliers.length}`);
    console.log('='.repeat(60) + '\n');

    // 4. Kalan "Bilinmeyen Tedarikçi" sayısını göster
    const { count: remainingCount, error: countError } = await supabase
      .from('suppliers')
      .select('*', { count: 'exact', head: true })
      .eq('name', 'Bilinmeyen Tedarikçi');

    if (!countError) {
      console.log(`📌 Kalan "Bilinmeyen Tedarikçi" sayısı: ${remainingCount || 0}\n`);
    }

    console.log('✨ Script başarıyla tamamlandı!');

  } catch (error: any) {
    console.error('\n❌ Script hatası:', error.message);
    process.exit(1);
  }
}

// Script'i çalıştır
main();
