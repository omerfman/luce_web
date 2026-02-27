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
  const [pettyCashReceipts, setPettyCashReceipts] = useState<any[]>([]);
  const [pettyCashTotal, setPettyCashTotal] = useState<number>(0);

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
      loadPettyCash();
    }
  }, [params.id]);
  
  const loadPettyCash = async () => {
    try {
      const response = await fetch(`/api/petty-cash?project_id=${params.id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Petty cash API error:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to load petty cash');
      }

      const data = await response.json();
      setPettyCashReceipts(data.items || []);
      setPettyCashTotal(parseFloat(data.stats?.totalExpense || '0'));
    } catch (error: any) {
      console.error('Error loading petty cash:', error);
      console.error('Error message:', error.message);
    }
  };

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 lg:mb-8">
          {/* Incoming Invoices Card */}
          <div className="bg-white rounded-lg shadow border border-red-200 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">
                📥 Gelen Faturalar
              </h2>
              <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-semibold">
                {financial.invoices.count}
              </span>
            </div>
            <div className="bg-red-50 rounded-lg p-3 border border-red-200 mb-3">
              <p className="text-xs font-semibold text-gray-600 mb-1">Toplam</p>
              <p className="text-xl font-bold text-red-600 break-words">
                {formatCurrency(financial.invoices.totalAmount)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded p-2 border border-gray-200">
                <p className="text-xs text-gray-600 font-medium mb-0.5">KDV</p>
                <p className="text-xs font-bold text-gray-900 break-words">
                  {formatCurrency(financial.invoices.totalVAT)}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-2 border border-gray-200">
                <p className="text-xs text-gray-600 font-medium mb-0.5">Tevkifat</p>
                <p className="text-xs font-bold text-gray-900 break-words">
                  {formatCurrency(financial.invoices.totalWithholding)}
                </p>
              </div>
            </div>
          </div>

          {/* Outgoing Invoices Card */}
          <div className="bg-white rounded-lg shadow border border-green-200 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">
                📤 Giden Faturalar
              </h2>
              <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-semibold">
                {financial.outgoingInvoices.count}
              </span>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200 mb-3">
              <p className="text-xs font-semibold text-gray-600 mb-1">Toplam</p>
              <p className="text-xl font-bold text-green-600 break-words">
                {formatCurrency(financial.outgoingInvoices.totalAmount)}
              </p>
            </div>
            <div className="bg-gray-50 rounded p-2 border border-gray-200">
              <p className="text-xs text-gray-600 font-medium mb-0.5">Tevkifat</p>
              <p className="text-xs font-bold text-gray-900 break-words">
                {formatCurrency(financial.outgoingInvoices.totalWithholding)}
              </p>
            </div>
          </div>

          {/* Informal Payments Card */}
          <div className="bg-white rounded-lg shadow border border-amber-200 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">
                💵 Gayri Resmi
              </h2>
              <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-sm font-semibold">
                {financial.informalPayments.count}
              </span>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
              <p className="text-xs font-semibold text-gray-600 mb-1">Toplam</p>
              <p className="text-xl font-bold text-amber-600 break-words">
                {formatCurrency(financial.informalPayments.totalAmount)}
              </p>
            </div>
          </div>
          
          {/* Petty Cash Receipts Card */}
          <div className="bg-white rounded-lg shadow border border-purple-200 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">
                💼 Kasa Fişleri
              </h2>
              <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold">
                {pettyCashReceipts.length}
              </span>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
              <p className="text-xs font-semibold text-gray-600 mb-1">Toplam</p>
              <p className="text-xl font-bold text-purple-600 break-words">
                {formatCurrency(pettyCashTotal)}
              </p>
            </div>
            {pettyCashReceipts.length > 0 && (
              <button
                onClick={() => router.push(`/petty-cash?project_id=${params.id}`)}
                className="mt-3 w-full px-3 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-medium text-purple-700 transition-colors"
              >
                Tümünü Görüntüle →
              </button>
            )}
          </div>

          {/* Rejected Invoices Card */}
          {financial.rejectedInvoices && financial.rejectedInvoices.count > 0 && (
            <div className="bg-white rounded-lg shadow border border-red-200 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900">
                  ❌ Reddedilen Faturalar
                </h2>
                <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-semibold">
                  {financial.rejectedInvoices.count}
                </span>
              </div>
              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <p className="text-xs font-semibold text-gray-600 mb-1">Toplam (Geçersiz)</p>
                <p className="text-xl font-bold text-red-600 break-words">
                  {formatCurrency(financial.rejectedInvoices.totalAmount)}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Bu faturalar geçersiz sayılır ve hesaplamalara dahil edilmez.
              </p>
            </div>
          )}

          {/* Net Balance Card */}
          <div className="bg-white border-2 border-purple-600 rounded-lg shadow-lg p-5 sm:p-6">
            <div className="mb-3">
              <h2 className="text-base font-bold text-gray-900">⚖️ Net Bakiye</h2>
            </div>
            <p className={`text-2xl sm:text-3xl font-bold mb-2 break-words ${
              financial.netBalance >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(financial.netBalance)}
            </p>
            <p className="text-xs text-gray-600">
              {financial.netBalance >= 0 ? '✓ Pozitif bakiye' : '✗ Negatif bakiye'}
            </p>
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
            <span>📊</span> Aylık Finansal Özet
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {monthlyData.map(([month, data]) => {
              const incoming = data.incomingInvoices || 0;
              const outgoing = data.outgoingInvoices || 0;
              const informal = data.informalPayments || 0;
              const netTotal = outgoing - incoming - informal;
              const maxValue = Math.max(...monthlyData.map(([, d]) => 
                Math.max((d.incomingInvoices || 0) + (d.informalPayments || 0), d.outgoingInvoices || 0)
              ));
              
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
                    <span className={`font-bold ${netTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Net: {formatCurrency(netTotal)}
                    </span>
                  </div>
                  
                  {/* Expense Bar (Incoming + Informal) */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600 font-medium">Giderler:</p>
                    <div className="relative h-6 sm:h-8 bg-gray-100 rounded-lg overflow-hidden">
                      {incoming > 0 && (
                        <div
                          className="absolute h-full bg-red-500 transition-all"
                          style={{ width: `${(incoming / maxValue) * 100}%` }}
                          title={`Gelen Faturalar: ${formatCurrency(incoming)}`}
                        />
                      )}
                      {informal > 0 && (
                        <div
                          className="absolute h-full bg-amber-500 transition-all"
                          style={{ 
                            left: `${(incoming / maxValue) * 100}%`,
                            width: `${(informal / maxValue) * 100}%` 
                          }}
                          title={`Gayri Resmi: ${formatCurrency(informal)}`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Income Bar (Outgoing) */}
                  {outgoing > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-600 font-medium">Gelirler:</p>
                      <div className="relative h-6 sm:h-8 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="absolute h-full bg-green-500 transition-all"
                          style={{ width: `${(outgoing / maxValue) * 100}%` }}
                          title={`Giden Faturalar: ${formatCurrency(outgoing)}`}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs text-gray-600 pt-1">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-red-500 rounded flex-shrink-0"></div>
                      <span className="break-words">Gelen: {formatCurrency(incoming)}</span>
                    </div>
                    {outgoing > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-500 rounded flex-shrink-0"></div>
                        <span className="break-words">Giden: {formatCurrency(outgoing)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-amber-500 rounded flex-shrink-0"></div>
                      <span className="break-words">Gayri Resmi: {formatCurrency(informal)}</span>
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
            <span>🏢</span> Firmalar
          </h2>
          <div className="overflow-x-auto -mx-6 sm:mx-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="text-left py-4 px-4 font-bold text-gray-900">Firma Adı</th>
                  <th className="text-left py-4 px-4 font-bold text-gray-900 hidden lg:table-cell">Rol</th>
                  <th className="text-left py-4 px-4 font-bold text-gray-900 hidden sm:table-cell">VKN</th>
                  <th className="text-right py-4 px-4 font-bold text-gray-900">📥 Gelen</th>
                  <th className="text-right py-4 px-4 font-bold text-gray-900 hidden lg:table-cell">📤 Giden</th>
                  <th className="text-right py-4 px-4 font-bold text-gray-900">💵 Ödeme</th>
                  <th className="text-right py-4 px-4 font-bold text-gray-900">Toplam</th>
                  <th className="text-right py-4 px-4 font-bold text-gray-900">Detay</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier, index) => {
                  const roleLabel = supplier.role === 'both' ? '🔄 İkisi' : 
                                   supplier.role === 'customer' ? '📤 Müşteri' : '📥 Tedarikçi';
                  const roleColor = supplier.role === 'both' ? 'bg-purple-100 text-purple-700' :
                                   supplier.role === 'customer' ? 'bg-green-100 text-green-700' : 
                                   'bg-red-100 text-red-700';
                  
                  return (
                    <tr 
                      key={index}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-all"
                    >
                      <td className="py-4 px-4">
                        <div className="font-bold text-gray-900">
                          {supplier.name}
                        </div>
                      </td>
                      <td className="py-4 px-4 hidden lg:table-cell">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${roleColor}`}>
                          {roleLabel}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-700 hidden sm:table-cell font-mono text-xs font-semibold">
                        {supplier.vkn || '-'}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-red-700 font-bold">
                          <span className="text-xs bg-red-50 px-2.5 py-1 rounded-lg">
                            {supplier.incomingInvoiceCount || 0}
                          </span>
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 text-green-700 font-bold">
                          <span className="text-xs bg-green-50 px-2.5 py-1 rounded-lg">
                            {supplier.outgoingInvoiceCount || 0}
                          </span>
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                          <span className="text-xs bg-amber-50 px-2.5 py-1 rounded-lg">
                            {supplier.paymentCount || 0}
                          </span>
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
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-200 font-bold border-t-2 border-gray-300">
                  <td className="py-5 px-4 text-gray-900 font-bold" colSpan={3}>
                    Toplam ({suppliers.length} firma)
                  </td>
                  <td className="py-5 px-4 text-right text-red-700 font-bold">
                    {suppliers.reduce((sum, s) => sum + (s.incomingInvoiceCount || 0), 0)}
                  </td>
                  <td className="py-5 px-4 text-right text-green-700 font-bold hidden lg:table-cell">
                    {suppliers.reduce((sum, s) => sum + (s.outgoingInvoiceCount || 0), 0)}
                  </td>
                  <td className="py-5 px-4 text-right text-amber-700 font-bold">
                    {suppliers.reduce((sum, s) => sum + (s.paymentCount || 0), 0)}
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
