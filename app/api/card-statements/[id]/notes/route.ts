import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkApiPermission } from '@/lib/api/permissions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// PATCH /api/card-statements/[id]/notes
// Harcama notunu güncelle
export async function PATCH(
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

    const { notes } = await request.json();

    // Update statement item notes
    const { error: updateError } = await supabaseAdmin
      .from('card_statement_items')
      .update({ 
        notes: notes || null
      })
      .eq('id', params.id);

    if (updateError) {
      console.error('Error updating notes:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Not güncellendi'
    });

  } catch (error: any) {
    console.error('Update notes error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
