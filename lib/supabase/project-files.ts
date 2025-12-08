import { supabase } from '@/lib/supabase/client';
import { ProjectFile, TechnicalCategory } from '@/types';

/**
 * Get project files by category
 */
export async function getProjectFiles(
  projectId: string,
  category?: TechnicalCategory
): Promise<ProjectFile[]> {
  try {
    let query = supabase
      .from('project_files')
      .select(`
        *,
        user:users(id, name, email)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching project files:', error);
    throw error;
  }
}

/**
 * Get file statistics for a project
 */
export async function getProjectFileStats(projectId: string): Promise<{
  totalFiles: number;
  totalSize: number;
  byCategory: Record<string, { count: number; size: number }>;
}> {
  try {
    const { data, error } = await supabase
      .from('project_files')
      .select('category, file_size')
      .eq('project_id', projectId);

    if (error) throw error;

    const byCategory: Record<string, { count: number; size: number }> = {
      statik: { count: 0, size: 0 },
      mimari: { count: 0, size: 0 },
      mekanik: { count: 0, size: 0 },
      elektrik: { count: 0, size: 0 },
      zemin_etudu: { count: 0, size: 0 },
      geoteknik: { count: 0, size: 0 },
      ic_tasarim: { count: 0, size: 0 },
      '3d': { count: 0, size: 0 },
    };

    data?.forEach((file) => {
      if (file.category in byCategory) {
        byCategory[file.category].count++;
        byCategory[file.category].size += file.file_size;
      }
    });

    const stats = {
      totalFiles: data?.length || 0,
      totalSize: data?.reduce((sum, file) => sum + file.file_size, 0) || 0,
      byCategory,
    };

    return stats;
  } catch (error) {
    console.error('Error fetching file stats:', error);
    throw error;
  }
}

/**
 * Delete a project file
 */
export async function deleteProjectFile(fileId: string): Promise<void> {
  try {
    const response = await fetch(`/api/upload?fileId=${fileId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Dosya silinirken bir hata oluştu');
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

/**
 * Upload a project file
 */
export async function uploadProjectFile(
  file: File,
  projectId: string,
  category: TechnicalCategory,
  userId: string,
  companyId: string
): Promise<ProjectFile> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('category', category);
    formData.append('userId', userId);
    formData.append('companyId', companyId);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Dosya yüklenirken bir hata oluştu');
    }

    const result = await response.json();
    return result.file;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

/**
 * Format file size to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file icon based on file type
 */
export function getFileIcon(fileType: string): string {
  if (fileType.startsWith('image/')) return '🖼️';
  if (fileType === 'application/pdf') return '📄';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  if (fileType.includes('dwg') || fileType.includes('dxf') || fileType.includes('acad')) return '📐';
  if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('7z')) return '📦';
  return '📁';
}
