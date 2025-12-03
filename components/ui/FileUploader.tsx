'use client';

import { useState, useRef } from 'react';
import { validateFile, FILE_VALIDATION } from '@/lib/supabase/storage';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
}

export function FileUploader({
  onFileSelect,
  accept = '.pdf',
  maxSize = FILE_VALIDATION.MAX_SIZE,
  disabled = false,
  className = '',
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(file: File | null) {
    setError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error!);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    onFileSelect(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    handleFileChange(file);
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

    const file = e.dataTransfer.files?.[0] || null;
    handleFileChange(file);
  }

  function handleClick() {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }

  function handleRemove() {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

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

          {selectedFile ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-secondary-900">{selectedFile.name}</p>
              <p className="text-xs text-secondary-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Kaldır
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-secondary-900">
                {isDragging ? 'Dosyayı bırakın' : 'Dosya seçmek için tıklayın veya sürükleyin'}
              </p>
              <p className="text-xs text-secondary-500">
                PDF dosyaları, maksimum {maxSize / 1024 / 1024}MB
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
