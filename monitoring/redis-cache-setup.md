# Redis/Upstash Caching Setup

## Overview
Add distributed caching to improve performance and reduce database load.

## Options Comparison

### Upstash Redis (Recommended for Serverless)
- **Free Tier**: 10,000 commands/day, 256MB
- **Serverless**: Pay per request
- **Global**: Edge locations worldwide
- **Compatible**: Works with Deno Deploy

### Redis Cloud
- **Free Tier**: 30MB, 30 connections
- **Persistent**: Always-on instance
- **Limited**: Single region in free tier

### Self-Hosted Redis
- **Cost**: Infrastructure costs
- **Control**: Full configuration control
- **Maintenance**: Requires management

## Upstash Setup (Recommended)

### 1. Create Account
1. Go to https://upstash.com
2. Sign up with GitHub/Google
3. Create database:
   - Name: `pitchey-cache`
   - Region: Choose closest to users
   - Type: Regional (for free tier)

### 2. Get Credentials
```bash
# From Upstash dashboard
UPSTASH_REDIS_REST_URL=https://YOUR_ENDPOINT.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN
```

### 3. Create Cache Service

Create `src/services/cache.service.ts`:
```typescript
// Redis caching service using Upstash
import { Redis } from "https://deno.land/x/upstash_redis@v1.22.1/mod.ts";

class CacheService {
  private redis: Redis | null = null;
  private localCache: Map<string, { value: any; expires: number }> = new Map();
  private connected = false;

  constructor() {
    this.initRedis();
  }

  private async initRedis() {
    const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

    if (!url || !token) {
      console.log("Redis not configured, using in-memory cache only");
      return;
    }

    try {
      this.redis = new Redis({
        url,
        token,
      });
      
      // Test connection
      await this.redis.ping();
      this.connected = true;
      console.log("Redis cache connected successfully");
    } catch (error) {
      console.error("Redis connection failed:", error);
      console.log("Falling back to in-memory cache");
    }
  }

  async get<T>(key: string): Promise<T | null> {
    // Check local cache first
    const local = this.localCache.get(key);
    if (local && local.expires > Date.now()) {
      return local.value as T;
    }

    // Check Redis if connected
    if (this.connected && this.redis) {
      try {
        const value = await this.redis.get(key);
        if (value) {
          // Update local cache
          this.localCache.set(key, {
            value,
            expires: Date.now() + 60000, // 1 minute local cache
          });
          return value as T;
        }
      } catch (error) {
        console.error("Redis get error:", error);
      }
    }

    return null;
  }

  async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
    // Update local cache
    this.localCache.set(key, {
      value,
      expires: Date.now() + (ttlSeconds * 1000),
    });

    // Update Redis if connected
    if (this.connected && this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
      } catch (error) {
        console.error("Redis set error:", error);
      }
    }
  }

  async delete(key: string): Promise<void> {
    // Delete from local cache
    this.localCache.delete(key);

    // Delete from Redis if connected
    if (this.connected && this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        console.error("Redis delete error:", error);
      }
    }
  }

  async flush(): Promise<void> {
    // Clear local cache
    this.localCache.clear();

    // Clear Redis if connected
    if (this.connected && this.redis) {
      try {
        await this.redis.flushdb();
      } catch (error) {
        console.error("Redis flush error:", error);
      }
    }
  }

  // Pattern-based deletion
  async deletePattern(pattern: string): Promise<void> {
    // Delete from local cache
    for (const key of this.localCache.keys()) {
      if (key.includes(pattern)) {
        this.localCache.delete(key);
      }
    }

    // Delete from Redis if connected
    if (this.connected && this.redis) {
      try {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        console.error("Redis pattern delete error:", error);
      }
    }
  }

  // Cache statistics
  getStats() {
    return {
      connected: this.connected,
      localCacheSize: this.localCache.size,
      provider: this.connected ? 'upstash' : 'memory',
    };
  }
}

export const cacheService = new CacheService();
```

### 4. Implement Caching Patterns

#### Cache-Aside Pattern
```typescript
// In pitch.service.ts
async getPublicPitches(limit: number) {
  const cacheKey = `public_pitches:${limit}`;
  
  // Try cache first
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from database
  const pitches = await db.query.pitches.findMany({
    where: eq(pitches.visibility, 'public'),
    limit,
    orderBy: desc(pitches.createdAt),
  });

  // Cache for 5 minutes
  await cacheService.set(cacheKey, pitches, 300);
  
  return pitches;
}
```

#### Write-Through Pattern
```typescript
// Update cache when data changes
async createPitch(data: PitchData) {
  // Create in database
  const pitch = await db.insert(pitches).values(data).returning();
  
  // Invalidate related caches
  await cacheService.deletePattern('public_pitches:');
  await cacheService.deletePattern(`user_pitches:${data.userId}`);
  
  // Cache the new pitch
  await cacheService.set(`pitch:${pitch.id}`, pitch, 3600);
  
  return pitch;
}
```

### 5. Cache Key Strategies

```typescript
// Consistent key naming
const CACHE_KEYS = {
  // User data
  user: (id: number) => `user:${id}`,
  userProfile: (id: number) => `user_profile:${id}`,
  userPitches: (id: number, page = 1) => `user_pitches:${id}:${page}`,
  
  // Pitch data
  pitch: (id: number) => `pitch:${id}`,
  publicPitches: (page = 1) => `public_pitches:${page}`,
  trendingPitches: () => `trending_pitches`,
  
  // Session data
  session: (token: string) => `session:${token}`,
  
  // Analytics
  viewCount: (pitchId: number) => `views:${pitchId}`,
  dailyStats: (date: string) => `stats:${date}`,
};
```

### 6. Add to Server

Update `working-server.ts`:
```typescript
import { cacheService } from "./src/services/cache.service.ts";

// Health check endpoint
if (url.pathname === "/api/health") {
  const cacheStats = cacheService.getStats();
  return jsonResponse({
    status: "healthy",
    cache: cacheStats,
    timestamp: new Date().toISOString(),
  });
}

// Use cache in endpoints
if (url.pathname === "/api/pitches/public") {
  const cached = await cacheService.get('public_pitches');
  if (cached) {
    return jsonResponse({ pitches: cached, cached: true });
  }
  
  const pitches = await PitchService.getPublicPitches();
  await cacheService.set('public_pitches', pitches, 300);
  return jsonResponse({ pitches, cached: false });
}
```

### 7. Session Storage

```typescript
// Store sessions in Redis instead of memory
class SessionManager {
  async createSession(userId: number, token: string) {
    const session = {
      userId,
      token,
      createdAt: new Date().toISOString(),
      lastAccess: new Date().toISOString(),
    };
    
    // Store for 24 hours
    await cacheService.set(`session:${token}`, session, 86400);
    return session;
  }

  async getSession(token: string) {
    return await cacheService.get(`session:${token}`);
  }

  async updateSession(token: string) {
    const session = await this.getSession(token);
    if (session) {
      session.lastAccess = new Date().toISOString();
      await cacheService.set(`session:${token}`, session, 86400);
    }
    return session;
  }

  async destroySession(token: string) {
    await cacheService.delete(`session:${token}`);
  }
}
```

## Environment Variables

Add to `.env.deploy`:
```bash
# Upstash Redis
UPSTASH_REDIS_REST_URL=https://YOUR_ENDPOINT.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN

# Cache settings
CACHE_TTL_DEFAULT=3600
CACHE_TTL_SESSION=86400
CACHE_TTL_PUBLIC=300
```

## Monitoring Cache Performance

### 1. Cache Hit Ratio
```typescript
class CacheMetrics {
  private hits = 0;
  private misses = 0;

  recordHit() {
    this.hits++;
  }

  recordMiss() {
    this.misses++;
  }

  getHitRatio() {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }

  reset() {
    this.hits = 0;
    this.misses = 0;
  }
}
```

### 2. Dashboard Metrics
- Cache hit ratio
- Average response time (cached vs uncached)
- Memory usage
- Key count
- Commands per second

## Cache Invalidation Strategies

### 1. TTL-Based
- Short TTL for frequently changing data (1-5 minutes)
- Long TTL for static data (1-24 hours)
- No TTL for permanent data (user preferences)

### 2. Event-Based
```typescript
// Invalidate on update
async updatePitch(id: number, data: any) {
  const result = await db.update(pitches).set(data).where(eq(pitches.id, id));
  
  // Clear specific caches
  await cacheService.delete(`pitch:${id}`);
  await cacheService.deletePattern('public_pitches:');
  
  return result;
}
```

### 3. Manual Invalidation
```typescript
// Admin endpoint to clear cache
if (url.pathname === "/api/admin/cache/clear" && method === "POST") {
  await cacheService.flush();
  return jsonResponse({ message: "Cache cleared" });
}
```

## Cost Optimization

### Stay Within Free Tier
1. **Optimize TTLs**: Shorter for less important data
2. **Selective Caching**: Only cache expensive queries
3. **Compression**: Store compressed JSON
4. **Batch Operations**: Use pipeline for multiple commands

### Monitor Usage
```typescript
// Track daily commands
if (url.pathname === "/api/cache/stats") {
  const stats = await redis.info();
  return jsonResponse({
    commands_today: stats.instantaneous_ops_per_sec,
    memory_used: stats.used_memory_human,
    hit_ratio: cacheMetrics.getHitRatio(),
  });
}
```

## Testing Cache

### 1. Unit Tests
```typescript
// Test cache operations
Deno.test("Cache service", async () => {
  await cacheService.set("test_key", { value: "test" }, 60);
  const result = await cacheService.get("test_key");
  assertEquals(result.value, "test");
  
  await cacheService.delete("test_key");
  const deleted = await cacheService.get("test_key");
  assertEquals(deleted, null);
});
```

### 2. Load Testing
```bash
# Test cache performance
wrk -t4 -c100 -d30s --latency \
  http://localhost:8001/api/pitches/public
```

## Troubleshooting

### Connection Issues
- Check Upstash dashboard for status
- Verify credentials in environment
- Check network connectivity
- Review quota limits

### Performance Issues
- Monitor hit ratio (aim for >80%)
- Check key expiration settings
- Review cache key design
- Consider data compression

## Next Steps

1. **Sign up** at https://upstash.com
2. **Create database** in dashboard
3. **Add credentials** to `.env.deploy`
4. **Deploy** with caching enabled
5. **Monitor** cache performance
6. **Optimize** based on metrics

## Resources

- [Upstash Docs](https://docs.upstash.com/redis)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Caching Strategies](https://aws.amazon.com/caching/best-practices/)
- [Deno Redis Client](https://deno.land/x/upstash_redis)