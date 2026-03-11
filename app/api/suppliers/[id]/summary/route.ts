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

    // Check if this VKN also exists as a customer
    let customer: any = null;
    if (supplier.vkn) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('vkn', supplier.vkn)
        .eq('company_id', companyId)
        .maybeSingle();
      
      customer = customerData;
      if (customer) {
        console.log('This supplier is also a customer:', customer.name);
      }
    }

    // Get incoming invoices (where this company is the supplier - we are buying from them)
    // Search by supplier_vkn (primary) or supplier_name (fallback)
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

    // Calculate invoice financials (exclude rejected invoices)
    // Database uses: amount (total), goods_services_total, vat_amount, withholding_amount
    const allInvoices = invoices || [];
    const validInvoices = allInvoices.filter((inv: any) => !inv.is_rejected);
    const rejectedInvoices = allInvoices.filter((inv: any) => inv.is_rejected);
    
    const invoiceStats = {
      count: validInvoices.length,
      totalAmount: validInvoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.amount) || 0), 0),
      totalTax: validInvoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.vat_amount) || 0), 0),
      totalWithholding: validInvoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.withholding_amount) || 0), 0),
    };
    
    const rejectedInvoiceStats = {
      count: rejectedInvoices.length,
      totalAmount: rejectedInvoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.amount) || 0), 0),
    };
    
    console.log('Invoice stats:', invoiceStats);
    console.log('Rejected invoice stats:', rejectedInvoiceStats);

    // Get outgoing invoices (where this company is the customer - we are selling to them)
    let outgoingInvoices: any[] = [];
    let outgoingInvoiceStats = {
      count: 0,
      totalAmount: 0,
      totalWithholding: 0,
    };

    if (supplier.vkn) {
      const { data: outgoingData, error: outgoingError } = await supabase
        .from('outgoing_invoices')
        .select(`
          *,
          project_links:outgoing_invoice_project_links(
            id,
            project_id,
            project:projects(id, name)
          )
        `)
        .eq('company_id', companyId)
        .eq('customer_vkn', supplier.vkn)
        .order('invoice_date', { ascending: false });
      
      if (outgoingError) {
        console.error('Error fetching outgoing invoices:', outgoingError);
      } else {
        outgoingInvoices = outgoingData || [];
        console.log('Outgoing invoices found:', outgoingInvoices.length);
        
        outgoingInvoiceStats = {
          count: outgoingInvoices.length,
          totalAmount: outgoingInvoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.amount) || 0), 0),
          totalWithholding: outgoingInvoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.withholding_amount) || 0), 0),
        };
      }
    }

    console.log('Outgoing invoice stats:', outgoingInvoiceStats);

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

    // YENİ: Kredi kartı ödemelerini al (cari hesap için)
    let cardPayments: any[] = [];
    let cardPaymentStats = {
      count: 0,
      totalAmount: 0,
    };

    console.log('🔄 Supplier current account check:', {
      supplierId,
      name: supplier.name,
      isCurrentAccount: supplier.is_current_account
    });

    if (supplier.is_current_account) {
      console.log('🔄 Checking card payments for current account supplier:', supplierId);
      
      // A) Faturaya bağlı eşleştirmeler (eski yöntem)
      const { data: cardPaymentsViaInvoice } = await supabase
        .from('statement_invoice_matches')
        .select(`
          id,
          matched_at,
          statement_item:card_statement_items!inner(
            id,
            transaction_name,
            amount,
            transaction_date
          ),
          invoice:invoices!inner(
            id,
            supplier_id,
            supplier_vkn,
            supplier_name
          )
        `)
        .or(`invoice.supplier_id.eq.${supplierId},invoice.supplier_vkn.eq.${supplier.vkn || 'NULL'},invoice.supplier_name.eq.${supplier.name}`)
        .order('matched_at', { ascending: false });

      // B) Doğrudan firmaya bağlı eşleştirmeler (YENİ: faturasız)
      const { data: cardPaymentsViaSupplier } = await supabase
        .from('statement_invoice_matches')
        .select(`
          id,
          matched_at,
          statement_item:card_statement_items!inner(
            id,
            transaction_name,
            amount,
            transaction_date
          )
        `)
        .eq('supplier_id', supplierId)
        .is('invoice_id', null)
        .order('matched_at', { ascending: false });

      cardPayments = [
        ...(cardPaymentsViaInvoice || []),
        ...(cardPaymentsViaSupplier || [])
      ];

      cardPaymentStats = {
        count: cardPayments.length,
        totalAmount: cardPayments.reduce((sum: number, match: any) => 
          sum + (parseFloat(match.statement_item?.amount) || 0), 0),
      };

      console.log('🔄 Card payments found:', cardPaymentStats.count, 'Total:', cardPaymentStats.totalAmount);
    }

    // Bakiye: Giden faturalar (gelir) - Gelen faturalar (gider) - Kredi kartı ödemeleri
    // Gayri resmi ödemeler bağımsız işlemdir, net bakiyeye dahil edilmez
    const netBalance = outgoingInvoiceStats.totalAmount - invoiceStats.totalAmount - cardPaymentStats.totalAmount;
    console.log('Net balance:', netBalance, '(outgoing:', outgoingInvoiceStats.totalAmount, '- incoming:', invoiceStats.totalAmount, '- cardPayments:', cardPaymentStats.totalAmount, ')');
    console.log('NOTE: Informal payments (', informalPaymentStats.totalAmount, ') are standalone, not in net balance');

    // Calculate grand total (all transactions)
    const grandTotal = invoiceStats.totalAmount + informalPaymentStats.totalAmount + outgoingInvoiceStats.totalAmount;
    
    console.log('Grand total:', grandTotal);
    console.log('Returning response with', invoices?.length || 0, 'invoices and', informalPayments?.length || 0, 'payments');

    // Get unique project IDs from invoice_project_links and informal_payments
    const projectIds = new Set<string>();
    
    // Collect projects from incoming invoice links (many-to-many)
    invoices?.forEach((inv: any) => {
      inv.project_links?.forEach((link: any) => {
        if (link.project_id) projectIds.add(link.project_id);
      });
    });
    
    // Collect projects from outgoing invoice links (many-to-many)
    outgoingInvoices?.forEach((inv: any) => {
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

    // Monthly transaction data (incoming = expense, outgoing = income, excluding rejected)
    const monthlyData = new Map<string, { 
      incomingInvoices: number; 
      outgoingInvoices: number; 
      informalPayments: number;
      cardPayments: number; // YENİ 
    }>();

    // Incoming invoices (expenses - we pay them, exclude rejected)
    validInvoices.forEach((inv: any) => {
      const month = new Date(inv.invoice_date).toISOString().substring(0, 7);
      const current = monthlyData.get(month) || { 
        incomingInvoices: 0, 
        outgoingInvoices: 0, 
        informalPayments: 0,
        cardPayments: 0 
      };
      current.incomingInvoices += parseFloat(inv.amount) || 0;
      monthlyData.set(month, current);
    });

    // Outgoing invoices (income - they pay us)
    outgoingInvoices?.forEach((inv: any) => {
      const month = new Date(inv.invoice_date).toISOString().substring(0, 7);
      const current = monthlyData.get(month) || { 
        incomingInvoices: 0, 
        outgoingInvoices: 0, 
        informalPayments: 0,
        cardPayments: 0 
      };
      current.outgoingInvoices += parseFloat(inv.amount) || 0;
      monthlyData.set(month, current);
    });

    // Informal payments (expenses)
    informalPayments?.forEach((pay: any) => {
      const month = new Date(pay.payment_date).toISOString().substring(0, 7);
      const current = monthlyData.get(month) || { 
        incomingInvoices: 0, 
        outgoingInvoices: 0, 
        informalPayments: 0,
        cardPayments: 0 
      };
      current.informalPayments += parseFloat(pay.amount) || 0;
      monthlyData.set(month, current);
    });

    // YENİ: Card payments (expenses - cari hesap için)
    // Kredi kartı ekstrelerinde tutarlar negatif gelir (borçlandırma), Math.abs() ile pozitife çeviriyoruz
    cardPayments?.forEach((match: any) => {
      const month = new Date(match.statement_item.transaction_date).toISOString().substring(0, 7);
      const current = monthlyData.get(month) || { 
        incomingInvoices: 0, 
        outgoingInvoices: 0, 
        informalPayments: 0,
        cardPayments: 0 
      };
      current.cardPayments += Math.abs(parseFloat(match.statement_item.amount) || 0);
      monthlyData.set(month, current);
    });

    const monthlySummary = Array.from(monthlyData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        incomingInvoices: data.incomingInvoices,
        outgoingInvoices: data.outgoingInvoices,
        informalPayments: data.informalPayments,
        cardPayments: data.cardPayments,
        // netTotal: faturalar - kredi kartı ödemeleri
        // Gayri resmi ödemeler bağımsız işlemdir, netTotal'a dahil edilmez
        // Pozitif = biz borçluyuz, Negatif = bakiyemiz var
        netTotal: data.incomingInvoices - data.outgoingInvoices - data.cardPayments,
      }));

    return NextResponse.json({
      supplier,
      customer,
      financial: {
        grandTotal,
        netBalance,
        invoices: invoiceStats,
        outgoingInvoices: outgoingInvoiceStats,
        informalPayments: informalPaymentStats,
        rejectedInvoices: rejectedInvoiceStats,
      },
      invoices: invoices || [],
      outgoingInvoices: outgoingInvoices || [],
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
