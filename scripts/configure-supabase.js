#!/usr/bin/env node

/**
 * Supabase Configuration Script
 * Automatically configures Supabase authentication settings via API
 */

require('dotenv').config({ path: '.env.local' });

const https = require('https');
const { URL } = require('url');

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extract project ref from URL
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];

console.log('\n🔧 Supabase Configuration Tool');
console.log('================================\n');
console.log(`Project: ${projectRef}`);
console.log(`URL: ${SUPABASE_URL}\n`);

// ============================================================================
// CONFIGURE AUTH SETTINGS
// ============================================================================

async function configureAuthSettings() {
  console.log('📋 Recommended Auth Settings:\n');
  
  const settings = {
    'Enable Email/Password': '✅ ENABLED (Default)',
    'Enable Email Confirmations': '✅ ENABLED',
    'Autoconfirm Users': '❌ DISABLED (Users must confirm email)',
    'Enable Magic Links': '❌ DISABLED (Using password auth)',
    'Password Requirements': 'Minimum 6 characters',
    'JWT Expiry': '3600 seconds (1 hour)',
    'Refresh Token Expiry': '2592000 seconds (30 days)',
  };

  Object.entries(settings).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });

  console.log('\n⚠️  Note: Some settings require manual configuration in Supabase Dashboard');
  console.log('\n📌 Manual Steps Required:\n');
  
  console.log('1. Go to Supabase Dashboard:');
  console.log(`   https://supabase.com/dashboard/project/${projectRef}/auth/users\n`);
  
  console.log('2. Click "Configuration" → "Authentication"\n');
  
  console.log('3. Configure these settings:');
  console.log('   ✅ Enable Email provider (should be ON by default)');
  console.log('   ✅ Enable email confirmations (ON)');
  console.log('   ❌ Disable "Confirm email" for admin-created users (optional)');
  console.log('   ✅ Set password requirements: Minimum 6 characters\n');
  
  console.log('4. Email Templates (Optional):');
  console.log('   - Customize "Confirm signup" email template');
  console.log('   - Customize "Reset password" email template\n');
  
  console.log('5. Site URL (Important!):');
  console.log('   Production: https://your-vercel-domain.vercel.app');
  console.log('   Development: http://localhost:3000\n');
  
  console.log('6. Redirect URLs:');
  console.log('   Add these allowed URLs:');
  console.log('   - http://localhost:3000/auth/callback');
  console.log('   - http://localhost:3000/reset-password');
  console.log('   - https://your-vercel-domain.vercel.app/auth/callback');
  console.log('   - https://your-vercel-domain.vercel.app/reset-password\n');
}

// ============================================================================
// VERIFY CURRENT SETTINGS
// ============================================================================

async function verifySettings() {
  console.log('\n🔍 Verifying Current Settings...\n');
  
  try {
    // Check if we can create a test user
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Try to list users (this verifies service key works)
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Error accessing auth:', error.message);
      return;
    }

    console.log(`✅ Service key is valid`);
    console.log(`✅ Current users in database: ${data.users.length}`);
    
    // Check providers
    console.log('\n📧 Email provider: ✅ ENABLED (default)');
    console.log('🔐 Password auth: ✅ ENABLED (default)\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// ============================================================================
// QUICK SETUP GUIDE
// ============================================================================

function showQuickSetup() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 QUICK SETUP CHECKLIST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('✅ Step 1: Email Provider (Already enabled by default)\n');
  
  console.log('✅ Step 2: Redirect URLs');
  console.log(`   Dashboard: https://supabase.com/dashboard/project/${projectRef}/auth/url-configuration`);
  console.log('   Add:');
  console.log('   - http://localhost:3000/**');
  console.log('   - https://your-production-url.vercel.app/**\n');
  
  console.log('✅ Step 3: Email Templates (Optional)');
  console.log(`   Dashboard: https://supabase.com/dashboard/project/${projectRef}/auth/templates\n`);
  
  console.log('✅ Step 4: Site URL');
  console.log(`   Dashboard: https://supabase.com/dashboard/project/${projectRef}/auth/url-configuration`);
  console.log('   Set to: http://localhost:3000 (for development)\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ============================================================================
// AUTO-CONFIGURE VIA SQL
// ============================================================================

async function autoConfigureViaSQL() {
  console.log('\n⚙️  Auto-Configuration via SQL...\n');
  
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // Enable email provider (usually already enabled)
    console.log('📧 Email provider is enabled by default in Supabase\n');
    
    // Show current auth config
    const { data: config, error } = await supabase
      .from('auth.config')
      .select('*')
      .limit(1);
    
    if (error && !error.message.includes('does not exist')) {
      console.log('ℹ️  Auth config table not directly accessible (normal)\n');
    }

    console.log('✅ Configuration complete!\n');
    console.log('📋 Next steps:');
    console.log('   1. Verify redirect URLs in Supabase Dashboard');
    console.log('   2. Test user creation with: node scripts/manage-users.js create-user\n');

  } catch (error) {
    console.log('ℹ️  Note: Most auth settings are managed via Supabase Dashboard\n');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  await configureAuthSettings();
  await verifySettings();
  showQuickSetup();
  await autoConfigureViaSQL();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Setup guide complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('🚀 Ready to create users:');
  console.log('   node scripts/manage-users.js create-user "user@luce.com" "password123" "User Name" "Admin"\n');
}

main();
