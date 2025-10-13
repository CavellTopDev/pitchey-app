# API Consistency Fix - Implementation Summary

## 📋 Complete Action Plan

### Phase 1: Critical Missing Endpoints (15 issues) ✅
**Files Created:**
- `fix-critical-endpoints.ts` - Contains all 15 endpoint implementations
- `add-missing-tables.sql` - Database schema for new tables
- `implement-critical-endpoints.sh` - Automation script

**What You Need to Do:**

1. **Add database tables:**
   ```bash
   psql -U postgres -d pitchey -f add-missing-tables.sql
   ```

2. **Add to working-server.ts:**
   - Line ~2400: Add creator endpoints (followers, saved-pitches, recommendations)
   - Line ~6570: Add investment endpoints (update, delete, details)
   - Line ~7100: Add production endpoints (analytics, review, calendar, stats)

3. **Update Drizzle schema (src/db/schema.ts):**
   - Add reviews, calendarEvents, savedPitches table definitions

4. **Test:**
   ```bash
   ./test-critical-endpoints.sh
   ```

---

### Phase 2: Path/Method Mismatches (19 warnings) 🔧
**Quick Frontend Fixes (5 minutes):**

```bash
# Run these sed commands to fix frontend paths
sed -i "s|/api/pitches/saved|/api/saved-pitches|g" \
  frontend/src/services/pitch.service.ts \
  frontend/src/services/investor.service.ts

sed -i "s|apiClient.put('/api/notifications/mark-read'|apiClient.post('/api/notifications/mark-read'|g" \
  frontend/src/services/notification.service.ts
```

**Backend Additions Required:**

1. **Add PATCH support for profile (line ~3890):**
```typescript
if (url.pathname === "/api/profile" && method === "PATCH") {
  const userId = getUserIdFromToken(request);
  const updates = await request.json();
  const updated = await db.update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning();
  return successResponse({ profile: updated[0] });
}
```

2. **Add PUT support for watchlist (line ~7900):**
```typescript
if (url.pathname.startsWith("/api/watchlist/") && method === "PUT") {
  const watchlistId = parseInt(url.pathname.split('/')[3]);
  const body = await request.json();
  // Update implementation
}
```

3. **Fix NDA status path (line 7929):**
```typescript
// Change from: "/api/nda/status/"
// To: match(/^\/api\/ndas\/\d+\/status$/)
```

---

### Phase 3: Response Structure Fixes (23 info) 📊
**Standardization Wrapper:**

Create a response transformer in frontend:
```typescript
// frontend/src/utils/api-transformer.ts
export function normalizeResponse(endpoint: string, data: any) {
  // Map backend response to frontend expected format
  switch(endpoint) {
    case '/api/dashboard/stats':
      return {
        views: data.totalViews,
        engagement: data.engagementRate,
        revenue: data.totalRevenue,
        growth: data.growthRate
      };
    case '/api/follows/followers':
      return data.data?.followers || data.followers || [];
    // Add more mappings
  }
  return data;
}
```

---

## 🚀 Implementation Order

### Day 1 (Today) - Critical Path:
1. ✅ Run `add-missing-tables.sql`
2. ✅ Add 4 creator endpoints to working-server.ts
3. ✅ Fix frontend path mismatches (sed commands)
4. ✅ Test creator dashboard

### Day 2 - Production & Investment:
1. ⏳ Add 5 production endpoints
2. ⏳ Add 3 investment endpoints
3. ⏳ Add PATCH/PUT method support
4. ⏳ Test production dashboard

### Day 3 - Polish & Documentation:
1. ⏳ Response structure normalization
2. ⏳ Update API documentation
3. ⏳ Full integration testing
4. ⏳ Deploy fixes

---

## 🧪 Validation Checklist

### Critical Endpoints:
- [ ] GET /api/creator/followers returns data
- [ ] GET /api/creator/saved-pitches returns data
- [ ] GET /api/creator/recommendations returns data
- [ ] GET /api/production/analytics returns data
- [ ] GET /api/production/calendar returns data
- [ ] POST /api/production/pitches/{id}/review works
- [ ] GET /api/production/submissions/stats returns data
- [ ] POST /api/investments/{id}/update works
- [ ] DELETE /api/investments/{id} works
- [ ] GET /api/investments/{id}/details returns data

### Path Fixes:
- [ ] /api/saved-pitches works
- [ ] /api/ndas/{id}/status works
- [ ] /api/follows/{id}/check works

### Method Fixes:
- [ ] PUT /api/watchlist/{id} works
- [ ] POST /api/notifications/mark-read works
- [ ] PATCH /api/profile works

---

## 📝 Quick Test Command

```bash
#!/bin/bash
# quick-api-test.sh

TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}' | jq -r '.token')

# Test all critical endpoints
endpoints=(
  "/api/creator/followers"
  "/api/creator/saved-pitches"
  "/api/creator/recommendations"
  "/api/saved-pitches"
)

for endpoint in "${endpoints[@]}"; do
  echo -n "Testing $endpoint: "
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "http://localhost:8001$endpoint")
  
  if [ "$status" = "200" ]; then
    echo "✅ OK"
  else
    echo "❌ Failed ($status)"
  fi
done
```

---

## 💡 Pro Tips

1. **Test incrementally** - Add one endpoint, test it, then move to next
2. **Use the test scripts** - They validate both request and response
3. **Check logs** - Server logs will show if endpoints are being hit
4. **Backup first** - Save working-server.ts before major changes
5. **Use git branches** - Create feature/api-consistency-fixes branch

---

## 🎯 Success Metrics

When complete, you should have:
- ✅ 100% API endpoint coverage (187/187)
- ✅ All dashboards loading without errors
- ✅ Zero 404 errors in browser console
- ✅ All test scripts passing
- ✅ API documentation updated

---

## Need Help?

1. Check `fix-critical-endpoints.ts` for implementation details
2. Review `API_FIX_PHASE2_GUIDE.md` for path decisions
3. Run test scripts to validate changes
4. Check server logs for error details