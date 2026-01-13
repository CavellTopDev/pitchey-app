/**
 * Instrumented Database Base Layer with Analytics Engine Integration
 * 
 * Extends the base query utilities with comprehensive metrics tracking
 * for performance monitoring and observability.
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { 
  DatabaseMetricsService, 
  DatabaseMetrics, 
  AnalyticsEnv,
  getAnalyticsDatasets
} from '../services/database-metrics.service.js';

// Re-export types from base
export type SqlQuery = NeonQueryFunction<false, false>;

export interface RequestContext {
  endpoint?: string;
  userId?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
}

/**
 * Instrumented SQL connection that automatically tracks all queries
 */
export class InstrumentedSqlConnection {
  private sql: SqlQuery;
  private analytics: ReturnType<typeof getAnalyticsDatasets>;
  private context: RequestContext;

  constructor(
    databaseUrl: string, 
    env: AnalyticsEnv,
    context: RequestContext = {}
  ) {
    this.sql = neon(databaseUrl);
    this.analytics = getAnalyticsDatasets(env);
    this.context = context;
  }

  /**
   * Execute a query with automatic metrics tracking
   */
  async query<T = any>(
    query: string | TemplateStringsArray, 
    ...params: any[]
  ): Promise<T[]> {
    const startTime = Date.now();
    
    // Handle both template strings and regular strings
    let queryString: string;
    if (typeof query === 'string') {
      queryString = query;
    } else {
      // Template string - reconstruct the query
      queryString = query.raw.reduce((acc, str, i) => {
        return acc + str + (params[i] !== undefined ? `$${i + 1}` : '');
      }, '');
    }

    const queryType = DatabaseMetricsService.extractQueryType(queryString);
    const table = DatabaseMetricsService.extractTableName(queryString);

    try {
      let result: T[];
      
      // Execute query based on input type
      if (typeof query === 'string') {
        result = await this.sql(query, params) as T[];
      } else {
        result = await this.sql(query, ...params) as T[];
      }

      const duration = Date.now() - startTime;

      // Track successful query
      await DatabaseMetricsService.recordQuery(this.analytics.database, {
        queryType,
        table,
        duration,
        rowCount: result?.length || 0,
        success: true,
        timestamp: Date.now(),
        endpoint: this.context.endpoint,
        userId: this.context.userId
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Track failed query
      await DatabaseMetricsService.recordQuery(this.analytics.database, {
        queryType,
        table,
        duration,
        success: false,
        errorCode: error.code || error.name || 'UNKNOWN',
        timestamp: Date.now(),
        endpoint: this.context.endpoint,
        userId: this.context.userId
      });

      // Track error details
      await DatabaseMetricsService.recordError(this.analytics.errors, {
        type: 'DATABASE',
        source: `${queryType}:${table}`,
        message: error.message || 'Unknown database error',
        code: error.code || error.name,
        timestamp: Date.now(),
        endpoint: this.context.endpoint,
        userId: this.context.userId
      });

      throw error;
    }
  }

  /**
   * Execute a single query and return first result
   */
  async queryFirst<T = any>(
    query: string | TemplateStringsArray, 
    ...params: any[]
  ): Promise<T | null> {
    const results = await this.query<T>(query, ...params);
    return results && results.length > 0 ? results[0] : null;
  }

  /**
   * Execute query and return affected row count
   */
  async execute(
    query: string | TemplateStringsArray, 
    ...params: any[]
  ): Promise<number> {
    const startTime = Date.now();
    
    let queryString: string;
    if (typeof query === 'string') {
      queryString = query;
    } else {
      queryString = query.raw.reduce((acc, str, i) => {
        return acc + str + (params[i] !== undefined ? `$${i + 1}` : '');
      }, '');
    }

    const queryType = DatabaseMetricsService.extractQueryType(queryString);
    const table = DatabaseMetricsService.extractTableName(queryString);

    try {
      let result: any;
      
      if (typeof query === 'string') {
        result = await this.sql(query, params);
      } else {
        result = await this.sql(query, ...params);
      }

      const duration = Date.now() - startTime;
      const affectedRows = result?.changes || result?.rowCount || 0;

      // Track successful execution
      await DatabaseMetricsService.recordQuery(this.analytics.database, {
        queryType,
        table,
        duration,
        rowCount: affectedRows,
        success: true,
        timestamp: Date.now(),
        endpoint: this.context.endpoint,
        userId: this.context.userId
      });

      return affectedRows;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Track failed execution
      await DatabaseMetricsService.recordQuery(this.analytics.database, {
        queryType,
        table,
        duration,
        success: false,
        errorCode: error.code || error.name || 'UNKNOWN',
        timestamp: Date.now(),
        endpoint: this.context.endpoint,
        userId: this.context.userId
      });

      throw error;
    }
  }

  /**
   * Transaction support with metrics tracking
   */
  async transaction<T>(
    callback: (sql: InstrumentedSqlConnection) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    
    try {
      await this.sql`BEGIN`;
      const result = await callback(this);
      await this.sql`COMMIT`;
      success = true;

      const duration = Date.now() - startTime;

      // Track successful transaction
      await DatabaseMetricsService.recordQuery(this.analytics.database, {
        queryType: 'TRANSACTION',
        table: 'multiple',
        duration,
        success: true,
        timestamp: Date.now(),
        endpoint: this.context.endpoint,
        userId: this.context.userId
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      await this.sql`ROLLBACK`;

      // Track failed transaction
      await DatabaseMetricsService.recordQuery(this.analytics.database, {
        queryType: 'TRANSACTION',
        table: 'multiple',
        duration,
        success: false,
        errorCode: error.code || error.name || 'UNKNOWN',
        timestamp: Date.now(),
        endpoint: this.context.endpoint,
        userId: this.context.userId
      });

      throw error;
    }
  }

  /**
   * Get raw SQL connection for direct access (not recommended)
   */
  getRawConnection(): SqlQuery {
    return this.sql;
  }

  /**
   * Update request context (useful for middleware)
   */
  updateContext(newContext: Partial<RequestContext>): void {
    this.context = { ...this.context, ...newContext };
  }
}

/**
 * Create an instrumented SQL connection for a specific request
 */
export function createInstrumentedSqlConnection(
  databaseUrl: string,
  env: AnalyticsEnv,
  context: RequestContext = {}
): InstrumentedSqlConnection {
  return new InstrumentedSqlConnection(databaseUrl, env, context);
}

/**
 * Legacy compatibility - create basic connection without instrumentation
 */
export function createSqlConnection(databaseUrl: string): SqlQuery {
  return neon(databaseUrl);
}

// Re-export utilities from base
export {
  sqlParam,
  DatabaseError,
  WhereBuilder,
  PaginationOptions,
  buildPaginationClause,
  extractFirst,
  extractMany
} from './base.js';

/**
 * Performance monitoring utilities
 */
export class QueryPerformanceMonitor {
  private slowQueryThreshold: number;
  private analytics: AnalyticsEnv;

  constructor(analytics: AnalyticsEnv, slowQueryThreshold = 100) {
    this.analytics = analytics;
    this.slowQueryThreshold = slowQueryThreshold;
  }

  /**
   * Analyze query patterns and identify performance issues
   */
  async analyzeQuery(
    query: string, 
    duration: number, 
    context: RequestContext
  ): Promise<void> {
    if (duration > this.slowQueryThreshold) {
      const queryType = DatabaseMetricsService.extractQueryType(query);
      const table = DatabaseMetricsService.extractTableName(query);

      await DatabaseMetricsService.recordError(
        getAnalyticsDatasets(this.analytics).errors,
        {
          type: 'SLOW_QUERY',
          source: `${queryType}:${table}`,
          message: `Query took ${duration}ms (threshold: ${this.slowQueryThreshold}ms)`,
          code: 'PERFORMANCE_WARNING',
          timestamp: Date.now(),
          endpoint: context.endpoint,
          userId: context.userId
        }
      );
    }
  }
}

/**
 * Database health monitoring
 */
export class DatabaseHealthMonitor {
  private analytics: AnalyticsEnv;
  private connectionPool: Map<string, Date> = new Map();

  constructor(analytics: AnalyticsEnv) {
    this.analytics = analytics;
  }

  /**
   * Track connection health
   */
  async trackConnection(connectionId: string, healthy: boolean): Promise<void> {
    if (healthy) {
      this.connectionPool.set(connectionId, new Date());
    } else {
      this.connectionPool.delete(connectionId);
      
      await DatabaseMetricsService.recordError(
        getAnalyticsDatasets(this.analytics).errors,
        {
          type: 'CONNECTION',
          source: 'database_pool',
          message: `Connection ${connectionId} failed health check`,
          code: 'CONNECTION_FAILURE',
          timestamp: Date.now()
        }
      );
    }
  }

  /**
   * Get current connection pool status
   */
  getConnectionStatus(): {
    active: number;
    oldest: Date | null;
    newest: Date | null;
  } {
    const connections = Array.from(this.connectionPool.values());
    return {
      active: connections.length,
      oldest: connections.length > 0 ? new Date(Math.min(...connections.map(d => d.getTime()))) : null,
      newest: connections.length > 0 ? new Date(Math.max(...connections.map(d => d.getTime()))) : null
    };
  }
}