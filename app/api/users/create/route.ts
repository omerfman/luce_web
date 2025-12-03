import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
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

    // Create admin client for user creation (using regular client with service_role)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get request body
    const body = await request.json();
    const { email, password, name, role_id, company_id } = body;

    // Validate required fields
    if (!email || !password || !name || !role_id || !company_id) {
      return NextResponse.json(
        { error: 'Tüm alanları doldurun' },
        { status: 400 }
      );
    }

    // Check if current user has permission to create users
    const { data: currentUser } = await supabase
      .from('users')
      .select('role:roles(*), company_id')
      .eq('id', session.user.id)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permissions
    const hasGlobalPermission = currentUser.role?.permissions?.some(
      (p: any) => p.resource === '*' && p.action === '*'
    );
    const hasUserCreatePermission = currentUser.role?.permissions?.some(
      (p: any) =>
        (p.resource === 'users' || p.resource === '*') &&
        (p.action === 'create' || p.action === '*')
    );

    if (!hasGlobalPermission && !hasUserCreatePermission) {
      return NextResponse.json(
        { error: 'Kullanıcı oluşturma yetkiniz yok' },
        { status: 403 }
      );
    }

    // If not super admin, can only create users in same company
    if (!hasGlobalPermission && currentUser.company_id !== company_id) {
      return NextResponse.json(
        { error: 'Sadece kendi şirketinizde kullanıcı oluşturabilirsiniz' },
        { status: 403 }
      );
    }

    // Create user in Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
        },
      });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: authError.message || 'Kullanıcı oluşturulamadı' },
        { status: 400 }
      );
    }

    // Create user profile
    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      email,
      name,
      role_id,
      company_id,
      is_active: true,
    });

    if (profileError) {
      console.error('Profile error:', profileError);
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Kullanıcı profili oluşturulamadı' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email,
        name,
      },
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error.message || 'Bir hata oluştu' },
      { status: 500 }
    );
  }
}
