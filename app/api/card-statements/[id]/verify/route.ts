import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkApiPermission } from '@/lib/api/permissions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// POST /api/card-statements/[id]/verify
// Harcamayı onayla/doğrula
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Auth & Permission check
    const authResult = await checkApiPermission(request, 'card_statements', 'verify');
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { userId } = authResult.context;

    // Get params
    const params = 'id' in context.params ? context.params : await context.params;

    // Update statement item with verification
    const { error: updateError } = await supabaseAdmin
      .from('card_statement_items')
      .update({ 
        is_verified: true,
        verified_by: userId,
        verified_at: new Date().toISOString()
      })
      .eq('id', params.id);

    if (updateError) {
      console.error('Error verifying item:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Harcama onaylandı'
    });

  } catch (error: any) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/card-statements/[id]/verify
// Onayı kaldır
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Auth & Permission check
    const authResult = await checkApiPermission(request, 'card_statements', 'verify');
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Get params
    const params = 'id' in context.params ? context.params : await context.params;

    // Remove verification
    const { error: updateError } = await supabaseAdmin
      .from('card_statement_items')
      .update({ 
        is_verified: false,
        verified_by: null,
        verified_at: null
      })
      .eq('id', params.id);

    if (updateError) {
      console.error('Error unverifying item:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Onay kaldırıldı'
    });

  } catch (error: any) {
    console.error('Unverify error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
