import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const projectId = params.id;

    // Verify user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: user } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', session.user.id)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get project and verify it belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('company_id', user.company_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get invoices linked to this project with their totals
    const { data: invoiceLinks, error: invoicesError } = await supabase
      .from('invoice_project_links')
      .select(`
        invoice:invoices (
          id,
          invoice_number,
          invoice_date,
          amount,
          vat_amount,
          withholding_amount,
          goods_services_total,
          supplier_name,
          supplier_vkn
        )
      `)
      .eq('project_id', projectId);

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
    }

    // Calculate invoice totals
    const invoices = invoiceLinks?.map((link: any) => link.invoice).filter(Boolean) || [];
    const invoiceStats = {
      count: invoices.length,
      totalAmount: invoices.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0),
      totalVAT: invoices.reduce((sum: number, inv: any) => sum + (inv.vat_amount || 0), 0),
      totalWithholding: invoices.reduce((sum: number, inv: any) => sum + (inv.withholding_amount || 0), 0),
      totalGoodsServices: invoices.reduce((sum: number, inv: any) => sum + (inv.goods_services_total || 0), 0),
    };

    // Get informal payments for this project
    const { data: informalPayments, error: paymentsError } = await supabase
      .from('informal_payments')
      .select(`
        id,
        amount,
        description,
        payment_date,
        payment_method,
        supplier:suppliers (
          name,
          vkn
        )
      `)
      .eq('project_id', projectId);

    if (paymentsError) {
      console.error('Error fetching informal payments:', paymentsError);
    }

    // Calculate informal payment totals
    const informalPaymentStats = {
      count: informalPayments?.length || 0,
      totalAmount: informalPayments?.reduce((sum, payment) => sum + payment.amount, 0) || 0,
    };

    // Get file statistics
    const { data: projectFiles, error: filesError } = await supabase
      .from('project_files')
      .select('file_size, category')
      .eq('project_id', projectId);

    if (filesError) {
      console.error('Error fetching project files:', filesError);
    }

    const fileStats = {
      count: projectFiles?.length || 0,
      totalSize: projectFiles?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0,
      byCategory: projectFiles?.reduce((acc: any, file) => {
        const category = file.category || 'other';
        if (!acc[category]) {
          acc[category] = { count: 0, size: 0 };
        }
        acc[category].count++;
        acc[category].size += file.file_size || 0;
        return acc;
      }, {}) || {},
    };

    // Get activity logs for recent activities
    const { data: activities, error: activitiesError } = await supabase
      .from('activity_logs')
      .select(`
        id,
        action,
        entity_type,
        entity_id,
        metadata,
        created_at,
        user:users (
          name,
          email
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
    }

    // Calculate monthly spending (last 12 months)
    const monthlySpending: Record<string, { invoices: number; informalPayments: number }> = {};
    
    // Process invoices by month
    invoices.forEach((invoice: any) => {
      if (invoice.invoice_date) {
        const date = new Date(invoice.invoice_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlySpending[monthKey]) {
          monthlySpending[monthKey] = { invoices: 0, informalPayments: 0 };
        }
        monthlySpending[monthKey].invoices += invoice.amount || 0;
      }
    });

    // Process informal payments by month
    informalPayments?.forEach((payment) => {
      if (payment.payment_date) {
        const date = new Date(payment.payment_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlySpending[monthKey]) {
          monthlySpending[monthKey] = { invoices: 0, informalPayments: 0 };
        }
        monthlySpending[monthKey].informalPayments += payment.amount || 0;
      }
    });

    // Calculate grand totals
    const grandTotal = invoiceStats.totalAmount + informalPaymentStats.totalAmount;

    // Aggregate suppliers by VKN and name
    const supplierMap = new Map<string, { supplierId?: string; name: string; vkn?: string; total: number; invoiceCount: number; paymentCount: number }>();

    // Process invoices
    invoices.forEach((invoice: any) => {
      const key = invoice.supplier_vkn || invoice.supplier_name || 'Bilinmeyen';
      const existing = supplierMap.get(key);
      
      if (existing) {
        existing.total += invoice.amount || 0;
        existing.invoiceCount++;
      } else {
        supplierMap.set(key, {
          supplierId: invoice.supplier_id || undefined,
          name: invoice.supplier_name || 'Bilinmeyen',
          vkn: invoice.supplier_vkn,
          total: invoice.amount || 0,
          invoiceCount: 1,
          paymentCount: 0,
        });
      }
    });

    // Process informal payments
    informalPayments?.forEach((payment) => {
      const supplier: any = Array.isArray(payment.supplier) ? payment.supplier[0] : payment.supplier;
      const supplierName = supplier?.name || 'Bilinmeyen';
      const supplierVkn = supplier?.vkn;
      const supplierId = supplier?.id;
      const key = supplierVkn || supplierName;
      const existing = supplierMap.get(key);
      
      if (existing) {
        existing.total += payment.amount || 0;
        existing.paymentCount++;
        // Update supplierId if not already set
        if (!existing.supplierId && supplierId) {
          existing.supplierId = supplierId;
        }
      } else {
        supplierMap.set(key, {
          supplierId: supplierId || undefined,
          name: supplierName,
          vkn: supplierVkn,
          total: payment.amount || 0,
          invoiceCount: 0,
          paymentCount: 1,
        });
      }
    });

    // Convert to array and sort by total
    const suppliers = Array.from(supplierMap.values())
      .sort((a, b) => b.total - a.total);

    // Return summary data
    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        start_date: project.start_date,
        end_date: project.end_date,
        created_at: project.created_at,
        updated_at: project.updated_at,
      },
      financial: {
        grandTotal,
        invoices: invoiceStats,
        informalPayments: informalPaymentStats,
      },
      files: fileStats,
      activities: activities || [],
      monthlySpending,
      suppliers,
    });
  } catch (error) {
    console.error('Error fetching project summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
