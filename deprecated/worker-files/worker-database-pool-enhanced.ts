/**
 * Enhanced Database Connection Pool Manager for Cloudflare Workers
 * Implements singleton pattern with automatic fallback to direct connections
 */

import { neon } from '@neondatabase/serverless';
import { Toucan } from 'toucan-js';

export interface Env {
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
}

// Configuration for connection management
const CONFIG = {
  // Direct connection as fallback when Hyperdrive fails
  DIRECT_CONNECTION_STRING: 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require',
  
  // Connection pool settings
  MAX_POOL_SIZE: 5,
  CONNECTION_TIMEOUT_MS: 5000,
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY_MS: 100
};

// Global connection pool to prevent per-request connection creation
class EnhancedDatabaseConnectionPool {
  private static instance: EnhancedDatabaseConnectionPool;
  private connections: Map<string, any> = new Map();
  private connectionHealth: Map<string, boolean> = new Map();
  private sentry: Toucan | null = null;
  private initialized = false;
  
  // Track connection attempts for circuit breaker pattern
  private failureCount: Map<string, number> = new Map();
  private lastFailureTime: Map<string, number> = new Map();
  private readonly CIRCUIT_BREAKER_THRESHOLD = 3;
  private readonly CIRCUIT_BREAKER_TIMEOUT_MS = 60000; // 1 minute
  
  // Private constructor to enforce singleton
  private constructor() {}
  
  public static getInstance(): EnhancedDatabaseConnectionPool {
    if (!EnhancedDatabaseConnectionPool.instance) {
      EnhancedDatabaseConnectionPool.instance = new EnhancedDatabaseConnectionPool();
    }
    return EnhancedDatabaseConnectionPool.instance;
  }
  
  /**
   * Initialize the pool with environment variables
   */
  public initialize(env: Env, sentry?: Toucan): void {
    if (this.initialized) {
      return;
    }
    
    this.sentry = sentry || null;
    this.initialized = true;
    
    console.log('🔗 Enhanced database connection pool initialized');
    
    if (this.sentry) {
      this.sentry.addBreadcrumb({
        message: 'Enhanced database connection pool initialized',
        category: 'database',
        level: 'info',
        data: {
          hyperdrive_available: !!env.HYPERDRIVE,
          database_url_available: !!env.DATABASE_URL,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
  
  /**
   * Check if connection string is in circuit breaker state
   */
  private isCircuitBreakerOpen(connectionKey: string): boolean {
    const failures = this.failureCount.get(connectionKey) || 0;
    const lastFailure = this.lastFailureTime.get(connectionKey) || 0;
    const now = Date.now();
    
    // Reset circuit breaker after timeout
    if (now - lastFailure > this.CIRCUIT_BREAKER_TIMEOUT_MS) {
      this.failureCount.delete(connectionKey);
      this.lastFailureTime.delete(connectionKey);
      return false;
    }
    
    return failures >= this.CIRCUIT_BREAKER_THRESHOLD;
  }
  
  /**
   * Record connection failure for circuit breaker
   */
  private recordFailure(connectionKey: string): void {
    const currentFailures = this.failureCount.get(connectionKey) || 0;
    this.failureCount.set(connectionKey, currentFailures + 1);
    this.lastFailureTime.set(connectionKey, Date.now());
    
    console.warn(`⚠️ Connection failure recorded for ${connectionKey.slice(-20)} (${currentFailures + 1} failures)`);
  }
  
  /**
   * Get the best available connection string
   */
  private getConnectionString(env: Env): string {
    const options = [];
    
    // Option 1: Hyperdrive (if available and not in circuit breaker)
    if (env.HYPERDRIVE?.connectionString) {
      const hyperdriveKey = env.HYPERDRIVE.connectionString;
      if (!this.isCircuitBreakerOpen(hyperdriveKey)) {
        options.push({
          key: hyperdriveKey,
          type: 'hyperdrive',
          priority: 1
        });
      } else {
        console.log('🔴 Hyperdrive in circuit breaker state, skipping');
      }
    }
    
    // Option 2: Environment DATABASE_URL (if available)
    if (env.DATABASE_URL) {
      options.push({
        key: env.DATABASE_URL,
        type: 'env_database_url',
        priority: 2
      });
    }
    
    // Option 3: Direct connection fallback (always available)
    options.push({
      key: CONFIG.DIRECT_CONNECTION_STRING,
      type: 'direct_fallback',
      priority: 3
    });
    
    // Sort by priority and return the best option
    options.sort((a, b) => a.priority - b.priority);
    const selected = options[0];
    
    console.log(`🔌 Using ${selected.type} connection`);
    return selected.key;
  }
  
  /**
   * Get or create a database connection with automatic fallback
   */
  public async getConnection(env: Env): Promise<any> {
    if (!this.initialized) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    
    // Get the best available connection string
    const connectionKey = this.getConnectionString(env);
    
    // Return existing healthy connection if available
    if (this.connections.has(connectionKey) && this.connectionHealth.get(connectionKey) !== false) {
      const existingConnection = this.connections.get(connectionKey);
      console.log('♻️ Reusing existing database connection');
      return existingConnection;
    }
    
    // Try to create a new connection with retries
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        console.log(`🆕 Creating database connection (attempt ${attempt}/${CONFIG.RETRY_ATTEMPTS})`);
        
        // Create new connection using neon
        const sql = neon(connectionKey);
        
        // Test the connection with a timeout
        const testPromise = sql`SELECT 1 as test_connection`;
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), CONFIG.CONNECTION_TIMEOUT_MS)
        );
        
        await Promise.race([testPromise, timeoutPromise]);
        
        // Connection successful - wrap with execute() method
        const wrappedSql = Object.assign(sql, {
          execute: async (query: any, ...args: any[]) => {
            if (typeof query === 'object' && query.raw) {
              return await sql(query, ...args);
            }
            if (typeof query === 'string') {
              return await sql(query);
            }
            return await sql(query, ...args);
          }
        });
        
        // Store the connection and mark as healthy
        this.connections.set(connectionKey, wrappedSql);
        this.connectionHealth.set(connectionKey, true);
        
        // Clear failure count on success
        this.failureCount.delete(connectionKey);
        this.lastFailureTime.delete(connectionKey);
        
        console.log(`✅ Database connection created successfully (pool size: ${this.connections.size})`);
        
        if (this.sentry) {
          this.sentry.addBreadcrumb({
            message: 'Database connection created',
            category: 'database',
            level: 'info',
            data: {
              connection_type: connectionKey === CONFIG.DIRECT_CONNECTION_STRING ? 'direct' : 'hyperdrive',
              attempt,
              pool_size: this.connections.size
            }
          });
        }
        
        return wrappedSql;
        
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Connection attempt ${attempt} failed:`, error.message);
        
        // Mark connection as unhealthy
        this.connectionHealth.set(connectionKey, false);
        
        // Wait before retry
        if (attempt < CONFIG.RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY_MS * attempt));
        }
      }
    }
    
    // All attempts failed - record failure and try fallback
    this.recordFailure(connectionKey);
    
    // If we haven't already tried the direct fallback, try it now
    if (connectionKey !== CONFIG.DIRECT_CONNECTION_STRING) {
      console.log('🔄 All attempts failed, trying direct fallback connection');
      
      try {
        const fallbackSql = neon(CONFIG.DIRECT_CONNECTION_STRING);
        
        // Test the fallback connection
        await fallbackSql`SELECT 1 as test_fallback`;
        
        // Wrap with execute() method
        const wrappedFallback = Object.assign(fallbackSql, {
          execute: async (query: any, ...args: any[]) => {
            if (typeof query === 'object' && query.raw) {
              return await fallbackSql(query, ...args);
            }
            if (typeof query === 'string') {
              return await fallbackSql(query);
            }
            return await fallbackSql(query, ...args);
          }
        });
        
        // Store the fallback connection
        this.connections.set(CONFIG.DIRECT_CONNECTION_STRING, wrappedFallback);
        this.connectionHealth.set(CONFIG.DIRECT_CONNECTION_STRING, true);
        
        console.log('✅ Fallback connection successful');
        return wrappedFallback;
        
      } catch (fallbackError) {
        console.error('❌ Fallback connection also failed:', fallbackError);
        
        if (this.sentry) {
          this.sentry.captureException(fallbackError as Error, {
            tags: {
              component: 'database-pool',
              operation: 'fallback-connection'
            },
            extra: {
              primary_error: lastError?.message,
              fallback_error: (fallbackError as Error).message
            }
          });
        }
      }
    }
    
    // Complete failure - report and throw
    if (this.sentry) {
      this.sentry.captureException(lastError as Error, {
        tags: {
          component: 'database-pool',
          operation: 'create-connection'
        },
        extra: {
          connection_key: connectionKey.slice(-20),
          attempts: CONFIG.RETRY_ATTEMPTS,
          error_message: lastError?.message
        }
      });
    }
    
    throw new Error(`Failed to establish database connection after ${CONFIG.RETRY_ATTEMPTS} attempts: ${lastError?.message}`);
  }
  
  /**
   * Test connection health
   */
  public async testConnection(env: Env): Promise<boolean> {
    try {
      const sql = await this.getConnection(env);
      await sql`SELECT 1 as test`;
      console.log('✅ Database connection test passed');
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      return false;
    }
  }
  
  /**
   * Execute a query using the pooled connection
   */
  public async query(env: Env, query: string, params: any[] = []): Promise<any[]> {
    const sql = await this.getConnection(env);
    const startTime = Date.now();
    
    try {
      let result;
      if (params.length === 0) {
        result = await sql(query);
      } else {
        console.warn('⚠️ Parameterized queries not fully supported in neon, using direct execution');
        result = await sql(query);
      }
      
      const duration = Date.now() - startTime;
      console.log(`📊 Query executed in ${duration}ms`);
      
      return Array.isArray(result) ? result : [result];
      
    } catch (error) {
      console.error('❌ Database query failed:', error);
      throw error;
    }
  }
  
  /**
   * Get pool statistics
   */
  public getStats(): {
    initialized: boolean;
    poolSize: number;
    healthyConnections: number;
    failedConnections: number;
    circuitBreakerStatus: Record<string, boolean>;
  } {
    const circuitBreakerStatus: Record<string, boolean> = {};
    for (const [key, _] of this.failureCount) {
      circuitBreakerStatus[key.slice(-20)] = this.isCircuitBreakerOpen(key);
    }
    
    return {
      initialized: this.initialized,
      poolSize: this.connections.size,
      healthyConnections: Array.from(this.connectionHealth.values()).filter(h => h === true).length,
      failedConnections: Array.from(this.connectionHealth.values()).filter(h => h === false).length,
      circuitBreakerStatus
    };
  }
  
  /**
   * Reset the pool (for testing purposes)
   */
  public reset(): void {
    this.connections.clear();
    this.connectionHealth.clear();
    this.failureCount.clear();
    this.lastFailureTime.clear();
    this.initialized = false;
    this.sentry = null;
    console.log('🔄 Database pool reset');
  }
}

// Export singleton instance
export const dbPool = EnhancedDatabaseConnectionPool.getInstance();

/**
 * Helper function to safely execute database operations
 * with automatic error handling and connection management
 */
export async function withDatabase<T>(
  env: Env,
  operation: (sql: any) => Promise<T>,
  sentry?: Toucan
): Promise<T> {
  try {
    // Ensure pool is initialized
    if (sentry) {
      dbPool.initialize(env, sentry);
    } else {
      dbPool.initialize(env);
    }
    
    const sql = await dbPool.getConnection(env);
    return await operation(sql);
    
  } catch (error) {
    console.error('❌ Database operation failed:', error);
    
    if (sentry) {
      sentry.captureException(error as Error, {
        tags: {
          component: 'database-helper',
          operation: 'with-database'
        },
        extra: {
          hyperdrive_available: !!env.HYPERDRIVE,
          database_url_available: !!env.DATABASE_URL,
          error_message: error.message,
          pool_stats: dbPool.getStats()
        }
      });
    }
    
    throw error;
  }
}