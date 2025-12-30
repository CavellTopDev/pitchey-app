# Cloudflare Free Tier Deployment Guide

## Overview
This guide explains how the Pitchey platform has been optimized to work within Cloudflare's free tier limitations while maintaining essential functionality for all three portals (Creator, Investor, Production).

## Free Tier Limitations & Solutions

### 1. **No WebSocket Support** ❌
**Limitation:** WebSockets require paid Durable Objects
**Solution:** Implemented polling-based real-time updates
- Polling interval: 30 seconds (configurable)
- Smart polling: Reduces frequency when user is inactive
- Endpoints:
  - `/api/poll/notifications` - Get new notifications
  - `/api/poll/messages` - Get new messages
  - `/api/poll/dashboard` - Get dashboard updates
  - `/api/poll/all` - Get all updates in one request

### 2. **10ms CPU Time Limit** ⏱️
**Limitation:** Each request must complete within 10ms
**Solutions Implemented:**
- **Aggressive KV Caching:** All GET requests cached for 30-300 seconds
- **Optimized Database Queries:** Using indexes and simple queries only
- **Connection Pooling:** Reusing database connections
- **Lazy Loading:** Compute-heavy operations deferred or cached

### 3. **100,000 Requests/Day Limit** 📊
**Limitation:** Maximum 100k requests per day across all users
**Solutions Implemented:**
- **Rate Limiting:** 
  - Auth: 5 requests/minute
  - API: 30 requests/minute  
  - Polling: 120 requests/minute
- **Client-Side Caching:** Frontend caches responses for 5 minutes
- **Batch Polling:** Multiple data types fetched in single request

### 4. **1GB KV Storage Limit** 💾
**Limitation:** Maximum 1GB storage in KV namespace
**Solutions Implemented:**
- **TTL Expiration:** All cache entries expire (5 seconds to 5 minutes)
- **Selective Caching:** Only critical data cached
- **No Session Storage:** Using JWT tokens instead of server sessions

### 5. **No R2 Storage** 📁
**Limitation:** R2 requires paid plan
**Solution:** File uploads disabled on free tier (returns friendly error)

## Deployment Instructions

### Prerequisites
- Node.js 18+ installed
- Cloudflare account (free)
- Neon PostgreSQL database (free tier)

### Step 1: Install Dependencies
```bash
npm install
npm install -g wrangler
```

### Step 2: Configure Cloudflare
```bash
# Login to Cloudflare
wrangler login

# Create KV namespace
wrangler kv:namespace create "KV"
# Copy the ID and update wrangler.toml
```

### Step 3: Set Environment Variables
```bash
# Set required secrets
wrangler secret put DATABASE_URL
# Enter: postgresql://user:pass@host/dbname

wrangler secret put JWT_SECRET  
# Enter: your-secret-key-here
```

### Step 4: Deploy
```bash
# Run the deployment script
chmod +x deploy-free-tier.sh
./deploy-free-tier.sh

# Or manually:
npm run build:worker
wrangler deploy
```

### Step 5: Update Frontend
Update `frontend/.env.production`:
```env
VITE_API_URL=https://your-worker.workers.dev
VITE_WS_URL=https://your-worker.workers.dev
VITE_ENABLE_WEBSOCKET=false
VITE_POLL_INTERVAL=30000
```

## Testing

### Run Tests
```bash
chmod +x test-free-tier.sh
./test-free-tier.sh
```

### Manual Testing
1. **Test Polling:**
   ```bash
   curl https://your-worker.workers.dev/api/poll/notifications \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Test Caching:**
   ```bash
   # First request (cache miss)
   curl -i https://your-worker.workers.dev/api/browse
   # Look for: X-Cache: MISS
   
   # Second request (cache hit)
   curl -i https://your-worker.workers.dev/api/browse
   # Look for: X-Cache: HIT
   ```

3. **Test Rate Limiting:**
   ```bash
   # Make rapid requests
   for i in {1..20}; do
     curl https://your-worker.workers.dev/api/auth/login -X POST
   done
   # Should see 429 Too Many Requests
   ```

## Performance Optimization Tips

### Database Queries
- Use simple SELECT queries with LIMIT
- Always use indexed columns in WHERE clauses
- Avoid JOINs when possible (denormalize if needed)
- Cache query results aggressively

### Caching Strategy
```typescript
// Cache configuration per endpoint type
const CACHE_CONFIGS = {
  browse: { ttl: 300 },    // 5 minutes
  profile: { ttl: 60 },     // 1 minute  
  dashboard: { ttl: 30 },   // 30 seconds
  static: { ttl: 3600 }     // 1 hour
};
```

### Frontend Optimization
- Enable service worker caching
- Use React Query with stale-while-revalidate
- Batch API requests when possible
- Implement optimistic UI updates

## Monitoring

### Daily Limits Dashboard
Check your usage at: https://dash.cloudflare.com

Key metrics to watch:
- Requests: Stay under 100k/day
- CPU Time: Average should be <10ms
- KV Operations: Under 100k reads/day
- KV Storage: Under 1GB

### Alerts
Set up alerts when approaching limits:
```javascript
// Add to worker
if (dailyRequests > 90000) {
  console.error('WARNING: Approaching daily request limit');
}
```

## Upgrade Path

When you need to upgrade to paid tier:

### Triggers for Upgrade
- More than 100k requests/day needed
- Real-time features required (WebSocket)
- File storage needed (R2)
- CPU-intensive operations
- Analytics and monitoring

### Migration Steps
1. **Enable Paid Features in wrangler.toml:**
   - Uncomment Durable Objects sections
   - Uncomment R2 bucket configurations
   - Uncomment Queue configurations

2. **Switch from Polling to WebSocket:**
   - In frontend, swap PollingProvider for WebSocketProvider
   - Enable WebSocket routes in worker

3. **Enable Advanced Features:**
   - Analytics Engine for metrics
   - Queues for background processing
   - Workers KV for larger cache storage

## Troubleshooting

### Common Issues

**1. "CPU Limit Exceeded" Errors**
- Reduce database query complexity
- Increase cache TTL values
- Remove unnecessary computations

**2. "Rate Limit" Errors (429)**
- Increase polling intervals
- Implement exponential backoff
- Use batch endpoints

**3. Cache Not Working**
- Verify KV namespace is bound correctly
- Check TTL values aren't too short
- Ensure keys are unique per user/request

**4. Slow Response Times**
- Check database indexes
- Verify cache is being hit
- Use simpler queries

## Support

For issues or questions:
- GitHub Issues: [your-repo/issues]
- Documentation: [/docs]
- Community: [discord/slack]

## Summary

The free tier optimizations enable:
✅ All three portals (Creator, Investor, Production) fully functional
✅ Authentication and authorization working
✅ Dashboard data and analytics available
✅ Browse and search functionality
✅ NDA workflows operational
✅ Rate limiting and security in place

Limitations on free tier:
❌ No real-time updates (30-second delay)
❌ No file uploads
❌ No WebSocket support
❌ Limited to 100k requests/day
❌ 10ms CPU time per request

When your platform grows beyond these limits, upgrading to Cloudflare's paid tier ($5/month) will unlock all advanced features.