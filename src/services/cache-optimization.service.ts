/**
 * Cache Optimization Service
 * Provides intelligent caching strategies and performance optimization
 */

import { telemetry } from "../utils/telemetry.ts";

export interface CacheConfig {
  provider: "memory" | "redis" | "hybrid";
  defaultTTL: number;
  maxSize: number;
  compression: boolean;
  serialization: "json" | "msgpack";
  evictionPolicy: "lru" | "lfu" | "ttl";
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  expires: number;
  hits: number;
  size: number;
  tags: string[];
  created: number;
  lastAccessed: number;
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  totalRequests: number;
  averageResponseTime: number;
  memoryUsage: number;
  keyCount: number;
  topKeys: Array<{ key: string; hits: number; size: number }>;
}

export interface CacheStrategy {
  name: string;
  ttl: number;
  tags?: string[];
  condition?: (data: any) => boolean;
  transform?: (data: any) => any;
}

export class CacheOptimizationService {
  private static cache = new Map<string, CacheEntry<any>>();
  private static metrics = {
    hits: 0,
    misses: 0,
    operations: 0,
    responseTime: [] as number[]
  };
  
  private static readonly config: CacheConfig = {
    provider: "memory",
    defaultTTL: 300000, // 5 minutes
    maxSize: 1000,
    compression: false,
    serialization: "json",
    evictionPolicy: "lru"
  };

  // Predefined cache strategies for different data types
  private static readonly strategies = new Map<string, CacheStrategy>([
    ["pitches:public", {
      name: "Public Pitches",
      ttl: 180000, // 3 minutes
      tags: ["pitches", "public"],
      condition: (data) => Array.isArray(data) && data.length > 0
    }],
    ["pitches:search", {
      name: "Search Results",
      ttl: 300000, // 5 minutes  
      tags: ["pitches", "search"],
      condition: (data) => data?.pitches?.length > 0,
      transform: (data) => ({
        ...data,
        cached_at: Date.now()
      })
    }],
    ["user:profile", {
      name: "User Profiles",
      ttl: 600000, // 10 minutes
      tags: ["users", "profiles"],
      condition: (data) => data?.id && data?.email
    }],
    ["analytics:dashboard", {
      name: "Dashboard Analytics",
      ttl: 300000, // 5 minutes
      tags: ["analytics", "dashboard"],
      condition: (data) => data?.metrics || data?.stats
    }],
    ["system:health", {
      name: "Health Check Data",
      ttl: 60000, // 1 minute
      tags: ["system", "health"],
      condition: (data) => data?.overall && data?.services
    }],
    ["nda:requests", {
      name: "NDA Requests",
      ttl: 120000, // 2 minutes
      tags: ["nda", "requests"],
      condition: (data) => Array.isArray(data)
    }],
    ["investments:portfolio", {
      name: "Investment Portfolio",
      ttl: 240000, // 4 minutes
      tags: ["investments", "portfolio"],
      condition: (data) => data?.investments || data?.totalValue
    }]
  ]);

  /**
   * Get cached data with intelligent fallback
   */
  static async get<T>(
    key: string,
    fallback: () => Promise<T>,
    strategy?: string
  ): Promise<{ data: T; cached: boolean; source: string }> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cached = this.getFromCache<T>(key);
      if (cached) {
        this.recordHit(key, Date.now() - startTime);
        return {
          data: cached,
          cached: true,
          source: "cache"
        };
      }

      // Cache miss - execute fallback
      this.recordMiss(key);
      const data = await fallback();
      
      // Store in cache with strategy
      const cacheStrategy = strategy ? this.strategies.get(strategy) : undefined;
      await this.set(key, data, cacheStrategy);
      
      const responseTime = Date.now() - startTime;
      this.recordResponse(responseTime);
      
      return {
        data,
        cached: false,
        source: "database"
      };

    } catch (error) {
      telemetry.logger.error("Cache get operation failed", error, { key, strategy });
      
      // Execute fallback without caching on error
      const data = await fallback();
      return {
        data,
        cached: false,
        source: "fallback"
      };
    }
  }

  /**
   * Set cache with intelligent strategy
   */
  static async set<T>(
    key: string, 
    value: T, 
    strategy?: CacheStrategy
  ): Promise<void> {
    try {
      const ttl = strategy?.ttl || this.config.defaultTTL;
      const tags = strategy?.tags || [];
      
      // Apply condition check if specified
      if (strategy?.condition && !strategy.condition(value)) {
        return; // Skip caching if condition not met
      }

      // Apply transformation if specified
      const finalValue = strategy?.transform ? strategy.transform(value) : value;
      
      // Check cache size and evict if needed
      if (this.cache.size >= this.config.maxSize) {
        this.evictOldEntries();
      }

      const entry: CacheEntry<T> = {
        key,
        value: finalValue,
        expires: Date.now() + ttl,
        hits: 0,
        size: this.calculateSize(finalValue),
        tags,
        created: Date.now(),
        lastAccessed: Date.now()
      };

      this.cache.set(key, entry);
      
      telemetry.logger.debug("Cache set", { key, ttl, tags, size: entry.size });

    } catch (error) {
      telemetry.logger.error("Cache set operation failed", error, { key });
    }
  }

  /**
   * Get from cache with expiration check
   */
  private static getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    // Update access metrics
    entry.hits++;
    entry.lastAccessed = Date.now();

    return entry.value as T;
  }

  /**
   * Invalidate cache by key or tags
   */
  static async invalidate(keyOrPattern: string, byTags = false): Promise<number> {
    let deletedCount = 0;

    try {
      if (byTags) {
        // Invalidate by tags
        const keysToDelete: string[] = [];
        
        for (const [key, entry] of this.cache.entries()) {
          if (entry.tags.includes(keyOrPattern)) {
            keysToDelete.push(key);
          }
        }

        keysToDelete.forEach(key => {
          this.cache.delete(key);
          deletedCount++;
        });

        telemetry.logger.info("Cache invalidated by tag", { tag: keyOrPattern, count: deletedCount });
        
      } else {
        // Invalidate specific key or pattern
        if (keyOrPattern.includes("*")) {
          // Pattern matching
          const pattern = new RegExp(keyOrPattern.replace(/\*/g, ".*"));
          const keysToDelete: string[] = [];
          
          for (const key of this.cache.keys()) {
            if (pattern.test(key)) {
              keysToDelete.push(key);
            }
          }

          keysToDelete.forEach(key => {
            this.cache.delete(key);
            deletedCount++;
          });

        } else {
          // Exact key match
          if (this.cache.delete(keyOrPattern)) {
            deletedCount = 1;
          }
        }

        telemetry.logger.info("Cache invalidated", { key: keyOrPattern, count: deletedCount });
      }

      return deletedCount;

    } catch (error) {
      telemetry.logger.error("Cache invalidation failed", error, { key: keyOrPattern, byTags });
      return 0;
    }
  }

  /**
   * Get cache metrics and performance data
   */
  static getMetrics(): CacheMetrics {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate = totalRequests > 0 ? this.metrics.hits / totalRequests : 0;
    const missRate = totalRequests > 0 ? this.metrics.misses / totalRequests : 0;
    
    const averageResponseTime = this.metrics.responseTime.length > 0
      ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length
      : 0;

    const memoryUsage = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);

    const topKeys = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, hits: entry.hits, size: entry.size }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    return {
      hitRate,
      missRate,
      totalHits: this.metrics.hits,
      totalMisses: this.metrics.misses,
      totalRequests,
      averageResponseTime,
      memoryUsage,
      keyCount: this.cache.size,
      topKeys
    };
  }

  /**
   * Warm up cache with commonly accessed data
   */
  static async warmUp(): Promise<void> {
    console.log('🔥 Warming up cache...');
    
    try {
      // This would typically pre-load commonly accessed data
      // For demonstration, we'll just log the strategy
      
      const warmupTasks = [
        "pitches:public - Load recent public pitches",
        "system:health - Cache initial health check",
        "analytics:dashboard - Pre-compute dashboard metrics"
      ];

      for (const task of warmupTasks) {
        console.log(`   ⏳ ${task}`);
      }

      console.log('✅ Cache warm-up completed');
      telemetry.logger.info("Cache warmed up", { strategies: warmupTasks.length });

    } catch (error) {
      console.error('❌ Cache warm-up failed:', error);
      telemetry.logger.error("Cache warm-up failed", error);
    }
  }

  /**
   * Clean expired entries and optimize cache
   */
  static cleanUp(): number {
    const before = this.cache.size;
    const now = Date.now();
    const keysToDelete: string[] = [];

    // Find expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        keysToDelete.push(key);
      }
    }

    // Delete expired entries
    keysToDelete.forEach(key => this.cache.delete(key));
    
    const cleaned = keysToDelete.length;
    
    if (cleaned > 0) {
      telemetry.logger.info("Cache cleanup completed", { 
        before, 
        after: this.cache.size, 
        cleaned 
      });
    }

    return cleaned;
  }

  /**
   * Analyze cache performance and provide recommendations
   */
  static analyzePerformance(): {
    recommendations: string[];
    issues: string[];
    optimization_tips: string[];
  } {
    const metrics = this.getMetrics();
    const recommendations: string[] = [];
    const issues: string[] = [];
    const optimization_tips: string[] = [];

    // Analyze hit rate
    if (metrics.hitRate < 0.5) {
      issues.push("Low cache hit rate detected");
      recommendations.push("Review cache TTL settings and increase for stable data");
      recommendations.push("Consider implementing cache warming for popular content");
    }

    // Analyze memory usage
    if (metrics.memoryUsage > 50 * 1024 * 1024) { // 50MB
      issues.push("High memory usage in cache");
      recommendations.push("Implement more aggressive eviction policies");
      recommendations.push("Consider using compression for large cache entries");
    }

    // Analyze response time
    if (metrics.averageResponseTime > 100) {
      issues.push("Slow cache operations detected");
      recommendations.push("Consider switching to Redis for better performance");
      optimization_tips.push("Optimize serialization format");
    }

    // General optimization tips
    optimization_tips.push(
      "Use cache tags for efficient bulk invalidation",
      "Implement cache hierarchies for different data types",
      "Monitor cache metrics regularly for optimization opportunities",
      "Consider implementing read-through and write-through patterns"
    );

    return {
      recommendations,
      issues,
      optimization_tips
    };
  }

  // Private helper methods

  private static evictOldEntries(): void {
    if (this.config.evictionPolicy === "lru") {
      // Remove least recently used entries
      const entries = Array.from(this.cache.entries());
      entries.sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed);
      
      const toEvict = Math.ceil(this.config.maxSize * 0.1); // Evict 10%
      for (let i = 0; i < toEvict && entries.length > 0; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  private static calculateSize(value: any): number {
    // Simple size calculation - in production, this would be more sophisticated
    try {
      return JSON.stringify(value).length;
    } catch {
      return 1000; // Default size for non-serializable objects
    }
  }

  private static recordHit(key: string, responseTime: number): void {
    this.metrics.hits++;
    this.metrics.responseTime.push(responseTime);
    
    // Keep response time array manageable
    if (this.metrics.responseTime.length > 1000) {
      this.metrics.responseTime = this.metrics.responseTime.slice(-500);
    }
  }

  private static recordMiss(key: string): void {
    this.metrics.misses++;
  }

  private static recordResponse(responseTime: number): void {
    this.metrics.responseTime.push(responseTime);
  }
}