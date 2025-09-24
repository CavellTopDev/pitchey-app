# Mock Data Analysis & Migration Plan

## Executive Summary
This document identifies all hardcoded mock data in the Pitchey platform and provides actionable workflows to replace them with real database operations.

## 1. MOCK DATA INVENTORY

### 1.1 Pitch Data (`mockPitchesData`)
**Location**: `working-server.ts` lines 76-290
**Current State**: 5 hardcoded pitch objects with fake metrics
**Used In**:
- `/api/pitches` - Returns all pitches
- `/api/pitches/:id` - Returns single pitch
- `/api/marketplace/pitches` - Public marketplace
- `/api/trending/pitches` - Trending content
- `/api/featured/pitches` - Featured content

**Mock Values Found**:
- Views: 945-2150 (fake)
- Likes: 78-156 (fake)
- Funding: $2.25M-$7.5M (fake)
- Investors: 8-15 (fake)
- Progress: 15%-60% (fake)

**ACTIONABLE WORKFLOW**:
```typescript
// REPLACE WITH:
const pitches = await db.select().from(pitches)
  .leftJoin(pitchViews, eq(pitches.id, pitchViews.pitchId))
  .leftJoin(pitchLikes, eq(pitches.id, pitchLikes.pitchId))
  .groupBy(pitches.id);
```

### 1.2 Investment Portfolio Data
**Location**: `working-server.ts` lines 1552-1609
**Current State**: Hardcoded investment returns and portfolio values

**Mock Values Found**:
- Total Invested: $150,000 (fake)
- Current Value: $171,250 (fake)
- ROI: 14.2% (fake)
- Active Investments: 5 (fake)

**ACTIONABLE WORKFLOW**:
```typescript
// CREATE TABLE: investments
CREATE TABLE investments (
  id SERIAL PRIMARY KEY,
  investor_id INT REFERENCES users(id),
  pitch_id INT REFERENCES pitches(id),
  amount DECIMAL(12,2),
  invested_at TIMESTAMP,
  current_value DECIMAL(12,2),
  status VARCHAR(50)
);

// REAL QUERY:
const portfolio = await db.select({
  totalInvested: sql`SUM(amount)`,
  currentValue: sql`SUM(current_value)`,
  roi: sql`((SUM(current_value) - SUM(amount)) / SUM(amount)) * 100`
}).from(investments).where(eq(investments.investorId, userId));
```

### 1.3 Analytics Data
**Location**: `working-server.ts` lines 2041-2053
**Current State**: Hardcoded growth metrics and engagement stats

**Mock Values Found**:
- Views Last Week: 1234 (fake)
- Views Growth: 23.5% (fake)
- Likes Growth: 18.2% (fake)
- Engagement Rate: 8.7% (fake)

**ACTIONABLE WORKFLOW**:
```typescript
// CREATE TABLE: analytics_events
CREATE TABLE analytics_events (
  id SERIAL PRIMARY KEY,
  pitch_id INT REFERENCES pitches(id),
  event_type VARCHAR(50), -- 'view', 'like', 'share'
  user_id INT,
  created_at TIMESTAMP DEFAULT NOW()
);

// REAL QUERY:
const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const analytics = await db.select({
  viewsLastWeek: sql`COUNT(*) FILTER (WHERE event_type = 'view')`,
  likesLastWeek: sql`COUNT(*) FILTER (WHERE event_type = 'like')`
}).from(analytics_events).where(gte(analytics_events.createdAt, weekAgo));
```

### 1.4 Messages & Notifications
**Location**: `working-server.ts` lines 1764-1831, 2063-2068
**Current State**: Static notification counts and fake messages

**Mock Values Found**:
- Unread: 8 (fake)
- Messages: 3 (fake)
- Investments: 2 (fake)

**ACTIONABLE WORKFLOW**:
```typescript
// Already have messages table, need notifications table:
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  type VARCHAR(50),
  title TEXT,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

// REAL QUERY:
const notifications = await db.select({
  unread: sql`COUNT(*) FILTER (WHERE is_read = false)`,
  messages: sql`COUNT(*) FILTER (WHERE type = 'message' AND is_read = false)`,
  investments: sql`COUNT(*) FILTER (WHERE type = 'investment' AND is_read = false)`
}).from(notifications).where(eq(notifications.userId, userId));
```

### 1.5 Follow/Follower Counts
**Location**: Various endpoints
**Current State**: Returns 0 or uses fake counts

**ACTIONABLE WORKFLOW**:
```typescript
// Already have follows table, optimize queries:
const followerCount = await db.select({
  count: sql`COUNT(*)`
}).from(follows).where(eq(follows.creatorId, userId));

const followingCount = await db.select({
  count: sql`COUNT(*)`
}).from(follows).where(eq(follows.followerId, userId));
```

### 1.6 Production Projects
**Location**: `working-server.ts` lines 1638-1670
**Current State**: 3 hardcoded production projects

**Mock Values Found**:
- Budget Spent: $1.2M-$5.5M (fake)
- Crew Size: 45-120 (fake)
- Progress: 30%-75% (fake)

**ACTIONABLE WORKFLOW**:
```typescript
// CREATE TABLE: productions
CREATE TABLE productions (
  id SERIAL PRIMARY KEY,
  pitch_id INT REFERENCES pitches(id),
  producer_id INT REFERENCES users(id),
  budget DECIMAL(12,2),
  spent DECIMAL(12,2),
  crew_size INT,
  status VARCHAR(50),
  progress INT,
  start_date DATE,
  end_date DATE
);
```

### 1.7 Trending/Featured Logic
**Location**: `working-server.ts` lines 4756-4790
**Current State**: Sorts mock data by fake metrics

**ACTIONABLE WORKFLOW**:
```typescript
// TRENDING: Based on recent activity
const trending = await db.select({
  ...pitches,
  recentViews: sql`COUNT(pv.id) FILTER (WHERE pv.viewed_at > NOW() - INTERVAL '7 days')`,
  recentLikes: sql`COUNT(pl.id) FILTER (WHERE pl.liked_at > NOW() - INTERVAL '7 days')`
})
.from(pitches)
.leftJoin(pitchViews, eq(pitches.id, pitchViews.pitchId))
.leftJoin(pitchLikes, eq(pitches.id, pitchLikes.pitchId))
.groupBy(pitches.id)
.orderBy(sql`recentViews + (recentLikes * 2) DESC`)
.limit(10);
```

### 1.8 Search Functionality
**Location**: `working-server.ts` lines 4679-4755
**Current State**: Filters mock arrays with string matching

**ACTIONABLE WORKFLOW**:
```typescript
// Use proper text search
const searchResults = await db.select()
  .from(pitches)
  .where(or(
    ilike(pitches.title, `%${query}%`),
    ilike(pitches.logline, `%${query}%`),
    ilike(pitches.description, `%${query}%`)
  ))
  .limit(limit);
```

## 2. IMPLEMENTATION PRIORITY

### Phase 1: Core Data (Week 1)
1. ✅ Replace pitch mock data with database queries
2. ✅ Implement real user authentication
3. ⬜ Create analytics_events table and tracking
4. ⬜ Implement real view/like counting

### Phase 2: Social Features (Week 2)
1. ⬜ Implement real follow/unfollow workflow
2. ⬜ Create notifications system
3. ⬜ Implement real messaging counts
4. ⬜ Add activity feed generation

### Phase 3: Financial Features (Week 3)
1. ⬜ Create investments table
2. ⬜ Implement portfolio calculations
3. ⬜ Add transaction history
4. ⬜ Calculate real ROI metrics

### Phase 4: Production Features (Week 4)
1. ⬜ Create productions table
2. ⬜ Implement crew management
3. ⬜ Add budget tracking
4. ⬜ Create progress reporting

## 3. DATABASE MIGRATIONS NEEDED

```sql
-- 1. Analytics Events
CREATE TABLE analytics_events (
  id SERIAL PRIMARY KEY,
  pitch_id INT REFERENCES pitches(id),
  user_id INT REFERENCES users(id),
  event_type VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Investments
CREATE TABLE investments (
  id SERIAL PRIMARY KEY,
  investor_id INT REFERENCES users(id),
  pitch_id INT REFERENCES pitches(id),
  amount DECIMAL(12,2),
  percentage DECIMAL(5,2),
  invested_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'active'
);

-- 3. Notifications
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  type VARCHAR(50),
  title TEXT,
  message TEXT,
  metadata JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Productions
CREATE TABLE productions (
  id SERIAL PRIMARY KEY,
  pitch_id INT REFERENCES pitches(id),
  producer_id INT REFERENCES users(id),
  budget DECIMAL(12,2),
  spent DECIMAL(12,2) DEFAULT 0,
  crew_size INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pre_production',
  progress INT DEFAULT 0,
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Pitch Ratings
CREATE TABLE pitch_ratings (
  id SERIAL PRIMARY KEY,
  pitch_id INT REFERENCES pitches(id),
  user_id INT REFERENCES users(id),
  rating INT CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pitch_id, user_id)
);
```

## 4. API ENDPOINTS TO UPDATE

### High Priority (Breaking functionality):
1. `/api/creator/dashboard` - ✅ Partially fixed
2. `/api/pitches` - Needs real data
3. `/api/investor/portfolio` - Returns mock portfolio
4. `/api/production/projects` - Returns mock projects
5. `/api/trending/pitches` - Uses mock sorting

### Medium Priority (Feature enhancement):
1. `/api/analytics/dashboard` - Needs real analytics
2. `/api/notifications` - Returns fake counts
3. `/api/search/pitches` - Searches mock array
4. `/api/featured/pitches` - Arbitrary selection

### Low Priority (Nice to have):
1. `/api/recommendations` - Returns random picks
2. `/api/stats/platform` - Global platform stats

## 5. FRONTEND COMPONENTS AFFECTED

### Components displaying mock data:
1. `CreatorDashboard.tsx` - ✅ Updated to fetch real data
2. `InvestorDashboard.tsx` - Shows mock portfolio
3. `ProductionDashboard.tsx` - Shows mock projects
4. `Marketplace.tsx` - May show mock pitches
5. `Analytics.tsx` - Shows fake analytics

## 6. TESTING STRATEGY

### For each mock data replacement:
1. Create test data in database
2. Verify endpoint returns real data
3. Check frontend displays correctly
4. Test edge cases (empty data, large datasets)
5. Verify performance is acceptable

## 7. ROLLBACK PLAN

### If issues occur:
1. Keep mock data as fallback
2. Use feature flags to toggle real/mock
3. Implement gradual rollout
4. Monitor error rates
5. Have database backups ready

## 8. SUCCESS METRICS

### Track after implementation:
- Real user engagement (views, likes)
- Actual investment flows
- True follower growth
- Authentic notifications
- Genuine analytics data
- Real production progress

## NEXT STEPS

1. **Immediate**: Create missing database tables
2. **Today**: Replace most critical mock data
3. **This Week**: Implement view/like tracking
4. **Next Week**: Add investment tracking
5. **Month End**: Full migration complete

---

**Note**: This migration should be done incrementally to avoid breaking the application. Each phase should be tested thoroughly before moving to the next.