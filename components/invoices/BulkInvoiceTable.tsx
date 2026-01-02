'use client';

import { BulkInvoiceItem, BulkUploadStatus } from '@/types';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { parseCurrencyInput, formatCurrencyInput } from '@/lib/utils';

interface BulkInvoiceTableProps {
  items: BulkInvoiceItem[];
  onItemUpdate: (id: string, updates: Partial<BulkInvoiceItem>) => void;
  onItemRemove: (id: string) => void;
  onSupplierNameChange: (vkn: string, supplierName: string) => void;
}

export function BulkInvoiceTable({
  items,
  onItemUpdate,
  onItemRemove,
  onSupplierNameChange,
}: BulkInvoiceTableProps) {
  if (items.length === 0) {
    return null;
  }

  function getStatusBadge(status: BulkUploadStatus) {
    const badges = {
      [BulkUploadStatus.PENDING]: { text: 'Bekliyor', class: 'bg-gray-100 text-gray-700' },
      [BulkUploadStatus.PROCESSING]: { text: 'İşleniyor...', class: 'bg-blue-100 text-blue-700 animate-pulse' },
      [BulkUploadStatus.QR_SUCCESS]: { text: 'QR Okundu', class: 'bg-green-100 text-green-700' },
      [BulkUploadStatus.QR_FAILED]: { text: 'QR Okunamadı', class: 'bg-amber-100 text-amber-700' },
      [BulkUploadStatus.MANUAL_ENTRY]: { text: 'Manuel', class: 'bg-purple-100 text-purple-700' },
      [BulkUploadStatus.READY]: { text: 'Hazır', class: 'bg-green-100 text-green-700' },
      [BulkUploadStatus.SAVING]: { text: 'Kaydediliyor...', class: 'bg-blue-100 text-blue-700 animate-pulse' },
      [BulkUploadStatus.SUCCESS]: { text: 'Başarılı', class: 'bg-green-100 text-green-700' },
      [BulkUploadStatus.ERROR]: { text: 'Hata', class: 'bg-red-100 text-red-700' },
    };

    const badge = badges[status];
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${badge.class}`}>
        {badge.text}
      </span>
    );
  }

  function handleFieldChange(item: BulkInvoiceItem, field: keyof BulkInvoiceItem, value: any) {
    const updates: Partial<BulkInvoiceItem> = { [field]: value };

    // If supplier name changed and VKN exists, trigger bulk update
    if (field === 'supplier_name' && item.supplier_vkn) {
      onSupplierNameChange(item.supplier_vkn, value);
    }

    // Auto-calculate total when financial fields change
    if (field === 'goods_services_total' || field === 'vat_amount' || field === 'withholding_amount') {
      const goods = parseCurrencyInput(
        field === 'goods_services_total' ? value : item.goods_services_total
      );
      const vat = parseCurrencyInput(
        field === 'vat_amount' ? value : item.vat_amount
      );
      const withholding = parseCurrencyInput(
        field === 'withholding_amount' ? value : item.withholding_amount
      );

      const total = goods + vat - withholding;
      if (total > 0) {
        updates.amount = formatCurrencyInput(total.toString().replace('.', ','));
      }
    }

    onItemUpdate(item.id, updates);
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
              #
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
              PDF
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">
              Tedarikçi
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
              VKN
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
              Durum
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
              Fatura No
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
              Tarih
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
              Mal/Hizmet
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
              KDV
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
              Tevkifat
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
              Toplam
            </th>
            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
              İşlem
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item, index) => (
            <tr 
              key={item.id}
              className={`
                ${!item.isValid && item.status !== BulkUploadStatus.PROCESSING ? 'bg-red-50' : ''}
                ${item.status === BulkUploadStatus.SUCCESS ? 'bg-green-50 opacity-60' : ''}
                hover:bg-gray-50 transition-colors
              `}
            >
              <td className="px-2 py-2 whitespace-nowrap text-sm text-center text-gray-500 font-medium">
                {index + 1}
              </td>
              <td className="px-2 py-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    const url = URL.createObjectURL(item.file);
                    window.open(url, '_blank');
                  }}
                  className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                  title={`PDF Görüntüle: ${item.file.name}`}
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                </button>
              </td>
              <td className="px-3 py-2">
                <Input
                  type="text"
                  value={item.supplier_name}
                  onChange={(e) => handleFieldChange(item, 'supplier_name', e.target.value)}
                  placeholder="Tedarikçi adı"
                  className={`text-sm ${!item.supplier_name && !item.isValid ? 'border-red-300' : ''}`}
                  disabled={item.status === BulkUploadStatus.PROCESSING || item.status === BulkUploadStatus.SUCCESS}
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  type="text"
                  value={item.supplier_vkn || item.vkn || ''}
                  onChange={(e) => {
                    const vknValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
                    handleFieldChange(item, 'supplier_vkn', vknValue);
                    handleFieldChange(item, 'vkn', vknValue);
                  }}
                  placeholder="VKN (10-11 hane)"
                  className={`text-sm ${!item.supplier_vkn && !item.vkn && !item.isValid ? 'border-red-300' : ''}`}
                  disabled={item.status === BulkUploadStatus.PROCESSING || item.status === BulkUploadStatus.SUCCESS}
                  maxLength={11}
                />
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-sm">
                {getStatusBadge(item.status)}
                {item.error && (
                  <p className="mt-1 text-xs text-red-600">{item.error}</p>
                )}
              </td>
              <td className="px-3 py-2">
                <Input
                  type="text"
                  value={item.invoice_number}
                  onChange={(e) => handleFieldChange(item, 'invoice_number', e.target.value)}
                  placeholder="Fatura no"
                  className={`text-sm ${!item.invoice_number && !item.isValid ? 'border-red-300' : ''}`}
                  disabled={item.status === BulkUploadStatus.PROCESSING || item.status === BulkUploadStatus.SUCCESS}
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  type="date"
                  value={item.invoice_date}
                  onChange={(e) => handleFieldChange(item, 'invoice_date', e.target.value)}
                  className="text-sm w-full"
                  disabled={item.status === BulkUploadStatus.PROCESSING || item.status === BulkUploadStatus.SUCCESS}
                />
              </td>
              <td className="px-3 py-2">
                <CurrencyInput
                  value={item.goods_services_total}
                  onChange={(value) => handleFieldChange(item, 'goods_services_total', value)}
                  placeholder="0,00"
                  className="text-sm text-right"
                  disabled={item.status === BulkUploadStatus.PROCESSING || item.status === BulkUploadStatus.SUCCESS}
                />
              </td>
              <td className="px-3 py-2">
                <CurrencyInput
                  value={item.vat_amount}
                  onChange={(value) => handleFieldChange(item, 'vat_amount', value)}
                  placeholder="0,00"
                  className="text-sm text-right"
                  disabled={item.status === BulkUploadStatus.PROCESSING || item.status === BulkUploadStatus.SUCCESS}
                />
              </td>
              <td className="px-3 py-2">
                <CurrencyInput
                  value={item.withholding_amount}
                  onChange={(value) => handleFieldChange(item, 'withholding_amount', value)}
                  placeholder="0,00"
                  className="text-sm text-right"
                  disabled={item.status === BulkUploadStatus.PROCESSING || item.status === BulkUploadStatus.SUCCESS}
                />
              </td>
              <td className="px-3 py-2">
                <CurrencyInput
                  value={item.amount}
                  onChange={(value) => handleFieldChange(item, 'amount', value)}
                  placeholder="0,00"
                  className={`text-sm text-right font-medium ${!item.amount && !item.isValid ? 'border-red-300' : ''}`}
                  disabled={item.status === BulkUploadStatus.PROCESSING || item.status === BulkUploadStatus.SUCCESS}
                />
              </td>
              <td className="px-2 py-2 text-center">
                <button
                  type="button"
                  onClick={() => onItemRemove(item.id)}
                  disabled={item.status === BulkUploadStatus.PROCESSING || item.status === BulkUploadStatus.SAVING}
                  className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-800 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Kaldır"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
