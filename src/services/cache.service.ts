// Cache service with support for both Redis and in-memory fallback
// Supports Upstash Redis for Deno Deploy and standard Redis for self-hosted

// Helper function to safely extract error messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Helper to get environment variables across Deno/Node/Cloudflare
function getEnv(key: string): string | undefined {
  try {
    return (globalThis as any).Deno?.env.get(key) || (globalThis as any).process?.env[key];
  } catch {
    return undefined;
  }
}


interface CacheClient {
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
  expire(key: string, seconds: number): Promise<void>;
  incrby(key: string, value: number): Promise<void>;
  ttl(key: string): Promise<number>;
}

// In-memory cache implementation
class InMemoryCache implements CacheClient {
  private cache = new Map<string, { value: any; expiry?: number }>();

  async set(key: string, value: string) {
    this.cache.set(key, { value });
  }

  async get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (item.expiry && item.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  async del(key: string) {
    this.cache.delete(key);
  }

  async expire(key: string, seconds: number) {
    const item = this.cache.get(key);
    if (item) {
      item.expiry = Date.now() + seconds * 1000;
    }
  }

  async incrby(key: string, value: number) {
    const current = this.cache.get(key);
    const newValue = (current ? parseInt(current.value) : 0) + value;
    this.cache.set(key, { value: newValue.toString() });
  }

  async ttl(key: string) {
    const item = this.cache.get(key);
    if (!item || !item.expiry) return -1;
    const remaining = Math.floor((item.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }
}

// Upstash Redis client for Deno Deploy
class UpstashRedisClient implements CacheClient {
  private baseUrl: string;
  private token: string;

  constructor(url: string, token: string) {
    this.baseUrl = url;
    this.token = token;
  }

  private async request(command: string[]) {
    const encodedCommand = command.map(part => encodeURIComponent(part));
    const response = await fetch(`${this.baseUrl}/${encodedCommand.join('/')}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Upstash request failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.result;
  }

  async set(key: string, value: string) {
    await this.request(['SET', key, value]);
  }

  async get(key: string) {
    return await this.request(['GET', key]);
  }

  async del(key: string) {
    await this.request(['DEL', key]);
  }

  async expire(key: string, seconds: number) {
    await this.request(['EXPIRE', key, seconds.toString()]);
  }

  async incrby(key: string, value: number) {
    await this.request(['INCRBY', key, value.toString()]);
  }

  async ttl(key: string) {
    const result = await this.request(['TTL', key]);
    return parseInt(result);
  }
}

// Initialize cache based on environment
let cacheClient: CacheClient;
let cacheType = "in-memory";

// Try to initialize Redis/Upstash based on environment
async function initCache() {
  const cacheEnabled = getEnv("CACHE_ENABLED") === "true";
  
  if (!cacheEnabled) {
    console.log("📦 Cache disabled, using in-memory cache");
    cacheClient = new InMemoryCache();
    cacheType = "in-memory";
    return;
  }

  // Priority 1: Try Redis Cluster (for distributed production)
  const clusterEnabled = getEnv("REDIS_CLUSTER_ENABLED") === "true";
  if (clusterEnabled) {
    try {
      // Use dynamic import to avoid circular dependencies
      const { redisClusterService } = await import("./redis-cluster.service.ts");
      
      // Initialize cluster
      const initialized = await redisClusterService.initialize();
      if (initialized && redisClusterService.isEnabled()) {
        // Create a wrapper to match the CacheClient interface
        cacheClient = {
          async set(key: string, value: string) {
            const parsed = JSON.parse(value);
            await redisClusterService.set(key, parsed);
          },
          async get(key: string): Promise<string | null> {
            const result = await redisClusterService.get(key);
            return result ? JSON.stringify(result) : null;
          },
          async del(key: string) {
            await redisClusterService.del(key);
          },
          async expire(key: string, seconds: number) {
            await redisClusterService.expire(key, seconds);
          },
          async incrby(key: string, value: number) {
            await redisClusterService.incr(key);
          },
          async ttl(key: string): Promise<number> {
            return 300; // Default TTL, cluster service handles TTL differently
          }
        };
        cacheType = "redis-cluster";
        console.log("✅ Using Redis Cluster for distributed caching");
        return;
      }
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      console.warn("⚠️ Redis cluster connection failed:", errorMessage);
    }
  }
  
  // Priority 2: Try native Redis (for local development)
  const redisHost = getEnv("REDIS_HOST");
  const redisPort = getEnv("REDIS_PORT");
  
  if (redisHost && redisPort) {
    try {
      // Use dynamic import to avoid circular dependencies
      const { nativeRedisService } = await import("./redis-native.service.ts");
      
      // Initialize and test connection
      const connected = await nativeRedisService.connect();
      if (connected && nativeRedisService.isEnabled()) {
        // Create a wrapper to match the CacheClient interface
        cacheClient = {
          async set(key: string, value: string) {
            const parsed = JSON.parse(value);
            await nativeRedisService.set(key, parsed);
          },
          async get(key: string): Promise<string | null> {
            const result = await nativeRedisService.get(key);
            return result ? JSON.stringify(result) : null;
          },
          async del(key: string) {
            await nativeRedisService.del(key);
          },
          async expire(key: string, seconds: number) {
            await nativeRedisService.expire(key, seconds);
          },
          async incrby(key: string, value: number) {
            await nativeRedisService.incr(key);
          },
          async ttl(key: string): Promise<number> {
            return 300; // Default TTL, native service handles TTL differently
          }
        };
        cacheType = "native-redis";
        console.log("✅ Using native Redis for cache service");
        return;
      }
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      console.warn("⚠️ Native Redis connection failed:", errorMessage);
    }
  }
  
  // Priority 3: Try Upstash Redis (for Deno Deploy/serverless)
  const upstashUrl = getEnv("UPSTASH_REDIS_REST_URL");
  const upstashToken = getEnv("UPSTASH_REDIS_REST_TOKEN");
  
  if (upstashUrl && upstashToken) {
    try {
      cacheClient = new UpstashRedisClient(upstashUrl, upstashToken);
      // Test connection
      await cacheClient.set("test", "1");
      await cacheClient.del("test");
      cacheType = "upstash-redis";
      console.log("✅ Connected to Upstash Redis (serverless)");
      return;
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      console.warn("⚠️ Upstash Redis connection failed:", errorMessage);
    }
  }

  // Fallback: In-memory cache (single instance only)
  cacheClient = new InMemoryCache();
  cacheType = "in-memory";
  console.log("📦 Using in-memory cache (single instance only)");
}

// Initialize on module load
await initCache();

export class CacheService {
  // Get cache type for monitoring
  static getCacheType(): string {
    return cacheType;
  }

  // Check if distributed cache is available (Redis/Upstash)
  static isDistributed(): boolean {
    return cacheType !== "in-memory";
  }

  // Pitch caching
  static async cachePitch(pitchId: number, data: any, ttl = 3600) {
    try {
      await cacheClient.set(`pitch:${pitchId}`, JSON.stringify(data));
      await cacheClient.expire(`pitch:${pitchId}`, ttl);
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
    }
  }
  
  static async getCachedPitch(pitchId: number) {
    try {
      const cached = await cacheClient.get(`pitch:${pitchId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
      return null;
    }
  }
  
  static async invalidatePitch(pitchId: number) {
    try {
      await cacheClient.del(`pitch:${pitchId}`);
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
    }
  }
  
  // User session caching
  static async cacheUserSession(userId: number, data: any, ttl = 86400) {
    try {
      await cacheClient.set(`session:user:${userId}`, JSON.stringify(data));
      await cacheClient.expire(`session:user:${userId}`, ttl);
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
    }
  }
  
  static async getUserSession(userId: number) {
    try {
      const cached = await cacheClient.get(`session:user:${userId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
      return null;
    }
  }
  
  static async invalidateUserSession(userId: number) {
    try {
      await cacheClient.del(`session:user:${userId}`);
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
    }
  }
  
  // View counting with rate limiting
  static async incrementViewCount(pitchId: number, ipAddress: string) {
    try {
      const key = `view:${pitchId}:${ipAddress}`;
      const exists = await cacheClient.get(key);
      
      if (!exists) {
        await cacheClient.set(key, "1");
        await cacheClient.expire(key, 3600); // 1 hour
        return true; // Count this view
      }
      
      return false; // Already viewed recently
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
      return true; // Default to counting views on error
    }
  }
  
  // Homepage caching
  static async cacheHomepageData(data: any, ttl = 300) {
    try {
      await cacheClient.set("homepage:data", JSON.stringify(data));
      await cacheClient.expire("homepage:data", ttl);
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
    }
  }
  
  static async getHomepageData() {
    try {
      const cached = await cacheClient.get("homepage:data");
      return cached ? JSON.parse(cached) : null;
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
      return null;
    }
  }
  
  static async invalidateHomepage() {
    try {
      await cacheClient.del("homepage:data");
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
    }
  }
  
  // Search results caching
  static async cacheSearchResults(query: string, results: any, ttl = 600) {
    try {
      const key = `search:${btoa(query)}`;
      await cacheClient.set(key, JSON.stringify(results));
      await cacheClient.expire(key, ttl);
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
    }
  }
  
  static async getCachedSearchResults(query: string) {
    try {
      const key = `search:${btoa(query)}`;
      const cached = await cacheClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
      return null;
    }
  }
  
  // Analytics aggregation
  static async trackDailyMetric(metric: string, value = 1) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `metrics:${metric}:${today}`;
      await cacheClient.incrby(key, value);
      await cacheClient.expire(key, 86400 * 7); // Keep for 7 days
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
    }
  }
  
  static async getDailyMetric(metric: string, date?: string) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const key = `metrics:${metric}:${targetDate}`;
      const value = await cacheClient.get(key);
      return value ? parseInt(value) : 0;
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
      return 0;
    }
  }
  
  // Public pitches cache
  static async cachePublicPitches(data: any, ttl = 300) {
    try {
      await cacheClient.set("pitches:public", JSON.stringify(data));
      await cacheClient.expire("pitches:public", ttl);
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
    }
  }
  
  static async getPublicPitches() {
    try {
      const cached = await cacheClient.get("pitches:public");
      return cached ? JSON.parse(cached) : null;
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
      return null;
    }
  }
  
  static async invalidatePublicPitches() {
    try {
      await cacheClient.del("pitches:public");
      await cacheClient.del("pitches:trending");
      await cacheClient.del("pitches:new");
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
    }
  }

  // Browse cache invalidation
  static async invalidateBrowseCache() {
    try {
      // Clear browse cache patterns - these match the cache keys used in browse endpoints
      const browsePatterns = [
        "pitches:browse:",  // General browse with different sort/filter combinations
        "pitches:newest:",  // Newest pitches cache
        "pitches:featured:", // Featured pitches cache
        "pitches:trending:", // Trending pitches cache
        "browse:enhanced:",  // Enhanced browse cache
        "investor:browse:",  // Investor browse cache
      ];
      
      // Since we don't have pattern deletion in the basic cache client,
      // we'll clear known common browse cache keys
      const commonBrowseKeys = [
        "pitches:browse:date:desc:all:all:20:0",
        "pitches:browse:views:desc:all:all:20:0", 
        "pitches:browse:likes:desc:all:all:20:0",
        "pitches:browse:alphabetical:asc:all:all:20:0",
        "pitches:newest:10",
        "pitches:newest:20",
        "pitches:featured:10",
        "pitches:featured:20",
        "investor:browse:default",
      ];
      
      // Clear each cache key
      for (const key of commonBrowseKeys) {
        try {
          await cacheClient.del(key);
        } catch (error: any) {
          console.warn(`Failed to clear browse cache key ${key}:`, getErrorMessage(error));
        }
      }
    } catch (error: any) {
      console.warn("Browse cache invalidation error:", getErrorMessage(error));
    }
  }

  // Marketplace cache
  static async invalidateMarketplace() {
    try {
      await this.invalidatePublicPitches();
      await this.invalidateHomepage();
      await this.invalidateBrowseCache(); // Add browse cache invalidation
    } catch (error: any) {
      console.warn("Cache error:", getErrorMessage(error));
    }
  }
  
  // Health check for cache status
  static async healthCheck() {
    const baseHealth = {
      type: cacheType,
      distributed: cacheType !== "in-memory",
      status: "healthy"
    };

    // Add cluster-specific health information
    if (cacheType === "redis-cluster") {
      try {
        const { redisClusterService } = await import("./redis-cluster.service.ts");
        const clusterStats = redisClusterService.getStats();
        const clusterInfo = redisClusterService.getClusterInfo();
        
        return {
          ...baseHealth,
          cluster: {
            enabled: true,
            totalNodes: clusterStats.totalNodes,
            healthyNodes: clusterStats.healthyNodes,
            failedNodes: clusterStats.failedNodes,
            operations: {
              total: clusterStats.totalOperations,
              successful: clusterStats.successfulOperations,
              failed: clusterStats.failedOperations,
              successRate: clusterStats.totalOperations > 0 
                ? (clusterStats.successfulOperations / clusterStats.totalOperations * 100).toFixed(2) + '%'
                : '0%'
            },
            performance: {
              averageResponseTime: clusterStats.averageResponseTime,
              uptime: clusterStats.uptime
            },
            connectionPool: clusterStats.poolStats,
            nodes: clusterInfo.nodes
          }
        };
      } catch (error: any) {
        return {
          ...baseHealth,
          cluster: {
            enabled: true,
            error: getErrorMessage(error),
            status: "unhealthy"
          }
        };
      }
    }

    // Add native Redis health information
    if (cacheType === "native-redis") {
      try {
        const { nativeRedisService } = await import("./redis-native.service.ts");
        const stats = nativeRedisService.getStats();
        
        return {
          ...baseHealth,
          redis: {
            enabled: nativeRedisService.isEnabled(),
            operations: stats.operations,
            performance: {
              hits: stats.hits,
              misses: stats.misses,
              hitRate: (stats.hits + stats.misses) > 0 
                ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2) + '%'
                : '0%',
              errors: stats.errors,
              uptime: stats.uptime
            }
          }
        };
      } catch (error: any) {
        return {
          ...baseHealth,
          redis: {
            enabled: false,
            error: getErrorMessage(error),
            status: "unhealthy"
          }
        };
      }
    }

    return baseHealth;
  }

  // Get detailed cache statistics
  static async getDetailedStats() {
    const health = await this.healthCheck();
    
    return {
      cacheType,
      timestamp: new Date().toISOString(),
      ...health
    };
  }

  // Cluster management methods (only available when using cluster)
  static async getClusterInfo() {
    if (cacheType !== "redis-cluster") {
      return { error: "Cluster not enabled", type: cacheType };
    }

    try {
      const { redisClusterService } = await import("./redis-cluster.service.ts");
      return redisClusterService.getClusterInfo();
    } catch (error: any) {
      return { error: getErrorMessage(error) };
    }
  }

  static async getClusterStats() {
    if (cacheType !== "redis-cluster") {
      return { error: "Cluster not enabled", type: cacheType };
    }

    try {
      const { redisClusterService } = await import("./redis-cluster.service.ts");
      return redisClusterService.getStats();
    } catch (error: any) {
      return { error: getErrorMessage(error) };
    }
  }
  // Generic cache methods
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const cached = await cacheClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error: any) {
      console.warn('Cache get error for key:', key, getErrorMessage(error));
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await cacheClient.set(key, JSON.stringify(value));
      if (ttl) {
        await cacheClient.expire(key, ttl);
      }
    } catch (error: any) {
      console.warn('Cache set error for key:', key, getErrorMessage(error));
    }
  }

  async setWithTTL(key: string, value: any, ttl: number): Promise<void> {
    return this.set(key, value, ttl);
  }

  async delete(key: string): Promise<void> {
    try {
      await cacheClient.del(key);
    } catch (error: any) {
      console.warn('Cache delete error for key:', key, getErrorMessage(error));
    }
  }
}

// Initialize cache service
let cacheServiceInstance: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
}

// Redis connection helper for email services
export async function getRedisConnection(): Promise<any> {
  try {
    const cacheService = getCacheService();
    
    // Return a Redis-like interface that wraps the cache service
    return {
      async hset(key: string, field: string, value: string): Promise<void> {
        const cacheKey = `${key}:${field}`;
        await cacheService.set(cacheKey, value);
      },
      
      async hget(key: string, field: string): Promise<string | null> {
        const cacheKey = `${key}:${field}`;
        return await cacheService.get(cacheKey);
      },
      
      async hgetall(key: string): Promise<Record<string, string>> {
        // Note: This is a simplified implementation
        // In a real Redis setup, this would get all hash fields
        try {
          const value = await cacheService.get(key);
          return value ? JSON.parse(value) : {};
        } catch {
          return {};
        }
      },
      
      async hincrby(key: string, field: string, increment: number): Promise<void> {
        const cacheKey = `${key}:${field}`;
        const current = await cacheService.get(cacheKey);
        const currentValue = current ? parseInt(current) : 0;
        await cacheService.set(cacheKey, String(currentValue + increment));
      },
      
      async set(key: string, value: string): Promise<void> {
        await cacheService.set(key, value);
      },
      
      async get(key: string): Promise<string | null> {
        return await cacheService.get(key);
      },
      
      async del(key: string): Promise<void> {
        await cacheService.delete(key);
      },
      
      async expire(key: string, seconds: number): Promise<void> {
        await cacheService.setWithTTL(key, await cacheService.get(key) || '', seconds);
      },
      
      async zadd(key: string, score: number, value: string): Promise<void> {
        // Simplified sorted set implementation using JSON
        const existingData = await cacheService.get(key);
        const sortedSet: Array<{score: number, value: string}> = existingData ? JSON.parse(existingData) : [];
        
        // Remove existing entry with same value
        const filtered = sortedSet.filter(item => item.value !== value);
        
        // Add new entry
        filtered.push({score, value});
        
        // Sort by score
        filtered.sort((a, b) => a.score - b.score);
        
        await cacheService.set(key, JSON.stringify(filtered));
      },
      
      async zrangebyscore(key: string, min: number, max: number, ...args: string[]): Promise<string[]> {
        const data = await cacheService.get(key);
        if (!data) return [];
        
        try {
          const sortedSet: Array<{score: number, value: string}> = JSON.parse(data);
          return sortedSet
            .filter(item => item.score >= min && item.score <= max)
            .map(item => item.value);
        } catch {
          return [];
        }
      },
      
      async zrem(key: string, value: string): Promise<void> {
        const data = await cacheService.get(key);
        if (!data) return;
        
        try {
          const sortedSet: Array<{score: number, value: string}> = JSON.parse(data);
          const filtered = sortedSet.filter(item => item.value !== value);
          await cacheService.set(key, JSON.stringify(filtered));
        } catch {
          // Ignore parsing errors
        }
      },
      
      async zcard(key: string): Promise<number> {
        const data = await cacheService.get(key);
        if (!data) return 0;
        
        try {
          const sortedSet: Array<{score: number, value: string}> = JSON.parse(data);
          return sortedSet.length;
        } catch {
          return 0;
        }
      },
      
      async lpush(key: string, value: string): Promise<void> {
        const data = await cacheService.get(key);
        const list: string[] = data ? JSON.parse(data) : [];
        list.unshift(value);
        await cacheService.set(key, JSON.stringify(list));
      },
      
      async ltrim(key: string, start: number, stop: number): Promise<void> {
        const data = await cacheService.get(key);
        if (!data) return;
        
        try {
          const list: string[] = JSON.parse(data);
          const trimmed = list.slice(start, stop + 1);
          await cacheService.set(key, JSON.stringify(trimmed));
        } catch {
          // Ignore parsing errors
        }
      },
      
      async lrange(key: string, start: number, stop: number): Promise<string[]> {
        const data = await cacheService.get(key);
        if (!data) return [];
        
        try {
          const list: string[] = JSON.parse(data);
          return stop === -1 ? list.slice(start) : list.slice(start, stop + 1);
        } catch {
          return [];
        }
      },
      
      async sadd(key: string, member: string): Promise<void> {
        const data = await cacheService.get(key);
        const set: string[] = data ? JSON.parse(data) : [];
        if (!set.includes(member)) {
          set.push(member);
          await cacheService.set(key, JSON.stringify(set));
        }
      },
      
      async sismember(key: string, member: string): Promise<number> {
        const data = await cacheService.get(key);
        if (!data) return 0;
        
        try {
          const set: string[] = JSON.parse(data);
          return set.includes(member) ? 1 : 0;
        } catch {
          return 0;
        }
      }
    };
  } catch (error: any) {
    console.warn("Redis connection fallback to null:", error);
    return null;
  }
}

// Export the default cache service instance
export const cacheService = getCacheService();