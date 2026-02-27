-- Add project_id to card_statement_items for petty cash receipt tracking
-- When a card statement item is assigned to a project without an invoice match,
-- it becomes a "kasa fişi" (petty cash receipt)

-- 1. Add project_id column
ALTER TABLE card_statement_items
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- 2. Create index for faster project-based queries
CREATE INDEX IF NOT EXISTS idx_card_statement_items_project_id 
  ON card_statement_items(project_id) 
  WHERE project_id IS NOT NULL;

-- 3. Add comment
COMMENT ON COLUMN card_statement_items.project_id IS 'Projeye atanan kasa fişi (fatura olmayan harcamalar)';
