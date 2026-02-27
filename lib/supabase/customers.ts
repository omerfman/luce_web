/**
 * Customer Management Functions
 * 
 * Müşteri (customer) yönetimi için yardımcı fonksiyonlar.
 * VKN bazlı müşteri bilgilerini cache'ler ve otomatik doldurma sağlar.
 */

import { supabase } from '@/lib/supabase/client';

export interface Customer {
  id: string;
  company_id: string;
  vkn: string;
  name: string;
  address?: string;
  tax_office?: string;
  phone?: string;
  email?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * VKN'ye göre müşteri bilgisini getirir
 * 
 * @param vkn - Vergi Kimlik Numarası (10-11 hane)
 * @param companyId - Şirket ID (RLS için)
 * @returns Müşteri bilgisi veya null
 */
export async function getCustomerByVKN(
  vkn: string,
  companyId: string
): Promise<Customer | null> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', companyId)
      .eq('vkn', vkn)
      .single();

    if (error) {
      // Not found is expected, other errors should be logged
      if (error.code !== 'PGRST116') {
        console.error('Error fetching customer by VKN:', error);
      }
      return null;
    }

    return data as Customer;
  } catch (error) {
    console.error('Unexpected error in getCustomerByVKN:', error);
    return null;
  }
}

/**
 * Yeni müşteri kaydı oluşturur
 * 
 * @param vkn - Vergi Kimlik Numarası
 * @param name - Firma adı
 * @param companyId - Şirket ID
 * @param additionalData - Ek bilgiler (adres, vergi dairesi, vb.)
 * @returns Oluşturulan müşteri bilgisi veya null
 */
export async function createCustomer(
  vkn: string,
  name: string,
  companyId: string,
  additionalData?: {
    address?: string;
    tax_office?: string;
    phone?: string;
    email?: string;
    notes?: string;
  }
): Promise<Customer | null> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .insert([
        {
          company_id: companyId,
          vkn,
          name,
          is_active: true,
          ...additionalData,
        },
      ])
      .select()
      .single();

    if (error) {
      // Duplicate VKN error (unique constraint violation)
      if (error.code === '23505') {
        console.warn(`Customer with VKN ${vkn} already exists`);
        // Try to fetch existing record
        return await getCustomerByVKN(vkn, companyId);
      }
      console.error('Error creating customer:', error);
      return null;
    }

    return data as Customer;
  } catch (error) {
    console.error('Unexpected error in createCustomer:', error);
    return null;
  }
}

/**
 * Mevcut müşteriyi getirir, yoksa yeni oluşturur (Get or Create)
 * Eğer mevcut kayıtta isim "Bilinmeyen Müşteri" veya boşsa ve yeni bir isim sağlanmışsa, kaydı günceller
 * 
 * @param vkn - Vergi Kimlik Numarası
 * @param name - Firma adı
 * @param companyId - Şirket ID
 * @returns Müşteri bilgisi
 */
export async function getOrCreateCustomer(
  vkn: string,
  name: string,
  companyId: string
): Promise<Customer | null> {
  // Önce mevcut kaydı kontrol et
  const existing = await getCustomerByVKN(vkn, companyId);
  if (existing) {
    // Eğer mevcut kayıtta isim "Bilinmeyen Müşteri" veya boşsa ve yeni bir isim sağlanmışsa, güncelle
    const needsUpdate = 
      name && 
      name.trim() !== '' && 
      name !== 'Bilinmeyen Müşteri' &&
      (!existing.name || existing.name === 'Bilinmeyen Müşteri' || existing.name.trim() === '');
    
    if (needsUpdate) {
      console.log(`Updating customer name for VKN ${vkn}: "${existing.name}" -> "${name}"`);
      const updated = await updateCustomer(existing.id, { name });
      return updated || existing;
    }
    
    return existing;
  }

  // Yoksa yeni oluştur
  return await createCustomer(vkn, name, companyId);
}

/**
 * Müşteri bilgilerini günceller
 * 
 * @param customerId - Müşteri ID
 * @param updates - Güncellenecek alanlar
 * @returns Güncellenmiş müşteri bilgisi veya null
 */
export async function updateCustomer(
  customerId: string,
  updates: Partial<Omit<Customer, 'id' | 'company_id' | 'created_at' | 'updated_at'>>
): Promise<Customer | null> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId)
      .select()
      .single();

    if (error) {
      console.error('Error updating customer:', error);
      return null;
    }

    return data as Customer;
  } catch (error) {
    console.error('Unexpected error in updateCustomer:', error);
    return null;
  }
}

/**
 * Şirketteki tüm müşterileri getirir
 * 
 * @param companyId - Şirket ID
 * @param activeOnly - Sadece aktif müşteriler
 * @returns Müşteri listesi
 */
export async function getAllCustomers(
  companyId: string,
  activeOnly: boolean = true
): Promise<Customer[]> {
  try {
    let query = supabase
      .from('customers')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching customers:', error);
      return [];
    }

    return data as Customer[];
  } catch (error) {
    console.error('Unexpected error in getAllCustomers:', error);
    return [];
  }
}

/**
 * Müşteriyi pasif yapar (soft delete)
 * 
 * @param customerId - Müşteri ID
 * @returns Başarı durumu
 */
export async function deactivateCustomer(customerId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', customerId);

    if (error) {
      console.error('Error deactivating customer:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error in deactivateCustomer:', error);
    return false;
  }
}

/**
 * Müşteriyi tekrar aktif yapar
 * 
 * @param customerId - Müşteri ID
 * @returns Başarı durumu
 */
export async function activateCustomer(customerId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('customers')
      .update({ is_active: true })
      .eq('id', customerId);

    if (error) {
      console.error('Error activating customer:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error in activateCustomer:', error);
    return false;
  }
}

/**
 * Müşteriyi tamamen siler (dikkatli kullanılmalı!)
 * 
 * @param customerId - Müşteri ID
 * @returns Başarı durumu
 */
export async function deleteCustomer(customerId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId);

    if (error) {
      console.error('Error deleting customer:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error in deleteCustomer:', error);
    return false;
  }
}
