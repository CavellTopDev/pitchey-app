# Pitchey Platform - Issue Diagnostic & Resolution Framework

## 🚨 CRITICAL ISSUES TRACKER

### Priority 1: Authentication & Session Management
**Status:** ⚠️ PARTIALLY BROKEN
**Impact:** Users cannot maintain sessions across portal switches

#### Current State:
- Better Auth migration incomplete - hybrid JWT/session system causing conflicts
- Cookie domain mismatch between local (localhost:8001) and production
- Session refresh tokens not properly synchronized with Redis cache
- Portal-specific endpoints (`/api/auth/creator/login`) not fully integrated with Better Auth

#### Resolution Path:
```typescript
// Fix in src/auth/better-auth-neon-raw-sql.ts
// Ensure consistent session handling across all portals
export const authConfig = {
  database: {
    type: "postgresql",
    url: env.DATABASE_URL,
  },
  session: {
    cookieName: "pitchey-session",
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update daily
  },
  // Add cookie configuration for production
  cookies: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    domain: ".pitchey.pages.dev", // Allow subdomain access
  }
}
```

### Priority 2: Database Connection Pool Exhaustion
**Status:** 🔴 CRITICAL IN PRODUCTION
**Impact:** Random 500 errors after ~100 concurrent users

#### Current State:
- Neon pooler connection limit (25) being exceeded
- No connection recycling in Cloudflare Workers
- Missing transaction rollback on errors
- Connection leak in WebSocket handlers

#### Resolution Path:
```sql
-- Add to migrations
ALTER SYSTEM SET max_connections = 100;
ALTER DATABASE neondb SET statement_timeout = '30s';
ALTER DATABASE neondb SET idle_in_transaction_session_timeout = '60s';
```

### Priority 3: WebSocket Real-time Features
**Status:** ⚠️ INCONSISTENT
**Impact:** Notifications delayed, presence tracking broken

#### Current State:
- Redis pub/sub not properly configured for Cloudflare Workers
- WebSocket connections dropping after 60 seconds
- Message queue for offline users not implemented
- Typing indicators causing memory leaks

#### Resolution Path:
```typescript
// Implement in worker-integrated.ts
class WebSocketHandler {
  private heartbeatInterval = 30000; // 30 seconds
  private connections = new Map<string, WebSocket>();
  
  async handleUpgrade(request: Request) {
    // Add connection pooling and heartbeat
    const ws = new WebSocket(request.url);
    this.setupHeartbeat(ws);
    return new Response(null, { status: 101, webSocket: ws });
  }
}
```

---

## 🔍 DIAGNOSTIC CHECKLIST

### Frontend Issues

| Component | Issue | Severity | Quick Fix |
|-----------|-------|----------|-----------|
| Browse Tabs | Content mixing between Trending/New | Medium | Check `frontend/src/components/browse/TabContent.tsx:42` - filter state not resetting |
| NDA Modal | Submit button stays disabled | High | `frontend/src/components/nda/RequestModal.tsx:78` - validation logic inverted |
| Upload Progress | Not showing for large files | Medium | WebSocket event handler missing in `useUpload.ts:156` |
| Dashboard Metrics | Stale data after 5 min cache | Low | Implement cache invalidation on user actions |
| Search Filters | Genre dropdown not populating | High | API endpoint `/api/genres` returning 404 |

### Backend Issues

| Endpoint | Issue | Severity | Location |
|----------|-------|----------|----------|
| `/api/pitches/featured` | Returns all pitches, not featured | High | `src/routes/pitches.ts:234` - WHERE clause missing |
| `/api/nda/approve` | Transaction not rolling back | Critical | `src/routes/nda.ts:445` - try/catch missing |
| `/api/upload/document` | R2 bucket permissions error | High | `wrangler.toml` - R2 binding misconfigured |
| `/api/analytics/*` | Redis timeout on cold start | Medium | Lazy load Redis client in handler |
| `/api/notifications/mark-read` | Race condition with WebSocket | Low | Add optimistic locking |

### Database Issues

| Table | Issue | Impact | Migration Required |
|-------|-------|--------|-------------------|
| `pitches` | Missing index on `status, created_at` | Slow trending queries | `CREATE INDEX idx_pitches_status_created ON pitches(status, created_at DESC);` |
| `nda_requests` | No cascade delete on pitch removal | Orphaned records | `ALTER TABLE nda_requests ADD CONSTRAINT ... ON DELETE CASCADE;` |
| `notifications` | JSON column for `metadata` causing slow queries | Performance | Normalize to separate table |
| `investments` | Missing `updated_at` trigger | Audit trail broken | Add trigger function |

---

## 🎯 RESOLUTION PRIORITY MATRIX

### Week 1: Critical Fixes (Stop the Bleeding)
1. **Fix authentication across all portals**
   - Complete Better Auth migration
   - Test with all three demo accounts
   - Verify session persistence

2. **Resolve database connection pooling**
   - Implement connection limits
   - Add monitoring for pool exhaustion
   - Set up alerts in Sentry

3. **Stabilize WebSocket connections**
   - Add heartbeat mechanism
   - Implement reconnection logic
   - Fix message queuing

### Week 2: High Priority Features
1. **Complete NDA workflow**
   - Fix approval/rejection flow
   - Add email notifications
   - Implement document watermarking

2. **Fix content browsing**
   - Separate Trending/New Releases tabs
   - Add proper pagination
   - Implement search filters

3. **Upload functionality**
   - Support multiple file uploads
   - Add progress indicators
   - Implement virus scanning

### Week 3: Polish & Optimization
1. **Performance improvements**
   - Add database indexes
   - Optimize Redis caching
   - Implement CDN for static assets

2. **Error handling**
   - Comprehensive error boundaries
   - User-friendly error messages
   - Retry logic for failed requests

3. **Testing & Monitoring**
   - Add E2E tests for critical paths
   - Set up uptime monitoring
   - Create performance baselines

---

## 🛠️ DEBUGGING COMMANDS

```bash
# Quick Health Check
curl -X GET https://pitchey-api-prod.ndlovucavelle.workers.dev/health

# Test Authentication Flow
./test-auth-flow.sh

# Check Database Connections
PGPASSWORD="npg_YibeIGRuv40J" psql -h ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech \
  -U neondb_owner -d neondb -c "SELECT count(*) FROM pg_stat_activity;"

# Monitor WebSocket Connections
wrangler tail --format=json | grep "WebSocket"

# Redis Cache Status
curl -X GET https://chief-anteater-20186.upstash.io/info \
  -H "Authorization: Bearer AU7aAAIncDI3ZGVjNWMxZGUyOWQ0ZmYyYjI4NzdkYjM4OGMxZTE3NnAyMjAxODY"

# Check Worker Logs
wrangler tail --env production

# Local Testing with Production Data
PORT=8001 DATABASE_URL="postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" \
  deno run --allow-all working-server.ts
```

---

## ⚡ QUICK WINS (Can Fix Today)

1. **Search endpoint 404**: Add missing `/api/genres` endpoint
   ```typescript
   // Add to worker-integrated.ts
   router.get('/api/genres', async () => {
     const genres = ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller'];
     return json({ genres });
   });
   ```

2. **NDA button disabled**: Fix validation in `RequestModal.tsx:78`
   ```typescript
   // Change from:
   const isValid = !termsAccepted || !purposeSelected;
   // To:
   const isValid = termsAccepted && purposeSelected;
   ```

3. **Featured pitches**: Add WHERE clause in `src/routes/pitches.ts:234`
   ```sql
   SELECT * FROM pitches 
   WHERE status = 'published' AND featured = true 
   ORDER BY created_at DESC LIMIT 10;
   ```

4. **Dashboard refresh**: Add cache invalidation
   ```typescript
   // In dashboard components
   const { data, refetch } = useQuery({
     queryKey: ['dashboard', userId],
     staleTime: 5 * 60 * 1000, // 5 minutes
     refetchOnWindowFocus: true, // Add this
   });
   ```

---

## 📊 METRICS TO TRACK

### Performance KPIs
- Time to First Byte (TTFB): Target < 200ms
- Largest Contentful Paint (LCP): Target < 2.5s
- Database query time: P95 < 100ms
- WebSocket connection stability: > 99% uptime
- API response time: P95 < 500ms

### Error Rates to Monitor
- Authentication failures: < 0.1%
- Database connection errors: < 0.01%
- Upload failures: < 1%
- WebSocket disconnections: < 5%
- Payment processing errors: 0%

### User Experience Metrics
- Session duration: > 5 minutes average
- Bounce rate: < 30%
- Feature adoption rate: > 40%
- Support ticket rate: < 2%
- Demo account conversion: > 10%

---

## 🚀 VALIDATION SCRIPTS

Create `test-critical-systems.sh`:
```bash
#!/bin/bash

echo "🔍 Testing Critical Systems..."

# Test Authentication
echo "1. Testing Authentication..."
curl -X POST https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/session \
  -H "Cookie: pitchey-session=test" -s -o /dev/null -w "%{http_code}\n"

# Test Database
echo "2. Testing Database..."
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/db -s | jq .

# Test Redis
echo "3. Testing Redis Cache..."
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/cache -s | jq .

# Test WebSocket
echo "4. Testing WebSocket..."
wscat -c wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws \
  -x '{"type":"ping"}' --wait 2

# Test Critical Endpoints
echo "5. Testing Critical Endpoints..."
endpoints=(
  "/api/pitches/featured"
  "/api/auth/session"
  "/api/notifications"
  "/api/dashboard/creator"
)

for endpoint in "${endpoints[@]}"; do
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://pitchey-api-prod.ndlovucavelle.workers.dev${endpoint}")
  echo "  ${endpoint}: ${response}"
done
```

---

## 📝 FINAL CHECKLIST FOR PRODUCTION READINESS

- [ ] All three portal authentications working
- [ ] Database connection pooling < 80% capacity
- [ ] WebSocket connections stable for > 5 minutes
- [ ] All critical endpoints returning < 500ms
- [ ] Error rate < 1% across all services
- [ ] Sentry capturing all exceptions
- [ ] Redis cache hit rate > 80%
- [ ] R2 uploads working for all file types
- [ ] Email notifications sending successfully
- [ ] Payment processing in test mode working
- [ ] Demo accounts accessible without errors
- [ ] Mobile responsive design verified
- [ ] CORS configured for all origins
- [ ] Rate limiting implemented
- [ ] Security headers configured

---

**Document Version:** 1.0
**Last Updated:** January 2024
**Next Review:** After Week 1 fixes complete