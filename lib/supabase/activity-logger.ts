/**
 * Activity Logger - Centralized logging utility for all user actions
 * 
 * This module provides functions to log user activities across the application.
 * All logs are stored in the activity_logs table and are subject to RLS policies.
 */

import { supabase } from './client';

// ============================================================================
// TYPES
// ============================================================================

export type ActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'assign'
  | 'unassign'
  | 'upload'
  | 'download'
  | 'login'
  | 'logout'
  | 'view';

export type ResourceType =
  | 'project'
  | 'invoice'
  | 'user'
  | 'role'
  | 'company'
  | 'subcontractor'
  | 'informal_payment'
  | 'payment'
  | 'file'
  | 'invoice_project_link'
  | 'supplier'
  | 'system';

export interface ActivityLog {
  id: string;
  user_id: string;
  company_id: string | null;
  action_type: ActionType;
  resource_type: ResourceType;
  resource_id: string | null;
  description: string;
  changes: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
  // Relations
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface LogActivityParams {
  actionType: ActionType;
  resourceType: ResourceType;
  resourceId?: string;
  description?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ActivityLogFilters {
  userId?: string;
  companyId?: string;
  actionType?: ActionType;
  resourceType?: ResourceType;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// MAIN LOG FUNCTION
// ============================================================================

/**
 * Log a user activity
 * 
 * This function automatically captures the current user and company context.
 * It should be called after any significant user action.
 * 
 * @example
 * await logActivity({
 *   actionType: 'create',
 *   resourceType: 'project',
 *   resourceId: newProject.id,
 *   description: `Yeni proje oluşturuldu: ${newProject.name}`,
 *   changes: { new: newProject }
 * });
 */
export async function logActivity(params: LogActivityParams): Promise<string | null> {
  try {
    const {
      actionType,
      resourceType,
      resourceId,
      description,
      changes = {},
      metadata = {},
    } = params;

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Error getting user for activity log:', userError);
      return null;
    }

    // Get user's company
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (userDataError) {
      console.error('Error getting user company:', userDataError);
      return null;
    }

    // Add browser/system metadata
    const enrichedMetadata = {
      ...metadata,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : null,
      timestamp: new Date().toISOString(),
    };

    // Call database function to log activity
    const { data, error } = await supabase.rpc('log_activity', {
      p_user_id: user.id,
      p_company_id: userData.company_id,
      p_action_type: actionType,
      p_resource_type: resourceType,
      p_resource_id: resourceId || null,
      p_description: description || null,
      p_changes: changes,
      p_metadata: enrichedMetadata,
    });

    if (error) {
      console.error('Error logging activity:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception in logActivity:', error);
    return null;
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get activity logs with optional filters
 * 
 * This function respects RLS policies:
 * - Regular users see only their own logs
 * - Company admins see all logs in their company
 * - Super admins see all logs
 */
export async function getActivityLogs(
  filters: ActivityLogFilters = {}
): Promise<{ logs: ActivityLog[]; total: number }> {
  try {
    const {
      userId,
      companyId,
      actionType,
      resourceType,
      resourceId,
      startDate,
      endDate,
      search,
      limit = 50,
      offset = 0,
    } = filters;

    // Build query
    let query = supabase
      .from('activity_logs')
      .select(
        `
        *,
        user:users(id, name, email)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    // Apply filters
    if (userId) query = query.eq('user_id', userId);
    if (companyId) query = query.eq('company_id', companyId);
    if (actionType) query = query.eq('action_type', actionType);
    if (resourceType) query = query.eq('resource_type', resourceType);
    if (resourceId) query = query.eq('resource_id', resourceId);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    // Text search (searches in description)
    if (search) {
      query = query.ilike('description', `%${search}%`);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching activity logs:', error);
      return { logs: [], total: 0 };
    }

    return {
      logs: (data as ActivityLog[]) || [],
      total: count || 0,
    };
  } catch (error) {
    console.error('Exception in getActivityLogs:', error);
    return { logs: [], total: 0 };
  }
}

/**
 * Get activity logs for a specific resource
 * 
 * Useful for showing activity history on detail pages.
 * 
 * @example
 * const logs = await getResourceActivityLogs('project', projectId);
 */
export async function getResourceActivityLogs(
  resourceType: ResourceType,
  resourceId: string,
  limit: number = 20
): Promise<ActivityLog[]> {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select(
        `
        *,
        user:users(id, name, email)
      `
      )
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching resource activity logs:', error);
      return [];
    }

    return (data as ActivityLog[]) || [];
  } catch (error) {
    console.error('Exception in getResourceActivityLogs:', error);
    return [];
  }
}

/**
 * Get activity statistics
 * 
 * Returns activity counts grouped by action type and resource type.
 */
export async function getActivityStats(
  companyId?: string,
  startDate?: string,
  endDate?: string
): Promise<{
  byAction: Record<string, number>;
  byResource: Record<string, number>;
  total: number;
}> {
  try {
    let query = supabase.from('activity_logs').select('action_type, resource_type');

    if (companyId) query = query.eq('company_id', companyId);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query;

    if (error || !data) {
      console.error('Error fetching activity stats:', error);
      return { byAction: {}, byResource: {}, total: 0 };
    }

    // Count by action type
    const byAction: Record<string, number> = {};
    const byResource: Record<string, number> = {};

    data.forEach((log) => {
      byAction[log.action_type] = (byAction[log.action_type] || 0) + 1;
      byResource[log.resource_type] = (byResource[log.resource_type] || 0) + 1;
    });

    return {
      byAction,
      byResource,
      total: data.length,
    };
  } catch (error) {
    console.error('Exception in getActivityStats:', error);
    return { byAction: {}, byResource: {}, total: 0 };
  }
}

/**
 * Get recent activities (last 24 hours)
 * 
 * Useful for dashboards and notifications.
 */
export async function getRecentActivities(limit: number = 10): Promise<ActivityLog[]> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return (
    await getActivityLogs({
      startDate: yesterday.toISOString(),
      limit,
    })
  ).logs;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a human-readable description for an activity
 * 
 * @example
 * generateDescription('create', 'project', 'My New Project')
 * // Returns: "Yeni proje oluşturuldu: My New Project"
 */
export function generateDescription(
  action: ActionType,
  resource: ResourceType,
  resourceName?: string
): string {
  // Basit ve anlaşılır Türkçe açıklamalar
  if (action === 'create') {
    if (resource === 'project') return resourceName ? `"${resourceName}" adlı proje oluşturuldu` : 'Yeni proje oluşturuldu';
    if (resource === 'invoice') return resourceName ? `"${resourceName}" numaralı fatura eklendi` : 'Yeni fatura eklendi';
    if (resource === 'user') return resourceName ? `"${resourceName}" adlı kullanıcı eklendi` : 'Yeni kullanıcı eklendi';
    if (resource === 'subcontractor') return resourceName ? `"${resourceName}" adlı taşeron firma eklendi` : 'Yeni taşeron firma eklendi';
    if (resource === 'informal_payment') return 'Yeni gayri resmi ödeme kaydedildi';
    if (resource === 'payment') return 'Yeni ödeme kaydedildi';
    return 'Yeni kayıt oluşturuldu';
  }
  
  if (action === 'update') {
    if (resource === 'project') return resourceName ? `"${resourceName}" projesinin bilgileri güncellendi` : 'Proje bilgileri güncellendi';
    if (resource === 'invoice') return resourceName ? `"${resourceName}" numaralı fatura güncellendi` : 'Fatura bilgileri güncellendi';
    if (resource === 'user') return resourceName ? `"${resourceName}" kullanıcısının bilgileri güncellendi` : 'Kullanıcı bilgileri güncellendi';
    if (resource === 'subcontractor') return resourceName ? `"${resourceName}" taşeron firmasının bilgileri güncellendi` : 'Taşeron firma bilgileri güncellendi';
    if (resource === 'informal_payment') return 'Gayri resmi ödeme güncellendi';
    return 'Kayıt güncellendi';
  }
  
  if (action === 'delete') {
    if (resource === 'project') return resourceName ? `"${resourceName}" adlı proje silindi` : 'Proje silindi';
    if (resource === 'invoice') return resourceName ? `"${resourceName}" numaralı fatura silindi` : 'Fatura silindi';
    if (resource === 'user') return resourceName ? `"${resourceName}" adlı kullanıcı silindi` : 'Kullanıcı silindi';
    if (resource === 'subcontractor') return resourceName ? `"${resourceName}" adlı taşeron firma silindi` : 'Taşeron firma silindi';
    if (resource === 'informal_payment') return 'Gayri resmi ödeme silindi';
    return 'Kayıt silindi';
  }
  
  if (action === 'upload') return resourceName ? `"${resourceName}" dosyası yüklendi` : 'Dosya yüklendi';
  if (action === 'download') return resourceName ? `"${resourceName}" dosyası indirildi` : 'Dosya indirildi';
  if (action === 'assign') return 'Atama yapıldı';
  if (action === 'unassign') return 'Atama kaldırıldı';
  
  return 'İşlem gerçekleştirildi';
}

/**
 * Get icon for activity type
 */
export function getActivityIcon(action: ActionType): string {
  const icons: Record<ActionType, string> = {
    create: '➕',
    update: '✏️',
    delete: '🗑️',
    assign: '🔗',
    unassign: '⛓️‍💥',
    upload: '📤',
    download: '📥',
    login: '🟢',
    logout: '🔴',
    view: '👁️',
  };

  return icons[action] || '•';
}

/**
 * Get color class for activity type
 */
export function getActivityColor(action: ActionType): string {
  const colors: Record<ActionType, string> = {
    create: 'bg-green-100 text-green-800 border-green-200',
    update: 'bg-blue-100 text-blue-800 border-blue-200',
    delete: 'bg-red-100 text-red-800 border-red-200',
    assign: 'bg-purple-100 text-purple-800 border-purple-200',
    unassign: 'bg-orange-100 text-orange-800 border-orange-200',
    upload: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    download: 'bg-teal-100 text-teal-800 border-teal-200',
    login: 'bg-green-100 text-green-800 border-green-200',
    logout: 'bg-gray-100 text-gray-800 border-gray-200',
    view: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return colors[action] || 'bg-gray-100 text-gray-800 border-gray-200';
}

/**
 * Format activity timestamp
 */
export function formatActivityTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Az önce';
  if (diffMins < 60) return `${diffMins} dakika önce`;
  if (diffHours < 24) return `${diffHours} saat önce`;
  if (diffDays === 1) return 'Dün';
  if (diffDays < 7) return `${diffDays} gün önce`;

  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// CHANGES FORMATTING
// ============================================================================

/**
 * Türkçe alan isimleri
 */
const FIELD_NAMES_TR: Record<string, string> = {
  // Genel
  name: 'İsim',
  description: 'Açıklama',
  status: 'Durum',
  created_at: 'Oluşturma Tarihi',
  updated_at: 'Güncelleme Tarihi',
  notes: 'Notlar',
  
  // Proje
  start_date: 'Başlangıç Tarihi',
  end_date: 'Bitiş Tarihi',
  project_id: 'Proje',
  
  // Fatura
  invoice_number: 'Fatura Numarası',
  invoice_date: 'Fatura Tarihi',
  amount: 'Tutar',
  vat_rate: 'KDV Oranı',
  vat_amount: 'KDV Tutarı',
  total_amount: 'Toplam Tutar',
  total: 'Toplam',
  due_date: 'Vade Tarihi',
  payment_status: 'Ödeme Durumu',
  invoice_id: 'Fatura',
  supplier_id: 'Tedarikçi',
  
  // Kullanıcı
  email: 'E-posta',
  phone: 'Telefon',
  role_id: 'Rol',
  password: 'Şifre',
  last_seen_at: 'Son Görülme',
  
  // Taşeron
  contact_person: 'İletişim Kişisi',
  tax_number: 'Vergi Numarası',
  tax_office: 'Vergi Dairesi',
  address: 'Adres',
  city: 'Şehir',
  district: 'İlçe',
  postal_code: 'Posta Kodu',
  bank_name: 'Banka Adı',
  iban: 'IBAN',
  subcontractor_id: 'Taşeron Firma',
  
  // Ödeme
  payment_date: 'Ödeme Tarihi',
  payment_method: 'Ödeme Yöntemi',
  receipt_number: 'Makbuz Numarası',
  receipt_image: 'Makbuz Görseli',
  is_approved: 'Onay Durumu',
  approved_by: 'Onaylayan',
  approved_at: 'Onay Tarihi',
  
  // Dosya
  file_name: 'Dosya Adı',
  file_url: 'Dosya URL',
  file_type: 'Dosya Tipi',
  file_size: 'Dosya Boyutu',
  category: 'Kategori',
  folder: 'Klasör',
  
  // Şirket
  company_name: 'Şirket Adı',
  company_id: 'Şirket',
  website: 'Website',
  
  // İlişkili kayıt isimleri (trigger'lar tarafından eklenir)
  project_name: 'Proje',
  subcontractor_name: 'Taşeron Firma',
  supplier_name: 'Tedarikçi',
  uploaded_by_name: 'Yükleyen',
  created_by_name: 'Oluşturan',
  updated_by_name: 'Güncelleyen',
  
  // Diğer
  type: 'Tip',
  priority: 'Öncelik',
  deadline: 'Son Tarih',
  assigned_to: 'Atanan Kişi',
  department: 'Departman',
  location: 'Lokasyon',
  budget: 'Bütçe',
  progress: 'İlerleme',
  quality_score: 'Kalite Skoru',
};

/**
 * Durum değerlerini Türkçe'ye çevir
 */
function formatStatusValue(value: any): string {
  const statusMap: Record<string, string> = {
    planned: 'Planlanıyor',
    active: 'Aktif',
    on_hold: 'Beklemede',
    completed: 'Tamamlandı',
    cancelled: 'İptal',
    
    pending: 'Bekliyor',
    paid: 'Ödendi',
    partially_paid: 'Kısmi Ödendi',
    overdue: 'Gecikmiş',
    
    cash: 'Nakit',
    bank_transfer: 'Banka Havalesi',
    credit_card: 'Kredi Kartı',
    check: 'Çek',
  };
  
  return statusMap[value] || value;
}

/**
 * Değeri okunabilir formata çevir
 */
function formatValue(key: string, value: any): string {
  if (value === null || value === undefined) return '-';
  
  // Boolean
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  
  // Tarih alanları
  if (key.includes('date') || key.includes('_at')) {
    try {
      return new Date(value).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return value;
    }
  }
  
  // Tutar alanları
  if (key.includes('amount') || key === 'price') {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
      }).format(num);
    }
  }
  
  // Status alanları
  if (key.includes('status') || key === 'payment_method') {
    return formatStatusValue(value);
  }
  
  return String(value);
}

/**
 * Değişiklikleri insan tarafından okunabilir formata çevir
 * 
 * @example
 * const changes = { old: { name: 'Eski', status: 'planned' }, new: { name: 'Yeni', status: 'active' } };
 * const formatted = formatChangesForDisplay(changes, 'project');
 * // Returns: [
 * //   { field: 'İsim', oldValue: 'Eski', newValue: 'Yeni' },
 * //   { field: 'Durum', oldValue: 'Planlanıyor', newValue: 'Aktif' }
 * // ]
 */
export interface ChangeDetail {
  field: string;
  oldValue: string;
  newValue: string;
  isAdded?: boolean;
  isRemoved?: boolean;
}

/**
 * Değişiklikleri insan tarafından okunabilir formata çevir
 * TÜM değişiklikleri gösterir (sadece teknik alanları gizler)
 */
export function formatChangesForDisplay(
  changes: any
): ChangeDetail[] {
  if (!changes) return [];
  
  const result: ChangeDetail[] = [];
  
  // Gizlenecek teknik alanlar
  const hiddenFields = [
    'id',
    'created_at',
    'updated_at',
    'company_id',
    'user_id',
    'created_by',      // UUID yerine created_by_name göster
    'updated_by',      // UUID yerine updated_by_name göster
    'uploaded_by',     // UUID yerine uploaded_by_name göster
    'deleted_at',
    'deleted_by',
    'last_seen_at',    // Her sayfa değişiminde güncelleniyor, gereksiz
    'meta',            // Teknik metadata
    'metadata',        // Teknik metadata
    'user_agent',      // Teknik bilgi
    'ip_address',      // Teknik bilgi
  ];
  
  // Yeni kayıt (CREATE)
  if (changes.new && !changes.old) {
    const newData = changes.new;
    
    Object.keys(newData).forEach(field => {
      // Teknik alanları gizle
      if (hiddenFields.includes(field)) return;
      
      // ID alanlarını gizle (supplier_id, project_id gibi) - bunlar trigger'da zaten açıklama içinde
      if (field.endsWith('_id') && field !== 'role_id') return;
      
      const value = newData[field];
      if (value !== undefined && value !== null && value !== '') {
        result.push({
          field: FIELD_NAMES_TR[field] || field,
          oldValue: '',
          newValue: formatValue(field, value),
          isAdded: true,
        });
      }
    });
    
    return result;
  }
  
  // Silinen kayıt (DELETE)
  if (changes.old && !changes.new) {
    const oldData = changes.old;
    
    Object.keys(oldData).forEach(field => {
      // ID alanlarını gizle (supplier_id, project_id gibi) - bunlar trigger'da zaten açıklama içinde
      if (field.endsWith('_id') && field !== 'role_id') return;
      
      // Teknik alanları gizle
      if (hiddenFields.includes(field)) return;
      
      const value = oldData[field];
      if (value !== undefined && value !== null && value !== '') {
        result.push({
          field: FIELD_NAMES_TR[field] || field,
          oldValue: formatValue(field, value),
          newValue: '',
          isRemoved: true,
        });
      }
    });
    
    return result;
  }
  
  // Güncelleme (UPDATE)
  if (changes.old && changes.new) {
    const oldData = changes.old;
    const newData = changes.new;
    
    // Tüm alanları kontrol et
    const allFields = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    
    allFields.forEach(field => {
      // Teknik alanları gizle
      if (hiddenFields.includes(field)) return;
      
      // ID alanlarını gizle (supplier_id, project_id gibi) - bunlar trigger'da zaten açıklama içinde
      if (field.endsWith('_id') && field !== 'role_id') return;
      
      const oldValue = oldData[field];
      const newValue = newData[field];
      
      // Değişiklik varsa ekle (null, undefined ve empty string'i eşit say)
      const oldNormalized = (oldValue === null || oldValue === undefined || oldValue === '') ? null : oldValue;
      const newNormalized = (newValue === null || newValue === undefined || newValue === '') ? null : newValue;
      
      if (oldNormalized !== newNormalized) {
        result.push({
          field: FIELD_NAMES_TR[field] || field,
          oldValue: formatValue(field, oldValue),
          newValue: formatValue(field, newValue),
        });
      }
    });
    
    return result;
  }
  
  return [];
}
