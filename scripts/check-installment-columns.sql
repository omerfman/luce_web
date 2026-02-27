-- Taksit kolonlarının varlığını kontrol et
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'card_statement_items'
  AND column_name IN ('is_installment', 'installment_current', 'installment_total', 'installment_total_amount')
ORDER BY column_name;

-- Kaç tane taksitli işlem var?
SELECT 
  COUNT(*) as total_items,
  SUM(CASE WHEN is_installment = true THEN 1 ELSE 0 END) as installment_count,
  SUM(CASE WHEN is_installment = false OR is_installment IS NULL THEN 1 ELSE 0 END) as non_installment_count
FROM card_statement_items;

-- Taksitli işlem örnekleri
SELECT 
  id,
  transaction_name,
  amount,
  is_installment,
  installment_current,
  installment_total,
  installment_total_amount
FROM card_statement_items
WHERE is_installment = true
LIMIT 10;
