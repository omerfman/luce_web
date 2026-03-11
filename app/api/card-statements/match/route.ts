/**
 * Manual Match API
 * POST /api/card-statements/match
 * DELETE /api/card-statements/match
 * 
 * Manuel fatura eşleştirme ve cari hesap firma eşleştirme
 * İki tip eşleştirme:
 * 1. Fatura bazlı: { statementItemId, invoiceId }
 * 2. Firma bazlı (cari hesap): { statementItemId, supplierId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkApiPermission } from '@/lib/api/permissions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Create manual match
 */
export async function POST(request: NextRequest) {
  try {
    // Auth & Permission check
    const authResult = await checkApiPermission(request, 'card_statements', 'assign');
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { userId } = authResult.context;

    // Parse body
    const body = await request.json();
    const { statementItemId, invoiceId, supplierId, notes, matchScore, matchType } = body;

    // Validation: en az biri olmalı
    if (!statementItemId) {
      return NextResponse.json(
        { error: 'statementItemId gerekli' },
        { status: 400 }
      );
    }

    if (!invoiceId && !supplierId) {
      return NextResponse.json(
        { error: 'invoiceId veya supplierId gerekli (en az biri)' },
        { status: 400 }
      );
    }

    if (invoiceId && supplierId) {
      return NextResponse.json(
        { error: 'Hem invoiceId hem supplierId gönderilemez, sadece biri olmalı' },
        { status: 400 }
      );
    }

    // Eğer supplier-only eşleştirme ise, supplier'ın cari hesap olduğunu kontrol et
    if (supplierId && !invoiceId) {
      const { data: supplier, error: supplierError } = await supabaseAdmin
        .from('suppliers')
        .select('is_current_account, name')
        .eq('id', supplierId)
        .single();

      if (supplierError || !supplier) {
        return NextResponse.json(
          { error: 'Firma bulunamadı' },
          { status: 404 }
        );
      }

      if (!supplier.is_current_account) {
        return NextResponse.json(
          { error: `${supplier.name} cari hesap değil. Sadece cari hesap firmaları fatura olmadan eşleştirilebilir.` },
          { status: 400 }
        );
      }
    }

    // Create match
    const insertData: any = {
      statement_item_id: statementItemId,
      match_type: matchType || (invoiceId ? 'manual' : 'current_account_direct'),
      match_score: matchScore !== undefined ? matchScore : 100,
      matched_by_user_id: userId,
      notes: notes || null
    };

    if (invoiceId) {
      insertData.invoice_id = invoiceId;
    }

    if (supplierId) {
      insertData.supplier_id = supplierId;
    }

    const { data: match, error: matchError } = await supabaseAdmin
      .from('statement_invoice_matches')
      .insert(insertData)
      .select(`
        *,
        invoice:invoices (
          id,
          amount,
          invoice_date,
          invoice_number,
          supplier_name,
          file_path
        ),
        supplier:suppliers (
          id,
          name,
          vkn,
          is_current_account
        )
      `)
      .single();

    if (matchError) {
      console.error('Match creation error:', matchError);
      
      // Check for duplicate
      if (matchError.code === '23505') {
        return NextResponse.json(
          { error: 'Bu eşleştirme zaten mevcut' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Eşleştirme oluşturulamadı' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      match,
      message: 'Eşleştirme başarıyla oluşturuldu'
    });

  } catch (error: any) {
    console.error('Manual match error:', error);
    return NextResponse.json(
      { error: error.message || 'Beklenmeyen bir hata oluştu' },
      { status: 500 }
    );
  }
}

/**
 * Delete match
 */
export async function DELETE(request: NextRequest) {
  try {
    // Auth & Permission check
    const authResult = await checkApiPermission(request, 'card_statements', 'assign');
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Parse body
    const body = await request.json();
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json(
        { error: 'matchId gerekli' },
        { status: 400 }
      );
    }

    // Delete match
    const { error: deleteError } = await supabaseAdmin
      .from('statement_invoice_matches')
      .delete()
      .eq('id', matchId);

    if (deleteError) {
      console.error('Match deletion error:', deleteError);
      return NextResponse.json(
        { error: 'Eşleştirme silinemedi' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Eşleştirme başarıyla kaldırıldı'
    });

  } catch (error: any) {
    console.error('Delete match error:', error);
    return NextResponse.json(
      { error: error.message || 'Beklenmeyen bir hata oluştu' },
      { status: 500 }
    );
  }
}
