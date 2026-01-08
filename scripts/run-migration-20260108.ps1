# Run migration: Add payment_record_pdf_url to informal_payments table
# Bu script Supabase'e migrasyon SQL'ini uygular

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Migration: Add payment_record_pdf_url" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# .env.local dosyasından Supabase bilgilerini al
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env.local"

if (-not (Test-Path $envFile)) {
    Write-Host "HATA: .env.local dosyasi bulunamadi!" -ForegroundColor Red
    Write-Host "Lutfen once .env.local dosyasini olusturun." -ForegroundColor Yellow
    exit 1
}

# Supabase URL'sini al
$supabaseUrl = (Get-Content $envFile | Where-Object { $_ -match "^NEXT_PUBLIC_SUPABASE_URL=" }) -replace "NEXT_PUBLIC_SUPABASE_URL=", ""

Write-Host "Supabase URL: $supabaseUrl" -ForegroundColor Green
Write-Host ""
Write-Host "ONEMLI BILGILENDIRME:" -ForegroundColor Yellow
Write-Host "Bu migration SQL'i Supabase Dashboard'dan SQL Editor kullanilarak calistirilmalidir." -ForegroundColor Yellow
Write-Host ""
Write-Host "Adimlar:" -ForegroundColor Cyan
Write-Host "1. Supabase Dashboard'a gidin: $supabaseUrl" -ForegroundColor White
Write-Host "2. Sol menuден 'SQL Editor' secenegini tiklayin" -ForegroundColor White
Write-Host "3. 'New Query' butonuna tiklayin" -ForegroundColor White
Write-Host "4. Asagidaki SQL kodunu yapistirin ve calistirin" -ForegroundColor White
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "SQL KODU:" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Migration SQL dosyasını oku ve göster
$sqlFile = Join-Path $projectRoot "supabase\migrations\20260108_add_payment_record_pdf_url.sql"
$sqlContent = Get-Content $sqlFile -Raw

Write-Host $sqlContent -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "SQL kodunu kopyalamak için:" -ForegroundColor Yellow
Write-Host "Set-Clipboard -Value (Get-Content '$sqlFile' -Raw)" -ForegroundColor White
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Clipboard'a kopyala
try {
    Set-Clipboard -Value $sqlContent
    Write-Host "SQL kodu panoya kopyalandi! Supabase SQL Editor'a yapistirabilirsiniz." -ForegroundColor Green
} catch {
    Write-Host "SQL kodu panoya kopyalanamadi. Manuel olarak kopyalayin." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Migration uygulandiktan sonra deployment tamamlanacak." -ForegroundColor Cyan
Write-Host ""
