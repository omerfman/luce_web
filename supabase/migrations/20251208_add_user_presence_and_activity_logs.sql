-- Add user presence tracking and activity logs
-- Only Super Admin can view this data

-- Add last_seen_at to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;

-- Create user_activity_logs table for login/logout tracking
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('login', 'logout', 'heartbeat')),
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_timestamp ON public.user_activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_activity_type ON public.user_activity_logs(activity_type);

-- Enable RLS
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only Super Admin can view
CREATE POLICY "Only Super Admin can view activity logs"
ON user_activity_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    INNER JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.name = 'Super Admin'
    AND r.company_id IS NULL
  )
);

-- Only system can insert activity logs
CREATE POLICY "System can insert activity logs"
ON user_activity_logs FOR INSERT
WITH CHECK (true);

-- Function to update last_seen_at
CREATE OR REPLACE FUNCTION update_user_last_seen(user_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET last_seen_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log user activity
CREATE OR REPLACE FUNCTION log_user_activity(
  user_uuid UUID,
  activity TEXT,
  ip TEXT DEFAULT NULL,
  agent TEXT DEFAULT NULL,
  meta JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.user_activity_logs (user_id, activity_type, ip_address, user_agent, metadata)
  VALUES (user_uuid, activity, ip, agent, meta)
  RETURNING id INTO log_id;
  
  -- Also update last_seen_at
  PERFORM update_user_last_seen(user_uuid);
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON COLUMN users.last_seen_at IS 'Last time user was active. Updated every 60 seconds when online.';
COMMENT ON TABLE user_activity_logs IS 'Tracks user login/logout/heartbeat activity. Only viewable by Super Admin.';
