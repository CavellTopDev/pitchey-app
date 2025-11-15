# Observability Stack Deployment Guide

**Date**: November 14, 2025  
**Implementation**: Complete Production-Ready Monitoring  
**Stack**: Frontend & Backend Sentry Integration with Source Maps

## Overview

You've successfully implemented a comprehensive observability stack with:
- ✅ **Frontend Sentry** with error tracking and session replay
- ✅ **Backend Sentry** with request tagging and user context  
- ✅ **Automated source map uploads** via Vite plugin
- ✅ **Conditional deployment strategies** based on available credentials
- ✅ **Enhanced debugging** with route and user correlation

## Implementation Summary

### 1. Frontend Enhancements (`frontend/`)

#### Vite Configuration (`vite.config.ts`)
```typescript
// Conditional Sentry plugin activation
const sentryEnabled = !!(process.env.SENTRY_ORG && process.env.SENTRY_PROJECT && process.env.SENTRY_AUTH_TOKEN)

// Automatic source map upload in production
sentryVitePlugin({
  org: process.env.SENTRY_ORG!,
  project: process.env.SENTRY_PROJECT!,
  authToken: process.env.SENTRY_AUTH_TOKEN!,
  release: sentryRelease,
  sourcemaps: {
    filesToDeleteAfterUpload: isProduction ? 'dist/**/*.map' : undefined,
  },
})
```

#### Runtime Initialization (`src/main.tsx`)
```typescript
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: true }),
  ],
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event) {
    // Authorization header scrubbing
    if (event.request?.headers) {
      delete (event.request.headers as any)['authorization']
    }
    return event
  },
})
```

### 2. Backend Enhancements (`working-server.ts`)

#### Request Tagging
```typescript
// Set route and method tags for every request
SentryDeno.setTag('route', url.pathname);
SentryDeno.setTag('method', method);
```

#### User Context Setting
```typescript
// Set user context when authentication succeeds
const u = authResult.user;
SentryDeno.setUser({ id: String(u.id), email: u.email, username: u.username });
SentryDeno.setTag('portal', u.userType);
```

### 3. Deployment Pipeline (`deploy-observability-stack.sh`)

Three deployment strategies:

1. **Full Observability**: Source maps + backend/frontend monitoring
2. **Partial Observability**: Basic error tracking only
3. **Standard Deployment**: Health checks only

## Quick Setup Instructions

### Step 1: Sentry Project Setup

1. Create or access your Sentry organization
2. Create separate projects for frontend and backend (or use one for both)
3. Generate an auth token with `project:releases` scope

### Step 2: Environment Variable Configuration

#### For Source Map Upload (Cloudflare Pages)
```bash
# Required for automatic source map upload
export SENTRY_ORG="your-org-slug"
export SENTRY_PROJECT="your-frontend-project-slug" 
export SENTRY_AUTH_TOKEN="your-auth-token-with-releases-scope"

# Optional - will auto-generate if not set
export SENTRY_RELEASE="your-custom-release-id"
```

#### For Backend Monitoring (Deno Deploy)
```bash
# Required for backend error tracking and performance monitoring
export SENTRY_DSN="https://your-backend-dsn@sentry.io/project-id"
```

#### For Frontend Runtime Monitoring
```bash
# Required for frontend error tracking and session replay
export VITE_SENTRY_DSN="https://your-frontend-dsn@sentry.io/project-id"
```

### Step 3: Validation and Deployment

1. **Validate Configuration**:
   ```bash
   deno run --allow-read --allow-env test-observability-setup.ts
   ```

2. **Deploy with Observability**:
   ```bash
   ./deploy-observability-stack.sh
   ```

## Deployment Scenarios

### Scenario 1: Full Production Deployment
**When**: All environment variables are set
**Result**: 
- ✅ Source maps uploaded automatically to Sentry
- ✅ Backend request tagging and user context
- ✅ Frontend error tracking with session replay
- ✅ Performance monitoring for all endpoints
- ✅ User correlation between frontend and backend errors

### Scenario 2: Basic Monitoring
**When**: Only `SENTRY_DSN` or `VITE_SENTRY_DSN` is set
**Result**:
- ⚠️ Source maps not uploaded (requires auth token)
- ✅ Basic error tracking enabled
- ✅ Health check monitoring

### Scenario 3: Development/Testing
**When**: No Sentry environment variables set
**Result**:
- ❌ No Sentry integration
- ✅ Console logging fallbacks
- ✅ Basic health checks

## Environment-Specific Instructions

### Development Environment
```bash
# Local development (optional Sentry)
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2
PORT=8001 deno run --allow-all working-server.ts

# Frontend development
cd frontend
npm run dev
```

### Production Deployment

#### Option A: Cloudflare Pages + Deno Deploy
```bash
# Set environment variables in your shell or CI/CD
export SENTRY_ORG="your-org"
export SENTRY_PROJECT="pitchey-frontend"
export SENTRY_AUTH_TOKEN="your-token"
export SENTRY_DSN="your-backend-dsn"
export VITE_SENTRY_DSN="your-frontend-dsn"

# Deploy
./deploy-observability-stack.sh
```

#### Option B: Manual Environment Setup
```bash
# Cloudflare Pages Dashboard
# Add environment variables:
# - SENTRY_ORG
# - SENTRY_PROJECT  
# - SENTRY_AUTH_TOKEN
# - VITE_SENTRY_DSN

# Deno Deploy Dashboard
# Add environment variables:
# - SENTRY_DSN

# Then deploy normally
```

## Monitoring Features Enabled

### 📊 Frontend Monitoring
- **Error Tracking**: JavaScript errors, network failures, unhandled promises
- **Performance Monitoring**: Page load times, Core Web Vitals, route transitions
- **Session Replay**: User session recordings for error debugging (10% sample rate)
- **User Context**: Authentication state correlation
- **Source Maps**: Accurate stack traces in production

### 🔧 Backend Monitoring
- **Error Tracking**: Server errors, database failures, authentication issues
- **Performance Monitoring**: Endpoint response times, database queries
- **Request Tagging**: Route-based error grouping (`/api/auth/login`, `/api/pitches`, etc.)
- **User Context**: Correlation with authenticated user actions
- **Portal Tagging**: Error grouping by user type (`creator`, `investor`, `production`)

### 🔗 Cross-Platform Correlation
- **User Journey Tracking**: Follow user actions from frontend to backend
- **Error Context**: Frontend errors include user authentication state
- **Performance Correlation**: Page load times vs API response times
- **Release Tracking**: Version correlation across frontend and backend

## Post-Deployment Setup

### 1. Recommended Sentry Alerts

#### Error Rate Alerts
```
Alert: Error rate > 1% for 5 minutes
Scope: production environment
Action: Slack notification to #alerts channel
```

#### Performance Alerts  
```
Alert: P95 response time > 2000ms for dashboard endpoints
Endpoints: /api/creator/dashboard, /api/investor/dashboard, /api/production/dashboard
Action: Email to dev team
```

#### New Issue Alerts
```
Alert: New issue in production
Scope: production environment
Action: Slack notification with issue details
```

### 2. Recommended Dashboards

#### Backend Operational Dashboard
- 5xx error count over time
- P95 response time by route  
- Top error types and frequencies
- Issues grouped by portal type
- Database query performance

#### Frontend Performance Dashboard
- Error count by release version
- Session replay capture rate
- Core Web Vitals (LCP, FID, CLS)
- Top routes by error frequency
- User session duration

### 3. Release Management
- **Automated Releases**: Source maps automatically create releases
- **Release Health**: Track error rates per deployment
- **Rollback Detection**: Monitor error spikes after deployments

## Validation Checklist

After deployment, verify:

- [ ] **Source Maps**: Check Sentry UI → Releases for uploaded source maps
- [ ] **Backend Events**: Trigger a test error to verify backend monitoring
- [ ] **Frontend Events**: Generate a frontend error to test tracking
- [ ] **User Context**: Login and verify user info appears in Sentry events  
- [ ] **Performance Data**: Check performance monitoring tab for request data
- [ ] **Session Replays**: Verify session recordings are being captured
- [ ] **Alerts**: Test alert rules with intentional errors

## Troubleshooting

### Source Maps Not Uploading
```bash
# Check environment variables
echo "Org: $SENTRY_ORG"
echo "Project: $SENTRY_PROJECT" 
echo "Token: ${SENTRY_AUTH_TOKEN:0:10}..."

# Test auth token manually
curl -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  https://sentry.io/api/0/organizations/$SENTRY_ORG/
```

### Backend Events Not Appearing
```bash
# Check Sentry DSN configuration
curl https://pitchey-backend-fresh.deno.dev/api/health
# Look for telemetry.initialized: true

# Test error endpoint
curl -X POST https://pitchey-backend-fresh.deno.dev/api/test-error
```

### Frontend Events Not Appearing
```bash
# Check browser console for Sentry initialization
# Look for: "✅ Sentry initialized"

# Check environment variable
echo $VITE_SENTRY_DSN
```

## Cost Optimization

### Sampling Rates (Current Configuration)
- **Performance Traces**: 20% (`tracesSampleRate: 0.2`)
- **Session Replays**: 10% normal, 100% on error
- **Backend Performance**: Production optimized in `telemetry.ts`

### Recommended Adjustments by Usage
- **High Traffic**: Reduce `tracesSampleRate` to 0.05 (5%)
- **Low Traffic**: Increase `replaysSessionSampleRate` to 0.3 (30%)
- **Development**: Set all rates to 1.0 (100%) for thorough debugging

## Architecture Benefits

1. **Deployment Flexibility**: Works with or without Sentry credentials
2. **Progressive Enhancement**: Graceful degradation from full to basic monitoring  
3. **Security**: Authorization header scrubbing, no source code in source maps
4. **Performance**: Optimized sampling rates and conditional plugin loading
5. **Developer Experience**: Automatic source map upload, rich debugging context
6. **Operational Insight**: Cross-platform error correlation and user journey tracking

---

## Summary

Your observability stack is now production-ready with:
- ✅ **Complete implementation** of frontend and backend monitoring
- ✅ **Automated deployment pipeline** with validation
- ✅ **Flexible configuration** supporting partial or full observability
- ✅ **Security best practices** for data protection
- ✅ **Performance optimization** for production workloads

Run `./deploy-observability-stack.sh` when ready to deploy with your Sentry configuration!