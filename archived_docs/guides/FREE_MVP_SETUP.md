# 🚀 FREE MVP Setup Guide

Deploy your entire application for **$0/month** using free tier services!

## Quick Start (15 minutes)

```bash
# 1. Run the automated deployment script
./deploy-mvp-free.sh

# 2. Follow the prompts to set up your free accounts
```

## Step-by-Step Setup

### 1️⃣ Create Free Accounts (5 min)

#### Neon (Database) - FREE Forever
1. Go to https://neon.tech
2. Sign up with GitHub
3. Create a new database
4. Copy your connection string:
   ```
   postgresql://user:pass@host.neon.tech/dbname
   ```

#### Deno Deploy (Backend) - FREE Forever
1. Go to https://deno.com/deploy
2. Sign in with GitHub
3. No setup needed yet (script handles it)

#### Vercel (Frontend) - FREE Forever
1. Go to https://vercel.com
2. Sign in with GitHub
3. Install CLI: `npm i -g vercel`

#### Upstash Redis (Cache) - FREE Forever [OPTIONAL]
1. Go to https://console.upstash.com
2. Create account
3. Create Redis database (select closest region)
4. Copy REST credentials:
   ```
   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=AXxxx...
   ```

### 2️⃣ Configure Environment (2 min)

Create `.env.production`:

```bash
# Required
DATABASE_URL=postgresql://... # From Neon
JWT_SECRET=$(openssl rand -base64 32)

# Will be updated after deployment
FRONTEND_URL=https://your-app.vercel.app

# Optional (but recommended)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxx...
```

### 3️⃣ Deploy Backend (3 min)

```bash
# Install Deno Deploy CLI
deno install --allow-all --no-check -r -f \
  https://deno.land/x/deploy/deployctl.ts

# Deploy backend
deployctl deploy \
  --project=pitchey-backend \
  --entrypoint=working-server.ts \
  --env=DATABASE_URL=$DATABASE_URL \
  --env=JWT_SECRET=$JWT_SECRET \
  --env=UPSTASH_REDIS_REST_URL=$UPSTASH_REDIS_REST_URL \
  --env=UPSTASH_REDIS_REST_TOKEN=$UPSTASH_REDIS_REST_TOKEN

# Your backend is now at:
# https://pitchey-backend.deno.dev
```

### 4️⃣ Deploy Frontend (3 min)

```bash
cd frontend

# Set backend URL
echo "VITE_API_URL=https://pitchey-backend.deno.dev" > .env.production

# Build
npm install
npm run build

# Deploy to Vercel
vercel --prod

# Follow prompts, your frontend will be at:
# https://your-app.vercel.app
```

### 5️⃣ Update CORS (2 min)

Go to Deno Deploy dashboard:
1. https://dash.deno.com/projects/pitchey-backend/settings
2. Add environment variable:
   ```
   FRONTEND_URL=https://your-app.vercel.app
   ```

## 🎉 You're Live!

### Your Stack (All FREE):
- **Backend**: Deno Deploy (100K requests/day)
- **Database**: Neon PostgreSQL (0.5GB storage)
- **Cache**: Upstash Redis (10K commands/day)
- **Frontend**: Vercel (100GB bandwidth/month)

### Test Your Deployment

```bash
# Test backend health
curl https://pitchey-backend.deno.dev/api/health

# Should return:
{
  "status": "healthy",
  "cache": {
    "type": "upstash-redis", # or "in-memory"
    "distributed": true,
    "status": "healthy"
  }
}
```

### Demo Accounts
```
Creator: alex.creator@demo.com / Demo123
Investor: sarah.investor@demo.com / Demo123
Production: stellar.production@demo.com / Demo123
```

## Monitoring Your Free Usage

### Deno Deploy
- Dashboard: https://dash.deno.com
- Limits: 100K requests/day, 100GB/month
- Current usage: Check dashboard

### Vercel
- Dashboard: https://vercel.com/dashboard
- Limits: 100GB bandwidth/month
- Analytics: Built-in

### Neon
- Console: https://console.neon.tech
- Limits: 3GB compute/month
- Monitor: Check console

### Upstash
- Console: https://console.upstash.com
- Limits: 10K commands/day
- Metrics: Real-time dashboard

## Scaling Beyond Free Tier

You only need to upgrade when you have:
- 🚀 10,000+ daily active users
- 💰 Paying customers
- 📊 100K+ API requests/day

Even then, costs are minimal:
- Deno Deploy Pro: $20/month (10M requests)
- Upstash Pay-as-you-go: ~$0.20 per 100K commands
- Neon Pro: $19/month (10GB storage)
- Vercel Pro: $20/month (1TB bandwidth)

## Troubleshooting

### Backend not connecting to database?
- Check DATABASE_URL in Deno Deploy settings
- Ensure Neon database is active

### CORS errors?
- Update FRONTEND_URL in Deno Deploy settings
- Check browser console for specific domain

### Cache not working?
- Verify Upstash credentials
- Check cache status at /api/health
- Falls back to in-memory cache automatically

### Frontend not loading?
- Check VITE_API_URL in frontend build
- Verify Vercel deployment completed

## Support

- Deno Discord: https://discord.gg/deno
- Vercel Support: https://vercel.com/support
- Neon Docs: https://neon.tech/docs
- Upstash Docs: https://docs.upstash.com

---

**Remember**: This entire setup costs **$0/month** and can handle thousands of users!