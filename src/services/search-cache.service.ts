import { db } from "../db/client.ts";
import { realtimeAnalytics } from "../db/schema.ts";
import { eq, lt } from "drizzle-orm";

export interface CacheEntry {
  key: string;
  data: any;
  expiresAt: Date;
  createdAt: Date;
  hits: number;
}

export class SearchCacheService {
  private static instance: SearchCacheService;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly CLEANUP_INTERVAL = 2 * 60 * 1000; // 2 minutes

  constructor() {
    // Start cleanup interval
    setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  static getInstance(): SearchCacheService {
    if (!SearchCacheService.instance) {
      SearchCacheService.instance = new SearchCacheService();
    }
    return SearchCacheService.instance;
  }

  // Generate cache key from search filters
  static generateCacheKey(filters: any): string {
    // Sort keys to ensure consistent cache keys
    const sortedFilters = Object.keys(filters)
      .sort()
      .reduce((result: any, key) => {
        result[key] = filters[key];
        return result;
      }, {});

    return btoa(JSON.stringify(sortedFilters));
  }

  // Get cached search results
  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count
    entry.hits++;
    
    return entry.data;
  }

  // Cache search results
  async set(key: string, data: any, ttl?: number): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (ttl || this.DEFAULT_TTL));

    // Check cache size and evict if necessary
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLeastUsed();
    }

    const entry: CacheEntry = {
      key,
      data,
      expiresAt,
      createdAt: now,
      hits: 0
    };

    this.cache.set(key, entry);

    // Persist popular cache entries to database
    if (entry.hits > 10) {
      this.persistToDatabase(key, data, expiresAt);
    }
  }

  // Delete cache entry
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    
    // Also delete from database
    try {
      await db.delete(realtimeAnalytics)
        .where(eq(realtimeAnalytics.cacheKey, key));
    } catch (error) {
      console.error('Failed to delete cache entry from database:', error);
    }
  }

  // Clear all cache
  async clear(): Promise<void> {
    this.cache.clear();
    
    // Also clear database cache
    try {
      await db.delete(realtimeAnalytics);
    } catch (error) {
      console.error('Failed to clear database cache:', error);
    }
  }

  // Get cache statistics
  getCacheStats() {
    const now = new Date();
    let totalHits = 0;
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      
      if (now <= entry.expiresAt) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      totalHits,
      hitRate: totalHits / Math.max(this.cache.size, 1),
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });

    // Also cleanup database cache
    this.cleanupDatabase();
  }

  // Evict least used entries when cache is full
  private evictLeastUsed(): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by hits (ascending) and age (descending)
    entries.sort(([, a], [, b]) => {
      if (a.hits !== b.hits) {
        return a.hits - b.hits;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // Remove bottom 10% of entries
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  // Persist frequently used cache entries to database
  private async persistToDatabase(key: string, data: any, expiresAt: Date): Promise<void> {
    try {
      await db.insert(realtimeAnalytics).values({
        cacheKey: key,
        data,
        expiresAt,
        lastUpdated: new Date(),
        version: 1
      }).onConflictDoUpdate({
        target: realtimeAnalytics.cacheKey,
        set: {
          data,
          expiresAt,
          lastUpdated: new Date(),
          version: 1
        }
      });
    } catch (error) {
      console.error('Failed to persist cache entry to database:', error);
    }
  }

  // Cleanup expired database cache entries
  private async cleanupDatabase(): Promise<void> {
    try {
      await db.delete(realtimeAnalytics)
        .where(lt(realtimeAnalytics.expiresAt, new Date()));
    } catch (error) {
      console.error('Failed to cleanup database cache:', error);
    }
  }

  // Estimate memory usage (rough approximation)
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      // Rough estimation of object size in bytes
      totalSize += JSON.stringify(entry.data).length * 2; // Unicode is 2 bytes per char
      totalSize += entry.key.length * 2;
      totalSize += 200; // Overhead for dates, numbers, etc.
    }
    
    return totalSize;
  }

  // Load popular cache entries from database on startup
  async loadFromDatabase(): Promise<void> {
    try {
      const entries = await db.select()
        .from(realtimeAnalytics)
        .where(
          eq(realtimeAnalytics.expiresAt, new Date())
        )
        .limit(100); // Load top 100 most recent entries

      for (const dbEntry of entries) {
        if (dbEntry.expiresAt > new Date()) {
          const cacheEntry: CacheEntry = {
            key: dbEntry.cacheKey,
            data: dbEntry.data,
            expiresAt: dbEntry.expiresAt,
            createdAt: dbEntry.lastUpdated,
            hits: 0
          };
          
          this.cache.set(dbEntry.cacheKey, cacheEntry);
        }
      }
    } catch (error) {
      console.error('Failed to load cache from database:', error);
    }
  }

  // Precompute and cache popular search combinations
  async precomputePopularSearches(): Promise<void> {
    const popularQueries = [
      'drama',
      'comedy',
      'thriller',
      'feature film',
      'tv series',
      'low budget',
      'high budget',
      'independent',
      'studio'
    ];

    const popularFilters = [
      { genres: ['drama'] },
      { genres: ['comedy'] },
      { formats: ['feature'] },
      { formats: ['tv'] },
      { budgetMax: 1000000 },
      { budgetMin: 10000000 },
      { verifiedOnly: true },
      { hasMedia: ['trailer'] }
    ];

    // Precompute combinations
    for (const query of popularQueries) {
      for (const filter of popularFilters) {
        const searchFilters = { query, ...filter, limit: 20, page: 1 };
        const cacheKey = SearchCacheService.generateCacheKey(searchFilters);
        
        // Only precompute if not already cached
        if (!this.cache.has(cacheKey)) {
          try {
            // This would be called by the search service
            // We'll set up a background job for this
            console.log(`Precomputing search for: ${query} with filters:`, filter);
          } catch (error) {
            console.error('Failed to precompute search:', error);
          }
        }
      }
    }
  }

  // Invalidate cache entries based on patterns
  async invalidatePattern(pattern: string): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });

    // Also invalidate in database
    try {
      // This would require a more sophisticated pattern matching in SQL
      // For now, we'll implement simple cache invalidation
      console.log(`Invalidated ${keysToDelete.length} cache entries matching pattern: ${pattern}`);
    } catch (error) {
      console.error('Failed to invalidate cache pattern in database:', error);
    }
  }

  // Warm up cache with common searches
  async warmUpCache(): Promise<void> {
    const commonSearches = [
      { query: '', sortBy: 'newest', limit: 20 },
      { query: '', sortBy: 'views', limit: 20 },
      { query: '', sortBy: 'likes', limit: 20 },
      { genres: ['drama'], limit: 20 },
      { genres: ['comedy'], limit: 20 },
      { formats: ['feature'], limit: 20 },
      { formats: ['tv'], limit: 20 }
    ];

    for (const filters of commonSearches) {
      const cacheKey = SearchCacheService.generateCacheKey(filters);
      
      if (!this.cache.has(cacheKey)) {
        // This would trigger actual search to populate cache
        console.log('Warming up cache for filters:', filters);
      }
    }
  }
}

// Export singleton instance
export const searchCache = SearchCacheService.getInstance();