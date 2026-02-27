/**
 * Mevcut faturalardaki müşteri bilgilerini kullanarak customers tablosunu günceller
 * 
 * Bu script:
 * 1. outgoing_invoices tablosundan tüm müşteri bilgilerini çeker
 * 2. VKN'ye göre gruplar ve en güncel/anlamlı müşteri adını bulur
 * 3. customers tablosundaki kayıtları günceller
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local dosyasını yükle
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase credentials not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface InvoiceCustomerData {
  customer_vkn: string;
  customer_name: string;
  invoice_date: string;
  company_id: string;
}

async function main() {
  console.log('🔍 Fatura verilerinden müşteri bilgileri çekiliyor...\n');

  // Tüm outgoing_invoices'ları çek (sadece customer bilgisi olanlar)
  const { data: invoices, error } = await supabase
    .from('outgoing_invoices')
    .select('customer_vkn, customer_name, invoice_date, company_id')
    .not('customer_vkn', 'is', null)
    .not('customer_name', 'is', null)
    .order('invoice_date', { ascending: false });

  if (error) {
    console.error('❌ Faturalar çekilemedi:', error);
    process.exit(1);
  }

  if (!invoices || invoices.length === 0) {
    console.log('ℹ️  Müşteri bilgisi olan fatura bulunamadı.');
    return;
  }

  console.log(`📄 ${invoices.length} adet fatura bulundu.\n`);

  // VKN'ye göre grupla ve en iyi müşteri adını seç
  const customerMap = new Map<string, { vkn: string; name: string; companyId: string; date: string }>();

  for (const invoice of invoices as InvoiceCustomerData[]) {
    const vkn = invoice.customer_vkn;
    const name = invoice.customer_name;
    const date = invoice.invoice_date;
    const companyId = invoice.company_id;

    // Boş veya anlamsız isimleri atla
    if (!name || name.trim() === '' || name === 'Bilinmeyen Müşteri' || name.startsWith('VKN:')) {
      continue;
    }

    const existing = customerMap.get(`${companyId}-${vkn}`);
    
    if (!existing) {
      // İlk kayıt
      customerMap.set(`${companyId}-${vkn}`, { vkn, name, companyId, date });
    } else {
      // Mevcut kayıt var
      // Eğer mevcut kayıt "Bilinmeyen" gibi bir şeyse veya yeni kayıt daha yeniyse, güncelle
      if (
        existing.name === 'Bilinmeyen Müşteri' ||
        existing.name.startsWith('VKN:') ||
        date > existing.date
      ) {
        customerMap.set(`${companyId}-${vkn}`, { vkn, name, companyId, date });
      }
    }
  }

  console.log(`✅ ${customerMap.size} benzersiz müşteri bilgisi toplandı.\n`);
  console.log('🔄 Customers tablosu güncelleniyor...\n');

  let updatedCount = 0;
  let createdCount = 0;
  let skippedCount = 0;

  for (const [key, customerData] of customerMap) {
    const { vkn, name, companyId } = customerData;

    // Önce mevcut kaydı kontrol et
    const { data: existing, error: fetchError } = await supabase
      .from('customers')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('vkn', vkn)
      .maybeSingle();

    if (fetchError) {
      console.error(`❌ VKN ${vkn} kontrol edilemedi:`, fetchError.message);
      continue;
    }

    if (existing) {
      // Mevcut kayıt var
      const needsUpdate = 
        !existing.name || 
        existing.name === 'Bilinmeyen Müşteri' || 
        existing.name.startsWith('VKN:') || 
        existing.name.trim() === '';

      if (needsUpdate) {
        // Güncelle
        const { error: updateError } = await supabase
          .from('customers')
          .update({ name, updated_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (updateError) {
          console.error(`❌ VKN ${vkn} güncellenemedi:`, updateError.message);
        } else {
          console.log(`✅ Güncellendi: ${vkn} -> "${name}" (eskisi: "${existing.name}")`);
          updatedCount++;
        }
      } else {
        console.log(`⏭️  Atlandı: ${vkn} -> "${existing.name}" (zaten doğru)`);
        skippedCount++;
      }
    } else {
      // Yeni kayıt oluştur
      const { error: insertError } = await supabase
        .from('customers')
        .insert({
          company_id: companyId,
          vkn,
          name,
          is_active: true,
        });

      if (insertError) {
        console.error(`❌ VKN ${vkn} oluşturulamadı:`, insertError.message);
      } else {
        console.log(`🆕 Oluşturuldu: ${vkn} -> "${name}"`);
        createdCount++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Özet:');
  console.log('='.repeat(60));
  console.log(`✅ Güncellenen kayıt: ${updatedCount}`);
  console.log(`🆕 Oluşturulan kayıt: ${createdCount}`);
  console.log(`⏭️  Atlanan kayıt: ${skippedCount}`);
  console.log(`📝 Toplam işlem: ${updatedCount + createdCount + skippedCount}`);
  console.log('='.repeat(60));
}

main()
  .then(() => {
    console.log('\n✅ İşlem tamamlandı!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Hata:', error);
    process.exit(1);
  });
