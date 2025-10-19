// Cache service with support for both Redis and in-memory fallback
// Supports Upstash Redis for Deno Deploy and standard Redis for self-hosted

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
    const response = await fetch(`${this.baseUrl}/${command.join('/')}`, {
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
  // Check for native Redis first (for local development)
  const redisHost = Deno.env.get("REDIS_HOST");
  const redisPort = Deno.env.get("REDIS_PORT");
  const cacheEnabled = Deno.env.get("CACHE_ENABLED") === "true";
  
  if (cacheEnabled && redisHost && redisPort) {
    try {
      // Use dynamic import to avoid circular dependencies
      const { nativeRedisService } = await import("./redis-native.service.ts");
      
      // Test if Redis is connected
      if (nativeRedisService.isEnabled()) {
        // Create a wrapper to match the CacheClient interface
        cacheClient = {
          async set(key: string, value: string) {
            await nativeRedisService.set(key, value);
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
    } catch (error) {
      console.warn("⚠️ Native Redis connection failed:", error.message);
    }
  }
  
  // Check for Upstash Redis (for Deno Deploy)
  const upstashUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const upstashToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  
  if (upstashUrl && upstashToken) {
    try {
      cacheClient = new UpstashRedisClient(upstashUrl, upstashToken);
      // Test connection
      await cacheClient.set("test", "1");
      await cacheClient.del("test");
      cacheType = "upstash-redis";
      console.log("✅ Connected to Upstash Redis (serverless)");
      return;
    } catch (error) {
      console.warn("⚠️ Upstash Redis connection failed:", error.message);
    }
  }

  // Fallback to in-memory cache
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
    } catch (error) {
      console.warn("Cache error:", error.message);
    }
  }
  
  static async getCachedPitch(pitchId: number) {
    try {
      const cached = await cacheClient.get(`pitch:${pitchId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn("Cache error:", error.message);
      return null;
    }
  }
  
  static async invalidatePitch(pitchId: number) {
    try {
      await cacheClient.del(`pitch:${pitchId}`);
    } catch (error) {
      console.warn("Cache error:", error.message);
    }
  }
  
  // User session caching
  static async cacheUserSession(userId: number, data: any, ttl = 86400) {
    try {
      await cacheClient.set(`session:user:${userId}`, JSON.stringify(data));
      await cacheClient.expire(`session:user:${userId}`, ttl);
    } catch (error) {
      console.warn("Cache error:", error.message);
    }
  }
  
  static async getUserSession(userId: number) {
    try {
      const cached = await cacheClient.get(`session:user:${userId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn("Cache error:", error.message);
      return null;
    }
  }
  
  static async invalidateUserSession(userId: number) {
    try {
      await cacheClient.del(`session:user:${userId}`);
    } catch (error) {
      console.warn("Cache error:", error.message);
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
    } catch (error) {
      console.warn("Cache error:", error.message);
      return true; // Default to counting views on error
    }
  }
  
  // Homepage caching
  static async cacheHomepageData(data: any, ttl = 300) {
    try {
      await cacheClient.set("homepage:data", JSON.stringify(data));
      await cacheClient.expire("homepage:data", ttl);
    } catch (error) {
      console.warn("Cache error:", error.message);
    }
  }
  
  static async getHomepageData() {
    try {
      const cached = await cacheClient.get("homepage:data");
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn("Cache error:", error.message);
      return null;
    }
  }
  
  static async invalidateHomepage() {
    try {
      await cacheClient.del("homepage:data");
    } catch (error) {
      console.warn("Cache error:", error.message);
    }
  }
  
  // Search results caching
  static async cacheSearchResults(query: string, results: any, ttl = 600) {
    try {
      const key = `search:${btoa(query)}`;
      await cacheClient.set(key, JSON.stringify(results));
      await cacheClient.expire(key, ttl);
    } catch (error) {
      console.warn("Cache error:", error.message);
    }
  }
  
  static async getCachedSearchResults(query: string) {
    try {
      const key = `search:${btoa(query)}`;
      const cached = await cacheClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn("Cache error:", error.message);
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
    } catch (error) {
      console.warn("Cache error:", error.message);
    }
  }
  
  static async getDailyMetric(metric: string, date?: string) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const key = `metrics:${metric}:${targetDate}`;
      const value = await cacheClient.get(key);
      return value ? parseInt(value) : 0;
    } catch (error) {
      console.warn("Cache error:", error.message);
      return 0;
    }
  }
  
  // Public pitches cache
  static async cachePublicPitches(data: any, ttl = 300) {
    try {
      await cacheClient.set("pitches:public", JSON.stringify(data));
      await cacheClient.expire("pitches:public", ttl);
    } catch (error) {
      console.warn("Cache error:", error.message);
    }
  }
  
  static async getPublicPitches() {
    try {
      const cached = await cacheClient.get("pitches:public");
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn("Cache error:", error.message);
      return null;
    }
  }
  
  static async invalidatePublicPitches() {
    try {
      await cacheClient.del("pitches:public");
      await cacheClient.del("pitches:trending");
      await cacheClient.del("pitches:new");
    } catch (error) {
      console.warn("Cache error:", error.message);
    }
  }

  // Marketplace cache
  static async invalidateMarketplace() {
    try {
      await this.invalidatePublicPitches();
      await this.invalidateHomepage();
    } catch (error) {
      console.warn("Cache error:", error.message);
    }
  }
  
  // Health check for cache status
  static async healthCheck() {
    return {
      type: cacheType,
      distributed: cacheType !== "in-memory",
      status: "healthy"
    };
  }
}