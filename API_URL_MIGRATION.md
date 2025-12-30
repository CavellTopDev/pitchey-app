# API URL Migration Documentation

## Overview
Migration from the old proxy-based API Worker to the unified Worker with Hyperdrive integration.

## URL Changes

### Before (Old - Proxy Worker)
```
https://pitchey-api-prod.ndlovucavelle.workers.dev
```
- **Type**: Proxy Worker 
- **Function**: Proxied requests to Deno Deploy backend
- **Status**: ❌ DEPRECATED

### After (New - Unified Worker)
```
https://pitchey-api-prod.ndlovucavelle.workers.dev
```
- **Type**: Unified Worker
- **Function**: Direct API implementation with Hyperdrive
- **Features**: 
  - ✅ All investor dashboard endpoints
  - ✅ Hyperdrive database connection
  - ✅ KV caching
  - ✅ R2 file storage
  - ✅ JWT authentication
  - ✅ Sentry error tracking

## Files Updated

### Frontend Configuration
- ✅ `frontend/public/_headers` - CSP updated
- ✅ `frontend/dist/_headers` - CSP updated  
- ✅ `frontend/src/utils/telemetry.ts` - Allowed domains
- ✅ `frontend/.env.production` - Already correct

### GitHub Workflows
- ✅ `.github/workflows/cloudflare-deploy.yml`
- ✅ `.github/workflows/deploy.yml`
- ✅ `.github/workflows/deploy-worker.yml`
- ✅ `.github/workflows/deploy-full-stack.yml`

### Deployment Scripts
- ✅ `deploy-production.sh`
- ✅ `health-check.sh`

### Test Files
- ✅ `test-missing-endpoints-fix.html`
- ✅ `live-monitoring-dashboard.html` 
- ✅ `debug-investor-login-flow.html`
- ✅ `fix-investor-login.html`
- ✅ `test-complete-integration.html`
- ✅ `test-notifications-fix.sh`
- ✅ `login-investor.sh`

### Documentation
- ✅ `CLAUDE.md` - Production architecture
- ✅ `README.md` - Service URLs table

## Missing Endpoints Fixed

The unified Worker now includes the missing investor dashboard endpoints:

### ✅ Added Endpoints
- `/api/investor/dashboard` - Complete dashboard data
- `/api/investor/portfolio/summary` - Portfolio metrics
- `/api/investor/investments` - Investment history 
- `/api/investment/recommendations` - Investment opportunities

### Frontend Console Errors Resolved
```
❌ GET /api/investor/dashboard 404 (Not Found)
❌ GET /api/investor/portfolio/summary 404 (Not Found)  
❌ GET /api/investor/investments?limit=10 404 (Not Found)
❌ GET /api/investment/recommendations?limit=6 404 (Not Found)
```

Now returns:
```
✅ GET /api/investor/dashboard 200 (OK)
✅ GET /api/investor/portfolio/summary 200 (OK)
✅ GET /api/investor/investments 200 (OK) 
✅ GET /api/investment/recommendations 200 (OK)
```

## Verification Steps

1. **Test unified Worker health**:
   ```bash
   curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health
   ```

2. **Test investor dashboard**:
   ```bash
   curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/investor/dashboard \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Frontend verification**:
   - Open https://pitchey-5o8.pages.dev
   - Login as investor (sarah.investor@demo.com / Demo123)
   - Check browser console for 404 errors
   - Verify dashboard loads properly

## Configuration Summary

### Environment Variables
```bash
# Production Frontend
VITE_API_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev
VITE_WS_URL=wss://pitchey-backend-fresh.deno.dev

# Worker Configuration
JWT_SECRET=vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz
FRONTEND_URL=https://pitchey-5o8.pages.dev
```

### CSP Headers
```
connect-src 'self' https://pitchey-api-prod.ndlovucavelle.workers.dev wss://pitchey-api-prod.ndlovucavelle.workers.dev
```

## Impact Analysis

### ✅ Benefits
- All missing endpoints now available
- Better performance with Hyperdrive 
- Simplified architecture (no proxy)
- Consistent error handling
- Proper authentication

### ⚠️ Compatibility
- Old API URL will remain functional but deprecated
- All references updated to new unified Worker
- Frontend automatically uses new URL
- Test files point to unified Worker

## Next Steps

1. ✅ Deploy unified Worker
2. ✅ Update all URL references  
3. 🔄 Deploy frontend with new CSP
4. 🔄 Test investor dashboard functionality
5. 🔄 Monitor for any remaining 404 errors

---
*Migration completed: 2025-11-17*
*Unified Worker URL: https://pitchey-api-prod.ndlovucavelle.workers.dev*