/**
 * Supplier Management Functions
 * Tedarikçi yönetim fonksiyonları - Kategorilendirme ve atama işlemleri
 */

import { supabase } from '@/lib/supabase/client';
import type { Supplier } from '@/types';

// ========================================
// Supplier Listeleme Fonksiyonları
// ========================================

/**
 * Tüm supplier'ları getir (company_id'ye göre)
 */
export async function getAllSuppliers(companyId: string): Promise<Supplier[]> {

  
  const { data, error } = await supabase
    .from('suppliers')
    .select(`
      *,
      subcontractor:subcontractors!subcontractor_id(*)
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data || [];
}

/**
 * Atama bekleyen supplier'ları getir (pending)
 */
export async function getPendingSuppliers(companyId: string): Promise<Supplier[]> {

  
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('company_id', companyId)
    .eq('supplier_type', 'pending')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data || [];
}

/**
 * Taşeron olarak atanmış supplier'ları getir
 */
export async function getSubcontractorSuppliers(companyId: string): Promise<Supplier[]> {

  
  const { data, error } = await supabase
    .from('suppliers')
    .select(`
      *,
      subcontractor:subcontractors!subcontractor_id(*)
    `)
    .eq('company_id', companyId)
    .eq('supplier_type', 'subcontractor')
    .order('name', { ascending: true });
    
  if (error) throw error;
  return data || [];
}

/**
 * Fatura firması olarak atanmış supplier'ları getir
 */
export async function getInvoiceCompanySuppliers(companyId: string): Promise<Supplier[]> {

  
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('company_id', companyId)
    .eq('supplier_type', 'invoice_company')
    .order('name', { ascending: true });
    
  if (error) throw error;
  return data || [];
}

// ========================================
// Supplier İstatistik Fonksiyonları
// ========================================

export interface SupplierStats {
  pending: number;
  subcontractor: number;
  invoice_company: number;
  total: number;
  active: number;
}

/**
 * Supplier istatistiklerini getir
 */
export async function getSupplierStats(companyId: string): Promise<SupplierStats> {

  
  const { data, error } = await supabase
    .rpc('get_supplier_stats', { p_company_id: companyId });
    
  if (error) throw error;
  return data || { pending: 0, subcontractor: 0, invoice_company: 0, total: 0, active: 0 };
}

// ========================================
// Supplier Atama Fonksiyonları
// ========================================

export interface AssignToSubcontractorParams {
  supplierId: string;
  companyId: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

/**
 * Supplier'ı taşeron olarak ata
 * 1. Yeni subcontractor kaydı oluştur
 * 2. Supplier'ın supplier_type'ını 'subcontractor' yap
 * 3. Supplier'ın subcontractor_id'sini set et
 */
export async function assignToSubcontractor(params: AssignToSubcontractorParams): Promise<{ 
  supplier: Supplier; 
  subcontractor: any;
}> {

  
  // Önce supplier'ı getir
  const { data: supplier, error: supplierError } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', params.supplierId)
    .eq('company_id', params.companyId)
    .single();
    
  if (supplierError) throw supplierError;
  if (!supplier) throw new Error('Supplier bulunamadı');
  
  // Yeni subcontractor kaydı oluştur
  const { data: newSubcontractor, error: subError } = await supabase
    .from('subcontractors')
    .insert({
      company_id: params.companyId,
      name: supplier.name,
      tax_number: supplier.vkn,
      contact_person: params.contactPerson,
      phone: params.phone || supplier.phone,
      email: params.email || supplier.email,
      address: params.address || supplier.address,
      notes: params.notes,
      is_active: true,
      supplier_id: supplier.id
    })
    .select()
    .single();
    
  if (subError) throw subError;
  
  // Supplier'ı güncelle
  const { data: updatedSupplier, error: updateError } = await supabase
    .from('suppliers')
    .update({
      supplier_type: 'subcontractor',
      subcontractor_id: newSubcontractor.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', params.supplierId)
    .select()
    .single();
    
  if (updateError) throw updateError;
  
  return {
    supplier: updatedSupplier,
    subcontractor: newSubcontractor
  };
}

/**
 * Supplier'ı fatura firması olarak ata
 * Sadece supplier_type'ı 'invoice_company' yap
 */
export async function assignToInvoiceCompany(
  supplierId: string,
  companyId: string
): Promise<Supplier> {

  
  const { data, error } = await supabase
    .from('suppliers')
    .update({
      supplier_type: 'invoice_company',
      updated_at: new Date().toISOString()
    })
    .eq('id', supplierId)
    .eq('company_id', companyId)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

/**
 * Supplier'ı tekrar pending durumuna al (atamayı geri al)
 */
export async function unassignSupplier(
  supplierId: string,
  companyId: string
): Promise<Supplier> {

  
  // Önce supplier'ı getir
  const { data: supplier, error: fetchError } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', supplierId)
    .eq('company_id', companyId)
    .single();
    
  if (fetchError) throw fetchError;
  
  // Eğer taşeron ise, subcontractor kaydını pasif yap
  if (supplier.supplier_type === 'subcontractor' && supplier.subcontractor_id) {
    await supabase
      .from('subcontractors')
      .update({ is_active: false })
      .eq('id', supplier.subcontractor_id);
  }
  
  // Supplier'ı pending yap
  const { data, error } = await supabase
    .from('suppliers')
    .update({
      supplier_type: 'pending',
      subcontractor_id: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', supplierId)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

/**
 * Toplu atama: Birden fazla supplier'ı aynı anda ata
 */
export async function bulkAssignSuppliers(
  supplierIds: string[],
  companyId: string,
  assignType: 'subcontractor' | 'invoice_company'
): Promise<{ success: string[]; failed: string[] }> {
  const results = {
    success: [] as string[],
    failed: [] as string[]
  };
  
  for (const supplierId of supplierIds) {
    try {
      if (assignType === 'subcontractor') {
        await assignToSubcontractor({ supplierId, companyId });
      } else {
        await assignToInvoiceCompany(supplierId, companyId);
      }
      results.success.push(supplierId);
    } catch (error) {
      console.error(`Failed to assign supplier ${supplierId}:`, error);
      results.failed.push(supplierId);
    }
  }
  
  return results;
}

// ========================================
// Supplier Güncelleme Fonksiyonları
// ========================================

export interface UpdateSupplierParams {
  id: string;
  companyId: string;
  name?: string;
  vkn?: string;
  address?: string;
  tax_office?: string;
  phone?: string;
  email?: string;
  notes?: string;
  is_active?: boolean;
}

/**
 * Supplier bilgilerini güncelle
 */
export async function updateSupplier(params: UpdateSupplierParams): Promise<Supplier> {

  
  const { id, companyId, ...updateData } = params;
  
  const { data, error } = await supabase
    .from('suppliers')
    .update({
      ...updateData,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

// ========================================
// Supplier Arama ve Filtreleme
// ========================================

export interface SearchSuppliersParams {
  companyId: string;
  query?: string;
  supplierType?: 'pending' | 'subcontractor' | 'invoice_company';
  isActive?: boolean;
}

/**
 * Supplier'ları ara ve filtrele
 */
export async function searchSuppliers(params: SearchSuppliersParams): Promise<Supplier[]> {

  
  let query = supabase
    .from('suppliers')
    .select(`
      *,
      subcontractor:subcontractors(*)
    `)
    .eq('company_id', params.companyId);
    
  if (params.query) {
    query = query.or(`name.ilike.%${params.query}%,vkn.ilike.%${params.query}%`);
  }
  
  if (params.supplierType) {
    query = query.eq('supplier_type', params.supplierType);
  }
  
  if (params.isActive !== undefined) {
    query = query.eq('is_active', params.isActive);
  }
  
  const { data, error } = await query.order('name', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

// ========================================
// Manuel Ekleme Fonksiyonları
// ========================================

/**
 * Doğrudan taşeron olarak ekle (faturaya ihtiyaç duymadan)
 */
export async function createSubcontractor(
  companyId: string,
  name: string,
  vkn?: string
): Promise<Supplier> {
  try {
    // VKN temizle ve normalize et
    const normalizedVkn = vkn?.trim() || null;
    
    // VKN varsa format kontrolü
    if (normalizedVkn) {
      if (!/^\d{10,11}$/.test(normalizedVkn)) {
        throw new Error('VKN 10 veya 11 haneli rakam olmalıdır');
      }
    }
    
    // 1. Supplier kaydı oluştur
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert({
        company_id: companyId,
        name: name.trim(),
        vkn: normalizedVkn, // Artık nullable
        supplier_type: 'subcontractor',
        is_active: true,
      })
      .select()
      .single();

    if (supplierError) throw supplierError;

    // 2. Subcontractor kaydı oluştur
    const { data: subcontractor, error: subError } = await supabase
      .from('subcontractors')
      .insert({
        company_id: companyId,
        name: name.trim(),
        vkn: normalizedVkn, // VKN kolonu artık var
      })
      .select()
      .single();

    if (subError) throw subError;

    // 3. Supplier'ı subcontractor'a bağla
    const { error: updateError } = await supabase
      .from('suppliers')
      .update({ subcontractor_id: subcontractor.id })
      .eq('id', supplier.id);

    if (updateError) throw updateError;

    return { ...supplier, subcontractor_id: subcontractor.id };
  } catch (error: any) {
    console.error('Error creating subcontractor:', error);
    throw error;
  }
}

/**
 * Doğrudan fatura firması olarak ekle
 */
export async function createInvoiceCompany(
  companyId: string,
  name: string,
  vkn?: string
): Promise<Supplier> {
  try {
    // VKN temizle ve normalize et
    const normalizedVkn = vkn?.trim() || null;
    
    // VKN varsa format kontrolü
    if (normalizedVkn) {
      if (!/^\d{10,11}$/.test(normalizedVkn)) {
        throw new Error('VKN 10 veya 11 haneli rakam olmalıdır');
      }
    }
    
    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        company_id: companyId,
        name: name.trim(),
        vkn: normalizedVkn, // Artık nullable
        supplier_type: 'invoice_company',
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Error creating invoice company:', error);
    throw error;
  }
}

// ========================================
// Silme Fonksiyonları
// ========================================

/**
 * Supplier'ı sil (soft delete - is_active = false)
 * Güvenli yöntem: Faturalarda referans olabilir
 */
export async function deactivateSupplier(
  supplierId: string,
  companyId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('suppliers')
      .update({ is_active: false })
      .eq('id', supplierId)
      .eq('company_id', companyId);

    if (error) throw error;
  } catch (error: any) {
    console.error('Error deactivating supplier:', error);
    throw error;
  }
}

/**
 * Supplier'ı kalıcı olarak sil (hard delete)
 * DİKKAT: Sadece hiç kullanılmamış kayıtlar için
 */
export async function deleteSupplier(
  supplierId: string,
  companyId: string
): Promise<void> {
  try {
    // Önce kullanılıp kullanılmadığını kontrol et
    const { data: invoices, error: checkError } = await supabase
      .from('invoices')
      .select('id')
      .eq('supplier_id', supplierId)
      .limit(1);

    if (checkError) throw checkError;

    if (invoices && invoices.length > 0) {
      throw new Error('Bu firma faturalarda kullanılmış, silinemez. Sadece deaktif edilebilir.');
    }

    // Subcontractor kaydını da sil (eğer varsa)
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('subcontractor_id')
      .eq('id', supplierId)
      .single();

    if (supplier?.subcontractor_id) {
      await supabase
        .from('subcontractors')
        .delete()
        .eq('id', supplier.subcontractor_id);
    }

    // Supplier'ı sil
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', supplierId)
      .eq('company_id', companyId);

    if (error) throw error;
  } catch (error: any) {
    console.error('Error deleting supplier:', error);
    throw error;
  }
}
