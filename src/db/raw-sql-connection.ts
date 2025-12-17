/**
 * Raw SQL Database Connection Manager for Cloudflare Workers
 * 
 * Simple, fast, and reliable using Neon's serverless driver
 * No ORM complexity - just raw SQL
 */

import { neon, neonConfig, NeonQueryFunction } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis/cloudflare';
import { logError, getErrorMessage } from '../utils/error-serializer';

// Configure Neon for optimal edge performance
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = 'password';
neonConfig.coalesceWrites = true;
neonConfig.poolQueryViaFetch = true;
neonConfig.fetchConnectionCache = true;

export interface DatabaseConfig {
  connectionString: string;
  readReplicaUrls?: string[];
  maxRetries?: number;
  retryDelayMs?: number;
  queryTimeoutMs?: number;
  redis?: {
    url: string;
    token: string;
  };
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  fields?: any[];
}

/**
 * Raw SQL Database Manager
 * Provides connection pooling, retries, and caching
 */
export class RawSQLDatabase {
  private sql: NeonQueryFunction<false, false>;
  private readReplicas: NeonQueryFunction<false, false>[] = [];
  private redis?: Redis;
  private config: Required<DatabaseConfig>;
  private queryCount = 0;
  private errorCount = 0;
  private lastHealthCheck = new Date();
  private isHealthy = true;

  constructor(config: DatabaseConfig) {
    this.config = {
      connectionString: config.connectionString,
      readReplicaUrls: config.readReplicaUrls || [],
      maxRetries: config.maxRetries || 3,
      retryDelayMs: config.retryDelayMs || 100,
      queryTimeoutMs: config.queryTimeoutMs || 10000,
      redis: config.redis as any
    };

    // Initialize primary connection
    this.sql = neon(this.config.connectionString);

    // Initialize read replicas
    this.readReplicas = this.config.readReplicaUrls.map(url => neon(url));

    // Initialize Redis if configured
    if (this.config.redis) {
      this.redis = new Redis({
        url: this.config.redis.url,
        token: this.config.redis.token
      });
    }
  }

  /**
   * Execute a query with retries and error handling
   */
  async query<T = any>(
    queryText: string | TemplateStringsArray,
    params?: any[],
    options?: {
      useReadReplica?: boolean;
      cache?: { key: string; ttl: number };
      timeout?: number;
    }
  ): Promise<T[]> {
    // Check cache first
    if (options?.cache && this.redis) {
      try {
        const cached = await this.redis.get(options.cache.key);
        if (cached) {
          return cached as T[];
        }
      } catch (error) {
        console.warn('Cache read failed:', error);
      }
    }

    // Select connection (primary or read replica)
    const connection = this.getConnection(options?.useReadReplica);
    
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Set up timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          options?.timeout || this.config.queryTimeoutMs
        );

        // Execute query
        let result: any[];
        
        if (typeof queryText === 'string') {
          // Parameterized query - use proper SQL function call
          const sqlQuery = params && params.length > 0
            ? await connection(queryText, params)
            : await connection(queryText);
          result = sqlQuery as any[];
        } else {
          // Template literal query
          result = await connection(queryText, ...(params || []));
        }

        clearTimeout(timeoutId);
        this.queryCount++;

        // Cache result if requested
        if (options?.cache && this.redis && result) {
          try {
            await this.redis.set(options.cache.key, result, {
              ex: options.cache.ttl
            });
          } catch (error) {
            console.warn('Cache write failed:', error);
          }
        }

        return result;
      } catch (error: any) {
        lastError = error;
        this.errorCount++;
        
        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelayMs * attempt);
          continue;
        }
        
        logError('Database query failed', error);
        throw error;
      }
    }

    throw lastError || new Error('Query failed after retries');
  }

  /**
   * Execute a transaction
   */
  async transaction<T = any>(
    callback: (sql: NeonQueryFunction<false, false>) => Promise<T>
  ): Promise<T> {
    const sql = this.sql;
    
    try {
      await sql`BEGIN`;
      const result = await callback(sql);
      await sql`COMMIT`;
      return result;
    } catch (error) {
      await sql`ROLLBACK`;
      throw error;
    }
  }

  /**
   * Get a single row
   */
  async queryOne<T = any>(
    queryText: string | TemplateStringsArray,
    params?: any[],
    options?: { useReadReplica?: boolean; cache?: { key: string; ttl: number } }
  ): Promise<T | null> {
    const rows = await this.query<T>(queryText, params, options);
    return rows[0] || null;
  }

  /**
   * Execute an insert and return the inserted row(s)
   */
  async insert<T = any>(
    table: string,
    data: Record<string, any> | Record<string, any>[],
    returning = '*'
  ): Promise<T[]> {
    const records = Array.isArray(data) ? data : [data];
    if (records.length === 0) return [];

    const keys = Object.keys(records[0]);
    const values = records.map(record => 
      keys.map(key => record[key])
    );

    // Build the query
    const placeholders = records.map((_, recordIndex) =>
      `(${keys.map((_, keyIndex) => `$${recordIndex * keys.length + keyIndex + 1}`).join(', ')})`
    ).join(', ');

    const query = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES ${placeholders}
      ${returning ? `RETURNING ${returning}` : ''}
    `;

    const flatValues = values.flat();
    return await this.query<T>(query, flatValues);
  }

  /**
   * Execute an update
   */
  async update<T = any>(
    table: string,
    data: Record<string, any>,
    where: string,
    whereParams: any[] = [],
    returning = '*'
  ): Promise<T[]> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    const setClause = keys.map((key, index) => 
      `${key} = $${index + 1}`
    ).join(', ');

    // Adjust WHERE clause placeholders
    const adjustedWhere = where.replace(/\$(\d+)/g, (_, num) => 
      `$${parseInt(num) + keys.length}`
    );

    const query = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${adjustedWhere}
      ${returning ? `RETURNING ${returning}` : ''}
    `;

    return await this.query<T>(query, [...values, ...whereParams]);
  }

  /**
   * Execute a delete
   */
  async delete<T = any>(
    table: string,
    where: string,
    whereParams: any[] = [],
    returning = '*'
  ): Promise<T[]> {
    const query = `
      DELETE FROM ${table}
      WHERE ${where}
      ${returning ? `RETURNING ${returning}` : ''}
    `;

    return await this.query<T>(query, whereParams);
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.sql`SELECT NOW() as current_time`;
      this.isHealthy = true;
      this.lastHealthCheck = new Date();
      return true;
    } catch (error) {
      this.isHealthy = false;
      logError('Health check failed', error as Error);
      return false;
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      queryCount: this.queryCount,
      errorCount: this.errorCount,
      errorRate: this.queryCount > 0 ? this.errorCount / this.queryCount : 0,
      isHealthy: this.isHealthy,
      lastHealthCheck: this.lastHealthCheck
    };
  }

  /**
   * Clear cache for a specific key pattern
   */
  async clearCache(pattern: string): Promise<void> {
    if (!this.redis) return;
    
    try {
      // Note: Upstash Redis doesn't support pattern deletion
      // You need to track keys or use specific key names
      console.log(`Cache clear requested for pattern: ${pattern}`);
    } catch (error) {
      console.warn('Cache clear failed:', error);
    }
  }

  /**
   * Get connection (primary or read replica)
   */
  private getConnection(useReadReplica?: boolean): NeonQueryFunction<false, false> {
    if (useReadReplica && this.readReplicas.length > 0) {
      // Round-robin read replicas
      const index = this.queryCount % this.readReplicas.length;
      return this.readReplicas[index];
    }
    return this.sql;
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create database instance
 */
export function createDatabase(env: any): RawSQLDatabase {
  return new RawSQLDatabase({
    connectionString: env.DATABASE_URL,
    readReplicaUrls: env.READ_REPLICA_URLS ? env.READ_REPLICA_URLS.split(',') : [],
    redis: env.UPSTASH_REDIS_REST_URL ? {
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN
    } : undefined
  });
}

/**
 * SQL template tag helper for building dynamic queries
 */
export function sql(strings: TemplateStringsArray, ...values: any[]): {
  text: string;
  values: any[];
} {
  let text = '';
  const queryValues: any[] = [];
  
  strings.forEach((string, i) => {
    text += string;
    if (i < values.length) {
      queryValues.push(values[i]);
      text += `$${queryValues.length}`;
    }
  });
  
  return { text, values: queryValues };
}