# Frontend Database Mismatches Report

## Overview
This report documents mismatches between the frontend code and the actual database schema in the Pitchey application. The primary issues relate to the follows table structure and API parameter naming conventions.

## Key Database Schema Facts
- The `follows` table uses `creator_id` (not `target_user_id` or `targetUserId`)
- The `follows` table has columns: `id`, `follower_id`, `pitch_id`, `creator_id`, `followed_at`
- Either `pitch_id` OR `creator_id` must be set, not both (enforced by constraint)

## Critical Mismatches Found

### 1. Social Service API Parameter Mismatch
**File:** `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/services/social.service.ts`

**Lines 43, 58, 73, 88:** Using `followingId` parameter name
**Current:**
```typescript
// Line 43
followingId: userId,

// Line 58  
followingId: userId,

// Line 73
followingId: pitchId,

// Line 88
followingId: pitchId,
```

**Issue:** The frontend is sending `followingId` but the database schema expects either `creator_id` or `pitch_id` depending on the follow type.

**Fix Needed:** Change the API calls to use the correct parameter names:
- For user follows: use `creatorId` instead of `followingId`
- For pitch follows: use `pitchId` instead of `followingId`

### 2. Follow Interface Type Mismatch
**File:** `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/services/social.service.ts`

**Lines 8-15:** Follow interface definition
**Current:**
```typescript
export interface Follow {
  id: number;
  followerId: number;
  followingId: number;  // ❌ INCORRECT
  followType: 'user' | 'pitch';
  createdAt: string;
  follower?: User;
  following?: User | Pitch;
}
```

**Issue:** The interface uses `followingId` but the database has separate `creator_id` and `pitch_id` fields.

**Fix Needed:** Update the interface to match the database schema:
```typescript
export interface Follow {
  id: number;
  followerId: number;
  pitchId?: number;      // ✅ CORRECT - nullable
  creatorId?: number;    // ✅ CORRECT - nullable  
  followedAt: string;    // ✅ CORRECT - matches DB column name
  follower?: User;
  creator?: User;        // ✅ CORRECT - when following a user
  pitch?: Pitch;         // ✅ CORRECT - when following a pitch
}
```

### 3. Profile Page API Query Parameter Mismatch
**File:** `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/pages/Profile.tsx`

**Line 86:** Using `creatorId` query parameter
**Current:**
```typescript
const response = await fetch(`${apiUrl}/api/follows/followers?creatorId=${user.id}`, {
```

**Issue:** This appears to be sending `creatorId` as a query parameter, but based on the follows table structure, this should likely be a different parameter name depending on the API endpoint implementation.

**Fix Needed:** Verify the backend API expects `creatorId` or if it should be `userId` or another parameter name.

### 4. Creator Dashboard API Query Parameter
**File:** `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/pages/CreatorDashboard.tsx`

**Line 56:** Using `creatorId` query parameter
**Current:**
```typescript
userId ? apiClient.get(`/api/follows/followers?creatorId=${userId}`) : Promise.resolve({ success: false }),
```

**Issue:** Similar to Profile page - using `creatorId` parameter which may not match backend expectations.

### 5. Follow Check API Parameter Names
**File:** `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/services/social.service.ts`

**Lines 100-103:** Check follow status parameters
**Current:**
```typescript
const params = new URLSearchParams({
  targetId: targetId.toString(),
  type
});
```

**Issue:** Using `targetId` parameter, but the backend likely expects `creatorId` or `pitchId` depending on the type.

**Fix Needed:** Update to use type-specific parameter names:
```typescript
const params = new URLSearchParams();
if (type === 'user') {
  params.append('creatorId', targetId.toString());
} else if (type === 'pitch') {
  params.append('pitchId', targetId.toString());
}
```

## Additional Observations

### 6. FollowButton Component Logic
**File:** `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/components/FollowButton.tsx`

The FollowButton component correctly uses separate `creatorId` and `pitchId` props and calls the appropriate social service methods. However, since the social service methods are using incorrect parameter names, the button functionality will likely fail.

### 7. API Endpoint Consistency
Multiple files are making calls to `/api/follows/*` endpoints with potentially inconsistent parameter naming:
- Some use `creatorId`
- Some use `followingId` 
- Some use `targetId`

## Recommended Fixes

### Priority 1: Critical API Parameter Fixes
1. **Update social.service.ts** to use correct parameter names:
   - Replace `followingId` with `creatorId` for user follows
   - Replace `followingId` with `pitchId` for pitch follows
   - Update the Follow interface to match database schema

2. **Update follow check logic** to use type-specific parameters instead of generic `targetId`

### Priority 2: Interface Updates
3. **Update Follow interface** to match database schema exactly
4. **Remove `followType` field** from interface if not stored in database
5. **Update `createdAt` to `followedAt`** to match database column name

### Priority 3: Consistency Checks
6. **Audit all `/api/follows/*` calls** to ensure consistent parameter naming
7. **Verify backend API parameter expectations** match frontend calls
8. **Update TypeScript types** throughout codebase for consistency

## Impact Assessment
- **High Impact:** Follow/unfollow functionality likely broken due to parameter mismatches
- **Medium Impact:** Social stats and follower counts may be incorrect
- **Low Impact:** UI components will render but with incorrect data

## Testing Requirements
After implementing fixes:
1. Test user follow/unfollow functionality
2. Test pitch follow/unfollow functionality  
3. Verify follower/following counts display correctly
4. Test FollowButton component in all contexts
5. Verify social stats API integration

## Files Requiring Updates
1. `/frontend/src/services/social.service.ts` - Critical
2. `/frontend/src/components/FollowButton.tsx` - Testing needed
3. `/frontend/src/pages/Profile.tsx` - Parameter verification
4. `/frontend/src/pages/CreatorDashboard.tsx` - Parameter verification
5. `/frontend/src/pages/Following.tsx` - Testing needed after fixes

This report should be used as a guide for implementing the necessary database schema alignment fixes across the frontend codebase.