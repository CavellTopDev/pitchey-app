// Database Query Caching Service with Redis
// Optimizes database performance by caching frequently accessed data

import { nativeRedisService } from "./redis-native.service.ts";

export interface CacheConfig {
  ttl: number;           // Time to live in seconds
  prefix?: string;       // Cache key prefix
  compress?: boolean;    // Compress large payloads
}

export interface QueryCacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  queryHash: string;
}

class DatabaseCacheService {
  private enabled: boolean;
  private defaultTTL = 300; // 5 minutes default TTL
  private compressionThreshold = 1024 * 10; // 10KB compression threshold
  
  constructor() {
    this.enabled = Deno.env.get("CACHE_ENABLED") === "true";
  }

  private generateCacheKey(prefix: string, identifier: string): string {
    return `pitchey:db:${prefix}:${identifier}`;
  }

  private hashQuery(query: string, params?: any[]): string {
    const content = JSON.stringify({ query, params });
    // Simple hash function - in production, use crypto.subtle
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private async compressData(data: any): Promise<string> {
    const jsonString = JSON.stringify(data);
    if (jsonString.length < this.compressionThreshold) {
      return jsonString;
    }
    
    // For large data, could implement compression here
    // For now, just return as JSON
    return jsonString;
  }

  private async decompressData(data: string): Promise<any> {
    try {
      return JSON.parse(data);
    } catch {
      // If parsing fails, return as string
      return data;
    }
  }

  /**
   * Cache a query result with configurable TTL
   */
  async cacheQuery<T>(
    prefix: string, 
    identifier: string, 
    data: T, 
    config: Partial<CacheConfig> = {}
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const cacheKey = this.generateCacheKey(prefix, identifier);
      const ttl = config.ttl || this.defaultTTL;
      
      const cacheEntry: QueryCacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        queryHash: this.hashQuery(identifier)
      };

      const serializedData = await this.compressData(cacheEntry);
      await nativeRedisService.set(cacheKey, serializedData, ttl);
      
      console.log(`📦 Cached query: ${prefix}:${identifier} (TTL: ${ttl}s)`);
    } catch (error) {
      console.warn("Failed to cache query:", error.message);
    }
  }

  /**
   * Get cached query result
   */
  async getCachedQuery<T>(
    prefix: string, 
    identifier: string
  ): Promise<T | null> {
    if (!this.enabled) return null;

    try {
      const cacheKey = this.generateCacheKey(prefix, identifier);
      const cachedData = await nativeRedisService.get(cacheKey);
      
      if (!cachedData) return null;

      const cacheEntry = await this.decompressData(cachedData) as QueryCacheEntry<T>;
      
      // Check if cache is expired (double-check against Redis TTL)
      if (Date.now() - cacheEntry.timestamp > cacheEntry.ttl * 1000) {
        await this.invalidateQuery(prefix, identifier);
        return null;
      }

      console.log(`🎯 Cache hit: ${prefix}:${identifier}`);
      return cacheEntry.data;
    } catch (error) {
      console.warn("Failed to get cached query:", error.message);
      return null;
    }
  }

  /**
   * Invalidate cached query
   */
  async invalidateQuery(prefix: string, identifier: string): Promise<void> {
    if (!this.enabled) return;

    try {
      const cacheKey = this.generateCacheKey(prefix, identifier);
      await nativeRedisService.del(cacheKey);
      console.log(`🗑️ Invalidated cache: ${prefix}:${identifier}`);
    } catch (error) {
      console.warn("Failed to invalidate cache:", error.message);
    }
  }

  /**
   * Invalidate multiple cached queries by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.enabled) return;

    try {
      const fullPattern = `pitchey:db:${pattern}`;
      await nativeRedisService.deleteByPattern(fullPattern);
      console.log(`🗑️ Invalidated cache pattern: ${pattern}`);
    } catch (error) {
      console.warn("Failed to invalidate cache pattern:", error.message);
    }
  }

  /**
   * Cache wrapper for database queries - automatically handles caching
   */
  async withCache<T>(
    prefix: string,
    identifier: string,
    queryFn: () => Promise<T>,
    config: Partial<CacheConfig> = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.getCachedQuery<T>(prefix, identifier);
    if (cached !== null) {
      return cached;
    }

    // Execute query and cache result
    console.log(`🔍 Cache miss, executing query: ${prefix}:${identifier}`);
    const result = await queryFn();
    
    // Only cache non-null results
    if (result !== null && result !== undefined) {
      await this.cacheQuery(prefix, identifier, result, config);
    }
    
    return result;
  }

  /**
   * Batch cache operations for related queries
   */
  async batchInvalidate(patterns: string[]): Promise<void> {
    if (!this.enabled) return;

    const promises = patterns.map(pattern => this.invalidatePattern(pattern));
    await Promise.allSettled(promises);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    enabled: boolean;
    totalKeys: number;
    memory?: string;
  }> {
    if (!this.enabled) {
      return { enabled: false, totalKeys: 0 };
    }

    try {
      const keys = await nativeRedisService.keys("pitchey:db:*");
      return {
        enabled: true,
        totalKeys: keys.length
      };
    } catch (error) {
      return { enabled: true, totalKeys: 0 };
    }
  }

  /**
   * Clear all cached queries (use with caution)
   */
  async clearAllCache(): Promise<void> {
    if (!this.enabled) return;
    
    try {
      await nativeRedisService.deleteByPattern("pitchey:db:*");
      console.log("🧹 Cleared all database cache");
    } catch (error) {
      console.warn("Failed to clear cache:", error.message);
    }
  }
}

// Cache configurations for different data types
export const CacheConfigs = {
  // Long-lived data (1 hour)
  STATIC: { ttl: 3600, prefix: "static" } as CacheConfig,
  
  // Medium-lived data (15 minutes)  
  TRENDING: { ttl: 900, prefix: "trending" } as CacheConfig,
  USER_PROFILE: { ttl: 900, prefix: "profile" } as CacheConfig,
  
  // Short-lived data (5 minutes)
  PITCHES: { ttl: 300, prefix: "pitches" } as CacheConfig,
  SEARCH: { ttl: 300, prefix: "search" } as CacheConfig,
  
  // Very short-lived data (1 minute)
  ANALYTICS: { ttl: 60, prefix: "analytics" } as CacheConfig,
  DASHBOARD: { ttl: 300, prefix: "dashboard" } as CacheConfig,
  
  // Ultra short-lived for real-time features (30 seconds)
  PRESENCE: { ttl: 30, prefix: "presence" } as CacheConfig,
};

// Export singleton instance
export const databaseCacheService = new DatabaseCacheService();

// Helper functions for common caching patterns
export const CacheHelpers = {
  // Cache key generators
  pitchesKey: (userId?: number, filters?: any) => 
    `pitches:${userId || 'all'}:${JSON.stringify(filters || {})}`,
  
  userKey: (userId: number) => `user:${userId}`,
  
  trendingKey: (timeframe = '24h') => `trending:${timeframe}`,
  
  dashboardKey: (userId: number, userType: string) => 
    `dashboard:${userType}:${userId}`,
  
  searchKey: (query: string, filters: any) => 
    `search:${query}:${JSON.stringify(filters)}`,

  // Invalidation patterns
  invalidateUserData: (userId: number) => [
    `profile:user:${userId}*`,
    `pitches:${userId}*`,
    `dashboard:*:${userId}*`
  ],
  
  invalidatePitchData: (pitchId: number) => [
    `pitches:*`,
    `trending:*`,
    `search:*`,
    `pitch:${pitchId}*`
  ],
  
  invalidateMarketplace: () => [
    `pitches:all*`,
    `trending:*`,
    `search:*`
  ]
};