# Creator Dashboard Production Integration Prompt

## Overview
This prompt will help you wire up the CreatorDashboardTest component at https://pitchey.pages.dev/creator/dashboard to connect with your production backend endpoints on Deno Deploy, using Upstash Redis for caching and Neon PostgreSQL for data persistence.

## Production Infrastructure
- **Frontend**: Cloudflare Pages (https://pitchey.pages.dev)
- **Backend API**: Deno Deploy (https://pitchey-backend-fresh.deno.dev)
- **Database**: Neon PostgreSQL
- **Cache**: Upstash Redis
- **WebSocket**: wss://pitchey-backend-fresh.deno.dev/ws

## Current Test Dashboard State
The CreatorDashboardTest component currently fetches:
1. Basic stats from `/api/creator/dashboard`
2. Credit balance from payments API
3. Subscription status from payments API
4. UI-only placeholders for followers, avg rating, recent activity

## Available Production Endpoints

### Primary Dashboard Endpoint
**GET /api/creator/dashboard**
```javascript
// Returns comprehensive dashboard data with caching
{
  stats: {
    totalPitches: number,
    activePitches: number,  // Published pitches count
    totalViews: number,
    totalLikes: number,
    totalNDAs: number,
    avgRating: number,       // Average rating across all pitches
    followersCount: number,  // Total followers
    engagementRate: number   // Calculated engagement percentage
  },
  pitches: Array<{         // Top 5 recent pitches
    id: number,
    title: string,
    status: string,
    viewCount: number,
    likeCount: number,
    ndaCount: number,
    rating: number,
    createdAt: Date,
    publishedAt: Date,
    thumbnailUrl: string,
    genre: string,
    format: string
  }>,
  recentActivity: Array<{   // Recent events from analytics
    id: string,
    type: string,
    title: string,
    description: string,
    timestamp: Date,
    metadata: object
  }>,
  milestones: {            // Achievement tracking
    firstPitch: { completed: boolean },
    hundredViews: { completed: boolean, progress: number },
    thousandViews: { completed: boolean, progress: number },
    fiftyFollowers: { completed: boolean, progress: number },
    fivePitches: { completed: boolean, progress: number }
  },
  nextGoals: Array<{       // Progress towards next milestones
    type: 'views' | 'followers' | 'pitches',
    target: number,
    current: number
  }>
}
```

### Supporting Endpoints

**GET /api/follows/stats**
```javascript
// Get follower/following counts for a user
// Query params: ?userId={userId}
{
  followersCount: number,
  followingCount: number
}
```

**GET /api/ndas/pending**
```javascript
// Get pending NDA requests for creator
{
  ndas: Array<{
    id: number,
    pitchId: number,
    pitchTitle: string,
    requestorName: string,
    requestorCompany: string,
    requestedAt: Date,
    status: 'pending'
  }>,
  total: number
}
```

**GET /api/ndas/active**
```javascript
// Get active/signed NDAs
{
  ndas: Array<{
    id: number,
    pitchId: number,
    pitchTitle: string,
    signedBy: string,
    signedAt: Date,
    expiresAt: Date,
    status: 'active'
  }>,
  total: number
}
```

**GET /api/user/notifications**
```javascript
// Get user notifications
// Query params: ?limit=10&offset=0
{
  notifications: Array<{
    id: number,
    type: string,
    title: string,
    message: string,
    read: boolean,
    createdAt: Date,
    metadata: object
  }>,
  total: number,
  unreadCount: number
}
```

**GET /api/analytics/creator/realtime**
```javascript
// Real-time analytics for creator (WebSocket-powered)
{
  activeViewers: number,
  recentViews: Array<{
    pitchId: number,
    pitchTitle: string,
    viewedAt: Date,
    location: string
  }>,
  liveMetrics: {
    viewsLastHour: number,
    viewsToday: number,
    engagement: number
  }
}
```

## Integration Steps

### Step 1: Update Data Fetching
Replace the current `fetchDashboardData` function to leverage all production endpoints:

```typescript
const fetchDashboardData = async () => {
  try {
    setLoading(true);
    
    // Parallel fetch all data
    const [
      dashboardResponse, 
      creditsData, 
      subscriptionData,
      notificationsResponse,
      ndaPendingResponse,
      ndaActiveResponse
    ] = await Promise.all([
      apiClient.get('/api/creator/dashboard'),
      paymentsAPI.getCreditBalance(),
      paymentsAPI.getSubscriptionStatus(),
      apiClient.get('/api/user/notifications?limit=5'),
      apiClient.get('/api/ndas/pending'),
      apiClient.get('/api/ndas/active')
    ]);
    
    if (dashboardResponse.success) {
      const data = dashboardResponse.data;
      
      // Primary stats from dashboard endpoint
      setStats({
        totalPitches: data.stats?.totalPitches || 0,
        activePitches: data.stats?.activePitches || 0,
        totalViews: data.stats?.totalViews || 0,
      });
      
      // Extended metrics
      setTotalViews(data.stats?.totalViews || 0);
      setAvgRating(data.stats?.avgRating || 0);
      setFollowers(data.stats?.followersCount || 0);
      setEngagementRate(data.stats?.engagementRate || 0);
      
      // Recent activity from dashboard
      if (data.recentActivity) {
        setRecentActivity(data.recentActivity.slice(0, 5));
      }
      
      // Milestones and goals
      setMilestones(data.milestones);
      setNextGoals(data.nextGoals);
      
      // Top pitches for quick access
      setTopPitches(data.pitches || []);
    }
    
    // NDA Quick Status
    setNdaPending(ndaPendingResponse?.data?.total || 0);
    setNdaActive(ndaActiveResponse?.data?.total || 0);
    
    // Notifications
    setUnreadNotifications(notificationsResponse?.data?.unreadCount || 0);
    
    setCredits(creditsData);
    setSubscription(subscriptionData);
    
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    // Implement fallback or error state
  } finally {
    setLoading(false);
  }
};
```

### Step 2: Add WebSocket Integration for Real-time Updates

```typescript
// Add WebSocket connection for real-time updates
useEffect(() => {
  if (!user) return;
  
  const ws = new WebSocket('wss://pitchey-backend-fresh.deno.dev/ws');
  
  ws.onopen = () => {
    // Authenticate WebSocket connection
    ws.send(JSON.stringify({
      type: 'auth',
      token: localStorage.getItem('token')
    }));
    
    // Subscribe to dashboard updates
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'creator-dashboard',
      userId: user.id
    }));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'view-update':
        // Update view count in real-time
        setTotalViews(prev => prev + 1);
        break;
        
      case 'nda-request':
        // Update pending NDAs
        setNdaPending(prev => prev + 1);
        break;
        
      case 'new-follower':
        // Update follower count
        setFollowers(prev => prev + 1);
        break;
        
      case 'activity':
        // Add to recent activity
        setRecentActivity(prev => [data.activity, ...prev].slice(0, 5));
        break;
    }
  };
  
  return () => ws.close();
}, [user]);
```

### Step 3: Update UI Components to Use Live Data

```tsx
// Update the UI sections to use the fetched data

// NDA Quick Status - Now with live data
<div className="mt-6 p-4 bg-white rounded-xl shadow-sm">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
      <Shield className="w-5 h-5 text-purple-600" /> NDA Quick Status
    </h3>
    <button onClick={() => navigate('/creator/ndas')} className="text-sm text-purple-600 hover:text-purple-700">
      Manage
    </button>
  </div>
  <div className="grid grid-cols-2 gap-4">
    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
      <div className="flex items-center justify-between">
        <span className="text-sm text-amber-700">Pending</span>
        <Bell className="w-4 h-4 text-amber-600" />
      </div>
      <p className="text-2xl font-bold text-amber-700 mt-1">{ndaPending}</p>
    </div>
    <div className="p-3 rounded-lg bg-green-50 border border-green-200">
      <div className="flex items-center justify-between">
        <span className="text-sm text-green-700">Active</span>
        <Shield className="w-4 h-4 text-green-600" />
      </div>
      <p className="text-2xl font-bold text-green-700 mt-1">{ndaActive}</p>
    </div>
  </div>
</div>

// Engagement Rate - Now calculated from real data
<div className="bg-white rounded-xl shadow-sm p-6">
  <div className="flex items-center justify-between mb-2">
    <span className="text-gray-500 text-sm">Engagement Rate</span>
    <TrendingUp className="w-5 h-5 text-purple-500" />
  </div>
  <p className="text-2xl font-bold text-gray-900">{engagementRate.toFixed(1)}%</p>
  <p className="text-xs text-purple-500 mt-1">
    {engagementRate > 5 ? 'Above average' : 'Building momentum'}
  </p>
</div>

// Milestones - Now with real progress tracking
<div className="bg-white rounded-xl shadow-sm p-6">
  <h2 className="text-lg font-semibold text-gray-900 mb-4">Creator Milestones</h2>
  <div className="space-y-4">
    {milestones && Object.entries(milestones).map(([key, milestone]) => (
      <div 
        key={key}
        className={`p-4 rounded-lg border-2 ${
          milestone.completed ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-900">
            {formatMilestoneName(key)}
          </span>
          {milestone.completed ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <span className="text-xs text-gray-600">
              {milestone.progress}/{getMilestoneTarget(key)}
            </span>
          )}
        </div>
        {!milestone.completed && (
          <div className="w-full h-2 bg-gray-200 rounded">
            <div 
              className="h-2 bg-blue-600 rounded" 
              style={{ width: `${(milestone.progress / getMilestoneTarget(key)) * 100}%` }}
            />
          </div>
        )}
      </div>
    ))}
  </div>
</div>
```

### Step 4: Add Caching Strategy

```typescript
// Implement intelligent caching with Upstash Redis TTLs
const CACHE_KEYS = {
  DASHBOARD: (userId: string) => `dashboard:creator:${userId}`,
  FOLLOWERS: (userId: string) => `followers:${userId}`,
  NDA_STATUS: (userId: string) => `nda:status:${userId}`
};

const CACHE_TTL = {
  DASHBOARD: 300,  // 5 minutes
  FOLLOWERS: 600,  // 10 minutes  
  NDA_STATUS: 60   // 1 minute (more frequent updates)
};
```

### Step 5: Error Handling and Fallbacks

```typescript
// Add comprehensive error handling
const fetchWithFallback = async (endpoint: string, fallbackData: any) => {
  try {
    const response = await apiClient.get(endpoint);
    if (response.success) {
      return response.data;
    }
  } catch (error) {
    console.error(`Failed to fetch ${endpoint}:`, error);
  }
  return fallbackData;
};

// Use in data fetching
const dashboardData = await fetchWithFallback('/api/creator/dashboard', {
  stats: { totalPitches: 0, activePitches: 0, totalViews: 0 },
  pitches: [],
  recentActivity: [],
  milestones: {},
  nextGoals: []
});
```

## Testing the Integration

1. **Local Testing**:
   ```bash
   # Start backend on port 8001
   PORT=8001 deno run --allow-all working-server.ts
   
   # Start frontend
   cd frontend && npm run dev
   ```

2. **Production Testing**:
   - Deploy to Cloudflare Pages: `wrangler pages deploy frontend/dist --project-name=pitchey`
   - Verify at https://pitchey.pages.dev/creator/dashboard
   - Monitor WebSocket connections in browser DevTools
   - Check Redis cache hits in Upstash dashboard

## Performance Optimizations

1. **Parallel Data Fetching**: Use Promise.all() for concurrent API calls
2. **Redis Caching**: Dashboard data cached for 5 minutes
3. **WebSocket Updates**: Real-time updates without polling
4. **Lazy Loading**: Load analytics charts only when visible
5. **Request Deduplication**: Prevent duplicate API calls during component re-renders

## Security Considerations

1. **Authentication**: All endpoints require valid JWT token
2. **Role Validation**: Backend verifies user.userType === 'creator'
3. **Data Sanitization**: All user input sanitized before display
4. **Rate Limiting**: API endpoints have rate limits (100 req/min)
5. **CORS**: Properly configured for production domain

## Monitoring & Debugging

```javascript
// Add debug logging
if (process.env.NODE_ENV === 'development') {
  console.log('[Dashboard] Fetching data...', { 
    user: user?.id,
    timestamp: new Date().toISOString() 
  });
}

// Track performance
const startTime = performance.now();
await fetchDashboardData();
const loadTime = performance.now() - startTime;
console.log(`[Dashboard] Load time: ${loadTime.toFixed(2)}ms`);
```

## Next Steps

1. **Progressive Enhancement**: Start with basic dashboard, add features incrementally
2. **A/B Testing**: Test different dashboard layouts with feature flags
3. **Analytics Integration**: Track user interactions for optimization
4. **Mobile Optimization**: Ensure responsive design for all screen sizes
5. **Accessibility**: Add ARIA labels and keyboard navigation support

This integration will transform your test dashboard into a fully functional, production-ready creator dashboard with real-time updates, comprehensive analytics, and seamless user experience.