'use client';

import { useState, useCallback } from 'react';
import { uploadProjectFile, formatFileSize, getFileIcon } from '@/lib/supabase/project-files';
import { TechnicalCategory, ProjectFile } from '@/types';
import { useAuth } from '@/lib/auth/AuthContext';

interface FileUploadProps {
  projectId: string;
  category: TechnicalCategory;
  onUploadComplete?: (file: ProjectFile) => void;
}

export default function FileUpload({ projectId, category, onUploadComplete }: FileUploadProps) {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(files);
    setError(null);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
      setError(null);
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFiles.length || !user) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        const uploadedFile = await uploadProjectFile(
          file,
          projectId,
          category,
          user.id,
          user.company_id
        );

        setUploadProgress(((i + 1) / selectedFiles.length) * 100);

        if (onUploadComplete) {
          onUploadComplete(uploadedFile);
        }
      }

      setSelectedFiles([]);
      setUploadProgress(0);
    } catch (err: any) {
      setError(err.message || 'Dosya yüklenirken bir hata oluştu');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-secondary-300 bg-white'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary-400'}
        `}
      >
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
          id={`file-upload-${category}`}
          accept=".pdf,.doc,.docx,.dwg,.dxf,.jpg,.jpeg,.png,.gif,.zip,.rar,.7z"
        />
        
        <label
          htmlFor={`file-upload-${category}`}
          className="cursor-pointer block"
        >
          <div className="text-6xl mb-4">📁</div>
          <p className="text-lg font-medium text-secondary-900 mb-2">
            Dosyaları sürükleyip bırakın veya tıklayın
          </p>
          <p className="text-sm text-secondary-600">
            PDF, DWG, DXF, JPG, PNG, ZIP dosyalarını yükleyebilirsiniz
          </p>
          <p className="text-xs text-secondary-500 mt-2">
            Maksimum dosya boyutu: 50MB
          </p>
        </label>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-secondary-900">
            Seçili Dosyalar ({selectedFiles.length})
          </h3>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getFileIcon(file.type)}</span>
                  <div>
                    <p className="text-sm font-medium text-secondary-900">{file.name}</p>
                    <p className="text-xs text-secondary-600">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  disabled={uploading}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Yükleniyor...' : 'Yükle'}
          </button>
        </div>
      )}

      {/* Progress Bar */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-secondary-600">
            <span>Yükleniyor...</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div className="w-full bg-secondary-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
