import { supabase } from './client';
import { InformalPayment } from '@/types';

/**
 * Filters for fetching informal payments
 */
export interface InformalPaymentFilters {
  projectId?: string;
  subcontractorId?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
}

/**
 * Get all informal payments with optional filters
 */
export async function getInformalPayments(
  filters?: InformalPaymentFilters
): Promise<InformalPayment[]> {
  let query = supabase
    .from('informal_payments')
    .select(`
      *,
      subcontractor:subcontractors(*),
      project:projects(*),
      user:users(id, name, email)
    `)
    .order('payment_date', { ascending: false });

  // Apply filters
  if (filters?.projectId) {
    query = query.eq('project_id', filters.projectId);
  }
  if (filters?.subcontractorId) {
    query = query.eq('subcontractor_id', filters.subcontractorId);
  }
  if (filters?.startDate) {
    query = query.gte('payment_date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('payment_date', filters.endDate);
  }
  if (filters?.paymentMethod) {
    query = query.eq('payment_method', filters.paymentMethod);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching informal payments:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get a single informal payment by ID
 */
export async function getInformalPaymentById(id: string): Promise<InformalPayment | null> {
  const { data, error } = await supabase
    .from('informal_payments')
    .select(`
      *,
      subcontractor:subcontractors(*),
      project:projects(*),
      user:users(id, name, email)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching informal payment:', error);
    throw error;
  }

  return data;
}

/**
 * Get informal payments for a specific project
 */
export async function getInformalPaymentsByProject(projectId: string): Promise<InformalPayment[]> {
  return getInformalPayments({ projectId });
}

/**
 * Get informal payments for a specific subcontractor
 */
export async function getInformalPaymentsBySubcontractor(
  subcontractorId: string
): Promise<InformalPayment[]> {
  return getInformalPayments({ subcontractorId });
}

/**
 * Create a new informal payment
 */
export async function createInformalPayment(
  payment: Omit<InformalPayment, 'id' | 'created_at' | 'updated_at' | 'subcontractor' | 'project' | 'user'>
): Promise<InformalPayment> {
  const { data, error } = await supabase
    .from('informal_payments')
    .insert(payment)
    .select(`
      *,
      subcontractor:subcontractors(*),
      project:projects(*),
      user:users(id, name, email)
    `)
    .single();

  if (error) {
    console.error('Error creating informal payment:', error);
    throw error;
  }

  return data;
}

/**
 * Update an existing informal payment
 */
export async function updateInformalPayment(
  id: string,
  updates: Partial<Omit<InformalPayment, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'company_id' | 'subcontractor' | 'project' | 'user'>>
): Promise<InformalPayment> {
  const { data, error } = await supabase
    .from('informal_payments')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      subcontractor:subcontractors(*),
      project:projects(*),
      user:users(id, name, email)
    `)
    .single();

  if (error) {
    console.error('Error updating informal payment:', error);
    throw error;
  }

  return data;
}

/**
 * Delete an informal payment
 */
export async function deleteInformalPayment(id: string): Promise<void> {
  const { error } = await supabase
    .from('informal_payments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting informal payment:', error);
    throw error;
  }
}

/**
 * Get total payments amount for a specific subcontractor
 */
export async function getTotalPaymentsBySubcontractor(
  subcontractorId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('informal_payments')
    .select('amount')
    .eq('subcontractor_id', subcontractorId);

  if (error) {
    console.error('Error fetching total payments:', error);
    throw error;
  }

  const total = data?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
  return total;
}

/**
 * Get total payments amount for a specific project
 */
export async function getTotalPaymentsByProject(projectId: string): Promise<number> {
  const { data, error } = await supabase
    .from('informal_payments')
    .select('amount')
    .eq('project_id', projectId);

  if (error) {
    console.error('Error fetching total payments:', error);
    throw error;
  }

  const total = data?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
  return total;
}

/**
 * Get payment statistics grouped by subcontractor
 */
export async function getPaymentStatsBySubcontractor(): Promise<
  Array<{ subcontractor_id: string; total: number; count: number }>
> {
  const { data, error } = await supabase
    .from('informal_payments')
    .select('subcontractor_id, amount');

  if (error) {
    console.error('Error fetching payment stats:', error);
    throw error;
  }

  // Group by subcontractor_id
  const stats = data?.reduce((acc, payment) => {
    const existing = acc.find(item => item.subcontractor_id === payment.subcontractor_id);
    if (existing) {
      existing.total += Number(payment.amount);
      existing.count += 1;
    } else {
      acc.push({
        subcontractor_id: payment.subcontractor_id,
        total: Number(payment.amount),
        count: 1,
      });
    }
    return acc;
  }, [] as Array<{ subcontractor_id: string; total: number; count: number }>);

  return stats || [];
}

/**
 * Get payment statistics grouped by payment method
 */
export async function getPaymentStatsByMethod(): Promise<
  Array<{ payment_method: string; total: number; count: number }>
> {
  const { data, error } = await supabase
    .from('informal_payments')
    .select('payment_method, amount');

  if (error) {
    console.error('Error fetching payment stats:', error);
    throw error;
  }

  // Group by payment_method
  const stats = data?.reduce((acc, payment) => {
    const method = payment.payment_method || 'Belirtilmemiş';
    const existing = acc.find(item => item.payment_method === method);
    if (existing) {
      existing.total += Number(payment.amount);
      existing.count += 1;
    } else {
      acc.push({
        payment_method: method,
        total: Number(payment.amount),
        count: 1,
      });
    }
    return acc;
  }, [] as Array<{ payment_method: string; total: number; count: number }>);

  return stats || [];
}

/**
 * Get recent informal payments (last N payments)
 */
export async function getRecentInformalPayments(limit: number = 5): Promise<InformalPayment[]> {
  const { data, error } = await supabase
    .from('informal_payments')
    .select(`
      *,
      subcontractor:subcontractors(*),
      project:projects(*),
      user:users(id, name, email)
    `)
    .order('payment_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent payments:', error);
    throw error;
  }

  return data || [];
}
