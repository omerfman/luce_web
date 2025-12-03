# Luce Mimarlık - Deployment Guide

## 🚀 Vercel Deployment

### Prerequisites

1. **Supabase Project**
   - Create a Supabase project at [supabase.com](https://supabase.com)
   - Run all migrations from `supabase/migrations/`
   - Create "invoices" storage bucket
   - Get your API keys from Settings > API

2. **Vercel Account**
   - Sign up at [vercel.com](https://vercel.com)
   - Install Vercel CLI: `npm i -g vercel`

### Step-by-Step Deployment

#### 1. Prepare Supabase

```sql
-- Run these migrations in order in Supabase SQL Editor:
-- 1. supabase/migrations/20251203_initial_schema.sql
-- 2. supabase/migrations/20251203_rls_policies.sql
-- 3. supabase/migrations/20251203_storage_setup.sql
```

Create storage bucket:
- Go to Storage > New Bucket
- Name: `invoices`
- Public: OFF (private)
- File size limit: 5242880 (5MB)
- Allowed MIME types: `application/pdf`

#### 2. Configure Environment Variables

Get from Supabase Dashboard (Settings > API):
- `NEXT_PUBLIC_SUPABASE_URL` - Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon/Public key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (SECRET!)

#### 3. Deploy to Vercel

**Option A: GitHub Integration (Recommended)**

1. Push code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repository
4. Add environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG... (SECRET)
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   ```
5. Click "Deploy"

**Option B: Vercel CLI**

```bash
# Login
vercel login

# Deploy
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_APP_URL

# Deploy to production
vercel --prod
```

#### 4. Post-Deployment

1. **Verify Deployment**
   - Check https://your-app.vercel.app
   - Test login flow
   - Verify RLS policies working

2. **Create First User**
   ```sql
   -- In Supabase SQL Editor:
   -- First, create company
   INSERT INTO companies (name) VALUES ('Luce Mimarlık');
   
   -- Then create user (will be linked to auth.users after first login)
   -- User must first login via magic link to create auth.users record
   ```

3. **Custom Domain (Optional)**
   - Vercel Dashboard > Settings > Domains
   - Add your custom domain
   - Configure DNS records

### 🔒 Security Checklist

Before going to production:

- [ ] All RLS policies enabled and tested
- [ ] Service role key in environment variables (not in code)
- [ ] HTTPS enforced (Vercel automatic)
- [ ] Security headers configured (vercel.json)
- [ ] CORS configured if needed
- [ ] Rate limiting enabled (future)
- [ ] Backup strategy in place
- [ ] Error tracking (Sentry) configured

### 📊 Monitoring

**Vercel Analytics**
- Automatically enabled
- View at Vercel Dashboard > Analytics

**Supabase Metrics**
- Database performance
- API usage
- Storage usage

**Error Tracking**
- Configure Sentry (optional, Phase 11)
- Add SENTRY_DSN to environment variables

### 🔄 CI/CD Pipeline

Automatic deployment on:
- Push to `main` branch → Production
- Push to `dev` branch → Preview deployment
- Pull requests → Preview deployment

### 🐛 Troubleshooting

**Build fails**
```bash
# Check logs in Vercel dashboard
# Common issues:
- Missing environment variables
- TypeScript errors
- Missing dependencies
```

**RLS policies blocking access**
```sql
-- Test RLS policies:
SELECT * FROM companies; -- Should only show user's company
```

**Storage upload fails**
- Check bucket exists
- Verify RLS policies on storage.objects
- Confirm file size < 5MB
- Ensure file type is PDF

### 📈 Performance Optimization

Already configured:
- Next.js Image Optimization
- Automatic code splitting
- Server-side rendering
- Static page generation where possible

### 💾 Backup Strategy

**Database**
- Supabase: Automatic daily backups (retained 7 days)
- Manual backups: Dashboard > Database > Backups

**Storage**
- Configure periodic backups via Supabase CLI
- Consider external backup to AWS S3 (future)

### 🔐 Environment Variables Reference

| Variable | Required | Description | Secret |
|----------|----------|-------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL | ❌ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public/Anon key | ❌ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key | ✅ |
| `NEXT_PUBLIC_APP_URL` | ✅ | Application URL | ❌ |
| `SENTRY_DSN` | ❌ | Error tracking | ❌ |
| `UPSTASH_REDIS_REST_URL` | ❌ | Rate limiting | ❌ |
| `UPSTASH_REDIS_REST_TOKEN` | ❌ | Rate limiting | ✅ |

### 🎯 Production Checklist

Before launch:
- [ ] All migrations applied
- [ ] Default roles created
- [ ] Storage bucket configured
- [ ] Environment variables set
- [ ] Domain configured (if custom)
- [ ] SSL certificate verified
- [ ] Admin user created
- [ ] Backup tested
- [ ] Error tracking enabled
- [ ] Performance tested
- [ ] Security audit completed
- [ ] User documentation ready

### 📞 Support

For deployment issues:
- Vercel: [vercel.com/support](https://vercel.com/support)
- Supabase: [supabase.com/support](https://supabase.com/support)
- Next.js: [nextjs.org/docs](https://nextjs.org/docs)
