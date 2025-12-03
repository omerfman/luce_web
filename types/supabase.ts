// Supabase database type definitions (auto-generated format)
// This file will be updated after Supabase schema is created

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          settings: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          settings?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          settings?: Json | null;
          created_at?: string;
        };
      };
      roles: {
        Row: {
          id: string;
          company_id: string | null;
          name: string;
          permissions: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          name: string;
          permissions: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          name?: string;
          permissions?: Json;
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          company_id: string;
          role_id: string;
          meta: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          company_id: string;
          role_id: string;
          meta?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          company_id?: string;
          role_id?: string;
          meta?: Json | null;
          created_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          description: string | null;
          start_date: string | null;
          end_date: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          description?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          description?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          company_id: string;
          uploaded_by_user_id: string;
          pdf_url: string;
          amount: number;
          date: string;
          processed: boolean;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          uploaded_by_user_id: string;
          pdf_url: string;
          amount: number;
          date: string;
          processed?: boolean;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          uploaded_by_user_id?: string;
          pdf_url?: string;
          amount?: number;
          date?: string;
          processed?: boolean;
          metadata?: Json;
          created_at?: string;
        };
      };
      invoice_project_links: {
        Row: {
          id: string;
          invoice_id: string;
          project_id: string;
          linked_by_user_id: string;
          linked_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          project_id: string;
          linked_by_user_id: string;
          linked_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          project_id?: string;
          linked_by_user_id?: string;
          linked_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          target_type: string;
          target_id: string;
          timestamp: string;
          details: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          target_type: string;
          target_id: string;
          timestamp?: string;
          details?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          action?: string;
          target_type?: string;
          target_id?: string;
          timestamp?: string;
          details?: Json | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      project_status: 'planned' | 'active' | 'on_hold' | 'completed' | 'cancelled';
    };
  };
}
