/**
 * Card Statement Detail API
 * GET /api/card-statements/[id]
 * DELETE /api/card-statements/[id]
 * 
 * Tek bir ekstreye ait detayları döndürür veya siler
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

    // Get params
    const params = await Promise.resolve(context.params);
    const statementId = params.id;

    // Get statement with items and matches
    const { data: statement, error: stmtError } = await supabaseAdmin
      .from('card_statements')
      .select(`
        *,
        uploaded_by:users!uploaded_by_user_id (
          id,
          name,
          email
        )
      `)
      .eq('id', statementId)
      .single();

    if (stmtError || !statement) {
      return NextResponse.json({ error: 'Ekstre bulunamadı' }, { status: 404 });
    }

    // Get all items with matches
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('card_statement_items')
      .select('*')
      .eq('statement_id', statementId)
      .order('row_number', { ascending: true });

    if (itemsError) {
      console.error('Items fetch error:', itemsError);
      return NextResponse.json(
        { error: 'İşlemler yüklenirken hata oluştu' },
        { status: 500 }
      );
    }

    // Get matches separately for each item
    const itemsWithMatches = await Promise.all(
      items.map(async (item) => {
        const { data: matches } = await supabaseAdmin
          .from('statement_invoice_matches')
          .select(`
            id,
            invoice_id,
            match_type,
            match_score,
            matched_at,
            notes,
            invoices (
              id,
              amount,
              file_path,
              supplier_name,
              invoice_number,
              invoice_date,
              created_at
            )
          `)
          .eq('statement_item_id', item.id);
        
        // Supabase returns 'invoices' (table name) but we want 'invoice' (singular)
        // Map the data to match our TypeScript interface
        const mappedMatches = (matches || []).map((match: any) => ({
          id: match.id,
          invoice_id: match.invoice_id,
          match_type: match.match_type,
          match_score: match.match_score,
          matched_at: match.matched_at,
          notes: match.notes,
          invoice: match.invoices // Rename from 'invoices' to 'invoice'
        }));
        
        return {
          ...item,
          matches: mappedMatches
        };
      })
    );

    // Calculate stats
    const stats = {
      total: itemsWithMatches.length,
      autoMatched: itemsWithMatches.filter(i => i.is_matched).length,
      suggested: itemsWithMatches.filter(i => !i.is_matched && i.match_confidence > 0).length,
      noMatch: itemsWithMatches.filter(i => !i.is_matched && i.match_confidence === 0).length,
      autoMatchRate: 0,
      suggestionRate: 0
    };

    if (stats.total > 0) {
      stats.autoMatchRate = Math.round((stats.autoMatched / stats.total) * 100);
      stats.suggestionRate = Math.round((stats.suggested / stats.total) * 100);
    }

    return NextResponse.json({
      statement,
      items: itemsWithMatches,
      stats
    });

  } catch (error: any) {
    console.error('Get statement detail error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: error.message || 'Beklenmeyen bir hata oluştu' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Auth & Permission check
    const authResult = await checkApiPermission(request, 'card_statements', 'delete');
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Get params
    const params = await Promise.resolve(context.params);
    const statementId = params.id;

    // Delete statement (cascade will delete items and matches)
    const { error: deleteError } = await supabaseAdmin
      .from('card_statements')
      .delete()
      .eq('id', statementId);

    if (deleteError) {
      console.error('Delete statement error:', deleteError);
      return NextResponse.json(
        { error: 'Ekstre silinemedi' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Ekstre başarıyla silindi'
    });

  } catch (error: any) {
    console.error('Delete statement error:', error);
    return NextResponse.json(
      { error: error.message || 'Beklenmeyen bir hata oluştu' },
      { status: 500 }
    );
  }
}
