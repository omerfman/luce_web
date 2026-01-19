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
  last_seen_at?: string | null; // For presence tracking
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

export interface Subcontractor {
  id: string;
  company_id: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_number?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active: boolean;
  supplier_id?: string | null; // Bağlı supplier ID (eğer varsa)
  created_at: string;
  updated_at: string;
  // Relations
  supplier?: Supplier;
}

export interface InvoiceQRData {
  taxNumber?: string;        // VKN/TCKN (satıcı vkntckn)
  buyerVKN?: string;         // Alıcı VKN (avkntckn)
  invoiceNumber?: string;    // Fatura No
  invoiceDate?: string;      // Fatura Tarihi
  totalAmount?: number;      // Toplam Tutar
  vatAmount?: number;        // KDV Tutarı
  supplierName?: string;     // Tedarikçi Adı (varsa)
  goodsServicesTotal?: number; // Mal/Hizmet Tutarı (KDV hariç)
  withholdingAmount?: number;  // Tevkifat Tutarı
  etag?: string;             // E-Fatura UUID/ETTN
  scenario?: string;         // Fatura senaryosu (senaryo)
  type?: string;             // Fatura tipi (tip)
  currency?: string;         // Para birimi (parabirimi)
  rawData: string;           // Ham QR verisi
}

// Supplier (Tedarikçi) - VKN bazlı firma bilgileri cache
export interface Supplier {
  id: string;
  company_id: string;
  vkn: string;               // Vergi Kimlik Numarası (10-11 hane)
  name: string;              // Firma Adı
  supplier_type: 'pending' | 'subcontractor' | 'invoice_company'; // Firma tipi
  subcontractor_id?: string | null; // Bağlı taşeron ID (eğer varsa)
  is_active: boolean;        // Aktif mi?
  address?: string | null;   // Adres
  tax_office?: string | null; // Vergi Dairesi
  phone?: string | null;     // Telefon
  email?: string | null;     // E-posta
  notes?: string | null;     // Notlar
  created_at: string;
  updated_at: string;
  // Relations
  subcontractor?: Subcontractor;
}

export interface InformalPayment {
  id: string;
  project_id?: string | null;
  supplier_id: string;
  amount: number;
  description: string;
  payment_date: string;
  payment_method?: string | null;
  receipt_number?: string | null;
  notes?: string | null;
  created_by: string;
  company_id: string;
  created_at: string;
  updated_at: string;
  has_contract?: boolean;
  contract_pdf_url?: string | null;
  // Relations
  supplier?: Supplier;
  project?: Project;
  user?: User;
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
  // Invoice details
  supplier_name?: string | null;          // Fatura firma adı
  goods_services_total?: number | null;   // Mal ve hizmet toplam
  vat_amount?: number | null;             // KDV
  withholding_amount?: number | null;     // Tevkifat
  // QR code metadata (new)
  supplier_vkn?: string | null;           // Satıcı VKN (QR'dan)
  buyer_vkn?: string | null;              // Alıcı VKN (QR'dan avkntckn)
  invoice_scenario?: string | null;       // Fatura senaryosu (TICARIFATURA, TEMELFATURA)
  invoice_type?: string | null;           // Fatura tipi (SATIS, ALIS)
  invoice_ettn?: string | null;           // E-Fatura ETTN (UUID)
  currency?: string | null;               // Para birimi (TRY, USD, EUR)
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
  supplier_name?: string;
  supplier_vkn?: string; // Satıcı VKN (QR'dan)
  invoice_number?: string;
  vat_amount?: number;
  withholding_amount?: number;
  goods_services_total?: number;
  currency?: string;
  notes?: string;
  // QR kod'dan gelen ekstra bilgiler
  qr_buyer_vkn?: string; // avkntckn - Alıcı VKN
  qr_scenario?: string; // senaryo - TICARIFATURA, TEMELFATURA, vb.
  qr_type?: string; // tip - SATIS, ALIS
  qr_ettn?: string; // ettn - E-Fatura UUID
  qr_currency?: string; // parabirimi - TRY, USD, vb.
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

export interface ProjectFile {
  id: string;
  project_id: string;
  category: TechnicalCategory;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  cloudinary_public_id: string | null;
  cloudinary_resource_type?: 'image' | 'video' | 'raw';
  uploaded_by: string;
  company_id: string;
  created_at: string;
  updated_at: string;
  // Relations
  user?: User;
  project?: Project;
}

// ==================== ENUMS & CONSTANTS ====================

export type TechnicalCategory = 
  | 'statik'
  | 'mimari'
  | 'mekanik'
  | 'elektrik'
  | 'zemin_etudu'
  | 'geoteknik'
  | 'ic_tasarim'
  | '3d';

export const TECHNICAL_CATEGORIES: Record<TechnicalCategory, string> = {
  statik: 'Statik',
  mimari: 'Mimari',
  mekanik: 'Mekanik',
  elektrik: 'Elektrik',
  zemin_etudu: 'Zemin Etüdü',
  geoteknik: 'Geoteknik',
  ic_tasarim: 'İç Tasarım',
  '3d': '3 Boyut',
};

export interface FileUploadResponse {
  success: boolean;
  file?: ProjectFile;
  error?: string;
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

// ==================== BULK INVOICE TYPES ====================

export enum BulkUploadStatus {
  PENDING = 'pending',           // Dosya yüklendi, işlenmeyi bekliyor
  PROCESSING = 'processing',     // QR kod okunuyor
  QR_SUCCESS = 'qr_success',    // QR başarıyla okundu
  QR_FAILED = 'qr_failed',      // QR okunamadı
  MANUAL_ENTRY = 'manual_entry', // Manuel bilgi girişi gerekiyor
  READY = 'ready',               // Kaydedilmeye hazır
  SAVING = 'saving',             // Kaydediliyor
  SUCCESS = 'success',           // Başarıyla kaydedildi
  ERROR = 'error',               // Kayıt hatası
}

export interface BulkInvoiceItem {
  id: string;                    // Temporary unique ID for list management
  file: File;                    // PDF dosyası
  status: BulkUploadStatus;      // İşlem durumu
  qrData: InvoiceQRData | null;  // QR'dan okunan data
  error?: string;                // Hata mesajı (varsa)
  
  // Form data (editable)
  invoice_number: string;
  invoice_date: string;
  supplier_name: string;
  supplier_vkn?: string;
  vkn?: string;                  // VKN from QR
  etag?: string;                 // E-fatura ETTN/UUID
  goods_services_total: string;  // Turkish format: "15.090,40"
  vat_amount: string;
  withholding_amount: string;
  amount: string;                // Calculated total
  description: string;
  
  // Validation
  isValid: boolean;
  validationErrors: string[];
}

export interface BulkInvoiceData {
  items: BulkInvoiceItem[];
  totalCount: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  isProcessing: boolean;
}

export interface VKNGroup {
  vkn: string;
  supplierName: string;
  items: BulkInvoiceItem[];
}

// ==================== PROJECT SUMMARY TYPES ====================

export interface ProjectFinancialStats {
  invoiceTotal: number;
  invoiceCount: number;
  vatTotal: number;
  withholdingTotal: number;
  informalPaymentTotal: number;
  informalPaymentCount: number;
  grandTotal: number;
}

export interface ProjectFileStats {
  count: number;
  totalSize: number;
  byCategory: Record<string, { count: number; size: number }>;
}

export interface ProjectMonthlySpending {
  month: string;
  invoices: number;
  informalPayments: number;
  total: number;
}

export interface ProjectSupplierSpending {
  name: string;
  vkn?: string;
  total: number;
}

export interface ProjectActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, any> | null;
  created_at: string;
  user?: {
    name: string;
    email: string;
  };
}

export interface ProjectSummary {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: ProjectStatus;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    updated_at: string;
  };
  financial: {
    grandTotal: number;
    invoices: {
      count: number;
      totalAmount: number;
      totalVAT: number;
      totalWithholding: number;
      totalGoodsServices: number;
    };
    informalPayments: {
      count: number;
      totalAmount: number;
    };
  };
  files: ProjectFileStats;
  activities: ProjectActivityLog[];
  monthlySpending: Record<string, { invoices: number; informalPayments: number }>;
  suppliers: Array<{
    name: string;
    vkn?: string;
    total: number;
    invoiceCount: number;
    paymentCount: number;
  }>;
}

// ==================== UTILITY TYPES ====================

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
