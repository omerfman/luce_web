/**
 * Get Match Suggestions API
 * GET /api/card-statements/[id]/suggestions
 * 
 * Bir statement item için eşleşme önerilerini döndürür
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { findMatchingInvoices, findMatchingCurrentAccountSuppliers } from '@/lib/statement-matcher';
import type { ParsedStatementItem } from '@/lib/excel-parser';
import { checkApiPermission } from '@/lib/api/permissions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Auth & Permission check
    const authResult = await checkApiPermission(request, 'card_statements', 'read');
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { companyId } = authResult.context;

    // Get params
    const params = await Promise.resolve(context.params);
    const itemId = params.id;

    // Get statement item
    const { data: item, error: itemError } = await supabaseAdmin
      .from('card_statement_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'İşlem bulunamadı' }, { status: 404 });
    }

    // Convert to ParsedStatementItem format
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

    // Find matching invoices
    const matchResults = await findMatchingInvoices(parsedItem, companyId, supabaseAdmin);

    // YENI: Cari hesap firmaları için öneri bul (fatura olmadan)
    const currentAccountSuggestions = await findMatchingCurrentAccountSuppliers(
      parsedItem,
      companyId,
      supabaseAdmin
    );
    return NextResponse.json({
      item,
      exactMatches: matchResults.exact,
      suggestedMatches: matchResults.suggested,
      currentAccountSuppliers: currentAccountSuggestions, // Yeni alan
      noMatch: matchResults.noMatch && currentAccountSuggestions.length === 0
    });

  } catch (error: any) {
    console.error('Get suggestions error:', error);
    return NextResponse.json(
      { error: error.message || 'Beklenmeyen bir hata oluştu' },
      { status: 500 }
    );
  }
}
