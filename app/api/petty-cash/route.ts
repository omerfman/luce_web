import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/petty-cash - List all petty cash receipts (card items assigned to projects)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Build query - get all card statement items that are assigned to a project
    let query = supabase
      .from('card_statement_items')
      .select(`
        *,
        card_statements!inner (
          id,
          file_name,
          statement_month,
          card_last_four,
          card_holder_name,
          company_id
        ),
        projects (
          id,
          name,
          company_id
        )
      `, { count: 'exact' })
      .not('project_id', 'is', null)
      .order('transaction_date', { ascending: false });

    // Filter by project if specified
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    // Execute query with pagination
    const { data: items, error: itemsError, count } = await query
      .range(offset, offset + limit - 1);

    if (itemsError) {
      console.error('Error fetching petty cash receipts:', itemsError);
      console.error('Error details:', JSON.stringify(itemsError, null, 2));
      return NextResponse.json(
        { error: 'Failed to fetch petty cash receipts', details: itemsError.message },
        { status: 500 }
      );
    }

    // Calculate totals
    const totalExpense = items?.reduce((sum, item) => {
      return sum + (item.amount < 0 ? Math.abs(Number(item.amount)) : 0);
    }, 0) || 0;

    return NextResponse.json({
      items: items || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      stats: {
        totalItems: items?.length || 0,
        totalExpense: totalExpense.toFixed(2),
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/petty-cash:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
