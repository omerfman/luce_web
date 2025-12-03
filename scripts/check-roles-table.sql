-- Check roles table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'roles' 
ORDER BY ordinal_position;
