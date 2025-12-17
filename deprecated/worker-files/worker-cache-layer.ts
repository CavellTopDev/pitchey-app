/**
 * Edge Cache Layer for Cloudflare Workers
 * Implements multi-tier caching with KV and in-memory caches
 */

import { Toucan } from 'toucan-js';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  staleWhileRevalidate?: number; // Serve stale content while revalidating
  tags?: string[]; // Cache tags for invalidation
}

export interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  lastReset: Date;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
}

// Default TTLs for different data types
export const CACHE_TTL = {
  TRENDING_PITCHES: 300, // 5 minutes
  NEW_RELEASES: 300, // 5 minutes
  PUBLIC_PITCHES: 300, // 5 minutes
  PITCH_DETAILS: 600, // 10 minutes
  USER_PROFILE: 600, // 10 minutes
  SEARCH_RESULTS: 180, // 3 minutes
  STATS: 60, // 1 minute
  NOTIFICATIONS: 30, // 30 seconds
  STATIC_CONTENT: 3600, // 1 hour
} as const;

// Cache key patterns
const CACHE_KEYS = {
  TRENDING: (limit: number) => `pitches:trending:${limit}`,
  NEW_RELEASES: (limit: number) => `pitches:new:${limit}`,
  PUBLIC: (limit: number, offset: number) => `pitches:public:${limit}:${offset}`,
  PITCH: (id: string) => `pitch:${id}`,
  USER: (id: string) => `user:${id}`,
  SEARCH: (query: string, filters: string) => `search:${query}:${filters}`,
  STATS: (userId: string) => `stats:${userId}`,
  NOTIFICATIONS: (userId: string) => `notifications:${userId}`,
} as const;

export class EdgeCacheLayer {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    errors: 0,
    lastReset: new Date()
  };
  private readonly MAX_MEMORY_ITEMS = 100;
  private readonly sentry: Toucan | null;

  constructor(
    private kv: KVNamespace | null,
    sentry?: Toucan
  ) {
    this.sentry = sentry || null;
    
    // Clean up expired memory cache entries periodically
    this.startMemoryCleanup();
  }

  /**
   * Get data from cache with multi-tier fallback
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig = { ttl: 60 }
  ): Promise<T> {
    try {
      // Level 1: Memory cache (fastest)
      const memoryResult = this.getFromMemory<T>(key);
      if (memoryResult !== null) {
        this.stats.hits++;
        return memoryResult;
      }

      // Level 2: KV cache (edge-distributed)
      if (this.kv) {
        const kvResult = await this.getFromKV<T>(key);
        if (kvResult !== null) {
          this.stats.hits++;
          // Populate memory cache for next request
          this.setInMemory(key, kvResult, config.ttl);
          return kvResult;
        }
      }

      // Cache miss - fetch fresh data
      this.stats.misses++;
      const freshData = await fetcher();
      
      // Store in both cache layers
      await this.set(key, freshData, config);
      
      return freshData;
    } catch (error) {
      this.stats.errors++;
      this.logError('Cache get error', error, { key });
      
      // On error, try to fetch fresh data
      return await fetcher();
    }
  }

  /**
   * Set data in cache layers
   */
  async set<T>(
    key: string,
    data: T,
    config: CacheConfig = { ttl: 60 }
  ): Promise<void> {
    try {
      // Store in memory cache
      this.setInMemory(key, data, config.ttl);
      
      // Store in KV cache
      if (this.kv) {
        await this.setInKV(key, data, config.ttl);
      }
    } catch (error) {
      this.logError('Cache set error', error, { key });
    }
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(patterns: string | string[]): Promise<void> {
    const patternsArray = Array.isArray(patterns) ? patterns : [patterns];
    
    try {
      // Clear from memory cache
      for (const pattern of patternsArray) {
        this.invalidateMemoryPattern(pattern);
      }
      
      // Clear from KV cache
      if (this.kv) {
        await this.invalidateKVPattern(patternsArray);
      }
    } catch (error) {
      this.logError('Cache invalidation error', error, { patterns: patternsArray });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { memoryCacheSize: number; hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      memoryCacheSize: this.memoryCache.size,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  /**
   * Cache specific data types with optimized TTLs
   */
  async cacheTrendingPitches(limit: number, fetcher: () => Promise<any>): Promise<any> {
    return this.get(
      CACHE_KEYS.TRENDING(limit),
      fetcher,
      { ttl: CACHE_TTL.TRENDING_PITCHES, tags: ['pitches', 'trending'] }
    );
  }

  async cacheNewReleases(limit: number, fetcher: () => Promise<any>): Promise<any> {
    return this.get(
      CACHE_KEYS.NEW_RELEASES(limit),
      fetcher,
      { ttl: CACHE_TTL.NEW_RELEASES, tags: ['pitches', 'new'] }
    );
  }

  async cachePublicPitches(limit: number, offset: number, fetcher: () => Promise<any>): Promise<any> {
    return this.get(
      CACHE_KEYS.PUBLIC(limit, offset),
      fetcher,
      { ttl: CACHE_TTL.PUBLIC_PITCHES, tags: ['pitches', 'public'] }
    );
  }

  async cachePitchDetails(id: string, fetcher: () => Promise<any>): Promise<any> {
    return this.get(
      CACHE_KEYS.PITCH(id),
      fetcher,
      { ttl: CACHE_TTL.PITCH_DETAILS, tags: ['pitch', `pitch:${id}`] }
    );
  }

  async cacheUserProfile(id: string, fetcher: () => Promise<any>): Promise<any> {
    return this.get(
      CACHE_KEYS.USER(id),
      fetcher,
      { ttl: CACHE_TTL.USER_PROFILE, tags: ['user', `user:${id}`] }
    );
  }

  async cacheSearchResults(query: string, filters: any, fetcher: () => Promise<any>): Promise<any> {
    const filterKey = JSON.stringify(filters);
    return this.get(
      CACHE_KEYS.SEARCH(query, filterKey),
      fetcher,
      { ttl: CACHE_TTL.SEARCH_RESULTS, tags: ['search'] }
    );
  }

  /**
   * Invalidate specific cache patterns
   */
  async invalidatePitchCache(pitchId?: string): Promise<void> {
    if (pitchId) {
      // Invalidate specific pitch and related caches
      await this.invalidate([
        CACHE_KEYS.PITCH(pitchId),
        'pitches:*', // All pitch lists
        'search:*' // Search results might include this pitch
      ]);
    } else {
      // Invalidate all pitch-related caches
      await this.invalidate(['pitch*', 'search:*']);
    }
  }

  async invalidateUserCache(userId: string): Promise<void> {
    await this.invalidate([
      CACHE_KEYS.USER(userId),
      CACHE_KEYS.STATS(userId),
      CACHE_KEYS.NOTIFICATIONS(userId)
    ]);
  }

  // Private methods
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    const age = (now - entry.timestamp) / 1000;
    
    if (age > entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setInMemory<T>(key: string, data: T, ttl: number): void {
    // Implement LRU eviction if cache is full
    if (this.memoryCache.size >= this.MAX_MEMORY_ITEMS) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }
    
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      etag: this.generateETag(data)
    });
  }

  private async getFromKV<T>(key: string): Promise<T | null> {
    if (!this.kv) return null;
    
    try {
      const value = await this.kv.get(key, 'json');
      return value as T;
    } catch (error) {
      this.logError('KV get error', error, { key });
      return null;
    }
  }

  private async setInKV<T>(key: string, data: T, ttl: number): Promise<void> {
    if (!this.kv) return;
    
    try {
      await this.kv.put(key, JSON.stringify(data), {
        expirationTtl: ttl,
        metadata: {
          timestamp: Date.now(),
          etag: this.generateETag(data)
        }
      });
    } catch (error) {
      this.logError('KV set error', error, { key });
    }
  }

  private invalidateMemoryPattern(pattern: string): void {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const keysToDelete: string[] = [];
    
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
    }
  }

  private async invalidateKVPattern(patterns: string[]): Promise<void> {
    if (!this.kv) return;
    
    // KV doesn't support pattern deletion, so we need to track keys
    // In production, consider using cache tags or a separate index
    for (const pattern of patterns) {
      // This is a simplified approach - in production, maintain an index
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      
      // List keys if KV supports it (Cloudflare KV has list operation)
      try {
        const list = await this.kv.list({ prefix: pattern.split('*')[0] });
        for (const key of list.keys) {
          if (regex.test(key.name)) {
            await this.kv.delete(key.name);
          }
        }
      } catch (error) {
        this.logError('KV pattern deletion error', error, { pattern });
      }
    }
  }

  private generateETag(data: any): string {
    // Simple ETag generation - in production, use a proper hash
    return `"${JSON.stringify(data).length}-${Date.now()}"`;
  }

  private startMemoryCleanup(): void {
    // Clean expired entries every minute
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      for (const [key, entry] of this.memoryCache.entries()) {
        const age = (now - entry.timestamp) / 1000;
        if (age > entry.ttl) {
          keysToDelete.push(key);
        }
      }
      
      for (const key of keysToDelete) {
        this.memoryCache.delete(key);
      }
    }, 60000);
  }

  private logError(message: string, error: any, extra?: any): void {
    console.error(`[Cache] ${message}:`, error, extra);
    
    if (this.sentry) {
      this.sentry.captureException(error, {
        tags: {
          component: 'cache',
          operation: message
        },
        extra
      });
    }
  }
}

// Export singleton factory
export function createCacheLayer(kv: KVNamespace | null, sentry?: Toucan): EdgeCacheLayer {
  return new EdgeCacheLayer(kv, sentry);
}