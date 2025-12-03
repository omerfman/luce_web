# ============================================================================
# User Management - PowerShell Script (Windows)
# ============================================================================
# Usage:
#   .\scripts\manage-users.ps1 -Command assign-role -Email "user@example.com" -Role "Admin"
#   .\scripts\manage-users.ps1 -Command list-users
#   .\scripts\manage-users.ps1 -Command create-company -CompanyName "New Company"
# ============================================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("assign-role", "list-users", "create-company")]
    [string]$Command,
    
    [string]$Email,
    [string]$Role = "Super Admin",
    [string]$CompanyName = "Luce Mimarlık",
    [string]$TaxNumber,
    [string]$Address,
    [string]$Phone,
    [string]$CompanyEmail
)

# Load environment variables
if (Test-Path ".env.local") {
    Get-Content ".env.local" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
} else {
    Write-Host "❌ ERROR: .env.local file not found" -ForegroundColor Red
    exit 1
}

$SUPABASE_URL = $env:NEXT_PUBLIC_SUPABASE_URL
$SERVICE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $SERVICE_KEY) {
    Write-Host "❌ ERROR: SUPABASE_SERVICE_ROLE_KEY not found in .env.local" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please add Service Role Key to .env.local:" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://supabase.com/dashboard/project/plwmqofncmkgxhushucg/settings/api" -ForegroundColor Yellow
    Write-Host "  2. Copy 'service_role' key" -ForegroundColor Yellow
    Write-Host "  3. Add to .env.local: SUPABASE_SERVICE_ROLE_KEY=your-key" -ForegroundColor Yellow
    exit 1
}

$headers = @{
    "apikey" = $SERVICE_KEY
    "Authorization" = "Bearer $SERVICE_KEY"
    "Content-Type" = "application/json"
}

# ============================================================================
# ASSIGN USER ROLE
# ============================================================================

function Assign-UserRole {
    param($Email, $RoleName, $CompanyName)
    
    Write-Host "`n🔄 Assigning role to $Email..." -ForegroundColor Cyan
    
    try {
        # Get company
        $companyResponse = Invoke-RestMethod `
            -Uri "$SUPABASE_URL/rest/v1/companies?name=eq.$CompanyName&select=id,name" `
            -Headers $headers `
            -Method Get
        
        if ($companyResponse.Count -eq 0) {
            Write-Host "❌ Company not found: $CompanyName" -ForegroundColor Red
            return
        }
        
        $company = $companyResponse[0]
        Write-Host "✅ Company found: $($company.name)" -ForegroundColor Green
        
        # Get role
        $roleResponse = Invoke-RestMethod `
            -Uri "$SUPABASE_URL/rest/v1/roles?name=eq.$RoleName&select=id,name" `
            -Headers $headers `
            -Method Get
        
        if ($roleResponse.Count -eq 0) {
            Write-Host "❌ Role not found: $RoleName" -ForegroundColor Red
            return
        }
        
        $role = $roleResponse[0]
        Write-Host "✅ Role found: $($role.name)" -ForegroundColor Green
        
        # Get user from auth
        $authResponse = Invoke-RestMethod `
            -Uri "$SUPABASE_URL/auth/v1/admin/users" `
            -Headers $headers `
            -Method Get
        
        $authUser = $authResponse.users | Where-Object { $_.email -eq $Email } | Select-Object -First 1
        
        if (-not $authUser) {
            Write-Host "❌ User $Email not found in auth.users" -ForegroundColor Red
            Write-Host "`n💡 User must login at least once before assigning role" -ForegroundColor Yellow
            return
        }
        
        Write-Host "✅ User found in auth: $($authUser.id)" -ForegroundColor Green
        
        # Check if user profile exists
        $userResponse = Invoke-RestMethod `
            -Uri "$SUPABASE_URL/rest/v1/users?id=eq.$($authUser.id)&select=id" `
            -Headers $headers `
            -Method Get
        
        $userData = @{
            company_id = $company.id
            role_id = $role.id
            is_active = $true
        }
        
        if ($userResponse.Count -gt 0) {
            # Update existing user
            $updateHeaders = $headers.Clone()
            $updateHeaders["Prefer"] = "return=minimal"
            
            Invoke-RestMethod `
                -Uri "$SUPABASE_URL/rest/v1/users?id=eq.$($authUser.id)" `
                -Headers $updateHeaders `
                -Method Patch `
                -Body ($userData | ConvertTo-Json) | Out-Null
            
            Write-Host "✅ User profile updated" -ForegroundColor Green
        } else {
            # Create new user profile
            $userData.id = $authUser.id
            $userData.name = if ($authUser.user_metadata.full_name) { $authUser.user_metadata.full_name } else { $Email.Split('@')[0] }
            $userData.email = $Email
            
            Invoke-RestMethod `
                -Uri "$SUPABASE_URL/rest/v1/users" `
                -Headers $headers `
                -Method Post `
                -Body ($userData | ConvertTo-Json) | Out-Null
            
            Write-Host "✅ User profile created" -ForegroundColor Green
        }
        
        Write-Host "`n================================================" -ForegroundColor Green
        Write-Host "✅ SUCCESS!" -ForegroundColor Green
        Write-Host "================================================" -ForegroundColor Green
        Write-Host "Email: $Email"
        Write-Host "Company: $($company.name)"
        Write-Host "Role: $($role.name)"
        Write-Host "`n🔄 User should logout and login again to see changes" -ForegroundColor Yellow
        Write-Host "================================================`n" -ForegroundColor Green
        
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================================
# LIST USERS
# ============================================================================

function List-Users {
    param($CompanyName)
    
    Write-Host "`n📋 Listing users for: $CompanyName`n" -ForegroundColor Cyan
    
    try {
        # Get company
        $companyResponse = Invoke-RestMethod `
            -Uri "$SUPABASE_URL/rest/v1/companies?name=eq.$CompanyName&select=id" `
            -Headers $headers `
            -Method Get
        
        if ($companyResponse.Count -eq 0) {
            Write-Host "❌ Company not found" -ForegroundColor Red
            return
        }
        
        # Get users
        $usersResponse = Invoke-RestMethod `
            -Uri "$SUPABASE_URL/rest/v1/users?company_id=eq.$($companyResponse[0].id)&select=id,name,email,is_active,created_at,role:roles(name)" `
            -Headers $headers `
            -Method Get
        
        $usersResponse | ForEach-Object {
            [PSCustomObject]@{
                Email = $_.email
                Name = $_.name
                Role = $_.role.name
                Active = if ($_.is_active) { "✅" } else { "❌" }
                Created = (Get-Date $_.created_at).ToString("dd/MM/yyyy")
            }
        } | Format-Table -AutoSize
        
        Write-Host "Total users: $($usersResponse.Count)`n" -ForegroundColor Cyan
        
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================================
# CREATE COMPANY
# ============================================================================

function Create-Company {
    param($Name, $TaxNumber, $Address, $Phone, $Email)
    
    Write-Host "`n🔄 Creating company: $Name..." -ForegroundColor Cyan
    
    try {
        $companyData = @{
            name = $Name
            tax_number = if ($TaxNumber) { $TaxNumber } else { "" }
            address = if ($Address) { $Address } else { "" }
            phone = if ($Phone) { $Phone } else { "" }
            email = if ($Email) { $Email } else { "" }
        }
        
        $response = Invoke-RestMethod `
            -Uri "$SUPABASE_URL/rest/v1/companies" `
            -Headers $headers `
            -Method Post `
            -Body ($companyData | ConvertTo-Json)
        
        Write-Host "`n================================================" -ForegroundColor Green
        Write-Host "✅ COMPANY CREATED!" -ForegroundColor Green
        Write-Host "================================================" -ForegroundColor Green
        Write-Host "ID: $($response.id)"
        Write-Host "Name: $($response.name)"
        Write-Host "================================================`n" -ForegroundColor Green
        
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================================
# EXECUTE COMMAND
# ============================================================================

switch ($Command) {
    "assign-role" {
        if (-not $Email) {
            Write-Host "❌ ERROR: -Email parameter is required" -ForegroundColor Red
            Write-Host "Usage: .\scripts\manage-users.ps1 -Command assign-role -Email 'user@example.com' -Role 'Admin'" -ForegroundColor Yellow
            exit 1
        }
        Assign-UserRole -Email $Email -RoleName $Role -CompanyName $CompanyName
    }
    
    "list-users" {
        List-Users -CompanyName $CompanyName
    }
    
    "create-company" {
        if (-not $CompanyName) {
            Write-Host "❌ ERROR: -CompanyName parameter is required" -ForegroundColor Red
            exit 1
        }
        Create-Company -Name $CompanyName -TaxNumber $TaxNumber -Address $Address -Phone $Phone -Email $CompanyEmail
    }
}
