// User Presence and Activity Tracking Hook
// Only updates when user is logged in

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

const HEARTBEAT_INTERVAL = 60000; // 60 seconds
const ONLINE_THRESHOLD = 120000; // 2 minutes (if last_seen > 2 min, consider offline)

export function useUserPresence(userId: string | undefined) {
  const hasLoggedRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserIdRef = useRef<string | undefined>(userId);

  const updatePresence = useCallback(async () => {
    if (!currentUserIdRef.current) return;

    try {
      // Update last_seen_at via RPC (without logging)
      await supabase.rpc('update_user_last_seen', { user_uuid: currentUserIdRef.current });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }, []);

  const logActivity = useCallback(async (
    activityType: 'login' | 'logout' | 'offline',
    metadata?: Record<string, any>
  ) => {
    if (!currentUserIdRef.current) return;

    try {
      await supabase.rpc('log_user_activity', {
        user_uuid: currentUserIdRef.current,
        activity: activityType,
        ip: null,
        agent: navigator.userAgent,
        meta: metadata || null,
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }, []);

  useEffect(() => {
    currentUserIdRef.current = userId;
    
    if (!userId) return;

    const sessionKey = `user_session_${userId}`;
    
    // Only log login once per browser session
    if (!hasLoggedRef.current && !sessionStorage.getItem(sessionKey)) {
      hasLoggedRef.current = true;
      sessionStorage.setItem(sessionKey, 'true');
      logActivity('login', { page: window.location.pathname });
    }

    // Start heartbeat interval (only updates last_seen, no logging)
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        updatePresence();
      }, HEARTBEAT_INTERVAL);
    }
  }, [userId]); // Only depend on userId, callbacks are stable

  // Cleanup interval when component unmounts completely
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return { updatePresence, logActivity };
}

// Utility function to determine if user is online
export function isUserOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  
  const lastSeen = new Date(lastSeenAt).getTime();
  const now = Date.now();
  
  return (now - lastSeen) < ONLINE_THRESHOLD;
}

// Get user status
export function getUserStatus(lastSeenAt: string | null): 'online' | 'away' | 'offline' {
  if (!lastSeenAt) return 'offline';
  
  const lastSeen = new Date(lastSeenAt).getTime();
  const now = Date.now();
  const diff = now - lastSeen;
  
  if (diff < ONLINE_THRESHOLD) return 'online'; // < 2 minutes
  if (diff < 300000) return 'away'; // < 5 minutes
  return 'offline';
}
