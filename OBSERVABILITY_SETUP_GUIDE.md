# Pitchey Production Observability Setup Guide

**Version:** 1.0  
**Last Updated:** November 14, 2025  
**Implementation Status:** ✅ Ready for Production

## 🎯 Overview

This guide implements comprehensive telemetry and observability for the Pitchey platform using **Sentry error tracking** and **OpenTelemetry** integration with your existing infrastructure.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│          Production Observability Stack                  │
├─────────────────────────────────────────────────────────┤
│  Frontend (Cloudflare Pages)                            │
│  ├─ Sentry Browser SDK                                  │
│  ├─ Performance monitoring                              │
│  ├─ Session replay                                      │
│  └─ Error boundaries                                    │
├─────────────────────────────────────────────────────────┤
│  Backend (Deno Deploy)                                  │
│  ├─ Sentry Deno SDK                                     │
│  ├─ OpenTelemetry integration                           │
│  ├─ Structured logging                                  │
│  └─ Performance tracing                                 │
├─────────────────────────────────────────────────────────┤
│  Infrastructure                                         │
│  ├─ Deno Deploy built-in observability                 │
│  ├─ Cloudflare Analytics                               │
│  ├─ Neon PostgreSQL insights                           │
│  └─ Upstash Redis monitoring                           │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start (5 Minutes)

### Step 1: Create Sentry Account & Projects

1. **Sign up for Sentry** (Free tier: 5k errors/month)
   - Visit https://sentry.io
   - Create account with your team email

2. **Create Two Projects:**
   
   **Backend Project:**
   - Platform: Deno/Node.js
   - Name: `pitchey-backend`
   - Copy the DSN (looks like: `https://abc123@o123.ingest.sentry.io/456`)
   
   **Frontend Project:**
   - Platform: React
   - Name: `pitchey-frontend`
   - Copy the DSN

### Step 2: Configure Environment Variables

**For Deno Deploy (Backend):**
```bash
# Add these secrets to your Deno Deploy dashboard
SENTRY_DSN=https://your-backend-dsn@o123.ingest.sentry.io/456
DENO_ENV=production
```

**For Cloudflare Pages (Frontend):**
```bash
# Add these to your Cloudflare Pages environment variables
VITE_SENTRY_DSN=https://your-frontend-dsn@o123.ingest.sentry.io/789
VITE_NODE_ENV=production
VITE_APP_VERSION=3.4-redis-cache
```

**For GitHub Actions (CI/CD):**
```bash
# Add these GitHub secrets
SENTRY_DSN_BACKEND=https://your-backend-dsn@o123.ingest.sentry.io/456
SENTRY_DSN_FRONTEND=https://your-frontend-dsn@o123.ingest.sentry.io/789
```

### Step 3: Deploy with Telemetry

The observability code is already integrated! Just redeploy:

```bash
# Deploy backend (will include telemetry automatically)
git add . && git commit -m "feat: add production telemetry" && git push

# Or manual deployment
DENO_DEPLOY_TOKEN=your_token deployctl deploy --project=pitchey-backend-fresh --entrypoint=working-server.ts
```

The deployment will automatically:
- ✅ Initialize Sentry error tracking
- ✅ Enable performance monitoring  
- ✅ Start structured logging
- ✅ Enhance health checks with telemetry status

## 📊 What You Get Immediately

### Error Tracking
- **Real-time error alerts** via email/Slack
- **Stack traces** with full context
- **User impact analysis** 
- **Release tracking** for identifying problematic deployments

### Performance Monitoring
- **API response time tracking**
- **Database query performance**
- **Frontend Core Web Vitals**
- **Slow endpoint identification**

### Enhanced Debugging
- **Request/response logging**
- **User session replay** (frontend)
- **Breadcrumb trails** leading to errors
- **Custom context** for business logic

### Health Monitoring
Enhanced `/api/health` endpoint now includes:
```json
{
  "status": "healthy",
  "message": "Complete Pitchey API is running",
  "telemetry": {
    "initialized": true,
    "environment": "production",
    "config": {
      "serviceName": "pitchey-backend",
      "version": "3.4-redis-cache",
      "enableTracing": true,
      "sampleRate": 0.1,
      "sentryConfigured": true
    }
  }
}
```

## 🔧 Advanced Configuration

### Custom Error Filtering

The telemetry system automatically filters sensitive data:

**Backend (`src/utils/telemetry.ts`):**
- ❌ Authorization headers
- ❌ Password fields  
- ❌ JWT tokens
- ❌ User email addresses

**Frontend (`frontend/src/utils/telemetry.ts`):**
- ❌ Form passwords
- ❌ LocalStorage tokens
- ❌ User IP addresses
- ❌ Email addresses

### Performance Thresholds

**Automatic Alerts Trigger When:**
- API response time > 2 seconds
- Database query time > 1 second  
- Page load time > 3 seconds
- Error rate > 1%

### Sample Rate Configuration

**Production (Low Traffic Impact):**
- Backend: 10% of transactions traced
- Frontend: 10% of sessions replayed
- Error tracking: 100% capture rate

**Development (Full Visibility):**
- Backend: 100% of transactions traced
- Frontend: 100% of sessions replayed  
- Verbose console logging enabled

## 📈 Monitoring Dashboard Setup

### Sentry Dashboard Configuration

1. **Create Alert Rules:**
   - Error spike detection (>10 errors/minute)
   - Performance degradation (>500ms P95)
   - High error rate (>1%)

2. **Set up Integrations:**
   - Slack/Discord notifications
   - Email alerts for critical issues
   - GitHub issue creation

3. **Configure Release Tracking:**
   ```bash
   # Automatic release tracking on deploy
   SENTRY_RELEASE=pitchey-backend-v3.4
   ```

### Metrics to Monitor

**Critical Metrics:**
- **Error Rate:** Target <0.1%
- **Response Time:** Target <200ms P95  
- **Uptime:** Target 99.9%
- **Database Performance:** Target <100ms queries

**User Experience Metrics:**
- **Page Load Time:** Target <3s LCP
- **API Success Rate:** Target >99%
- **Authentication Success:** Target >99.5%
- **Feature Availability:** Target 100%

## 🧪 Testing Your Observability

### Test Error Tracking

1. **Trigger a Test Error:**
```bash
curl https://pitchey-backend-fresh.deno.dev/api/test/error
```

2. **Check Sentry Dashboard:**
   - Should see error within 30 seconds
   - Includes full stack trace and context

### Test Performance Monitoring

1. **Check Health Endpoint:**
```bash
curl https://pitchey-backend-fresh.deno.dev/api/health | jq '.telemetry'
```

2. **Expected Response:**
```json
{
  "initialized": true,
  "environment": "production",
  "config": {
    "sentryConfigured": true
  }
}
```

### Test Frontend Telemetry

1. **Open Browser Console** on https://pitchey-5o8.pages.dev
2. **Trigger an error** (404 page, API failure)
3. **Check Sentry** for frontend project

## 🚨 Troubleshooting

### Common Issues

**❌ "Sentry DSN not provided"**
- Check environment variables are set correctly
- Verify DSN format: `https://key@o123.ingest.sentry.io/456`

**❌ "Telemetry not initialized"**
- Check `/api/health` endpoint for telemetry status
- Verify import statement: `import { telemetry } from "./src/utils/telemetry.ts"`

**❌ No errors appearing in Sentry**
- Verify network connectivity to Sentry
- Check browser console for CORS issues
- Confirm sample rate is > 0

**❌ Performance data missing**
- Ensure `tracesSampleRate > 0`
- Check `enableTracing: true` in config
- Verify API endpoints are being called

### Debug Mode

**Enable Debug Logging (Development Only):**
```bash
# Backend
SENTRY_DEBUG=true deno run --allow-all working-server.ts

# Frontend  
VITE_SENTRY_DEBUG=true npm run dev
```

## 💰 Cost Optimization

### Free Tier Limits

**Sentry Free Tier:**
- 5,000 errors/month per project
- 10,000 performance units/month
- 7-day data retention

**Cost-Effective Setup:**
- Use sample rates to stay within limits
- Configure alert rules to focus on critical issues
- Leverage Deno Deploy's built-in OpenTelemetry (free)

**Estimated Monthly Cost: $0-25** (depending on traffic)

### Scaling Strategy

**Tier 1 (Free):** Up to 10k requests/month
- Free Sentry plan  
- Built-in platform observability

**Tier 2 ($25/month):** Up to 100k requests/month  
- Sentry Developer plan
- Extended data retention

**Tier 3 ($80/month):** Up to 1M requests/month
- Sentry Team plan
- Advanced alerting and integrations

## 🎯 Production Readiness Checklist

### ✅ Completed (Ready to Deploy)

- [x] **Backend Sentry integration** with structured logging
- [x] **Frontend error boundaries** and session replay
- [x] **Performance monitoring** for APIs and database
- [x] **Enhanced health checks** with telemetry status
- [x] **Sensitive data filtering** for security compliance
- [x] **Automatic error context** for debugging

### 🔄 Setup Required (5 minutes)

- [ ] **Create Sentry projects** (backend + frontend)
- [ ] **Configure environment variables** in deployment platforms
- [ ] **Set up alert rules** in Sentry dashboard
- [ ] **Test error tracking** with sample errors
- [ ] **Configure team notifications** (Slack/email)

### 🎯 Optional Enhancements

- [ ] **Custom dashboards** in Sentry
- [ ] **Integration with status page** (e.g., StatusPage.io)
- [ ] **Automated incident response** workflows
- [ ] **Custom performance metrics** for business KPIs

## 🔗 Quick Links

**Sentry Projects:**
- Backend: `https://sentry.io/organizations/your-org/projects/pitchey-backend/`
- Frontend: `https://sentry.io/organizations/your-org/projects/pitchey-frontend/`

**Health Endpoints:**
- Backend: `https://pitchey-backend-fresh.deno.dev/api/health`
- Frontend: `https://pitchey-5o8.pages.dev` (check console for telemetry status)

**Documentation:**
- Sentry Deno: https://docs.sentry.io/platforms/deno/
- Sentry React: https://docs.sentry.io/platforms/react/
- Deno Deploy Observability: https://docs.deno.com/deploy/manual/observability/

---

**🎉 Result:** Your Pitchey platform now has production-grade observability with minimal configuration and cost. You'll be alerted to issues before users are affected and have the tools to debug problems quickly.