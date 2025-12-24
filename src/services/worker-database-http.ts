/**
 * Database Connection Service for Cloudflare Workers
 * Uses Neon PostgreSQL with HTTP-based connection
 */

import { neon } from '@neondatabase/serverless';

export interface DatabaseConfig {
  connectionString: string;
  maxRetries?: number;
  retryDelay?: number;
}

export class WorkerDatabase {
  private sql: ReturnType<typeof neon>;
  private maxRetries: number;
  private retryDelay: number;

  constructor(config: DatabaseConfig) {
    // Use the HTTP-based neon function for Cloudflare Workers
    this.sql = neon(config.connectionString);
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
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
        // Neon HTTP driver uses template literal syntax
        // For direct SQL, we use the template literal directly
        if (!values || values.length === 0) {
          // Simple query without parameters
          const result = await this.sql([text] as any);
          return result as T[];
        } else {
          // Query with parameters - manually build the query
          // This is a workaround since Neon HTTP doesn't support $1 syntax
          let processedSql = text;
          values.forEach((value, index) => {
            const placeholder = `$${index + 1}`;
            const escapedValue = value === null ? 'NULL' :
                              value === undefined ? 'NULL' :
                              typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` :
                              typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') :
                              value;
            processedSql = processedSql.replace(placeholder, String(escapedValue));
          });
          
          const result = await this.sql([processedSql] as any);
          return result as T[];
        }
      } catch (error) {
        lastError = error as Error;
        console.error(`Database query attempt ${attempt + 1} failed:`, error);
        
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
    
    throw lastError || new Error('Database query failed');
  }

  /**
   * Execute a transaction
   * Note: HTTP-based Neon doesn't support traditional transactions,
   * but we can simulate it with sequential queries
   */
  async transaction<T = any>(
    queries: Array<{ sql: string; params?: any[] }>
  ): Promise<T[][]> {
    const results: T[][] = [];
    
    try {
      // Execute queries sequentially
      for (const query of queries) {
        const result = await this.query<T>(query.sql, query.params);
        results.push(result);
      }
      
      return results;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }
}