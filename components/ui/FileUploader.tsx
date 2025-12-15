'use client';

import { useState, useRef } from 'react';
import { validateFile, FILE_VALIDATION } from '@/lib/supabase/storage';
import { InvoiceQRData } from '@/types';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  onQRDataExtracted?: (qrData: InvoiceQRData) => void;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
  enableQRScanning?: boolean;
}

export function FileUploader({
  onFileSelect,
  onQRDataExtracted,
  accept = '.pdf',
  maxSize = FILE_VALIDATION.MAX_SIZE,
  disabled = false,
  className = '',
  enableQRScanning = false,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingQR, setIsProcessingQR] = useState(false);
  const [qrStatus, setQrStatus] = useState<'idle' | 'scanning' | 'found' | 'not-found'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(file: File | null) {
    setError(null);
    setQrStatus('idle');

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

    // If QR scanning is enabled and file is PDF, try to extract QR
    if (enableQRScanning && file.type === 'application/pdf' && onQRDataExtracted) {
      await processQRCode(file);
    }
  }

  async function processQRCode(file: File) {
    try {
      setIsProcessingQR(true);
      setQrStatus('scanning');
      
      console.log('Starting QR code extraction...');
      
      // Dynamic import to avoid webpack issues
      const { extractQRFromPDF, parseInvoiceQR } = await import('@/lib/pdf/qr-reader');
      
      const qrRawData = await extractQRFromPDF(file);
      
      if (qrRawData) {
        console.log('QR code found:', qrRawData);
        const qrData = parseInvoiceQR(qrRawData);
        setQrStatus('found');
        onQRDataExtracted?.(qrData);
      } else {
        console.log('No QR code found in PDF');
        setQrStatus('not-found');
      }
    } catch (error) {
      console.error('Error processing QR code:', error);
      setQrStatus('not-found');
    } finally {
      setIsProcessingQR(false);
    }
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
    setQrStatus('idle');
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
          ${disabled || isProcessingQR ? 'cursor-not-allowed opacity-50' : 'hover:border-primary-400 hover:bg-primary-50/50'}
          ${error ? 'border-red-300 bg-red-50' : ''}
        `}
      >
        <div className="flex flex-col items-center gap-2">
          {/* Icon */}
          {isProcessingQR ? (
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
          ) : (
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
          )}

          {isProcessingQR ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-primary-600">QR kod taranıyor...</p>
              <p className="text-xs text-secondary-500">Lütfen bekleyiniz</p>
            </div>
          ) : selectedFile ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-secondary-900">{selectedFile.name}</p>
              <p className="text-xs text-secondary-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              {qrStatus === 'found' && (
                <p className="text-xs text-green-600">✅ QR kod okundu, form dolduruldu</p>
              )}
              {qrStatus === 'not-found' && (
                <p className="text-xs text-amber-600">⚠️ QR kod bulunamadı, manuel giriş yapınız</p>
              )}
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
              {enableQRScanning && (
                <p className="text-xs text-primary-600">
                  💡 E-fatura QR kodu otomatik okunacak
                </p>
              )}
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
