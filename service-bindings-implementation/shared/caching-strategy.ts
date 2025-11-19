/**
 * Shared Caching Strategy for Service Bindings Architecture
 * Reusable across all service workers
 */

import { Toucan } from 'toucan-js';

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
    useCacheAPI: false,
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
    useMemory: false,
    useCacheAPI: false,
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

export class CachingService {
  private memoryCache = new Map<string, { data: any; expires: number }>();
  private redis: any;
  private cacheAPI: Cache;
  private sentry: Toucan | null = null;

  constructor(env: any, sentry?: Toucan) {
    // Initialize Redis if available
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      // Dynamically import Redis to avoid bundling issues
      this.initializeRedis(env);
    }
    
    this.cacheAPI = caches.default;
    this.sentry = sentry || null;
  }

  private async initializeRedis(env: any) {
    try {
      // Dynamic import for Redis
      const { Redis } = await import('@upstash/redis/cloudflare');
      this.redis = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      });
    } catch (error) {
      console.warn('Redis not available, falling back to KV and Cache API');
      this.logError('Redis initialization failed', error);
    }
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
        try {
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
        } catch (error) {
          this.logError('Cache API read failed', error);
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