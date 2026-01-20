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
      .select('*')
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
      // First try with VKN - include project links from junction table
      const { data: vknInvoices, error: vknError } = await supabase
        .from('invoices')
        .select(`
          *,
          project_links:invoice_project_links(
            id,
            project_id,
            project:projects(id, name)
          )
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
          project_links:invoice_project_links(
            id,
            project_id,
            project:projects(id, name)
          )
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
    
    // Log first invoice to see structure
    if (invoices && invoices.length > 0) {
      console.log('First invoice data:', JSON.stringify(invoices[0], null, 2));
      console.log('First invoice keys:', Object.keys(invoices[0]));
    }

    // Calculate invoice financials
    // Database uses: amount (total), goods_services_total, vat_amount, withholding_amount
    const invoiceStats = {
      count: invoices?.length || 0,
      totalAmount: invoices?.reduce((sum: number, inv: any) => sum + (parseFloat(inv.amount) || 0), 0) || 0,
      totalTax: invoices?.reduce((sum: number, inv: any) => sum + (parseFloat(inv.vat_amount) || 0), 0) || 0,
      totalWithholding: invoices?.reduce((sum: number, inv: any) => sum + (parseFloat(inv.withholding_amount) || 0), 0) || 0,
    };
    
    console.log('Invoice stats:', invoiceStats);

    // Get informal payments related to this supplier
    // Informal payments use supplier_id (not subcontractor_id)
    let informalPayments: any[] = [];
    let informalPaymentStats = {
      count: 0,
      totalAmount: 0,
    };

    // Check if this supplier has any informal payments
    console.log('Checking informal payments for supplier_id:', supplierId);
    const { data: payments, error: paymentsError } = await supabase
      .from('informal_payments')
      .select('*')
      .eq('supplier_id', supplierId)
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

    // Calculate grand total
    const grandTotal = invoiceStats.totalAmount + informalPaymentStats.totalAmount;
    
    console.log('Grand total:', grandTotal);
    console.log('Returning response with', invoices?.length || 0, 'invoices and', informalPayments?.length || 0, 'payments');

    // Get unique project IDs from invoice_project_links and informal_payments
    const projectIds = new Set<string>();
    
    // Collect projects from invoice links (many-to-many)
    invoices?.forEach((inv: any) => {
      inv.project_links?.forEach((link: any) => {
        if (link.project_id) projectIds.add(link.project_id);
      });
    });
    
    // Collect projects from informal payments (direct project_id)
    informalPayments?.forEach((pay: any) => {
      if (pay.project_id) projectIds.add(pay.project_id);
    });

    // Fetch project details if we have any project IDs
    let projects: any[] = [];
    if (projectIds.size > 0) {
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', Array.from(projectIds));
      
      projects = projectsData || [];
      console.log('Projects found:', projects.length);
    }

    // Monthly spending data
    const monthlyData = new Map<string, { invoices: number; informalPayments: number }>();

    invoices?.forEach((inv: any) => {
      const month = new Date(inv.invoice_date).toISOString().substring(0, 7);
      const current = monthlyData.get(month) || { invoices: 0, informalPayments: 0 };
      current.invoices += parseFloat(inv.amount) || 0;
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
