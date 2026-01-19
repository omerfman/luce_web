import { supabase } from './client';
import type { 
  ProjectSummary,
  ProjectFinancialStats 
} from '@/types';

/**
 * Get comprehensive summary for a project
 */
export async function getProjectSummary(projectId: string): Promise<ProjectSummary | null> {
  try {
    // Fetch the endpoint
    const response = await fetch(`/api/projects/${projectId}/summary`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch project summary');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching project summary:', error);
    return null;
  }
}

/**
 * Calculate financial statistics for a project
 */
export async function calculateProjectFinancials(
  projectId: string
): Promise<ProjectFinancialStats | null> {
  try {
    // Get invoices linked to this project
    const { data: invoiceLinks, error: invoicesError } = await supabase
      .from('invoice_project_links')
      .select(`
        invoice:invoices (
          id,
          amount,
          vat_amount,
          withholding_amount,
          goods_services_total
        )
      `)
      .eq('project_id', projectId);

    if (invoicesError) throw invoicesError;

    // Get informal payments for this project
    const { data: informalPayments, error: paymentsError } = await supabase
      .from('informal_payments')
      .select('id, amount')
      .eq('project_id', projectId);

    if (paymentsError) throw paymentsError;

    // Calculate totals
    const invoices = invoiceLinks?.map((link: any) => link.invoice).filter(Boolean) || [];
    
    const invoiceTotal = invoices.reduce(
      (sum: number, inv: any) => sum + (inv.amount || 0),
      0
    );
    
    const vatTotal = invoices.reduce(
      (sum: number, inv: any) => sum + (inv.vat_amount || 0),
      0
    );
    
    const withholdingTotal = invoices.reduce(
      (sum: number, inv: any) => sum + (inv.withholding_amount || 0),
      0
    );

    const informalTotal = informalPayments?.reduce(
      (sum, payment) => sum + payment.amount,
      0
    ) || 0;

    const grandTotal = invoiceTotal + informalTotal;

    return {
      invoiceTotal,
      invoiceCount: invoices.length,
      vatTotal,
      withholdingTotal,
      informalPaymentTotal: informalTotal,
      informalPaymentCount: informalPayments?.length || 0,
      grandTotal,
    };
  } catch (error) {
    console.error('Error calculating project financials:', error);
    return null;
  }
}

/**
 * Get monthly spending breakdown for a project
 */
export async function getProjectMonthlySpending(projectId: string, months: number = 12) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);

    // Get invoices
    const { data: invoiceLinks } = await supabase
      .from('invoice_project_links')
      .select(`
        invoice:invoices (
          invoice_date,
          amount
        )
      `)
      .eq('project_id', projectId);

    // Get informal payments
    const { data: informalPayments } = await supabase
      .from('informal_payments')
      .select('payment_date, amount')
      .eq('project_id', projectId);

    const monthlyData: Record<string, { invoices: number; informalPayments: number; total: number }> = {};

    // Process invoices
    invoiceLinks?.forEach((link: any) => {
      const invoice = link.invoice;
      if (invoice?.invoice_date) {
        const date = new Date(invoice.invoice_date);
        if (date >= cutoffDate) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { invoices: 0, informalPayments: 0, total: 0 };
          }
          monthlyData[monthKey].invoices += invoice.amount || 0;
          monthlyData[monthKey].total += invoice.amount || 0;
        }
      }
    });

    // Process informal payments
    informalPayments?.forEach((payment) => {
      if (payment.payment_date) {
        const date = new Date(payment.payment_date);
        if (date >= cutoffDate) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { invoices: 0, informalPayments: 0, total: 0 };
          }
          monthlyData[monthKey].informalPayments += payment.amount || 0;
          monthlyData[monthKey].total += payment.amount || 0;
        }
      }
    });

    return monthlyData;
  } catch (error) {
    console.error('Error getting monthly spending:', error);
    return {};
  }
}

/**
 * Get recent activities for a project
 */
export async function getProjectRecentActivities(projectId: string, limit: number = 10) {
  try {
    const { data, error } = await supabase
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
      .limit(limit);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching project activities:', error);
    return [];
  }
}

/**
 * Get top suppliers by spending for a project
 */
export async function getProjectTopSuppliers(projectId: string, limit: number = 5) {
  try {
    // Get invoices with supplier info
    const { data: invoiceLinks } = await supabase
      .from('invoice_project_links')
      .select(`
        invoice:invoices (
          amount,
          supplier_name,
          supplier_vkn
        )
      `)
      .eq('project_id', projectId);

    // Get informal payments with supplier info
    const { data: informalPayments } = await supabase
      .from('informal_payments')
      .select(`
        amount,
        supplier:suppliers (
          name,
          vkn
        )
      `)
      .eq('project_id', projectId);

    // Aggregate by supplier
    const supplierTotals: Record<string, { name: string; total: number; vkn?: string }> = {};

    // Process invoices
    invoiceLinks?.forEach((link: any) => {
      const invoice = link.invoice;
      if (invoice?.supplier_name) {
        const key = invoice.supplier_vkn || invoice.supplier_name;
        if (!supplierTotals[key]) {
          supplierTotals[key] = {
            name: invoice.supplier_name,
            total: 0,
            vkn: invoice.supplier_vkn,
          };
        }
        supplierTotals[key].total += invoice.amount || 0;
      }
    });

    // Process informal payments
    informalPayments?.forEach((payment: any) => {
      if (payment.supplier?.name) {
        const key = payment.supplier.vkn || payment.supplier.name;
        if (!supplierTotals[key]) {
          supplierTotals[key] = {
            name: payment.supplier.name,
            total: 0,
            vkn: payment.supplier.vkn,
          };
        }
        supplierTotals[key].total += payment.amount || 0;
      }
    });

    // Convert to array and sort
    const sortedSuppliers = Object.values(supplierTotals)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

    return sortedSuppliers;
  } catch (error) {
    console.error('Error fetching top suppliers:', error);
    return [];
  }
}
