'use client';

import { useState, useEffect } from 'react';
import { Subcontractor } from '@/types';
import { Sidebar } from '@/components/layout/Sidebar';
import {
  getSubcontractors,
  createSubcontractor,
  updateSubcontractor,
  deleteSubcontractor,
  searchSubcontractors,
} from '@/lib/supabase/subcontractors';
import { useAuth } from '@/lib/auth/AuthContext';

export default function SubcontractorsPage() {
  const { user } = useAuth();
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubcontractor, setEditingSubcontractor] = useState<Subcontractor | null>(null);

  useEffect(() => {
    loadSubcontractors();
  }, []);

  const loadSubcontractors = async () => {
    try {
      setLoading(true);
      const data = await getSubcontractors();
      setSubcontractors(data);
    } catch (error) {
      console.error('Error loading subcontractors:', error);
      alert('Taşeronlar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      loadSubcontractors();
      return;
    }

    try {
      const data = await searchSubcontractors(query);
      setSubcontractors(data);
    } catch (error) {
      console.error('Error searching subcontractors:', error);
      alert('Arama sırasında hata oluştu');
    }
  };

  const handleAddNew = () => {
    setEditingSubcontractor(null);
    setIsModalOpen(true);
  };

  const handleEdit = (subcontractor: Subcontractor) => {
    setEditingSubcontractor(subcontractor);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu taşeronu silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await deleteSubcontractor(id);
      alert('Taşeron başarıyla silindi');
      loadSubcontractors();
    } catch (error) {
      console.error('Error deleting subcontractor:', error);
      alert('Taşeron silinirken hata oluştu');
    }
  };

  const handleSubmit = async (data: Omit<Subcontractor, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (editingSubcontractor) {
        await updateSubcontractor(editingSubcontractor.id, data);
        alert('Taşeron başarıyla güncellendi');
      } else {
        await createSubcontractor(data);
        alert('Taşeron başarıyla eklendi');
      }
      setIsModalOpen(false);
      loadSubcontractors();
    } catch (error) {
      console.error('Error saving subcontractor:', error);
      alert('Taşeron kaydedilirken hata oluştu');
    }
  };

  return (
    <Sidebar>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900">Taşeron Listesi</h1>
        <button
          onClick={handleAddNew}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          Yeni Taşeron Ekle
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary-400" />
          <input
            type="text"
            placeholder="Taşeron ara (isim, telefon, e-posta)..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
        </div>
      ) : subcontractors.length === 0 ? (
        <div className="card py-12 text-center">
          <BuildingIcon className="mx-auto h-12 w-12 text-secondary-400" />
          <h3 className="mt-2 text-sm font-medium text-secondary-900">Taşeron bulunamadı</h3>
          <p className="mt-1 text-sm text-secondary-500">
            {searchQuery ? 'Arama kriterlerine uygun taşeron bulunamadı.' : 'Henüz taşeron eklenmemiş.'}
          </p>
          {!searchQuery && (
            <button onClick={handleAddNew} className="btn-primary mt-4">
              İlk Taşeronu Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-secondary-200">
              <thead className="bg-secondary-50">
                <tr>
                  <th className="table-header">Taşeron Adı</th>
                  <th className="table-header">İletişim Kişisi</th>
                  <th className="table-header">Telefon</th>
                  <th className="table-header">E-posta</th>
                  <th className="table-header">Vergi No</th>
                  <th className="table-header">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200 bg-white">
                {subcontractors.map((subcontractor) => (
                  <tr key={subcontractor.id} className="hover:bg-secondary-50">
                    <td className="table-cell font-medium text-secondary-900">
                      {subcontractor.name}
                    </td>
                    <td className="table-cell text-secondary-600">
                      {subcontractor.contact_person || '-'}
                    </td>
                    <td className="table-cell text-secondary-600">
                      {subcontractor.phone || '-'}
                    </td>
                    <td className="table-cell text-secondary-600">
                      {subcontractor.email || '-'}
                    </td>
                    <td className="table-cell text-secondary-600">
                      {subcontractor.tax_number || '-'}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(subcontractor)}
                          className="text-primary-600 hover:text-primary-700"
                          title="Düzenle"
                        >
                          <EditIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(subcontractor.id)}
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
          <SubcontractorModal
            subcontractor={editingSubcontractor}
            companyId={user?.company_id || ''}
            onClose={() => setIsModalOpen(false)}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </Sidebar>
  );
}

// Modal Component
interface SubcontractorModalProps {
  subcontractor: Subcontractor | null;
  companyId: string;
  onClose: () => void;
  onSubmit: (data: Omit<Subcontractor, 'id' | 'created_at' | 'updated_at'>) => void;
}

function SubcontractorModal({ subcontractor, companyId, onClose, onSubmit }: SubcontractorModalProps) {
  const [formData, setFormData] = useState({
    company_id: companyId,
    name: subcontractor?.name || '',
    contact_person: subcontractor?.contact_person || '',
    phone: subcontractor?.phone || '',
    email: subcontractor?.email || '',
    tax_number: subcontractor?.tax_number || '',
    address: subcontractor?.address || '',
    notes: subcontractor?.notes || '',
    is_active: subcontractor?.is_active ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-secondary-900">
            {subcontractor ? 'Taşeron Düzenle' : 'Yeni Taşeron Ekle'}
          </h2>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-600">
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Taşeron Adı *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label">İletişim Kişisi</label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label">Telefon</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label">E-posta</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label">Vergi Numarası</label>
              <input
                type="text"
                value={formData.tax_number}
                onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Adres</label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="label">Notlar</label>
            <textarea
              rows={3}
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
              {subcontractor ? 'Güncelle' : 'Ekle'}
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
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
