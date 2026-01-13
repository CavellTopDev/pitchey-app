/**
 * Database Connection Service for Cloudflare Workers
 * Uses Neon PostgreSQL Serverless Driver for HTTP/WebSocket connections
 */

import { neon } from '@neondatabase/serverless';

export interface DatabaseConfig {
  connectionString: string;
  maxRetries?: number;
  retryDelay?: number;
}

export class WorkerDatabase {
  private sql: ReturnType<typeof neon>;
  private connectionString: string;
  private maxRetries: number;
  private retryDelay: number;

  constructor(config: DatabaseConfig) {
    this.connectionString = config.connectionString;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;

    // Initialize Neon serverless client
    this.sql = neon(this.connectionString);
  }

  /**
   * Get the raw SQL client for direct queries
   */
  getSql() {
    return this.sql;
  }

  /**
   * Execute a query with automatic retry logic
   */
  async query<T = any>(
    text: string,
    values?: any[]
  ): Promise<T[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        let result: any[];

        // Use Neon's correct API - the sql client is a callable function
        if (values && values.length > 0) {
          // For parameterized queries with $1, $2, etc., use the callable directly
          result = await (this.sql as any)(text, values);
        } else {
          // For queries without parameters
          result = await (this.sql as any)(text);
        }

        return result as T[];
      } catch (error) {
        console.error(`Database query attempt ${attempt + 1} failed:`, error);
        lastError = error as Error;

        // Check if it's a client error (4xx) - don't retry
        if (error instanceof Error &&
          (error.message.includes('syntax error') ||
            error.message.includes('does not exist') ||
            error.message.includes('invalid'))) {
          throw error;
        }

        // Wait before retrying with exponential backoff
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError || new Error('Database query failed after all retries');
  }

  /**
   * Execute a query and return a single row
   */
  async queryOne<T = any>(
    text: string,
    values?: any[]
  ): Promise<T | null> {
    const results = await this.query<T>(text, values);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Execute a query that doesn't return results (INSERT, UPDATE, DELETE)
   */
  async execute(
    text: string,
    values?: any[]
  ): Promise<{ rowCount: number }> {
    const results = await this.query(text, values);
    // For modification queries, Neon returns affected rows info
    return { rowCount: results.length };
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW() as time');
      return result.length > 0;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }
}