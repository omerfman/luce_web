-- Add offline status detection and logging
-- This will automatically log users as offline if they haven't been active

-- First, add 'offline' to activity types
-- Update user_activity_logs table comment to include offline
COMMENT ON COLUMN user_activity_logs.activity_type IS 'Type of activity: login, logout, or offline';

-- Function to detect and log offline users
-- This function checks for users who are logged in (have session) but inactive
-- and creates an 'offline' log entry for them
CREATE OR REPLACE FUNCTION detect_and_log_offline_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  offline_threshold INTERVAL := '10 minutes';
  user_record RECORD;
  last_logout TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Find users who:
  -- 1. Have last_seen_at older than 10 minutes
  -- 2. Have a login record
  -- 3. Don't have a logout record after their last login
  FOR user_record IN
    SELECT DISTINCT
      u.id,
      u.last_seen_at
    FROM users u
    WHERE u.last_seen_at IS NOT NULL
      AND u.last_seen_at < NOW() - offline_threshold
  LOOP
    -- Check if user has a login record
    SELECT MAX(created_at) INTO last_logout
    FROM user_activity_logs
    WHERE user_id = user_record.id
      AND activity_type = 'logout';
    
    -- Check if there's a login after the last logout (or no logout at all)
    IF EXISTS (
      SELECT 1
      FROM user_activity_logs
      WHERE user_id = user_record.id
        AND activity_type = 'login'
        AND (last_logout IS NULL OR created_at > last_logout)
    ) THEN
      -- Check if we haven't already logged offline for this session
      IF NOT EXISTS (
        SELECT 1
        FROM user_activity_logs
        WHERE user_id = user_record.id
          AND activity_type = 'offline'
          AND (last_logout IS NULL OR created_at > last_logout)
      ) THEN
        -- Log as offline
        INSERT INTO user_activity_logs (user_id, activity_type, ip_address, user_agent, metadata)
        VALUES (
          user_record.id,
          'offline',
          NULL,
          'system',
          jsonb_build_object(
            'detected_at', NOW(),
            'last_seen_at', user_record.last_seen_at,
            'auto_detected', true
          )
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users (needed for RPC)
GRANT EXECUTE ON FUNCTION detect_and_log_offline_users() TO authenticated;

-- Comment
COMMENT ON FUNCTION detect_and_log_offline_users() IS 'Detects users who are offline (inactive > 10 min) and logs them';
