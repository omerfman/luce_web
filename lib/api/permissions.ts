/**
 * API Permission Helper
 * API route'larında kullanılacak yetkilendirme fonksiyonları
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkPermission, isSuperAdmin } from '@/lib/permissions';
import { Permission } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface AuthContext {
  user: any;
  userId: string;
  companyId: string;
  permissions: Permission[];
}

/**
 * API route'larında authentication ve permission kontrolü
 */
export async function checkApiPermission(
  request: NextRequest,
  resource: string,
  action: string,
  scope: string = 'company'
): Promise<{ authorized: true; context: AuthContext } | { authorized: false; response: NextResponse }> {
  try {
    // 1. Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return {
        authorized: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return {
        authorized: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      };
    }

    // 2. Get user's company and permissions
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        company_id,
        role:roles!role_id (
          permissions
        )
      `)
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return {
        authorized: false,
        response: NextResponse.json({ error: 'User not found' }, { status: 404 })
      };
    }

    const permissions: Permission[] = (userData.role as any)?.permissions || [];
    
    // Filter out invalid permissions
    const validPermissions = permissions.filter(p => 
      p && p.resource && p.action && p.scope
    );
    
    // 3. Check permission
    // Super admin her zaman yetkilidir
    const isSuper = isSuperAdmin(validPermissions);
    
    // Debug logging
    console.log('🔐 [API Permission Check]', {
      userId: user.id,
      resource,
      action,
      scope,
      totalPermissions: permissions.length,
      validPermissions: validPermissions.length,
      permissions: validPermissions.map(p => `${p.resource}.${p.action}.${p.scope}`),
      isSuperAdmin: isSuper
    });
    
    const hasPermission = isSuper || checkPermission(validPermissions, resource, action, scope);
    
    if (!hasPermission) {
      console.log('❌ [API Permission] Access denied', {
        userId: user.id,
        resource,
        action,
        isSuperAdmin: isSuper
      });
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Bu işlem için yetkiniz bulunmamaktadır' },
          { status: 403 }
        )
      };
    }
    
    console.log('✅ [API Permission] Access granted', {
      userId: user.id,
      resource,
      action,
      isSuperAdmin: isSuper
    });

    // 4. Return authorized context
    return {
      authorized: true,
      context: {
        user,
        userId: user.id,
        companyId: userData.company_id,
        permissions
      }
    };

  } catch (error: any) {
    console.error('Permission check error:', error);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    };
  }
}

/**
 * Basitleştirilmiş authentication check (permission olmadan)
 * Legacy API'ler için
 */
export async function checkAuth(
  request: NextRequest
): Promise<{ authorized: true; user: any; companyId: string } | { authorized: false; response: NextResponse }> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return {
        authorized: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return {
        authorized: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      };
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return {
        authorized: false,
        response: NextResponse.json({ error: 'User not found' }, { status: 404 })
      };
    }

    return {
      authorized: true,
      user,
      companyId: userData.company_id
    };
  } catch (error: any) {
    console.error('Auth check error:', error);
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    };
  }
}
