# Aktivite Loglari Migration Script
# Bu script, 20260113_create_activity_logs_system.sql migration dosyasini Supabase'e uygular

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Aktivite Loglari Migration" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "Hata: .env.local dosyasi bulunamadi!" -ForegroundColor Red
    Write-Host "Lutfen .env.local dosyasini olusturun ve Supabase bilgilerinizi ekleyin." -ForegroundColor Yellow
    exit 1
}

# Load environment variables
Get-Content .env.local | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+?)\s*=\s*(.+?)\s*$') {
        $name = $matches[1]
        $value = $matches[2]
        Set-Item -Path "env:$name" -Value $value
    }
}

$SUPABASE_URL = $env:NEXT_PUBLIC_SUPABASE_URL
$SUPABASE_SERVICE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $SUPABASE_URL -or -not $SUPABASE_SERVICE_KEY) {
    Write-Host "Hata: Supabase bilgileri bulunamadi!" -ForegroundColor Red
    Write-Host "NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY degiskenlerini kontrol edin." -ForegroundColor Yellow
    exit 1
}

# Extract project reference from URL
$PROJECT_REF = ($SUPABASE_URL -split '//')[1] -split '.supabase.co' | Select-Object -First 1

Write-Host "Supabase Project: $PROJECT_REF" -ForegroundColor Green
Write-Host ""

# Migration file
$MIGRATION_FILE = "supabase\migrations\20260113_create_activity_logs_system.sql"

if (-not (Test-Path $MIGRATION_FILE)) {
    Write-Host "Hata: Migration dosyasi bulunamadi: $MIGRATION_FILE" -ForegroundColor Red
    exit 1
}

Write-Host "Migration dosyasi: $MIGRATION_FILE" -ForegroundColor Cyan
Write-Host ""

# Read migration file
$SQL_CONTENT = Get-Content $MIGRATION_FILE -Raw

Write-Host "Migration uygulanıyor..." -ForegroundColor Yellow
Write-Host ""

try {
    Write-Host "Migration dosyasini manuel olarak calistirmaniz gerekebilir." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Supabase Dashboard kullanin" -ForegroundColor Cyan
    Write-Host "  1. https://supabase.com/dashboard/project/$PROJECT_REF/sql adresine gidin"
    Write-Host "  2. SQL Editor'u acin"
    Write-Host "  3. $MIGRATION_FILE dosyasinin icerigini yapistirin"
    Write-Host "  4. Run butonuna tiklayin"
    Write-Host ""
    Write-Host "Option 2: Supabase CLI kullanin (eger yukluyse)" -ForegroundColor Cyan
    Write-Host "  npx supabase db push" -ForegroundColor White
    Write-Host ""
    
    # Try to open SQL editor in browser
    $response = Read-Host "Supabase SQL Editor'u tarayicida acmak ister misiniz? (E/H)"
    if ($response -eq 'E' -or $response -eq 'e') {
        Start-Process "https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
        Write-Host "Tarayici acildi!" -ForegroundColor Green
    }
    
} catch {
    Write-Host "Hata olustu: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Migration tamamlandiktan sonra test etmek icin:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host "  http://localhost:3000/activity-logs" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Cyan
