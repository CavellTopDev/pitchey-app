# Frontend Code Updates Required to Match Database Structure

## Summary
The main issue is that your frontend code is using incorrect field names when calling the backend API. The database `follows` table uses `creator_id` (not `target_user_id` or `followingId`), and this mismatch is causing the follow functionality to fail.

## Database Structure (Actual)
```sql
follows table:
- id (integer, PRIMARY KEY)
- follower_id (integer, NOT NULL) - The user who is following
- pitch_id (integer, NULL) - ID of followed pitch (if following a pitch)
- creator_id (integer, NULL) - ID of followed user (if following a user)
- followed_at (timestamp) - When the follow occurred

CONSTRAINT: Either pitch_id OR creator_id must be set, never both
```

## Critical Files to Fix

### 1. `/frontend/src/services/social.service.ts`

#### CURRENT (WRONG):
```typescript
// Lines 43-46
async followUser(userId: number): Promise<any> {
  return this.makeRequest(`${this.baseUrl}/follow`, {
    method: 'POST',
    body: JSON.stringify({
      followingId: userId,  // ❌ WRONG
      followType: 'user'
    })
  });
}

// Lines 73-76
async followPitch(pitchId: number): Promise<any> {
  return this.makeRequest(`${this.baseUrl}/follow`, {
    method: 'POST', 
    body: JSON.stringify({
      followingId: pitchId,  // ❌ WRONG
      followType: 'pitch'
    })
  });
}
```

#### SHOULD BE:
```typescript
async followUser(userId: number): Promise<any> {
  return this.makeRequest(`${this.baseUrl}/follow`, {
    method: 'POST',
    body: JSON.stringify({
      creatorId: userId,    // ✅ CORRECT - matches database column
      pitchId: null         // ✅ CORRECT - explicitly null for user follows
    })
  });
}

async followPitch(pitchId: number): Promise<any> {
  return this.makeRequest(`${this.baseUrl}/follow`, {
    method: 'POST',
    body: JSON.stringify({
      pitchId: pitchId,     // ✅ CORRECT - matches database column
      creatorId: null       // ✅ CORRECT - explicitly null for pitch follows
    })
  });
}
```

### 2. Update the Follow Interface

#### CURRENT (WRONG):
```typescript
export interface Follow {
  id: number;
  followerId: number;
  followingId: number;        // ❌ WRONG - doesn't exist in database
  followType: 'user' | 'pitch'; // ❌ WRONG - not a database field
  createdAt: string;          // ❌ WRONG - should be followedAt
  follower?: User;
  following?: User | Pitch;
}
```

#### SHOULD BE:
```typescript
export interface Follow {
  id: number;
  followerId: number;
  creatorId?: number;         // ✅ CORRECT - nullable, for user follows
  pitchId?: number;           // ✅ CORRECT - nullable, for pitch follows
  followedAt: string;         // ✅ CORRECT - matches database column
  follower?: User;
  creator?: User;             // ✅ CORRECT - when following a user
  pitch?: Pitch;              // ✅ CORRECT - when following a pitch
}
```

### 3. Fix Unfollow Methods

#### CURRENT (WRONG):
```typescript
// Lines 58-61
async unfollowUser(userId: number): Promise<any> {
  return this.makeRequest(`${this.baseUrl}/unfollow`, {
    method: 'POST',
    body: JSON.stringify({
      followingId: userId,  // ❌ WRONG
      followType: 'user'
    })
  });
}
```

#### SHOULD BE:
```typescript
async unfollowUser(userId: number): Promise<any> {
  return this.makeRequest(`${this.baseUrl}/unfollow`, {
    method: 'POST',
    body: JSON.stringify({
      creatorId: userId,    // ✅ CORRECT
      pitchId: null         // ✅ CORRECT
    })
  });
}
```

### 4. Fix Check Follow Status

#### CURRENT (WRONG):
```typescript
// Lines 100-103
const params = new URLSearchParams({
  targetId: targetId.toString(),  // ❌ WRONG
  type
});
```

#### SHOULD BE:
```typescript
const params = new URLSearchParams();
if (type === 'user') {
  params.append('creatorId', targetId.toString());  // ✅ CORRECT
} else if (type === 'pitch') {
  params.append('pitchId', targetId.toString());    // ✅ CORRECT
}
```

## Backend Expected Format

The backend expects these exact field names in POST requests:
- For following a user: `{ creatorId: number, pitchId: null }`
- For following a pitch: `{ pitchId: number, creatorId: null }`
- NOT `followingId`, `targetId`, or `targetUserId`

## Why This Matters

1. **Follow/Unfollow Won't Work**: The backend rejects requests with incorrect field names
2. **500 Errors**: You're seeing "violates check constraint" errors because the backend can't map `followingId` to the correct database columns
3. **Data Not Showing**: Following lists show "0 pitches" and "Invalid Date" because the data isn't being saved correctly

## Quick Test After Fixes

Once you update these files, test with:
```bash
# Follow a user
curl -X POST http://localhost:8001/api/follows/follow \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"creatorId": 1003, "pitchId": null}'

# Follow a pitch  
curl -X POST http://localhost:8001/api/follows/follow \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pitchId": 45, "creatorId": null}'
```

## Additional Notes

- The database column is `followed_at` not `created_at` or `createdAt`
- The database uses `creator_id` for following users, not `target_user_id`
- Always send explicit `null` for the unused field (either `pitchId` or `creatorId`)
- The `followType` field doesn't exist in the database - the type is determined by which field is non-null

This should resolve all the follow functionality issues you're experiencing.