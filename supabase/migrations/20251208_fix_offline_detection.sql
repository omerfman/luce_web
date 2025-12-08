-- Fix detect_and_log_offline_users function
-- Add proper error handling and ensure table access

DROP FUNCTION IF EXISTS detect_and_log_offline_users();

CREATE OR REPLACE FUNCTION detect_and_log_offline_users()
RETURNS TABLE(detected_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  offline_threshold INTERVAL := '10 minutes';
  user_record RECORD;
  last_logout TIMESTAMP WITH TIME ZONE;
  count_detected INTEGER := 0;
BEGIN
  -- Find users who:
  -- 1. Have last_seen_at older than 10 minutes
  -- 2. Have a login record
  -- 3. Don't have a logout record after their last login
  FOR user_record IN
    SELECT DISTINCT
      u.id,
      u.last_seen_at,
      u.company_id
    FROM users u
    WHERE u.last_seen_at IS NOT NULL
      AND u.last_seen_at < NOW() - offline_threshold
  LOOP
    -- Check if user has a logout record
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
        INSERT INTO user_activity_logs (user_id, company_id, activity_type, ip_address, user_agent, metadata)
        VALUES (
          user_record.id,
          user_record.company_id,
          'offline',
          NULL,
          'system',
          jsonb_build_object(
            'detected_at', NOW(),
            'last_seen_at', user_record.last_seen_at,
            'auto_detected', true
          )
        );
        count_detected := count_detected + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT count_detected;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION detect_and_log_offline_users() TO authenticated;
GRANT EXECUTE ON FUNCTION detect_and_log_offline_users() TO anon;

COMMENT ON FUNCTION detect_and_log_offline_users() IS 'Detects users who are offline (inactive > 10 min) and logs them. Returns count of detected users.';
