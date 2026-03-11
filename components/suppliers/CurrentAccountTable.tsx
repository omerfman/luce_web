import React from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';

interface CurrentAccountMovement {
  date: string;
  type: 'payment' | 'invoice';
  documentType: string;
  documentNo: string;
  debit: number;
  credit: number;
  balance: number;
  notes?: string;
  relatedId: string;       // Fatura için: invoiceId | Ödeme için: statementItemId
  statementId?: string;    // Ödeme satırı için: üst ekstrenin ID'si
  linkedInvoiceId?: string; // Ödeme faturaya bağlıysa faturanın ID'si
}

interface CurrentAccountTableProps {
  movements: CurrentAccountMovement[];
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
  isLoading?: boolean;
}

/**
 * Cari hesap hareket tablosu component'i
 * Fatura ve ödemeleri tarih sırasına göre gösterir
 */
export function CurrentAccountTable({ 
  movements, 
  totalDebit, 
  totalCredit, 
  finalBalance,
  isLoading = false 
}: CurrentAccountTableProps) {
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-4xl mb-3">📋</div>
        <p className="text-gray-600">Henüz hareket bulunmuyor</p>
      </div>
    );
  }

  // Bakiye rengini belirle
  const getBalanceColor = (balance: number) => {
    if (Math.abs(balance) <= 50) return 'text-green-600'; // Denk
    if (balance < 0) return 'text-yellow-600'; // Fazla ödeme
    return 'text-red-600'; // Eksik ödeme
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tarih
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Belge Tipi
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Belge No / Açıklama
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Borç (₺)
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Alacak (₺)
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Bakiye (₺)
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              İşlemler
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {movements.map((movement, index) => (
            <tr 
              key={`${movement.relatedId}-${index}`}
              className="hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {formatDate(movement.date)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">
                {movement.type === 'invoice' ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700">
                    📄 Fatura
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
                    💳 Ödeme
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                <div>{movement.documentNo}</div>
                {movement.notes && (
                  <div className="text-xs text-gray-500 mt-1">{movement.notes}</div>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-red-600">
                {movement.debit > 0 ? formatCurrency(movement.debit) : '-'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-green-600">
                {movement.credit > 0 ? formatCurrency(movement.credit) : '-'}
              </td>
              <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-bold ${getBalanceColor(movement.balance)}`}>
                {formatCurrency(movement.balance)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-center">
                <div className="flex items-center justify-center gap-1">
                  {movement.type === 'invoice' && (
                    <Link
                      href={`/invoices`}
                      title="Fatura listesini aç"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                    >
                      📄 Fatura
                    </Link>
                  )}
                  {movement.type === 'payment' && movement.statementId && (
                    <Link
                      href={`/card-statements/${movement.statementId}`}
                      title="Kredi kartı ekstresini aç"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                    >
                      💳 Ekstre
                    </Link>
                  )}
                  {movement.type === 'payment' && movement.linkedInvoiceId && (
                    <Link
                      href={`/invoices`}
                      title="İlgili fatura listesini aç"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                    >
                      📄 Fatura
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-100 font-bold">
          <tr>
            <td colSpan={3} className="px-4 py-3 text-sm text-gray-900 uppercase">
              TOPLAM
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-600">
              {formatCurrency(totalDebit)}
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-600">
              {formatCurrency(totalCredit)}
            </td>
            <td className={`px-4 py-3 whitespace-nowrap text-sm text-right ${getBalanceColor(finalBalance)}`}>
              {formatCurrency(finalBalance)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
