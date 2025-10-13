# Phase 2: Path/Method Mismatch Resolution Guide

## Decision Framework for Each Mismatch

### 1. `/api/pitches/saved` vs `/api/saved-pitches`
**Current:**
- Frontend: GET `/api/pitches/saved`
- Backend: GET `/api/saved-pitches` (line 7486)

**Recommendation: Option A - Change frontend to `/api/saved-pitches`**

**Reasoning:**
- Backend endpoint already works and is tested
- Only 2 frontend files need updating
- Follows clearer naming convention (saved-pitches is more descriptive)

**Implementation:**
```typescript
// frontend/src/services/pitch.service.ts (line ~450)
// Change from:
const response = await apiClient.get('/api/pitches/saved');
// To:
const response = await apiClient.get('/api/saved-pitches');

// frontend/src/services/investor.service.ts (line ~280)
// Same change
```

---

### 2. `/api/ndas/{id}/status` vs `/api/nda/status/{id}`
**Current:**
- Frontend: GET `/api/ndas/{id}/status`
- Backend: GET `/api/nda/status/{id}` (line 7929)

**Recommendation: Option B - Change backend to `/api/ndas/{id}/status`**

**Reasoning:**
- Consistent with other NDA endpoints (`/api/ndas/request`, `/api/ndas/signed`)
- RESTful pattern: resource/id/action

**Implementation:**
```typescript
// working-server.ts line 7929
// Change from:
if (url.pathname.startsWith("/api/nda/status/") && method === "GET") {
// To:
if (url.pathname.match(/^\/api\/ndas\/\d+\/status$/) && method === "GET") {
  const ndaId = parseInt(url.pathname.split('/')[3]);
  // rest of implementation
```

---

### 3. `/api/follows/{userId}/check` vs `/api/follows/check?userId={id}`
**Current:**
- Frontend: GET `/api/follows/{userId}/check`
- Backend: GET `/api/follows/check?userId={id}` (line 6313)

**Recommendation: Option C - Support both patterns**

**Reasoning:**
- Both patterns are valid REST conventions
- Minimal code addition
- Maintains backward compatibility

**Implementation:**
```typescript
// working-server.ts - Add after line 6313
// Support path parameter version
if (url.pathname.match(/^\/api\/follows\/\d+\/check$/) && method === "GET") {
  const targetUserId = parseInt(url.pathname.split('/')[3]);
  // Same implementation as query param version
}
```

---

### 4. `/api/watchlist/{id}` PUT vs POST
**Current:**
- Frontend: PUT `/api/watchlist/{id}` (update)
- Backend: POST `/api/watchlist/{id}` (line 7874)

**Recommendation: Option B - Add PUT support to backend**

**Reasoning:**
- PUT is semantically correct for updates
- Frontend expectation is correct per REST standards

**Implementation:**
```typescript
// working-server.ts - Add after line 7874
if (url.pathname.startsWith("/api/watchlist/") && method === "PUT") {
  // Update watchlist item implementation
  const watchlistId = parseInt(url.pathname.split('/')[3]);
  const body = await request.json();
  // Update logic
}
```

---

### 5. `/api/notifications/mark-read` PUT vs POST
**Current:**
- Frontend: PUT `/api/notifications/mark-read`
- Backend: POST `/api/notifications/mark-read` (line 3208)

**Recommendation: Option A - Change frontend to POST**

**Reasoning:**
- This is an action, not a resource update
- POST is appropriate for marking as read
- Backend implementation is correct

**Implementation:**
```typescript
// frontend/src/services/notification.service.ts
// Change from:
await apiClient.put('/api/notifications/mark-read', { ids });
// To:
await apiClient.post('/api/notifications/mark-read', { ids });
```

---

### 6. `/api/profile` PATCH vs PUT
**Current:**
- Frontend: PATCH `/api/profile` (partial update)
- Backend: PUT `/api/profile` (line 3865)

**Recommendation: Option B - Add PATCH support to backend**

**Reasoning:**
- PATCH is correct for partial updates
- Frontend sends only changed fields
- Better REST semantics

**Implementation:**
```typescript
// working-server.ts - Add after line 3865
if (url.pathname === "/api/profile" && method === "PATCH") {
  try {
    const userId = getUserIdFromToken(request);
    const updates = await request.json();
    
    // Partial update logic - only update provided fields
    const updated = await db.update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    
    return successResponse({ profile: updated[0] });
  } catch (error) {
    return errorResponse("Failed to update profile");
  }
}
```

---

## Implementation Priority Order

### Quick Wins (< 5 min each):
1. ✅ Change frontend `/api/pitches/saved` → `/api/saved-pitches`
2. ✅ Change frontend notifications PUT → POST
3. ✅ Add PATCH support for profile

### Medium Effort (10-15 min each):
4. ✅ Update backend NDA status endpoint path
5. ✅ Add PUT support for watchlist
6. ✅ Support both follow check patterns

### Testing Required:
7. ✅ Verify all changed endpoints
8. ✅ Update API documentation
9. ✅ Run integration tests

---

## Batch Implementation Script

```bash
#!/bin/bash
# fix-path-mismatches.sh

echo "🔧 Fixing Path/Method Mismatches"

# 1. Update frontend paths
sed -i "s|/api/pitches/saved|/api/saved-pitches|g" \
  frontend/src/services/pitch.service.ts \
  frontend/src/services/investor.service.ts

# 2. Update frontend methods
sed -i "s|apiClient.put('/api/notifications/mark-read'|apiClient.post('/api/notifications/mark-read'|g" \
  frontend/src/services/notification.service.ts

echo "✅ Frontend updates complete"
echo "⚠️ Backend changes must be added manually to working-server.ts"
echo "📝 See API_FIX_PHASE2_GUIDE.md for implementation details"
```

---

## Validation Tests

```bash
#!/bin/bash
# test-phase2-fixes.sh

echo "Testing Phase 2 Fixes..."

# Test each fixed endpoint
endpoints=(
  "GET /api/saved-pitches"
  "GET /api/ndas/1/status"
  "GET /api/follows/2/check"
  "PUT /api/watchlist/1"
  "POST /api/notifications/mark-read"
  "PATCH /api/profile"
)

for endpoint in "${endpoints[@]}"; do
  method=$(echo $endpoint | cut -d' ' -f1)
  path=$(echo $endpoint | cut -d' ' -f2)
  
  response=$(curl -s -X $method "http://localhost:8001$path" \
    -H "Authorization: Bearer $TOKEN" \
    -w "\n%{http_code}")
  
  status=$(echo "$response" | tail -1)
  if [ "$status" = "200" ] || [ "$status" = "201" ]; then
    echo "✅ $endpoint - OK"
  else
    echo "❌ $endpoint - Failed (Status: $status)"
  fi
done
```