import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = cookies();
    
    // Create Supabase client with user's session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create admin client for user updates (using service_role)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        }
      }
    );

    // Get request body
    const body = await request.json();
    const { 
      user_id, 
      name, 
      email, 
      password, 
      is_active, 
      role_id, 
      company_id,
      added_permissions,
      removed_permissions,
      meta
    } = body;

    // Validate required fields
    if (!user_id || !name || !email || !role_id || !company_id) {
      return NextResponse.json(
        { error: 'Gerekli alanlar eksik' },
        { status: 400 }
      );
    }

    // Check if current user has permission to update users
    const { data: currentUser } = await supabase
      .from('users')
      .select('role:roles(*), company_id')
      .eq('id', session.user.id)
      .single();

    if (!currentUser || !currentUser.role) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
    }

    // Check permissions
    const userRole = currentUser.role as any;
    const permissions = Array.isArray(userRole.permissions) ? userRole.permissions : [];
    
    const hasGlobalPermission = permissions.some(
      (p: any) => p.resource === '*' && p.action === '*'
    );
    const hasUserUpdatePermission = permissions.some(
      (p: any) =>
        (p.resource === 'users' || p.resource === '*') &&
        (p.action === 'update' || p.action === '*')
    );

    if (!hasGlobalPermission && !hasUserUpdatePermission) {
      return NextResponse.json(
        { error: 'Kullanıcı güncelleme yetkiniz yok' },
        { status: 403 }
      );
    }

    // Get the user being edited
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('company_id, email')
      .eq('id', user_id)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: 'Düzenlenecek kullanıcı bulunamadı' }, { status: 404 });
    }

    // If not super admin, can only update users in same company
    if (!hasGlobalPermission && currentUser.company_id !== targetUser.company_id) {
      return NextResponse.json(
        { error: 'Sadece kendi şirketinizdeki kullanıcıları güncelleyebilirsiniz' },
        { status: 403 }
      );
    }

    // Update email if changed
    if (email !== targetUser.email) {
      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { email }
      );

      if (emailError) {
        console.error('Email update error:', emailError);
        return NextResponse.json(
          { error: 'E-posta güncellenemedi: ' + emailError.message },
          { status: 400 }
        );
      }
    }

    // Update password if provided
    if (password && password.trim() !== '') {
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { password }
      );

      if (passwordError) {
        console.error('Password update error:', passwordError);
        return NextResponse.json(
          { error: 'Şifre güncellenemedi: ' + passwordError.message },
          { status: 400 }
        );
      }
    }

    // Prepare meta object
    const updatedMeta = {
      ...meta,
      added_permissions: added_permissions || [],
      removed_permissions: removed_permissions || [],
    };

    // Update user profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .update({
        name,
        email,
        is_active: is_active !== undefined ? is_active : true,
        role_id,
        company_id,
        meta: updatedMeta,
      })
      .eq('id', user_id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      return NextResponse.json(
        { 
          error: 'Kullanıcı profili güncellenemedi',
          details: profileError.message
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Kullanıcı başarıyla güncellendi',
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message || 'Bir hata oluştu' },
      { status: 500 }
    );
  }
}
