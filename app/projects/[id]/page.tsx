'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProjectSummary } from '@/types';

export default function ProjectSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProjectSummary = async () => {
      try {
        const response = await fetch(`/api/projects/${params.id}/summary`);
        
        if (!response.ok) {
          throw new Error('Failed to load project summary');
        }

        const data = await response.json();
        setSummary(data);
      } catch (error) {
        console.error('Error loading project summary:', error);
        setError('Proje özeti yüklenirken bir hata oluştu');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      loadProjectSummary();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="animate-pulse max-w-7xl mx-auto">
          <div className="h-8 bg-gray-300 rounded-lg w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-300 rounded-lg w-2/3 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-40 bg-white rounded-xl shadow"></div>
            <div className="h-40 bg-white rounded-xl shadow"></div>
            <div className="h-40 bg-white rounded-xl shadow"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border-2 border-red-200 p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {error || 'Proje bulunamadı'}
            </h2>
            <p className="text-gray-600 mb-6">Üzgünüz, bu projeye erişilemiyor.</p>
            <button
              onClick={() => router.push('/projects')}
              className="px-8 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow"
            >
              ← Projelere Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { project, financial, files, activities, monthlySpending, suppliers } = summary;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'in_progress':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'planning':
        return 'Planlama';
      case 'in_progress':
        return 'Devam Ediyor';
      case 'completed':
        return 'Tamamlandı';
      default:
        return status;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Prepare monthly data for chart
  const monthlyData = Object.entries(monthlySpending)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6); // Last 6 months

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Project Header */}
        <div className="mb-6 lg:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => router.push('/projects')}
                className="p-2.5 bg-white hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors flex-shrink-0"
                title="Projelere Dön"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {project.name}
              </h1>
            </div>
            <span
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold ${getStatusColor(
                project.status
              )} self-start sm:self-center`}
            >
              {getStatusText(project.status)}
            </span>
          </div>
          {project.description && (
            <p className="text-gray-700 text-base sm:text-lg ml-0 sm:ml-14 leading-relaxed">
              {project.description}
            </p>
          )}
        </div>

        {/* Financial Summary - Main Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 lg:mb-8">
          {/* Grand Total Card */}
          <div className="bg-white border-2 border-gray-900 rounded-lg shadow-lg p-6 sm:p-7">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">💰 Toplam Harcama</h2>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 break-words">{formatCurrency(financial.grandTotal)}</p>
            <p className="text-sm text-gray-600">Tüm faturalar ve ödemeler</p>
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
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-xs font-semibold text-gray-600 mb-1">Toplam Tutar</p>
                <p className="text-2xl font-bold text-gray-900 break-words">
                  {formatCurrency(financial.invoices.totalAmount)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 font-semibold mb-1">KDV</p>
                  <p className="text-sm font-bold text-gray-900 break-words">
                    {formatCurrency(financial.invoices.totalVAT)}
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
        </div>

        {/* Secondary Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 lg:mb-8">
          {/* Dates Card */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>📅</span> Tarihler
            </h2>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-600 font-semibold mb-1">Başlangıç</p>
                <p className="text-sm text-gray-900 font-bold">
                  {formatDate(project.start_date)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-600 font-semibold mb-1">Bitiş</p>
                <p className="text-sm text-gray-900 font-bold">
                  {formatDate(project.end_date)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-600 font-semibold mb-1">Oluşturulma</p>
                <p className="text-sm text-gray-900 font-bold">
                  {formatDate(project.created_at)}
                </p>
              </div>
            </div>
          </div>

          {/* File Statistics Card */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>📁</span> Dosyalar
            </h2>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-600 font-semibold mb-1">Toplam Dosya</p>
                <p className="text-3xl font-bold text-gray-900">
                  {files.count}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-600 font-semibold mb-1">Toplam Boyut</p>
                <p className="text-base font-bold text-gray-900">
                  {formatFileSize(files.totalSize)}
                </p>
              </div>
            </div>
          </div>

        {/* Quick Actions Card */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>⚡</span> Hızlı İşlemler
          </h2>
          <div className="space-y-3">
            <button
              onClick={() => router.push(`/invoices?project=${project.id}`)}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
              <span>📄</span>
              <span>Faturaları Görüntüle</span>
            </button>
            <button
              onClick={() => router.push(`/informal-payments?project=${project.id}`)}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
              <span>💵</span>
              <span>Ödemeleri Görüntüle</span>
            </button>
            <button
              onClick={() => router.push(`/projects/${project.id}/mimari`)}
              className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-800 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
              <span>📁</span>
              <span>Dosyaları Yönet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Spending Chart */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 sm:p-7 mb-6 lg:mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span>📊</span> Aylık Harcama Grafiği
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {monthlyData.map(([month, data]) => {
              const total = data.invoices + data.informalPayments;
              const maxValue = Math.max(...monthlyData.map(([, d]) => d.invoices + d.informalPayments));
              
              const [year, monthNum] = month.split('-');
              const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('tr-TR', { 
                month: 'short', 
                year: 'numeric' 
              });

              return (
                <div key={month} className="space-y-2">
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="font-bold text-gray-800">
                      {monthName}
                    </span>
                    <span className="text-gray-900 font-bold">
                      {formatCurrency(total)}
                    </span>
                  </div>
                  <div className="relative h-8 sm:h-10 bg-gray-100 rounded-lg overflow-hidden">
                    {data.invoices > 0 && (
                      <div
                        className="absolute h-full bg-blue-600 transition-all"
                        style={{ width: `${(data.invoices / maxValue) * 100}%` }}
                        title={`Faturalar: ${formatCurrency(data.invoices)}`}
                      />
                    )}
                    {data.informalPayments > 0 && (
                      <div
                        className="absolute h-full bg-red-600 transition-all"
                        style={{ 
                          left: `${(data.invoices / maxValue) * 100}%`,
                          width: `${(data.informalPayments / maxValue) * 100}%` 
                        }}
                        title={`Gayri Resmi: ${formatCurrency(data.informalPayments)}`}
                      />
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-blue-600 rounded flex-shrink-0"></div>
                      <span className="break-words">Faturalar: {formatCurrency(data.invoices)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-red-600 rounded flex-shrink-0"></div>
                      <span className="break-words">Gayri Resmi: {formatCurrency(data.informalPayments)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activities */}
      {activities.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 sm:p-7 mb-6 lg:mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span>🕐</span> Son Aktiviteler
          </h2>
          <div className="space-y-3">
            {activities.slice(0, 5).map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 sm:p-4 rounded-lg hover:bg-gray-50 transition-all border border-gray-200"
              >
                <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gray-100 flex items-center justify-center text-sm sm:text-base">
                  {activity.entity_type === 'invoice' ? '📄' : 
                   activity.entity_type === 'informal_payment' ? '💵' : 
                   activity.entity_type === 'file' ? '📁' : '📝'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-900 font-medium">
                    <span className="font-bold text-gray-900">{activity.user?.name || 'Kullanıcı'}</span>
                    {' '}
                    {activity.action === 'create' ? 'oluşturdu' : 
                     activity.action === 'update' ? 'güncelledi' : 
                     activity.action === 'delete' ? 'sildi' : activity.action}
                  </p>
                  <p className="text-xs text-gray-600 font-medium">
                    {formatDate(activity.created_at)} - {new Date(activity.created_at).toLocaleTimeString('tr-TR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suppliers / Subcontractors */}
      {suppliers && suppliers.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 sm:p-7">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span>🏢</span> Tedarikçiler & Taşeronlar
          </h2>
          <div className="overflow-x-auto -mx-6 sm:mx-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="text-left py-4 px-4 font-bold text-gray-900">Firma Adı</th>
                  <th className="text-left py-4 px-4 font-bold text-gray-900 hidden sm:table-cell">VKN</th>
                  <th className="text-right py-4 px-4 font-bold text-gray-900">Fatura</th>
                  <th className="text-right py-4 px-4 font-bold text-gray-900">Ödeme</th>
                  <th className="text-right py-4 px-4 font-bold text-gray-900">Toplam</th>
                  <th className="text-right py-4 px-4 font-bold text-gray-900">Detay</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier, index) => (
                  <tr 
                    key={index}
                    className="border-b border-gray-200 hover:bg-gray-50 transition-all"
                  >
                    <td className="py-4 px-4">
                      <div className="font-bold text-gray-900">
                        {supplier.name}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-700 hidden sm:table-cell font-mono text-xs font-semibold">
                      {supplier.vkn || '-'}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-blue-700 font-bold">
                        <span className="text-xs bg-blue-50 px-2.5 py-1 rounded-lg">({supplier.invoiceCount})</span>
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-red-700 font-bold">
                        <span className="text-xs bg-red-50 px-2.5 py-1 rounded-lg">({supplier.paymentCount})</span>
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-gray-900">
                      {formatCurrency(supplier.total)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      {supplier.supplierId && (
                        <button
                          onClick={() => router.push(`/suppliers/${supplier.supplierId}`)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors">
                          Görüntüle
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-200 font-bold border-t-2 border-gray-300">
                  <td className="py-5 px-4 text-gray-900 font-bold" colSpan={2}>
                    Toplam ({suppliers.length} firma)
                  </td>
                  <td className="py-5 px-4 text-right text-blue-700 font-bold">
                    {suppliers.reduce((sum, s) => sum + s.invoiceCount, 0)}
                  </td>
                  <td className="py-5 px-4 text-right text-red-700 font-bold">
                    {suppliers.reduce((sum, s) => sum + s.paymentCount, 0)}
                  </td>
                  <td className="py-5 px-4 text-right text-gray-900 text-base font-bold">
                    {formatCurrency(suppliers.reduce((sum, s) => sum + s.total, 0))}
                  </td>
                  <td className="py-5 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
