'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  getActivityLogs,
  getActivityStats,
  ActivityLog,
  ActionType,
  ResourceType,
  getActivityIcon,
  getActivityColor,
  formatActivityTime,
  formatChangesForDisplay,
} from '@/lib/supabase/activity-logger';
import * as XLSX from 'xlsx';

export default function ActivityLogsPage() {
  const { user, role, company, hasPermission, isLoading: authLoading } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<{ byAction: Record<string, number>; byResource: Record<string, number>; total: number }>({
    byAction: {},
    byResource: {},
    total: 0,
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionType | 'all'>('all');
  const [resourceFilter, setResourceFilter] = useState<ResourceType | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | 'all'>('all');

  const itemsPerPage = 50;
  const isSuperAdmin = role?.name === 'Super Admin' && role?.company_id === null;
  const isCompanyAdmin = hasPermission('activity_logs', 'read') || hasPermission('activity_logs', 'manage');
  const canViewLogs = isSuperAdmin || isCompanyAdmin || !!user; // Herkes kendi loglarını görebilir

  useEffect(() => {
    if (!authLoading && user) {
      fetchActivityLogs();
      fetchStats();
    }
  }, [authLoading, canViewLogs, page, searchTerm, actionFilter, resourceFilter, startDate, endDate, selectedUserId]);

  async function fetchActivityLogs() {
    try {
      setIsLoading(true);

      const filters: any = {
        limit: itemsPerPage,
        offset: (page - 1) * itemsPerPage,
      };

      // Apply filters
      if (searchTerm) filters.search = searchTerm;
      if (actionFilter !== 'all') filters.actionType = actionFilter;
      if (resourceFilter !== 'all') filters.resourceType = resourceFilter;
      if (startDate) filters.startDate = new Date(startDate).toISOString();
      if (endDate) filters.endDate = new Date(endDate).toISOString();

      // For company admin, filter by company
      if (isCompanyAdmin && !isSuperAdmin && company) {
        filters.companyId = company.id;
      }

      // For regular users, filter by user
      if (!isSuperAdmin && !isCompanyAdmin && user) {
        filters.userId = user.id;
      }

      // If super admin or company admin selected a specific user
      if ((isSuperAdmin || isCompanyAdmin) && selectedUserId !== 'all') {
        filters.userId = selectedUserId;
      }

      const { logs: fetchedLogs, total: fetchedTotal } = await getActivityLogs(filters);

      setLogs(fetchedLogs);
      setTotal(fetchedTotal);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const filters: any = {};

      if (startDate) filters.startDate = new Date(startDate).toISOString();
      if (endDate) filters.endDate = new Date(endDate).toISOString();

      // For company admin, filter by company
      if (isCompanyAdmin && !isSuperAdmin && company) {
        filters.companyId = company.id;
      }

      const fetchedStats = await getActivityStats(
        filters.companyId,
        filters.startDate,
        filters.endDate
      );

      setStats(fetchedStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }

  function handleExportExcel() {
    if (logs.length === 0) {
      alert('Dışa aktarılacak log bulunamadı.');
      return;
    }

    const exportData = logs.map((log) => ({
      'Tarih': new Date(log.created_at).toLocaleString('tr-TR'),
      'Kullanıcı': log.user?.name || 'Bilinmiyor',
      'E-posta': log.user?.email || '',
      'İşlem': log.action_type,
      'Kaynak': log.resource_type,
      'Açıklama': log.description,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Aktivite Logları');

    const fileName = `aktivite_loglari_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  function resetFilters() {
    setSearchTerm('');
    setActionFilter('all');
    setResourceFilter('all');
    setStartDate('');
    setEndDate('');
    setSelectedUserId('all');
    setPage(1);
  }

  if (authLoading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center py-12">
          <div className="text-secondary-600">Yükleniyor...</div>
        </div>
      </Sidebar>
    );
  }

  if (!canViewLogs) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-secondary-900 mb-2">Erişim Reddedildi</h2>
            <p className="text-secondary-600">Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
          </div>
        </div>
      </Sidebar>
    );
  }

  const totalPages = Math.ceil(total / itemsPerPage);
  const hasActiveFilters = searchTerm || actionFilter !== 'all' || resourceFilter !== 'all' || startDate || endDate || selectedUserId !== 'all';

  return (
    <Sidebar>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">Aktivite Logları</h1>
            <p className="text-sm text-secondary-600 mt-1">
              {isSuperAdmin
                ? 'Tüm sistem aktivitelerini görüntülüyorsunuz'
                : isCompanyAdmin
                ? 'Şirketiniz çapında tüm aktiviteleri görüntülüyorsunuz'
                : 'Kendi aktivitelerinizi görüntülüyorsunuz'}
            </p>
          </div>
          <Button onClick={handleExportExcel} variant="outline">
            📥 Excel İndir
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600">{stats.total}</div>
                <div className="text-sm text-secondary-600 mt-1">Toplam Aktivite</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats.byAction.create || 0}</div>
                <div className="text-sm text-secondary-600 mt-1">Oluşturma</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.byAction.update || 0}</div>
                <div className="text-sm text-secondary-600 mt-1">Güncelleme</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Filtreler</CardTitle>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Filtreleri Temizle
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Ara
                </label>
                <Input
                  type="text"
                  placeholder="Açıklama ara..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              {/* Action Filter */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  İşlem Türü
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value as ActionType | 'all');
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">Tümü</option>
                  <option value="create">Oluşturma</option>
                  <option value="update">Güncelleme</option>
                  <option value="delete">Silme</option>
                  <option value="assign">Atama</option>
                  <option value="unassign">Atama Kaldırma</option>
                  <option value="upload">Yükleme</option>
                  <option value="download">İndirme</option>
                  <option value="login">Giriş</option>
                  <option value="logout">Çıkış</option>
                </select>
              </div>

              {/* Resource Filter */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Kaynak Türü
                </label>
                <select
                  value={resourceFilter}
                  onChange={(e) => {
                    setResourceFilter(e.target.value as ResourceType | 'all');
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">Tümü</option>
                  <option value="project">Proje</option>
                  <option value="invoice">Fatura</option>
                  <option value="user">Kullanıcı</option>
                  <option value="payment">Ödeme</option>
                  <option value="subcontractor">Taşeron Firma</option>
                  <option value="informal_payment">Gayri Resmi Ödeme</option>
                  <option value="file">Dosya</option>
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Başlangıç
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Bitiş
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Aktivite Geçmişi
                <span className="ml-2 text-sm font-normal text-secondary-600">
                  ({total} kayıt)
                </span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-secondary-600">Yükleniyor...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-secondary-400 text-5xl mb-4">📋</div>
                <p className="text-secondary-600">
                  {hasActiveFilters ? 'Filtreye uygun log bulunamadı' : 'Henüz aktivite kaydı bulunmuyor'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => {
                  const changeDetails = formatChangesForDisplay(log.changes);
                  const hasChanges = changeDetails.length > 0;
                  
                  return (
                  <div
                    key={log.id}
                    className="border border-secondary-200 rounded-lg p-5 hover:shadow-md transition-all bg-white"
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl ${getActivityColor(log.action_type)}`}>
                        {getActivityIcon(log.action_type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            {/* Ana Açıklama - Büyük ve Bold */}
                            <p className="text-base font-semibold text-secondary-900 mb-2">
                              {log.description}
                            </p>
                            
                            {/* Kullanıcı Bilgisi - Daha Okunabilir */}
                            <div className="flex items-center gap-2 text-sm text-secondary-600">
                              <span className="font-medium">{log.user?.name || 'Bilinmiyor'}</span>
                              <span className="text-secondary-400">tarafından yapıldı</span>
                            </div>
                          </div>
                          
                          {/* Zaman Bilgisi - Sağ Üstte */}
                          <div className="flex-shrink-0 text-right">
                            <div className="text-sm font-medium text-secondary-700">
                              {formatActivityTime(log.created_at)}
                            </div>
                            <div className="text-xs text-secondary-500 mt-1">
                              {new Date(log.created_at).toLocaleString('tr-TR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Değişiklik Detayları */}
                        {hasChanges && (
                          <div className="mt-4 pt-4 border-t border-secondary-100">
                            <div className="text-xs font-medium text-secondary-500 mb-3">
                              📋 Değişiklik Detayları
                            </div>
                            <div className="space-y-2">
                              {changeDetails.map((change, idx) => (
                                <div key={idx} className="flex items-start gap-3 text-sm">
                                  <div className="flex-shrink-0 w-32 font-medium text-secondary-700">
                                    {change.field}:
                                  </div>
                                  <div className="flex-1">
                                    {change.isAdded ? (
                                      // Yeni eklenen değer
                                      <span className="text-green-700 font-medium">
                                        {change.newValue}
                                      </span>
                                    ) : change.isRemoved ? (
                                      // Silinen değer
                                      <span className="text-red-700 line-through">
                                        {change.oldValue}
                                      </span>
                                    ) : (
                                      // Güncellenen değer
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-red-600 line-through">
                                          {change.oldValue}
                                        </span>
                                        <span className="text-secondary-400">→</span>
                                        <span className="text-green-700 font-medium">
                                          {change.newValue}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-secondary-200">
                <div className="text-sm text-secondary-600">
                  Sayfa {page} / {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Önceki
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Sonraki
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Sidebar>
  );
}
