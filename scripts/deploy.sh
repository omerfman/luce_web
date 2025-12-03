#!/bin/bash

# ============================================================================
# LUCE MİMARLIK - AUTOMATED DEPLOYMENT SCRIPT
# ============================================================================
# Bu script tüm deployment adımlarını otomatik yapar
# ============================================================================

set -e  # Exit on error

echo "🚀 Luce Mimarlık - Automated Deployment"
echo "========================================"
echo ""

# ============================================================================
# 1. Environment Check
# ============================================================================

echo "📋 Step 1: Environment Check"
echo "----------------------------"

if [ ! -f ".env.local" ]; then
    echo "❌ ERROR: .env.local file not found!"
    echo "Please run this script after setup is complete."
    exit 1
fi

echo "✅ .env.local found"

# Check if we're in a git repo
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    git branch -M main
fi

echo "✅ Git repository ready"
echo ""

# ============================================================================
# 2. Install Dependencies
# ============================================================================

echo "📦 Step 2: Installing Dependencies"
echo "-----------------------------------"

if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

echo ""

# ============================================================================
# 3. Type Check & Lint
# ============================================================================

echo "🔍 Step 3: Type Check & Lint"
echo "----------------------------"

echo "Running TypeScript type check..."
npm run type-check

echo "Running ESLint..."
npm run lint

echo "✅ All checks passed"
echo ""

# ============================================================================
# 4. Build
# ============================================================================

echo "🏗️  Step 4: Build Production"
echo "----------------------------"

npm run build

echo "✅ Build successful"
echo ""

# ============================================================================
# 5. Git Commit
# ============================================================================

echo "📝 Step 5: Git Commit"
echo "---------------------"

# Add all files
git add .

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "ℹ️  No changes to commit"
else
    git commit -m "feat: Initial commit - Luce Workflow MVP

- Next.js 14 with TypeScript
- Supabase authentication & database
- Invoice & Project management
- Row-Level Security
- Multi-tenant architecture
- Production-ready configuration
"
    echo "✅ Changes committed"
fi

echo ""

# ============================================================================
# 6. GitHub Push Setup
# ============================================================================

echo "🔗 Step 6: GitHub Setup"
echo "-----------------------"

# Check if remote exists
if git remote | grep -q "origin"; then
    echo "✅ Git remote already configured"
else
    echo ""
    echo "Please add your GitHub repository as remote:"
    echo "  git remote add origin https://github.com/omerfman/luce_mimarlik.git"
    echo ""
    read -p "Press Enter after adding the remote..."
fi

# Try to push
echo "Pushing to GitHub..."
if git push -u origin main 2>/dev/null; then
    echo "✅ Pushed to GitHub successfully"
else
    echo "⚠️  Could not push automatically"
    echo "Please run manually:"
    echo "  git push -u origin main"
fi

echo ""

# ============================================================================
# 7. Deployment Instructions
# ============================================================================

echo "🌐 Step 7: Vercel Deployment"
echo "----------------------------"
echo ""
echo "✅ Local setup complete!"
echo ""
echo "📋 Next: Deploy to Vercel"
echo ""
echo "Option 1: Web Interface"
echo "  1. Go to: https://vercel.com/new"
echo "  2. Import: https://github.com/omerfman/luce_mimarlik"
echo "  3. Add Environment Variables:"
echo "     NEXT_PUBLIC_SUPABASE_URL=https://plwmqofncmkgxhushucg.supabase.co"
echo "     NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc..."
echo "  4. Click Deploy"
echo ""
echo "Option 2: Vercel CLI"
echo "  npm i -g vercel"
echo "  vercel --prod"
echo ""
echo "================================================"
echo "🎉 Deployment ready!"
echo "================================================"
