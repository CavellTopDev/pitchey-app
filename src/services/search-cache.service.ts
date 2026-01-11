/**
 * Search Cache Service for high-performance search result caching
 * Implements intelligent caching strategies with Redis and in-memory fallback
 */

import type { SearchFilters } from "./search.service.ts";

// Cache configuration
interface CacheConfig {
  defaultTTL: number;
  maxCacheSize: number;
  compressionThreshold: number;
  prefetchThreshold: number;
}

const CACHE_CONFIG: CacheConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 10000, // Maximum cache entries
  compressionThreshold: 1024 * 10, // 10KB threshold for compression
  prefetchThreshold: 10, // Prefetch after 10 accesses
};

// Cache statistics
interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  memory: number;
  hitRate: number;
  avgResponseTime: number;
}

// Cache entry with metadata
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  compressed: boolean;
  size: number;
}

export class SearchCacheService {
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    memory: 0,
    hitRate: 0,
    avgResponseTime: 0,
  };
  private redis: any = null;
  
  constructor() {
    this.initializeRedis();
    this.startCleanupTimer();
  }

  /**
   * Initialize Redis connection with fallback
   */
  private async initializeRedis(): Promise<void> {
    try {
      // Try to initialize Redis if available
      // This would be replaced with actual Redis client in production
      console.log('Search cache initialized with in-memory fallback');
    } catch (error) {
      console.warn('Redis not available, using in-memory cache:', error);
    }
  }

  /**
   * Generate cache key from search filters
   */
  static generateCacheKey(filters: Partial<SearchFilters>): string {
    // Create deterministic key from search parameters
    const keyData = {
      query: filters.query || '',
      genres: filters.genres?.sort() || [],
      formats: filters.formats?.sort() || [],
      budgetMin: filters.budgetMin,
      budgetMax: filters.budgetMax,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      status: filters.status?.sort() || [],
      sortBy: filters.sortBy || 'relevance',
      sortOrder: filters.sortOrder || 'desc',
      page: filters.page || 1,
      limit: filters.limit || 20,
      // Exclude user-specific filters for cache sharing
      hasMedia: filters.hasMedia?.sort() || [],
      creatorType: filters.creatorType,
      verifiedOnly: filters.verifiedOnly,
      location: filters.location,
    };

    // Create hash from filter data
    const keyString = JSON.stringify(keyData);
    return `search:${this.hashString(keyString)}`;
  }

  /**
   * Simple string hashing for cache keys
   */
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached search results
   */
  async get(key: string): Promise<any | null> {
    const startTime = Date.now();
    
    try {
      // Try Redis first
      if (this.redis) {
        const redisResult = await this.getFromRedis(key);
        if (redisResult) {
          this.stats.hits++;
          this.updateAvgResponseTime(Date.now() - startTime);
          return redisResult;
        }
      }

      // Fallback to in-memory cache
      const entry = this.cache.get(key);
      if (!entry) {
        this.stats.misses++;
        return null;
      }

      // Check expiration
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.stats.misses++;
        return null;
      }

      // Update access metadata
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      
      // Check if we should prefetch similar queries
      if (entry.accessCount >= CACHE_CONFIG.prefetchThreshold) {
        this.considerPrefetch(key);
      }

      this.stats.hits++;
      this.updateStats();
      this.updateAvgResponseTime(Date.now() - startTime);
      
      return entry.compressed ? this.decompress(entry.data) : entry.data;
      
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set cached search results
   */
  async set(key: string, data: any, ttl = CACHE_CONFIG.defaultTTL): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      const size = serialized.length;
      const shouldCompress = size > CACHE_CONFIG.compressionThreshold;
      const finalData = shouldCompress ? this.compress(serialized) : data;
      
      const entry: CacheEntry = {
        data: finalData,
        timestamp: Date.now(),
        ttl,
        accessCount: 0,
        lastAccessed: Date.now(),
        compressed: shouldCompress,
        size,
      };

      // Try Redis first
      if (this.redis) {
        await this.setInRedis(key, entry, ttl);
      }

      // Always store in memory for fast access
      this.cache.set(key, entry);
      this.stats.sets++;
      this.stats.memory += size;
      
      // Cleanup if cache is too large
      if (this.cache.size > CACHE_CONFIG.maxCacheSize) {
        await this.evictLeastUsed();
      }
      
      this.updateStats();
      
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete cached entry
   */
  async delete(key: string): Promise<void> {
    try {
      if (this.redis) {
        await this.deleteFromRedis(key);
      }

      const entry = this.cache.get(key);
      if (entry) {
        this.stats.memory -= entry.size;
        this.cache.delete(key);
        this.stats.deletes++;
        this.updateStats();
      }
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    try {
      if (this.redis) {
        await this.clearRedis();
      }
      
      this.cache.clear();
      this.stats.memory = 0;
      this.updateStats();
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Invalidate cache entries matching pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      const keysToDelete: string[] = [];
      
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }
      
      for (const key of keysToDelete) {
        await this.delete(key);
      }
      
      console.log(`Invalidated ${keysToDelete.length} cache entries matching pattern: ${pattern}`);
    } catch (error) {
      console.error('Cache pattern invalidation error:', error);
    }
  }

  /**
   * Precompute popular searches for faster response
   */
  async precomputePopularSearches(): Promise<void> {
    try {
      // Get popular search terms from database
      const popularSearches = await this.getPopularSearchTerms();
      
      console.log(`Precomputing ${popularSearches.length} popular searches...`);
      
      for (const searchTerm of popularSearches) {
        const filters = { query: searchTerm, limit: 20 };
        const cacheKey = SearchCacheService.generateCacheKey(filters);
        
        // Check if already cached
        const existing = await this.get(cacheKey);
        if (!existing) {
          // This would trigger actual search and caching
          console.log(`Precomputing search for: ${searchTerm}`);
          // await SearchService.searchPitches(filters);
        }
      }
      
    } catch (error) {
      console.error('Precompute error:', error);
    }
  }

  /**
   * Warm up cache with common searches
   */
  async warmUpCache(): Promise<void> {
    try {
      const commonSearches = [
        { genres: ['Action'] },
        { genres: ['Comedy'] },
        { genres: ['Drama'] },
        { genres: ['Horror'] },
        { formats: ['Feature Film'] },
        { formats: ['Series'] },
        { budgetMax: 5000000 },
        { budgetMin: 1000000, budgetMax: 10000000 },
        { sortBy: 'newest' },
        { sortBy: 'views' },
      ];
      
      console.log('Warming up cache with common searches...');
      
      for (const filters of commonSearches) {
        const cacheKey = SearchCacheService.generateCacheKey(filters);
        const existing = await this.get(cacheKey);
        
        if (!existing) {
          // This would trigger actual search
          console.log('Warming cache for filters:', filters);
          // await SearchService.searchPitches(filters);
        }
      }
      
    } catch (error) {
      console.error('Cache warm-up error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Redis operations (would be implemented with actual Redis client)
   */
  private async getFromRedis(key: string): Promise<any> {
    // Placeholder for Redis implementation
    return null;
  }

  private async setInRedis(key: string, entry: CacheEntry, ttl: number): Promise<void> {
    // Placeholder for Redis implementation
  }

  private async deleteFromRedis(key: string): Promise<void> {
    // Placeholder for Redis implementation
  }

  private async clearRedis(): Promise<void> {
    // Placeholder for Redis implementation
  }

  /**
   * Get popular search terms from analytics
   */
  private async getPopularSearchTerms(): Promise<string[]> {
    try {
      // This would query the search_analytics table
      // For now, return mock data
      return [
        'action thriller',
        'romantic comedy',
        'horror',
        'sci-fi',
        'independent film',
        'documentary',
        'family friendly',
        'low budget',
        'female lead',
        'based on true story'
      ];
    } catch (error) {
      console.error('Error getting popular search terms:', error);
      return [];
    }
  }

  /**
   * Consider prefetching related queries
   */
  private async considerPrefetch(accessedKey: string): Promise<void> {
    // Implement intelligent prefetching logic
    // For example, if someone searches for "action", prefetch "action thriller"
    console.log(`Considering prefetch for popular key: ${accessedKey}`);
  }

  /**
   * Evict least recently used entries
   */
  private async evictLeastUsed(): Promise<void> {
    const entries = Array.from(this.cache.entries());
    
    // Sort by access count and last accessed time
    entries.sort((a, b) => {
      const aScore = a[1].accessCount * 0.7 + (Date.now() - a[1].lastAccessed) * 0.3;
      const bScore = b[1].accessCount * 0.7 + (Date.now() - b[1].lastAccessed) * 0.3;
      return aScore - bScore;
    });
    
    // Remove least used 10% of entries
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      const [key, entry] = entries[i];
      this.stats.memory -= entry.size;
      this.cache.delete(key);
    }
    
    console.log(`Evicted ${toRemove} cache entries`);
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Update average response time
   */
  private updateAvgResponseTime(responseTime: number): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.avgResponseTime = 
      ((this.stats.avgResponseTime * (total - 1)) + responseTime) / total;
  }

  /**
   * Simple compression (in production, use proper compression library)
   */
  private compress(data: string): string {
    // Placeholder - would use actual compression
    return data;
  }

  /**
   * Simple decompression
   */
  private decompress(data: string): any {
    // Placeholder - would use actual decompression
    return data;
  }

  /**
   * Start cleanup timer for expired entries
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpired();
    }, 60000); // Clean up every minute
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        toDelete.push(key);
        this.stats.memory -= entry.size;
      }
    }
    
    for (const key of toDelete) {
      this.cache.delete(key);
    }
    
    if (toDelete.length > 0) {
      console.log(`Cleaned up ${toDelete.length} expired cache entries`);
      this.updateStats();
    }
  }
}

// Export singleton instance
export const searchCache = new SearchCacheService();