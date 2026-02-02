'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { 
  getAllCustomers, 
  createCustomer, 
  updateCustomer, 
  deactivateCustomer, 
  activateCustomer,
  deleteCustomer,
  type Customer 
} from '@/lib/supabase/customers';

export default function CustomersPage() {
  const { company, hasPermission } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    vkn: '',
    name: '',
    address: '',
    tax_office: '',
    phone: '',
    email: '',
    notes: '',
  });

  const canCreate = hasPermission('invoices', 'create');
  const canUpdate = hasPermission('invoices', 'update');
  const canDelete = hasPermission('invoices', 'delete');

  useEffect(() => {
    if (company) {
      loadCustomers();
    }
  }, [company, showInactive]);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchQuery]);

  async function loadCustomers() {
    setIsLoading(true);
    try {
      const data = await getAllCustomers(company!.id, !showInactive);
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function filterCustomers() {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = customers.filter(customer => 
      customer.name.toLowerCase().includes(query) ||
      customer.vkn.includes(query) ||
      customer.tax_office?.toLowerCase().includes(query) ||
      customer.phone?.includes(query) ||
      customer.email?.toLowerCase().includes(query)
    );
    setFilteredCustomers(filtered);
  }

  function openCreateModal() {
    setFormData({
      vkn: '',
      name: '',
      address: '',
      tax_office: '',
      phone: '',
      email: '',
      notes: '',
    });
    setIsModalOpen(true);
  }

  function openEditModal(customer: Customer) {
    setSelectedCustomer(customer);
    setFormData({
      vkn: customer.vkn,
      name: customer.name,
      address: customer.address || '',
      tax_office: customer.tax_office || '',
      phone: customer.phone || '',
      email: customer.email || '',
      notes: customer.notes || '',
    });
    setIsEditModalOpen(true);
  }

  function openDeleteModal(customer: Customer) {
    setSelectedCustomer(customer);
    setIsDeleteModalOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;

    if (!formData.vkn || !formData.name) {
      alert('VKN ve firma adı zorunludur!');
      return;
    }

    if (!/^\d{10,11}$/.test(formData.vkn.trim())) {
      alert('VKN 10 veya 11 haneli rakam olmalıdır!');
      return;
    }

    try {
      const customer = await createCustomer(
        formData.vkn,
        formData.name,
        company.id,
        {
          address: formData.address || undefined,
          tax_office: formData.tax_office || undefined,
          phone: formData.phone || undefined,
          email: formData.email || undefined,
          notes: formData.notes || undefined,
        }
      );

      if (customer) {
        setIsModalOpen(false);
        loadCustomers();
        alert('✅ Müşteri başarıyla eklendi!');
      } else {
        alert('Müşteri oluşturulurken hata oluştu');
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Müşteri oluşturulurken hata oluştu');
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) return;

    try {
      const updated = await updateCustomer(selectedCustomer.id, {
        name: formData.name,
        address: formData.address || undefined,
        tax_office: formData.tax_office || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        notes: formData.notes || undefined,
      });

      if (updated) {
        setIsEditModalOpen(false);
        setSelectedCustomer(null);
        loadCustomers();
        alert('✅ Müşteri başarıyla güncellendi!');
      } else {
        alert('Müşteri güncellenirken hata oluştu');
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      alert('Müşteri güncellenirken hata oluştu');
    }
  }

  async function handleDelete() {
    if (!selectedCustomer) return;

    try {
      const success = await deleteCustomer(selectedCustomer.id);

      if (success) {
        setIsDeleteModalOpen(false);
        setSelectedCustomer(null);
        loadCustomers();
        alert('✅ Müşteri başarıyla silindi!');
      } else {
        alert('Müşteri silinirken hata oluştu');
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Müşteri silinirken hata oluştu');
    }
  }

  async function handleToggleActive(customer: Customer) {
    const action = customer.is_active ? 'pasif' : 'aktif';
    if (!confirm(`${customer.name} müşterisini ${action} yapmak istediğinizden emin misiniz?`)) return;

    try {
      const success = customer.is_active
        ? await deactivateCustomer(customer.id)
        : await activateCustomer(customer.id);

      if (success) {
        loadCustomers();
        alert(`✅ Müşteri ${action} yapıldı!`);
      } else {
        alert(`Müşteri ${action} yapılırken hata oluştu`);
      }
    } catch (error) {
      console.error('Error toggling customer status:', error);
      alert(`Müşteri ${action} yapılırken hata oluştu`);
    }
  }

  if (isLoading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="space-y-4 md:space-y-6">
        {/* Header - Responsive */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-secondary-900">Müşteriler</h1>
              <p className="mt-1 text-xs md:text-sm text-secondary-600">
                {filteredCustomers.length} müşteri • Giden faturalar için müşteri bilgileri
              </p>
            </div>
            {canCreate && (
              <Button onClick={openCreateModal} className="w-full md:w-auto">
                + Yeni Müşteri
              </Button>
            )}
          </div>

          {/* Search and Filters - Responsive */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="🔍 Müşteri adı, VKN, telefon veya email ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm px-3 py-2 bg-secondary-50 rounded-lg cursor-pointer hover:bg-secondary-100 transition-colors">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="whitespace-nowrap">Pasif Müşteriler</span>
            </label>
          </div>
        </div>

        {/* Statistics Cards - Responsive */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card className="p-3 md:p-4">
            <div className="text-xs md:text-sm text-secondary-600 mb-1">Toplam Müşteri</div>
            <div className="text-xl md:text-2xl font-bold text-secondary-900">{customers.length}</div>
          </Card>
          <Card className="p-3 md:p-4">
            <div className="text-xs md:text-sm text-green-600 mb-1">Aktif</div>
            <div className="text-xl md:text-2xl font-bold text-green-700">
              {customers.filter(c => c.is_active).length}
            </div>
          </Card>
          <Card className="p-3 md:p-4">
            <div className="text-xs md:text-sm text-gray-600 mb-1">Pasif</div>
            <div className="text-xl md:text-2xl font-bold text-gray-700">
              {customers.filter(c => !c.is_active).length}
            </div>
          </Card>
          <Card className="p-3 md:p-4">
            <div className="text-xs md:text-sm text-blue-600 mb-1">Arama Sonucu</div>
            <div className="text-xl md:text-2xl font-bold text-blue-700">{filteredCustomers.length}</div>
          </Card>
        </div>

        {/* Desktop Table View */}
        <Card className="hidden lg:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-secondary-200">
              <thead className="bg-secondary-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500">
                    Firma Adı
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500">
                    VKN
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500">
                    İletişim
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500">
                    Durum
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-secondary-500">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200 bg-white">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="text-secondary-400 text-5xl mb-4">📋</div>
                      <div className="text-sm text-secondary-600">
                        {searchQuery ? 'Arama kriterine uygun müşteri bulunamadı' : 'Henüz müşteri kaydı bulunmuyor'}
                      </div>
                      {!searchQuery && canCreate && (
                        <Button onClick={openCreateModal} className="mt-4">
                          İlk Müşteriyi Ekle
                        </Button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-secondary-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-secondary-900">{customer.name}</div>
                        {customer.address && (
                          <div className="text-xs text-secondary-500 mt-1">{customer.address}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-secondary-900 font-mono">{customer.vkn}</div>
                        {customer.tax_office && (
                          <div className="text-xs text-secondary-500 mt-1">{customer.tax_office}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {customer.phone && (
                          <div className="text-sm text-secondary-900">📞 {customer.phone}</div>
                        )}
                        {customer.email && (
                          <div className="text-sm text-secondary-500 mt-1">✉️ {customer.email}</div>
                        )}
                        {!customer.phone && !customer.email && (
                          <span className="text-sm text-secondary-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          customer.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {customer.is_active ? '✓ Aktif' : '○ Pasif'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => openEditModal(customer)}
                              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              ✏️ Düzenle
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleToggleActive(customer)}
                              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                customer.is_active 
                                  ? 'text-amber-600 hover:text-amber-900 hover:bg-amber-50' 
                                  : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                              }`}
                            >
                              {customer.is_active ? '⊗ Pasif Yap' : '✓ Aktif Yap'}
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => openDeleteModal(customer)}
                              className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              🗑️ Sil
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Mobile/Tablet Card View */}
        <div className="lg:hidden space-y-3">
          {filteredCustomers.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-secondary-400 text-5xl mb-4">📋</div>
              <div className="text-sm text-secondary-600 mb-4">
                {searchQuery ? 'Arama kriterine uygun müşteri bulunamadı' : 'Henüz müşteri kaydı bulunmuyor'}
              </div>
              {!searchQuery && canCreate && (
                <Button onClick={openCreateModal} className="w-full">
                  İlk Müşteriyi Ekle
                </Button>
              )}
            </Card>
          ) : (
            filteredCustomers.map((customer) => (
              <Card key={customer.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-secondary-900">{customer.name}</h3>
                    <div className="text-sm text-secondary-600 font-mono mt-1">VKN: {customer.vkn}</div>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap ml-2 ${
                    customer.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {customer.is_active ? '✓ Aktif' : '○ Pasif'}
                  </span>
                </div>

                {customer.tax_office && (
                  <div className="text-sm text-secondary-600 mb-2">
                    🏢 {customer.tax_office}
                  </div>
                )}

                {customer.address && (
                  <div className="text-sm text-secondary-600 mb-2">
                    📍 {customer.address}
                  </div>
                )}

                <div className="space-y-1 mb-3">
                  {customer.phone && (
                    <div className="text-sm text-secondary-600">📞 {customer.phone}</div>
                  )}
                  {customer.email && (
                    <div className="text-sm text-secondary-600">✉️ {customer.email}</div>
                  )}
                </div>

                {customer.notes && (
                  <div className="text-sm text-secondary-500 bg-secondary-50 p-2 rounded mb-3">
                    💬 {customer.notes}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-3 border-t border-secondary-100">
                  {canUpdate && (
                    <button
                      onClick={() => openEditModal(customer)}
                      className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      ✏️ Düzenle
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleToggleActive(customer)}
                      className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        customer.is_active 
                          ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' 
                          : 'text-green-600 bg-green-50 hover:bg-green-100'
                      }`}
                    >
                      {customer.is_active ? '⊗ Pasif' : '✓ Aktif'}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => openDeleteModal(customer)}
                      className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Yeni Müşteri Ekle">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="VKN *"
            type="text"
            value={formData.vkn}
            onChange={(e) => setFormData({ ...formData, vkn: e.target.value.replace(/\D/g, '') })}
            placeholder="10 veya 11 haneli"
            maxLength={11}
            required
          />
          <Input
            label="Firma Adı *"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Örn: ABC İnşaat Ltd. Şti."
            required
          />
          <Input
            label="Vergi Dairesi"
            type="text"
            value={formData.tax_office}
            onChange={(e) => setFormData({ ...formData, tax_office: e.target.value })}
            placeholder="Örn: Kadıköy"
          />
          <Input
            label="Adres"
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Tam adres"
          />
          <Input
            label="Telefon"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="0555 123 45 67"
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="info@firma.com"
          />
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">
              Notlar
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="input-field w-full"
              placeholder="Müşteri hakkında notlar..."
            />
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              İptal
            </Button>
            <Button type="submit">Kaydet</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Müşteri Düzenle">
        <form onSubmit={handleUpdate} className="space-y-4">
          <Input
            label="VKN"
            type="text"
            value={formData.vkn}
            disabled
            className="bg-secondary-50 cursor-not-allowed"
          />
          <Input
            label="Firma Adı *"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Vergi Dairesi"
            type="text"
            value={formData.tax_office}
            onChange={(e) => setFormData({ ...formData, tax_office: e.target.value })}
          />
          <Input
            label="Adres"
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
          <Input
            label="Telefon"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">
              Notlar
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="input-field w-full"
            />
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>
              İptal
            </Button>
            <Button type="submit">Güncelle</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        title="Müşteri Sil"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <h4 className="font-semibold text-red-900 mb-1">Dikkat!</h4>
                <p className="text-sm text-red-700">
                  <strong>{selectedCustomer?.name}</strong> müşterisini kalıcı olarak silmek üzeresiniz. 
                  Bu işlem geri alınamaz!
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-xl">💡</div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">İpucu</h4>
                <p className="text-sm text-blue-700">
                  Müşteriyi tamamen silmek yerine <strong>Pasif</strong> yapabilirsiniz. 
                  Bu sayede geçmiş kayıtlar korunur.
                </p>
              </div>
            </div>
          </div>

          <ModalFooter>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => setIsDeleteModalOpen(false)}
            >
              İptal
            </Button>
            <Button 
              type="button"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Evet, Sil
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </Sidebar>
  );
}
