import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Server-side permission check
 * Use this in API routes to verify user permissions
 */
export async function checkServerPermission(
  request: NextRequest,
  resource: string,
  action: string,
  scope: string = 'company'
): Promise<{ authorized: boolean; user?: any; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Get current user
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return { authorized: false, error: 'Not authenticated' };
    }

    // Get user with role and permissions
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(
        `
        *,
        role:roles(*)
      `
      )
      .eq('id', session.user.id)
      .single();

    if (userError || !user) {
      return { authorized: false, error: 'User not found' };
    }

    // Check permission
    const permissions = (user.role as any)?.permissions || [];
    const hasPermission = permissions.some((perm: any) => {
      const resourceMatch = perm.resource === resource;
      const actionMatch = perm.action === action || perm.action === 'manage';
      const scopeMatch = perm.scope === scope || perm.scope === 'all';

      return resourceMatch && actionMatch && scopeMatch;
    });

    if (!hasPermission) {
      return { authorized: false, error: 'Insufficient permissions' };
    }

    return { authorized: true, user };
  } catch (error) {
    console.error('Permission check error:', error);
    return { authorized: false, error: 'Permission check failed' };
  }
}

/**
 * Middleware wrapper for API routes with permission check
 */
export function withPermission(
  resource: string,
  action: string,
  scope: string = 'company'
) {
  return async (
    request: NextRequest,
    handler: (request: NextRequest, user: any) => Promise<NextResponse>
  ) => {
    const permissionCheck = await checkServerPermission(request, resource, action, scope);

    if (!permissionCheck.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: permissionCheck.error || 'Unauthorized',
        },
        { status: 403 }
      );
    }

    return handler(request, permissionCheck.user);
  };
}

/**
 * Get current authenticated user from server
 */
export async function getCurrentUser() {
  try {
    const supabase = await createServerClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return null;

    const { data: user } = await supabase
      .from('users')
      .select(
        `
        *,
        role:roles(*),
        company:companies(*)
      `
      )
      .eq('id', session.user.id)
      .single();

    return user;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}
