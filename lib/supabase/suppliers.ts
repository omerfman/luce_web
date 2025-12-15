/**
 * Supplier Management Functions
 * 
 * Tedarikçi (supplier) yönetimi için yardımcı fonksiyonlar.
 * VKN bazlı firma bilgilerini cache'ler ve otomatik doldurma sağlar.
 */

import { supabase } from '@/lib/supabase/client';
import type { Supplier } from '@/types';

/**
 * VKN'ye göre tedarikçi bilgisini getirir
 * 
 * @param vkn - Vergi Kimlik Numarası (10-11 hane)
 * @param companyId - Şirket ID (RLS için)
 * @returns Tedarikçi bilgisi veya null
 */
export async function getSupplierByVKN(
  vkn: string,
  companyId: string
): Promise<Supplier | null> {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', companyId)
      .eq('vkn', vkn)
      .single();

    if (error) {
      // Not found is expected, other errors should be logged
      if (error.code !== 'PGRST116') {
        console.error('Error fetching supplier by VKN:', error);
      }
      return null;
    }

    return data as Supplier;
  } catch (error) {
    console.error('Unexpected error in getSupplierByVKN:', error);
    return null;
  }
}

/**
 * Yeni tedarikçi kaydı oluşturur
 * 
 * @param vkn - Vergi Kimlik Numarası
 * @param name - Firma adı
 * @param companyId - Şirket ID
 * @param additionalData - Ek bilgiler (adres, vergi dairesi, vb.)
 * @returns Oluşturulan tedarikçi bilgisi veya null
 */
export async function createSupplier(
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
): Promise<Supplier | null> {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .insert([
        {
          company_id: companyId,
          vkn,
          name,
          ...additionalData,
        },
      ])
      .select()
      .single();

    if (error) {
      // Duplicate VKN error (unique constraint violation)
      if (error.code === '23505') {
        console.warn(`Supplier with VKN ${vkn} already exists`);
        // Try to fetch existing record
        return await getSupplierByVKN(vkn, companyId);
      }
      console.error('Error creating supplier:', error);
      return null;
    }

    return data as Supplier;
  } catch (error) {
    console.error('Unexpected error in createSupplier:', error);
    return null;
  }
}

/**
 * Mevcut tedarikçi bilgilerini günceller
 * 
 * @param id - Tedarikçi ID
 * @param updates - Güncellenecek alanlar
 * @returns Güncellenmiş tedarikçi bilgisi veya null
 */
export async function updateSupplier(
  id: string,
  updates: Partial<Omit<Supplier, 'id' | 'company_id' | 'vkn' | 'created_at' | 'updated_at'>>
): Promise<Supplier | null> {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating supplier:', error);
      return null;
    }

    return data as Supplier;
  } catch (error) {
    console.error('Unexpected error in updateSupplier:', error);
    return null;
  }
}

/**
 * Şirkete ait tüm tedarikçileri getirir
 * 
 * @param companyId - Şirket ID
 * @returns Tedarikçi listesi
 */
export async function getAllSuppliers(companyId: string): Promise<Supplier[]> {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching suppliers:', error);
      return [];
    }

    return data as Supplier[];
  } catch (error) {
    console.error('Unexpected error in getAllSuppliers:', error);
    return [];
  }
}

/**
 * VKN'ye göre tedarikçi arar, yoksa yeni kayıt oluşturur
 * QR kod okuma işlemlerinde kullanılır
 * 
 * @param vkn - Vergi Kimlik Numarası
 * @param name - Firma adı
 * @param companyId - Şirket ID
 * @returns Tedarikçi bilgisi (mevcut veya yeni)
 */
export async function getOrCreateSupplier(
  vkn: string,
  name: string,
  companyId: string
): Promise<Supplier | null> {
  // Önce mevcut kaydı kontrol et
  const existing = await getSupplierByVKN(vkn, companyId);
  if (existing) {
    return existing;
  }

  // Yoksa yeni kayıt oluştur
  return await createSupplier(vkn, name, companyId);
}
