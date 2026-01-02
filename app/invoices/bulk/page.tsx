'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { MultipleFileUploader } from '@/components/ui/MultipleFileUploader';
import { BulkInvoiceTable } from '@/components/invoices/BulkInvoiceTable';
import { BulkInvoiceItem } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { uploadInvoicePDF } from '@/lib/supabase/storage';
import {
  processBulkQRCodes,
  validateBulkInvoiceItem,
  bulkUpdateSupplierNameByVKN,
  getBulkProcessingStats,
} from '@/lib/bulk-invoice-processor';
import { getOrCreateSupplier } from '@/lib/supabase/suppliers';

export default function BulkInvoicesPage() {
  const router = useRouter();
  const { company, hasPermission } = useAuth();
  const [items, setItems] = useState<BulkInvoiceItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });

  const canCreate = hasPermission('invoices', 'create');

  // Redirect if no permission
  useEffect(() => {
    if (!canCreate) {
      router.push('/invoices');
    }
  }, [canCreate, router]);

  async function handleFilesSelect(files: File[]) {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: files.length });

    try {
      const processedItems = await processBulkQRCodes(files, {
        companyId: company!.id,
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
    if (!company) return;
    
    // First update in database
    const updated = await bulkUpdateSupplierNameByVKN(items, vkn, supplierName, company.id);
    
    // Then update state with revalidation
    setItems(updated.map(item => {
      validateBulkInvoiceItem(item);
      return item;
    }));
  }

  async function handleSubmit() {
    if (!company) return;

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
      const results: Array<{ success: boolean; item: BulkInvoiceItem; error?: string }> = [];

      for (const item of items) {
        try {
          // 1. Upload PDF
          let pdfUrl = '';
          if (item.file) {
            const uploadResult = await uploadInvoicePDF(item.file, company.id);
            if (uploadResult.success) {
              pdfUrl = uploadResult.path;
            } else {
              throw new Error(uploadResult.error || 'Dosya yüklenemedi');
            }
          }

          // 2. Create or get supplier and update name if needed
          let supplierId: string | null = null;
          if (item.vkn && item.supplier_name) {
            try {
              const supplier = await getOrCreateSupplier(item.vkn, item.supplier_name, company.id);
              if (supplier) {
                supplierId = supplier.id;
              }
            } catch (supplierError) {
              console.error('Supplier error:', supplierError);
            }
          }

          // 3. Insert invoice
          const { error: insertError } = await supabase
            .from('invoices')
            .insert({
              company_id: company.id,
              invoice_number: item.invoice_number,
              invoice_date: item.invoice_date,
              supplier_name: item.supplier_name,
              amount: parseFloat(item.amount.replace(/[^\d,]/g, '').replace(',', '.')),
              goods_services_total: item.goods_services_total 
                ? parseFloat(item.goods_services_total.replace(/[^\d,]/g, '').replace(',', '.'))
                : null,
              vat_amount: item.vat_amount
                ? parseFloat(item.vat_amount.replace(/[^\d,]/g, '').replace(',', '.'))
                : null,
              withholding_amount: item.withholding_amount
                ? parseFloat(item.withholding_amount.replace(/[^\d,]/g, '').replace(',', '.'))
                : null,
              description: item.description || null,
              supplier_vkn: item.vkn || null,
              supplier_id: supplierId,
              file_path: pdfUrl || 'pending',
              file_name: item.file.name, // PDF dosya adı
            })
            .select()
            .single();

          if (insertError) {
            console.error('Insert error details:', {
              message: insertError.message,
              code: insertError.code,
              details: insertError.details,
              hint: insertError.hint,
              item: item.invoice_number
            });
            throw insertError;
          }

          results.push({ success: true, item });
        } catch (error: any) {
          console.error('Error inserting invoice:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            invoice: item.invoice_number
          });
          
          // Kullanıcı dostu hata mesajları
          let errorMessage = error.message || 'Bilinmeyen hata';
          if (error.code === '23505' && error.message?.includes('invoice_number')) {
            errorMessage = 'Bu fatura numarası zaten eklenmiş';
          } else if (error.code === '23502') {
            errorMessage = 'Zorunlu alanlar eksik';
          }
          
          results.push({ 
            success: false, 
            item, 
            error: errorMessage
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (failCount === 0) {
        alert(`✅ ${successCount} fatura başarıyla eklendi!`);
        router.push('/invoices');
      } else {
        alert(
          `⚠️ ${successCount} fatura eklendi, ${failCount} fatura eklenemedi.\n\n` +
          'Başarısız faturalar:\n' +
          results
            .filter(r => !r.success)
            .map(r => `- ${r.item.invoice_number}: ${r.error}`)
            .join('\n')
        );

        // Remove successful items from the list
        const failedItemIds = results.filter(r => !r.success).map(r => r.item.id);
        setItems(prevItems => prevItems.filter(item => failedItemIds.includes(item.id)));
      }
    } catch (error: any) {
      console.error('Error submitting bulk invoices:', error);
      alert('Faturalar kaydedilirken hata oluştu: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    if (items.length > 0) {
      if (confirm('İşlenmiş faturalar kaybolacak. Vazgeçmek istediğinize emin misiniz?')) {
        router.push('/invoices');
      }
    } else {
      router.push('/invoices');
    }
  }

  const stats = getBulkProcessingStats(items);
  const canSubmit = !isProcessing && !isSubmitting && items.length > 0 && stats.needsAttention === 0;

  if (!canCreate) {
    return null;
  }

  return (
    <Sidebar>
      <div className="space-y-6">
        {/* Page Header with Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white rounded-lg shadow-sm p-4 md:p-6">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">Toplu Fatura Ekle</h2>
            <p className="mt-1 text-xs md:text-sm text-gray-500">
              Birden fazla faturayı aynı anda yükleyin ve QR kodlarından bilgileri otomatik okutun
            </p>
          </div>
          <div className="flex flex-row gap-2 md:gap-3">
            <Button
              variant="secondary"
              onClick={handleCancel}
              disabled={isProcessing || isSubmitting}
              className="flex-1 md:flex-none text-sm"
            >
              İptal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              isLoading={isSubmitting}
              className="flex-1 md:flex-none text-sm"
            >
              {isSubmitting ? 'Kaydediliyor...' : `Faturaları Ekle (${stats.ready})`}
            </Button>
          </div>
        </div>

        {/* File Upload Section */}
        {items.length === 0 && !isProcessing && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <MultipleFileUploader
              onFilesSelect={handleFilesSelect}
              disabled={isProcessing}
              maxFiles={50}
            />
          </div>
        )}

        {/* Processing Progress */}
        {isProcessing && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-blue-900">
                Faturalar işleniyor...
              </span>
              <span className="text-sm text-blue-700">
                {processingProgress.current} / {processingProgress.total}
              </span>
            </div>
            <div className="w-full bg-blue-100 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${processingProgress.total > 0 
                    ? (processingProgress.current / processingProgress.total) * 100 
                    : 0}%`,
                }}
              />
            </div>
            <p className="mt-3 text-sm text-blue-700">
              QR kodları okunuyor ve bilgiler dolduruluyor...
            </p>
          </div>
        )}

        {/* Statistics */}
        {items.length > 0 && !isProcessing && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            <div className="bg-white rounded-lg shadow-sm p-3 md:p-4">
              <p className="text-xs text-gray-500 mb-1">Toplam</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-3 md:p-4 border-l-4 border-green-500">
              <p className="text-xs text-green-600 mb-1">QR Okundu</p>
              <p className="text-2xl md:text-3xl font-bold text-green-700">
                {stats.qrSuccess}
              </p>
              <p className="text-xs text-green-600 mt-1">({stats.qrSuccessRate}%)</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-3 md:p-4 border-l-4 border-amber-500">
              <p className="text-xs text-amber-600 mb-1">QR Okunamadı</p>
              <p className="text-2xl md:text-3xl font-bold text-amber-700">{stats.qrFailed}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-3 md:p-4 border-l-4 border-blue-500">
              <p className="text-xs text-blue-600 mb-1">Hazır</p>
              <p className="text-2xl md:text-3xl font-bold text-blue-700">
                {stats.ready}
              </p>
              <p className="text-xs text-blue-600 mt-1">({stats.readyRate}%)</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-3 md:p-4 border-l-4 border-red-500">
              <p className="text-xs text-red-600 mb-1">Eksik Bilgi</p>
              <p className="text-2xl md:text-3xl font-bold text-red-700">{stats.needsAttention}</p>
            </div>
          </div>
        )}

        {/* Invoices Table */}
        {items.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-3 md:p-4 border-b border-gray-200">
              <h3 className="text-base md:text-lg font-medium text-gray-900">Fatura Listesi</h3>
            </div>
            
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <BulkInvoiceTable
                items={items}
                onItemUpdate={handleItemUpdate}
                onItemRemove={handleItemRemove}
                onSupplierNameChange={handleSupplierNameChange}
              />
            </div>

            {stats.needsAttention > 0 && (
              <div className="p-3 md:p-4 bg-amber-50 border-t border-amber-100">
                <p className="text-xs md:text-sm text-amber-800">
                  ⚠️ <strong>{stats.needsAttention} faturada eksik bilgi var.</strong> Lütfen kırmızı işaretli alanları doldurun.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Help Text */}
        {items.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-3 md:p-4">
            <div className="flex items-start gap-2 md:gap-3">
              <span className="text-xl md:text-2xl">💡</span>
              <div className="flex-1">
                <p className="text-xs md:text-sm text-blue-900 font-medium mb-1">İpuçları:</p>
                <ul className="text-xs md:text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Aynı VKN&apos;ye sahip faturalar için bir tanesine tedarikçi adı girdiğinizde, diğer faturalar otomatik olarak güncellenecektir.</li>
                  <li>Tablodaki her hücreye tıklayarak bilgileri düzenleyebilirsiniz.</li>
                  <li>Yeşil onay işareti olan satırlar kaydetmeye hazır, kırmızı uyarı işareti olanlar eksik bilgi içerir.</li>
                  <li>PDF sütunundaki ikona tıklayarak faturayı görüntüleyebilirsiniz.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
