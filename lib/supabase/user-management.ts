/**
 * User Management Utilities - Extended
 * 
 * Additional functions for password-based authentication
 */

import { supabaseAdmin } from './admin';

/**
 * Create a new user with email/password
 * @param email - User email
 * @param password - User password
 * @param userData - Additional user data
 */
export async function createUserWithPassword(
  email: string,
  password: string,
  userData: {
    name: string;
    companyName?: string;
    roleName?: string;
  }
) {
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: userData.name,
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    console.log(`✅ Auth user created: ${authData.user.id}`);

    // Get company
    const companyName = userData.companyName || 'Luce Mimarlık';
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('name', companyName)
      .single();

    if (companyError) throw new Error(`Company "${companyName}" not found`);

    // Get role
    const roleName = userData.roleName || 'Görüntüleyici';
    const { data: role, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .single();

    if (roleError) throw new Error(`Role "${roleName}" not found`);

    // Create user profile
    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      company_id: company.id,
      role_id: role.id,
      name: userData.name,
      email: email,
      is_active: true,
    });

    if (profileError) throw profileError;

    console.log(`✅ User profile created for ${email}`);
    console.log(`   Company: ${companyName}`);
    console.log(`   Role: ${roleName}`);

    return {
      success: true,
      userId: authData.user.id,
      email: email,
    };
  } catch (error: any) {
    console.error('❌ Error creating user:', error.message);
    throw error;
  }
}

/**
 * Update user password (admin action)
 * @param userId - User UUID
 * @param newPassword - New password
 */
export async function updateUserPassword(userId: string, newPassword: string) {
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) throw error;

    console.log(`✅ Password updated for user: ${userId}`);
  } catch (error: any) {
    console.error('❌ Error updating password:', error.message);
    throw error;
  }
}

/**
 * Delete user (both auth and profile)
 * @param userId - User UUID
 */
export async function deleteUser(userId: string) {
  try {
    // Delete from auth (will cascade to users table due to FK)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) throw error;

    console.log(`✅ User deleted: ${userId}`);
  } catch (error: any) {
    console.error('❌ Error deleting user:', error.message);
    throw error;
  }
}

/**
 * Get user by email
 * @param email - User email
 */
export async function getUserByEmail(email: string) {
  try {
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = authData.users.find((u) => u.email === email);

    if (!authUser) return null;

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select(
        `
        *,
        company:companies(id, name),
        role:roles(id, name, permissions)
      `
      )
      .eq('id', authUser.id)
      .single();

    return {
      id: authUser.id,
      email: authUser.email,
      created_at: authUser.created_at,
      profile,
    };
  } catch (error: any) {
    console.error('❌ Error getting user:', error.message);
    throw error;
  }
}
