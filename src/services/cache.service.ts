import { connect } from "npm:redis";

// Redis connection - optional for development
let redis: any = null;
let redisConnected = false;

// Initialize Redis connection with error handling
async function initRedis() {
  try {
    const redisUrl = Deno.env.get("REDIS_URL");
    if (redisUrl) {
      // Production: Use REDIS_URL environment variable
      redis = await connect(redisUrl);
    } else {
      // Development: Try localhost
      redis = await connect({
        hostname: "localhost",
        port: 6379,
      });
    }
    redisConnected = true;
    console.log("✅ Redis connected successfully");
  } catch (error) {
    console.warn("⚠️ Redis connection failed, operating without cache:", error.message);
    redisConnected = false;
    redis = null;
  }
}

// Initialize Redis on module load
initRedis();

export class CacheService {
  // Check if Redis is available
  static isRedisAvailable(): boolean {
    return redisConnected && redis !== null;
  }

  // Pitch caching
  static async cachePitch(pitchId: number, data: any, ttl = 3600) {
    if (!this.isRedisAvailable()) {
      console.log(`Cache unavailable - skipping cache for pitch:${pitchId}`);
      return;
    }
    try {
      await redis.set(`pitch:${pitchId}`, JSON.stringify(data));
      await redis.expire(`pitch:${pitchId}`, ttl);
    } catch (error) {
      console.warn("Redis cache error:", error.message);
    }
  }
  
  static async getCachedPitch(pitchId: number) {
    if (!this.isRedisAvailable()) {
      return null;
    }
    try {
      const cached = await redis.get(`pitch:${pitchId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn("Redis cache error:", error.message);
      return null;
    }
  }
  
  static async invalidatePitch(pitchId: number) {
    if (!this.isRedisAvailable()) {
      return;
    }
    try {
      await redis.del(`pitch:${pitchId}`);
    } catch (error) {
      console.warn("Redis cache error:", error.message);
    }
  }
  
  // User session caching
  static async cacheUserSession(userId: number, data: any, ttl = 86400) {
    if (!this.isRedisAvailable()) {
      console.log(`Cache unavailable - skipping session cache for user:${userId}`);
      return;
    }
    try {
      await redis.set(`session:user:${userId}`, JSON.stringify(data));
      await redis.expire(`session:user:${userId}`, ttl);
    } catch (error) {
      console.warn("Redis cache error:", error.message);
    }
  }
  
  static async getUserSession(userId: number) {
    if (!this.isRedisAvailable()) {
      return null;
    }
    try {
      const cached = await redis.get(`session:user:${userId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn("Redis cache error:", error.message);
      return null;
    }
  }
  
  // View counting with rate limiting
  static async incrementViewCount(pitchId: number, ipAddress: string) {
    if (!this.isRedisAvailable()) {
      // Without Redis, always count views (no rate limiting)
      console.log(`Cache unavailable - counting all views for pitch:${pitchId}`);
      return true;
    }
    try {
      const key = `view:${pitchId}:${ipAddress}`;
      const exists = await redis.get(key);
      
      if (!exists) {
        await redis.set(key, "1");
        await redis.expire(key, 3600); // 1 hour
        return true; // Count this view
      }
      
      return false; // Already viewed recently
    } catch (error) {
      console.warn("Redis cache error:", error.message);
      return true; // Default to counting views on error
    }
  }
  
  // Homepage caching
  static async cacheHomepageData(data: any, ttl = 300) {
    if (!this.isRedisAvailable()) {
      console.log("Cache unavailable - skipping homepage cache");
      return;
    }
    try {
      await redis.set("homepage:data", JSON.stringify(data));
      await redis.expire("homepage:data", ttl);
    } catch (error) {
      console.warn("Redis cache error:", error.message);
    }
  }
  
  static async getHomepageData() {
    if (!this.isRedisAvailable()) {
      return null;
    }
    try {
      const cached = await redis.get("homepage:data");
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn("Redis cache error:", error.message);
      return null;
    }
  }
  
  // Search results caching
  static async cacheSearchResults(query: string, results: any, ttl = 600) {
    if (!this.isRedisAvailable()) {
      console.log(`Cache unavailable - skipping search cache for: ${query}`);
      return;
    }
    try {
      const key = `search:${Buffer.from(query).toString('base64')}`;
      await redis.set(key, JSON.stringify(results));
      await redis.expire(key, ttl);
    } catch (error) {
      console.warn("Redis cache error:", error.message);
    }
  }
  
  static async getCachedSearchResults(query: string) {
    if (!this.isRedisAvailable()) {
      return null;
    }
    try {
      const key = `search:${Buffer.from(query).toString('base64')}`;
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn("Redis cache error:", error.message);
      return null;
    }
  }
  
  // Analytics aggregation
  static async trackDailyMetric(metric: string, value = 1) {
    if (!this.isRedisAvailable()) {
      console.log(`Cache unavailable - skipping metric tracking: ${metric}`);
      return;
    }
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `metrics:${metric}:${today}`;
      await redis.incrby(key, value);
      await redis.expire(key, 86400 * 7); // Keep for 7 days
    } catch (error) {
      console.warn("Redis cache error:", error.message);
    }
  }
  
  static async getDailyMetric(metric: string, date?: string) {
    if (!this.isRedisAvailable()) {
      return 0;
    }
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const key = `metrics:${metric}:${targetDate}`;
      const value = await redis.get(key);
      return value ? parseInt(value) : 0;
    } catch (error) {
      console.warn("Redis cache error:", error.message);
      return 0;
    }
  }
}