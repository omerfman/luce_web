import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Environment variables validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Supabase client for client-side operations
 * Uses @supabase/ssr for proper cookie handling with middleware
 * Uses anon key - respects RLS policies
 */
export const supabase = createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);

/**
 * Server-side Supabase client
 * Should only be used in API routes or server components
 * Uses service role key - bypasses RLS (use with caution)
 */
export const createServerClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient<Database>(supabaseUrl!, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
