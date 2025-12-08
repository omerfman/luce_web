import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Get user ID before logout (for logging)
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  // Sign out from Supabase (this will clear server-side cookies)
  await supabase.auth.signOut();

  // Log the logout activity if we have userId
  if (userId) {
    try {
      await supabase.rpc('log_user_activity', {
        user_uuid: userId,
        activity: 'logout',
        ip: null,
        agent: request.headers.get('user-agent'),
        meta: { manual: true },
      });
    } catch (error) {
      console.error('Error logging logout:', error);
    }
  }

  return NextResponse.json({ success: true });
}
