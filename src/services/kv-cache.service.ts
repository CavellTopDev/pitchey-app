/**
 * Cloudflare KV Cache Service
 * Optimized caching layer for the Pitchey platform
 */

export interface KVCacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string; // Cache namespace prefix
}

export class KVCacheService {
  private kv: KVNamespace;
  private defaultTTL: number = 300; // 5 minutes default
  private namespace: string;

  constructor(kv: KVNamespace, namespace: string = 'pitchey') {
    this.kv = kv;
    this.namespace = namespace;
  }

  /**
   * Generate cache key with namespace
   */
  private getKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  /**
   * Store value in cache
   */
  async set(key: string, value: any, options?: KVCacheOptions): Promise<void> {
    const cacheKey = this.getKey(key);
    const ttl = options?.ttl || this.defaultTTL;
    
    try {
      const serialized = JSON.stringify({
        value,
        timestamp: Date.now(),
        ttl
      });
      
      await this.kv.put(cacheKey, serialized, {
        expirationTtl: ttl,
        metadata: {
          created: new Date().toISOString(),
          namespace: this.namespace
        }
      });
    } catch (error) {
      console.error(`Cache set error for ${key}:`, error);
      // Fail silently - cache is not critical
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const cacheKey = this.getKey(key);
    
    try {
      const cached = await this.kv.get(cacheKey);
      
      if (!cached) {
        return null;
      }
      
      const parsed = JSON.parse(cached);
      
      // Check if cache is expired
      if (parsed.ttl && parsed.timestamp) {
        const age = (Date.now() - parsed.timestamp) / 1000;
        if (age > parsed.ttl) {
          await this.delete(key);
          return null;
        }
      }
      
      return parsed.value as T;
    } catch (error) {
      console.error(`Cache get error for ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    const cacheKey = this.getKey(key);
    
    try {
      await this.kv.delete(cacheKey);
    } catch (error) {
      console.error(`Cache delete error for ${key}:`, error);
    }
  }

  /**
   * Clear all cache entries with namespace
   */
  async clear(): Promise<void> {
    try {
      const list = await this.kv.list({ prefix: `${this.namespace}:` });
      
      await Promise.all(
        list.keys.map(key => this.kv.delete(key.name))
      );
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Cache wrapper for functions
   */
  async cached<T>(
    key: string,
    fn: () => Promise<T>,
    options?: KVCacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }
    
    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, options);
    
    return result;
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const prefix = `${this.namespace}:${pattern}`;
      const list = await this.kv.list({ prefix });
      
      await Promise.all(
        list.keys.map(key => this.kv.delete(key.name))
      );
    } catch (error) {
      console.error(`Cache invalidation error for pattern ${pattern}:`, error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    keys: number;
    namespace: string;
  }> {
    try {
      const list = await this.kv.list({ prefix: `${this.namespace}:` });
      
      return {
        keys: list.keys.length,
        namespace: this.namespace
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return {
        keys: 0,
        namespace: this.namespace
      };
    }
  }
}

// Cache key generators for common patterns
export const CacheKeys = {
  // User-related
  userProfile: (userId: number) => `user:profile:${userId}`,
  userSession: (sessionId: string) => `user:session:${sessionId}`,
  userPermissions: (userId: number) => `user:permissions:${userId}`,
  
  // Pitch-related
  pitch: (pitchId: number) => `pitch:${pitchId}`,
  pitchList: (params: string) => `pitches:list:${params}`,
  pitchStats: (pitchId: number) => `pitch:stats:${pitchId}`,
  trending: () => 'pitches:trending',
  featured: () => 'pitches:featured',
  
  // Dashboard
  dashboardStats: (userId: number, role: string) => `dashboard:${role}:${userId}`,
  
  // NDA
  ndaStatus: (userId: number, pitchId: number) => `nda:${userId}:${pitchId}`,
  ndaList: (userId: number) => `nda:list:${userId}`,
  
  // Search
  searchResults: (query: string) => `search:${Buffer.from(query).toString('base64')}`,
  
  // Analytics
  analytics: (type: string, date: string) => `analytics:${type}:${date}`,
  
  // Rate limiting
  rateLimit: (endpoint: string, identifier: string) => `ratelimit:${endpoint}:${identifier}`
};

// Cache TTL configurations (in seconds)
export const CacheTTL = {
  SHORT: 60,        // 1 minute - for frequently changing data
  MEDIUM: 300,      // 5 minutes - default
  LONG: 900,        // 15 minutes - for stable data
  HOUR: 3600,       // 1 hour - for rarely changing data
  DAY: 86400,       // 24 hours - for static data
  WEEK: 604800      // 7 days - for very static data
};

// Export factory function for creating cache instances
export function createKVCache(kv: KVNamespace, namespace?: string): KVCacheService {
  return new KVCacheService(kv, namespace);
}