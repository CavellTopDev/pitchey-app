# Frontend-Backend Endpoint Mismatches Report

## Overview
This document details all the endpoint mismatches between the frontend and backend, including endpoints that exist but aren't properly connected.

## 1. CRITICAL BACKEND ENDPOINTS NOT USED BY FRONTEND

These backend endpoints exist and work but the frontend is NOT calling them:

### Authentication & User Management
- ✅ Backend has `/api/auth/creator/login` → ❌ Frontend should use this for creator login
- ✅ Backend has `/api/auth/investor/login` → ❌ Frontend should use this for investor login
- ✅ Backend has `/api/auth/production/login` → ❌ Frontend should use this for production login
- ✅ Backend has `/api/auth/login` → Universal login endpoint not being used

### Dashboard Endpoints
- ✅ Backend has `/api/creator/dashboard` → Frontend calls this correctly
- ✅ Backend has `/api/investor/dashboard` → Frontend calls this correctly
- ✅ Backend has `/api/production/dashboard` → Frontend calls this correctly

### Pitch Management (CRITICAL DISCONNECTS)
- ✅ Backend has `/api/pitches/public` → Frontend uses this correctly for marketplace
- ✅ Backend has `/api/pitches/trending` → ❌ Frontend NOT using (duplicates logic instead)
- ✅ Backend has `/api/pitches/new` → ❌ Frontend NOT using (calls public endpoint instead)
- ✅ Backend has `/api/pitches/search` → ❌ Frontend NOT using dedicated search
- ✅ Backend has `/api/pitches/all` → Added recently, frontend not using

### Investment & Portfolio
- ✅ Backend has `/api/investor/portfolio` → Frontend now calls this
- ✅ Backend has `/api/investor/portfolio/summary` → ❌ Frontend NOT using
- ✅ Backend has `/api/investor/portfolio/performance` → ❌ Frontend NOT using
- ✅ Backend has `/api/investor/investments` → ❌ Frontend NOT using
- ✅ Backend has `/api/investments/track` → ❌ Frontend NOT using

### Messaging System
- ✅ Backend has `/api/messages` → Frontend calls this
- ✅ Backend has `/api/messages/send` → ❌ Frontend NOT using correctly
- ✅ Backend has `/api/messages/mark-read` → ❌ Frontend NOT using
- ✅ Backend has `/api/messages/ws` → ❌ WebSocket endpoint not connected

### Analytics
- ✅ Backend has `/api/analytics/pitch/{id}` → ❌ Frontend NOT using
- ✅ Backend has `/api/analytics/track-view` → ❌ Frontend NOT tracking views
- ✅ Backend has `/api/analytics/track-engagement` → ❌ Frontend NOT tracking
- ✅ Backend has `/api/analytics/export` → ❌ Frontend NOT using

### Social Features
- ✅ Backend has `/api/follows/check` → ❌ Frontend NOT using
- ✅ Backend has `/api/follows/followers` → ❌ Frontend NOT using
- ✅ Backend has `/api/follows/following` → ❌ Frontend NOT using
- ✅ Backend has `/api/follows/follow` → Frontend uses this
- ✅ Backend has `/api/follows/unfollow` → Frontend uses this

### NDA Management
- ✅ Backend has `/api/nda/pending` → Added recently, frontend not fully integrated
- ✅ Backend has `/api/nda/active` → Added recently, frontend not fully integrated
- ✅ Backend has `/api/ndas/request` → Frontend trying to use `/api/nda/request` (wrong path)
- ✅ Backend has `/api/ndas/signed` → ❌ Frontend NOT using

### Production Company Features
- ✅ Backend has `/api/production/submissions` → Added recently
- ✅ Backend has `/api/production/projects` → ❌ Frontend NOT using
- ✅ Backend has `/api/production/offers` → ❌ Frontend NOT using
- ✅ Backend has `/api/production/timeline` → ❌ Frontend NOT using

### Admin Features
- ✅ Backend has `/api/admin/dashboard` → ❌ No admin panel in frontend
- ✅ Backend has `/api/admin/users` → ❌ No admin panel in frontend
- ✅ Backend has `/api/admin/moderate` → ❌ No admin panel in frontend

## 2. FRONTEND CALLING NON-EXISTENT ENDPOINTS

These endpoints are called by the frontend but DON'T exist in the backend:

### Authentication
- ❌ Frontend calls `/api/auth/2fa/setup` → Backend doesn't have 2FA
- ❌ Frontend calls `/api/auth/2fa/verify` → Backend doesn't have 2FA
- ❌ Frontend calls `/api/auth/2fa/disable` → Backend doesn't have 2FA
- ❌ Frontend calls `/api/auth/sessions` → Backend doesn't have session management
- ❌ Frontend calls `/api/auth/sessions/revoke-all` → Not implemented

### User Management
- ❌ Frontend calls `/api/user/account` → Should use `/api/profile`
- ❌ Frontend calls `/api/user/settings` → Should use `/api/user/preferences`
- ❌ Frontend calls `/api/user/stats` → Backend has specific stats endpoints
- ❌ Frontend calls `/api/users/blocked` → Not implemented

### Creator Features
- ❌ Frontend calls `/api/creator/recommendations` → Not implemented
- ❌ Frontend calls `/api/creator/notifications/read-all` → Should use `/api/notifications/*`

### Analytics & Reporting
- ❌ Frontend calls `/api/analytics/realtime` → Not implemented
- ❌ Frontend calls `/api/analytics/scheduled-reports` → Not implemented
- ❌ Frontend calls `/api/analytics/user` → Should use specific endpoints
- ❌ Frontend calls `/api/reports` → Not implemented

### Search
- ❌ Frontend calls `/api/search/ai` → Not implemented (AI search)
- ❌ Frontend calls `/api/search/saved` → Not implemented

### Miscellaneous
- ❌ Frontend calls `/api/logout` → Not needed (client-side logout)
- ❌ Frontend calls `/api/refresh-token` → Not implemented
- ❌ Frontend calls `/api/validate-token` → Should use `/api/auth/verify`

## 3. DEMO ACCOUNT ISSUES

### Working Demo Accounts
```javascript
// These work correctly with backend:
- Creator: alex.creator@demo.com (password: Demo123)
- Investor: sarah.investor@demo.com (password: Demo123)
- Production: stellar.production@demo.com (password: Demo123)
```

### Login Endpoint Issues
- Frontend login pages should use portal-specific endpoints:
  - `/api/auth/creator/login` for creators
  - `/api/auth/investor/login` for investors
  - `/api/auth/production/login` for production companies
- Currently using generic `/api/auth/login` which also works but less specific

## 4. MARKETPLACE SPECIFIC ISSUES

### Working Correctly
- ✅ Loads public pitches from `/api/pitches/public`
- ✅ Displays pitch cards properly

### Not Working/Disconnected
- ❌ Trending section duplicates logic instead of using `/api/pitches/trending`
- ❌ New releases duplicates logic instead of using `/api/pitches/new`
- ❌ Search functionality not using `/api/pitches/search`
- ❌ View tracking not calling `/api/analytics/track-view`
- ❌ Genre/format filters hardcoded instead of using `/api/config/*`

## 5. CRITICAL FIXES NEEDED

### Priority 1 - Authentication
1. Update frontend auth service to use portal-specific login endpoints
2. Remove 2FA calls until backend implements it
3. Fix session management or remove the UI for it

### Priority 2 - Data Loading
1. Use `/api/pitches/trending` for trending pitches
2. Use `/api/pitches/new` for new releases
3. Implement proper view tracking with `/api/analytics/track-view`
4. Connect investment tracking endpoints

### Priority 3 - Features
1. Connect messaging WebSocket endpoint
2. Implement follow/follower lists using backend endpoints
3. Connect NDA management properly (fix path from `/api/nda/` to `/api/ndas/`)
4. Add admin panel for admin endpoints

### Priority 4 - Cleanup
1. Remove calls to non-existent endpoints
2. Update user profile/settings to use correct endpoints
3. Implement missing analytics connections

## 6. HARDCODED DATA TO FIX

### Frontend Services
- Genres and formats hardcoded in Marketplace.tsx (lines 61-79)
- Should use `/api/config/genres` and `/api/config/formats`

### Mock Data Returns
- Many services return mock data on error instead of proper error handling
- Investment dashboard returns fake portfolio data
- Analytics returns fake metrics

## Summary

- **41 backend endpoints** not being used by frontend
- **28 frontend calls** to non-existent endpoints
- **Critical disconnects** in authentication, analytics, and investment tracking
- **Marketplace** partially working but missing optimization endpoints
- **Demo accounts** work but could use portal-specific endpoints