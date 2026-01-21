'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase/client';
import { User, Role, Company, Permission } from '@/types';
import { getUserStatus } from '@/lib/hooks/useUserPresence';
import { PERMISSION_GROUPS, ACTION_LABELS, ACTION_DESCRIPTIONS } from '@/lib/permission-groups';

export default function UsersPage() {
  const { hasPermission, role } = useAuth();
  const isSuperAdmin = role?.name === 'Super Admin' && role?.company_id === null;
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role_id: '',
    company_id: '',
  });
  
  const [editFormData, setEditFormData] = useState({
    name: '',
    role_id: '',
    company_id: '',
    added_permissions: [] as Permission[],
    removed_permissions: [] as Permission[],
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setIsLoading(true);

      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select(`
          *,
          role:roles(*),
          company:companies(*)
        `)
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      // Fetch roles (exclude Super Admin from list)
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .neq('name', 'Super Admin')
        .order('name');

      if (rolesError) throw rolesError;

      // Fetch companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (companiesError) throw companiesError;

      // Filter out Super Admin users
      const filteredUsers = (usersData || []).filter(user => user.role?.name !== 'Super Admin');

      setUsers(filteredUsers);
      setRoles(rolesData || []);
      setCompanies(companiesData || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Kullanıcı oluşturulamadı');
      }

      setSuccess('Kullanıcı başarıyla oluşturuldu!');
      setShowAddModal(false);
      setFormData({
        email: '',
        password: '',
        name: '',
        role_id: '',
        company_id: '',
      });
      
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEdit(user: User) {
    setEditingUser(user);
    
    // Parse custom permissions from meta
    const meta = user.meta || {};
    const addedPerms = (meta.added_permissions || []) as Permission[];
    const removedPerms = (meta.removed_permissions || []) as Permission[];
    
    setEditFormData({
      name: user.name,
      role_id: user.role_id,
      company_id: user.company_id,
      added_permissions: addedPerms,
      removed_permissions: removedPerms,
    });
    setShowEditModal(true);
  }

  // Get all permissions from role
  function getRolePermissions(): Permission[] {
    if (!editingUser?.role?.permissions) return [];
    return editingUser.role.permissions;
  }

  // Get final permissions (role + added - removed)
  function getFinalPermissions(): Permission[] {
    const rolePerms = getRolePermissions();
    const addedPerms = editFormData.added_permissions;
    const removedPerms = editFormData.removed_permissions;
    
    // Start with role permissions
    let finalPerms = [...rolePerms];
    
    // Remove the removed permissions
    finalPerms = finalPerms.filter(rp =>
      !removedPerms.some(removed =>
        removed.resource === rp.resource &&
        removed.action === rp.action &&
        removed.scope === rp.scope
      )
    );
    
    // Add custom permissions that aren't already there
    addedPerms.forEach(added => {
      const exists = finalPerms.some(p =>
        p.resource === added.resource &&
        p.action === added.action &&
        p.scope === added.scope
      );
      if (!exists) {
        finalPerms.push(added);
      }
    });
    
    return finalPerms;
  }

  // Check if permission is from role
  function isRolePermission(permission: Permission): boolean {
    const rolePerms = getRolePermissions();
    return rolePerms.some(p =>
      p.resource === permission.resource &&
      p.action === permission.action &&
      p.scope === permission.scope
    );
  }

  // Check if permission is currently active
  function isPermissionActive(permission: Permission): boolean {
    const finalPerms = getFinalPermissions();
    return finalPerms.some(p =>
      p.resource === permission.resource &&
      p.action === permission.action &&
      p.scope === permission.scope
    );
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: editFormData.name,
          role_id: editFormData.role_id,
          company_id: editFormData.company_id,
          meta: {
            ...editingUser.meta,
            added_permissions: editFormData.added_permissions,
            removed_permissions: editFormData.removed_permissions,
          },
        })
        .eq('id', editingUser.id);

      if (updateError) throw updateError;

      setSuccess('Kullanıcı başarıyla güncellendi!');
      setShowEditModal(false);
      setEditingUser(null);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`${user.name} kullanıcısını silmek istediğinizden emin misiniz?`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);

      if (deleteError) throw deleteError;

      setSuccess('Kullanıcı başarıyla silindi!');
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function togglePermission(permission: Permission) {
    const isFromRole = isRolePermission(permission);
    const isActive = isPermissionActive(permission);
    
    setEditFormData(prev => {
      if (isFromRole && isActive) {
        // Role permission, currently active - mark as removed
        return {
          ...prev,
          removed_permissions: [...prev.removed_permissions, permission],
        };
      } else if (isFromRole && !isActive) {
        // Role permission, removed - restore it
        return {
          ...prev,
          removed_permissions: prev.removed_permissions.filter(p =>
            !(p.resource === permission.resource && p.action === permission.action && p.scope === permission.scope)
          ),
        };
      } else if (!isFromRole && isActive) {
        // Custom permission - remove it
        return {
          ...prev,
          added_permissions: prev.added_permissions.filter(p =>
            !(p.resource === permission.resource && p.action === permission.action && p.scope === permission.scope)
          ),
        };
      } else {
        // Not active, not from role - add as custom
        return {
          ...prev,
          added_permissions: [...prev.added_permissions, permission],
        };
      }
    });
  }

  function toggleGroupPermissions(groupId: string, checked: boolean) {
    const group = PERMISSION_GROUPS.find(g => g.id === groupId);
    if (!group) return;

    group.permissions.forEach(perm => {
      const isActive = isPermissionActive(perm);
      if (checked && !isActive) {
        togglePermission(perm);
      } else if (!checked && isActive) {
        togglePermission(perm);
      }
    });
  }

  function isGroupFullyActive(groupId: string): boolean {
    const group = PERMISSION_GROUPS.find(g => g.id === groupId);
    if (!group) return false;
    return group.permissions.every(perm => isPermissionActive(perm));
  }

  function isGroupPartiallyActive(groupId: string): boolean {
    const group = PERMISSION_GROUPS.find(g => g.id === groupId);
    if (!group) return false;
    const activeCount = group.permissions.filter(perm => isPermissionActive(perm)).length;
    return activeCount > 0 && activeCount < group.permissions.length;
  }

  if (isLoading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center h-64">
          <div className="text-secondary-600">Yükleniyor...</div>
        </div>
      </Sidebar>
    );
  }

  if (!hasPermission('users', 'read')) {
    return (
      <Sidebar>
        <Card>
          <CardContent>
            <p className="text-red-600">Bu sayfayı görüntüleme yetkiniz yok.</p>
          </CardContent>
        </Card>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="space-y-4 lg:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl lg:text-2xl font-bold text-secondary-900">Kullanıcılar</h1>
          {hasPermission('users', 'create') && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary text-sm lg:text-base"
            >
              + Yeni Kullanıcı
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 lg:p-4 text-xs lg:text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-3 lg:p-4 text-xs lg:text-sm text-green-700">
            {success}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Kullanıcı Listesi ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-secondary-200">
                <thead className="bg-secondary-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      İsim
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      E-posta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      Şirket
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      Durum
                    </th>
                    {(hasPermission('users', 'update') || hasPermission('users', 'delete')) && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-secondary-500 uppercase tracking-wider">
                        İşlemler
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-secondary-200">
                  {users.map((user: any) => (
                    <tr key={user.id} className="hover:bg-secondary-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-secondary-900">
                          {user.name}
                          {user.meta?.custom_permissions?.length > 0 && (
                            <span className="ml-2 text-xs text-primary-600" title="Özel yetkiler atanmış">
                              ⭐
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-secondary-600">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800">
                          {user.role?.name || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">
                        {user.company?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {user.is_active ? 'Aktif' : 'Pasif'}
                          </span>
                          {isSuperAdmin && user.last_seen_at && (
                            <>
                              {(() => {
                                const status = getUserStatus(user.last_seen_at);
                                return (
                                  <span
                                    className={`inline-flex h-2.5 w-2.5 rounded-full ${
                                      status === 'online'
                                        ? 'bg-green-500'
                                        : status === 'away'
                                        ? 'bg-yellow-500'
                                        : 'bg-gray-400'
                                    }`}
                                    title={
                                      status === 'online'
                                        ? 'Çevrimiçi'
                                        : status === 'away'
                                        ? 'Uzakta'
                                        : 'Çevrimdışı'
                                    }
                                  />
                                );
                              })()}
                            </>
                          )}
                        </div>
                      </td>
                      {(hasPermission('users', 'update') || hasPermission('users', 'delete')) && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex gap-2 justify-end">
                            {hasPermission('users', 'update') && (
                              <button
                                onClick={() => handleEdit(user)}
                                className="text-primary-600 hover:text-primary-900"
                              >
                                Düzenle
                              </button>
                            )}
                            {hasPermission('users', 'delete') && (
                              <button
                                onClick={() => handleDelete(user)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Sil
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {users.map((user: any) => (
                <div key={user.id} className="bg-white border border-secondary-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-secondary-900 truncate">
                          {user.name}
                        </p>
                        {user.meta?.custom_permissions?.length > 0 && (
                          <span className="text-xs text-primary-600" title="Özel yetkiler">⭐</span>
                        )}
                      </div>
                      <p className="text-xs text-secondary-500 truncate mt-1">{user.email}</p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        user.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-secondary-500">Rol:</span>
                      <span className="ml-1 px-2 py-0.5 bg-primary-100 text-primary-800 rounded-full font-medium">
                        {user.role?.name || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-secondary-500">Şirket:</span>
                      <span className="ml-1 text-secondary-900">{user.company?.name || '-'}</span>
                    </div>
                  </div>

                  {(hasPermission('users', 'update') || hasPermission('users', 'delete')) && (
                    <div className="flex gap-2 pt-2 border-t border-secondary-100">
                      {hasPermission('users', 'update') && (
                        <button
                          onClick={() => handleEdit(user)}
                          className="flex-1 px-3 py-2 text-xs font-medium text-primary-700 bg-primary-50 rounded-md hover:bg-primary-100"
                        >
                          Düzenle
                        </button>
                      )}
                      {hasPermission('users', 'delete') && (
                        <button
                          onClick={() => handleDelete(user)}
                          className="flex-1 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100"
                        >
                          Sil
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Add User Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-4 lg:p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg lg:text-xl font-bold text-secondary-900 mb-4">
                Yeni Kullanıcı Ekle
              </h2>

              <form onSubmit={handleSubmit} className="space-y-3 lg:space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    İsim
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    placeholder="Ahmet Yılmaz"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    E-posta
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                    placeholder="ahmet@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Şifre
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input"
                    placeholder="En az 6 karakter"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Şirket
                  </label>
                  <select
                    required
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                    className="input"
                  >
                    <option value="">Şirket seçin</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Rol
                  </label>
                  <select
                    required
                    value={formData.role_id}
                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                    className="input"
                  >
                    <option value="">Rol seçin</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setError('');
                    }}
                    className="btn flex-1"
                    disabled={isSubmitting}
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary flex-1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Oluşturuluyor...' : 'Oluştur'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full p-4 lg:p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg lg:text-xl font-bold text-secondary-900 mb-4">
                Kullanıcı Düzenle: {editingUser.name}
              </h2>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-1">
                      İsim
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-1">
                      Rol
                    </label>
                    <select
                      required
                      value={editFormData.role_id}
                      onChange={(e) => setEditFormData({ ...editFormData, role_id: e.target.value })}
                      className="input"
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Şirket
                  </label>
                  <select
                    required
                    value={editFormData.company_id}
                    onChange={(e) => setEditFormData({ ...editFormData, company_id: e.target.value })}
                    className="input"
                  >
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Permission Groups */}
                <div className="border-t pt-4">
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-secondary-700 mb-1">
                      Yetkiler
                    </label>
                    <p className="text-xs text-secondary-600">
                      Kullanıcının rol yetkilerine ek olarak özel yetkiler verebilir veya rol yetkilerini kaldırabilirsiniz.
                    </p>
                  </div>

                  <div className="max-h-[400px] space-y-3 overflow-y-auto rounded-lg border border-secondary-200 p-4">
                    {PERMISSION_GROUPS.map((group) => {
                      const isFullyActive = isGroupFullyActive(group.id);
                      const isPartiallyActive = isGroupPartiallyActive(group.id);
                      
                      return (
                        <div key={group.id} className="space-y-2 rounded-lg bg-secondary-50 p-3">
                          {/* Group Header */}
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isFullyActive}
                              ref={(el) => {
                                if (el) el.indeterminate = isPartiallyActive && !isFullyActive;
                              }}
                              onChange={(e) => toggleGroupPermissions(group.id, e.target.checked)}
                              className="mt-0.5 h-5 w-5 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{group.icon}</span>
                                <span className="font-medium text-sm text-secondary-900">{group.label}</span>
                                {isPartiallyActive && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                                    Kısmi
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-secondary-600 mt-0.5">{group.description}</p>
                            </div>
                          </div>

                          {/* Individual Permissions */}
                          <div className="ml-8 space-y-1 border-l-2 border-secondary-200 pl-3">
                            {group.permissions.map((perm, idx) => {
                              const isActive = isPermissionActive(perm);
                              const isFromRole = isRolePermission(perm);
                              
                              return (
                                <label
                                  key={idx}
                                  className="flex cursor-pointer items-start gap-2 rounded p-1.5 hover:bg-white"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={() => togglePermission(perm)}
                                    className="mt-0.5 h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-secondary-900">
                                        {ACTION_LABELS[perm.action] || perm.action}
                                      </span>
                                      {isFromRole && isActive && (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                          Rol
                                        </span>
                                      )}
                                      {isFromRole && !isActive && (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                                          Kaldırıldı
                                        </span>
                                      )}
                                      {!isFromRole && isActive && (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                                          Özel
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-secondary-600">
                                      {ACTION_DESCRIPTIONS[perm.action] || ''}
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-900">
                      <strong>💡 İpucu:</strong><br />
                      • <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">Rol</span> = Rolden gelen yetki<br />
                      • <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-xs">Özel</span> = Özel olarak eklenmiş yetki<br />
                      • <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs">Kaldırıldı</span> = Rol yetkisi kaldırılmış
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingUser(null);
                      setError('');
                    }}
                    className="btn flex-1"
                    disabled={isSubmitting}
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary flex-1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
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
