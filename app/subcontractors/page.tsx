'use client';

import { useState, useEffect } from 'react';
import { Supplier } from '@/types';
import { Sidebar } from '@/components/layout/Sidebar';
import { createClient } from '@/lib/supabase/client';
import {
  getPendingSuppliers,
  getSubcontractorSuppliers,
  getInvoiceCompanySuppliers,
  getSupplierStats,
  assignToSubcontractor,
  assignToInvoiceCompany,
  unassignSupplier,
  createSubcontractor,
  createInvoiceCompany,
  deleteSupplier,
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
  
  // Inline editing state
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{ name: string; vkn: string; phone?: string; email?: string; }>({ name: '', vkn: '', phone: '', email: '' });
  
  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'subcontractor' | 'invoice_company'>('subcontractor');
  const [formData, setFormData] = useState({ name: '', vkn: '' });

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

  // Silme işlemi
  const handleDelete = async (supplierId: string, supplierName: string) => {
    if (!user?.company_id) return;
    
    const confirmed = confirm(
      `"${supplierName}" firmasını silmek istediğinizden emin misiniz?\n\n` +
      `⚠️ DİKKAT: Bu firma faturalarda kullanılmışsa silinemez.\n` +
      `Eğer kullanılmışsa sadece deaktif edilir.`
    );
    
    if (!confirmed) return;
    
    try {
      setLoading(true);
      await deleteSupplier(supplierId, user.company_id);
      alert('✅ Firma başarıyla silindi!');
      loadData();
    } catch (error: any) {
      console.error('Error deleting supplier:', error);
      if (error.message?.includes('faturalarda kullanılmış')) {
        alert('⚠️ ' + error.message);
      } else {
        alert('❌ Silinirken hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Toplu silme işlemi
  const handleBulkDelete = async () => {
    if (!user?.company_id || selectedSuppliers.length === 0) return;
    
    const confirmed = confirm(
      `${selectedSuppliers.length} firmayı silmek istediğinizden emin misiniz?\n\n` +
      `⚠️ DİKKAT: Faturalarda kullanılan firmalar silinemez ve deaktif edilir.`
    );
    
    if (!confirmed) return;
    
    try {
      setLoading(true);
      let successCount = 0;
      let errorCount = 0;
      
      for (const supplierId of selectedSuppliers) {
        try {
          await deleteSupplier(supplierId, user.company_id);
          successCount++;
        } catch (error) {
          console.error(`Error deleting supplier ${supplierId}:`, error);
          errorCount++;
        }
      }
      
      if (errorCount === 0) {
        alert(`✅ ${successCount} firma başarıyla silindi!`);
      } else {
        alert(`⚠️ ${successCount} firma silindi, ${errorCount} firma silinemedi (faturalarda kullanılıyor olabilir)`);
      }
      
      setSelectedSuppliers([]);
      loadData();
    } catch (error: any) {
      console.error('Error bulk deleting:', error);
      alert('❌ Toplu silme sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Inline editing başlat
  const startEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier.id);
    setEditFormData({
      name: supplier.name,
      vkn: supplier.vkn || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
    });
  };

  // Inline editing iptal
  const cancelEdit = () => {
    setEditingSupplier(null);
    setEditFormData({ name: '', vkn: '', phone: '', email: '' });
  };

  // Inline editing kaydet
  const saveEdit = async (supplierId: string) => {
    if (!user?.company_id) return;
    
    if (!editFormData.name.trim()) {
      alert('Firma adı zorunludur!');
      return;
    }

    if (editFormData.vkn.trim() && !/^\d{10,11}$/.test(editFormData.vkn.trim())) {
      alert('⚠️ VKN 10 veya 11 haneli rakam olmalıdır!');
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await (supabase
        .from('suppliers') as any)
        .update({
          name: editFormData.name.trim(),
          vkn: editFormData.vkn.trim() || null,
          phone: editFormData.phone?.trim() || null,
          email: editFormData.email?.trim() || null,
        })
        .eq('id', supplierId)
        .eq('company_id', user.company_id);

      if (error) throw error;

      alert('✅ Firma bilgileri güncellendi!');
      setEditingSupplier(null);
      loadData();
    } catch (error: any) {
      console.error('Error updating supplier:', error);
      if (error.code === '23505') {
        alert('⚠️ Bu VKN zaten kayıtlı!');
      } else {
        alert('❌ Güncellenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
      }
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

  // Manuel ekleme
  const handleOpenAddModal = (type: 'subcontractor' | 'invoice_company') => {
    setModalType(type);
    setFormData({ name: '', vkn: '' });
    setIsAddModalOpen(true);
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company_id || !formData.name.trim()) {
      alert('Firma adı zorunludur!');
      return;
    }

    // VKN format kontrolü (frontend)
    if (formData.vkn.trim() && !/^\d{10,11}$/.test(formData.vkn.trim())) {
      alert('⚠️ VKN 10 veya 11 haneli rakam olmalıdır!');
      return;
    }

    try {
      setLoading(true);
      
      if (modalType === 'subcontractor') {
        await createSubcontractor(
          user.company_id, 
          formData.name.trim(), 
          formData.vkn.trim() || undefined
        );
        alert('✅ Taşeron başarıyla eklendi!');
      } else {
        await createInvoiceCompany(
          user.company_id, 
          formData.name.trim(), 
          formData.vkn.trim() || undefined
        );
        alert('✅ Fatura firması başarıyla eklendi!');
      }
      
      setIsAddModalOpen(false);
      setFormData({ name: '', vkn: '' });
      await loadData(); // Await ekledik
    } catch (error: any) {
      console.error('Error adding:', error);
      
      // Detaylı hata mesajları
      if (error.code === '23505' || error.message?.includes('duplicate')) {
        alert('⚠️ Bu VKN zaten kayıtlı!');
      } else if (error.code === '23502') {
        alert('⚠️ Zorunlu alanlar eksik!');
      } else if (error.code === 'PGRST204') {
        alert('⚠️ Veritabanı şeması hatası! Lütfen migration\'ı çalıştırın.');
      } else if (error.message?.includes('VKN')) {
        alert('⚠️ ' + error.message);
      } else {
        alert('❌ Eklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
      }
    } finally {
      setLoading(false);
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
      <div className="space-y-4">
        {/* Toplu işlem butonları */}
        {selectedSuppliers.length > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 border border-amber-200">
            <span className="text-sm font-medium text-amber-800">
              {selectedSuppliers.length} firma seçildi
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  alert('Toplu atama özelliği yakında eklenecek');
                }}
                className="btn-sm btn-primary"
              >
                Toplu Ata
              </button>
              <button
                onClick={handleBulkDelete}
                className="btn-sm btn-danger"
              >
                Seçilenleri Sil
              </button>
            </div>
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
                      checked={selectedSuppliers.length === pendingSuppliers.length && pendingSuppliers.length > 0}
                      onChange={() => {
                        if (selectedSuppliers.length === pendingSuppliers.length) {
                          setSelectedSuppliers([]);
                        } else {
                          setSelectedSuppliers(pendingSuppliers.map(s => s.id));
                        }
                      }}
                      className="rounded border-secondary-300"
                    />
                  </th>
                  <th className="table-header">Firma Adı</th>
                  <th className="table-header">VKN</th>
                  <th className="table-header">İletişim</th>
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
                    <td className="table-cell font-medium">
                      {editingSupplier === supplier.id ? (
                        <input
                          type="text"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          className="w-full rounded border border-secondary-300 px-2 py-1 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                          placeholder="Firma adı"
                        />
                      ) : (
                        supplier.name
                      )}
                    </td>
                    <td className="table-cell text-secondary-600">
                      {editingSupplier === supplier.id ? (
                        <input
                          type="text"
                          value={editFormData.vkn}
                          onChange={(e) => setEditFormData({ ...editFormData, vkn: e.target.value })}
                          className="w-full rounded border border-secondary-300 px-2 py-1 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                          placeholder="VKN (10-11 hane)"
                          maxLength={11}
                        />
                      ) : (
                        supplier.vkn
                      )}
                    </td>
                    <td className="table-cell text-secondary-600">
                      {editingSupplier === supplier.id ? (
                        <div className="space-y-1">
                          <input
                            type="tel"
                            value={editFormData.phone}
                            onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                            className="w-full rounded border border-secondary-300 px-2 py-1 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                            placeholder="Telefon"
                          />
                          <input
                            type="email"
                            value={editFormData.email}
                            onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                            className="w-full rounded border border-secondary-300 px-2 py-1 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                            placeholder="E-posta"
                          />
                        </div>
                      ) : (
                        <>
                          {supplier.phone && <div>{supplier.phone}</div>}
                          {supplier.email && <div className="text-xs">{supplier.email}</div>}
                        </>
                      )}
                    </td>
                    <td className="table-cell text-secondary-600">
                      {new Date(supplier.created_at).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex justify-end gap-2">
                        {editingSupplier === supplier.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(supplier.id)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                              title="Kaydet"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Kaydet
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="inline-flex items-center gap-1.5 rounded-md bg-secondary-200 px-3 py-1.5 text-sm font-medium text-secondary-700 transition-all hover:bg-secondary-300 focus:outline-none focus:ring-2 focus:ring-secondary-500"
                              title="İptal"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              İptal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(supplier)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 transition-all hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              title="Düzenle"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Düzenle
                            </button>
                            <button
                              onClick={() => handleAssign(supplier.id, 'subcontractor')}
                              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              title="Taşeron olarak ata"
                            >
                              <UserGroupIcon className="h-4 w-4" />
                              Taşeron
                            </button>
                            <button
                              onClick={() => handleAssign(supplier.id, 'invoice_company')}
                              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-green-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-500"
                              title="Fatura firması olarak ata"
                            >
                              <DocumentIcon className="h-4 w-4" />
                              Fatura Firması
                            </button>
                            <button
                              onClick={() => handleDelete(supplier.id, supplier.name)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 transition-all hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                              title="Firmayı sil"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Sil
                            </button>
                          </>
                        )}
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
      <div className="space-y-4">
        {selectedSuppliers.length > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 border border-amber-200">
            <span className="text-sm font-medium text-amber-800">
              {selectedSuppliers.length} firma seçildi
            </span>
            <button
              onClick={handleBulkDelete}
              className="btn-sm btn-danger"
            >
              Seçilenleri Sil
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
                      checked={selectedSuppliers.length === subcontractorSuppliers.length}
                      onChange={() => {
                        if (selectedSuppliers.length === subcontractorSuppliers.length) {
                          setSelectedSuppliers([]);
                        } else {
                          setSelectedSuppliers(subcontractorSuppliers.map(s => s.id));
                        }
                      }}
                      className="rounded border-secondary-300"
                    />
                  </th>
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
                    <td className="table-cell">
                      <input
                        type="checkbox"
                        checked={selectedSuppliers.includes(supplier.id)}
                        onChange={() => handleCheckboxChange(supplier.id)}
                        className="rounded border-secondary-300"
                      />
                    </td>
                    <td className="table-cell font-medium">
                      {editingSupplier === supplier.id ? (
                        <input
                          type="text"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          className="w-full rounded border border-secondary-300 px-2 py-1 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                          placeholder="Firma adı"
                        />
                      ) : (
                        supplier.name
                      )}
                    </td>
                    <td className="table-cell text-secondary-600">
                      {editingSupplier === supplier.id ? (
                        <input
                          type="text"
                          value={editFormData.vkn}
                          onChange={(e) => setEditFormData({ ...editFormData, vkn: e.target.value })}
                          className="w-full rounded border border-secondary-300 px-2 py-1 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                          placeholder="VKN (10-11 hane)"
                          maxLength={11}
                        />
                      ) : (
                        supplier.vkn
                      )}
                    </td>
                    <td className="table-cell text-secondary-600">
                      {editingSupplier === supplier.id ? (
                        <div className="space-y-1">
                          <input
                            type="tel"
                            value={editFormData.phone}
                            onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                            className="w-full rounded border border-secondary-300 px-2 py-1 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                            placeholder="Telefon"
                          />
                          <input
                            type="email"
                            value={editFormData.email}
                            onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                            className="w-full rounded border border-secondary-300 px-2 py-1 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                            placeholder="E-posta"
                          />
                        </div>
                      ) : (
                        <>
                          {supplier.phone && <div>{supplier.phone}</div>}
                          {supplier.email && <div className="text-xs">{supplier.email}</div>}
                        </>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${supplier.is_active ? 'badge-success' : 'badge-secondary'}`}>
                        {supplier.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex justify-end gap-2">
                        {editingSupplier === supplier.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(supplier.id)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                              title="Kaydet"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Kaydet
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="inline-flex items-center gap-1.5 rounded-md bg-secondary-200 px-3 py-1.5 text-sm font-medium text-secondary-700 transition-all hover:bg-secondary-300 focus:outline-none focus:ring-2 focus:ring-secondary-500"
                              title="İptal"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              İptal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(supplier)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 transition-all hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              title="Düzenle"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Düzenle
                            </button>
                            <button
                              onClick={() => handleUnassign(supplier.id)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700 transition-all hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                              title="Atamayı kaldır (pending'e geri döner)"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                              Kaldır
                            </button>
                            <button
                              onClick={() => handleDelete(supplier.id, supplier.name)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 transition-all hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                              title="Firmayı sil"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Sil
                            </button>
                          </>
                        )}
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
      <div className="space-y-4">
        {selectedSuppliers.length > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 border border-amber-200">
            <span className="text-sm font-medium text-amber-800">
              {selectedSuppliers.length} firma seçildi
            </span>
            <button
              onClick={handleBulkDelete}
              className="btn-sm btn-danger"
            >
              Seçilenleri Sil
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
                      checked={selectedSuppliers.length === invoiceCompanySuppliers.length}
                      onChange={() => {
                        if (selectedSuppliers.length === invoiceCompanySuppliers.length) {
                          setSelectedSuppliers([]);
                        } else {
                          setSelectedSuppliers(invoiceCompanySuppliers.map(s => s.id));
                        }
                      }}
                      className="rounded border-secondary-300"
                    />
                  </th>
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
                    <td className="table-cell">
                      <input
                        type="checkbox"
                        checked={selectedSuppliers.includes(supplier.id)}
                        onChange={() => handleCheckboxChange(supplier.id)}
                        className="rounded border-secondary-300"
                      />
                    </td>
                    <td className="table-cell font-medium">
                      {editingSupplier === supplier.id ? (
                        <input
                          type="text"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          className="w-full rounded border border-secondary-300 px-2 py-1 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                          placeholder="Firma adı"
                        />
                      ) : (
                        supplier.name
                      )}
                    </td>
                    <td className="table-cell text-secondary-600">
                      {editingSupplier === supplier.id ? (
                        <input
                          type="text"
                          value={editFormData.vkn}
                          onChange={(e) => setEditFormData({ ...editFormData, vkn: e.target.value })}
                          className="w-full rounded border border-secondary-300 px-2 py-1 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                          placeholder="VKN (10-11 hane)"
                          maxLength={11}
                        />
                      ) : (
                        supplier.vkn
                      )}
                    </td>
                    <td className="table-cell text-secondary-600">{supplier.tax_office || '-'}</td>
                    <td className="table-cell">
                      <span className={`badge ${supplier.is_active ? 'badge-success' : 'badge-secondary'}`}>
                        {supplier.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex justify-end gap-2">
                        {editingSupplier === supplier.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(supplier.id)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                              title="Kaydet"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Kaydet
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="inline-flex items-center gap-1.5 rounded-md bg-secondary-200 px-3 py-1.5 text-sm font-medium text-secondary-700 transition-all hover:bg-secondary-300 focus:outline-none focus:ring-2 focus:ring-secondary-500"
                              title="İptal"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              İptal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(supplier)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 transition-all hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              title="Düzenle"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Düzenle
                            </button>
                            <button
                              onClick={() => handleUnassign(supplier.id)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700 transition-all hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                              title="Atamayı kaldır (pending'e geri döner)"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                              Kaldır
                            </button>
                            <button
                              onClick={() => handleDelete(supplier.id, supplier.name)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 transition-all hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                              title="Firmayı sil"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Sil
                            </button>
                          </>
                        )}
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
        <div className="mb-6 flex items-center justify-between border-b border-secondary-200">
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

          {/* + Ekle Butonları */}
          <div className="flex gap-2">
            {activeTab === 'subcontractors' && (
              <button
                onClick={() => handleOpenAddModal('subcontractor')}
                className="btn-sm btn-primary flex items-center gap-1"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Taşeron Ekle
              </button>
            )}
            {activeTab === 'invoice_companies' && (
              <button
                onClick={() => handleOpenAddModal('invoice_company')}
                className="btn-sm btn-primary flex items-center gap-1"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Firma Ekle
              </button>
            )}
          </div>
        </div>

        {/* Tab İçeriği */}
        {renderTabContent()}

        {/* Manuel Ekleme Modalı */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-lg font-semibold text-secondary-900">
                {modalType === 'subcontractor' ? '🔧 Yeni Taşeron Ekle' : '📄 Yeni Fatura Firması Ekle'}
              </h2>
              <form onSubmit={handleManualAdd} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Firma Adı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-md border border-secondary-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Örn: ABC İnşaat Ltd. Şti."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    VKN (Opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={formData.vkn}
                    onChange={(e) => setFormData({ ...formData, vkn: e.target.value })}
                    className="w-full rounded-md border border-secondary-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="10 haneli VKN"
                    maxLength={11}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setFormData({ name: '', vkn: '' });
                    }}
                    className="flex-1 btn-secondary"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Ekleniyor...' : 'Ekle'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}