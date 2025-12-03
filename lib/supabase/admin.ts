/**
 * Supabase Admin Utilities
 * 
 * Server-side utilities for database operations using service role key
 * NEVER import this file in client-side code!
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

/**
 * Supabase Admin Client
 * Uses service_role key - bypasses RLS policies
 * Use with extreme caution!
 */
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Execute raw SQL query
 * @param sql - SQL query string
 * @returns Query result
 */
// export async function executeSQL(sql: string) {
//   const { data, error } = await supabaseAdmin.rpc('exec_sql', { query: sql });
  
//   if (error) {
//     throw new Error(`SQL execution failed: ${error.message}`);
//   }
  
//   return data;
// }

/**
 * Assign user to company and role
 * @param email - User email
 * @param companyName - Company name
 * @param roleName - Role name
 */
export async function assignUserRole(
  email: string,
  companyName: string = 'Luce Mimarlık',
  roleName: string = 'Super Admin'
) {
  try {
    // Get company ID
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('name', companyName)
      .single();

    if (companyError) throw companyError;

    // Get role ID
    const { data: role, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .single();

    if (roleError) throw roleError;

    // Get user from auth
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    const authUser = authUsers.users.find(u => u.email === email);
    if (!authUser) throw new Error(`User with email ${email} not found in auth.users`);

    // Check if user profile exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', authUser.id)
      .single();

    if (existingUser) {
      // Update existing user
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          company_id: company.id,
          role_id: role.id,
          is_active: true,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', authUser.id);

      if (updateError) throw updateError;
      
      console.log(`✅ User ${email} updated successfully`);
    } else {
      // Create new user profile
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUser.id,
          company_id: company.id,
          role_id: role.id,
          name: authUser.user_metadata?.full_name || email.split('@')[0],
          email: email,
          is_active: true,
        } as any);

      if (insertError) throw insertError;
      
      console.log(`✅ User ${email} created successfully`);
    }

    return {
      success: true,
      userId: authUser.id,
      companyId: company.id,
      roleId: role.id,
    };
  } catch (error: any) {
    console.error('❌ Error assigning user role:', error.message);
    throw error;
  }
}

/**
 * Create a new company
 * @param name - Company name
 * @param data - Additional company data
 */
export async function createCompany(
  name: string,
  data?: {
    tax_number?: string;
    address?: string;
    phone?: string;
    email?: string;
  }
) {
  const { data: company, error } = await supabaseAdmin
    .from('companies')
    .insert({
      name,
      tax_number: data?.tax_number || '',
      address: data?.address || '',
      phone: data?.phone || '',
      email: data?.email || '',
    } as any)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create company: ${error.message}`);
  }

  console.log(`✅ Company "${name}" created with ID: ${company.id}`);
  return company;
}

/**
 * List all users in a company
 * @param companyId - Company UUID
 */
export async function listCompanyUsers(companyId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select(`
      *,
      company:companies(name),
      role:roles(name, permissions)
    `)
    .eq('company_id', companyId);

  if (error) throw error;
  return data;
}

/**
 * Deactivate a user
 * @param userId - User UUID
 */
export async function deactivateUser(userId: string) {
  const { error } = await supabaseAdmin
    .from('users')
    .update({ is_active: false } as any)
    .eq('id', userId);

  if (error) throw error;
  
  console.log(`✅ User ${userId} deactivated`);
}
