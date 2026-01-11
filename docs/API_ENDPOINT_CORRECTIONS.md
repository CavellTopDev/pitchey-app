# API Endpoint Corrections Required

## Overview
This document tracks API endpoint issues that need correction, including mismatched routes, incorrect response formats, missing endpoints, and authentication problems. Each issue includes the current state, expected behavior, and recommended fix.

## Priority Levels
- 🔴 **CRITICAL**: Blocks core functionality
- 🟡 **HIGH**: Affects user experience significantly  
- 🟢 **MEDIUM**: Should be fixed but has workarounds
- 🔵 **LOW**: Nice to have, cosmetic issues

---

## Authentication Endpoints

### 🔴 CRITICAL: Portal-Specific Login Responses
**Affected Endpoints:**
- `/api/auth/creator/login`
- `/api/auth/investor/login`
- `/api/auth/production/login`

**Current Issue:**
These endpoints exist for backward compatibility but don't properly set the user type in the session.

**Expected Behavior:**
Should internally use Better Auth but set the correct `userType` field in the session.

**Recommended Fix:**
```typescript
// In worker-integrated.ts
router.post('/api/auth/:portal/login', async (ctx) => {
  const { portal } = ctx.params;
  const { email, password } = await ctx.request.body().value;
  
  // Use Better Auth for authentication
  const authResponse = await betterAuth.signIn({ email, password });
  
  // Set portal-specific session data
  if (authResponse.success) {
    authResponse.session.userType = portal; // 'creator' | 'investor' | 'production'
  }
  
  return authResponse;
});
```

---

## Pitch Management Endpoints

### 🟡 HIGH: Pitch Creation Response Format
**Endpoint:** `POST /api/pitches`

**Current Issue:**
Returns only the pitch ID, not the full pitch object.

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "pitch-id",
    "title": "Pitch Title",
    "creator_id": "user-id",
    "status": "draft",
    "created_at": "2024-01-01T00:00:00Z",
    // ... other pitch fields
  }
}
```

### 🟡 HIGH: Pitch Filtering Parameters
**Endpoint:** `GET /api/pitches`

**Current Issue:**
Query parameters for filtering (genre, budget, status) are not properly parsed.

**Expected Behavior:**
- `?genre=action,thriller` - Filter by multiple genres
- `?budget_min=1000000&budget_max=5000000` - Budget range
- `?status=published` - Status filter
- `?seeking_investment=true` - Investment status

**Recommended Fix:**
```typescript
// Parse and apply filters
const filters = {
  genre: ctx.request.url.searchParams.get('genre')?.split(','),
  budget: {
    min: parseInt(ctx.request.url.searchParams.get('budget_min') || '0'),
    max: parseInt(ctx.request.url.searchParams.get('budget_max') || '999999999')
  },
  status: ctx.request.url.searchParams.get('status'),
  seeking_investment: ctx.request.url.searchParams.get('seeking_investment') === 'true'
};
```

---

## NDA Workflow Endpoints

### 🔴 CRITICAL: NDA Approval Flow
**Endpoint:** `PUT /api/ndas/:id/approve`

**Current Issue:**
Endpoint exists but doesn't trigger notifications or update related pitch access.

**Expected Behavior:**
1. Update NDA status to 'approved'
2. Grant investor access to protected content
3. Send notification to investor
4. Log the approval in audit trail

### 🟡 HIGH: NDA Document Upload
**Endpoint:** `POST /api/ndas/:id/documents`

**Current Issue:**
Custom NDA document upload not properly integrated with R2.

**Expected Behavior:**
- Accept PDF uploads up to 10MB
- Store in R2 with proper access controls
- Generate secure signed URLs for viewing

---

## Analytics Endpoints

### 🟢 MEDIUM: Analytics Data Format
**Endpoints:**
- `/api/analytics/creator`
- `/api/analytics/investor`
- `/api/analytics/production`

**Current Issue:**
Time series data not properly formatted for chart libraries.

**Expected Format:**
```json
{
  "metrics": {
    "total_views": 1234,
    "unique_viewers": 567,
    "engagement_rate": 0.45
  },
  "timeSeries": {
    "views": [
      { "date": "2024-01-01", "value": 45 },
      { "date": "2024-01-02", "value": 52 }
    ],
    "engagement": [
      { "date": "2024-01-01", "value": 0.42 },
      { "date": "2024-01-02", "value": 0.48 }
    ]
  }
}
```

---

## WebSocket Events

### 🟡 HIGH: Message Format Standardization
**Current Issue:**
WebSocket messages use inconsistent formats across different event types.

**Standardized Format:**
```typescript
interface WebSocketMessage {
  type: 'notification' | 'presence' | 'draft' | 'analytics' | 'system';
  event: string; // Specific event name
  data: any; // Event-specific payload
  timestamp: string;
  userId?: string; // For user-specific events
}
```

### 🟢 MEDIUM: Presence Updates
**Current Issue:**
Presence updates not properly broadcasting to relevant users.

**Expected Behavior:**
- Broadcast to users in same team/project
- Include user status (online/away/offline)
- Clean up stale presence data

---

## Search & Discovery Endpoints

### 🟡 HIGH: Search Results Pagination
**Endpoint:** `GET /api/search`

**Current Issue:**
No pagination implemented, returns all results.

**Expected Parameters:**
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20, max: 100)
- `sort`: Sort field and direction (e.g., 'created_at:desc')

**Expected Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 145,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## File Upload Endpoints

### 🔴 CRITICAL: Multiple File Upload
**Endpoint:** `POST /api/upload/multiple`

**Current Issue:**
Endpoint missing, preventing batch document uploads.

**Expected Implementation:**
```typescript
router.post('/api/upload/multiple', async (ctx) => {
  const formData = await ctx.request.formData();
  const files = formData.getAll('files');
  const uploadResults = [];
  
  for (const file of files) {
    // Validate file type and size
    // Upload to R2
    // Store metadata in database
    uploadResults.push({
      filename: file.name,
      url: uploadedUrl,
      size: file.size,
      type: file.type
    });
  }
  
  return { success: true, files: uploadResults };
});
```

---

## Investment Tracking Endpoints

### 🟢 MEDIUM: Investment Status Updates
**Endpoint:** `PUT /api/investments/:id/status`

**Current Issue:**
Status transitions not validated against business rules.

**Expected Validation:**
- Only certain status transitions allowed
- Require reason for rejection
- Notify relevant parties on status change

---

## Missing Endpoints

### 🔴 CRITICAL Endpoints Needed:
1. `POST /api/ndas/batch-request` - Request NDAs for multiple pitches
2. `GET /api/notifications/unread-count` - Get unread notification count
3. `DELETE /api/pitches/:id/documents/:docId` - Remove specific document from pitch

### 🟡 HIGH Priority Endpoints Needed:
1. `GET /api/users/:id/activity` - User activity feed
2. `POST /api/pitches/:id/clone` - Clone/duplicate a pitch
3. `GET /api/analytics/export` - Export analytics data

### 🟢 MEDIUM Priority Endpoints Needed:
1. `POST /api/users/invite` - Invite users to platform
2. `GET /api/system/maintenance` - Maintenance mode status
3. `PUT /api/users/preferences` - Update user preferences

---

## Response Format Standardization

All API responses should follow this format:

### Success Response:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "1.0"
  }
}
```

### Error Response:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "1.0"
  }
}
```

### Pagination Response:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "meta": { ... }
}
```

---

## Testing Endpoints

To test endpoint corrections:

```bash
# Test authentication flow
curl -X POST http://localhost:8001/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'

# Test pitch creation
curl -X POST http://localhost:8001/api/pitches \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"title":"Test Pitch","genre":"action","budget":1000000}'

# Test search with filters
curl "http://localhost:8001/api/pitches?genre=action&status=published&page=1&limit=10"

# Test WebSocket connection
wscat -c "ws://localhost:8001/ws" \
  -H "Cookie: session=..."
```

---

## Implementation Priority

### Phase 1 (Immediate):
- Fix authentication portal-specific issues
- Implement missing CRITICAL endpoints
- Standardize response formats

### Phase 2 (Next Sprint):
- Add pagination to all list endpoints
- Fix NDA workflow issues
- Implement batch operations

### Phase 3 (Future):
- Add missing MEDIUM priority endpoints
- Optimize performance for large datasets
- Implement advanced filtering options

---

## Monitoring & Validation

After implementing corrections:

1. **Update API tests** in `test-api-endpoints.ts`
2. **Update TypeScript types** in frontend
3. **Update API documentation** in `docs/API_REFERENCE.md`
4. **Run integration tests** to verify fixes
5. **Monitor error rates** in production

---

## Related Documents

- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Testing Checklist](./TESTING_CHECKLIST.md) - Testing procedures
- [Architecture](./ARCHITECTURE.md) - System design context