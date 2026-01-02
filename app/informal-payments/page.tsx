'use client';

import { useState, useEffect } from 'react';
import { InformalPayment, Project, Supplier } from '@/types';
import { Sidebar } from '@/components/layout/Sidebar';
import { ContractPaymentModal } from '@/components/informal-payments/ContractPaymentModal';
import {
  getInformalPayments,
  createInformalPayment,
  updateInformalPayment,
  deleteInformalPayment,
} from '@/lib/supabase/informal-payments';
import { getSubcontractorSuppliers, createSubcontractor } from '@/lib/supabase/supplier-management';
import { useAuth } from '@/lib/auth/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';

export default function InformalPaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<InformalPayment[]>([]);
  const [subcontractors, setSubcontractors] = useState<Supplier[]>([]); // Supplier tipine çevrildi
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<InformalPayment | null>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    supplierId: '',
    projectId: '',
    startDate: '',
    endDate: '',
    paymentMethod: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user?.company_id) return;
    
    try {
      setLoading(true);
      const [paymentsData, subcontractorSuppliersData, projectsData] = await Promise.all([
        getInformalPayments(),
        getSubcontractorSuppliers(user.company_id), // Yeni sistem kullanılıyor
        loadProjects(),
      ]);
      setPayments(paymentsData);
      setSubcontractors(subcontractorSuppliersData);
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async (): Promise<Project[]> => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading projects:', error);
      return [];
    }
  };

  const handleFilter = async () => {
    try {
      setLoading(true);
      const filteredPayments = await getInformalPayments(filters);
      setPayments(filteredPayments);
    } catch (error) {
      console.error('Error filtering payments:', error);
      alert('Filtreleme sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      supplierId: '',
      projectId: '',
      startDate: '',
      endDate: '',
      paymentMethod: '',
    });
    loadData();
  };

  const handleAddNew = () => {
    setEditingPayment(null);
    setIsModalOpen(true);
  };

  const handleEdit = (payment: InformalPayment) => {
    setEditingPayment(payment);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu ödemeyi silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await deleteInformalPayment(id);
      alert('Ödeme başarıyla silindi');
      loadData();
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Ödeme silinirken hata oluştu');
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingPayment) {
        await updateInformalPayment(editingPayment.id, data);
        alert('Ödeme başarıyla güncellendi');
      } else {
        await createInformalPayment({
          ...data,
          created_by: user?.id || '',
          company_id: user?.company_id || '',
        });
        alert('Ödeme başarıyla eklendi');
      }
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Ödeme kaydedilirken hata oluştu');
    }
  };

  const totalAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

  return (
    <Sidebar>
      <div className="p-6">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Title and Stats */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gayri Resmi Ödemeler</h1>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
                    <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Toplam Ödeme</p>
                    <p className="text-lg font-bold text-primary-600">{formatCurrency(totalAmount)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Kayıt Sayısı</p>
                    <p className="text-lg font-bold text-blue-600">{payments.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setIsContractModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-purple-700 hover:to-indigo-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Sözleşmeli Ödeme</span>
              </button>
              <button
                onClick={handleAddNew}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <PlusIcon className="h-5 w-5" />
                <span>Yeni Ödeme Ekle</span>
              </button>
            </div>
          </div>
        </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-700">Filtreler</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Taşeron</label>
            <select
              value={filters.supplierId}
              onChange={(e) => setFilters({ ...filters, supplierId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Tümü</option>
              {subcontractors.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Proje</label>
            <select
              value={filters.projectId}
              onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Tümü</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Başlangıç Tarihi</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Bitiş Tarihi</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Ödeme Yöntemi</label>
            <select
              value={filters.paymentMethod}
              onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Tümü</option>
              <option value="Nakit">Nakit</option>
              <option value="Banka Transferi">Banka Transferi</option>
              <option value="Çek">Çek</option>
              <option value="Kredi Kartı">Kredi Kartı</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button 
            onClick={handleFilter} 
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            Filtrele
          </button>
          <button 
            onClick={handleClearFilters} 
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Temizle
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
        </div>
      ) : payments.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <WalletIcon className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Henüz ödeme yok</h3>
          <p className="mt-2 text-sm text-gray-500">
            Gayri resmi ödeme ekleyerek başlayın.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => setIsContractModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Sözleşmeli Ödeme Ekle
            </button>
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <PlusIcon className="h-5 w-5" />
              Hızlı Ödeme Ekle
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tarih</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Taşeron</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Proje</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Açıklama</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Tutar</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Yöntem</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {payment.supplier?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {payment.project?.name || '-'}
                    </td>
                    <td className="max-w-xs truncate px-6 py-4 text-sm text-gray-600" title={payment.description}>
                      {payment.description}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-primary-600">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        {payment.payment_method || '-'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(payment)}
                          className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                          title="Düzenle"
                        >
                          <EditIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(payment.id)}
                          className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                          title="Sil"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

        {/* Modal */}
        {isModalOpen && (
          <PaymentModal
            payment={editingPayment}
            subcontractors={subcontractors}
            projects={projects}
            onClose={() => setIsModalOpen(false)}
            onSubmit={handleSubmit}
          />
        )}
        
        {/* Contract Payment Modal */}
        {user?.company_id && user?.id && (
          <ContractPaymentModal
            isOpen={isContractModalOpen}
            onClose={() => setIsContractModalOpen(false)}
            companyId={user.company_id}
            userId={user.id}
            onSuccess={loadData}
          />
        )}
      </div>
    </Sidebar>
  );
}

// Modal Component
interface PaymentModalProps {
  payment: InformalPayment | null;
  subcontractors: Supplier[]; // Supplier tipine çevrildi
  projects: Project[];
  onClose: () => void;
  onSubmit: (data: any) => void;
}

function PaymentModal({ payment, subcontractors, projects, onClose, onSubmit }: PaymentModalProps) {
  const { user } = useAuth();
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierVkn, setNewSupplierVkn] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    supplier_id: payment?.supplier_id || '',
    project_id: payment?.project_id || '',
    amount: payment?.amount?.toString() || '',
    description: payment?.description || '',
    payment_date: payment?.payment_date || new Date().toISOString().split('T')[0],
    payment_method: payment?.payment_method || '',
    receipt_number: payment?.receipt_number || '',
    notes: payment?.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      
      let supplierId = formData.supplier_id;
      
      // Eğer yeni kişi/firma ekleme aktifse
      if (isCreatingNew) {
        if (!newSupplierName.trim()) {
          alert('Lütfen kişi/firma adını giriniz');
          return;
        }
        
        if (!user?.company_id) {
          alert('Kullanıcı bilgisi bulunamadı');
          return;
        }
        
        // Yeni supplier oluştur
        const newSupplier = await createSubcontractor(
          user.company_id,
          newSupplierName.trim(),
          newSupplierVkn.trim() || undefined
        );
        
        supplierId = newSupplier.id;
      }
      
      // Validate required fields
      if (!supplierId) {
        alert('Lütfen taşeron seçiniz veya yeni kişi/firma ekleyiniz');
        return;
      }
      if (!formData.amount || Number(formData.amount) <= 0) {
        alert('Lütfen geçerli bir tutar giriniz');
        return;
      }
      if (!formData.description) {
        alert('Lütfen açıklama giriniz');
        return;
      }

      onSubmit({
        ...formData,
        supplier_id: supplierId,
        project_id: formData.project_id || null,
        amount: Number(formData.amount),
      });
    } catch (error: any) {
      console.error('Error creating payment:', error);
      alert(error.message || 'Ödeme eklenirken hata oluştu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-xl font-bold text-gray-900">
            {payment ? 'Ödeme Düzenle' : 'Yeni Ödeme Ekle'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body space-y-5">
          {/* Yeni Kişi/Firma Ekleme Checkbox */}
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <input
              type="checkbox"
              id="createNew"
              checked={isCreatingNew}
              onChange={(e) => {
                setIsCreatingNew(e.target.checked);
                if (e.target.checked) {
                  setFormData({ ...formData, supplier_id: '' });
                }
              }}
              disabled={!!payment}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="createNew" className="text-sm font-medium text-blue-900 cursor-pointer select-none">
              Yeni Kişi/Firma Ekle
            </label>
          </div>
          
          {/* Yeni Kişi/Firma Bilgileri (checkbox işaretlendiğinde gösterilir) */}
          {isCreatingNew && (
            <div className="grid grid-cols-1 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kişi/Firma Adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required={isCreatingNew}
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Örn: Ali Veli veya ABC İnşaat"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  VKN/TCKN (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={newSupplierVkn}
                  onChange={(e) => setNewSupplierVkn(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="10 veya 11 haneli"
                  maxLength={11}
                />
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Taşeron Seçimi (checkbox işaretli değilse gösterilir) */}
            {!isCreatingNew && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Taşeron <span className="text-red-500">*</span></label>
                <select
                  required={!isCreatingNew}
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">Seçiniz</option>
                  {subcontractors.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Proje (Opsiyonel)</label>
              <select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">Seçiniz</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ödeme Tarihi <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tutar (₺) <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-12 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-gray-500 text-sm">₺</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama <span className="text-red-500">*</span></label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Ödeme ile ilgili detayları yazın..."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ödeme Yöntemi</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">Seçiniz</option>
                <option value="Kasadan Nakit">Kasadan Nakit</option>
                <option value="Kredi Kartı">Kredi Kartı</option>
                <option value="Banka Transferi">Banka Transferi</option>
                <option value="Çek">Çek</option>
                <option value="Senet">Senet</option>
                <option value="Havale/EFT">Havale/EFT</option>
                <option value="Cari">Cari</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Makbuz/Dekont No</label>
              <input
                type="text"
                value={formData.receipt_number}
                onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Opsiyonel"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Ek notlar (opsiyonel)"
            />
          </div>

          <div className="modal-footer flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">
              İptal
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 text-sm font-medium text-white shadow-md transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
              {payment ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Icons
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
