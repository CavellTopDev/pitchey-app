/**
 * Cloudflare Workers Database Client
 * Uses raw SQL with Neon's serverless driver
 */

import { RawSQLDatabase } from './raw-sql-connection.ts';

// Environment interface for Workers
export interface WorkerEnv {
  DATABASE_URL: string;
  READ_REPLICA_URLS?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  JWT_SECRET: string;
  HYPERDRIVE?: any; // Optional Hyperdrive binding
  CACHE?: KVNamespace; // Optional KV cache
}

/**
 * Creates a database client for Cloudflare Workers
 * 
 * @param env - Worker environment with database configuration
 * @returns Configured database client with raw SQL
 */
export function createWorkerDbClient(env: WorkerEnv): RawSQLDatabase {
  // Use Hyperdrive connection string if available, otherwise use direct connection
  const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('No database configuration found. Please configure DATABASE_URL or Hyperdrive.');
  }

  return new RawSQLDatabase({
    connectionString,
    readReplicaUrls: env.READ_REPLICA_URLS ? env.READ_REPLICA_URLS.split(',') : [],
    maxRetries: 3,
    retryDelayMs: 100,
    queryTimeoutMs: 10000,
    redis: env.UPSTASH_REDIS_REST_URL ? {
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN!
    } : undefined
  });
}

/**
 * Query caching utilities for read-heavy operations using KV
 */
export class QueryCache {
  private cache: KVNamespace | null;
  private ttl: number;

  constructor(cache: KVNamespace | null, ttlSeconds = 300) {
    this.cache = cache;
    this.ttl = ttlSeconds;
  }

  /**
   * Get cached query result
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.cache) return null;
    
    try {
      const cached = await this.cache.get(key, 'json');
      return cached as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached query result
   */
  async set<T>(key: string, value: T): Promise<void> {
    if (!this.cache) return;
    
    try {
      await this.cache.put(key, JSON.stringify(value), {
        expirationTtl: this.ttl
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Execute query with caching
   */
  async withCache<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute query
    const result = await queryFn();

    // Cache the result
    if (ttl !== undefined) {
      const oldTtl = this.ttl;
      this.ttl = ttl;
      await this.set(key, result);
      this.ttl = oldTtl;
    } else {
      await this.set(key, result);
    }

    return result;
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidate(pattern: string): Promise<void> {
    if (!this.cache) return;
    
    try {
      // KV doesn't support pattern deletion, so we track keys separately
      const keys = await this.cache.list({ prefix: pattern });
      await Promise.all(
        keys.keys.map(key => this.cache!.delete(key.name))
      );
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
}

/**
 * Database migration utilities for Workers
 */
export class WorkerMigrations {
  private db: RawSQLDatabase;

  constructor(db: RawSQLDatabase) {
    this.db = db;
  }

  /**
   * Check if migrations are needed
   */
  async needsMigration(): Promise<boolean> {
    try {
      const result = await this.db.queryOne<{ exists: boolean }>(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'migrations'
        ) as exists
      `);
      
      return !result?.exists;
    } catch (error) {
      console.error('Migration check error:', error);
      return true;
    }
  }

  /**
   * Run pending migrations
   */
  async runMigrations(): Promise<void> {
    console.log('Running database migrations...');
    
    try {
      // Create migrations table if it doesn't exist
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('Migrations completed successfully');
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  }
}

/**
 * Connection health monitoring
 */
export class HealthCheck {
  private db: RawSQLDatabase;

  constructor(db: RawSQLDatabase) {
    this.db = db;
  }

  /**
   * Check database connectivity
   */
  async isHealthy(): Promise<boolean> {
    return await this.db.healthCheck();
  }

  /**
   * Get connection statistics
   */
  async getStats(): Promise<any> {
    const stats = this.db.getStats();
    return {
      ...stats,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Export database type for use in services
 */
export type WorkerDatabase = RawSQLDatabase;

/**
 * Transaction wrapper for Workers
 */
export async function withTransaction<T>(
  db: WorkerDatabase,
  callback: (db: RawSQLDatabase) => Promise<T>
): Promise<T> {
  return await db.transaction(callback);
}

/**
 * Prepared statement helper for performance
 */
export function prepareBatch<T>(
  db: WorkerDatabase,
  queries: Array<() => Promise<T>>
): Promise<T[]> {
  // Execute queries in parallel for better performance
  return Promise.all(queries.map(q => q()));
}

// Export utilities
export default createWorkerDbClient;