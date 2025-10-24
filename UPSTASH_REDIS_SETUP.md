# Upstash Redis Configuration Guide

## Current Status
✅ **Upstash Redis is fully integrated and configured in production**

## Configuration Details

### Environment Variables (Already Set)
```bash
# Upstash Redis REST API
UPSTASH_REDIS_REST_URL=https://chief-anteater-20186.upstash.io
UPSTASH_REDIS_REST_TOKEN=AU7aAAIncDI3ZGVjNWMxZGUyOWQ0ZmYyYjI4NzdkYjM4OGMxZTE3NnAyMjAxODY

# Cache Settings
CACHE_ENABLED=true
CACHE_TTL=300  # 5 minutes default
```

### Features Using Upstash Redis

1. **Dashboard Metrics Caching**
   - TTL: 5 minutes
   - Reduces database load significantly

2. **Public Pitches Cache**
   - TTL: 5 minutes
   - Improves browse page performance

3. **Search Results Cache**
   - TTL: 10 minutes
   - Speeds up repeated searches

4. **User Session Cache**
   - TTL: 24 hours
   - Faster authentication checks

5. **View Count Tracking**
   - Rate limiting per IP
   - Prevents view count manipulation

## Implementation Details

### Cache Service (`src/services/cache.service.ts`)
The platform uses a smart caching strategy:
1. Tries Upstash Redis first (production)
2. Falls back to native Redis (local development)
3. Falls back to in-memory cache (if Redis unavailable)

### Automatic Fallback
```typescript
// Priority order:
1. Redis Cluster (for distributed deployments)
2. Native Redis (for local development) 
3. Upstash Redis (for serverless/Deno Deploy)
4. In-memory cache (fallback)
```

## Monitoring

### Check Cache Status
```bash
curl https://pitchey-backend-fresh.deno.dev/api/cache/status
```

### Upstash Dashboard
- Login: https://console.upstash.com
- View metrics, commands, and performance
- Monitor usage against free tier limits

## Free Tier Limits
- **Commands**: 10,000/day
- **Storage**: 256MB
- **Bandwidth**: 10GB/month
- **Max Connections**: 1000

## Troubleshooting

### Cache Not Working
1. Check environment variables are set
2. Verify Upstash credentials are valid
3. Check console logs for connection errors
4. Platform will auto-fallback to memory cache

### Performance Issues
1. Monitor cache hit rates
2. Adjust TTL values if needed
3. Check Upstash dashboard for usage
4. Consider upgrading plan if hitting limits

## Local Development
For local development without Upstash:
```bash
# Option 1: Use local Redis
redis-server
REDIS_URL=redis://localhost:6379

# Option 2: Disable cache (uses memory fallback)
CACHE_ENABLED=false
```

## Benefits
- ✅ Serverless - no infrastructure to manage
- ✅ Global edge locations
- ✅ REST API - works with Deno Deploy
- ✅ Automatic failover
- ✅ Pay-per-use pricing
- ✅ Free tier sufficient for MVP

---

**Status**: Fully configured and operational in production
**Dashboard**: https://console.upstash.com
**Support**: https://docs.upstash.com