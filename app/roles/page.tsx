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
import { PERMISSION_GROUPS, ACTION_LABELS, ACTION_DESCRIPTIONS, ROLE_TEMPLATES } from '@/lib/permission-groups';

export default function RolesPage() {
  const { company, hasPermission } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
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
    setSelectedTemplate('');
    setFormData({
      name: '',
      permissions: [],
    });
    setIsModalOpen(true);
  }

  function openEditModal(role: Role) {
    setSelectedRole(role);
    setSelectedTemplate('');
    setFormData({
      name: role.name,
      permissions: role.permissions,
    });
    setIsModalOpen(true);
  }

  function applyTemplate(templateKey: string) {
    const template = ROLE_TEMPLATES[templateKey as keyof typeof ROLE_TEMPLATES];
    if (template) {
      setFormData({
        name: formData.name || template.name,
        permissions: [...template.permissions],
      });
      setSelectedTemplate(templateKey);
    }
  }

  function togglePermission(permission: Permission) {
    const exists = formData.permissions.some(
      (p) => p.resource === permission.resource && p.action === permission.action && p.scope === permission.scope
    );

    if (exists) {
      setFormData({
        ...formData,
        permissions: formData.permissions.filter(
          (p) => !(p.resource === permission.resource && p.action === permission.action && p.scope === permission.scope)
        ),
      });
    } else {
      setFormData({
        ...formData,
        permissions: [...formData.permissions, permission],
      });
    }
  }

  function toggleGroupPermissions(groupId: string, checked: boolean) {
    const group = PERMISSION_GROUPS.find(g => g.id === groupId);
    if (!group) return;

    if (checked) {
      // Add all group permissions
      const newPermissions = [...formData.permissions];
      group.permissions.forEach(perm => {
        if (!newPermissions.some(p => 
          p.resource === perm.resource && p.action === perm.action && p.scope === perm.scope
        )) {
          newPermissions.push(perm);
        }
      });
      setFormData({ ...formData, permissions: newPermissions });
    } else {
      // Remove all group permissions
      setFormData({
        ...formData,
        permissions: formData.permissions.filter(p =>
          !group.permissions.some(gp =>
            gp.resource === p.resource && gp.action === p.action && gp.scope === p.scope
          )
        ),
      });
    }
  }

  function isPermissionSelected(permission: Permission): boolean {
    return formData.permissions.some(
      (p) => p.resource === permission.resource && p.action === permission.action && p.scope === permission.scope
    );
  }

  function isGroupFullySelected(groupId: string): boolean {
    const group = PERMISSION_GROUPS.find(g => g.id === groupId);
    if (!group) return false;
    return group.permissions.every(perm => isPermissionSelected(perm));
  }

  function isGroupPartiallySelected(groupId: string): boolean {
    const group = PERMISSION_GROUPS.find(g => g.id === groupId);
    if (!group) return false;
    const selectedCount = group.permissions.filter(perm => isPermissionSelected(perm)).length;
    return selectedCount > 0 && selectedCount < group.permissions.length;
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
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Rol Adı"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="örn: Proje Yöneticisi"
          />

          {/* Template Selection */}
          {!selectedRole && (
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary-700">
                Hızlı Şablon Seç (Opsiyonel)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ROLE_TEMPLATES).map(([key, template]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyTemplate(key)}
                    className={`rounded-lg border p-3 text-left transition-all hover:border-primary-500 hover:bg-primary-50 ${
                      selectedTemplate === key ? 'border-primary-500 bg-primary-50' : 'border-secondary-200'
                    }`}
                  >
                    <div className="font-medium text-secondary-900">{template.name}</div>
                    <div className="text-xs text-secondary-600">{template.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Permission Groups */}
          <div>
            <label className="mb-3 block text-sm font-medium text-secondary-700">
              Yetkiler ({formData.permissions.length} seçili)
            </label>
            <div className="max-h-[500px] space-y-4 overflow-y-auto rounded-lg border border-secondary-200 p-4">
              {PERMISSION_GROUPS.map((group) => {
                const isFullySelected = isGroupFullySelected(group.id);
                const isPartiallySelected = isGroupPartiallySelected(group.id);
                
                return (
                  <div key={group.id} className="space-y-2 rounded-lg border border-secondary-200 p-3">
                    {/* Group Header */}
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isFullySelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isPartiallySelected && !isFullySelected;
                        }}
                        onChange={(e) => toggleGroupPermissions(group.id, e.target.checked)}
                        className="mt-0.5 h-5 w-5 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{group.icon}</span>
                          <span className="font-medium text-secondary-900">{group.label}</span>
                        </div>
                        <p className="text-xs text-secondary-600">{group.description}</p>
                      </div>
                    </div>

                    {/* Individual Permissions */}
                    <div className="ml-8 space-y-1.5 border-l-2 border-secondary-200 pl-3">
                      {group.permissions.map((perm, idx) => (
                        <label
                          key={idx}
                          className="flex cursor-pointer items-start gap-2 rounded p-1.5 hover:bg-secondary-50"
                        >
                          <input
                            type="checkbox"
                            checked={isPermissionSelected(perm)}
                            onChange={() => togglePermission(perm)}
                            className="mt-0.5 h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-secondary-900">
                              {ACTION_LABELS[perm.action] || perm.action}
                            </div>
                            <div className="text-xs text-secondary-600">
                              {ACTION_DESCRIPTIONS[perm.action] || ''}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={formData.permissions.length === 0}>
              {selectedRole ? 'Güncelle' : 'Oluştur'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </Sidebar>
  );
}
