/**
 * Re-match API
 * POST /api/card-statements/[id]/rematch
 *
 * Mevcut bir ekstredeki eşleşmemiş işlemler için otomatik eşleştirmeyi yeniden çalıştırır.
 * Hem fatura eşleştirme hem de cari hesap firma eşleştirme yapılır.
 *
 * Kullanım: Ekstre yüklendikten sonra yeni firmalar cari hesap olarak eklendiyse
 * veya yeni faturalar girilmişse bu endpoint ile tekrar eşleştirme yapılabilir.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  findMatchingInvoices,
  findMatchingCurrentAccountSuppliers,
  SUPPLIER_AUTO_MATCH_THRESHOLD
} from '@/lib/statement-matcher';
import type { ParsedStatementItem } from '@/lib/excel-parser';
import { checkApiPermission } from '@/lib/api/permissions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * DB item'ını ParsedStatementItem formatına çevirir
 */
function dbItemToParsed(item: any): ParsedStatementItem {
  return {
    rowNumber: item.row_number,
    transactionName: item.transaction_name,
    amount: item.amount,
    currency: item.currency || 'TRY',
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
    rawData: item.raw_data || {}
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await checkApiPermission(request, 'card_statements', 'assign');
    if (!authResult.authorized) return authResult.response;

    const { companyId } = authResult.context;
    const params = await Promise.resolve(context.params);
    const statementId = params.id;

    console.log(`🔄 [Rematch] Starting for statement: ${statementId}`);

    // Ekstreyi doğrula
    const { data: statement, error: stmtError } = await supabaseAdmin
      .from('card_statements')
      .select('id')
      .eq('id', statementId)
      .single();

    if (stmtError || !statement) {
      return NextResponse.json({ error: 'Ekstre bulunamadı' }, { status: 404 });
    }

    // Eşleşmemiş harcama işlemlerini getir
    const { data: unmatchedItems, error: itemsError } = await supabaseAdmin
      .from('card_statement_items')
      .select('*')
      .eq('statement_id', statementId)
      .eq('is_matched', false)
      .neq('transaction_type', 'payment'); // Borç ödemelerini atla

    if (itemsError) {
      console.error('[Rematch] Items fetch error:', itemsError);
      return NextResponse.json({ error: 'İşlemler yüklenemedi' }, { status: 500 });
    }

    if (!unmatchedItems || unmatchedItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tüm işlemler zaten eşleştirilmiş',
        invoiceMatches: 0,
        supplierMatches: 0,
        total: 0
      });
    }

    console.log(`🔄 [Rematch] ${unmatchedItems.length} eşleşmemiş işlem bulundu`);

    // Item ID → rowNumber haritası
    const rowToItemId = new Map<number, string>(
      unmatchedItems.map((item: any) => [item.row_number, item.id])
    );

    const newMatches: any[] = [];
    let invoiceMatchCount = 0;
    let supplierMatchCount = 0;

    for (const dbItem of unmatchedItems) {
      const parsedItem = dbItemToParsed(dbItem);
      const itemId = rowToItemId.get(parsedItem.rowNumber);
      if (!itemId) continue;

      // 1. Fatura eşleştirmesi (öncelik)
      const invoiceResults = await findMatchingInvoices(parsedItem, companyId, supabaseAdmin);

      if (invoiceResults.exact.length > 0) {
        const best = invoiceResults.exact[0];
        newMatches.push({
          statement_item_id: itemId,
          invoice_id: best.invoice.id,
          supplier_id: null,
          match_type: best.matchType,
          match_score: Math.round(best.matchScore),
          notes: best.reasons.join('; ')
        });
        invoiceMatchCount++;
        console.log(`✅ [Rematch] Fatura eşleşmesi: "${parsedItem.transactionName}" → fatura ${best.invoice.id} (%${Math.round(best.matchScore)})`);
        continue; // Fatura eşleştiyse supplier'a bakma
      }

      // 2. Cari hesap firma eşleştirmesi
      const supplierResults = await findMatchingCurrentAccountSuppliers(parsedItem, companyId, supabaseAdmin);
      const bestSupplier = supplierResults.find(m => m.matchType === 'current_account_auto');

      if (bestSupplier) {
        newMatches.push({
          statement_item_id: itemId,
          invoice_id: null,
          supplier_id: bestSupplier.supplier.id,
          match_type: 'current_account_auto',
          match_score: Math.round(bestSupplier.matchScore),
          notes: `Cari hesap otomatik eşleşme: ${bestSupplier.reasons.join('; ')}`
        });
        supplierMatchCount++;
        console.log(`🏢 [Rematch] Cari hesap eşleşmesi: "${parsedItem.transactionName}" → "${bestSupplier.supplier.name}" (%${Math.round(bestSupplier.matchScore)})`);
      }
    }

    // Eşleştirmeleri kaydet
    if (newMatches.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('statement_invoice_matches')
        .insert(newMatches);

      if (insertError) {
        console.error('[Rematch] Insert error:', insertError);
        return NextResponse.json(
          { error: 'Eşleştirmeler kaydedilemedi', details: insertError.message },
          { status: 500 }
        );
      }
    }

    console.log(`✅ [Rematch] Tamamlandı: ${invoiceMatchCount} fatura + ${supplierMatchCount} cari hesap eşleşmesi`);

    return NextResponse.json({
      success: true,
      message: `${newMatches.length} eşleştirme tamamlandı`,
      invoiceMatches: invoiceMatchCount,
      supplierMatches: supplierMatchCount,
      total: newMatches.length,
      checked: unmatchedItems.length
    });

  } catch (error: any) {
    console.error('[Rematch] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Eşleştirme başarısız' },
      { status: 500 }
    );
  }
}
