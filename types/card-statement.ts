/**
 * Type Definitions for Card Statements System
 */

export interface CardStatement {
  id: string;
  company_id: string;
  uploaded_by_user_id: string;
  
  // Dosya bilgileri (sadece referans)
  file_name: string;
  
  // Kart bilgileri
  card_last_four?: string;
  card_holder_name?: string;
  statement_month?: string; // YYYY-MM-01
  
  // İstatistikler
  total_transactions: number;
  total_amount: number;
  matched_count: number;
  
  // Timestamps
  uploaded_at: string;
  created_at: string;
  
  // Populated fields (from joins)
  uploaded_by?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CardStatementItem {
  id: string;
  statement_id: string;
  
  // Excel satır bilgisi
  row_number: number;
  
  // İşlem bilgileri
  transaction_name: string;
  amount: number;
  currency: string;
  transaction_date: string;
  
  // İşlem tipi (YKB için kritik)
  transaction_type?: 'expense' | 'payment'; // expense = harcama, payment = borç ödemesi
  
  // Ek bilgiler
  card_last_four?: string;
  full_card_number?: string;     // Tam kart no (maskelenmiş): "5258 64** **** 7608"
  card_holder_name?: string;     // Kart sahibi (ek kart ise): "FARUK ASARKAYA / Ek Kart"
  description?: string;
  raw_data: Record<string, any>;
  
  // Taksit bilgileri
  is_installment?: boolean;
  installment_current?: number;  // Kaçıncı taksit
  installment_total?: number;    // Toplam taksit sayısı
  installment_total_amount?: number; // Taksit toplamı
  
  // Eşleşme durumu
  is_matched: boolean;
  match_confidence: number; // 0-100
  
  // Notlar ve doğrulama
  notes?: string | null;
  is_verified?: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  
  // Kasa fişi (projeye atama)
  project_id?: string | null;
  
  created_at: string;
  
  // Populated fields
  matches?: StatementInvoiceMatch[];
  projects?: {
    id: string;
    name: string;
    company_id: string;
  };
}

export interface StatementInvoiceMatch {
  id: string;
  statement_item_id: string;
  invoice_id: string;
  
  // Eşleşme detayları
  match_type: 'exact_amount' | 'amount_and_name' | 'manual' | 'suggested';
  match_score: number; // 0-100
  
  // Manuel eşleşme
  matched_by_user_id?: string;
  notes?: string;
  
  matched_at: string;
  
  // Populated fields
  invoice?: {
    id: string;
    amount: number;
    invoice_date?: string;
    invoice_number?: string;
    supplier_name?: string;
    file_path?: string; // Supabase storage path for PDF
    created_at?: string;
  };
  matched_by?: {
    id: string;
    name: string;
  };
}

// UI State types
export interface StatementListFilters {
  search?: string;
  cardLastFour?: string;
  startMonth?: string;
  endMonth?: string;
  minMatched?: number; // Minimum eşleşme yüzdesi
}

export interface StatementItemWithMatch extends CardStatementItem {
  bestMatch?: StatementInvoiceMatch;
  suggestedMatches?: StatementInvoiceMatch[];
}

// Form types
export interface StatementUploadFormData {
  file: File;
  cardLastFour?: string;
  cardHolderName?: string;
  statementMonth?: string; // YYYY-MM
}

export interface ManualMatchFormData {
  statementItemId: string;
  invoiceId: string;
  notes?: string;
}

// Statistics
export interface StatementStats {
  total: number;
  autoMatched: number;
  suggested: number;
  noMatch: number;
  autoMatchRate: number; // Percentage
  suggestionRate: number; // Percentage
}

// API Response types
export interface StatementDetailResponse {
  statement: CardStatement;
  items: StatementItemWithMatch[];
  stats: StatementStats;
}

export interface MatchSuggestionsResponse {
  statementItem: CardStatementItem;
  exactMatches: StatementInvoiceMatch[];
  suggestedMatches: StatementInvoiceMatch[];
}
