/**
 * Database Connection Manager for Cloudflare Workers Edge Environment
 * 
 * Provides robust connection handling with:
 * - Singleton connection pooling for Neon PostgreSQL
 * - Retry logic for transient failures
 * - Connection health checks
 * - Timeout management
 * - Error resilience with the existing error serializer
 * - Raw SQL execution without ORM dependencies
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis/cloudflare';
import { logError, getErrorMessage } from '../utils/error-serializer.ts';

// Enhanced Neon configuration for 10k+ concurrent functions
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = 'password';
neonConfig.coalesceWrites = true;
neonConfig.poolQueryViaFetch = true;
neonConfig.localFileCache = true;
neonConfig.fetchConnectionCache = true;
neonConfig.cacheExpireTtl = 300;

export interface DatabaseConfig {
  connectionString: string;
  readReplicaUrls?: string[];
  maxRetries?: number;
  retryDelayMs?: number;
  connectionTimeoutMs?: number;
  queryTimeoutMs?: number;
  healthCheckIntervalMs?: number;
  poolSize?: number;
  maxConnectionAge?: number;
  circuitBreakerThreshold?: number;
  redis?: {
    url: string;
    token: string;
  };
}

export interface ConnectionHealth {
  isHealthy: boolean;
  lastHealthCheck: Date;
  connectionCount: number;
  errors: string[];
  avgResponseTime: number;
  totalQueries: number;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
}

interface PoolMetrics {
  activeConnections: number;
  totalConnections: number;
  avgResponseTime: number;
  errorRate: number;
  queriesPerSecond: number;
  lastMetricUpdate: number;
}

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  getState(): string {
    return this.state;
  }
}

/**
 * Singleton Database Connection Manager
 * Manages Neon PostgreSQL connections in Cloudflare Workers edge environment
 */
class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private connections: Map<string, any> = new Map();
  private readReplicas: Map<string, any[]> = new Map();
  private healthStatus: Map<string, ConnectionHealth> = new Map();
  private poolMetrics: Map<string, PoolMetrics> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private redis: Redis | null = null;
  private isInitialized = false;
  private healthCheckInterval: number | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager();
    }
    return DatabaseConnectionManager.instance;
  }

  /**
   * Initialize the connection manager with configuration
   */
  public initialize(config: DatabaseConfig): void {
    if (this.isInitialized) {
      return;
    }

    // Initialize Redis if available
    if (config.redis) {
      this.redis = new Redis({
        url: config.redis.url,
        token: config.redis.token,
      });
    }

    // Initialize circuit breakers
    const connectionKey = this.getConnectionKey(config.connectionString);
    this.circuitBreakers.set(connectionKey, new CircuitBreaker(config.circuitBreakerThreshold));
    
    // Initialize read replicas
    if (config.readReplicaUrls?.length) {
      const replicas = config.readReplicaUrls.map(url => {
        return neon(url, this.getNeonOptions(config));
      });
      this.readReplicas.set(connectionKey, replicas);
    }

    // Start health monitoring
    this.startHealthMonitoring(config);

    this.isInitialized = true;
    console.log('Enhanced Database Connection Manager initialized with pooling');
  }

  /**
   * Get or create a Neon SQL connection with connection pooling
   */
  private getNeonOptions(config: DatabaseConfig) {
    return {
      // Optimize for high-concurrency serverless
      fetchOptions: {
        cache: 'force-cache' as RequestCache,
        headers: {
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=30, max=1000'
        }
      },
      wsProxy: (host: string) => `wss://${host}/v1/ws`,
      poolerOptions: {
        maxUses: config.poolSize || 1000,
        maxSize: 20, // Higher for 10k+ concurrent functions
        idleTimeoutMillis: config.connectionTimeoutMs || 30000,
        allowExitOnIdle: true,
        connectionTimeoutMillis: config.connectionTimeoutMs || 10000
      }
    };
  }

  private getNeonConnection(config: DatabaseConfig): any {
    const connectionKey = this.getConnectionKey(config.connectionString);
    
    if (this.connections.has(connectionKey)) {
      return this.connections.get(connectionKey);
    }

    try {
      const sql = neon(config.connectionString, this.getNeonOptions(config));
      this.connections.set(connectionKey, sql);
      this.initializeHealthStatus(connectionKey);
      this.initializeMetrics(connectionKey);
      
      console.log(`Created new enhanced Neon connection: ${connectionKey}`);
      return sql;
    } catch (error) {
      logError(error, 'Failed to create Neon connection', { connectionKey });
      throw new Error(`Database connection failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get raw SQL connection for direct query execution
   */
  public getSQLConnection(config: DatabaseConfig): any {
    return this.getNeonConnection(config);
  }

  /**
   * Execute a query with retry logic and timeout handling
   */
  public async executeWithRetry<T>(
    config: DatabaseConfig,
    operation: (sql: any) => Promise<T>,
    operationName = 'database operation',
    preferRead = false
  ): Promise<T> {
    const maxRetries = config.maxRetries || 3;
    const retryDelay = config.retryDelayMs || 1000;
    let lastError: any;

    const connectionKey = this.getConnectionKey(config.connectionString);
    const circuitBreaker = this.circuitBreakers.get(connectionKey);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await (circuitBreaker?.execute(async () => {
          const sql = this.getOptimalConnection(config, preferRead);
          const startTime = Date.now();
          
          const result = await Promise.race([
            operation(sql),
            this.createTimeoutPromise(config.queryTimeoutMs || 30000)
          ]);

          const duration = Date.now() - startTime;
          
          // Update metrics
          this.updateMetrics(connectionKey, duration, true);
          
          // Log slow queries
          if (duration > 5000) {
            console.warn(`Slow query: ${operationName} took ${duration}ms`);
            // Store slow query metrics in Redis if available
            if (this.redis) {
              try {
                await this.redis.lpush('slow_queries', JSON.stringify({
                  operation: operationName,
                  duration,
                  timestamp: Date.now(),
                  connectionKey
                }));
                await this.redis.ltrim('slow_queries', 0, 999);
              } catch (redisError) {
                console.warn('Failed to log slow query to Redis:', redisError);
              }
            }
          }

          this.updateHealthStatus(connectionKey, true, undefined, duration);
          return result;
        }) || operation(this.getOptimalConnection(config, preferRead)));
      } catch (error) {
        lastError = error;
        const connectionKey = this.getConnectionKey(config.connectionString);
        
        // Log the error with context
        logError(error, `${operationName} failed (attempt ${attempt}/${maxRetries})`, {
          connectionKey,
          attempt,
          maxRetries,
        });

        // Update health status
        this.updateHealthStatus(connectionKey, false, getErrorMessage(error));

        // Check if this is a retryable error
        if (!this.isRetryableError(error) || attempt === maxRetries) {
          // Don't retry for certain types of errors
          break;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1);
          console.log(`Retrying ${operationName} in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    // If we get here, all retries have failed
    throw new Error(`${operationName} failed after ${maxRetries} attempts: ${getErrorMessage(lastError)}`);
  }

  /**
   * Perform a health check on a specific connection
   */
  public async healthCheck(config: DatabaseConfig): Promise<ConnectionHealth> {
    const connectionKey = this.getConnectionKey(config.connectionString);
    
    try {
      await this.executeWithRetry(
        config,
        async (sql) => {
          // Simple health check query
          const result = await sql`SELECT 1 as health_check`;
          return result;
        },
        'health check'
      );

      this.updateHealthStatus(connectionKey, true);
    } catch (error) {
      logError(error, 'Health check failed', { connectionKey });
      this.updateHealthStatus(connectionKey, false, getErrorMessage(error));
    }

    return this.healthStatus.get(connectionKey) || {
      isHealthy: false,
      lastHealthCheck: new Date(),
      connectionCount: 0,
      errors: ['Health status not found']
    };
  }

  /**
   * Get connection statistics and health information
   */
  public getConnectionStats(): {
    totalConnections: number;
    healthyConnections: number;
    connectionKeys: string[];
    healthStatuses: Record<string, ConnectionHealth>;
    poolMetrics: Record<string, PoolMetrics>;
    readReplicaCount: number;
  } {
    const healthStatuses: Record<string, ConnectionHealth> = {};
    const poolMetrics: Record<string, PoolMetrics> = {};
    
    for (const [key, health] of this.healthStatus.entries()) {
      healthStatuses[key] = health;
    }
    
    for (const [key, metrics] of this.poolMetrics.entries()) {
      poolMetrics[key] = metrics;
    }

    return {
      totalConnections: this.connections.size,
      healthyConnections: Array.from(this.healthStatus.values())
        .filter(h => h.isHealthy).length,
      connectionKeys: Array.from(this.connections.keys()),
      healthStatuses,
      poolMetrics,
      readReplicaCount: Array.from(this.readReplicas.values())
        .reduce((total, replicas) => total + replicas.length, 0)
    };
  }

  /**
   * Get metrics from Redis (cross-worker aggregation)
   */
  public async getAggregatedMetrics(timeRange: number = 3600000): Promise<{
    totalQueries: number;
    avgResponseTime: number;
    errorRate: number;
    slowQueryCount: number;
  }> {
    if (!this.redis) {
      throw new Error('Redis not available for aggregated metrics');
    }

    try {
      const [slowQueries] = await Promise.all([
        this.redis.lrange('slow_queries', 0, -1)
      ]);

      const recentSlowQueries = slowQueries
        .map(q => JSON.parse(q))
        .filter(q => Date.now() - q.timestamp < timeRange);

      // Get health metrics from all workers
      const healthKeys = await this.redis.keys('health:*');
      const healthData = await Promise.all(
        healthKeys.map(key => this.redis!.get(key))
      );

      const validHealthData = healthData
        .filter(data => data)
        .map(data => JSON.parse(data as string))
        .filter(data => Date.now() - data.lastCheck < timeRange);

      const totalQueries = validHealthData.reduce((sum, data) => sum + data.totalQueries, 0);
      const avgResponseTime = validHealthData.length > 0 
        ? validHealthData.reduce((sum, data) => sum + data.avgResponseTime, 0) / validHealthData.length
        : 0;
      const errorRate = validHealthData.length > 0
        ? validHealthData.reduce((sum, data) => sum + data.errorRate, 0) / validHealthData.length
        : 0;

      return {
        totalQueries,
        avgResponseTime,
        errorRate,
        slowQueryCount: recentSlowQueries.length
      };
    } catch (error) {
      console.error('Failed to get aggregated metrics:', error);
      throw error;
    }
  }

  /**
   * Clean up unhealthy connections (call during error recovery)
   */
  public cleanupUnhealthyConnections(): void {
    for (const [key, health] of this.healthStatus.entries()) {
      if (!health.isHealthy && health.errors.length > 5) {
        console.log(`Cleaning up unhealthy connection: ${key}`);
        this.connections.delete(key);
        this.drizzleInstances.delete(key);
        this.healthStatus.delete(key);
      }
    }
  }

  /**
   * Private helper methods
   */

  private getConnectionKey(connectionString: string): string {
    // Create a safe key from connection string (remove sensitive info)
    try {
      const url = new URL(connectionString);
      return `${url.protocol}//${url.hostname}:${url.port}${url.pathname}`;
    } catch {
      // Fallback to hash if URL parsing fails
      return `conn_${btoa(connectionString).slice(0, 16)}`;
    }
  }

  private initializeHealthStatus(connectionKey: string): void {
    this.healthStatus.set(connectionKey, {
      isHealthy: true,
      lastHealthCheck: new Date(),
      connectionCount: 0,
      errors: [],
      avgResponseTime: 0,
      totalQueries: 0,
      circuitBreakerState: 'closed'
    });
  }

  private initializeMetrics(connectionKey: string): void {
    this.poolMetrics.set(connectionKey, {
      activeConnections: 0,
      totalConnections: 0,
      avgResponseTime: 0,
      errorRate: 0,
      queriesPerSecond: 0,
      lastMetricUpdate: Date.now()
    });
  }

  private getOptimalConnection(config: DatabaseConfig, preferRead: boolean): any {
    const connectionKey = this.getConnectionKey(config.connectionString);
    
    // Use read replica if available and preferred
    if (preferRead) {
      const replicas = this.readReplicas.get(connectionKey);
      if (replicas && replicas.length > 0) {
        // Simple load balancing - round robin
        const replicaIndex = Math.floor(Math.random() * replicas.length);
        return replicas[replicaIndex];
      }
    }
    
    // Use primary connection
    return this.getSQLConnection(config);
  }

  private updateMetrics(connectionKey: string, duration: number, success: boolean): void {
    const metrics = this.poolMetrics.get(connectionKey);
    if (!metrics) return;

    metrics.totalConnections++;
    metrics.avgResponseTime = (metrics.avgResponseTime * (metrics.totalConnections - 1) + duration) / metrics.totalConnections;
    
    if (!success) {
      metrics.errorRate = ((metrics.errorRate * (metrics.totalConnections - 1)) + 1) / metrics.totalConnections;
    }

    // Calculate QPS (queries per second)
    const now = Date.now();
    const timeDiff = now - metrics.lastMetricUpdate;
    if (timeDiff > 1000) { // Update QPS every second
      metrics.queriesPerSecond = 1000 / (timeDiff / metrics.totalConnections);
      metrics.lastMetricUpdate = now;
    }
  }

  private startHealthMonitoring(config: DatabaseConfig): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck(config);
    }, config.healthCheckIntervalMs || 30000) as unknown as number;
  }

  private async performHealthCheck(config: DatabaseConfig): Promise<void> {
    const connectionKey = this.getConnectionKey(config.connectionString);
    
    try {
      const startTime = Date.now();
      await this.executeWithRetry(
        config,
        async (sql) => sql`SELECT 1 as health_check`,
        'health_check'
      );
      
      const duration = Date.now() - startTime;
      this.updateHealthStatus(connectionKey, true, undefined, duration);
      
      // Store health metrics in Redis
      if (this.redis) {
        const metrics = this.poolMetrics.get(connectionKey);
        const health = this.healthStatus.get(connectionKey);
        
        if (metrics && health) {
          try {
            await this.redis.setex(`health:${connectionKey}`, 60, JSON.stringify({
              healthy: health.isHealthy,
              avgResponseTime: health.avgResponseTime,
              totalQueries: health.totalQueries,
              errorRate: metrics.errorRate,
              queriesPerSecond: metrics.queriesPerSecond,
              circuitBreakerState: this.circuitBreakers.get(connectionKey)?.getState(),
              lastCheck: Date.now()
            }));
          } catch (redisError) {
            console.warn('Failed to store health metrics in Redis:', redisError);
          }
        }
      }
    } catch (error) {
      this.updateHealthStatus(connectionKey, false, getErrorMessage(error));
      logError(error, 'Health check failed', { connectionKey });
    }
  }

  private updateHealthStatus(
    connectionKey: string, 
    isHealthy: boolean, 
    error?: string, 
    responseTime?: number
  ): void {
    const current = this.healthStatus.get(connectionKey);
    if (!current) {
      this.initializeHealthStatus(connectionKey);
      return;
    }

    current.isHealthy = isHealthy;
    current.lastHealthCheck = new Date();
    current.connectionCount += 1;
    current.totalQueries += 1;
    
    if (responseTime) {
      current.avgResponseTime = 
        (current.avgResponseTime * (current.totalQueries - 1) + responseTime) / current.totalQueries;
    }

    const circuitBreaker = this.circuitBreakers.get(connectionKey);
    if (circuitBreaker) {
      current.circuitBreakerState = circuitBreaker.getState() as 'closed' | 'open' | 'half-open';
    }

    if (error) {
      current.errors.push(error);
      if (current.errors.length > 10) {
        current.errors = current.errors.slice(-10);
      }
    } else if (isHealthy) {
      current.errors = [];
    }
  }

  private isRetryableError(error: any): boolean {
    const errorMessage = getErrorMessage(error).toLowerCase();
    const errorCode = error?.code;

    // Don't retry on certain error types
    const nonRetryablePatterns = [
      'syntax error',
      'permission denied',
      'authentication failed',
      'invalid credentials',
      'relation does not exist',
      'column does not exist',
      'constraint violation',
    ];

    const nonRetryableCodes = [
      '28000', // Invalid authorization
      '28P01', // Invalid password
      '42000', // Syntax error
      '42P01', // Undefined table
      '42703', // Undefined column
      '23505', // Unique violation
    ];

    // Check for non-retryable patterns
    if (nonRetryablePatterns.some(pattern => errorMessage.includes(pattern))) {
      return false;
    }

    // Check for non-retryable codes
    if (nonRetryableCodes.includes(errorCode)) {
      return false;
    }

    // Retry on connection timeouts, network errors, etc.
    return true;
  }

  private async createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Convenience functions for common operations
 */

// Singleton instance
export const dbConnectionManager = DatabaseConnectionManager.getInstance();

/**
 * Create a database configuration from environment
 */
export function createDatabaseConfig(env: any): DatabaseConfig {
    // Prioritize Hyperdrive for edge connection pooling
  const config: DatabaseConfig = {
    connectionString: env.HYPERDRIVE?.connectionString || env.DATABASE_URL,
    maxRetries: parseInt(env.DB_MAX_RETRIES || '3'),
    retryDelayMs: parseInt(env.DB_RETRY_DELAY_MS || '1000'),
    connectionTimeoutMs: parseInt(env.DB_CONNECTION_TIMEOUT_MS || '10000'),
    queryTimeoutMs: parseInt(env.DB_QUERY_TIMEOUT_MS || '30000'),
    healthCheckIntervalMs: parseInt(env.DB_HEALTH_CHECK_INTERVAL_MS || '30000'),
    poolSize: parseInt(env.DB_POOL_SIZE || '1000'),
    maxConnectionAge: parseInt(env.DB_MAX_CONNECTION_AGE || '3600000'), // 1 hour
    circuitBreakerThreshold: parseInt(env.DB_CIRCUIT_BREAKER_THRESHOLD || '5')
  };

  // Add read replica URLs if available
  if (env.DATABASE_READ_REPLICA_URLS) {
    const replicaUrls = env.DATABASE_READ_REPLICA_URLS.split(',').map((url: string) => url.trim());
    config.readReplicaUrls = replicaUrls;
  }

  // Add Redis configuration if available
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    config.redis = {
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN
    };
  }

  return config;
}

/**
 * Get a configured raw SQL database connection
 */
export function getDatabaseInstance(env: any) {
  const config = createDatabaseConfig(env);
  dbConnectionManager.initialize(config);
  return dbConnectionManager.getSQLConnection(config);
}

/**
 * Execute database operation with automatic retry and error handling
 */
export async function withDatabase<T>(
  env: any,
  operation: (sql: any) => Promise<T>,
  operationName?: string,
  preferRead?: boolean
): Promise<T> {
  const config = createDatabaseConfig(env);
  dbConnectionManager.initialize(config);
  return dbConnectionManager.executeWithRetry(config, operation, operationName, preferRead);
}

/**
 * Execute read operation with read replica preference
 */
export async function withReadDatabase<T>(
  env: any,
  operation: (sql: any) => Promise<T>,
  operationName?: string
): Promise<T> {
  return withDatabase(env, operation, operationName, true);
}

/**
 * Get aggregated database metrics across all workers
 */
export async function getAggregatedDatabaseMetrics(env: any, timeRange?: number) {
  const config = createDatabaseConfig(env);
  dbConnectionManager.initialize(config);
  return dbConnectionManager.getAggregatedMetrics(timeRange);
}

/**
 * Perform database health check
 */
export async function checkDatabaseHealth(env: any): Promise<ConnectionHealth> {
  const config = createDatabaseConfig(env);
  return dbConnectionManager.healthCheck(config);
}

/**
 * Get database connection statistics
 */
export function getDatabaseStats() {
  return dbConnectionManager.getConnectionStats();
}