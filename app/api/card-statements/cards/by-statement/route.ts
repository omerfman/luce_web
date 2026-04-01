/**
 * GET /api/card-statements/cards/by-statement
 *
 * Her ekstre dosyası için satır bazlı kart grupları (aynı dosyada çok kart).
 */

import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { checkApiPermission } from '@/lib/api/permissions';
import { makeCardGroupKey, makeCardGroupKeyFromRow } from '@/lib/card-groups';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  noStore();
  try {
    const authResult = await checkApiPermission(request, 'card_statements', 'read');
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { companyId } = authResult.context;

    const { data: statements, error: stErr } = await supabaseAdmin
      .from('card_statements')
      .select(
        'id, file_name, statement_month, uploaded_at, card_last_four, card_holder_name, total_transactions, total_amount, matched_count'
      )
      .eq('company_id', companyId)
      .order('uploaded_at', { ascending: false });

    if (stErr) {
      console.error('[cards/by-statement] statements', stErr);
      return NextResponse.json({ error: 'Ekstreler alınamadı' }, { status: 500 });
    }

    const stmtList = statements || [];
    if (stmtList.length === 0) {
      return NextResponse.json(
        { statements: [] },
        {
          headers: {
            'Cache-Control': 'private, no-store, must-revalidate',
          },
        }
      );
    }

    const ids = stmtList.map((s) => s.id);

    const { data: itemRows, error: itErr } = await supabaseAdmin
      .from('card_statement_items')
      .select('statement_id, card_last_four, card_holder_name')
      .in('statement_id', ids);

    if (itErr) {
      console.error('[cards/by-statement] items', itErr);
      return NextResponse.json({ error: 'İşlemler alınamadı' }, { status: 500 });
    }

    const itemsByStmt = new Map<string, typeof itemRows>();
    for (const row of itemRows || []) {
      const sid = row.statement_id;
      if (!itemsByStmt.has(sid)) itemsByStmt.set(sid, []);
      itemsByStmt.get(sid)!.push(row);
    }

    const result = stmtList.map((stmt) => {
      const rows = itemsByStmt.get(stmt.id) || [];
      const cardMap = new Map<
        string,
        { cardKey: string; card_last_four: string; card_holder_name: string; item_count: number }
      >();

      for (const r of rows) {
        const cardKey = makeCardGroupKeyFromRow(r, stmt);
        const lastFour = (r.card_last_four || stmt.card_last_four || '').trim() || '—';
        const holder =
          (r.card_holder_name || stmt.card_holder_name || '').trim() || '—';
        const cur = cardMap.get(cardKey);
        if (cur) {
          cur.item_count += 1;
        } else {
          cardMap.set(cardKey, {
            cardKey,
            card_last_four: lastFour,
            card_holder_name: holder,
            item_count: 1,
          });
        }
      }

      if (cardMap.size === 0 && (stmt.card_last_four || stmt.card_holder_name)) {
        const lastFour = (stmt.card_last_four || '').trim() || '—';
        const holder = (stmt.card_holder_name || '').trim() || '—';
        const cardKey = makeCardGroupKey(lastFour, holder);
        cardMap.set(cardKey, {
          cardKey,
          card_last_four: lastFour,
          card_holder_name: holder,
          item_count: 0,
        });
      }

      const cards = Array.from(cardMap.values()).sort((a, b) => {
        const na = a.card_last_four + a.card_holder_name;
        const nb = b.card_last_four + b.card_holder_name;
        return na.localeCompare(nb, 'tr');
      });

      return {
        statement_id: stmt.id,
        file_name: stmt.file_name,
        statement_month: stmt.statement_month,
        uploaded_at: stmt.uploaded_at,
        total_transactions: stmt.total_transactions,
        total_amount: stmt.total_amount,
        matched_count: stmt.matched_count,
        cards,
      };
    });

    return NextResponse.json(
      { statements: result },
      {
        headers: {
          'Cache-Control': 'private, no-store, must-revalidate',
        },
      }
    );
  } catch (e: any) {
    console.error('GET /api/card-statements/cards/by-statement', e);
    return NextResponse.json(
      { error: e.message || 'Beklenmeyen hata' },
      { status: 500 }
    );
  }
}
