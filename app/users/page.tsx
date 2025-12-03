'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase/client';
import { User, Role, Company, PermissionRecord } from '@/types';

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionRecord[]>([]);
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
    custom_permissions: [] as string[],
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

      // Fetch all permissions (handle if table doesn't exist)
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('permissions')
        .select('*')
        .order('resource', { ascending: true });

      // Don't throw error if permissions table doesn't exist
      if (permissionsError && !permissionsError.message.includes('permissions')) {
        console.warn('Permissions table not found, skipping permission loading');
      }

      // Filter out Super Admin users and wildcard permissions
      const filteredUsers = (usersData || []).filter(user => user.role?.name !== 'Super Admin');
      
      // Filter permissions: remove wildcards and 'all' scope (only Super Admin can use those)
      const filteredPermissions = (permissionsData || []).filter(perm => 
        !(perm.resource === '*' && perm.action === '*') && perm.scope !== 'all'
      );

      setUsers(filteredUsers);
      setRoles(rolesData || []);
      setCompanies(companiesData || []);
      setAllPermissions(filteredPermissions);
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
    const customPermissions = user.meta?.custom_permissions || [];
    
    setEditFormData({
      name: user.name,
      role_id: user.role_id,
      company_id: user.company_id,
      custom_permissions: customPermissions,
    });
    setShowEditModal(true);
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
            custom_permissions: editFormData.custom_permissions,
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

  function togglePermission(permissionId: string) {
    setEditFormData(prev => {
      const exists = prev.custom_permissions.includes(permissionId);
      return {
        ...prev,
        custom_permissions: exists
          ? prev.custom_permissions.filter(id => id !== permissionId)
          : [...prev.custom_permissions, permissionId],
      };
    });
  }

  // Group permissions by resource
  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = [];
    }
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, PermissionRecord[]>);

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-secondary-900">Kullanıcılar</h1>
          {hasPermission('users', 'create') && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary"
            >
              + Yeni Kullanıcı Ekle
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
            {success}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Kullanıcı Listesi ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
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
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {user.is_active ? 'Aktif' : 'Pasif'}
                        </span>
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
          </CardContent>
        </Card>

        {/* Add User Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-secondary-900 mb-4">
                Yeni Kullanıcı Ekle
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-secondary-900 mb-4">
                Kullanıcı Düzenle: {editingUser.name}
              </h2>

              <form onSubmit={handleEditSubmit} className="space-y-4">
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

                <div className="border-t pt-4 mt-4">
                  <label className="block text-sm font-medium text-secondary-700 mb-3">
                    Özel Yetkiler (Rolün haricinde ek yetkiler)
                  </label>
                  <div className="space-y-4 max-h-64 overflow-y-auto">
                    {Object.entries(groupedPermissions).map(([resource, perms]) => (
                      <div key={resource} className="bg-secondary-50 p-3 rounded">
                        <h4 className="font-medium text-sm text-secondary-900 mb-2 capitalize">
                          {resource}
                        </h4>
                        <div className="space-y-1">
                          {perms.map((perm) => (
                            <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editFormData.custom_permissions.includes(perm.id)}
                                onChange={() => togglePermission(perm.id)}
                                className="rounded border-gray-300"
                              />
                              <span className="text-sm text-secondary-700">
                                {perm.action} - {perm.description}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-secondary-500 mt-2">
                    Seçili yetkiler kullanıcının rolüne ek olarak verilecektir.
                  </p>
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
