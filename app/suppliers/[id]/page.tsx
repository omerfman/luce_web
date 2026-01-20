'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';

interface SupplierSummary {
  supplier: any;
  financial: {
    grandTotal: number;
    invoices: {
      count: number;
      totalAmount: number;
      totalTax: number;
      totalWithholding: number;
    };
    informalPayments: {
      count: number;
      totalAmount: number;
    };
  };
  invoices: any[];
  informalPayments: any[];
  projects: any[];
  monthlySummary: {
    month: string;
    invoices: number;
    informalPayments: number;
    total: number;
  }[];
}

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SupplierSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments' | 'all'>('all');

  useEffect(() => {
    console.log('🔍 [Supplier Detail] useEffect triggered, supplierId:', supplierId);
    if (supplierId) {
      loadSummary();
    }
  }, [supplierId]);

  async function loadSummary() {
    try {
      setLoading(true);
      console.log('📡 [Supplier Detail] Fetching data for supplier:', supplierId);
      console.log('📡 [Supplier Detail] API URL:', `/api/suppliers/${supplierId}/summary`);
      
      const response = await fetch(`/api/suppliers/${supplierId}/summary`);
      
      console.log('📡 [Supplier Detail] Response status:', response.status);
      console.log('📡 [Supplier Detail] Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Supplier Detail] Error response:', errorText);
        throw new Error('Firma bilgileri yüklenemedi');
      }

      const data = await response.json();
      console.log('✅ [Supplier Detail] Data received:', data);
      console.log('✅ [Supplier Detail] Financial summary:', data.financial);
      console.log('✅ [Supplier Detail] Invoices count:', data.invoices?.length || 0);
      console.log('✅ [Supplier Detail] Payments count:', data.informalPayments?.length || 0);
      console.log('✅ [Supplier Detail] Projects count:', data.projects?.length || 0);
      if (data.projects?.length > 0) {
        console.log('✅ [Supplier Detail] Projects:', data.projects);
      } else {
        console.log('⚠️ [Supplier Detail] No projects found in response');
      }
      
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
      <div className="flex h-screen">
        <Sidebar>
          <div></div>
        </Sidebar>
        <div className="flex-1 bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="flex h-screen">
        <Sidebar>
          <div></div>
        </Sidebar>
        <div className="flex-1 bg-gray-50 flex items-center justify-center">
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
      </div>
    );
  }

  const { supplier, financial, invoices, informalPayments, projects, monthlySummary } = summary;

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

  const filteredTransactions = activeTab === 'invoices' 
    ? invoices 
    : activeTab === 'payments' 
    ? informalPayments 
    : [...invoices.map(i => ({ ...i, type: 'invoice' })), ...informalPayments.map(p => ({ ...p, type: 'payment' }))].sort((a, b) => {
        const dateA = new Date(a.invoice_date || a.payment_date).getTime();
        const dateB = new Date(b.invoice_date || b.payment_date).getTime();
        return dateB - dateA;
      });

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar>
        <div></div>
      </Sidebar>
      <div className="flex-1 bg-gray-50 overflow-auto">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl">
          {/* Header */}
          <div className="mb-6 lg:mb-8">
            <button
              onClick={() => router.back()}
              className="mb-4 px-4 py-2 text-gray-700 hover:text-gray-900 font-medium rounded-lg border border-gray-300 hover:border-gray-400 transition-colors flex items-center gap-2">
              <span>←</span> Geri
            </button>
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {supplier.name}
                </h1>
                <div className="flex flex-wrap gap-3 items-center">
                  {getSupplierTypeBadge(supplier.supplier_type)}
                  {supplier.vkn && (
                    <span className="text-sm text-gray-600 font-mono bg-gray-100 px-3 py-1 rounded-lg">
                      VKN: {supplier.vkn}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 lg:mb-8">
            {/* Grand Total */}
            <div className="bg-white rounded-lg shadow border border-gray-900 p-6 sm:p-7 col-span-full">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                💰 Toplam Harcama
              </h2>
              <p className="text-4xl font-bold text-gray-900 break-words">
                {formatCurrency(financial.grandTotal)}
              </p>
            </div>

            {/* Invoices Card */}
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6 sm:p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  📄 Faturalar
                </h2>
                <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-semibold">
                  {financial.invoices.count}
                </span>
              </div>
              <div className="space-y-3">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Toplam Tutar</p>
                  <p className="text-2xl font-bold text-gray-900 break-words">
                    {formatCurrency(financial.invoices.totalAmount)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 font-semibold mb-1">KDV</p>
                  <p className="text-sm font-bold text-gray-900 break-words">
                    {formatCurrency(financial.invoices.totalTax)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 font-semibold mb-1">Tevkifat</p>
                  <p className="text-sm font-bold text-gray-900 break-words">
                    {formatCurrency(financial.invoices.totalWithholding)}
                  </p>
                </div>
              </div>
            </div>

            {/* Informal Payments Card */}
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6 sm:p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  💵 Gayri Resmi
                </h2>
                <span className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm font-semibold">
                  {financial.informalPayments.count}
                </span>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-xs font-semibold text-gray-600 mb-1">Toplam Tutar</p>
                <p className="text-2xl font-bold text-gray-900 break-words">
                  {formatCurrency(financial.informalPayments.totalAmount)}
                </p>
              </div>
            </div>

            {/* Projects Card */}
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>🏗️</span> Projeler
              </h2>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-600 font-semibold mb-1">Çalışılan Proje Sayısı</p>
                <p className="text-3xl font-bold text-gray-900">
                  {projects.length}
                </p>
              </div>
            </div>
          </div>

          {/* Monthly Chart */}
          {monthlySummary.length > 0 && (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6 sm:p-7 mb-6 lg:mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span>📊</span> Aylık Harcama Grafiği
              </h2>
              <div className="space-y-6">
                {monthlySummary.map(({ month, invoices: inv, informalPayments: pay, total }) => {
                  const maxValue = Math.max(...monthlySummary.map(m => m.total));
                  const [year, monthNum] = month.split('-');
                  const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('tr-TR', { 
                    month: 'short', 
                    year: 'numeric' 
                  });

                  return (
                    <div key={month} className="space-y-2">
                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="font-bold text-gray-800">{monthName}</span>
                        <span className="text-gray-900 font-bold">{formatCurrency(total)}</span>
                      </div>
                      <div className="relative h-8 sm:h-10 bg-gray-100 rounded-lg overflow-hidden">
                        {inv > 0 && (
                          <div
                            className="absolute h-full bg-blue-600 transition-all"
                            style={{ width: `${(inv / maxValue) * 100}%` }}
                            title={`Faturalar: ${formatCurrency(inv)}`}
                          />
                        )}
                        {pay > 0 && (
                          <div
                            className="absolute h-full bg-red-600 transition-all"
                            style={{ 
                              left: `${(inv / maxValue) * 100}%`,
                              width: `${(pay / maxValue) * 100}%` 
                            }}
                            title={`Gayri Resmi: ${formatCurrency(pay)}`}
                          />
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-blue-600 rounded flex-shrink-0"></div>
                          <span className="break-words">Faturalar: {formatCurrency(inv)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-red-600 rounded flex-shrink-0"></div>
                          <span className="break-words">Gayri Resmi: {formatCurrency(pay)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Transactions List */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6 sm:p-7">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span>📋</span> İşlemler
            </h2>

            {/* Tab Buttons */}
            <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  activeTab === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}>
                Tümü ({invoices.length + informalPayments.length})
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  activeTab === 'invoices'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}>
                Faturalar ({invoices.length})
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  activeTab === 'payments'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}>
                Gayri Resmi ({informalPayments.length})
              </button>
            </div>

            {/* Transactions Table */}
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">Henüz işlem bulunmuyor</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 sm:mx-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                      <th className="text-left py-4 px-4 font-bold text-gray-900">Tip</th>
                      <th className="text-left py-4 px-4 font-bold text-gray-900">Tarih</th>
                      <th className="text-left py-4 px-4 font-bold text-gray-900 hidden sm:table-cell">Proje</th>
                      <th className="text-left py-4 px-4 font-bold text-gray-900 hidden md:table-cell">Açıklama</th>
                      <th className="text-right py-4 px-4 font-bold text-gray-900">Tutar</th>
                      <th className="text-center py-4 px-4 font-bold text-gray-900">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction: any, index: number) => {
                      const isInvoice = transaction.type === 'invoice' || transaction.invoice_number;
                      const date = isInvoice ? transaction.invoice_date : transaction.payment_date;
                      // Use 'amount' field for both invoices and payments
                      const amount = transaction.amount;
                      const description = isInvoice ? transaction.invoice_number : transaction.description;
                      
                      // For invoices: get projects from project_links array (many-to-many)
                      // For payments: use direct project_id (one-to-one)
                      let projectNames = '';
                      if (isInvoice && transaction.project_links && transaction.project_links.length > 0) {
                        // Invoice can have multiple projects
                        projectNames = transaction.project_links
                          .map((link: any) => link.project?.name)
                          .filter(Boolean)
                          .join(', ');
                      } else if (!isInvoice && transaction.project_id) {
                        // Payment has single project
                        const project = projects.find((p: any) => p.id === transaction.project_id);
                        projectNames = project?.name || '';
                      }

                      // Detailed logging for debugging (first transaction only)
                      if (index === 0) {
                        console.log('🔍 [Transaction Debug] First transaction:', {
                          type: isInvoice ? 'invoice' : 'payment',
                          id: transaction.id,
                          amount,
                          description,
                          project_links: transaction.project_links,
                          project_id: transaction.project_id,
                          resolved_projects: projectNames
                        });
                        console.log('🔍 [Transaction Debug] Available projects:', projects.map((p: any) => ({ id: p.id, name: p.name })));
                      }

                      return (
                        <tr key={`${isInvoice ? 'inv' : 'pay'}-${transaction.id}-${index}`} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                          <td className="py-4 px-4">
                            {isInvoice ? (
                              <span className="inline-flex items-center gap-1 text-blue-700 font-bold bg-blue-50 px-2.5 py-1 rounded-lg text-xs">
                                📄 Fatura
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-700 font-bold bg-red-50 px-2.5 py-1 rounded-lg text-xs">
                                💵 Ödeme
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-gray-900 font-semibold">
                            {formatDate(date)}
                          </td>
                          <td className="py-4 px-4 text-gray-700 hidden sm:table-cell">
                            {projectNames || <span className="text-gray-400 italic">Atanmamış</span>}
                          </td>
                          <td className="py-4 px-4 text-gray-600 hidden md:table-cell">
                            <span className="line-clamp-1" title={description}>
                              {description || '-'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right font-bold text-gray-900">
                            {formatCurrency(parseFloat(amount))}
                          </td>
                          <td className="py-4 px-4 text-center">
                            {isInvoice && transaction.file_path ? (
                              <a
                                href={`https://res.cloudinary.com/dpqwbueoj/image/upload/${transaction.file_path}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                                title="PDF'i Görüntüle">
                                📄 PDF
                              </a>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-200 font-bold border-t-2 border-gray-300">
                      <td className="py-5 px-4 text-gray-900 font-bold" colSpan={5}>
                        Toplam ({filteredTransactions.length} işlem)
                      </td>
                      <td className="py-5 px-4 text-right text-gray-900 text-base font-bold">
                        {formatCurrency(
                          filteredTransactions.reduce((sum: number, t: any) => {
                            const amount = t.amount;
                            return sum + (parseFloat(amount) || 0);
                          }, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Projects List */}
          {projects.length > 0 && (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6 sm:p-7 mt-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span>🏗️</span> Çalışılan Projeler
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project: any) => (
                  <button
                    key={project.id}
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 hover:border-gray-300 transition-all text-left">
                    <p className="font-semibold text-gray-900">{project.name}</p>
                    {project.project_code && (
                      <p className="text-sm text-gray-600 mt-1 font-mono">{project.project_code}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
