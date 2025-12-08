// Type definitions for the application

// ==================== DATABASE TYPES ====================

export interface Company {
  id: string;
  name: string;
  settings: Record<string, any> | null;
  created_at: string;
}

export interface Role {
  id: string;
  company_id: string | null; // null = global role
  name: string;
  permissions: Permission[];
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  company_id: string;
  role_id: string;
  meta: Record<string, any> | null;
  custom_permissions?: Permission[]; // User-specific permission overrides
  created_at: string;
  // Relations
  company?: Company;
  role?: Role;
}

export interface Project {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  // Relations
  company?: Company;
}

export interface Invoice {
  id: string;
  company_id: string;
  invoice_number: string;
  invoice_date: string;
  amount: number;
  description: string | null;
  file_path: string;
  file_name: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  // New fields
  supplier_name?: string | null;          // Fatura firma adı
  goods_services_total?: number | null;   // Mal ve hizmet toplam
  vat_amount?: number | null;             // KDV
  withholding_amount?: number | null;     // Tevkifat
  // Relations
  company?: Company;
  project_links?: InvoiceProjectLink[];
  payments?: Payment[];
}

export interface Payment {
  id: string;
  invoice_id: string;
  company_id: string;
  payment_type: string;
  amount: number;
  payment_date: string;
  description?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceProjectLink {
  id: string;
  invoice_id: string;
  project_id: string;
  created_at: string;
  // Relations
  invoice?: Invoice;
  project?: Project;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  timestamp: string;
  details: Record<string, any> | null;
  // Relations
  user?: User;
}

// ==================== ENUMS ====================

export enum ProjectStatus {
  PLANNED = 'planned',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum UserRole {
  SUPERADMIN = 'superadmin',
  COMPANY_ADMIN = 'şirket_yöneticisi',
  ACCOUNTANT = 'muhasebe',
  ARCHITECT = 'mimar',
  CIVIL_ENGINEER = 'insaat_muhendisi',
}

// ==================== PERMISSION TYPES ====================

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'assign' | 'export' | '*';
export type PermissionResource =
  | 'invoices'
  | 'projects'
  | 'users'
  | 'roles'
  | 'companies'
  | 'reports'
  | '*';
export type PermissionScope = 'own' | 'company' | 'all';

export interface Permission {
  resource: PermissionResource;
  action: PermissionAction;
  scope: PermissionScope;
}

// Database permission record with ID
export interface PermissionRecord extends Permission {
  id: string;
  description: string;
  created_at?: string;
}

// Example permission strings:
// "invoices.create.company" = Can create invoices for their company
// "invoices.read.all" = Can read all invoices
// "projects.manage.company" = Full management of company projects

// ==================== METADATA TYPES ====================

export interface InvoiceMetadata {
  supplier?: string;
  invoice_number?: string;
  tax_amount?: number;
  currency?: string;
  notes?: string;
  [key: string]: any;
}

// ==================== API TYPES ====================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ==================== FORM TYPES ====================

export interface LoginFormData {
  email: string;
}

export interface CreateProjectFormData {
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
}

export interface CreateInvoiceFormData {
  amount: number;
  date: string;
  supplier?: string;
  invoice_number?: string;
  notes?: string;
}

// ==================== UI TYPES ====================

export interface SidebarItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  permission?: string;
}

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

// ==================== UTILITY TYPES ====================

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
