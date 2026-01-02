import { BulkInvoiceItem, BulkUploadStatus, InvoiceQRData } from '@/types';
import { extractQRFromPDF, parseInvoiceQR } from '@/lib/pdf/qr-reader';
import { getOrCreateSupplier, updateSupplierNameByVKN } from '@/lib/supabase/suppliers';
import { numberToTurkishCurrency } from '@/lib/utils';

export interface BulkQRProcessingOptions {
  companyId: string;
  onProgress?: (processed: number, total: number) => void;
  onItemProcessed?: (item: BulkInvoiceItem) => void;
}

/**
 * Process multiple PDF files and extract QR data from each
 * Runs in parallel for better performance
 */
export async function processBulkQRCodes(
  files: File[],
  options: BulkQRProcessingOptions
): Promise<BulkInvoiceItem[]> {
  const { companyId, onProgress, onItemProcessed } = options;
  
  console.log(`Starting bulk QR processing for ${files.length} files`);
  
  // Create initial items
  const items: BulkInvoiceItem[] = files.map((file, index) => ({
    id: `temp-${Date.now()}-${index}`,
    file,
    status: BulkUploadStatus.PENDING,
    qrData: null,
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    supplier_name: '',
    supplier_vkn: '',
    goods_services_total: '',
    vat_amount: '',
    withholding_amount: '',
    amount: '',
    description: '',
    isValid: false,
    validationErrors: [],
  }));

  // Process files in batches for better performance (3 at a time)
  const batchSize = 3;
  let processed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (item) => {
        item.status = BulkUploadStatus.PROCESSING;
        onItemProcessed?.(item);

        try {
          // Extract QR code from PDF
          const qrRawData = await extractQRFromPDF(item.file);

          if (qrRawData) {
            // Parse QR data
            const qrData = parseInvoiceQR(qrRawData);
            item.qrData = qrData;
            item.status = BulkUploadStatus.QR_SUCCESS;

            // Map QR data to form fields
            await mapQRDataToFormFields(item, qrData, companyId);
          } else {
            // No QR found - manual entry required
            item.status = BulkUploadStatus.QR_FAILED;
            item.error = 'QR kod bulunamadı';
          }
        } catch (error: any) {
          console.error(`Error processing QR for ${item.file.name}:`, error);
          item.status = BulkUploadStatus.QR_FAILED;
          item.error = error.message || 'QR okuma hatası';
        }

        processed++;
        onProgress?.(processed, items.length);
        onItemProcessed?.(item);
      })
    );
  }

  console.log(`Bulk QR processing complete. ${processed}/${items.length} processed`);
  return items;
}

/**
 * Map QR data to invoice form fields
 */
async function mapQRDataToFormFields(
  item: BulkInvoiceItem,
  qrData: InvoiceQRData,
  companyId: string
): Promise<void> {
  // Invoice number
  if (qrData.invoiceNumber) {
    item.invoice_number = qrData.invoiceNumber;
  }

  // Invoice date
  if (qrData.invoiceDate) {
    item.invoice_date = qrData.invoiceDate;
  }

  // VKN
  if (qrData.taxNumber) {
    item.supplier_vkn = qrData.taxNumber;
    item.vkn = qrData.taxNumber; // Also set vkn field for consistency

    // Try to get supplier name from cache
    try {
      const supplier = await getOrCreateSupplier(
        qrData.taxNumber,
        qrData.supplierName || 'Bilinmeyen Tedarikçi',
        companyId
      );

      if (supplier && supplier.name && supplier.name !== 'Bilinmeyen Tedarikçi') {
        item.supplier_name = supplier.name;
      } else if (qrData.supplierName) {
        item.supplier_name = qrData.supplierName;
      }
    } catch (error) {
      console.error('Error looking up supplier:', error);
      if (qrData.supplierName) {
        item.supplier_name = qrData.supplierName;
      }
    }
  } else if (qrData.supplierName) {
    item.supplier_name = qrData.supplierName;
  }

  // Financial fields
  if (qrData.goodsServicesTotal !== undefined) {
    item.goods_services_total = numberToTurkishCurrency(qrData.goodsServicesTotal);
  }

  if (qrData.vatAmount !== undefined) {
    item.vat_amount = numberToTurkishCurrency(qrData.vatAmount);
  }

  if (qrData.withholdingAmount !== undefined) {
    item.withholding_amount = numberToTurkishCurrency(qrData.withholdingAmount);
  }

  // Calculate total if not provided
  if (qrData.totalAmount !== undefined) {
    item.amount = numberToTurkishCurrency(qrData.totalAmount);
  }

  // Validate the item
  validateBulkInvoiceItem(item);
}

/**
 * Validate a bulk invoice item
 */
export function validateBulkInvoiceItem(item: BulkInvoiceItem): void {
  const errors: string[] = [];

  if (!item.invoice_number.trim()) {
    errors.push('Fatura numarası gerekli');
  }

  if (!item.invoice_date) {
    errors.push('Fatura tarihi gerekli');
  }

  if (!item.supplier_name.trim()) {
    errors.push('Tedarikçi adı gerekli');
  }

  // VKN zorunlu (10 veya 11 hane)
  const vkn = item.supplier_vkn || item.vkn;
  if (!vkn || !vkn.trim()) {
    errors.push('VKN gerekli');
  } else if (!/^\d{10,11}$/.test(vkn.trim())) {
    errors.push('VKN 10 veya 11 haneli rakam olmalıdır');
  }

  if (!item.amount && !item.goods_services_total) {
    errors.push('Tutar bilgisi gerekli');
  }

  item.validationErrors = errors;
  item.isValid = errors.length === 0;
}

/**
 * Update supplier name for all items with the same VKN
 * Also updates the supplier name in the database
 */
export async function bulkUpdateSupplierNameByVKN(
  items: BulkInvoiceItem[],
  vkn: string,
  supplierName: string,
  companyId: string
): Promise<BulkInvoiceItem[]> {
  // Update in database if name is valid
  if (vkn && vkn.trim() && supplierName && supplierName.trim() && supplierName !== 'Bilinmeyen Tedarikçi') {
    try {
      await updateSupplierNameByVKN(vkn, supplierName, companyId);
      console.log(`Updated supplier name in DB: ${vkn} -> ${supplierName}`);
    } catch (error) {
      console.error('Error updating supplier name in DB:', error);
    }
  }

  // Update in items array
  return items.map(item => {
    if (item.supplier_vkn === vkn && vkn.trim()) {
      return {
        ...item,
        supplier_name: supplierName,
      };
    }
    return item;
  });
}

/**
 * Group items by VKN
 */
export function groupItemsByVKN(items: BulkInvoiceItem[]): Map<string, BulkInvoiceItem[]> {
  const groups = new Map<string, BulkInvoiceItem[]>();

  items.forEach(item => {
    const vkn = item.supplier_vkn?.trim();
    if (vkn) {
      const existing = groups.get(vkn) || [];
      groups.set(vkn, [...existing, item]);
    }
  });

  return groups;
}

/**
 * Get processing statistics
 */
export function getBulkProcessingStats(items: BulkInvoiceItem[]) {
  const total = items.length;
  const qrSuccess = items.filter(i => i.status === BulkUploadStatus.QR_SUCCESS).length;
  const qrFailed = items.filter(i => i.status === BulkUploadStatus.QR_FAILED).length;
  const ready = items.filter(i => i.isValid).length;
  const needsAttention = items.filter(i => !i.isValid).length;

  return {
    total,
    qrSuccess,
    qrFailed,
    qrSuccessRate: total > 0 ? Math.round((qrSuccess / total) * 100) : 0,
    ready,
    needsAttention,
    readyRate: total > 0 ? Math.round((ready / total) * 100) : 0,
  };
}
