# Run migration to add contract_pdf_url column
# This adds a column to store Cloudinary PDF URLs for contract payments

# Set your Supabase project URL and anon key
$SUPABASE_URL = $env:NEXT_PUBLIC_SUPABASE_URL
$SUPABASE_ANON_KEY = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY

if (-not $SUPABASE_URL -or -not $SUPABASE_ANON_KEY) {
    Write-Host "Error: SUPABASE_URL or SUPABASE_ANON_KEY not found in environment" -ForegroundColor Red
    Write-Host "Please set them in .env.local file" -ForegroundColor Yellow
    exit 1
}

Write-Host "Running migration: 20260108_add_contract_pdf_to_informal_payments.sql" -ForegroundColor Cyan

# Read migration file
$migrationSQL = Get-Content -Path "supabase/migrations/20260108_add_contract_pdf_to_informal_payments.sql" -Raw

Write-Host "Migration SQL:" -ForegroundColor Yellow
Write-Host $migrationSQL -ForegroundColor Gray
Write-Host ""

# You need to run this SQL in Supabase SQL Editor manually or use Supabase CLI
Write-Host "To apply this migration:" -ForegroundColor Green
Write-Host "1. Go to your Supabase Dashboard -> SQL Editor" -ForegroundColor White
Write-Host "2. Copy and paste the migration SQL shown above" -ForegroundColor White
Write-Host "3. Click 'Run'" -ForegroundColor White
Write-Host ""
Write-Host "OR use Supabase CLI:" -ForegroundColor Green
Write-Host "  supabase db push" -ForegroundColor White
