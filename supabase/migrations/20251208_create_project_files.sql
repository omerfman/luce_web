-- Create project_files table for technical office documents
-- This table stores all project-related files (CAD drawings, PDFs, images, etc.)

CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'statik',
    'mimari', 
    'mekanik',
    'elektrik',
    'zemin_etudu',
    'geoteknik',
    'ic_tasarim',
    '3d'
  )),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  cloudinary_public_id TEXT,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_project_files_project_id ON project_files(project_id);
CREATE INDEX idx_project_files_category ON project_files(category);
CREATE INDEX idx_project_files_company_id ON project_files(company_id);
CREATE INDEX idx_project_files_uploaded_by ON project_files(uploaded_by);

-- Enable RLS
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- SELECT: Users can view files from their own company's projects
CREATE POLICY "Users can view their company's project files"
ON project_files FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  )
);

-- INSERT: Users with project edit permission can upload files
CREATE POLICY "Users can upload files to their company's projects"
ON project_files FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  )
  AND
  project_id IN (
    SELECT id FROM projects WHERE company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  )
);

-- UPDATE: Users can update file metadata (rename, etc.)
CREATE POLICY "Users can update their company's project files"
ON project_files FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  )
);

-- DELETE: Users can delete files they uploaded or if they have permission
CREATE POLICY "Users can delete their company's project files"
ON project_files FOR DELETE
USING (
  company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  )
);

-- Update trigger for updated_at
CREATE TRIGGER update_project_files_updated_at
  BEFORE UPDATE ON project_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE project_files IS 'Stores project technical office files (CAD, PDF, images, etc.)';
COMMENT ON COLUMN project_files.category IS 'Technical category: statik, mimari, mekanik, elektrik, zemin_etudu, geoteknik, ic_tasarim, 3d';
COMMENT ON COLUMN project_files.cloudinary_public_id IS 'Cloudinary public ID for file deletion';
