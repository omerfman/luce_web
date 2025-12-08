'use client';

import { useState } from 'react';
import { ProjectFile } from '@/types';
import { formatFileSize, getFileIcon, deleteProjectFile } from '@/lib/supabase/project-files';
import { useAuth } from '@/lib/auth/AuthContext';

interface FileListProps {
  files: ProjectFile[];
  onFileDeleted?: (fileId: string) => void;
}

// Helper function to create download URL via our API
function getDownloadUrl(cloudinaryUrl: string, fileName: string): string {
  const params = new URLSearchParams({
    url: cloudinaryUrl,
    filename: fileName,
  });
  return `/api/download?${params.toString()}`;
}

export default function FileList({ files, onFileDeleted }: FileListProps) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredFiles = files.filter(file =>
    file.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.file_name.localeCompare(b.file_name);
      case 'date':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'size':
        return b.file_size - a.file_size;
      default:
        return 0;
    }
  });

  const handleDelete = async (fileId: string) => {
    if (!confirm('Bu dosyayı silmek istediğinizden emin misiniz?')) return;

    setDeletingId(fileId);
    try {
      await deleteProjectFile(fileId);
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
    } catch {
      alert('Dosya silinirken bir hata oluştu');
    } finally {
      setDeletingId(null);
    }
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-12 bg-secondary-50 rounded-lg">
        <div className="text-6xl mb-4">📂</div>
        <p className="text-secondary-600">Henüz dosya yüklenmedi</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Dosya ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="date">Tarihe Göre</option>
            <option value="name">İsme Göre</option>
            <option value="size">Boyuta Göre</option>
          </select>
        </div>
      </div>

      {/* File List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedFiles.map((file) => (
          <div
            key={file.id}
            className="bg-white border border-secondary-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            {/* File Icon & Name */}
            <div className="flex items-start space-x-3 mb-3">
              <span className="text-3xl">{getFileIcon(file.file_type)}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-secondary-900 truncate" title={file.file_name}>
                  {file.file_name}
                </h3>
                <p className="text-xs text-secondary-600">{formatFileSize(file.file_size)}</p>
              </div>
            </div>

            {/* File Info */}
            <div className="space-y-1 text-xs text-secondary-600 mb-3">
              <p>Yükleyen: {file.user?.name || 'Bilinmeyen'}</p>
              <p>
                Tarih: {new Date(file.created_at).toLocaleDateString('tr-TR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <a
                href={getDownloadUrl(file.file_url, file.file_name)}
                className="flex-1 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 text-center"
              >
                İndir
              </a>
              {user?.id === file.uploaded_by && (
                <button
                  onClick={() => handleDelete(file.id)}
                  disabled={deletingId === file.id}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingId === file.id ? '...' : 'Sil'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Results Count */}
      {searchTerm && (
        <p className="text-sm text-secondary-600 text-center">
          {sortedFiles.length} dosya bulundu
        </p>
      )}
    </div>
  );
}
