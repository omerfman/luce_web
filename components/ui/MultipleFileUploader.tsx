'use client';

import { useState, useRef } from 'react';
import { validateFile, FILE_VALIDATION } from '@/lib/supabase/storage';

interface MultipleFileUploaderProps {
  onFilesSelect: (files: File[]) => void;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
  maxFiles?: number;
}

export function MultipleFileUploader({
  onFilesSelect,
  accept = '.pdf',
  maxSize = FILE_VALIDATION.MAX_SIZE,
  disabled = false,
  className = '',
  maxFiles = 20,
}: MultipleFileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFilesChange(files: File[]) {
    setError(null);

    if (files.length === 0) {
      setSelectedFiles([]);
      return;
    }

    // Check max files limit
    if (files.length > maxFiles) {
      setError(`Maksimum ${maxFiles} dosya yükleyebilirsiniz`);
      return;
    }

    // Validate each file
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const validation = validateFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    }

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      onFilesSelect(validFiles);
    } else {
      setSelectedFiles([]);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    handleFilesChange(files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    handleFilesChange(files);
  }

  function handleClick() {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }

  function handleRemove(index: number) {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setError(null);
    
    if (newFiles.length === 0 && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    onFilesSelect(newFiles);
  }

  function handleRemoveAll() {
    setSelectedFiles([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onFilesSelect([]);
  }

  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
        multiple
      />
      
      {/* Upload Area */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
          ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-secondary-300 bg-white'}
          ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-primary-400 hover:bg-primary-50/50'}
          ${error ? 'border-red-300 bg-red-50' : ''}
        `}
      >
        <div className="flex flex-col items-center gap-2">
          {/* Icon */}
          <svg
            className={`h-12 w-12 ${error ? 'text-red-400' : 'text-secondary-400'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <p className="text-sm font-medium text-secondary-900">
            {isDragging ? 'Dosyaları bırakın' : 'Birden fazla dosya seçmek için tıklayın veya sürükleyin'}
          </p>
          <p className="text-xs text-secondary-500">
            PDF dosyaları, maksimum {maxFiles} adet, {maxSize / 1024 / 1024}MB/dosya
          </p>
          <p className="text-xs text-primary-600">
            💡 E-fatura QR kodları otomatik okunacak
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-2 rounded-md bg-red-50 p-3">
          <p className="whitespace-pre-line text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-secondary-900">
              Seçilen Dosyalar ({selectedFiles.length})
            </p>
            <button
              type="button"
              onClick={handleRemoveAll}
              className="text-xs text-red-600 hover:text-red-700"
            >
              Tümünü Kaldır
            </button>
          </div>
          
          <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-secondary-200 bg-secondary-50 p-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between rounded-md bg-white p-2 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-secondary-900 truncate">{file.name}</p>
                  <p className="text-xs text-secondary-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(index);
                  }}
                  className="ml-2 text-red-600 hover:text-red-700"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          
          <p className="text-xs text-secondary-500">
            Toplam: {(totalSize / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      )}
    </div>
  );
}
