# Views and Follows System Implementation

## Overview
Successfully implemented a comprehensive views tracking and follows system across all three portals (Creator, Investor, Production) with analytics, notifications, and smart suggestions.

## Database Schema

### Views Table
```sql
CREATE TABLE views (
  id UUID PRIMARY KEY,
  pitch_id UUID REFERENCES pitches(id),
  viewer_id UUID REFERENCES users(id),
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  session_id VARCHAR(255),
  duration_seconds INTEGER,
  viewed_at TIMESTAMP WITH TIME ZONE,
  country VARCHAR(2),
  city VARCHAR(100),
  device_type VARCHAR(50)
);
```

### Follows Table
```sql
CREATE TABLE follows (
  id UUID PRIMARY KEY,
  follower_id UUID REFERENCES users(id),
  following_id UUID REFERENCES users(id),
  followed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);
```

## Backend Implementation

### View Tracking Handlers (`src/handlers/views.ts`)

#### 1. **Track View Handler**
- **Endpoint**: `POST /api/views/track`
- **Features**:
  - Session-based duplicate prevention (30-minute window)
  - Duration tracking with incremental updates
  - Geo-location detection via Cloudflare headers
  - Device type detection (mobile/desktop/tablet)
  - Anonymous view support for non-logged users
  - Automatic pitch view count caching

#### 2. **View Analytics Handler**
- **Endpoint**: `GET /api/views/analytics`
- **Query Parameters**:
  - `pitchId`: Filter by specific pitch
  - `userId`: Filter by user (creator sees their pitch views)
  - `startDate/endDate`: Date range filtering
  - `groupBy`: Aggregation level (hour/day/week/month)
- **Returns**:
  - Time-series view data
  - Top viewers list (for creators)
  - Traffic sources breakdown
  - Device type distribution
  - Geographic distribution

#### 3. **Pitch Viewers Handler**
- **Endpoint**: `GET /api/views/pitch/:id`
- **Authorization**:
  - Pitch owners see detailed viewer info
  - Others see anonymized data
  - NDA-protected pitches require signed NDA
- **Returns**:
  - Viewer list with visit counts
  - View duration and device info
  - Anonymous or detailed based on permissions

### Enhanced Follows Handlers (`src/handlers/follows-enhanced.ts`)

#### 1. **Follow Action Handler**
- **Endpoint**: `POST /api/follows/action`
- **Actions**: `follow` | `unfollow`
- **Features**:
  - Instant notification to followed user
  - Updated follower/following counts
  - Prevents self-following
  - Idempotent operations

#### 2. **Follow List Handler**
- **Endpoint**: `GET /api/follows/list`
- **Types**: `followers` | `following`
- **Features**:
  - Paginated results (limit/offset)
  - Mutual follow detection
  - User metadata (pitch count, follower count)
  - Follow status for current user

#### 3. **Follow Stats Handler**
- **Endpoint**: `GET /api/follows/stats`
- **Returns**:
  - Follower/following counts
  - Mutual followers count
  - Recent followers list
  - 30-day growth chart
  - Relationship status (follows you/you follow)

#### 4. **Follow Suggestions Handler**
- **Endpoint**: `GET /api/follows/suggestions`
- **Algorithm**:
  - Users followed by people you follow (collaborative filtering)
  - Users with similar content genres
  - Popular users in your category
  - Relevance scoring system
- **Returns**: Top 20 suggestions with relevance scores

## Frontend Implementation

### View Service (`frontend/src/services/view.service.ts`)

```typescript
class ViewService {
  // Track a view with session management
  trackView(data: ViewTrackingData): Promise<any>
  
  // Start/stop duration tracking
  startViewTracking(pitchId: string): void
  stopViewTracking(pitchId: string): void
  
  // Get analytics data
  getViewAnalytics(query: ViewAnalyticsQuery): Promise<ViewAnalytics>
  
  // Get pitch viewers
  getPitchViewers(pitchId: string): Promise<PitchViewers>
  
  // Track engagement actions
  trackEngagement(pitchId: string, type: string): Promise<void>
}
```

### Follow Service (`frontend/src/services/follow.service.ts`)

```typescript
class FollowService {
  // Follow/unfollow actions
  toggleFollow(userId: string, action: string): Promise<FollowResult>
  
  // Get follower/following lists
  getFollowers(userId?: string): Promise<FollowListResponse>
  getFollowing(userId?: string): Promise<FollowListResponse>
  
  // Get statistics and growth
  getFollowStats(userId?: string): Promise<FollowStatsResponse>
  
  // Get AI-powered suggestions
  getFollowSuggestions(): Promise<User[]>
  
  // Check follow status
  isFollowing(userId: string): Promise<boolean>
}
```

### React Components

#### 1. **ViewAnalyticsDashboard Component**
- **Location**: `frontend/src/components/ViewAnalytics/ViewAnalyticsDashboard.tsx`
- **Features**:
  - Interactive charts (Line, Bar, Doughnut)
  - Time range and grouping selectors
  - Export to CSV functionality
  - Summary cards with key metrics
  - Top viewers list for creators
  - Traffic sources breakdown
  - Device type distribution

#### 2. **FollowButton Component**
- **Location**: `frontend/src/components/Follow/FollowButton.tsx`
- **Features**:
  - Real-time follow status
  - Hover state changes (Following → Unfollow)
  - Loading states
  - Size variants (sm/md/lg)
  - Style variants (primary/outline/ghost)
  - Automatic status checking
  - Login redirect for anonymous users

## Portal-Specific Features

### Creator Portal
- **View Analytics Dashboard**:
  - Detailed viewer information
  - View duration tracking
  - Traffic source analysis
  - Export capabilities
  - Growth trends over time
- **Follower Management**:
  - See who follows them
  - Track follower growth
  - Identify top viewers

### Investor Portal
- **Activity Tracking**:
  - View history
  - Following creators/companies
  - Saved pitches with view counts
- **Discovery**:
  - Follow suggestions
  - Popular creators
  - Trending content

### Production Portal
- **Engagement Metrics**:
  - Track pitch submissions views
  - Monitor team member activity
  - Analyze project interest
- **Network Building**:
  - Follow other companies
  - Track industry connections
  - Collaboration opportunities

## Key Features

### 1. **Session Management**
- Unique session IDs prevent duplicate views
- 30-minute window for view updates
- Duration tracking with periodic updates

### 2. **Privacy & Security**
- Anonymous viewing option
- IP-based tracking for non-logged users
- Owner-only detailed viewer access
- NDA-protected content restrictions

### 3. **Smart Algorithms**
- Collaborative filtering for suggestions
- Genre-based matching
- Popularity weighting
- Relevance scoring

### 4. **Real-time Updates**
- WebSocket notifications for new followers
- Live view count updates
- Instant follow status changes

### 5. **Analytics & Export**
- Multiple aggregation levels
- CSV export functionality
- Comprehensive metrics
- Visual charts and graphs

## API Endpoints Summary

### View Tracking
- `POST /api/views/track` - Track a view
- `GET /api/views/analytics` - Get analytics data
- `GET /api/views/pitch/:id` - Get pitch viewers

### Follow System
- `POST /api/follows/action` - Follow/unfollow
- `GET /api/follows/list` - Get followers/following
- `GET /api/follows/stats` - Get statistics
- `GET /api/follows/suggestions` - Get suggestions

## Testing

Run the comprehensive test script:
```bash
./test-views-follows.sh
```

This tests:
- View tracking with session management
- Analytics data retrieval
- Follow/unfollow actions
- Follower lists and stats
- Follow suggestions
- Creator-specific analytics

## Performance Optimizations

1. **Caching**:
   - View counts cached on pitch records
   - Redis caching for analytics (when available)
   - Session-based duplicate prevention

2. **Database**:
   - Indexed columns for fast queries
   - Materialized view counts
   - Efficient aggregation queries

3. **Frontend**:
   - Lazy loading of analytics
   - Debounced view tracking
   - Optimistic UI updates

## Future Enhancements

1. **Advanced Analytics**:
   - Conversion funnel tracking
   - Engagement heatmaps
   - A/B testing support

2. **Social Features**:
   - Follow notifications preferences
   - Batch follow/unfollow
   - Follow categories/lists

3. **Machine Learning**:
   - Better suggestion algorithms
   - Predictive analytics
   - Churn prediction

4. **Export Options**:
   - PDF reports
   - Scheduled email reports
   - API access for analytics

## Migration Notes

For existing deployments, run these migrations:
```sql
-- Create views table if not exists
CREATE TABLE IF NOT EXISTS views (...);

-- Create follows table if not exists  
CREATE TABLE IF NOT EXISTS follows (...);

-- Add view_count cache to pitches
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Create necessary indexes
CREATE INDEX idx_views_pitch ON views(pitch_id);
CREATE INDEX idx_follows_follower ON follows(follower_id);
```

## Conclusion

The views and follows system provides comprehensive tracking and social features across all portals. It includes privacy controls, smart suggestions, detailed analytics, and export capabilities, making it a complete solution for user engagement tracking and social networking within the platform.