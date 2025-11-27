/**
 * Multi-Layer Caching Strategy Implementation
 * Layer 1: Memory (request-scoped)
 * Layer 2: Workers Cache API (static content)
 * Layer 3: Upstash Redis (dynamic content)
 * Layer 4: Neon Database (source of truth)
 */

import { Toucan } from 'toucan-js';
import { dbPool, withDatabase } from './worker-database-pool.ts';

interface CacheConfig {
  ttl: number;          // Time to live in seconds
  useMemory: boolean;   // Enable memory caching
  useCacheAPI: boolean; // Enable Workers Cache API
  useRedis: boolean;    // Enable Redis caching
}

const DEFAULT_CONFIGS: Record<string, CacheConfig> = {
  // Dashboard data - 5 minutes
  dashboard: {
    ttl: 300,
    useMemory: true,
    useCacheAPI: true,
    useRedis: true
  },
  
  // Notifications - 1 minute
  notifications: {
    ttl: 60,
    useMemory: true,
    useCacheAPI: false,  // Too dynamic for Cache API
    useRedis: true
  },
  
  // Pitch data - 10 minutes
  pitches: {
    ttl: 600,
    useMemory: true,
    useCacheAPI: true,
    useRedis: true
  },
  
  // User sessions - 24 hours
  sessions: {
    ttl: 86400,
    useMemory: false,    // Too large for memory
    useCacheAPI: false,  // Personal data, not cacheable
    useRedis: true
  },
  
  // Presence - 30 seconds
  presence: {
    ttl: 30,
    useMemory: true,
    useCacheAPI: false,
    useRedis: true
  }
};

class CachingService {
  private memoryCache = new Map<string, { data: any; expires: number }>();
  private redis: any;
  private cacheAPI: Cache;
  private sentry: Toucan | null = null;

  constructor(env: any, sentry?: Toucan) {
    this.redis = env.REDIS;
    this.cacheAPI = caches.default;
    this.sentry = sentry || null;
  }

  /**
   * Get data with multi-layer caching
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    configKey: keyof typeof DEFAULT_CONFIGS = 'dashboard'
  ): Promise<T> {
    const config = DEFAULT_CONFIGS[configKey];
    const now = Date.now();

    try {
      // Layer 1: Memory Cache
      if (config.useMemory) {
        const memCached = this.memoryCache.get(key);
        if (memCached && memCached.expires > now) {
          this.log(`Cache HIT (Memory): ${key}`);
          return memCached.data;
        }
      }

      // Layer 2: Workers Cache API
      if (config.useCacheAPI) {
        const cacheKey = `https://cache/${key}`;
        const cached = await this.cacheAPI.match(cacheKey);
        if (cached) {
          const data = await cached.json();
          this.log(`Cache HIT (Cache API): ${key}`);
          
          // Populate memory cache
          if (config.useMemory) {
            this.memoryCache.set(key, {
              data,
              expires: now + (config.ttl * 1000)
            });
          }
          
          return data;
        }
      }

      // Layer 3: Redis Cache
      if (config.useRedis && this.redis) {
        try {
          const redisData = await this.redis.get(key);
          if (redisData) {
            const data = JSON.parse(redisData);
            this.log(`Cache HIT (Redis): ${key}`);
            
            // Populate upper caches
            this.populateUpperCaches(key, data, config, now);
            
            return data;
          }
        } catch (error) {
          this.logError('Redis cache miss failed', error);
        }
      }

      // Layer 4: Database (Source of Truth)
      this.log(`Cache MISS: ${key} - Fetching from database`);
      const data = await fetcher();

      // Populate all caches asynchronously
      this.populateAllCaches(key, data, config, now);

      return data;

    } catch (error) {
      this.logError(`Cache operation failed for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Invalidate cache across all layers
   */
  async invalidate(key: string): Promise<void> {
    try {
      // Remove from memory
      this.memoryCache.delete(key);

      // Remove from Cache API
      const cacheKey = `https://cache/${key}`;
      await this.cacheAPI.delete(cacheKey);

      // Remove from Redis
      if (this.redis) {
        await this.redis.del(key);
      }

      this.log(`Cache INVALIDATED: ${key}`);

    } catch (error) {
      this.logError(`Cache invalidation failed for key: ${key}`, error);
    }
  }

  /**
   * Write-through cache update
   */
  async set<T>(
    key: string,
    data: T,
    configKey: keyof typeof DEFAULT_CONFIGS = 'dashboard'
  ): Promise<void> {
    const config = DEFAULT_CONFIGS[configKey];
    const now = Date.now();

    try {
      this.populateAllCaches(key, data, config, now);
      this.log(`Cache SET: ${key}`);
    } catch (error) {
      this.logError(`Cache set failed for key: ${key}`, error);
    }
  }

  private populateUpperCaches(key: string, data: any, config: CacheConfig, now: number): void {
    // Memory cache
    if (config.useMemory) {
      this.memoryCache.set(key, {
        data,
        expires: now + (config.ttl * 1000)
      });
    }

    // Cache API (async)
    if (config.useCacheAPI) {
      const cacheKey = `https://cache/${key}`;
      this.cacheAPI.put(cacheKey, new Response(JSON.stringify(data), {
        headers: {
          'Cache-Control': `max-age=${config.ttl}`,
          'Content-Type': 'application/json'
        }
      })).catch(error => {
        this.logError('Cache API population failed', error);
      });
    }
  }

  private populateAllCaches(key: string, data: any, config: CacheConfig, now: number): void {
    // Memory cache
    if (config.useMemory) {
      this.memoryCache.set(key, {
        data,
        expires: now + (config.ttl * 1000)
      });
    }

    // Cache API (async)
    if (config.useCacheAPI) {
      const cacheKey = `https://cache/${key}`;
      this.cacheAPI.put(cacheKey, new Response(JSON.stringify(data), {
        headers: {
          'Cache-Control': `max-age=${config.ttl}`,
          'Content-Type': 'application/json'
        }
      })).catch(error => {
        this.logError('Cache API population failed', error);
      });
    }

    // Redis (async)
    if (config.useRedis && this.redis) {
      this.redis.set(key, JSON.stringify(data), { ex: config.ttl }).catch(error => {
        this.logError('Redis cache population failed', error);
      });
    }
  }

  private log(message: string): void {
    console.log(`🧊 [Cache] ${message}`);
  }

  private logError(message: string, error: any): void {
    console.error(`❌ [Cache] ${message}:`, error);
    if (this.sentry) {
      this.sentry.captureException(error, {
        tags: { component: 'caching-service' },
        extra: { message }
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { memorySize: number; memoryKeys: string[] } {
    return {
      memorySize: this.memoryCache.size,
      memoryKeys: Array.from(this.memoryCache.keys())
    };
  }

  /**
   * Clear memory cache (for testing)
   */
  clearMemory(): void {
    this.memoryCache.clear();
  }
}

/**
 * Helper functions for common caching patterns
 */

export async function getCachedDashboardData(
  env: any,
  userId: number,
  userType: string,
  sentry?: Toucan
): Promise<any> {
  const cache = new CachingService(env, sentry);
  const key = `dashboard:${userType}:${userId}`;

  return await cache.get(key, async () => {
    return await withDatabase(env, async (sql) => {
      // Fetch dashboard data based on user type
      switch (userType) {
        case 'investor':
          return await sql`
            SELECT 
              (SELECT COUNT(*) FROM investments WHERE investor_id = ${userId}) as total_investments,
              (SELECT COUNT(*) FROM nda_requests WHERE investor_id = ${userId}) as nda_requests,
              (SELECT COUNT(*) FROM pitch_views WHERE viewer_id = ${userId}) as pitches_viewed
          `;
        case 'creator':
          return await sql`
            SELECT 
              (SELECT COUNT(*) FROM pitches WHERE user_id = ${userId}) as total_pitches,
              (SELECT COUNT(*) FROM pitch_views pv JOIN pitches p ON pv.pitch_id = p.id WHERE p.user_id = ${userId}) as total_views,
              (SELECT COUNT(*) FROM investments i JOIN pitches p ON i.pitch_id = p.id WHERE p.user_id = ${userId}) as total_investments
          `;
        case 'production':
          return await sql`
            SELECT 
              (SELECT COUNT(*) FROM production_projects WHERE company_id = ${userId}) as total_projects,
              (SELECT COUNT(*) FROM production_analytics WHERE company_id = ${userId}) as total_analytics
          `;
        default:
          throw new Error(`Unknown user type: ${userType}`);
      }
    });
  }, 'dashboard');
}

export async function getCachedNotifications(
  env: any,
  userId: number,
  sentry?: Toucan
): Promise<any> {
  const cache = new CachingService(env, sentry);
  const key = `notifications:${userId}`;

  return await cache.get(key, async () => {
    return await withDatabase(env, async (sql) => {
      return await sql`
        SELECT id, type, title, message, created_at, read_at
        FROM notifications 
        WHERE user_id = ${userId}
        ORDER BY created_at DESC 
        LIMIT 20
      `;
    });
  }, 'notifications');
}

export async function invalidateUserCache(
  env: any,
  userId: number,
  userType?: string,
  sentry?: Toucan
): Promise<void> {
  const cache = new CachingService(env, sentry);
  
  // Invalidate all user-related caches
  await Promise.all([
    cache.invalidate(`notifications:${userId}`),
    userType ? cache.invalidate(`dashboard:${userType}:${userId}`) : null,
    cache.invalidate(`presence:${userId}`)
  ].filter(Boolean));
}

export { CachingService };