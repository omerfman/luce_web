'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { supabase } from '@/lib/supabase/client';

interface SupplierSummary {
  supplier: any;
  customer: any | null;
  financial: {
    grandTotal: number;
    netBalance: number;
    invoices: {
      count: number;
      totalAmount: number;
      totalTax: number;
      totalWithholding: number;
    };
    outgoingInvoices: {
      count: number;
      totalAmount: number;
      totalWithholding: number;
    };
    informalPayments: {
      count: number;
      totalAmount: number;
    };
    rejectedInvoices?: {
      count: number;
      totalAmount: number;
    };
  };
  invoices: any[];
  outgoingInvoices: any[];
  informalPayments: any[];
  projects: any[];
  monthlySummary: {
    month: string;
    incomingInvoices: number;
    outgoingInvoices: number;
    informalPayments: number;
    netTotal: number;
  }[];
}

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SupplierSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'incoming' | 'outgoing' | 'payments'>('all');

  useEffect(() => {
    if (supplierId) {
      loadSummary();
    }
  }, [supplierId]);

  async function getSignedUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(path, 3600);
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return '#';
    }
    
    return data.signedUrl;
  }

  async function loadSummary() {
    try {
      setLoading(true);
      const response = await fetch(`/api/suppliers/${supplierId}/summary`);
      
      if (!response.ok) {
        throw new Error('Firma bilgileri yüklenemedi');
      }

      const data = await response.json();
      console.log('✅ [Supplier Detail] Data received:', data);
      setSummary(data);
    } catch (err: any) {
      console.error('❌ [Supplier Detail] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Sidebar>
    );
  }

  if (error || !summary) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-red-600 text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Hata Oluştu</h2>
            <p className="text-gray-600 mb-6">{error || 'Firma bilgileri yüklenemedi'}</p>
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700">
              Geri Dön
            </button>
          </div>
        </div>
      </Sidebar>
    );
  }

  const { supplier, financial, invoices, outgoingInvoices, informalPayments, projects, monthlySummary } = summary;

  const getSupplierTypeBadge = (type: string) => {
    switch (type) {
      case 'subcontractor':
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold">Taşeron</span>;
      case 'invoice_company':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-semibold">Fatura Firması</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold">Beklemede</span>;
    }
  };

  const allTransactions = [
    ...invoices.map(i => ({ ...i, type: 'incoming' as const })),
    ...outgoingInvoices.map(i => ({ ...i, type: 'outgoing' as const })),
    ...informalPayments.map(p => ({ ...p, type: 'payment' as const }))
  ].sort((a, b) => {
    const dateA = new Date(a.invoice_date || a.payment_date).getTime();
    const dateB = new Date(b.invoice_date || b.payment_date).getTime();
    return dateB - dateA;
  });

  const filteredTransactions = 
    activeTab === 'all' ? allTransactions :
    activeTab === 'incoming' ? invoices.map(i => ({ ...i, type: 'incoming' as const })) :
    activeTab === 'outgoing' ? outgoingInvoices.map(i => ({ ...i, type: 'outgoing' as const })) :
    informalPayments.map(p => ({ ...p, type: 'payment' as const }));

  const hasIncoming = invoices.length > 0 || informalPayments.length > 0;
  const hasOutgoing = outgoingInvoices.length > 0;
  const isBothRoles = hasIncoming && hasOutgoing;

  return (
    <Sidebar>
      <div className="space-y-4 md:space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
          <button
            onClick={() => router.back()}
            className="mb-4 px-4 py-2 text-gray-700 hover:text-gray-900 font-medium rounded-lg border border-gray-300 hover:border-gray-400 transition-colors flex items-center gap-2">
            <span>←</span> Geri
          </button>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                {supplier.name}
              </h1>
              <div className="flex flex-wrap gap-3 items-center">
                {getSupplierTypeBadge(supplier.supplier_type)}
                {supplier.vkn && (
                  <span className="text-sm text-gray-600 font-mono bg-gray-100 px-3 py-1 rounded-lg">
                    VKN: {supplier.vkn}
                  </span>
                )}
                {isBothRoles && (
                  <span className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-lg font-semibold">
                    🔄 Tedarikçi & Müşteri
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {hasIncoming && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">📥 Gelen Faturalar</h3>
                <span className="px-2 py-1 bg-red-600 text-white rounded text-xs font-semibold">
                  {financial.invoices.count}
                </span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-red-700">
                {formatCurrency(financial.invoices.totalAmount)}
              </p>
              <div className="text-xs text-gray-600 mt-2">
                <div>KDV: {formatCurrency(financial.invoices.totalTax)}</div>
                {financial.invoices.totalWithholding > 0 && (
                  <div>Tevkifat: {formatCurrency(financial.invoices.totalWithholding)}</div>
                )}
              </div>
            </div>
          )}

          {hasOutgoing && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">📤 Giden Faturalar</h3>
                <span className="px-2 py-1 bg-green-600 text-white rounded text-xs font-semibold">
                  {financial.outgoingInvoices.count}
                </span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-green-700">
                {formatCurrency(financial.outgoingInvoices.totalAmount)}
              </p>
              {financial.outgoingInvoices.totalWithholding > 0 && (
                <div className="text-xs text-gray-600 mt-2">
                  Tevkifat: {formatCurrency(financial.outgoingInvoices.totalWithholding)}
                </div>
              )}
            </div>
          )}

          {financial.informalPayments.count > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">💵 Gayri Resmi</h3>
                <span className="px-2 py-1 bg-amber-600 text-white rounded text-xs font-semibold">
                  {financial.informalPayments.count}
                </span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-amber-700">
                {formatCurrency(financial.informalPayments.totalAmount)}
              </p>
            </div>
          )}

          {financial.rejectedInvoices && financial.rejectedInvoices.count > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-red-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">❌ Reddedilen</h3>
                <span className="px-2 py-1 bg-red-600 text-white rounded text-xs font-semibold">
                  {financial.rejectedInvoices.count}
                </span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-red-700">
                {formatCurrency(financial.rejectedInvoices.totalAmount)}
              </p>
              <div className="text-xs text-gray-600 mt-2">
                Geçersiz faturalar
              </div>
            </div>
          )}

          {isBothRoles && (
            <div className="bg-white rounded-lg shadow-sm border-2 border-purple-200 p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-3">⚖️ Net Bakiye</h3>
              <p className={`text-xl md:text-2xl font-bold ${
                financial.netBalance >= 0
                  ? 'text-green-700'
                  : 'text-red-700'
              }`}>
                {formatCurrency(financial.netBalance)}
              </p>
              <div className="text-xs text-gray-600 mt-2">
                Gelir - Gider
              </div>
            </div>
          )}

          {projects.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-3">🏗️ Projeler</h3>
              <p className="text-2xl md:text-3xl font-bold text-gray-900">
                {projects.length}
              </p>
              <div className="text-xs text-gray-600 mt-2">
                Çalışılan proje sayısı
              </div>
            </div>
          )}
        </div>

        {monthlySummary.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>📊</span> Aylık Özet
            </h2>
            <div className="space-y-4">
              {monthlySummary.map(({ month, incomingInvoices, outgoingInvoices, informalPayments, netTotal }) => {
                const maxValue = Math.max(
                  ...monthlySummary.map(m => 
                    Math.max(
                      m.incomingInvoices + m.informalPayments,
                      m.outgoingInvoices
                    )
                  )
                );
                const [year, monthNum] = month.split('-');
                const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('tr-TR', { 
                  month: 'short', 
                  year: 'numeric' 
                });

                return (
                  <div key={month} className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-gray-800">{monthName}</span>
                      <span className={`font-bold ${netTotal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        Net: {formatCurrency(netTotal)}
                      </span>
                    </div>
                    
                    {outgoingInvoices > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-green-600">
                          <span>📤 Giden Faturalar</span>
                          <span>{formatCurrency(outgoingInvoices)}</span>
                        </div>
                        <div className="h-6 bg-gray-100 rounded-lg overflow-hidden">
                          <div
                            className="h-full bg-green-600 transition-all"
                            style={{ width: `${(outgoingInvoices / maxValue) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {(incomingInvoices > 0 || informalPayments > 0) && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-red-600">
                          <span>📥 Gelen Faturalar</span>
                          <span>{formatCurrency(incomingInvoices)}</span>
                        </div>
                        <div className="h-6 bg-gray-100 rounded-lg overflow-hidden">
                          <div
                            className="h-full bg-red-600 transition-all"
                            style={{ width: `${(incomingInvoices / maxValue) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {informalPayments > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-amber-600">
                          <span>💵 Gayri Resmi</span>
                          <span>{formatCurrency(informalPayments)}</span>
                        </div>
                        <div className="h-6 bg-gray-100 rounded-lg overflow-hidden">
                          <div
                            className="h-full bg-amber-600 transition-all"
                            style={{ width: `${(informalPayments / maxValue) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>📋</span> İşlemler
          </h2>

          <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}>
              Tümü ({allTransactions.length})
            </button>
            {hasIncoming && (
              <button
                onClick={() => setActiveTab('incoming')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === 'incoming'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}>
                📥 Gelen ({invoices.length})
              </button>
            )}
            {hasOutgoing && (
              <button
                onClick={() => setActiveTab('outgoing')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === 'outgoing'
                    ? 'bg-green-600 text-white'
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}>
                📤 Giden ({outgoingInvoices.length})
              </button>
            )}
            {informalPayments.length > 0 && (
              <button
                onClick={() => setActiveTab('payments')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === 'payments'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}>
                💵 Gayri Resmi ({informalPayments.length})
              </button>
            )}
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">Henüz işlem bulunmuyor</p>
            </div>
          ) : (
            <>
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                      <th className="text-left py-3 px-4 font-bold text-gray-900">Tip</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-900">Tarih</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-900">No / Açıklama</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-900">Proje</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-900">Tutar</th>
                      <th className="text-center py-3 px-4 font-bold text-gray-900">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction: any, index: number) => {
                      const isPayment = transaction.type === 'payment';
                      const isOutgoing = transaction.type === 'outgoing';
                      const date = isPayment ? transaction.payment_date : transaction.invoice_date;
                      const amount = transaction.amount;
                      const description = isPayment ? transaction.description : transaction.invoice_number;
                      
                      let projectNames = '';
                      if (!isPayment && transaction.project_links?.length > 0) {
                        projectNames = transaction.project_links
                          .map((link: any) => link.project?.name)
                          .filter(Boolean)
                          .join(', ');
                      } else if (isPayment && transaction.project_id) {
                        const project = projects.find((p: any) => p.id === transaction.project_id);
                        projectNames = project?.name || '';
                      }

                      return (
                        <tr key={`${transaction.type}-${transaction.id}-${index}`} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            {isOutgoing ? (
                              <span className="inline-flex items-center gap-1 text-green-700 font-bold bg-green-50 px-2 py-1 rounded text-xs">
                                📤 Giden
                              </span>
                            ) : isPayment ? (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-2 py-1 rounded text-xs">
                                💵 Ödeme
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-700 font-bold bg-red-50 px-2 py-1 rounded text-xs">
                                📥 Gelen
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-900 font-semibold">
                            {formatDate(date)}
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {description || '-'}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {projectNames || <span className="text-gray-400 italic">Atanmamış</span>}
                          </td>
                          <td className={`py-3 px-4 text-right font-bold ${
                            isOutgoing ? 'text-green-700' : 'text-red-700'
                          }`}>
                            {isOutgoing ? '+' : '-'}{formatCurrency(parseFloat(amount))}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {!isPayment && transaction.file_path ? (
                              <button
                                onClick={async () => {
                                  const url = await getSignedUrl(transaction.file_path);
                                  if (url !== '#') {
                                    window.open(url, '_blank');
                                  }
                                }}
                                className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700">
                                📄 PDF
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="lg:hidden space-y-3">
                {filteredTransactions.map((transaction: any, index: number) => {
                  const isPayment = transaction.type === 'payment';
                  const isOutgoing = transaction.type === 'outgoing';
                  const date = isPayment ? transaction.payment_date : transaction.invoice_date;
                  const amount = transaction.amount;
                  const description = isPayment ? transaction.description : transaction.invoice_number;
                  
                  let projectNames = '';
                  if (!isPayment && transaction.project_links?.length > 0) {
                    projectNames = transaction.project_links
                      .map((link: any) => link.project?.name)
                      .filter(Boolean)
                      .join(', ');
                  } else if (isPayment && transaction.project_id) {
                    const project = projects.find((p: any) => p.id === transaction.project_id);
                    projectNames = project?.name || '';
                  }

                  return (
                    <div key={`${transaction.type}-${transaction.id}-${index}`} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        {isOutgoing ? (
                          <span className="inline-flex items-center gap-1 text-green-700 font-bold bg-green-100 px-2 py-1 rounded text-xs">
                            📤 Giden
                          </span>
                        ) : isPayment ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-100 px-2 py-1 rounded text-xs">
                            💵 Ödeme
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700 font-bold bg-red-100 px-2 py-1 rounded text-xs">
                            📥 Gelen
                          </span>
                        )}
                        <span className="text-sm text-gray-600">{formatDate(date)}</span>
                      </div>
                      
                      <div className="mb-2">
                        <div className="text-sm font-semibold text-gray-900">{description}</div>
                        {projectNames && (
                          <div className="text-xs text-gray-600 mt-1">🏗️ {projectNames}</div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className={`text-lg font-bold ${isOutgoing ? 'text-green-700' : 'text-red-700'}`}>
                          {isOutgoing ? '+' : '-'}{formatCurrency(parseFloat(amount))}
                        </span>
                        {!isPayment && transaction.file_path && (
                          <button
                            onClick={async () => {
                              const url = await getSignedUrl(transaction.file_path);
                              if (url !== '#') {
                                window.open(url, '_blank');
                              }
                            }}
                            className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700">
                            📄 PDF
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {projects.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🏗️</span> Çalışılan Projeler
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map((project: any) => (
                <button
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 hover:border-gray-300 transition-all text-left">
                  <p className="font-semibold text-gray-900">{project.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
