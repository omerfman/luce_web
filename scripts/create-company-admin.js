require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createCompanyAdmin() {
  try {
    console.log('\n🔄 Creating Company Admin user...\n');

    // Step 1: Get or create test company
    let { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('name', 'Test Şirketi')
      .single();

    if (companyError || !company) {
      console.log('📦 Creating Test Şirketi...');
      const { data: newCompany, error: createError } = await supabase
        .from('companies')
        .insert({ name: 'Test Şirketi', is_active: true })
        .select()
        .single();
      
      if (createError) throw createError;
      company = newCompany;
      console.log('✅ Company created:', company.name);
    } else {
      console.log('✅ Company found:', company.name);
    }

    // Step 2: Get Company Admin role
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id, name, permissions')
      .eq('name', 'Company Admin')
      .single();

    if (roleError || !role) {
      throw new Error('Company Admin role not found! Run initial setup first.');
    }
    console.log('✅ Role found:', role.name);
    console.log('   Permissions:', JSON.stringify(role.permissions, null, 2));

    // Step 3: Create user in Supabase Auth
    const email = 'admin@testcompany.com';
    const password = 'test123456';
    const name = 'Test Company Admin';

    console.log('\n👤 Creating auth user:', email);
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name
      }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('⚠️  User already exists in Auth, updating profile...');
        
        // Get existing user
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const user = existingUser.users.find(u => u.email === email);
        
        if (user) {
          // Update user profile
          const { error: updateError } = await supabase
            .from('users')
            .update({
              role_id: role.id,
              company_id: company.id,
              name,
              is_active: true
            })
            .eq('id', user.id);

          if (updateError) throw updateError;
          
          console.log('✅ User profile updated');
          console.log('\n' + '='.repeat(60));
          console.log('✅ COMPANY ADMIN READY!');
          console.log('='.repeat(60));
          console.log('Email:', email);
          console.log('Password:', password);
          console.log('Company:', company.name);
          console.log('Role:', role.name);
          console.log('='.repeat(60));
          console.log('\n🔗 Login: http://localhost:3000/login\n');
          return;
        }
      }
      throw authError;
    }

    console.log('✅ Auth user created');

    // Step 4: Create or update user profile
    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        id: authData.user.id,
        email,
        name,
        role_id: role.id,
        company_id: company.id,
        is_active: true
      });

    if (profileError) throw profileError;

    console.log('✅ User profile created');
    console.log('\n' + '='.repeat(60));
    console.log('✅ COMPANY ADMIN CREATED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Company:', company.name);
    console.log('Role:', role.name);
    console.log('User ID:', authData.user.id);
    console.log('='.repeat(60));
    console.log('\n🔗 Login: http://localhost:3000/login\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

createCompanyAdmin();
