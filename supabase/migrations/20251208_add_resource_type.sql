-- Add resource_type column to project_files table
ALTER TABLE project_files
ADD COLUMN IF NOT EXISTS cloudinary_resource_type TEXT DEFAULT 'raw';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_project_files_resource_type 
ON project_files(cloudinary_resource_type);

-- Update existing records to 'raw' (for PDFs and documents)
UPDATE project_files 
SET cloudinary_resource_type = 'raw' 
WHERE cloudinary_resource_type IS NULL;
