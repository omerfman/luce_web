@echo off
REM ============================================================================
REM LUCE MİMARLIK - AUTOMATED DEPLOYMENT SCRIPT (Windows)
REM ============================================================================

echo 🚀 Luce Mimarlık - Automated Deployment
echo ========================================
echo.

REM ============================================================================
REM 1. Environment Check
REM ============================================================================

echo 📋 Step 1: Environment Check
echo ----------------------------

if not exist ".env.local" (
    echo ❌ ERROR: .env.local file not found!
    echo Please run this script after setup is complete.
    exit /b 1
)

echo ✅ .env.local found

if not exist ".git" (
    echo 📦 Initializing git repository...
    git init
    git branch -M main
)

echo ✅ Git repository ready
echo.

REM ============================================================================
REM 2. Install Dependencies
REM ============================================================================

echo 📦 Step 2: Installing Dependencies
echo -----------------------------------

if not exist "node_modules" (
    echo Installing npm packages...
    call npm install
) else (
    echo ✅ Dependencies already installed
)

echo.

REM ============================================================================
REM 3. Type Check ^& Lint
REM ============================================================================

echo 🔍 Step 3: Type Check ^& Lint
echo ----------------------------

echo Running TypeScript type check...
call npm run type-check
if errorlevel 1 (
    echo ❌ Type check failed!
    exit /b 1
)

echo Running ESLint...
call npm run lint
if errorlevel 1 (
    echo ❌ Lint failed!
    exit /b 1
)

echo ✅ All checks passed
echo.

REM ============================================================================
REM 4. Build
REM ============================================================================

echo 🏗️  Step 4: Build Production
echo ----------------------------

call npm run build
if errorlevel 1 (
    echo ❌ Build failed!
    exit /b 1
)

echo ✅ Build successful
echo.

REM ============================================================================
REM 5. Git Commit
REM ============================================================================

echo 📝 Step 5: Git Commit
echo ---------------------

git add .

git diff --cached --quiet
if errorlevel 1 (
    git commit -m "feat: Initial commit - Luce Workflow MVP" -m "- Next.js 14 with TypeScript" -m "- Supabase authentication & database" -m "- Invoice & Project management" -m "- Row-Level Security" -m "- Multi-tenant architecture" -m "- Production-ready configuration"
    echo ✅ Changes committed
) else (
    echo ℹ️  No changes to commit
)

echo.

REM ============================================================================
REM 6. GitHub Push
REM ============================================================================

echo 🔗 Step 6: GitHub Setup
echo -----------------------

git remote | findstr "origin" >nul
if errorlevel 1 (
    echo Adding GitHub remote...
    git remote add origin https://github.com/omerfman/luce_mimarlik.git
)

echo Pushing to GitHub...
git push -u origin main
if errorlevel 1 (
    echo ⚠️  Please push manually: git push -u origin main
) else (
    echo ✅ Pushed to GitHub successfully
)

echo.

REM ============================================================================
REM 7. Deployment Instructions
REM ============================================================================

echo 🌐 Step 7: Vercel Deployment
echo ----------------------------
echo.
echo ✅ Local setup complete!
echo.
echo 📋 Next: Deploy to Vercel
echo.
echo Option 1: Web Interface
echo   1. Go to: https://vercel.com/new
echo   2. Import: https://github.com/omerfman/luce_mimarlik
echo   3. Add Environment Variables:
echo      NEXT_PUBLIC_SUPABASE_URL=https://plwmqofncmkgxhushucg.supabase.co
echo      NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
echo   4. Click Deploy
echo.
echo Option 2: Vercel CLI
echo   npm i -g vercel
echo   vercel --prod
echo.
echo ================================================
echo 🎉 Deployment ready!
echo ================================================
echo.
pause
