import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const companyId = userData.company_id;

    // Fetch recent data in parallel
    const [
      recentInvoices,
      recentPayments,
      recentProjects,
    ] = await Promise.all([
      // Recent Invoices (last 5)
      supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          amount,
          supplier_name,
          created_at
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5),
      
      // Recent Informal Payments (last 5)
      supabase
        .from('informal_payments')
        .select(`
          id,
          description,
          payment_date,
          amount,
          payment_method,
          created_at,
          supplier:suppliers(id, name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5),
      
      // Recent Projects (last 5)
      supabase
        .from('projects')
        .select(`
          id,
          name,
          status,
          created_at
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    if (recentInvoices.error) throw recentInvoices.error;
    if (recentPayments.error) throw recentPayments.error;
    if (recentProjects.error) throw recentProjects.error;

    return NextResponse.json({
      invoices: recentInvoices.data || [],
      payments: recentPayments.data || [],
      projects: recentProjects.data || [],
    });

  } catch (error) {
    console.error('Dashboard recent activities error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent activities' },
      { status: 500 }
    );
  }
}
