# Environment Variables Setup & Deployment Architecture Guide

## 🏗️ Architecture Overview

Your application has a **3-tier architecture**:

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Frontend      │────▶│    Backend API    │────▶│   Database       │
│   (cloudflare-pages)     │     │  (Deno Deploy)    │     │    (Neon)        │
└─────────────────┘     └──────────────────┘     └──────────────────┘
     Static              Serverless Runtime        PostgreSQL Cloud
```

## 📋 Environment Variable Categories

### 1. **REQUIRED Variables** (App won't work without these)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Authentication token secret
- `FRONTEND_URL` - For CORS configuration

### 2. **OPTIONAL Variables** (Features work without them)
- Caching (Redis/Upstash)
- Email service (Resend)
- File storage (S3/R2)
- Payment processing (Stripe)

## 🎯 Strategic Approach to Setup

### Phase 1: Minimal Viable Deployment (MVP)
**Goal**: Get the app running with core functionality

1. **Database Setup (Neon)**
   - Sign up at https://neon.tech
   - Create a new database
   - Copy the connection string

2. **Security Setup**
   - Generate JWT secret: `openssl rand -base64 32`
   - Save securely (never commit to git)

3. **Create Minimal .env Files**

   **`.env.deploy` (for Deno Deploy)**
   ```bash
   DATABASE_URL=postgresql://[from-neon]?sslmode=require
   JWT_SECRET=[your-generated-secret]
   FRONTEND_URL=https://pitchey-5o8.pages.dev
   
   # Set these as empty to prevent deployment errors
   UPSTASH_REDIS_REST_URL=
   UPSTASH_REDIS_REST_TOKEN=
   REDIS_URL=
   RESEND_API_KEY=
   EMAIL_FROM=
   AWS_ACCESS_KEY_ID=
   AWS_SECRET_ACCESS_KEY=
   AWS_REGION=
   S3_BUCKET=
   STRIPE_SECRET_KEY=
   STRIPE_WEBHOOK_SECRET=
   NODE_ENV=production
   DENO_ENV=production
   PORT=8000
   ```

   **`.env` (for local development)**
   ```bash
   DATABASE_URL=postgresql://postgres:password@localhost:5432/pitchey
   JWT_SECRET=test-secret-key-for-development
   FRONTEND_URL=http://localhost:5173
   PORT=8001
   
   # Optional services (leave empty for now)
   REDIS_URL=
   RESEND_API_KEY=
   # ... etc
   ```

### Phase 2: Enhanced Features
**Goal**: Add optional services one at a time

1. **Add Caching (Upstash Redis)**
   - Improves performance
   - Sign up at https://console.upstash.com
   - Update `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

2. **Add Email Service (Resend)**
   - Enables notifications
   - Sign up at https://resend.com
   - Update `RESEND_API_KEY` and `EMAIL_FROM`

3. **Add File Storage (S3/R2)**
   - For user uploads
   - Configure AWS or Cloudflare R2
   - Update AWS credentials

4. **Add Payments (Stripe)**
   - For monetization
   - Sign up at https://stripe.com
   - Update Stripe keys

## 🚀 Deployment Strategy

### Step 1: Local Testing
```bash
# Test with minimal config
./start-local.sh

# Verify:
# - Can create/login accounts
# - Basic features work
# - No critical errors
```

### Step 2: Deploy Backend First
```bash
# Option A: Manual deployment (recommended initially)
deployctl deploy \
  --project=pitchey-backend-fresh \
  --entrypoint=working-server.ts \
  --env-file=.env.deploy \
  --token=$DENO_DEPLOY_TOKEN

# Option B: Fix GitHub Actions later
# Need to configure project for GitHub mode in Deno Deploy dashboard
```

### Step 3: Deploy Frontend
```bash
cd frontend
npm run build
cloudflare-pages deploy --prod
```

### Step 4: Verify Production
- Test health endpoint: `curl https://pitchey-backend-fresh.deno.dev/api/health`
- Check frontend loads
- Test demo accounts

## 🔧 Environment Files Organization

```
pitchey_v0.2/
├── .env                    # Local development (gitignored)
├── .env.example            # Template for developers
├── .env.deploy            # Production values for deployment
├── .env.secrets           # Token storage (NEVER commit)
├── frontend/
│   ├── .env               # Frontend local
│   └── .env.production    # Frontend production
```

## ⚙️ Deno Deploy Configuration

### Current Issue: GitHub Actions Mode
The project needs to be configured in Deno Deploy dashboard:

1. Go to https://dash.deno.com/projects/pitchey-backend-fresh
2. Settings → Git Integration
3. Choose deployment method:
   - **GitHub Actions** (for CI/CD)
   - **Automatic** (direct from GitHub)
   - **Manual** (using deployctl)

### Recommended: Start with Manual
- More control
- Easier debugging
- No GitHub Actions complexity

## 📝 Decision Tree for Services

```
Do you need user sessions to persist across restarts?
├─ No → Use in-memory cache (default)
└─ Yes → Add Redis/Upstash

Do you need to send emails?
├─ No → Leave email vars empty
└─ Yes → Configure Resend

Do you need file uploads?
├─ No → Leave S3 vars empty
└─ Yes → Configure S3/R2

Do you need payments?
├─ No → Leave Stripe vars empty
└─ Yes → Configure Stripe
```

## 🔍 Troubleshooting Deployment

### Problem: "Missing environment variables"
**Solution**: Add all variables from .env.example to .env.deploy, even if empty

### Problem: "Project not in GitHub Actions mode"
**Solution**: Use manual deployment or configure in Deno Deploy dashboard

### Problem: "CORS errors in production"
**Solution**: Ensure FRONTEND_URL matches your actual frontend URL

### Problem: "Database connection failed"
**Solution**: Add `?sslmode=require` to Neon DATABASE_URL

## ✅ Pre-Deployment Checklist

- [ ] All required env vars set in .env.deploy
- [ ] JWT_SECRET is strong and unique
- [ ] DATABASE_URL includes SSL mode for Neon
- [ ] FRONTEND_URL matches deployment
- [ ] .env.secrets is in .gitignore
- [ ] Tested locally with production-like config
- [ ] Deno Deploy token saved securely

## 🎭 Production vs Development

**Development (.env)**:
- Use local PostgreSQL
- Simple JWT secret
- No SSL required
- Optional services can be empty

**Production (.env.deploy)**:
- Use Neon PostgreSQL with SSL
- Strong JWT secret
- HTTPS URLs only
- Configure services as needed

## 📚 Next Steps

1. **Immediate**: Fix .env.deploy with minimal config
2. **Today**: Deploy manually to test
3. **This Week**: Add one optional service
4. **Later**: Fix GitHub Actions integration

Remember: **Start simple, add complexity gradually!**