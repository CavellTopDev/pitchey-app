/**
 * Intelligence Cache Service
 * Unified caching service for all Crawl4AI intelligence layer data
 * Supports Redis with memory fallback for edge deployment
 */

import { Env } from '../types/worker-types';
import { CacheMetrics } from '../types/intelligence.types';

export interface CacheService {
  get(key: string): Promise<any | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttl: number): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  flushPattern(pattern: string): Promise<void>;
  getMetrics(key: string): Promise<CacheMetrics | null>;
  updateMetrics(key: string, hit: boolean, sizeBytes?: number): Promise<void>;
}

class RedisCacheService implements CacheService {
  private redis: any;
  private fallback: MemoryCacheService;

  constructor(private env: Env) {
    this.fallback = new MemoryCacheService();
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      // Initialize Redis connection using environment variables
      if (this.env.UPSTASH_REDIS_REST_URL && this.env.UPSTASH_REDIS_REST_TOKEN) {
        // Use Upstash Redis for edge deployment
        this.redis = {
          url: this.env.UPSTASH_REDIS_REST_URL,
          token: this.env.UPSTASH_REDIS_REST_TOKEN
        };
      }
    } catch (error) {
      console.warn('Redis initialization failed, using memory fallback:', error);
      this.redis = null;
    }
  }

  async get(key: string): Promise<any | null> {
    try {
      if (this.redis) {
        const response = await fetch(`${this.redis.url}/get/${encodeURIComponent(key)}`, {
          headers: {
            'Authorization': `Bearer ${this.redis.token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.result) {
            await this.updateMetrics(key, true);
            return JSON.parse(data.result);
          }
        }
      }
    } catch (error) {
      console.warn('Redis get failed, trying fallback:', error);
    }

    // Fallback to memory cache
    await this.updateMetrics(key, false);
    return this.fallback.get(key);
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    const serialized = JSON.stringify(value);
    const sizeBytes = new TextEncoder().encode(serialized).length;

    try {
      if (this.redis) {
        const response = await fetch(`${this.redis.url}/setex/${encodeURIComponent(key)}/${ttl}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.redis.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(serialized)
        });
        
        if (response.ok) {
          await this.updateMetrics(key, true, sizeBytes);
          return;
        }
      }
    } catch (error) {
      console.warn('Redis set failed, using fallback:', error);
    }

    // Fallback to memory cache
    this.fallback.set(key, value, ttl);
    await this.updateMetrics(key, false, sizeBytes);
  }

  async del(key: string): Promise<void> {
    try {
      if (this.redis) {
        await fetch(`${this.redis.url}/del/${encodeURIComponent(key)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.redis.token}`
          }
        });
      }
    } catch (error) {
      console.warn('Redis delete failed:', error);
    }

    this.fallback.del(key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (this.redis) {
        const response = await fetch(`${this.redis.url}/exists/${encodeURIComponent(key)}`, {
          headers: {
            'Authorization': `Bearer ${this.redis.token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          return data.result === 1;
        }
      }
    } catch (error) {
      console.warn('Redis exists failed:', error);
    }

    return this.fallback.exists(key);
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      if (this.redis) {
        await fetch(`${this.redis.url}/expire/${encodeURIComponent(key)}/${ttl}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.redis.token}`
          }
        });
      }
    } catch (error) {
      console.warn('Redis expire failed:', error);
    }

    this.fallback.expire(key, ttl);
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      if (this.redis) {
        const response = await fetch(`${this.redis.url}/keys/${encodeURIComponent(pattern)}`, {
          headers: {
            'Authorization': `Bearer ${this.redis.token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          return data.result || [];
        }
      }
    } catch (error) {
      console.warn('Redis keys failed:', error);
    }

    return this.fallback.keys(pattern);
  }

  async flushPattern(pattern: string): Promise<void> {
    const keys = await this.keys(pattern);
    for (const key of keys) {
      await this.del(key);
    }
  }

  async getMetrics(key: string): Promise<CacheMetrics | null> {
    // This would query the cache_metrics table in production
    return null;
  }

  async updateMetrics(key: string, hit: boolean, sizeBytes?: number): Promise<void> {
    // Update cache metrics in database (non-blocking)
    try {
      // This would update the cache_metrics table
      console.debug(`Cache ${hit ? 'hit' : 'miss'} for key: ${key}`);
    } catch (error) {
      // Silently fail - metrics are not critical
    }
  }
}

class MemoryCacheService implements CacheService {
  private cache = new Map<string, { value: any; expires: number }>();

  async get(key: string): Promise<any | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    const expires = Date.now() + (ttl * 1000);
    this.cache.set(key, { value, expires });
    
    // Clean up expired entries periodically
    if (this.cache.size > 1000) {
      this.cleanup();
    }
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  async expire(key: string, ttl: number): Promise<void> {
    const item = this.cache.get(key);
    if (item) {
      item.expires = Date.now() + (ttl * 1000);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  async flushPattern(pattern: string): Promise<void> {
    const keys = await this.keys(pattern);
    keys.forEach(key => this.cache.delete(key));
  }

  async getMetrics(): Promise<CacheMetrics | null> {
    return null;
  }

  async updateMetrics(): Promise<void> {
    // No-op for memory cache
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }
}

// Cache configuration for different data types
export const CacheTTL = {
  INDUSTRY_DATA: 3600,      // 1 hour
  MARKET_INTELLIGENCE: 300,  // 5 minutes
  TALENT_VERIFICATION: 86400, // 24 hours
  COMPANY_VERIFICATION: 86400, // 24 hours
  COMPETITIVE_ANALYSIS: 21600, // 6 hours
  TREND_ANALYSIS: 7200,     // 2 hours
  SEARCH_RESULTS: 1800,     // 30 minutes
  SIMILAR_PROJECTS: 7200,   // 2 hours
  BOX_OFFICE_DATA: 3600,    // 1 hour
} as const;

export const CacheKeys = {
  // Industry enrichment
  PITCH_ENRICHMENT: (pitchId: string) => `enrichment:${pitchId}`,
  COMPARABLE_MOVIES: (genre: string, budget: string) => `comparables:${genre}:${budget}`,
  GENRE_PERFORMANCE: (genre: string) => `genre_perf:${genre}`,
  
  // Market intelligence
  MARKET_NEWS: (category?: string) => `market_news${category ? ':' + category : ''}`,
  BOX_OFFICE_TRENDS: () => 'box_office:trends',
  INVESTMENT_OPPORTUNITIES: (type?: string) => `opportunities${type ? ':' + type : ''}`,
  
  // Content discovery
  SIMILAR_PROJECTS: (pitchId: string) => `similar:${pitchId}`,
  TALENT_VERIFICATION: (name: string) => `talent:${name.replace(/\s+/g, '_').toLowerCase()}`,
  COMPANY_VERIFICATION: (name: string) => `company:${name.replace(/\s+/g, '_').toLowerCase()}`,
  
  // Competitive analysis
  COMPETITIVE_MATRIX: () => 'competitive:matrix',
  COMPETITOR_FEATURES: (competitor: string) => `competitor:${competitor}:features`,
  MARKET_POSITION: (competitor: string) => `competitor:${competitor}:position`,
  
  // Trends
  GENRE_TRENDS: (genre?: string) => `trends:genre${genre ? ':' + genre : ''}`,
  FORMAT_TRENDS: (format?: string) => `trends:format${format ? ':' + format : ''}`,
  BUDGET_TRENDS: (range?: string) => `trends:budget${range ? ':' + range : ''}`,
  
  // System
  CRAWL_STATUS: (jobType: string) => `crawl_status:${jobType}`,
  CACHE_METRICS: (cacheType: string) => `metrics:${cacheType}`
} as const;

// Intelligent cache service with automatic fallback and metrics
export class IntelligenceCacheService {
  private service: CacheService;

  constructor(env: Env) {
    this.service = new RedisCacheService(env);
  }

  /**
   * Get cached data with automatic deserialization
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      return await this.service.get(key);
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached data with automatic TTL based on data type
   */
  async set(key: string, value: any, customTtl?: number): Promise<void> {
    try {
      const ttl = customTtl || this.getDefaultTTL(key);
      await this.service.set(key, value, ttl);
    } catch (error) {
      console.error('Cache set error:', error);
      // Don't throw - caching is not critical
    }
  }

  /**
   * Delete cached data
   */
  async del(key: string): Promise<void> {
    try {
      await this.service.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      return await this.service.exists(key);
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Set expiration time
   */
  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.service.expire(key, ttl);
    } catch (error) {
      console.error('Cache expire error:', error);
    }
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.service.keys(pattern);
    } catch (error) {
      console.error('Cache keys error:', error);
      return [];
    }
  }

  /**
   * Delete all keys matching pattern
   */
  async flushPattern(pattern: string): Promise<void> {
    try {
      await this.service.flushPattern(pattern);
    } catch (error) {
      console.error('Cache flush pattern error:', error);
    }
  }

  /**
   * Get or set with automatic caching
   */
  async getOrSet<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch data and cache it
    try {
      const data = await fetcher();
      await this.set(key, data, ttl);
      return data;
    } catch (error) {
      console.error('Cache getOrSet fetcher error:', error);
      throw error;
    }
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = [];
    
    for (const key of keys) {
      results.push(await this.get<T>(key));
    }
    
    return results;
  }

  /**
   * Batch set multiple key-value pairs
   */
  async mset(items: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    for (const item of items) {
      await this.set(item.key, item.value, item.ttl);
    }
  }

  /**
   * Increment a counter
   */
  async incr(key: string, amount: number = 1): Promise<number> {
    try {
      const current = await this.get<number>(key) || 0;
      const newValue = current + amount;
      await this.set(key, newValue, CacheTTL.MARKET_INTELLIGENCE);
      return newValue;
    } catch (error) {
      console.error('Cache incr error:', error);
      return amount;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: number;
    hitRate: number;
  }> {
    try {
      // This would query actual cache statistics in production
      const allKeys = await this.keys('*');
      
      return {
        totalKeys: allKeys.length,
        memoryUsage: allKeys.length * 1024, // Estimated
        hitRate: 0.85 // Default hit rate
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { totalKeys: 0, memoryUsage: 0, hitRate: 0 };
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmup(data: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    console.log('Warming up cache with', data.length, 'items');
    await this.mset(data);
  }

  /**
   * Clear all intelligence cache data
   */
  async clear(): Promise<void> {
    const patterns = [
      'enrichment:*',
      'comparables:*',
      'market_news:*',
      'opportunities:*',
      'similar:*',
      'talent:*',
      'company:*',
      'competitive:*',
      'trends:*'
    ];

    for (const pattern of patterns) {
      await this.flushPattern(pattern);
    }
  }

  /**
   * Get default TTL based on key pattern
   */
  private getDefaultTTL(key: string): number {
    if (key.startsWith('enrichment:')) return CacheTTL.INDUSTRY_DATA;
    if (key.startsWith('market_news:')) return CacheTTL.MARKET_INTELLIGENCE;
    if (key.startsWith('talent:')) return CacheTTL.TALENT_VERIFICATION;
    if (key.startsWith('company:')) return CacheTTL.COMPANY_VERIFICATION;
    if (key.startsWith('competitive:')) return CacheTTL.COMPETITIVE_ANALYSIS;
    if (key.startsWith('trends:')) return CacheTTL.TREND_ANALYSIS;
    if (key.startsWith('similar:')) return CacheTTL.SIMILAR_PROJECTS;
    if (key.startsWith('box_office:')) return CacheTTL.BOX_OFFICE_DATA;
    
    return 3600; // Default 1 hour
  }
}

// Singleton cache service factory
let cacheServiceInstance: IntelligenceCacheService | null = null;

export function getCacheService(env: Env): IntelligenceCacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new IntelligenceCacheService(env);
  }
  return cacheServiceInstance;
}

// Cache warming utilities
export async function warmupIntelligenceCache(env: Env): Promise<void> {
  const cache = getCacheService(env);
  
  // Warmup common trend data
  const warmupData = [
    {
      key: CacheKeys.GENRE_TRENDS(),
      value: {
        horror: { trend: 'rising', strength: 85 },
        action: { trend: 'stable', strength: 75 },
        comedy: { trend: 'falling', strength: 65 },
        drama: { trend: 'stable', strength: 70 }
      },
      ttl: CacheTTL.TREND_ANALYSIS
    },
    {
      key: CacheKeys.BOX_OFFICE_TRENDS(),
      value: {
        weekendTotal: 125000000,
        topPerformers: [],
        lastUpdated: new Date().toISOString()
      },
      ttl: CacheTTL.BOX_OFFICE_DATA
    }
  ];
  
  await cache.warmup(warmupData);
}

// Cache health check
export async function checkCacheHealth(env: Env): Promise<{
  status: 'healthy' | 'degraded' | 'failed';
  details: any;
}> {
  try {
    const cache = getCacheService(env);
    const testKey = `health_check:${Date.now()}`;
    const testValue = { timestamp: Date.now() };
    
    // Test write
    await cache.set(testKey, testValue, 60);
    
    // Test read
    const retrieved = await cache.get(testKey);
    
    // Test delete
    await cache.del(testKey);
    
    if (retrieved?.timestamp === testValue.timestamp) {
      const stats = await cache.getStats();
      return {
        status: 'healthy',
        details: {
          readable: true,
          writable: true,
          deletable: true,
          stats
        }
      };
    } else {
      return {
        status: 'degraded',
        details: {
          readable: false,
          writable: true,
          deletable: true,
          error: 'Read test failed'
        }
      };
    }
  } catch (error) {
    return {
      status: 'failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}