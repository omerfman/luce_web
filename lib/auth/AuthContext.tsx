'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { User, Role, Company, Permission, PermissionRecord } from '@/types';
import { useUserPresence } from '@/lib/hooks/useUserPresence';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  role: Role | null;
  company: Company | null;
  permissions: Permission[];
  isLoading: boolean;
  signOut: () => Promise<void>;
  hasPermission: (resource: string, action: string, scope?: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Track user presence (login/logout/heartbeat)
  useUserPresence(user?.id);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setRole(null);
        setCompany(null);
        setPermissions([]);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserProfile(userId: string) {
    try {
      // Fetch user with role and company
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(
          `
          *,
          role:roles(*),
          company:companies(*)
        `
        )
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      if (userData) {
        setUser(userData as any);
        setRole(userData.role as any);
        setCompany(userData.company as any);
        
        // Combine role permissions with user's custom permissions
        const rolePermissions = (userData.role as any)?.permissions || [];
        const customPermissionIds = userData.meta?.custom_permissions || [];
        
        // Fetch custom permissions if there are any
        let customPermissions: PermissionRecord[] = [];
        if (customPermissionIds.length > 0) {
          const { data: customPerms, error: customPermsError } = await supabase
            .from('permissions')
            .select('*')
            .in('id', customPermissionIds);
          
          // Ignore error if permissions table doesn't exist
          if (!customPermsError && customPerms) {
            customPermissions = customPerms;
          } else if (customPermsError && !customPermsError.message.includes('permissions')) {
            console.warn('Permissions table not found, skipping custom permissions');
          }
        }
        
        // Merge permissions (remove duplicates by id)
        const allPermissions = [...rolePermissions];
        customPermissions.forEach(customPerm => {
          if (!allPermissions.find(p => p.id === customPerm.id)) {
            allPermissions.push(customPerm);
          }
        });
        
        setPermissions(allPermissions);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    // Log logout activity (don't block if this fails)
    if (user?.id) {
      try {
        await supabase.rpc('log_user_activity', {
          user_uuid: user.id,
          activity: 'logout',
          ip: null,
          agent: navigator.userAgent,
          meta: { manual: true },
        });
        
        // Clear session storage
        sessionStorage.removeItem(`user_session_${user.id}`);
      } catch (error) {
        console.error('Error logging logout:', error);
      }
    }
    
    // Clear local state first
    setUser(null);
    setRole(null);
    setCompany(null);
    setPermissions([]);
    
    // Sign out from Supabase (this clears cookies)
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
    
    // Hard redirect to login page (bypasses middleware caching)
    window.location.replace('/login');
  }

  function hasPermission(
    resource: string,
    action: string,
    scope: string = 'company'
  ): boolean {
    if (!permissions || permissions.length === 0) return false;

    return permissions.some((perm) => {
      // Check for wildcard permissions (Super Admin has * *)
      if (perm.resource === '*' && perm.action === '*') {
        return true;
      }

      // Check for specific resource with wildcard action
      if (perm.resource === resource && perm.action === '*') {
        return true;
      }

      // Check for wildcard resource with specific action
      if (perm.resource === '*' && perm.action === action) {
        return true;
      }

      // Check for exact match
      const resourceMatch = perm.resource === resource || perm.resource === '*';
      const actionMatch = perm.action === action || perm.action === 'manage' || perm.action === '*';
      const scopeMatch = perm.scope === scope || perm.scope === 'all';

      return resourceMatch && actionMatch && scopeMatch;
    });
  }

  const value = {
    user,
    supabaseUser,
    role,
    company,
    permissions,
    isLoading,
    signOut,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
