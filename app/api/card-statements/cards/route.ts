/**
 * GET /api/card-statements/cards
 *
 * Ekstre satırlarındaki kart (son 4 + sahip) bilgisine göre gruplar.
 * Tek dosyada birden fazla kart (ör. ŞAHSİ YKB) desteklenir.
 */

import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { checkApiPermission } from '@/lib/api/permissions';
import { makeCardGroupKey } from '@/lib/card-groups';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export { makeCardGroupKey } from '@/lib/card-groups';

export async function GET(request: NextRequest) {
  noStore();
  try {
    const authResult = await checkApiPermission(request, 'card_statements', 'read');
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { companyId } = authResult.context;

    const { data: rows, error } = await supabaseAdmin
      .from('card_statement_items')
      .select(
        `
        card_last_four,
        card_holder_name,
        statement_id,
        card_statements!inner (
          id,
          statement_month,
          uploaded_at,
          card_last_four,
          card_holder_name
        )
      `
      )
      .eq('card_statements.company_id', companyId);

    if (error) {
      console.error('[card-statements/cards]', error);
      return NextResponse.json(
        { error: 'Kart listesi alınamadı' },
        { status: 500 }
      );
    }

    type Stmt = {
      id: string;
      statement_month: string | null;
      uploaded_at: string;
      card_last_four: string | null;
      card_holder_name: string | null;
    };

    type ItemRow = {
      card_last_four: string | null;
      card_holder_name: string | null;
      statement_id: string;
      card_statements: Stmt;
    };

    const groups = new Map<
      string,
      {
        cardKey: string;
        card_last_four: string;
        card_holder_name: string;
        statementIds: Set<string>;
        latestMonth: string | null;
        latestUploaded: string | null;
      }
    >();

    for (const raw of (rows || []) as ItemRow[]) {
      const stmt = raw.card_statements;
      if (!stmt?.id) continue;

      const lastFour = (raw.card_last_four || stmt.card_last_four || '').trim();
      const holder = (raw.card_holder_name || stmt.card_holder_name || '').trim() || '—';
      const cardKey = makeCardGroupKey(lastFour, holder);

      let g = groups.get(cardKey);
      if (!g) {
        g = {
          cardKey,
          card_last_four: lastFour || '—',
          card_holder_name: holder,
          statementIds: new Set<string>(),
          latestMonth: null,
          latestUploaded: null,
        };
        groups.set(cardKey, g);
      }

      g.statementIds.add(stmt.id);

      const sm = stmt.statement_month;
      if (sm) {
        if (!g.latestMonth || sm > g.latestMonth) g.latestMonth = sm;
      }
      const ua = stmt.uploaded_at;
      if (ua) {
        if (!g.latestUploaded || ua > g.latestUploaded) g.latestUploaded = ua;
      }
    }

    const cards = Array.from(groups.values())
      .map((g) => ({
        cardKey: g.cardKey,
        card_last_four: g.card_last_four,
        card_holder_name: g.card_holder_name,
        statement_ids: Array.from(g.statementIds),
        statement_count: g.statementIds.size,
        latest_statement_month: g.latestMonth,
        latest_uploaded_at: g.latestUploaded,
      }))
      .sort((a, b) => {
        const ta = a.latest_statement_month || a.latest_uploaded_at || '';
        const tb = b.latest_statement_month || b.latest_uploaded_at || '';
        if (ta !== tb) return tb.localeCompare(ta);
        return a.card_holder_name.localeCompare(b.card_holder_name, 'tr');
      });

    return NextResponse.json(
      { cards },
      {
        headers: {
          'Cache-Control': 'private, no-store, must-revalidate',
        },
      }
    );
  } catch (e: any) {
    console.error('GET /api/card-statements/cards', e);
    return NextResponse.json(
      { error: e.message || 'Beklenmeyen hata' },
      { status: 500 }
    );
  }
}
