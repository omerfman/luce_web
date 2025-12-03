#!/usr/bin/env node

/**
 * User Management CLI
 * 
 * Usage:
 *   node scripts/manage-users.js assign-role user@example.com "Super Admin"
 *   node scripts/manage-users.js create-user user@example.com "password123" "User Name" "Admin"
 *   node scripts/manage-users.js create-company "New Company"
 *   node scripts/manage-users.js list-users
 *   node scripts/manage-users.js reset-password user@example.com "newpassword123"
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// ============================================================================
// ASSIGN USER ROLE
// ============================================================================

async function assignUserRole(email, roleName = 'Super Admin', companyName = 'Luce Mimarlık') {
  try {
    console.log(`\n🔄 Assigning role to ${email}...`);

    // Get company
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .eq('name', companyName)
      .single();

    if (companyError) {
      console.error('❌ Company not found:', companyName);
      return;
    }

    console.log(`✅ Company found: ${company.name}`);

    // Get role
    const { data: role, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id, name')
      .eq('name', roleName)
      .single();

    if (roleError) {
      console.error('❌ Role not found:', roleName);
      return;
    }

    console.log(`✅ Role found: ${role.name}`);

    // Get user from auth
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    const authUser = authUsers.users.find(u => u.email === email);
    if (!authUser) {
      console.error(`❌ User ${email} not found in auth.users`);
      console.log('\n💡 User must login at least once before assigning role');
      return;
    }

    console.log(`✅ User found in auth: ${authUser.id}`);

    // Check if user profile exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', authUser.id)
      .single();

    if (existingUser) {
      // Update
      await supabaseAdmin
        .from('users')
        .update({
          company_id: company.id,
          role_id: role.id,
          is_active: true,
        })
        .eq('id', authUser.id);

      console.log('✅ User profile updated');
    } else {
      // Insert
      await supabaseAdmin
        .from('users')
        .insert({
          id: authUser.id,
          company_id: company.id,
          role_id: role.id,
          name: authUser.user_metadata?.full_name || email.split('@')[0],
          email: email,
          is_active: true,
        });

      console.log('✅ User profile created');
    }

    console.log('\n================================================');
    console.log('✅ SUCCESS!');
    console.log('================================================');
    console.log(`Email: ${email}`);
    console.log(`Company: ${company.name}`);
    console.log(`Role: ${role.name}`);
    console.log('\n🔄 User should logout and login again to see changes');
    console.log('================================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// ============================================================================
// CREATE COMPANY
// ============================================================================

async function createCompany(name, taxNumber, address, phone, email) {
  try {
    console.log(`\n🔄 Creating company: ${name}...`);

    const { data, error } = await supabaseAdmin
      .from('companies')
      .insert({
        name,
        tax_number: taxNumber || '',
        address: address || '',
        phone: phone || '',
        email: email || '',
      })
      .select()
      .single();

    if (error) throw error;

    console.log('\n================================================');
    console.log('✅ COMPANY CREATED!');
    console.log('================================================');
    console.log(`ID: ${data.id}`);
    console.log(`Name: ${data.name}`);
    console.log('================================================\n');

    return data;
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// ============================================================================
// LIST USERS
// ============================================================================

async function listUsers(companyName = 'Luce Mimarlık') {
  try {
    console.log(`\n📋 Listing users for: ${companyName}\n`);

    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('name', companyName)
      .single();

    if (!company) {
      console.error('❌ Company not found');
      return;
    }

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        name,
        email,
        is_active,
        role:roles(name),
        created_at
      `)
      .eq('company_id', company.id);

    if (error) throw error;

    console.table(users.map(u => ({
      Email: u.email,
      Name: u.name,
      Role: u.role?.name,
      Active: u.is_active ? '✅' : '❌',
      Created: new Date(u.created_at).toLocaleDateString(),
    })));

    console.log(`\nTotal users: ${users.length}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// ============================================================================
// CREATE USER WITH PASSWORD
// ============================================================================

async function createUser(email, password, name, roleName = 'Görüntüleyici', companyName = 'Luce Mimarlık') {
  try {
    console.log(`\n🔄 Creating user: ${email}...`);

    // Get company
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .eq('name', companyName)
      .single();

    if (companyError) {
      console.error('❌ Company not found:', companyName);
      return;
    }

    console.log(`✅ Company found: ${company.name}`);

    // Get role
    const { data: role, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id, name')
      .eq('name', roleName)
      .single();

    if (roleError) {
      console.error('❌ Role not found:', roleName);
      return;
    }

    console.log(`✅ Role found: ${role.name}`);

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: name,
      },
    });

    if (authError) throw authError;

    console.log(`✅ Auth user created: ${authData.user.id}`);

    // Create user profile
    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      company_id: company.id,
      role_id: role.id,
      name: name,
      email: email,
      is_active: true,
    });

    if (profileError) throw profileError;

    console.log('\n================================================');
    console.log('✅ USER CREATED SUCCESSFULLY!');
    console.log('================================================');
    console.log(`Email: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`Password: ${password}`);
    console.log(`Company: ${company.name}`);
    console.log(`Role: ${role.name}`);
    console.log('\n🔐 User can login immediately with email/password');
    console.log('================================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// ============================================================================
// RESET USER PASSWORD
// ============================================================================

async function resetPassword(email, newPassword) {
  try {
    console.log(`\n🔄 Resetting password for: ${email}...`);

    // Get user from auth
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    const authUser = authUsers.users.find(u => u.email === email);
    if (!authUser) {
      console.error(`❌ User ${email} not found`);
      return;
    }

    console.log(`✅ User found: ${authUser.id}`);

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: newPassword }
    );

    if (updateError) throw updateError;

    console.log('\n================================================');
    console.log('✅ PASSWORD RESET SUCCESSFUL!');
    console.log('================================================');
    console.log(`Email: ${email}`);
    console.log(`New Password: ${newPassword}`);
    console.log('\n🔐 User can login with new password immediately');
    console.log('================================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// ============================================================================
// CLI
// ============================================================================

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'assign-role':
    if (args.length < 1) {
      console.log('Usage: node scripts/manage-users.js assign-role <email> [role] [company]');
      console.log('Example: node scripts/manage-users.js assign-role user@example.com "Super Admin"');
      process.exit(1);
    }
    assignUserRole(args[0], args[1], args[2]);
    break;

  case 'create-user':
    if (args.length < 3) {
      console.log('Usage: node scripts/manage-users.js create-user <email> <password> <name> [role] [company]');
      console.log('Example: node scripts/manage-users.js create-user user@example.com "password123" "John Doe" "Admin"');
      process.exit(1);
    }
    createUser(args[0], args[1], args[2], args[3], args[4]);
    break;

  case 'reset-password':
    if (args.length < 2) {
      console.log('Usage: node scripts/manage-users.js reset-password <email> <new-password>');
      console.log('Example: node scripts/manage-users.js reset-password user@example.com "newpassword123"');
      process.exit(1);
    }
    resetPassword(args[0], args[1]);
    break;

  case 'create-company':
    if (args.length < 1) {
      console.log('Usage: node scripts/manage-users.js create-company <name> [tax_number] [address] [phone] [email]');
      process.exit(1);
    }
    createCompany(args[0], args[1], args[2], args[3], args[4]);
    break;

  case 'list-users':
    listUsers(args[0]);
    break;

  default:
    console.log('\n📋 Luce Mimarlık - User Management CLI\n');
    console.log('Available commands:\n');
    console.log('  create-user <email> <password> <name> [role] [company]');
    console.log('    Create a new user with email/password');
    console.log('    Example: node scripts/manage-users.js create-user user@luce.com "pass123" "John Doe" "Admin"\n');
    console.log('  assign-role <email> [role] [company]');
    console.log('    Assign user to company and role');
    console.log('    Example: node scripts/manage-users.js assign-role user@example.com "Admin"\n');
    console.log('  reset-password <email> <new-password>');
    console.log('    Reset user password');
    console.log('    Example: node scripts/manage-users.js reset-password user@example.com "newpass123"\n');
    console.log('  create-company <name> [tax_number] [address] [phone] [email]');
    console.log('    Create a new company');
    console.log('    Example: node scripts/manage-users.js create-company "New Company"\n');
    console.log('  list-users [company]');
    console.log('    List all users in a company');
    console.log('    Example: node scripts/manage-users.js list-users\n');
}
