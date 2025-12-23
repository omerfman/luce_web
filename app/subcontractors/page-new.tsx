'use client';

import { useState, useEffect } from 'react';
import { Supplier } from '@/types';
import { Sidebar } from '@/components/layout/Sidebar';
import {
  getPendingSuppliers,
  getSubcontractorSuppliers,
  getInvoiceCompanySuppliers,
  getSupplierStats,
  assignToSubcontractor,
  assignToInvoiceCompany,
  unassignSupplier,
  type SupplierStats
} from '@/lib/supabase/supplier-management';
import { useAuth } from '@/lib/auth/AuthContext';

// Tab türleri
type TabType = 'pending' | 'subcontractors' | 'invoice_companies';

// İkonlar
function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UserGroupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export default function SubcontractorsPage() {
  const { user } = useAuth();
  
  // State
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [pendingSuppliers, setPendingSuppliers] = useState<Supplier[]>([]);
  const [subcontractorSuppliers, setSubcontractorSuppliers] = useState<Supplier[]>([]);
  const [invoiceCompanySuppliers, setInvoiceCompanySuppliers] = useState<Supplier[]>([]);
  const [stats, setStats] = useState<SupplierStats>({ pending: 0, subcontractor: 0, invoice_company: 0, total: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);

  // İlk yükleme
  useEffect(() => {
    if (user?.company_id) {
      loadData();
    }
  }, [user?.company_id]);

  // Data yükleme
  const loadData = async () => {
    if (!user?.company_id) return;
    
    try {
      setLoading(true);
      const [pending, subcontractors, invoiceCompanies, statistics] = await Promise.all([
        getPendingSuppliers(user.company_id),
        getSubcontractorSuppliers(user.company_id),
        getInvoiceCompanySuppliers(user.company_id),
        getSupplierStats(user.company_id)
      ]);
      
      setPendingSuppliers(pending);
      setSubcontractorSuppliers(subcontractors);
      setInvoiceCompanySuppliers(invoiceCompanies);
      setStats(statistics);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Atama işlemleri
  const handleAssign = async (supplierId: string, type: 'subcontractor' | 'invoice_company') => {
    if (!user?.company_id) return;
    
    try {
      if (type === 'subcontractor') {
        await assignToSubcontractor({ supplierId, companyId: user.company_id });
        alert('Taşeron olarak atandı');
      } else {
        await assignToInvoiceCompany(supplierId, user.company_id);
        alert('Fatura firması olarak atandı');
      }
      loadData();
      setSelectedSuppliers([]);
    } catch (error) {
      console.error('Error assigning supplier:', error);
      alert('Atama sırasında hata oluştu');
    }
  };

  // Atamayı geri al
  const handleUnassign = async (supplierId: string) => {
    if (!user?.company_id) return;
    if (!confirm('Bu atamayı geri almak istediğinizden emin misiniz?')) return;
    
    try {
      await unassignSupplier(supplierId, user.company_id);
      alert('Atama geri alındı');
      loadData();
    } catch (error) {
      console.error('Error unassigning supplier:', error);
      alert('İşlem sırasında hata oluştu');
    }
  };

  // Checkbox işlemleri
  const handleCheckboxChange = (supplierId: string) => {
    setSelectedSuppliers(prev => 
      prev.includes(supplierId) 
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  const handleSelectAll = () => {
    if (activeTab === 'pending') {
      setSelectedSuppliers(
        selectedSuppliers.length === pendingSuppliers.length 
          ? [] 
          : pendingSuppliers.map(s => s.id)
      );
    }
  };

  // Tab içeriği render
  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
        </div>
      );
    }

    switch (activeTab) {
      case 'pending':
        return renderPendingTab();
      case 'subcontractors':
        return renderSubcontractorsTab();
      case 'invoice_companies':
        return renderInvoiceCompaniesTab();
    }
  };

  // Atama Bekleyenler Tab
  const renderPendingTab = () => {
    if (pendingSuppliers.length === 0) {
      return (
        <div className="card py-12 text-center">
          <ClockIcon className="mx-auto h-12 w-12 text-secondary-400" />
          <h3 className="mt-2 text-sm font-medium text-secondary-900">Atama bekleyen firma yok</h3>
          <p className="mt-1 text-sm text-secondary-500">
            Yeni fatura eklendiğinde firmalar otomatik olarak burada listelenecek.
          </p>
        </div>
      );
    }

    return (
      <div>
        {/* Toplu işlem butonları */}
        {selectedSuppliers.length > 0 && (
          <div className="mb-4 flex gap-2 rounded-lg bg-blue-50 p-4">
            <span className="text-sm text-secondary-700">
              {selectedSuppliers.length} firma seçildi
            </span>
            <button
              onClick={() => {
                // Toplu atama modalını aç
                alert('Toplu atama özelliği yakında eklenecek');
              }}
              className="ml-auto btn-sm btn-primary"
            >
              Toplu Ata
            </button>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-secondary-200">
              <thead className="bg-secondary-50">
                <tr>
                  <th className="table-header w-12">
                    <input
                      type="checkbox"
                      checked={selectedSuppliers.length === pendingSuppliers.length}
                      onChange={handleSelectAll}
                      className="rounded border-secondary-300"
                    />
                  </th>
                  <th className="table-header">Firma Adı</th>
                  <th className="table-header">VKN</th>
                  <th className="table-header">Eklenme Tarihi</th>
                  <th className="table-header text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200 bg-white">
                {pendingSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-secondary-50">
                    <td className="table-cell">
                      <input
                        type="checkbox"
                        checked={selectedSuppliers.includes(supplier.id)}
                        onChange={() => handleCheckboxChange(supplier.id)}
                        className="rounded border-secondary-300"
                      />
                    </td>
                    <td className="table-cell font-medium">{supplier.name}</td>
                    <td className="table-cell text-secondary-600">{supplier.vkn}</td>
                    <td className="table-cell text-secondary-600">
                      {new Date(supplier.created_at).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleAssign(supplier.id, 'subcontractor')}
                          className="btn-sm bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Taşeron
                        </button>
                        <button
                          onClick={() => handleAssign(supplier.id, 'invoice_company')}
                          className="btn-sm bg-green-600 text-white hover:bg-green-700"
                        >
                          Fatura Firması
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Taşeron Listesi Tab
  const renderSubcontractorsTab = () => {
    if (subcontractorSuppliers.length === 0) {
      return (
        <div className="card py-12 text-center">
          <UserGroupIcon className="mx-auto h-12 w-12 text-secondary-400" />
          <h3 className="mt-2 text-sm font-medium text-secondary-900">Taşeron bulunamadı</h3>
          <p className="mt-1 text-sm text-secondary-500">
            Henüz taşeron olarak atanmış firma yok.
          </p>
        </div>
      );
    }

    return (
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-secondary-200">
            <thead className="bg-secondary-50">
              <tr>
                <th className="table-header">Taşeron Adı</th>
                <th className="table-header">VKN</th>
                <th className="table-header">İletişim</th>
                <th className="table-header">Durum</th>
                <th className="table-header text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-200 bg-white">
              {subcontractorSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-secondary-50">
                  <td className="table-cell font-medium">{supplier.name}</td>
                  <td className="table-cell text-secondary-600">{supplier.vkn}</td>
                  <td className="table-cell text-secondary-600">
                    {supplier.phone && <div>{supplier.phone}</div>}
                    {supplier.email && <div className="text-xs">{supplier.email}</div>}
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${supplier.is_active ? 'badge-success' : 'badge-secondary'}`}>
                      {supplier.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <button
                      onClick={() => handleUnassign(supplier.id)}
                      className="btn-sm btn-outline-danger"
                    >
                      Atamayı Kaldır
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Fatura Firmaları Tab
  const renderInvoiceCompaniesTab = () => {
    if (invoiceCompanySuppliers.length === 0) {
      return (
        <div className="card py-12 text-center">
          <DocumentIcon className="mx-auto h-12 w-12 text-secondary-400" />
          <h3 className="mt-2 text-sm font-medium text-secondary-900">Fatura firması bulunamadı</h3>
          <p className="mt-1 text-sm text-secondary-500">
            Henüz fatura firması olarak atanmış firma yok.
          </p>
        </div>
      );
    }

    return (
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-secondary-200">
            <thead className="bg-secondary-50">
              <tr>
                <th className="table-header">Firma Adı</th>
                <th className="table-header">VKN</th>
                <th className="table-header">Vergi Dairesi</th>
                <th className="table-header">Durum</th>
                <th className="table-header text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-200 bg-white">
              {invoiceCompanySuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-secondary-50">
                  <td className="table-cell font-medium">{supplier.name}</td>
                  <td className="table-cell text-secondary-600">{supplier.vkn}</td>
                  <td className="table-cell text-secondary-600">{supplier.tax_office || '-'}</td>
                  <td className="table-cell">
                    <span className={`badge ${supplier.is_active ? 'badge-success' : 'badge-secondary'}`}>
                      {supplier.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <button
                      onClick={() => handleUnassign(supplier.id)}
                      className="btn-sm btn-outline-danger"
                    >
                      Atamayı Kaldır
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <Sidebar>
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold text-secondary-900">Taşeron ve Firma Yönetimi</h1>

        {/* İstatistik Kartları */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-100 p-3">
                <ClockIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Atama Bekleyenler</p>
                <p className="text-2xl font-bold text-secondary-900">{stats.pending}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-3">
                <UserGroupIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Taşeronlar</p>
                <p className="text-2xl font-bold text-secondary-900">{stats.subcontractor}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-3">
                <DocumentIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Fatura Firmaları</p>
                <p className="text-2xl font-bold text-secondary-900">{stats.invoice_company}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 p-3">
                <BuildingIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Toplam Firma</p>
                <p className="text-2xl font-bold text-secondary-900">{stats.total}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigasyonu */}
        <div className="mb-6 border-b border-secondary-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('pending')}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium
                ${activeTab === 'pending'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-secondary-500 hover:border-secondary-300 hover:text-secondary-700'
                }
              `}
            >
              <span className="flex items-center gap-2">
                <ClockIcon className="h-5 w-5" />
                Atama Bekleyenler
                {stats.pending > 0 && (
                  <span className="badge bg-yellow-100 text-yellow-800">{stats.pending}</span>
                )}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('subcontractors')}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium
                ${activeTab === 'subcontractors'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-secondary-500 hover:border-secondary-300 hover:text-secondary-700'
                }
              `}
            >
              <span className="flex items-center gap-2">
                <UserGroupIcon className="h-5 w-5" />
                Taşeron Listesi
                {stats.subcontractor > 0 && (
                  <span className="badge bg-blue-100 text-blue-800">{stats.subcontractor}</span>
                )}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('invoice_companies')}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium
                ${activeTab === 'invoice_companies'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-secondary-500 hover:border-secondary-300 hover:text-secondary-700'
                }
              `}
            >
              <span className="flex items-center gap-2">
                <DocumentIcon className="h-5 w-5" />
                Fatura Firmaları
                {stats.invoice_company > 0 && (
                  <span className="badge bg-green-100 text-green-800">{stats.invoice_company}</span>
                )}
              </span>
            </button>
          </nav>
        </div>

        {/* Tab İçeriği */}
        {renderTabContent()}
      </div>
    </Sidebar>
  );
}
