/**
 * Shared Database Pool for Service Bindings Architecture
 * Optimized for edge performance with singleton pattern
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

// Global connection pool to prevent per-request connection creation
class DatabaseConnectionPool {
  private static instance: DatabaseConnectionPool;
  private connections: Map<string, any> = new Map();
  private sentry: Toucan | null = null;
  private initialized = false;
  
  // Private constructor to enforce singleton
  private constructor() {}
  
  public static getInstance(): DatabaseConnectionPool {
    if (!DatabaseConnectionPool.instance) {
      DatabaseConnectionPool.instance = new DatabaseConnectionPool();
    }
    return DatabaseConnectionPool.instance;
  }
  
  /**
   * Initialize the pool with environment variables
   * This should only be called once per Worker lifecycle
   */
  public initialize(env: Env, sentry?: Toucan): void {
    if (this.initialized) {
      return;
    }
    
    this.sentry = sentry || null;
    this.initialized = true;
    
    // Log successful initialization
    console.log('🔗 Database connection pool initialized for service');
    
    if (this.sentry) {
      this.sentry.addBreadcrumb({
        message: 'Database connection pool initialized',
        category: 'database',
        level: 'info',
        data: {
          hyperdrive_available: !!env.HYPERDRIVE,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
  
  /**
   * Get or create a database connection for the given environment
   * Returns the same connection instance for subsequent calls (singleton per environment)
   */
  public getConnection(env: Env): any {
    if (!this.initialized) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    
    if (!env.HYPERDRIVE) {
      throw new Error('HYPERDRIVE binding not available');
    }
    
    // Use connection string as key for connection caching
    const connectionKey = env.HYPERDRIVE.connectionString;
    
    // Return existing connection if available
    if (this.connections.has(connectionKey)) {
      const existingConnection = this.connections.get(connectionKey);
      console.log('♻️ Reusing existing database connection');
      return existingConnection;
    }
    
    try {
      // Create new connection using neon for Cloudflare Workers compatibility
      console.log('🆕 Creating new database connection with neon');
      const sql = neon(env.HYPERDRIVE.connectionString);
      
      // Store the connection in the pool
      this.connections.set(connectionKey, sql);
      
      // Log successful connection creation
      if (this.sentry) {
        this.sentry.addBreadcrumb({
          message: 'New database connection created with neon',
          category: 'database',
          level: 'info',
          data: {
            connection_key: connectionKey.slice(-20), // Only last 20 chars for security
            pool_size: this.connections.size,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      console.log(`✅ Neon database connection created successfully (pool size: ${this.connections.size})`);
      return sql;
      
    } catch (error) {
      console.error('❌ Failed to create database connection:', error);
      
      if (this.sentry) {
        this.sentry.captureException(error as Error, {
          tags: {
            component: 'database-pool',
            operation: 'create-connection'
          },
          extra: {
            connection_key: connectionKey.slice(-20),
            pool_size: this.connections.size,
            hyperdrive_available: !!env.HYPERDRIVE
          }
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Test connection health
   * Returns true if connection is working, false otherwise
   */
  public async testConnection(env: Env): Promise<boolean> {
    try {
      const sql = this.getConnection(env);
      await sql`SELECT 1 as test`;
      
      console.log('✅ Database connection test passed');
      return true;
      
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      
      if (this.sentry) {
        this.sentry.captureException(error as Error, {
          tags: {
            component: 'database-pool',
            operation: 'test-connection'
          },
          extra: {
            error_message: error.message,
            hyperdrive_available: !!env.HYPERDRIVE
          }
        });
      }
      
      return false;
    }
  }
  
  /**
   * Get pool statistics for monitoring
   */
  public getStats(): {
    initialized: boolean;
    poolSize: number;
    connectionKeys: string[];
  } {
    return {
      initialized: this.initialized,
      poolSize: this.connections.size,
      connectionKeys: Array.from(this.connections.keys()).map(key => key.slice(-20))
    };
  }
  
  /**
   * Reset the pool (for testing purposes)
   */
  public reset(): void {
    this.connections.clear();
    this.initialized = false;
    this.sentry = null;
    console.log('🔄 Database pool reset');
  }
}

// Export singleton instance
export const dbPool = DatabaseConnectionPool.getInstance();

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
    }
    
    const sql = dbPool.getConnection(env);
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
          error_message: error.message
        }
      });
    }
    
    throw error;
  }
}