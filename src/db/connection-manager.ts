/**
 * Database Connection Manager for Cloudflare Workers Edge Environment
 * 
 * Provides robust connection handling with:
 * - Singleton connection pooling for Neon PostgreSQL
 * - Retry logic for transient failures
 * - Connection health checks
 * - Timeout management
 * - Error resilience with the existing error serializer
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import { logError, getErrorMessage } from '../utils/error-serializer.ts';
import * as schema from './schema.ts';

export interface DatabaseConfig {
  connectionString: string;
  maxRetries?: number;
  retryDelayMs?: number;
  connectionTimeoutMs?: number;
  queryTimeoutMs?: number;
  healthCheckIntervalMs?: number;
}

export interface ConnectionHealth {
  isHealthy: boolean;
  lastHealthCheck: Date;
  connectionCount: number;
  errors: string[];
}

/**
 * Singleton Database Connection Manager
 * Manages Neon PostgreSQL connections in Cloudflare Workers edge environment
 */
class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private connections: Map<string, any> = new Map();
  private drizzleInstances: Map<string, any> = new Map();
  private healthStatus: Map<string, ConnectionHealth> = new Map();
  private isInitialized = false;

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

    this.isInitialized = true;
    console.log('Database Connection Manager initialized');
  }

  /**
   * Get or create a Neon SQL connection with connection pooling
   */
  private getNeonConnection(config: DatabaseConfig): any {
    const connectionKey = this.getConnectionKey(config.connectionString);
    
    if (this.connections.has(connectionKey)) {
      return this.connections.get(connectionKey);
    }

    try {
      // Create new Neon connection with optimized settings for edge environment
      const sql = neon(config.connectionString, {
        // Enable connection pooling at the edge
        pooled: true,
        // Set query timeout to prevent hanging connections
        queryTimeout: config.queryTimeoutMs || 30000,
        // Enable connection multiplexing for better performance
        multiplex: true,
      });

      this.connections.set(connectionKey, sql);
      this.initializeHealthStatus(connectionKey);
      
      console.log(`Created new Neon connection: ${connectionKey}`);
      return sql;
    } catch (error) {
      logError(error, 'Failed to create Neon connection', { connectionKey });
      throw new Error(`Database connection failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get or create a Drizzle ORM instance with the connection
   */
  public getDrizzleInstance(config: DatabaseConfig): any {
    const connectionKey = this.getConnectionKey(config.connectionString);
    
    if (this.drizzleInstances.has(connectionKey)) {
      return this.drizzleInstances.get(connectionKey);
    }

    try {
      const sql = this.getNeonConnection(config);
      const db = drizzle(sql, { schema });
      
      this.drizzleInstances.set(connectionKey, db);
      console.log(`Created new Drizzle instance: ${connectionKey}`);
      
      return db;
    } catch (error) {
      logError(error, 'Failed to create Drizzle instance', { connectionKey });
      throw new Error(`Database ORM initialization failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Execute a query with retry logic and timeout handling
   */
  public async executeWithRetry<T>(
    config: DatabaseConfig,
    operation: (db: any) => Promise<T>,
    operationName = 'database operation'
  ): Promise<T> {
    const maxRetries = config.maxRetries || 3;
    const retryDelay = config.retryDelayMs || 1000;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const db = this.getDrizzleInstance(config);
        const startTime = Date.now();
        
        // Execute the operation with a timeout
        const result = await Promise.race([
          operation(db),
          this.createTimeoutPromise(config.queryTimeoutMs || 30000)
        ]);

        const duration = Date.now() - startTime;
        
        // Log slow queries for optimization
        if (duration > 5000) {
          console.warn(`Slow query detected: ${operationName} took ${duration}ms`);
        }

        // Update health status on successful operation
        this.updateHealthStatus(this.getConnectionKey(config.connectionString), true);
        
        return result;
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
        async (db) => {
          // Simple health check query
          const result = await db.execute(sql`SELECT 1 as health_check`);
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
  } {
    const healthStatuses: Record<string, ConnectionHealth> = {};
    
    for (const [key, health] of this.healthStatus.entries()) {
      healthStatuses[key] = health;
    }

    return {
      totalConnections: this.connections.size,
      healthyConnections: Array.from(this.healthStatus.values())
        .filter(h => h.isHealthy).length,
      connectionKeys: Array.from(this.connections.keys()),
      healthStatuses,
    };
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
    });
  }

  private updateHealthStatus(connectionKey: string, isHealthy: boolean, error?: string): void {
    const current = this.healthStatus.get(connectionKey);
    if (!current) {
      this.initializeHealthStatus(connectionKey);
      return;
    }

    current.isHealthy = isHealthy;
    current.lastHealthCheck = new Date();
    current.connectionCount += 1;

    if (error) {
      current.errors.push(error);
      // Keep only last 10 errors
      if (current.errors.length > 10) {
        current.errors = current.errors.slice(-10);
      }
    } else if (isHealthy) {
      // Clear errors on successful operation
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
  return {
    connectionString: env.DATABASE_URL,
    maxRetries: parseInt(env.DB_MAX_RETRIES || '3'),
    retryDelayMs: parseInt(env.DB_RETRY_DELAY_MS || '1000'),
    connectionTimeoutMs: parseInt(env.DB_CONNECTION_TIMEOUT_MS || '10000'),
    queryTimeoutMs: parseInt(env.DB_QUERY_TIMEOUT_MS || '30000'),
    healthCheckIntervalMs: parseInt(env.DB_HEALTH_CHECK_INTERVAL_MS || '300000'), // 5 minutes
  };
}

/**
 * Get a configured Drizzle database instance
 */
export function getDatabaseInstance(env: any) {
  const config = createDatabaseConfig(env);
  dbConnectionManager.initialize(config);
  return dbConnectionManager.getDrizzleInstance(config);
}

/**
 * Execute database operation with automatic retry and error handling
 */
export async function withDatabase<T>(
  env: any,
  operation: (db: any) => Promise<T>,
  operationName?: string
): Promise<T> {
  const config = createDatabaseConfig(env);
  dbConnectionManager.initialize(config);
  return dbConnectionManager.executeWithRetry(config, operation, operationName);
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