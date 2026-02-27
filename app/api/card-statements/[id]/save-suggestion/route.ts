import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkApiPermission } from '@/lib/api/permissions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// POST /api/card-statements/[id]/save-suggestion
// Öneri skorunu kaydet (eşleştirme yapmadan)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Auth & Permission check
    const authResult = await checkApiPermission(request, 'card_statements', 'update');
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Get params
    const params = 'id' in context.params ? context.params : await context.params;

    const { matchConfidence } = await request.json();

    if (typeof matchConfidence !== 'number' || matchConfidence < 0 || matchConfidence > 100) {
      return NextResponse.json({ error: 'Invalid match_confidence value' }, { status: 400 });
    }

    // Update statement item with suggestion score
    const { error: updateError } = await supabaseAdmin
      .from('card_statement_items')
      .update({ 
        match_confidence: matchConfidence
      })
      .eq('id', params.id);

    if (updateError) {
      console.error('Error updating match_confidence:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Öneri skoru kaydedildi'
    });

  } catch (error: any) {
    console.error('Save suggestion error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
