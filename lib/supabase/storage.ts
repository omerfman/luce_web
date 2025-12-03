import { supabase } from './client';

/**
 * File validation constants
 */
export const FILE_VALIDATION = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['application/pdf'],
  ALLOWED_EXTENSIONS: ['.pdf'],
} as const;

/**
 * Validate file before upload
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > FILE_VALIDATION.MAX_SIZE) {
    return {
      valid: false,
      error: `Dosya boyutu çok büyük. Maksimum ${FILE_VALIDATION.MAX_SIZE / 1024 / 1024}MB olmalıdır.`,
    };
  }

  // Check file type
  if (!FILE_VALIDATION.ALLOWED_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: 'Sadece PDF dosyaları yüklenebilir.',
    };
  }

  // Check file extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!FILE_VALIDATION.ALLOWED_EXTENSIONS.includes(extension as any)) {
    return {
      valid: false,
      error: 'Geçersiz dosya uzantısı. Sadece .pdf dosyaları kabul edilir.',
    };
  }

  return { valid: true };
}

/**
 * Generate storage path for invoice PDF
 */
export function generateInvoicePath(companyId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  return `${companyId}/${year}/${month}/${timestamp}_${sanitizedFilename}`;
}

/**
 * Upload invoice PDF to Supabase Storage
 */
export async function uploadInvoicePDF(
  file: File,
  companyId: string
): Promise<{ success: true; path: string; url: string } | { success: false; error: string }> {
  try {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error! };
    }

    // Generate path
    const path = generateInvoicePath(companyId, file.name);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage.from('invoices').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      console.error('Storage upload error:', error);
      return { success: false, error: 'Dosya yüklenirken bir hata oluştu.' };
    }

    // Return path (not public URL since bucket is private)
    return {
      success: true,
      path: data.path,
      url: data.path, // Just return path, we'll use signed URLs to access it
    };
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

/**
 * Get signed URL for invoice PDF (temporary access)
 */
export async function getInvoiceSignedURL(
  path: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('Signed URL error:', error);
      return { success: false, error: 'URL oluşturulamadı.' };
    }

    return { success: true, url: data.signedUrl };
  } catch (error) {
    console.error('Signed URL error:', error);
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

/**
 * Delete invoice PDF from storage
 */
export async function deleteInvoicePDF(
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage.from('invoices').remove([path]);

    if (error) {
      console.error('Storage delete error:', error);
      return { success: false, error: 'Dosya silinirken bir hata oluştu.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete error:', error);
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

/**
 * Download invoice PDF
 */
export async function downloadInvoicePDF(
  path: string,
  filename?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.storage.from('invoices').download(path);

    if (error) {
      console.error('Storage download error:', error);
      return { success: false, error: 'Dosya indirilemedi.' };
    }

    // Create download link
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || path.split('/').pop() || 'invoice.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error('Download error:', error);
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

/**
 * Get storage statistics for company
 */
export async function getStorageStats(companyId: string) {
  try {
    const { data, error } = await supabase
      .from('storage_stats')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error) {
      console.error('Storage stats error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Storage stats error:', error);
    return null;
  }
}

/**
 * List all invoices in company folder
 */
export async function listCompanyInvoices(companyId: string) {
  try {
    const { data, error } = await supabase.storage.from('invoices').list(companyId, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (error) {
      console.error('Storage list error:', error);
      return [];
    }

    return data;
  } catch (error) {
    console.error('Storage list error:', error);
    return [];
  }
}
