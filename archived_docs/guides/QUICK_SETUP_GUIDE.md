# Quick Setup Guide - Production Services

## 🚀 5-Minute Setup for Essential Services

This guide helps you quickly set up the recommended production services for Pitchey.

## 1. Monitoring Setup (Already Done ✅)

### Health Checks
```bash
# Run one-time health check
./monitoring/health-check.sh

# Start continuous monitoring (runs in background)
nohup ./monitoring/continuous-monitor.sh > monitoring/logs/continuous.log 2>&1 &

# Check monitoring status
ps aux | grep continuous-monitor

# View real-time logs
tail -f monitoring/logs/health-check.log
```

### Performance Dashboard
```bash
# Open dashboard (local)
open monitoring/performance-dashboard.html

# Or serve it
cd monitoring && python3 -m http.server 8080
# Visit: http://localhost:8080/performance-dashboard.html
```

## 2. Sentry Error Tracking (10 minutes)

### Quick Setup
1. **Sign up**: https://sentry.io/signup/ (use GitHub for quick login)
2. **Create projects**:
   - Click "Create Project" → JavaScript → Name: `pitchey-backend`
   - Click "Create Project" → React → Name: `pitchey-frontend`

3. **Get your DSNs** (from project settings):
   - Backend DSN: `https://YOUR_KEY@o123456.ingest.sentry.io/PROJECT_ID`
   - Frontend DSN: `https://YOUR_KEY@o123456.ingest.sentry.io/PROJECT_ID`

4. **Add to environment files**:

Backend (`.env.deploy`):
```bash
SENTRY_DSN=https://YOUR_BACKEND_DSN@o123456.ingest.sentry.io/PROJECT_ID
```

Frontend (`.env`):
```bash
VITE_SENTRY_DSN=https://YOUR_FRONTEND_DSN@o123456.ingest.sentry.io/PROJECT_ID
```

5. **Deploy with Sentry**:
```bash
# Redeploy backend
./deploy-secure.sh

# Rebuild and deploy frontend
cd frontend
VITE_API_URL=https://pitchey-backend-fresh-23jvxyy3bspp.deno.dev \
VITE_SENTRY_DSN=YOUR_DSN npm run build
cloudflare-pages deploy --prod --dir=dist
```

## 3. Upstash Redis Cache (5 minutes)

### Quick Setup
1. **Sign up**: https://upstash.com (use GitHub)
2. **Create database**:
   - Click "Create Database"
   - Name: `pitchey-cache`
   - Region: Choose closest to your users
   - Type: Regional (free tier)

3. **Copy credentials** (from database page):
```bash
UPSTASH_REDIS_REST_URL=https://YOUR-ENDPOINT.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN
```

4. **Add to `.env.deploy`**:
```bash
# Redis Cache
UPSTASH_REDIS_REST_URL=https://YOUR-ENDPOINT.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN
CACHE_ENABLED=true
```

5. **Redeploy**:
```bash
./deploy-secure.sh
```

## 4. Uptime Monitoring (3 minutes)

### UptimeRobot (Recommended - Free)
1. **Sign up**: https://uptimerobot.com
2. **Add monitors**:
   - Click "Add New Monitor"
   - Type: HTTP(s)
   - Name: `Pitchey Backend`
   - URL: `https://pitchey-backend-fresh-23jvxyy3bspp.deno.dev/api/health`
   - Interval: 5 minutes
   
   - Add another for frontend:
   - Name: `Pitchey Frontend`
   - URL: `https://pitchey-5o8.pages.dev`

3. **Set up alerts**:
   - Add your email
   - Optional: Add webhook for Discord/Slack

## 5. Discord/Slack Alerts (Optional - 5 minutes)

### Discord Webhook
1. **In your Discord server**:
   - Server Settings → Integrations → Webhooks
   - New Webhook → Copy URL

2. **Add to monitoring**:
```bash
# Create alerts config
cp monitoring/.env.alerts.template monitoring/.env.alerts
nano monitoring/.env.alerts

# Add your webhook
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK
```

### Slack Webhook
1. **Create Slack App**: https://api.slack.com/apps
2. **Add Incoming Webhook** → Choose channel
3. **Copy webhook URL** to `.env.alerts`

## 6. Quick Deployment Commands

### Deploy Everything
```bash
# Backend with all services
./deploy-secure.sh

# Frontend
cd frontend
npm run build
cloudflare-pages deploy --prod --dir=dist

# Test deployment
curl https://pitchey-backend-fresh-23jvxyy3bspp.deno.dev/api/health
```

### Monitor Everything
```bash
# Start all monitoring
./monitoring/continuous-monitor.sh &

# Check all services
./monitoring/health-check.sh

# View dashboard
open monitoring/performance-dashboard.html
```

## 📊 Service Status Checklist

| Service | Setup Time | Status | Priority |
|---------|------------|--------|----------|
| ✅ Health Monitoring | Done | Active | Essential |
| ✅ Database Indexes | Done | Optimized | Essential |
| ⬜ Sentry Errors | 10 min | Pending | High |
| ⬜ Redis Cache | 5 min | Pending | High |
| ⬜ Uptime Monitor | 3 min | Pending | High |
| ⬜ Discord/Slack | 5 min | Pending | Medium |
| ⬜ Email Service | 15 min | Pending | Low |
| ⬜ CDN Setup | 20 min | Pending | Low |

## 🎯 Quick Wins Completed

1. **Fixed public endpoint** ✅
2. **Added database indexes** ✅ (18 indexes added)
3. **Set up monitoring** ✅
4. **Created dashboards** ✅
5. **Secured tokens** ✅

## 📈 Performance Improvements

After optimizations:
- **Backend response**: 189ms (Excellent)
- **Frontend load**: 351ms (Good)
- **Database queries**: Optimized with indexes
- **Monitoring**: Active and automated

## 🔗 Important URLs

### Your Production URLs
- **Frontend**: https://pitchey-5o8.pages.dev
- **Backend**: https://pitchey-backend-fresh-23jvxyy3bspp.deno.dev
- **Health**: https://pitchey-backend-fresh-23jvxyy3bspp.deno.dev/api/health

### Service Dashboards
- **Deno Deploy**: https://dash.deno.com/projects/pitchey-backend-fresh
- **cloudflare-pages**: https://app.cloudflare-pages.com/sites/pitchey
- **Neon DB**: https://console.neon.tech
- **GitHub**: https://github.com/CavellTopDev/pitchey-app

### Recommended Services
- **Sentry**: https://sentry.io
- **Upstash**: https://upstash.com
- **UptimeRobot**: https://uptimerobot.com
- **Resend**: https://resend.com (for emails)

## 🚨 Emergency Commands

```bash
# If backend is down
./deploy-secure.sh

# If frontend is down
cd frontend && npm run build && cloudflare-pages deploy --prod --dir=dist

# Check what's wrong
./monitoring/health-check.sh
tail -f monitoring/alerts.log

# View recent errors
tail -n 50 monitoring/logs/health-check.log

# Restart monitoring
pkill -f continuous-monitor
nohup ./monitoring/continuous-monitor.sh > monitoring/logs/continuous.log 2>&1 &
```

## ✅ You're Production Ready!

Your application is now:
- 🚀 **Deployed** and live
- 📊 **Monitored** continuously  
- ⚡ **Optimized** with indexes
- 🔒 **Secured** with proper token management
- 📈 **Tracked** with performance metrics

Next steps are optional optimizations. The core system is fully operational!