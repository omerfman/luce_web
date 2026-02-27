/**
 * Permission Groups Configuration
 * Kullanıcı dostu yetkilendirme sistemi için modül bazlı yetki grupları
 */

import { Permission } from '@/types';

export interface PermissionGroup {
  id: string;
  label: string;
  description: string;
  icon: string;
  permissions: Permission[];
  order: number;
}

/**
 * Tüm yetkilendirme grupları
 * Her grup bir modülü veya özellik setini temsil eder
 */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'projects',
    label: 'Projeler',
    description: 'Proje yönetimi ve görüntüleme yetkileri',
    icon: '📁',
    order: 1,
    permissions: [
      { resource: 'projects', action: 'read', scope: 'company' },
      { resource: 'projects', action: 'create', scope: 'company' },
      { resource: 'projects', action: 'update', scope: 'company' },
      { resource: 'projects', action: 'delete', scope: 'company' },
      { resource: 'projects', action: 'manage', scope: 'company' },
    ],
  },
  {
    id: 'invoices',
    label: 'Faturalar',
    description: 'Fatura yönetimi, QR okuma ve projeye atama',
    icon: '🧾',
    order: 2,
    permissions: [
      { resource: 'invoices', action: 'read', scope: 'company' },
      { resource: 'invoices', action: 'create', scope: 'company' },
      { resource: 'invoices', action: 'update', scope: 'company' },
      { resource: 'invoices', action: 'delete', scope: 'company' },
      { resource: 'invoices', action: 'assign', scope: 'company' },
      { resource: 'invoices', action: 'reject', scope: 'company' },
      { resource: 'invoices', action: 'export', scope: 'company' },
    ],
  },
  {
    id: 'informal_payments',
    label: 'Gayri Resmi Ödemeler',
    description: 'Gayri resmi ödeme ve sözleşme yönetimi',
    icon: '💵',
    order: 3,
    permissions: [
      { resource: 'informal_payments', action: 'read', scope: 'company' },
      { resource: 'informal_payments', action: 'create', scope: 'company' },
      { resource: 'informal_payments', action: 'update', scope: 'company' },
      { resource: 'informal_payments', action: 'delete', scope: 'company' },
      { resource: 'informal_payments', action: 'manage', scope: 'company' },
    ],
  },
  {
    id: 'subcontractors',
    label: 'Taşeronlar',
    description: 'Taşeron firma yönetimi',
    icon: '👷',
    order: 4,
    permissions: [
      { resource: 'subcontractors', action: 'read', scope: 'company' },
      { resource: 'subcontractors', action: 'create', scope: 'company' },
      { resource: 'subcontractors', action: 'update', scope: 'company' },
      { resource: 'subcontractors', action: 'delete', scope: 'company' },
      { resource: 'subcontractors', action: 'manage', scope: 'company' },
    ],
  },
  {
    id: 'suppliers',
    label: 'Tedarikçiler',
    description: 'Tedarikçi ve VKN yönetimi',
    icon: '🏢',
    order: 5,
    permissions: [
      { resource: 'suppliers', action: 'read', scope: 'company' },
      { resource: 'suppliers', action: 'create', scope: 'company' },
      { resource: 'suppliers', action: 'update', scope: 'company' },
      { resource: 'suppliers', action: 'delete', scope: 'company' },
      { resource: 'suppliers', action: 'manage', scope: 'company' },
    ],
  },
  {
    id: 'users',
    label: 'Kullanıcılar',
    description: 'Kullanıcı yönetimi ve yetkilendirme',
    icon: '👥',
    order: 6,
    permissions: [
      { resource: 'users', action: 'read', scope: 'company' },
      { resource: 'users', action: 'create', scope: 'company' },
      { resource: 'users', action: 'update', scope: 'company' },
      { resource: 'users', action: 'delete', scope: 'company' },
      { resource: 'users', action: 'manage', scope: 'company' },
    ],
  },
  {
    id: 'roles',
    label: 'Rol Yönetimi',
    description: 'Rol oluşturma ve yetki atama',
    icon: '🔐',
    order: 7,
    permissions: [
      { resource: 'roles', action: 'read', scope: 'company' },
      { resource: 'roles', action: 'create', scope: 'company' },
      { resource: 'roles', action: 'update', scope: 'company' },
      { resource: 'roles', action: 'delete', scope: 'company' },
      { resource: 'roles', action: 'manage', scope: 'company' },
    ],
  },
  {
    id: 'card_statements',
    label: 'Kredi Kartı Ekstreleri',
    description: 'Kredi kartı ekstresi yükleme, eşleştirme ve yönetimi',
    icon: '💳',
    order: 8,
    permissions: [
      { resource: 'card_statements', action: 'read', scope: 'company' },
      { resource: 'card_statements', action: 'create', scope: 'company' },
      { resource: 'card_statements', action: 'update', scope: 'company' },
      { resource: 'card_statements', action: 'delete', scope: 'company' },
      { resource: 'card_statements', action: 'assign', scope: 'company' },
      { resource: 'card_statements', action: 'verify', scope: 'company' },
      { resource: 'card_statements', action: 'export', scope: 'company' },
      { resource: 'card_statements', action: 'manage', scope: 'company' },
    ],
  },
  {
    id: 'activity_logs',
    label: 'Aktivite Logları',
    description: 'Sistem aktivitelerini görüntüleme',
    icon: '📋',
    order: 9,
    permissions: [
      { resource: 'activity_logs', action: 'read', scope: 'company' },
      { resource: 'activity_logs', action: 'export', scope: 'company' },
      { resource: 'activity_logs', action: 'manage', scope: 'company' },
    ],
  },
  {
    id: 'reports',
    label: 'Raporlar',
    description: 'Rapor görüntüleme ve oluşturma',
    icon: '📊',
    order: 10,
    permissions: [
      { resource: 'reports', action: 'read', scope: 'company' },
      { resource: 'reports', action: 'create', scope: 'company' },
      { resource: 'reports', action: 'export', scope: 'company' },
    ],
  },
  {
    id: 'companies',
    label: 'Şirket Ayarları',
    description: 'Şirket bilgileri ve ayarlar',
    icon: '⚙️',
    order: 11,
    permissions: [
      { resource: 'companies', action: 'read', scope: 'company' },
      { resource: 'companies', action: 'update', scope: 'company' },
    ],
  },
];

/**
 * Yetki action'larının Türkçe karşılıkları
 */
export const ACTION_LABELS: Record<string, string> = {
  read: 'Görüntüleme',
  create: 'Oluşturma',
  update: 'Güncelleme',
  delete: 'Silme',
  manage: 'Tam Yönetim',
  assign: 'Atama',
  reject: 'Reddetme',
  verify: 'Onaylama',
  export: 'Dışa Aktarma',
};

/**
 * Yetki action'larının açıklamaları
 */
export const ACTION_DESCRIPTIONS: Record<string, string> = {
  read: 'Kayıtları görüntüleyebilir',
  create: 'Yeni kayıt oluşturabilir',
  update: 'Mevcut kayıtları düzenleyebilir',
  delete: 'Kayıtları silebilir',
  manage: 'Tüm işlemleri yapabilir (oluşturma, güncelleme, silme)',
  assign: 'Kayıtları projelere veya kullanıcılara atayabilir',
  reject: 'Hatalı faturları reddedebilir ve reddi geri alabilir',
  verify: 'Eşleştirmeleri onaylayabilir',
  export: 'Verileri dışa aktarabilir',
};

/**
 * Önerilen rol şablonları
 */
export const ROLE_TEMPLATES = {
  super_admin: {
    name: 'Süper Admin',
    description: 'Tüm şirketlere ve tüm kaynaklara erişim yetkisi (companies.manage.all)',
    permissions: [
      { resource: 'companies' as const, action: 'manage' as const, scope: 'all' as const },
      // Tüm diğer yetkiler otomatik olarak verilir çünkü super admin kontrolü var
      ...PERMISSION_GROUPS.flatMap(group => group.permissions)
    ] as Permission[],
  },
  admin: {
    name: 'Yönetici',
    description: 'Tüm yetkilere sahip şirket yöneticisi',
    permissions: PERMISSION_GROUPS.flatMap(group => group.permissions) as Permission[],
  },
  accountant: {
    name: 'Muhasebe',
    description: 'Fatura, kredi kartı ekstreleri ve ödeme yönetimi',
    permissions: [
      ...(PERMISSION_GROUPS.find(g => g.id === 'invoices')?.permissions || []),
      ...(PERMISSION_GROUPS.find(g => g.id === 'card_statements')?.permissions || []),
      ...(PERMISSION_GROUPS.find(g => g.id === 'informal_payments')?.permissions || []),
      ...(PERMISSION_GROUPS.find(g => g.id === 'suppliers')?.permissions || []),
      { resource: 'projects' as const, action: 'read' as const, scope: 'company' as const },
      { resource: 'reports' as const, action: 'read' as const, scope: 'company' as const },
      { resource: 'reports' as const, action: 'export' as const, scope: 'company' as const },
    ] as Permission[],
  },
  project_manager: {
    name: 'Proje Yöneticisi',
    description: 'Proje ve fatura yönetimi',
    permissions: [
      ...(PERMISSION_GROUPS.find(g => g.id === 'projects')?.permissions || []),
      ...(PERMISSION_GROUPS.find(g => g.id === 'invoices')?.permissions || []),
      { resource: 'subcontractors' as const, action: 'read' as const, scope: 'company' as const },
      { resource: 'suppliers' as const, action: 'read' as const, scope: 'company' as const },
      { resource: 'reports' as const, action: 'read' as const, scope: 'company' as const },
    ] as Permission[],
  },
  viewer: {
    name: 'Görüntüleyici',
    description: 'Sadece görüntüleme yetkisi',
    permissions: PERMISSION_GROUPS.map(group => ({
      resource: group.permissions[0].resource,
      action: 'read' as const,
      scope: 'company' as const,
    })) as Permission[],
  },
};

/**
 * Belirli bir permission'ın hangi grupta olduğunu bulur
 */
export function findPermissionGroup(permission: Permission): PermissionGroup | undefined {
  return PERMISSION_GROUPS.find(group =>
    group.permissions.some(
      p =>
        p.resource === permission.resource &&
        p.action === permission.action &&
        p.scope === permission.scope
    )
  );
}

/**
 * Bir permission'ı insan okunabilir formata çevirir
 */
export function formatPermissionLabel(permission: Permission): string {
  const group = findPermissionGroup(permission);
  const actionLabel = ACTION_LABELS[permission.action] || permission.action;
  return group ? `${group.label} - ${actionLabel}` : `${permission.resource} - ${actionLabel}`;
}
