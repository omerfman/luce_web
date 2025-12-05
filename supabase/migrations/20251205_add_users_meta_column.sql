-- Add meta column to users table for storing custom permissions
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN public.users.meta IS 'User metadata including custom_permissions array';

-- Create index for faster JSON queries on meta column
CREATE INDEX IF NOT EXISTS idx_users_meta ON public.users USING GIN (meta);

-- Example meta structure:
-- {
--   "custom_permissions": [
--     {"resource": "invoices", "action": "create", "scope": "company"},
--     {"resource": "projects", "action": "update", "scope": "own"}
--   ]
-- }
