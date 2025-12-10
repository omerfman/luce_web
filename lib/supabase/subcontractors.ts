import { supabase } from './client';
import { Subcontractor } from '@/types';

/**
 * Get all active subcontractors for the current user's company
 */
export async function getSubcontractors(): Promise<Subcontractor[]> {
  const { data, error } = await supabase
    .from('subcontractors')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching subcontractors:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get a single subcontractor by ID
 */
export async function getSubcontractorById(id: string): Promise<Subcontractor | null> {
  const { data, error } = await supabase
    .from('subcontractors')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching subcontractor:', error);
    throw error;
  }

  return data;
}

/**
 * Create a new subcontractor
 */
export async function createSubcontractor(
  subcontractor: Omit<Subcontractor, 'id' | 'created_at' | 'updated_at'>
): Promise<Subcontractor> {
  const { data, error } = await supabase
    .from('subcontractors')
    .insert(subcontractor)
    .select()
    .single();

  if (error) {
    console.error('Error creating subcontractor:', error);
    throw error;
  }

  return data;
}

/**
 * Update an existing subcontractor
 */
export async function updateSubcontractor(
  id: string,
  updates: Partial<Omit<Subcontractor, 'id' | 'created_at' | 'updated_at' | 'company_id'>>
): Promise<Subcontractor> {
  const { data, error } = await supabase
    .from('subcontractors')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating subcontractor:', error);
    throw error;
  }

  return data;
}

/**
 * Soft delete a subcontractor (set is_active = false)
 */
export async function deleteSubcontractor(id: string): Promise<void> {
  const { error } = await supabase
    .from('subcontractors')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    console.error('Error deleting subcontractor:', error);
    throw error;
  }
}

/**
 * Hard delete a subcontractor (permanent deletion)
 * Use with caution - only if no related payments exist
 */
export async function hardDeleteSubcontractor(id: string): Promise<void> {
  const { error } = await supabase
    .from('subcontractors')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error hard deleting subcontractor:', error);
    throw error;
  }
}

/**
 * Search subcontractors by name, contact person, phone, or email
 */
export async function searchSubcontractors(query: string): Promise<Subcontractor[]> {
  const { data, error } = await supabase
    .from('subcontractors')
    .select('*')
    .eq('is_active', true)
    .or(`name.ilike.%${query}%,contact_person.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error searching subcontractors:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get all subcontractors including inactive ones (for admin purposes)
 */
export async function getAllSubcontractors(): Promise<Subcontractor[]> {
  const { data, error } = await supabase
    .from('subcontractors')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching all subcontractors:', error);
    throw error;
  }

  return data || [];
}

/**
 * Reactivate a soft-deleted subcontractor
 */
export async function reactivateSubcontractor(id: string): Promise<Subcontractor> {
  const { data, error } = await supabase
    .from('subcontractors')
    .update({ is_active: true })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error reactivating subcontractor:', error);
    throw error;
  }

  return data;
}
