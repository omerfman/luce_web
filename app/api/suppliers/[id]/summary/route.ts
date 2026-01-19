import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const supplierId = params.id;

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company_id
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const companyId = (userData as any).company_id;

    // Get supplier details
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select(`
        *,
        subcontractor:subcontractors!subcontractor_id(*)
      `)
      .eq('id', supplierId)
      .eq('company_id', companyId)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Get invoices related to this supplier
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select(`
        *,
        project:projects(id, name, project_code)
      `)
      .eq('supplier_id', supplierId)
      .eq('company_id', companyId)
      .order('invoice_date', { ascending: false });

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
    }

    // Calculate invoice financials
    const invoiceStats = {
      count: invoices?.length || 0,
      totalAmount: invoices?.reduce((sum: number, inv: any) => sum + (parseFloat(inv.total_amount) || 0), 0) || 0,
      totalTax: invoices?.reduce((sum: number, inv: any) => sum + (parseFloat(inv.tax_amount) || 0), 0) || 0,
      totalWithholding: invoices?.reduce((sum: number, inv: any) => sum + (parseFloat(inv.withholding_amount) || 0), 0) || 0,
    };

    // Get informal payments related to this supplier
    // Check if supplier has a subcontractor relation
    let informalPayments: any[] = [];
    let informalPaymentStats = {
      count: 0,
      totalAmount: 0,
    };

    if ((supplier as any).subcontractor_id) {
      const { data: payments, error: paymentsError } = await supabase
        .from('informal_payments')
        .select(`
          *,
          project:projects(id, name, project_code),
          subcontractor:subcontractors(id, name)
        `)
        .eq('subcontractor_id', (supplier as any).subcontractor_id)
        .eq('company_id', companyId)
        .order('payment_date', { ascending: false });

      if (paymentsError) {
        console.error('Error fetching informal payments:', paymentsError);
      } else {
        informalPayments = payments || [];
        informalPaymentStats = {
          count: payments?.length || 0,
          totalAmount: payments?.reduce((sum: number, pay: any) => sum + (parseFloat(pay.amount) || 0), 0) || 0,
        };
      }
    }

    // Calculate grand total
    const grandTotal = invoiceStats.totalAmount + informalPaymentStats.totalAmount;

    // Get project list (unique projects)
    const projectsSet = new Set();
    invoices?.forEach((inv: any) => {
      if (inv.project) {
        projectsSet.add(JSON.stringify(inv.project));
      }
    });
    informalPayments?.forEach((pay: any) => {
      if (pay.project) {
        projectsSet.add(JSON.stringify(pay.project));
      }
    });

    const projects = Array.from(projectsSet).map((p: any) => JSON.parse(p));

    // Monthly spending data
    const monthlyData = new Map<string, { invoices: number; informalPayments: number }>();

    invoices?.forEach((inv: any) => {
      const month = new Date(inv.invoice_date).toISOString().substring(0, 7);
      const current = monthlyData.get(month) || { invoices: 0, informalPayments: 0 };
      current.invoices += parseFloat(inv.total_amount) || 0;
      monthlyData.set(month, current);
    });

    informalPayments?.forEach((pay: any) => {
      const month = new Date(pay.payment_date).toISOString().substring(0, 7);
      const current = monthlyData.get(month) || { invoices: 0, informalPayments: 0 };
      current.informalPayments += parseFloat(pay.amount) || 0;
      monthlyData.set(month, current);
    });

    const monthlySummary = Array.from(monthlyData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        invoices: data.invoices,
        informalPayments: data.informalPayments,
        total: data.invoices + data.informalPayments,
      }));

    return NextResponse.json({
      supplier,
      financial: {
        grandTotal,
        invoices: invoiceStats,
        informalPayments: informalPaymentStats,
      },
      invoices: invoices || [],
      informalPayments,
      projects,
      monthlySummary,
    });
  } catch (error: any) {
    console.error('Error in supplier summary API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
