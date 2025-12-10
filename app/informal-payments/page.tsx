'use client';

import { useState, useEffect } from 'react';
import { InformalPayment, Subcontractor, Project } from '@/types';
import { Sidebar } from '@/components/layout/Sidebar';
import {
  getInformalPayments,
  createInformalPayment,
  updateInformalPayment,
  deleteInformalPayment,
} from '@/lib/supabase/informal-payments';
import { getSubcontractors } from '@/lib/supabase/subcontractors';
import { useAuth } from '@/lib/auth/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';

export default function InformalPaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<InformalPayment[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<InformalPayment | null>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    subcontractorId: '',
    projectId: '',
    startDate: '',
    endDate: '',
    paymentMethod: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [paymentsData, subcontractorsData, projectsData] = await Promise.all([
        getInformalPayments(),
        getSubcontractors(),
        loadProjects(),
      ]);
      setPayments(paymentsData);
      setSubcontractors(subcontractorsData);
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
      subcontractorId: '',
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
        <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Gayri Resmi Ödemeler</h1>
          <p className="mt-1 text-sm text-secondary-600">
            Toplam: <span className="font-semibold text-primary-600">{formatCurrency(totalAmount)}</span>
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          Yeni Ödeme Ekle
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <h3 className="mb-4 text-sm font-medium text-secondary-900">Filtreler</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div>
            <label className="label">Taşeron</label>
            <select
              value={filters.subcontractorId}
              onChange={(e) => setFilters({ ...filters, subcontractorId: e.target.value })}
              className="input"
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
            <label className="label">Proje</label>
            <select
              value={filters.projectId}
              onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
              className="input"
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
            <label className="label">Başlangıç Tarihi</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="label">Bitiş Tarihi</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="label">Ödeme Yöntemi</label>
            <select
              value={filters.paymentMethod}
              onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
              className="input"
            >
              <option value="">Tümü</option>
              <option value="Nakit">Nakit</option>
              <option value="Banka Transferi">Banka Transferi</option>
              <option value="Çek">Çek</option>
              <option value="Senet">Senet</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={handleFilter} className="btn-primary">
            Filtrele
          </button>
          <button onClick={handleClearFilters} className="btn-secondary">
            Filtreleri Temizle
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
        </div>
      ) : payments.length === 0 ? (
        <div className="card py-12 text-center">
          <WalletIcon className="mx-auto h-12 w-12 text-secondary-400" />
          <h3 className="mt-2 text-sm font-medium text-secondary-900">Ödeme bulunamadı</h3>
          <p className="mt-1 text-sm text-secondary-500">
            Henüz gayri resmi ödeme eklenmemiş.
          </p>
          <button onClick={handleAddNew} className="btn-primary mt-4">
            İlk Ödemeyi Ekle
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-secondary-200">
              <thead className="bg-secondary-50">
                <tr>
                  <th className="table-header">Tarih</th>
                  <th className="table-header">Taşeron</th>
                  <th className="table-header">Proje</th>
                  <th className="table-header">Açıklama</th>
                  <th className="table-header">Tutar</th>
                  <th className="table-header">Ödeme Yöntemi</th>
                  <th className="table-header">Makbuz No</th>
                  <th className="table-header">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200 bg-white">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-secondary-50">
                    <td className="table-cell text-secondary-900">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td className="table-cell font-medium text-secondary-900">
                      {payment.subcontractor?.name || '-'}
                    </td>
                    <td className="table-cell text-secondary-600">
                      {payment.project?.name || '-'}
                    </td>
                    <td className="table-cell text-secondary-600">
                      {payment.description}
                    </td>
                    <td className="table-cell font-semibold text-primary-600">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="table-cell text-secondary-600">
                      {payment.payment_method || '-'}
                    </td>
                    <td className="table-cell text-secondary-600">
                      {payment.receipt_number || '-'}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(payment)}
                          className="text-primary-600 hover:text-primary-700"
                          title="Düzenle"
                        >
                          <EditIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(payment.id)}
                          className="text-error-600 hover:text-error-700"
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
      </div>
    </Sidebar>
  );
}

// Modal Component
interface PaymentModalProps {
  payment: InformalPayment | null;
  subcontractors: Subcontractor[];
  projects: Project[];
  onClose: () => void;
  onSubmit: (data: any) => void;
}

function PaymentModal({ payment, subcontractors, projects, onClose, onSubmit }: PaymentModalProps) {
  const [formData, setFormData] = useState({
    subcontractor_id: payment?.subcontractor_id || '',
    project_id: payment?.project_id || '',
    amount: payment?.amount?.toString() || '',
    description: payment?.description || '',
    payment_date: payment?.payment_date || new Date().toISOString().split('T')[0],
    payment_method: payment?.payment_method || '',
    receipt_number: payment?.receipt_number || '',
    notes: payment?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.subcontractor_id) {
      alert('Lütfen taşeron seçiniz');
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
      project_id: formData.project_id || null,
      amount: Number(formData.amount),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-secondary-900">
            {payment ? 'Ödeme Düzenle' : 'Yeni Ödeme Ekle'}
          </h2>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-600">
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label">Taşeron *</label>
              <select
                required
                value={formData.subcontractor_id}
                onChange={(e) => setFormData({ ...formData, subcontractor_id: e.target.value })}
                className="input"
              >
                <option value="">Seçiniz</option>
                {subcontractors.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Proje (Opsiyonel)</label>
              <select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                className="input"
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
              <label className="label">Ödeme Tarihi *</label>
              <input
                type="date"
                required
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label">Tutar (₺) *</label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Açıklama *</label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label">Ödeme Yöntemi</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="input"
              >
                <option value="">Seçiniz</option>
                <option value="Nakit">Nakit</option>
                <option value="Banka Transferi">Banka Transferi</option>
                <option value="Çek">Çek</option>
                <option value="Senet">Senet</option>
              </select>
            </div>

            <div>
              <label className="label">Makbuz/Dekont No</label>
              <input
                type="text"
                value={formData.receipt_number}
                onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Notlar</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              İptal
            </button>
            <button type="submit" className="btn-primary">
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
