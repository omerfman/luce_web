/**
 * PATCH /api/card-statements/cards/holder
 *
 * Aynı kart anahtarına (son4 + eski isim) sahip tüm ekstre satırlarında kart sahibi adını günceller.
 */

import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { checkApiPermission } from '@/lib/api/permissions';
import { makeCardGroupKeyFromRow } from '@/lib/card-groups';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const CHUNK = 400;

export async function PATCH(request: NextRequest) {
  noStore();
  try {
    const authResult = await checkApiPermission(request, 'card_statements', 'update');
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { companyId } = authResult.context;
    const body = await request.json();
    const cardKey = typeof body.cardKey === 'string' ? body.cardKey.trim() : '';
    const newHolderRaw = body.new_holder_name;
    const newHolder =
      typeof newHolderRaw === 'string' ? newHolderRaw.trim() : '';

    if (!cardKey) {
      return NextResponse.json({ error: 'cardKey gerekli' }, { status: 400 });
    }

    const { data: rows, error } = await supabaseAdmin
      .from('card_statement_items')
      .select(
        `
        id,
        card_last_four,
        card_holder_name,
        card_statements!inner (
          company_id,
          card_last_four,
          card_holder_name
        )
      `
      )
      .eq('card_statements.company_id', companyId);

    if (error) {
      console.error('[cards/holder]', error);
      return NextResponse.json({ error: 'Kayıtlar okunamadı' }, { status: 500 });
    }

    type Row = {
      id: string;
      card_last_four: string | null;
      card_holder_name: string | null;
      card_statements: {
        company_id: string;
        card_last_four: string | null;
        card_holder_name: string | null;
      };
    };

    const toUpdate = (rows || []).filter((r: Row) => {
      const stmt = r.card_statements;
      return makeCardGroupKeyFromRow(r, stmt) === cardKey;
    });

    if (toUpdate.length === 0) {
      return NextResponse.json(
        { error: 'Bu karta ait satır bulunamadı' },
        { status: 404 }
      );
    }

    const ids = toUpdate.map((r: Row) => r.id);
    const valueToSet = newHolder || '—';

    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { error: upErr } = await supabaseAdmin
        .from('card_statement_items')
        .update({ card_holder_name: valueToSet })
        .in('id', slice);

      if (upErr) {
        console.error('[cards/holder] update', upErr);
        return NextResponse.json({ error: 'Güncelleme başarısız' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      updated_count: ids.length,
      new_holder_name: valueToSet,
    });
  } catch (e: any) {
    console.error('PATCH /api/card-statements/cards/holder', e);
    return NextResponse.json(
      { error: e.message || 'Beklenmeyen hata' },
      { status: 500 }
    );
  }
}
