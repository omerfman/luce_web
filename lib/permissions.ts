import { Permission } from '@/types';

/**
 * Check if user has a specific permission
 */
export function checkPermission(
  userPermissions: Permission[],
  resource: string,
  action: string,
  scope: string = 'company'
): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;

  return userPermissions.some((perm) => {
    const resourceMatch = perm.resource === resource;
    const actionMatch = perm.action === action || perm.action === 'manage';
    const scopeMatch = perm.scope === scope || perm.scope === 'all';

    return resourceMatch && actionMatch && scopeMatch;
  });
}

/**
 * Get all resources a user can access with a specific action
 */
export function getAccessibleResources(
  userPermissions: Permission[],
  action: string
): string[] {
  return userPermissions
    .filter((perm) => perm.action === action || perm.action === 'manage')
    .map((perm) => perm.resource);
}

/**
 * Check if user is superadmin
 */
export function isSuperAdmin(userPermissions: Permission[]): boolean {
  return userPermissions.some(
    (perm) => perm.resource === 'companies' && perm.action === 'manage' && perm.scope === 'all'
  );
}

/**
 * Check if user is company admin
 */
export function isCompanyAdmin(userPermissions: Permission[]): boolean {
  return userPermissions.some(
    (perm) =>
      (perm.resource === 'users' || perm.resource === 'roles') &&
      perm.action === 'manage' &&
      perm.scope === 'company'
  );
}

/**
 * Format permissions for display
 */
export function formatPermission(permission: Permission): string {
  return `${permission.resource}.${permission.action}.${permission.scope}`;
}

/**
 * Parse permission string to Permission object
 */
export function parsePermissionString(permissionString: string): Permission | null {
  const parts = permissionString.split('.');
  if (parts.length !== 3) return null;

  return {
    resource: parts[0] as any,
    action: parts[1] as any,
    scope: parts[2] as any,
  };
}

/**
 * Get permission description in Turkish
 */
export function getPermissionDescription(permission: Permission): string {
  const resourceNames: Record<string, string> = {
    companies: 'Şirketler',
    users: 'Kullanıcılar',
    roles: 'Roller',
    projects: 'Projeler',
    invoices: 'Faturalar',
    reports: 'Raporlar',
  };

  const actionNames: Record<string, string> = {
    create: 'Oluşturma',
    read: 'Görüntüleme',
    update: 'Güncelleme',
    delete: 'Silme',
    manage: 'Tam Yönetim',
    assign_project: 'Projeye Atama',
  };

  const scopeNames: Record<string, string> = {
    own: 'Kendi',
    company: 'Şirket',
    all: 'Tümü',
  };

  const resource = resourceNames[permission.resource] || permission.resource;
  const action = actionNames[permission.action] || permission.action;
  const scope = scopeNames[permission.scope] || permission.scope;

  return `${resource} - ${action} (${scope})`;
}
