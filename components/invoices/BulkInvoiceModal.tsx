'use client';

import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MultipleFileUploader } from '@/components/ui/MultipleFileUploader';
import { BulkInvoiceTable } from '@/components/invoices/BulkInvoiceTable';
import { BulkInvoiceItem } from '@/types';
import {
  processBulkQRCodes,
  validateBulkInvoiceItem,
  bulkUpdateSupplierNameByVKN,
  getBulkProcessingStats,
} from '@/lib/bulk-invoice-processor';

interface BulkInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (items: BulkInvoiceItem[]) => Promise<void>;
  companyId: string;
}

export function BulkInvoiceModal({
  isOpen,
  onClose,
  onSubmit,
  companyId,
}: BulkInvoiceModalProps) {
  const [items, setItems] = useState<BulkInvoiceItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setItems([]);
      setIsProcessing(false);
      setIsSubmitting(false);
      setProcessingProgress({ current: 0, total: 0 });
    }
  }, [isOpen]);

  async function handleFilesSelect(files: File[]) {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: files.length });

    try {
      const processedItems = await processBulkQRCodes(files, {
        companyId,
        onProgress: (current, total) => {
          setProcessingProgress({ current, total });
        },
        onItemProcessed: (item) => {
          // Update items in real-time
          setItems(prevItems => {
            const existingIndex = prevItems.findIndex(i => i.id === item.id);
            if (existingIndex >= 0) {
              const newItems = [...prevItems];
              newItems[existingIndex] = item;
              return newItems;
            } else {
              return [...prevItems, item];
            }
          });
        },
      });

      setItems(processedItems);
    } catch (error: any) {
      console.error('Error processing bulk invoices:', error);
      alert('Dosyalar işlenirken hata oluştu: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleItemUpdate(id: string, updates: Partial<BulkInvoiceItem>) {
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, ...updates };
          validateBulkInvoiceItem(updatedItem);
          return updatedItem;
        }
        return item;
      })
    );
  }

  function handleItemRemove(id: string) {
    setItems(prevItems => prevItems.filter(item => item.id !== id));
  }

  async function handleSupplierNameChange(vkn: string, supplierName: string) {
    // First update in database
    const updated = await bulkUpdateSupplierNameByVKN(items, vkn, supplierName, companyId);
    
    // Then update state with revalidation
    setItems(updated.map(item => {
      validateBulkInvoiceItem(item);
      return item;
    }));
  }

  async function handleSubmit() {
    // Validate all items
    const invalidItems = items.filter(item => !item.isValid);
    
    if (invalidItems.length > 0) {
      alert(`${invalidItems.length} faturada eksik bilgi var. Lütfen tüm gerekli alanları doldurun.`);
      return;
    }

    if (items.length === 0) {
      alert('Lütfen en az bir fatura ekleyin.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(items);
      onClose();
    } catch (error: any) {
      console.error('Error submitting bulk invoices:', error);
      alert('Faturalar kaydedilirken hata oluştu: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const stats = getBulkProcessingStats(items);
  const canSubmit = !isProcessing && !isSubmitting && items.length > 0 && stats.needsAttention === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Toplu Fatura Ekle"
      size="xl"
    >
      <div className="space-y-6">
        {/* File Upload Section */}
        {items.length === 0 && (
          <MultipleFileUploader
            onFilesSelect={handleFilesSelect}
            disabled={isProcessing}
            maxFiles={50}
          />
        )}

        {/* Processing Progress */}
        {isProcessing && (
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900">
                Faturalar işleniyor...
              </span>
              <span className="text-sm text-blue-700">
                {processingProgress.current} / {processingProgress.total}
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${processingProgress.total > 0 
                    ? (processingProgress.current / processingProgress.total) * 100 
                    : 0}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-blue-700">
              QR kodları okunuyor ve bilgiler doldurulur...
            </p>
          </div>
        )}

        {/* Statistics */}
        {items.length > 0 && !isProcessing && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Toplam</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-xs text-green-600">QR Okundu</p>
              <p className="text-2xl font-bold text-green-700">
                {stats.qrSuccess}
                <span className="ml-2 text-sm">({stats.qrSuccessRate}%)</span>
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 p-4">
              <p className="text-xs text-amber-600">QR Okunamadı</p>
              <p className="text-2xl font-bold text-amber-700">{stats.qrFailed}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-xs text-blue-600">Hazır</p>
              <p className="text-2xl font-bold text-blue-700">
                {stats.ready}
                <span className="ml-2 text-sm">({stats.readyRate}%)</span>
              </p>
            </div>
            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-xs text-red-600">Eksik Bilgi</p>
              <p className="text-2xl font-bold text-red-700">{stats.needsAttention}</p>
            </div>
          </div>
        )}

        {/* Invoices Table */}
        {items.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">Fatura Listesi</h3>
              <button
                type="button"
                onClick={() => handleFilesSelect([])}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                + Daha Fazla Dosya Ekle
              </button>
            </div>
            
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <BulkInvoiceTable
                items={items}
                onItemUpdate={handleItemUpdate}
                onItemRemove={handleItemRemove}
                onSupplierNameChange={handleSupplierNameChange}
              />
            </div>

            {stats.needsAttention > 0 && (
              <div className="mt-3 rounded-md bg-amber-50 p-3">
                <p className="text-sm text-amber-800">
                  ⚠️ {stats.needsAttention} faturada eksik bilgi var. Lütfen kırmızı işaretli alanları doldurun.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Help Text */}
        {items.length > 0 && (
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-xs text-blue-700">
              <strong>💡 İpucu:</strong> Aynı VKN&apos;ye sahip faturalar için bir tanesine tedarikçi adı girdiğinizde, 
              diğer faturalar otomatik olarak güncellenecektir.
            </p>
          </div>
        )}
      </div>

      <ModalFooter>
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={isProcessing || isSubmitting}
        >
          İptal
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          isLoading={isSubmitting}
        >
          {isSubmitting ? 'Kaydediliyor...' : `Faturaları Ekle (${stats.ready})`}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
