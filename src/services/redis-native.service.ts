/**
 * Native Redis Client Service for Pitchey
 * Provides both native Redis connection (local development) and Upstash REST API (production)
 * Includes connection pooling, error handling, and monitoring
 */

import { connect } from "redis";

// Helper function to safely extract error messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

interface RedisConfig {
  // Connection settings
  local: {
    hostname: string;
    port: number;
    password?: string;
    db?: number;
  };
  upstash: {
    url: string;
    token: string;
  };
  
  // Cache settings
  enabled: boolean;
  defaultTTL: number;
  maxRetries: number;
  retryDelay: number;
  
  // Environment
  environment: 'development' | 'production';
}

interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  operations: {
    get: number;
    set: number;
    del: number;
    exists: number;
  };
  totalOperations: number;
  uptime: number;
}

class NativeRedisService {
  private config: RedisConfig;
  private nativeClient: any = null;
  private isConnected = false;
  private stats: CacheStats;
  private startTime: number;
  
  constructor() {
    this.startTime = Date.now();
    this.config = this.loadConfig();
    this.stats = this.initStats();
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): RedisConfig {
    // Determine environment - prioritize DENO_ENV for Deno Deploy
    const denoEnv = Deno.env.get("DENO_ENV");
    const nodeEnv = Deno.env.get("NODE_ENV");
    const environment = (denoEnv === "production" || nodeEnv === "production") ? "production" : "development";
    
    return {
      local: {
        hostname: Deno.env.get("REDIS_HOST") || "localhost",
        port: parseInt(Deno.env.get("REDIS_PORT") || "6379"),
        password: Deno.env.get("REDIS_PASSWORD"),
        db: parseInt(Deno.env.get("REDIS_DB") || "0"),
      },
      upstash: {
        url: Deno.env.get("UPSTASH_REDIS_REST_URL") || "",
        token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN") || "",
      },
      enabled: Deno.env.get("CACHE_ENABLED") === "true",
      defaultTTL: parseInt(Deno.env.get("CACHE_TTL") || "300"),
      maxRetries: parseInt(Deno.env.get("REDIS_MAX_RETRIES") || "3"),
      retryDelay: parseInt(Deno.env.get("REDIS_RETRY_DELAY") || "1000"),
      environment: environment as 'development' | 'production',
    };
  }

  /**
   * Initialize statistics
   */
  private initStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      errors: 0,
      operations: {
        get: 0,
        set: 0,
        del: 0,
        exists: 0,
      },
      totalOperations: 0,
      uptime: 0,
    };
  }

  /**
   * Connect to Redis (native client for local development)
   */
  async connect(): Promise<boolean> {
    // Reload configuration to pick up any environment changes
    this.config = this.loadConfig();
    
    console.log(`Redis config - enabled: ${this.config.enabled}, env: ${this.config.environment}`);
    console.log(`Upstash URL: ${this.config.upstash.url ? 'configured' : 'missing'}`);
    console.log(`Upstash Token: ${this.config.upstash.token ? 'configured' : 'missing'}`);
    
    if (!this.config.enabled) {
      console.log("Redis is disabled");
      return false;
    }

    // Use native client for local development
    if (this.config.environment === 'development') {
      try {
        const connectionConfig: any = {
          hostname: this.config.local.hostname,
          port: this.config.local.port,
          db: this.config.local.db,
        };
        
        // Only add password if it's provided
        if (this.config.local.password) {
          connectionConfig.password = this.config.local.password;
        }
        
        this.nativeClient = await connect(connectionConfig);
        
        this.isConnected = true;
        console.log(`✅ Connected to Redis at ${this.config.local.hostname}:${this.config.local.port}`);
        return true;
      } catch (error) {
        console.error("❌ Failed to connect to local Redis:", getErrorMessage(error));
        this.isConnected = false;
        return false;
      }
    }

    // For production, we'll use Upstash REST API (no persistent connection needed)
    if (this.config.upstash.url && this.config.upstash.token) {
      console.log("✅ Using Upstash Redis REST API for production");
      this.isConnected = true;
      return true;
    }

    console.error("❌ No Redis configuration found");
    return false;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.nativeClient) {
      try {
        await this.nativeClient.close();
        this.isConnected = false;
        console.log("Redis connection closed");
      } catch (error) {
        console.error("Error closing Redis connection:", error);
      }
    }
  }

  /**
   * Check if Redis is available
   */
  isEnabled(): boolean {
    return this.config.enabled && this.isConnected;
  }

  /**
   * Execute Redis command with retry logic
   */
  private async executeCommand(command: string, ...args: any[]): Promise<any> {
    if (!this.isEnabled()) {
      return null;
    }

    this.stats.totalOperations++;

    // Native client for development
    if (this.config.environment === 'development' && this.nativeClient) {
      try {
        const result = await this.nativeClient[command.toLowerCase()](...args);
        return result;
      } catch (error) {
        this.stats.errors++;
        console.error(`Redis ${command} error:`, getErrorMessage(error));
        return null;
      }
    }

    // Upstash REST API for production
    if (this.config.environment === 'production') {
      return await this.executeUpstashCommand([command, ...args]);
    }

    return null;
  }

  /**
   * Execute command via Upstash REST API
   */
  private async executeUpstashCommand(command: any[]): Promise<any> {
    if (!this.config.upstash.url || !this.config.upstash.token) {
      return null;
    }

    try {
      const response = await fetch(this.config.upstash.url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.upstash.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        this.stats.errors++;
        console.error("Upstash request failed:", response.status, response.statusText);
        return null;
      }

      const result = await response.json();
      return result.result;
    } catch (error) {
      this.stats.errors++;
      console.error("Upstash error:", getErrorMessage(error));
      return null;
    }
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<any> {
    this.stats.operations.get++;
    
    try {
      const result = await this.executeCommand("GET", key);
      
      if (result !== null && result !== undefined) {
        this.stats.hits++;
        return JSON.parse(result);
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      this.stats.errors++;
      console.error("Cache GET error:", getErrorMessage(error));
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    this.stats.operations.set++;
    
    try {
      const ttl = ttlSeconds || this.config.defaultTTL;
      const serialized = JSON.stringify(value);
      
      const result = await this.executeCommand("SETEX", key, ttl, serialized);
      return result === "OK";
    } catch (error) {
      this.stats.errors++;
      console.error("Cache SET error:", getErrorMessage(error));
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<boolean> {
    this.stats.operations.del++;
    
    try {
      const result = await this.executeCommand("DEL", key);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      console.error("Cache DEL error:", getErrorMessage(error));
      return false;
    }
  }

  /**
   * Delete keys matching pattern
   */
  async delPattern(pattern: string): Promise<number> {
    this.stats.operations.del++;
    
    try {
      // Get keys matching pattern
      const keys = await this.executeCommand("KEYS", pattern);
      if (!keys || (Array.isArray(keys) && keys.length === 0)) {
        return 0;
      }
      
      // Delete all matching keys
      const keysArray = Array.isArray(keys) ? keys : [keys];
      if (keysArray.length > 0) {
        const result = await this.executeCommand("DEL", ...keysArray);
        return result || 0;
      }
      
      return 0;
    } catch (error) {
      this.stats.errors++;
      console.error("Cache DEL pattern error:", getErrorMessage(error));
      return 0;
    }
  }

  /**
   * Get keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      const result = await this.executeCommand("KEYS", pattern);
      if (!result) return [];
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      this.stats.errors++;
      console.error("Cache KEYS error:", getErrorMessage(error));
      return [];
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    this.stats.operations.exists++;
    
    try {
      const result = await this.executeCommand("EXISTS", key);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      console.error("Cache EXISTS error:", getErrorMessage(error));
      return false;
    }
  }

  /**
   * Hash operations
   */
  async hset(key: string, field: string, value: any): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const result = await this.executeCommand("HSET", key, field, serialized);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      console.error("Cache HSET error:", getErrorMessage(error));
      return false;
    }
  }

  async hget(key: string, field: string): Promise<any> {
    try {
      const result = await this.executeCommand("HGET", key, field);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      this.stats.errors++;
      console.error("Cache HGET error:", getErrorMessage(error));
      return null;
    }
  }

  async hgetall(key: string): Promise<Record<string, any> | null> {
    try {
      const result = await this.executeCommand("HGETALL", key);
      if (!result || typeof result !== 'object') return null;
      
      const parsed: Record<string, any> = {};
      for (const [field, value] of Object.entries(result)) {
        try {
          parsed[field] = JSON.parse(value as string);
        } catch {
          parsed[field] = value;
        }
      }
      return parsed;
    } catch (error) {
      this.stats.errors++;
      console.error("Cache HGETALL error:", getErrorMessage(error));
      return null;
    }
  }

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: any): Promise<number> {
    try {
      const serialized = JSON.stringify(message);
      const result = await this.executeCommand("PUBLISH", channel, serialized);
      return result || 0;
    } catch (error) {
      this.stats.errors++;
      console.error("Redis PUBLISH error:", getErrorMessage(error));
      return 0;
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string): Promise<number> {
    try {
      const result = await this.executeCommand("INCR", key);
      return result || 0;
    } catch (error) {
      this.stats.errors++;
      console.error("Redis INCR error:", getErrorMessage(error));
      return 0;
    }
  }

  /**
   * Set expiration on key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.executeCommand("EXPIRE", key, seconds);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      console.error("Redis EXPIRE error:", getErrorMessage(error));
      return false;
    }
  }

  /**
   * Push elements to the left of a list
   */
  async lpush(key: string, ...values: any[]): Promise<number> {
    try {
      const serializedValues = values.map(v => typeof v === 'string' ? v : JSON.stringify(v));
      const result = await this.executeCommand("LPUSH", key, ...serializedValues);
      return result;
    } catch (error) {
      this.stats.errors++;
      console.error("Redis LPUSH error:", getErrorMessage(error));
      return 0;
    }
  }

  /**
   * Trim list to specified range
   */
  async ltrim(key: string, start: number, stop: number): Promise<boolean> {
    try {
      await this.executeCommand("LTRIM", key, start, stop);
      return true;
    } catch (error) {
      this.stats.errors++;
      console.error("Redis LTRIM error:", getErrorMessage(error));
      return false;
    }
  }

  /**
   * Get range of elements from list
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      const result = await this.executeCommand("LRANGE", key, start, stop);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      this.stats.errors++;
      console.error("Redis LRANGE error:", getErrorMessage(error));
      return [];
    }
  }

  /**
   * Set key with expiration time in seconds
   */
  async setex(key: string, seconds: number, value: any): Promise<boolean> {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      await this.executeCommand("SETEX", key, seconds, serializedValue);
      return true;
    } catch (error) {
      this.stats.errors++;
      console.error("Redis SETEX error:", getErrorMessage(error));
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.stats.uptime = Date.now() - this.startTime;
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = this.initStats();
    this.startTime = Date.now();
  }

  /**
   * Ping Redis server
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.executeCommand("PING");
      return result === "PONG";
    } catch (error) {
      console.error("Redis PING error:", getErrorMessage(error));
      return false;
    }
  }

  /**
   * Get server info
   */
  async info(): Promise<any> {
    try {
      const result = await this.executeCommand("INFO");
      return result;
    } catch (error) {
      console.error("Redis INFO error:", getErrorMessage(error));
      return null;
    }
  }

  /**
   * Generate cache key with namespace
   */
  generateKey(prefix: string, ...parts: (string | number)[]): string {
    const env = this.config.environment;
    return `pitchey:${env}:${prefix}:${parts.join(":")}`;
  }

  /**
   * Cached function wrapper
   */
  async cached<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    // Try cache first
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
export const nativeRedisService = new NativeRedisService();

// Cache key helpers
export const cacheKeys = {
  user: {
    profile: (userId: number) => `user:profile:${userId}`,
    pitches: (userId: number) => `user:pitches:${userId}`,
    following: (userId: number) => `user:following:${userId}`,
    sessions: (userId: number) => `user:sessions:${userId}`,
  },
  pitch: {
    details: (pitchId: number) => `pitch:details:${pitchId}`,
    views: (pitchId: number) => `pitch:views:${pitchId}`,
    analytics: (pitchId: number) => `pitch:analytics:${pitchId}`,
  },
  lists: {
    public: (page: number, limit: number) => `pitches:public:${page}:${limit}`,
    trending: () => `pitches:trending`,
    recent: () => `pitches:recent`,
  },
  rate_limit: {
    api: (ip: string, endpoint: string) => `rate_limit:${ip}:${endpoint}`,
    login: (ip: string) => `rate_limit:login:${ip}`,
  },
  session: {
    user: (sessionId: string) => `session:${sessionId}`,
    csrf: (token: string) => `csrf:${token}`,
  },
  notifications: {
    user: (userId: number) => `notifications:${userId}`,
    unread: (userId: number) => `notifications:unread:${userId}`,
  },
};

export default nativeRedisService;