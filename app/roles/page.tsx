'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase/client';
import { Role, Permission } from '@/types';

// Only company-scoped permissions (Super Admin excluded)
// Admins can only grant permissions within their company scope
const AVAILABLE_PERMISSIONS = [
  { resource: 'users' as const, action: 'create' as const, scope: 'company' as const, label: 'Kullanıcı Oluştur (Şirket)' },
  { resource: 'users' as const, action: 'read' as const, scope: 'company' as const, label: 'Kullanıcı Görüntüle (Şirket)' },
  { resource: 'users' as const, action: 'update' as const, scope: 'company' as const, label: 'Kullanıcı Düzenle (Şirket)' },
  { resource: 'users' as const, action: 'delete' as const, scope: 'company' as const, label: 'Kullanıcı Sil (Şirket)' },
  { resource: 'projects' as const, action: 'create' as const, scope: 'company' as const, label: 'Proje Oluştur (Şirket)' },
  { resource: 'projects' as const, action: 'read' as const, scope: 'company' as const, label: 'Proje Görüntüle (Şirket)' },
  { resource: 'projects' as const, action: 'update' as const, scope: 'company' as const, label: 'Proje Düzenle (Şirket)' },
  { resource: 'projects' as const, action: 'delete' as const, scope: 'company' as const, label: 'Proje Sil (Şirket)' },
  { resource: 'invoices' as const, action: 'create' as const, scope: 'company' as const, label: 'Fatura Oluştur (Şirket)' },
  { resource: 'invoices' as const, action: 'read' as const, scope: 'company' as const, label: 'Fatura Görüntüle (Şirket)' },
  { resource: 'invoices' as const, action: 'update' as const, scope: 'company' as const, label: 'Fatura Düzenle (Şirket)' },
  { resource: 'invoices' as const, action: 'delete' as const, scope: 'company' as const, label: 'Fatura Sil (Şirket)' },
  { resource: 'roles' as const, action: 'create' as const, scope: 'company' as const, label: 'Rol Oluştur (Şirket)' },
  { resource: 'roles' as const, action: 'read' as const, scope: 'company' as const, label: 'Rol Görüntüle (Şirket)' },
  { resource: 'roles' as const, action: 'update' as const, scope: 'company' as const, label: 'Rol Düzenle (Şirket)' },
  { resource: 'roles' as const, action: 'delete' as const, scope: 'company' as const, label: 'Rol Sil (Şirket)' },
  { resource: 'companies' as const, action: 'read' as const, scope: 'company' as const, label: 'Şirket Bilgisi Görüntüle' },
  { resource: 'companies' as const, action: 'update' as const, scope: 'company' as const, label: 'Şirket Bilgisi Düzenle' },
  { resource: 'reports' as const, action: 'read' as const, scope: 'company' as const, label: 'Rapor Görüntüle (Şirket)' },
  { resource: 'reports' as const, action: 'create' as const, scope: 'company' as const, label: 'Rapor Oluştur (Şirket)' },
];

export default function RolesPage() {
  const { company, hasPermission } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    permissions: [] as Permission[],
  });

  const canCreate = hasPermission('*', '*') || hasPermission('roles', 'create');
  const canUpdate = hasPermission('*', '*') || hasPermission('roles', 'update');
  const canDelete = hasPermission('*', '*') || hasPermission('roles', 'delete');

  useEffect(() => {
    loadRoles();
  }, [company]);

  async function loadRoles() {
    try {
      let query = supabase
        .from('roles')
        .select('*');
      
      if (company?.id) {
        query = query.or(`company_id.eq.${company.id},company_id.is.null`);
      } else {
        query = query.is('company_id', null);
      }
      
      const { data, error } = await query.order('name');

      if (error) throw error;
      // Filter out Super Admin role from the list
      const filteredRoles = (data || []).filter(role => role.name !== 'Super Admin');
      setRoles(filteredRoles);
    } catch (error) {
      console.error('Error loading roles:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateModal() {
    setSelectedRole(null);
    setFormData({
      name: '',
      permissions: [],
    });
    setIsModalOpen(true);
  }

  function openEditModal(role: Role) {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      permissions: role.permissions,
    });
    setIsModalOpen(true);
  }

  function togglePermission(permission: Permission) {
    const exists = formData.permissions.some(
      (p) => p.resource === permission.resource && p.action === permission.action
    );

    if (exists) {
      setFormData({
        ...formData,
        permissions: formData.permissions.filter(
          (p) => !(p.resource === permission.resource && p.action === permission.action)
        ),
      });
    } else {
      setFormData({
        ...formData,
        permissions: [...formData.permissions, permission],
      });
    }
  }

  function isPermissionSelected(permission: Permission): boolean {
    return formData.permissions.some(
      (p) => p.resource === permission.resource && p.action === permission.action
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (selectedRole) {
        // Update existing role
        const { error } = await supabase
          .from('roles')
          .update({
            name: formData.name,
            permissions: formData.permissions,
          })
          .eq('id', selectedRole.id);

        if (error) throw error;
      } else {
        // Create new role
        const { error } = await supabase.from('roles').insert({
          name: formData.name,
          company_id: company?.id || null,
          permissions: formData.permissions,
        });

        if (error) throw error;
      }

      setIsModalOpen(false);
      loadRoles();
    } catch (error: any) {
      console.error('Error saving role:', error);
      alert(error.message || 'Rol kaydedilirken hata oluştu');
    }
  }

  async function handleDelete(roleId: string) {
    if (!confirm('Bu rolü silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase.from('roles').delete().eq('id', roleId);

      if (error) throw error;
      loadRoles();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      alert(error.message || 'Rol silinirken hata oluştu');
    }
  }

  if (isLoading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center py-12">
          <div className="text-secondary-600">Yükleniyor...</div>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">Roller</h1>
            <p className="mt-1 text-sm text-secondary-600">
              Toplam {roles.length} rol
            </p>
          </div>
          {canCreate && (
            <Button onClick={openCreateModal}>+ Yeni Rol Ekle</Button>
          )}
        </div>

        {/* Roles List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => {
            // Protected global roles that cannot be edited or deleted
            const isProtectedRole = !role.company_id && 
              (role.name === 'Super Admin' || role.name === 'Admin');
            
            return (
              <Card key={role.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-secondary-900">{role.name}</h3>
                      <p className="text-xs text-secondary-500 mt-1">
                        {role.company_id ? 'Şirket Rolü' : 'Global Rol'}
                      </p>
                    </div>
                    {!isProtectedRole && (canUpdate || canDelete) && (
                      <div className="flex gap-2">
                        {canUpdate && (
                          <button
                            onClick={() => openEditModal(role)}
                            className="text-sm text-primary-600 hover:text-primary-700"
                          >
                            Düzenle
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(role.id)}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Sil
                          </button>
                        )}
                      </div>
                    )}
                </div>

                <div className="border-t border-secondary-200 pt-3">
                  <p className="text-xs font-medium text-secondary-700 mb-2">
                    Yetkiler ({role.permissions.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.slice(0, 5).map((perm, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700"
                      >
                        {perm.resource === '*' ? 'Tümü' : perm.resource}
                      </span>
                    ))}
                    {role.permissions.length > 5 && (
                      <span className="text-xs text-secondary-500">
                        +{role.permissions.length - 5} daha
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
            );
          })}
        </div>
      </div>

      {/* Create/Edit Role Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedRole ? 'Rol Düzenle' : 'Yeni Rol Ekle'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Rol Adı"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="örn: Proje Yöneticisi"
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">
              Yetkiler
            </label>
            <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border border-secondary-200 p-4">
              {AVAILABLE_PERMISSIONS.map((perm, idx) => (
                <label
                  key={idx}
                  className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-secondary-50"
                >
                  <input
                    type="checkbox"
                    checked={isPermissionSelected(perm)}
                    onChange={() => togglePermission(perm)}
                    className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-secondary-900">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>

          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              İptal
            </Button>
            <Button type="submit">
              {selectedRole ? 'Güncelle' : 'Oluştur'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </Sidebar>
  );
}
