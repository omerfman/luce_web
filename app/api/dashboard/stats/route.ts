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

    // Run all queries in parallel for better performance
    const [
      projectsResult,
      invoicesResult,
      paymentsResult,
      suppliersResult,
      thisMonthInvoicesResult,
      thisMonthPaymentsResult,
    ] = await Promise.all([
      // 1. Project Statistics
      supabase
        .from('projects')
        .select('id, status', { count: 'exact' })
        .eq('company_id', companyId),
      
      // 2. Invoice Statistics
      supabase
        .from('invoices')
        .select('amount, vat_amount, withholding_amount, invoice_date', { count: 'exact' })
        .eq('company_id', companyId),
      
      // 3. Informal Payments Statistics
      supabase
        .from('informal_payments')
        .select('amount, payment_date', { count: 'exact' })
        .eq('company_id', companyId),
      
      // 4. Supplier Statistics
      supabase
        .from('suppliers')
        .select('id, supplier_type', { count: 'exact' })
        .eq('company_id', companyId),
      
      // 5. This Month's Invoices
      supabase
        .from('invoices')
        .select('amount')
        .eq('company_id', companyId)
        .gte('invoice_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
        .lte('invoice_date', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]),
      
      // 6. This Month's Payments
      supabase
        .from('informal_payments')
        .select('amount')
        .eq('company_id', companyId)
        .gte('payment_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
        .lte('payment_date', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]),
    ]);

    // Process Projects
    const projects = projectsResult.data || [];
    const projectStats = {
      total: projectsResult.count || 0,
      active: projects.filter(p => p.status === 'active').length,
      completed: projects.filter(p => p.status === 'completed').length,
      onHold: projects.filter(p => p.status === 'on_hold').length,
      planning: projects.filter(p => p.status === 'planning').length,
    };

    // Process Invoices
    const invoices = invoicesResult.data || [];
    const invoiceStats = {
      count: invoicesResult.count || 0,
      totalAmount: invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount as string) || 0), 0),
      totalVAT: invoices.reduce((sum, inv) => sum + (parseFloat(inv.vat_amount as string) || 0), 0),
      totalWithholding: invoices.reduce((sum, inv) => sum + (parseFloat(inv.withholding_amount as string) || 0), 0),
    };

    // Process Payments
    const payments = paymentsResult.data || [];
    const paymentStats = {
      count: paymentsResult.count || 0,
      totalAmount: payments.reduce((sum, pay) => sum + (parseFloat(pay.amount as string) || 0), 0),
    };

    // Process Suppliers
    const suppliers = suppliersResult.data || [];
    const supplierStats = {
      total: suppliersResult.count || 0,
      subcontractors: suppliers.filter(s => s.supplier_type === 'subcontractor').length,
      invoiceCompanies: suppliers.filter(s => s.supplier_type === 'invoice_company').length,
      pending: suppliers.filter(s => !s.supplier_type || s.supplier_type === 'pending').length,
    };

    // Calculate This Month's Total
    const thisMonthInvoices = thisMonthInvoicesResult.data || [];
    const thisMonthPayments = thisMonthPaymentsResult.data || [];
    const thisMonthTotal = 
      thisMonthInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount as string) || 0), 0) +
      thisMonthPayments.reduce((sum, pay) => sum + (parseFloat(pay.amount as string) || 0), 0);

    // Calculate Grand Total
    const grandTotal = invoiceStats.totalAmount + paymentStats.totalAmount;

    // Count pending invoices (not assigned to any project)
    const { count: pendingInvoicesCount } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .not('id', 'in', `(SELECT invoice_id FROM invoice_project_links WHERE invoice_id IS NOT NULL)`);

    return NextResponse.json({
      projects: projectStats,
      invoices: invoiceStats,
      payments: paymentStats,
      suppliers: supplierStats,
      grandTotal,
      thisMonthTotal,
      pendingInvoices: pendingInvoicesCount || 0,
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}
