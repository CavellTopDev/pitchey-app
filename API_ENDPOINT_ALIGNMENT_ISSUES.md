# API Endpoint Alignment Issues Documentation

## Current Status
The frontend at `https://pitchey-frontend.fly.dev` is making API calls that don't align with the backend at `https://pitchey-backend.fly.dev`. This document outlines all the misaligned endpoints that need to be fixed for the business workflow to function properly.

## Critical Issues Found

### 1. Profile Endpoint (500 Error)
**Frontend Call:** `GET /api/profile`  
**Backend Issue:** Uses old `verifyToken()` function instead of `AuthService.verifySession()`  
**Error:** Returns 500 Internal Server Error  
**Location:** working-server.ts:2085-2120  
**Fix Required:** Update to use `AuthService.verifySession()` for JWT validation

### 2. Creator Dashboard Endpoint  
**Frontend Call:** `GET /api/creator/dashboard`  
**Backend Issue:** Also uses old `verifyToken()` function, returns mock data instead of real user data  
**Location:** working-server.ts:2122-2185  
**Fix Required:** Update to use `AuthService.verifySession()` and fetch real data from database

### 3. Missing User ID Mapping
**Frontend Behavior:** Uses hardcoded `userId=1001` in API calls  
**Backend Expects:** Actual database user ID (currently `1` for alex.creator@demo.com)  
**Affected Endpoints:**
- `/api/payments/credits/balance?userId=1001`
- `/api/payments/subscription-status?userId=1001`

## Working Endpoints

### Authentication ✅
- `POST /api/auth/creator/login` - Working
- `POST /api/auth/investor/login` - Working  
- `POST /api/auth/production/login` - Working
- `GET /api/auth/me` - Working (uses correct AuthService)

### Payments ✅
- `GET /api/payments/credits/balance` - Working (returns mock data)
- `GET /api/payments/subscription-status` - Working (returns free tier)

## Endpoints That Don't Exist (404)

### User Management
- `GET /api/user/profile` - Not found (frontend expects this)
- `GET /api/user/dashboard` - Not found
- `GET /api/user/credits/balance` - Not found (should use `/api/payments/credits/balance`)

### Pitches
- `GET /api/pitches/user` - Returns 404 "Pitch not found"
- `GET /api/pitches` - Needs proper implementation
- `POST /api/pitches` - Needs proper implementation
- `GET /api/pitches/:id` - Needs proper implementation

## Frontend Service Mappings

### apiServices.ts Expectations
```javascript
// Profile Services
getUserProfile: '/api/profile' // Currently broken (500 error)
updateProfile: 'PUT /api/profile' // Not tested

// Dashboard Services  
getCreatorDashboard: '/api/creator/dashboard' // Returns mock data
getInvestorDashboard: '/api/investor/dashboard' // Not tested
getProductionDashboard: '/api/production/dashboard' // Not tested

// Payment Services
getCreditBalance: '/api/payments/credits/balance' // Working
getSubscriptionStatus: '/api/payments/subscription-status' // Working
purchaseCredits: 'POST /api/payments/credits/purchase' // Not tested

// Pitch Services
getUserPitches: '/api/pitches/user' // Returns 404
createPitch: 'POST /api/pitches' // Not tested
getPitchById: '/api/pitches/:id' // Not tested
```

## Backend Available Routes

### Currently Implemented in working-server.ts
1. **Authentication**
   - `/api/auth/creator/login` ✅
   - `/api/auth/investor/login` ✅
   - `/api/auth/production/login` ✅
   - `/api/auth/me` ✅
   - `/api/auth/verify-email/:token`
   - `/api/auth/password-reset`

2. **User/Profile**
   - `/api/profile` ❌ (500 error - uses wrong auth)
   - `/api/creator/dashboard` ⚠️ (returns mock data)
   - `/api/investor/dashboard` ⚠️ (returns mock data)
   - `/api/production/dashboard` ⚠️ (returns mock data)

3. **Payments**
   - `/api/payments/credits/balance` ✅
   - `/api/payments/credits/purchase` 
   - `/api/payments/credits/use`
   - `/api/payments/subscription-status` ✅
   - `/api/payments/subscribe`
   - `/api/payments/cancel-subscription`

4. **Pitches**
   - `/api/public/pitches` (public access)
   - `/api/public/pitch/:id` (public access)
   - `/api/pitches/:id` (authenticated)
   - `/api/pitches/:id/nda` (NDA signing)
   - `/api/pitches/:id/view` (view tracking)
   - `/api/pitches/:id/analytics`

5. **NDAs**
   - `/api/ndas/sign`
   - `/api/ndas/signed`
   - `/api/ndas/incoming-signed`
   - `/api/ndas/outgoing-signed`

6. **Messages**
   - `/api/messages`
   - `/api/messages/ws` (WebSocket)
   - `/api/messages/typing`
   - `/api/messages/conversations`

## Immediate Fixes Required

### Priority 1 - Critical for Login Flow
1. **Fix `/api/profile` endpoint**
   - Replace `verifyToken()` with `AuthService.verifySession()`
   - Return actual user data from database
   - File: working-server.ts, lines 2085-2120

2. **Fix `/api/creator/dashboard` endpoint**
   - Replace `verifyToken()` with `AuthService.verifySession()`
   - Fetch real pitches from database using PitchService
   - File: working-server.ts, lines 2122-2185

### Priority 2 - Dashboard Functionality
3. **Implement `/api/pitches/user` endpoint**
   - Add route to fetch user's pitches
   - Use PitchService.getUserPitches()

4. **Fix user ID mapping**
   - Frontend should use actual user ID from auth token
   - Remove hardcoded userId=1001 from frontend

### Priority 3 - Full Functionality
5. **Implement missing pitch endpoints**
   - `POST /api/pitches` - Create new pitch
   - `PUT /api/pitches/:id` - Update pitch
   - `DELETE /api/pitches/:id` - Delete pitch
   - `GET /api/pitches` - Get all pitches with filters

## Testing Commands

```bash
# Test profile endpoint (currently returns 500)
curl -X GET https://pitchey-backend.fly.dev/api/profile \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test creator dashboard (returns mock data)
curl -X GET https://pitchey-backend.fly.dev/api/creator/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"

# Working auth endpoint
curl -X GET https://pitchey-backend.fly.dev/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Next Steps
1. Update backend authentication in `/api/profile` and dashboard endpoints
2. Implement missing pitch management endpoints
3. Update frontend to use correct user IDs from auth token
4. Test complete workflow from login to dashboard to pitch creation
5. Deploy fixes to production

## Business Impact
- **Login Flow:** Partially working - users can authenticate but profile fetch fails
- **Dashboard:** Not functional - returns mock data instead of real user data
- **Pitch Management:** Completely broken - no endpoints implemented
- **Payment/Credits:** Working with mock data
- **NDAs:** Endpoints exist but not tested
- **Messaging:** Endpoints exist but not tested