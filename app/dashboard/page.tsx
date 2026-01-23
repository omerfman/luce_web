'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { 
  DashboardStats, 
  DashboardRecentActivities, 
  DashboardChartData 
} from '@/types';

// Stat Card Component
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
  onClick?: () => void;
}

function StatCard({ title, value, subtitle, icon, color, onClick }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  };

  return (
    <Card 
      hover 
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`rounded-full p-3 ${colorClasses[color]}`}>
            <span className="text-2xl">{icon}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Recent Activity Item Component
interface RecentActivityItemProps {
  icon: string;
  title: string;
  subtitle: string;
  amount?: number;
  date: string;
  type: 'invoice' | 'payment' | 'project';
}

function RecentActivityItem({ icon, title, subtitle, amount, date, type }: RecentActivityItemProps) {
  const typeColors = {
    invoice: 'bg-blue-50 text-blue-600',
    payment: 'bg-red-50 text-red-600',
    project: 'bg-green-50 text-green-600',
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
      <div className={`rounded-lg p-2 ${typeColors[type]}`}>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
        <p className="text-xs text-gray-400 mt-1">{formatDate(date)}</p>
      </div>
      {amount !== undefined && (
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900">
            {formatCurrency(amount)}
          </p>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, company, isLoading: authLoading } = useAuth();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<DashboardRecentActivities | null>(null);
  const [chartData, setChartData] = useState<DashboardChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      loadDashboardData();
    }
  }, [authLoading, user]);

  async function loadDashboardData() {
    try {
      setLoading(true);
      setError(null);

      // Fetch all dashboard data in parallel
      const [statsRes, recentRes, chartsRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/dashboard/recent'),
        fetch('/api/dashboard/charts'),
      ]);

      if (!statsRes.ok || !recentRes.ok || !chartsRes.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [statsData, recentData, chartsData] = await Promise.all([
        statsRes.json(),
        recentRes.json(),
        chartsRes.json(),
      ]);

      setStats(statsData);
      setRecentActivities(recentData);
      setChartData(chartsData);
    } catch (err: any) {
      console.error('Dashboard error:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Dashboard yükleniyor...</p>
          </div>
        </div>
      </Sidebar>
    );
  }

  if (error) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <span className="text-6xl">⚠️</span>
            <p className="mt-4 text-red-600 font-semibold">{error}</p>
            <button
              onClick={loadDashboardData}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Yeniden Dene
            </button>
          </div>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Hoş Geldiniz, {user?.name}! 👋
          </h1>
          <p className="mt-2 text-gray-600">
            {company?.name} - Genel Bakış
          </p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Toplam Projeler"
            value={stats?.projects.total || 0}
            subtitle={`${stats?.projects.active || 0} aktif`}
            icon="📁"
            color="blue"
            onClick={() => router.push('/projects')}
          />
          
          <StatCard
            title="Bekleyen Faturalar"
            value={stats?.pendingInvoices || 0}
            subtitle="Projeye atanmamış"
            icon="⏳"
            color="yellow"
            onClick={() => router.push('/invoices')}
          />
          
          <StatCard
            title="Toplam Tedarikçi"
            value={stats?.suppliers.total || 0}
            subtitle={`${stats?.suppliers.subcontractors || 0} taşeron`}
            icon="🏢"
            color="purple"
            onClick={() => router.push('/subcontractors')}
          />
          
          <StatCard
            title="Bu Ay Toplam"
            value={formatCurrency(stats?.thisMonthTotal || 0)}
            subtitle="Fatura + Ödeme"
            icon="📊"
            color="green"
          />
        </div>

        {/* Financial Overview */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>💰 Finansal Özet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Grand Total */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                  <p className="text-sm font-medium text-gray-600">Toplam Harcama</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">
                    {formatCurrency(stats?.grandTotal || 0)}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Tüm faturalar ve ödemeler
                  </p>
                </div>

                {/* Invoice Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-xs font-semibold text-gray-600">FATURALAR</p>
                    <p className="text-2xl font-bold text-blue-700 mt-1">
                      {formatCurrency(stats?.invoices.totalAmount || 0)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {stats?.invoices.count || 0} adet fatura
                    </p>
                  </div>

                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <p className="text-xs font-semibold text-gray-600">GAYRİ RESMİ</p>
                    <p className="text-2xl font-bold text-red-700 mt-1">
                      {formatCurrency(stats?.payments.totalAmount || 0)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {stats?.payments.count || 0} adet ödeme
                    </p>
                  </div>
                </div>

                {/* VAT and Withholding */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-600">KDV TOPLAMI</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {formatCurrency(stats?.invoices.totalVAT || 0)}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-600">TEVKİFAT TOPLAMI</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {formatCurrency(stats?.invoices.totalWithholding || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Status */}
          <Card>
            <CardHeader>
              <CardTitle>📊 Proje Durumları</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">✅</span>
                    <span className="text-sm font-medium text-gray-700">Aktif</span>
                  </div>
                  <span className="text-lg font-bold text-green-700">
                    {stats?.projects.active || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📋</span>
                    <span className="text-sm font-medium text-gray-700">Planlama</span>
                  </div>
                  <span className="text-lg font-bold text-blue-700">
                    {stats?.projects.planning || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎯</span>
                    <span className="text-sm font-medium text-gray-700">Tamamlanan</span>
                  </div>
                  <span className="text-lg font-bold text-gray-700">
                    {stats?.projects.completed || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⏸️</span>
                    <span className="text-sm font-medium text-gray-700">Beklemede</span>
                  </div>
                  <span className="text-lg font-bold text-yellow-700">
                    {stats?.projects.onHold || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities and Top Projects */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Invoices */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>📄 Son Faturalar</CardTitle>
                <button
                  onClick={() => router.push('/invoices')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Tümünü Gör →
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {recentActivities?.invoices && recentActivities.invoices.length > 0 ? (
                <div className="space-y-2">
                  {recentActivities.invoices.map((invoice) => (
                    <RecentActivityItem
                      key={invoice.id}
                      icon="📄"
                      title={invoice.invoice_number}
                      subtitle={invoice.supplier_name || 'Tedarikçi belirtilmemiş'}
                      amount={parseFloat(invoice.amount as any)}
                      date={invoice.invoice_date}
                      type="invoice"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Henüz fatura yok</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Payments */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>💵 Son Ödemeler</CardTitle>
                <button
                  onClick={() => router.push('/informal-payments')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Tümünü Gör →
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {recentActivities?.payments && recentActivities.payments.length > 0 ? (
                <div className="space-y-2">
                  {recentActivities.payments.map((payment) => (
                    <RecentActivityItem
                      key={payment.id}
                      icon="💵"
                      title={payment.description || 'Açıklama yok'}
                      subtitle={payment.supplier?.name || payment.payment_method}
                      amount={parseFloat(payment.amount as any)}
                      date={payment.payment_date}
                      type="payment"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Henüz ödeme yok</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Projects and Suppliers */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Projects */}
          <Card>
            <CardHeader>
              <CardTitle>🏆 En Yüksek Harcamalı Projeler</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData?.topProjects && chartData.topProjects.length > 0 ? (
                <div className="space-y-3">
                  {chartData.topProjects.map((project, index) => (
                    <div
                      key={project.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {project.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {formatCurrency(project.total)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Henüz proje harcaması yok</p>
              )}
            </CardContent>
          </Card>

          {/* Top Suppliers */}
          <Card>
            <CardHeader>
              <CardTitle>🏢 En Çok İşlem Yapılan Tedarikçiler</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData?.topSuppliers && chartData.topSuppliers.length > 0 ? (
                <div className="space-y-3">
                  {chartData.topSuppliers.map((supplier, index) => (
                    <div
                      key={supplier.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/suppliers/${supplier.id}`)}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {supplier.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {supplier.transactionCount} işlem
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {formatCurrency(supplier.total)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Henüz tedarikçi işlemi yok</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Spending Trend */}
        {chartData?.monthlySpending && chartData.monthlySpending.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>📈 Aylık Harcama Trendi (Son 6 Ay)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {chartData.monthlySpending.map((month) => {
                  const maxTotal = Math.max(...chartData.monthlySpending.map(m => m.total));
                  const percentage = (month.total / maxTotal) * 100;
                  
                  return (
                    <div key={month.month}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {new Date(month.month + '-01').toLocaleDateString('tr-TR', { 
                            year: 'numeric', 
                            month: 'long' 
                          })}
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                          {formatCurrency(month.total)}
                        </span>
                      </div>
                      <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                        <div className="absolute inset-0 flex items-center px-3 text-xs font-medium text-gray-700">
                          <span className="bg-white px-2 py-0.5 rounded">
                            Fatura: {formatCurrency(month.invoices)} | Ödeme: {formatCurrency(month.payments)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>⚡ Hızlı İşlemler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => router.push('/invoices')}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <span className="text-3xl">📄</span>
                <span className="text-sm font-semibold text-blue-900">Yeni Fatura</span>
              </button>

              <button
                onClick={() => router.push('/projects')}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-green-200 bg-green-50 hover:bg-green-100 transition-colors"
              >
                <span className="text-3xl">📁</span>
                <span className="text-sm font-semibold text-green-900">Yeni Proje</span>
              </button>

              <button
                onClick={() => router.push('/informal-payments')}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <span className="text-3xl">💵</span>
                <span className="text-sm font-semibold text-red-900">Yeni Ödeme</span>
              </button>

              <button
                onClick={() => router.push('/subcontractors')}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                <span className="text-3xl">🏢</span>
                <span className="text-sm font-semibold text-purple-900">Tedarikçiler</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Sidebar>
  );
}
