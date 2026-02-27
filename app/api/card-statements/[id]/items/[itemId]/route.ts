import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkApiPermission } from '@/lib/api/permissions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface Params {
  params: {
    id: string;
    itemId: string;
  };
}

// PATCH /api/card-statements/[id]/items/[itemId] - Update project assignment
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    // Auth & Permission check
    const authResult = await checkApiPermission(request, 'card_statements', 'assign');
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { itemId } = params;

    // Get request body
    const body = await request.json();
    const { project_id } = body;

    // Validate project_id (can be null to unassign)
    if (project_id !== null && typeof project_id !== 'string') {
      return NextResponse.json(
        { error: 'Invalid project_id' },
        { status: 400 }
      );
    }

    // Verify the item belongs to user's company
    const { data: item, error: itemError } = await supabaseAdmin
      .from('card_statement_items')
      .select(`
        id,
        statement_id,
        card_statements!inner (
          id,
          company_id
        )
      `)
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // If project_id is provided, verify it belongs to the same company
    if (project_id) {
      const { data: project, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('id, company_id')
        .eq('id', project_id)
        .single();

      if (projectError || !project) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }

      // @ts-ignore - Supabase typing issue
      if (project.company_id !== item.card_statements.company_id) {
        return NextResponse.json(
          { error: 'Project does not belong to the same company' },
          { status: 403 }
        );
      }
    }

    // Update the item
    const { error: updateError } = await supabaseAdmin
      .from('card_statement_items')
      .update({ project_id: project_id || null })
      .eq('id', itemId);

    if (updateError) {
      console.error('Error updating item:', updateError);
      return NextResponse.json(
        { error: 'Failed to update item' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/card-statements/[id]/items/[itemId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
