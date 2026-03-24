/**
 * Card Statement List API
 * GET /api/card-statements
 * 
 * Şirkete ait ekstreler listesini döndürür
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import { checkApiPermission } from '@/lib/api/permissions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    // Auth & Permission check
    const authResult = await checkApiPermission(request, 'card_statements', 'read');
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { companyId } = authResult.context;

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const cardLastFour = searchParams.get('cardLastFour');
    const startMonth = searchParams.get('startMonth');
    const endMonth = searchParams.get('endMonth');

    // Build query
    let query = supabaseAdmin
      .from('card_statements')
      .select(`
        id,
        file_name,
        card_last_four,
        card_holder_name,
        statement_month,
        total_transactions,
        total_amount,
        matched_count,
        uploaded_at,
        created_at,
        uploaded_by:users!uploaded_by_user_id (
          id,
          name,
          email
        )
      `)
      .eq('company_id', companyId)
      .order('uploaded_at', { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`file_name.ilike.%${search}%,card_holder_name.ilike.%${search}%`);
    }

    if (cardLastFour) {
      query = query.eq('card_last_four', cardLastFour);
    }

    if (startMonth) {
      query = query.gte('statement_month', `${startMonth}-01`);
    }

    if (endMonth) {
      query = query.lte('statement_month', `${endMonth}-01`);
    }

    const { data: statements, error } = await query;

    if (error) {
      console.error('Fetch statements error:', error);
      return NextResponse.json(
        { error: 'Ekstreler yüklenirken hata oluştu' },
        { status: 500 }
      );
    }

    // Fetch item-level stats (kasa fişi, verified) in bulk to avoid N+1
    const statementIds = statements.map((s: any) => s.id);
    let itemCountMap: Record<string, { petty_cash_count: number; verified_count: number }> = {};

    if (statementIds.length > 0) {
      const { data: items } = await supabaseAdmin
        .from('card_statement_items')
        .select('statement_id, is_matched, is_verified, project_id, transaction_type')
        .in('statement_id', statementIds);

      for (const item of items || []) {
        if (!itemCountMap[item.statement_id]) {
          itemCountMap[item.statement_id] = { petty_cash_count: 0, verified_count: 0 };
        }
        const isPettyCash = !item.is_matched && item.project_id && item.transaction_type !== 'payment';
        if (isPettyCash) itemCountMap[item.statement_id].petty_cash_count++;
        if (item.is_verified) itemCountMap[item.statement_id].verified_count++;
      }
    }

    // Calculate match percentages and extra stats
    const statementsWithStats = statements.map((stmt: any) => {
      const extra = itemCountMap[stmt.id] || { petty_cash_count: 0, verified_count: 0 };
      const remaining = Math.max(
        0,
        stmt.total_transactions - stmt.matched_count - extra.petty_cash_count
      );
      return {
        ...stmt,
        match_percentage: stmt.total_transactions > 0
          ? Math.round((stmt.matched_count / stmt.total_transactions) * 100)
          : 0,
        petty_cash_count: extra.petty_cash_count,
        verified_count: extra.verified_count,
        remaining_count: remaining,
      };
    });

    return NextResponse.json({
      statements: statementsWithStats,
      total: statements.length
    });

  } catch (error: any) {
    console.error('List statements error:', error);
    return NextResponse.json(
      { error: error.message || 'Beklenmeyen bir hata oluştu' },
      { status: 500 }
    );
  }
}
