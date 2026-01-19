import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const supabase = await createServerClient();
    
    // Handle both Promise and direct params (Next.js 14 compatibility)
    const params = await Promise.resolve(context.params);
    const supplierId = params.id;
    
    console.log('Supplier Summary API called for ID:', supplierId);

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Authenticated user:', user.id);

    // Get user's company_id
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      console.error('User data error:', userDataError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const companyId = (userData as any).company_id;
    console.log('Company ID:', companyId);

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
      console.error('Supplier error:', supplierError);
      return NextResponse.json({ error: 'Supplier not found', details: supplierError }, { status: 404 });
    }

    console.log('Supplier found:', supplier.name, 'VKN:', supplier.vkn);

    // Get invoices related to this supplier
    // Search by supplier_vkn (primary) or supplier_name (fallback)
    // Note: Most invoices use VKN, not supplier_id
    let invoices: any[] = [];
    let invoicesError: any = null;
    
    if (supplier.vkn) {
      // First try with VKN
      const { data: vknInvoices, error: vknError } = await supabase
        .from('invoices')
        .select(`
          *,
          project:projects(id, name, project_code)
        `)
        .eq('company_id', companyId)
        .eq('supplier_vkn', supplier.vkn)
        .order('invoice_date', { ascending: false });
      
      invoices = vknInvoices || [];
      invoicesError = vknError;
      console.log('Invoices found by VKN:', invoices.length);
    }
    
    // If no invoices found by VKN, try by supplier name
    if (invoices.length === 0 && supplier.name) {
      const { data: nameInvoices, error: nameError } = await supabase
        .from('invoices')
        .select(`
          *,
          project:projects(id, name, project_code)
        `)
        .eq('company_id', companyId)
        .eq('supplier_name', supplier.name)
        .order('invoice_date', { ascending: false });
      
      invoices = nameInvoices || [];
      invoicesError = nameError;
      console.log('Invoices found by name:', invoices.length);
    }

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
    }
    
    console.log('Invoices found:', invoices?.length || 0);

    // Calculate invoice financials
    const invoiceStats = {
      count: invoices?.length || 0,
      totalAmount: invoices?.reduce((sum: number, inv: any) => sum + (parseFloat(inv.total_amount) || 0), 0) || 0,
      totalTax: invoices?.reduce((sum: number, inv: any) => sum + (parseFloat(inv.tax_amount) || 0), 0) || 0,
      totalWithholding: invoices?.reduce((sum: number, inv: any) => sum + (parseFloat(inv.withholding_amount) || 0), 0) || 0,
    };
    
    console.log('Invoice stats:', invoiceStats);

    // Get informal payments related to this supplier
    // Check if supplier has a subcontractor relation
    let informalPayments: any[] = [];
    let informalPaymentStats = {
      count: 0,
      totalAmount: 0,
    };

    if ((supplier as any).subcontractor_id) {
      console.log('Checking informal payments for subcontractor_id:', (supplier as any).subcontractor_id);
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
        console.log('Informal payments found:', payments?.length || 0);
        informalPayments = payments || [];
        informalPaymentStats = {
          count: payments?.length || 0,
          totalAmount: payments?.reduce((sum: number, pay: any) => sum + (parseFloat(pay.amount) || 0), 0) || 0,
        };
      }
    }

    // Calculate grand total
    const grandTotal = invoiceStats.totalAmount + informalPaymentStats.totalAmount;
    
    console.log('Grand total:', grandTotal);
    console.log('Returning response with', invoices?.length || 0, 'invoices and', informalPayments?.length || 0, 'payments');

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
