/**
 * Redis Service for Upstash
 * Provides caching functionality using Upstash Redis REST API
 */

interface CacheConfig {
  enabled: boolean;
  defaultTTL: number; // seconds
  redisUrl: string;
  redisToken: string;
}

class RedisService {
  private config: CacheConfig;

  constructor() {
    this.config = {
      enabled: Deno.env.get("CACHE_ENABLED") === "true",
      defaultTTL: parseInt(Deno.env.get("CACHE_TTL") || "300"), // 5 minutes default
      redisUrl: Deno.env.get("UPSTASH_REDIS_REST_URL") || "",
      redisToken: Deno.env.get("UPSTASH_REDIS_REST_TOKEN") || "",
    };
  }

  /**
   * Check if caching is enabled and configured
   */
  isEnabled(): boolean {
    return this.config.enabled && !!this.config.redisUrl && !!this.config.redisToken;
  }

  /**
   * Make request to Upstash Redis REST API
   */
  private async makeRequest(command: string[]): Promise<any> {
    if (!this.isEnabled()) {
      throw new Error("Redis not configured");
    }

    try {
      const response = await fetch(`${this.config.redisUrl}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        console.error("Redis request failed:", response.status, response.statusText);
        return null;
      }

      const result = await response.json();
      return result.result;
    } catch (error) {
      console.error("Redis error:", error);
      return null;
    }
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<any> {
    if (!this.isEnabled()) return null;

    try {
      const result = await this.makeRequest(["GET", key]);
      if (result) {
        return JSON.parse(result);
      }
      return null;
    } catch (error) {
      console.error("Cache GET error:", error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.isEnabled()) return false;

    try {
      const ttl = ttlSeconds || this.config.defaultTTL;
      const serialized = JSON.stringify(value);
      
      const result = await this.makeRequest(["SETEX", key, ttl.toString(), serialized]);
      return result === "OK";
    } catch (error) {
      console.error("Cache SET error:", error);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<boolean> {
    if (!this.isEnabled()) return false;

    try {
      const result = await this.makeRequest(["DEL", key]);
      return result === 1;
    } catch (error) {
      console.error("Cache DEL error:", error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async delPattern(pattern: string): Promise<number> {
    if (!this.isEnabled()) return 0;

    try {
      // Get keys matching pattern
      const keys = await this.makeRequest(["KEYS", pattern]);
      if (!keys || keys.length === 0) return 0;

      // Delete all matching keys
      const result = await this.makeRequest(["DEL", ...keys]);
      return result || 0;
    } catch (error) {
      console.error("Cache DEL pattern error:", error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled()) return false;

    try {
      const result = await this.makeRequest(["EXISTS", key]);
      return result === 1;
    } catch (error) {
      console.error("Cache EXISTS error:", error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    if (!this.isEnabled()) return null;

    try {
      const info = await this.makeRequest(["INFO", "memory"]);
      return { redis_info: info };
    } catch (error) {
      console.error("Cache STATS error:", error);
      return null;
    }
  }

  /**
   * Generate cache key for API endpoint
   */
  generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `pitchey:${prefix}:${parts.join(":")}`;
  }

  /**
   * Cached wrapper function
   */
  async cached<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get(key);
    if (cached !== null) {
      console.log(`Cache HIT: ${key}`);
      return cached;
    }

    // Cache miss - fetch data
    console.log(`Cache MISS: ${key}`);
    const data = await fetchFunction();
    
    // Store in cache
    await this.set(key, data, ttlSeconds);
    
    return data;
  }
}

// Export singleton instance
export const redisService = new RedisService();

// Helper functions for common cache patterns
export const cacheHelpers = {
  // Cache public pitches
  pitches: {
    public: (page: number = 1, limit: number = 20) => 
      redisService.generateKey("pitches", "public", page, limit),
    trending: () => 
      redisService.generateKey("pitches", "trending"),
    byUser: (userId: number) => 
      redisService.generateKey("pitches", "user", userId),
    byId: (pitchId: number) => 
      redisService.generateKey("pitch", pitchId),
  },

  // Cache user data
  users: {
    profile: (userId: number) => 
      redisService.generateKey("user", "profile", userId),
    pitches: (userId: number) => 
      redisService.generateKey("user", "pitches", userId),
    following: (userId: number) => 
      redisService.generateKey("user", "following", userId),
  },

  // Cache analytics
  analytics: {
    dashboard: (userId: number) => 
      redisService.generateKey("analytics", "dashboard", userId),
    pitchViews: (pitchId: number) => 
      redisService.generateKey("analytics", "pitch", pitchId),
  },

  // Invalidation patterns
  invalidate: {
    userPitches: async (userId: number) => {
      await redisService.delPattern(`pitchey:pitches:user:${userId}:*`);
      await redisService.delPattern(`pitchey:user:pitches:${userId}:*`);
    },
    allPitches: async () => {
      await redisService.delPattern("pitchey:pitches:*");
    },
    userProfile: async (userId: number) => {
      await redisService.delPattern(`pitchey:user:profile:${userId}:*`);
    },
  },
};

export default redisService;