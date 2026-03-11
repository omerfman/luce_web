import React from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface CurrentAccountSummaryCardProps {
  totalCardPayments: number;      // Kredi kartı ödemeleri → bakiyeyi etkiler
  totalInformalPayments: number;  // Gayri resmi ödemeler → bağımsız işlem, bakiyeyi etkilemez
  totalInvoices: number;
  balance: number; // = totalInvoices - totalCardPayments
  balanceStatus: 'balanced' | 'overpaid' | 'underpaid';
  lastMovementDate: string | null;
  movementCount: number;
}

/**
 * Cari hesap özet kartı component'i
 * Bakiye = Faturalar - Kredi Kartı Ödemeleri
 * Gayri resmi ödemeler bağımsız gösterilir, bakiyeye dahil edilmez
 */
export function CurrentAccountSummaryCard({
  totalCardPayments,
  totalInformalPayments,
  totalInvoices,
  balance,
  balanceStatus,
  lastMovementDate,
  movementCount
}: CurrentAccountSummaryCardProps) {

  // Bakiye durumuna göre renk ve mesaj belirle
  const getBalanceInfo = () => {
    switch (balanceStatus) {
      case 'balanced':
        return {
          color: 'bg-green-100 text-green-800 border-green-300',
          icon: '✔️',
          title: 'Bakiye Denk',
          description: 'Ödemeler ve faturalar dengede'
        };
      case 'overpaid':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: '💰',
          title: 'Bakiyeniz Var',
          description: 'Firmaya fazla ödeme yapılmış'
        };
      case 'underpaid':
        return {
          color: 'bg-red-100 text-red-800 border-red-300',
          icon: '⚠️',
          title: 'Eksik Ödeme',
          description: 'Firmaya eksik ödeme yapılmış'
        };
    }
  };

  const balanceInfo = getBalanceInfo();

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      {/* Başlık */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
        <h3 className="text-lg font-bold text-white flex items-center">
          🔄 Cari Hesap Özeti
        </h3>
      </div>

      {/* İçerik */}
      <div className="p-6">
        {/* Bakiye Durumu */}
        <div className={`mb-6 p-4 rounded-lg border-2 ${balanceInfo.color}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium mb-1">
                {balanceInfo.icon} {balanceInfo.title}
              </div>
              <div className="text-xs opacity-80">
                {balanceInfo.description}
              </div>
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(Math.abs(balance))}
            </div>
          </div>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Toplam Faturalar */}
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="text-xs text-red-600 font-medium mb-1">TOPLAM FATURALAR</div>
            <div className="text-2xl font-bold text-red-700">
              {formatCurrency(totalInvoices)}
            </div>
            <div className="text-xs text-red-500 mt-1">Borcumuz</div>
          </div>

          {/* Kredi Kartı Ödemeleri */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-xs text-green-600 font-medium mb-1">KREDİ KARTI ÖDEMELERİ</div>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(totalCardPayments)}
            </div>
            <div className="text-xs text-green-500 mt-1">Fatura ödemesi</div>
          </div>

          {/* Gayri Resmi Ödemeler */}
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <div className="text-xs text-amber-600 font-medium mb-1">GAYRİ RESMİ ÖDEMELER</div>
            <div className="text-2xl font-bold text-amber-700">
              {formatCurrency(totalInformalPayments)}
            </div>
            <div className="text-xs text-amber-500 mt-1">Bağımsız işlem</div>
          </div>

          {/* Net Bakiye */}
          <div className={`rounded-lg p-4 border-2 ${balanceInfo.color}`}>
            <div className="text-xs font-medium mb-1">NET BAKİYE</div>
            <div className="text-2xl font-bold">
              {formatCurrency(Math.abs(balance))}
            </div>
            <div className="text-xs mt-1">
              {balance > 0 ? 'Borcumuz Var' : balance < 0 ? 'Bakiyemiz Var' : 'Denk'}
            </div>
          </div>
        </div>

        {/* Alt Bilgiler */}
        <div className="flex items-center justify-between text-sm text-gray-600 pt-4 border-t border-gray-200">
          <div className="flex items-center">
            <span className="font-medium">Toplam Hareket:</span>
            <span className="ml-2 px-2 py-1 bg-gray-100 rounded-md font-bold">
              {movementCount}
            </span>
          </div>
          {lastMovementDate && (
            <div className="flex items-center">
              <span className="font-medium">Son Hareket:</span>
              <span className="ml-2">{formatDate(lastMovementDate)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
