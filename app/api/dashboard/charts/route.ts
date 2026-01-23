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

    // Get last 6 months data
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const [
      monthlyInvoices,
      monthlyPayments,
      topProjects,
      topSuppliers,
    ] = await Promise.all([
      // Monthly Invoices (last 6 months)
      supabase
        .from('invoices')
        .select('invoice_date, amount')
        .eq('company_id', companyId)
        .gte('invoice_date', sixMonthsAgoStr)
        .order('invoice_date', { ascending: true }),
      
      // Monthly Payments (last 6 months)
      supabase
        .from('informal_payments')
        .select('payment_date, amount')
        .eq('company_id', companyId)
        .gte('payment_date', sixMonthsAgoStr)
        .order('payment_date', { ascending: true }),
      
      // Top 5 Projects by spending
      supabase.rpc('get_top_projects', { 
        p_company_id: companyId,
        p_limit: 5 
      }).then(async (result) => {
        // If RPC doesn't exist, calculate manually
        if (result.error) {
          // Get all projects with their financial data
          const { data: projects } = await supabase
            .from('projects')
            .select(`
              id,
              name,
              invoice_links:invoice_project_links(
                invoice:invoices(amount)
              ),
              payments:informal_payments(amount)
            `)
            .eq('company_id', companyId);

          if (!projects) return { data: [] };

          // Calculate total for each project
          const projectTotals = projects.map(project => {
            const invoiceTotal = project.invoice_links?.reduce((sum: number, link: any) => 
              sum + (parseFloat(link.invoice?.amount) || 0), 0) || 0;
            const paymentTotal = project.payments?.reduce((sum: number, pay: any) => 
              sum + (parseFloat(pay.amount) || 0), 0) || 0;
            
            return {
              id: project.id,
              name: project.name,
              total: invoiceTotal + paymentTotal,
            };
          });

          // Sort and return top 5
          return {
            data: projectTotals
              .sort((a, b) => b.total - a.total)
              .slice(0, 5)
          };
        }
        return result;
      }),
      
      // Top 5 Suppliers by transaction count and amount
      supabase
        .from('suppliers')
        .select(`
          id,
          name,
          vkn,
          invoices:invoices(amount),
          payments:informal_payments(amount)
        `)
        .eq('company_id', companyId)
        .limit(100), // Get all suppliers, we'll process top 5
    ]);

    if (monthlyInvoices.error) throw monthlyInvoices.error;
    if (monthlyPayments.error) throw monthlyPayments.error;
    // topProjects and topSuppliers are manually processed, no error checking needed

    // Process monthly spending data
    const monthlyData: Record<string, { invoices: number; payments: number; month: string }> = {};
    
    // Group invoices by month
    (monthlyInvoices.data || []).forEach((inv: any) => {
      const month = inv.invoice_date.substring(0, 7); // YYYY-MM format
      if (!monthlyData[month]) {
        monthlyData[month] = { invoices: 0, payments: 0, month };
      }
      monthlyData[month].invoices += parseFloat(inv.amount) || 0;
    });

    // Group payments by month
    (monthlyPayments.data || []).forEach((pay: any) => {
      const month = pay.payment_date.substring(0, 7); // YYYY-MM format
      if (!monthlyData[month]) {
        monthlyData[month] = { invoices: 0, payments: 0, month };
      }
      monthlyData[month].payments += parseFloat(pay.amount) || 0;
    });

    // Convert to array and sort by month
    const monthlySpending = Object.values(monthlyData)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(item => ({
        month: item.month,
        invoices: Math.round(item.invoices),
        payments: Math.round(item.payments),
        total: Math.round(item.invoices + item.payments),
      }));

    // Process top suppliers
    const suppliersWithTotals = (topSuppliers.data || []).map((supplier: any) => {
      const invoiceTotal = supplier.invoices?.reduce((sum: number, inv: any) => 
        sum + (parseFloat(inv.amount) || 0), 0) || 0;
      const paymentTotal = supplier.payments?.reduce((sum: number, pay: any) => 
        sum + (parseFloat(pay.amount) || 0), 0) || 0;
      
      return {
        id: supplier.id,
        name: supplier.name,
        vkn: supplier.vkn,
        total: invoiceTotal + paymentTotal,
        transactionCount: (supplier.invoices?.length || 0) + (supplier.payments?.length || 0),
      };
    });

    // Sort by total and get top 5
    const topSuppliersData = suppliersWithTotals
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return NextResponse.json({
      monthlySpending,
      topProjects: topProjects.data || [],
      topSuppliers: topSuppliersData,
    });

  } catch (error) {
    console.error('Dashboard charts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}
