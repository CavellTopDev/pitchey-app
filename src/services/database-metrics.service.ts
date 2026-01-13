/**
 * Database Metrics Service - Cloudflare Analytics Engine Integration
 * 
 * Tracks database performance, query patterns, and error rates
 * using Cloudflare Analytics Engine for real-time observability.
 */

export interface DatabaseMetrics {
  queryType: string;        // SELECT, INSERT, UPDATE, DELETE
  table: string;           // Table being accessed
  duration: number;        // Query execution time in ms
  rowCount?: number;       // Number of rows affected/returned
  success: boolean;        // Query success/failure
  errorCode?: string;      // Error code if failed
  timestamp: number;       // When the query was executed
  endpoint?: string;       // API endpoint that triggered the query
  userId?: string;         // User who initiated the request (if available)
}

export interface PerformanceMetrics {
  endpoint: string;        // API endpoint path
  method: string;          // HTTP method
  duration: number;        // Total request duration in ms
  statusCode: number;      // HTTP response code
  timestamp: number;       // Request timestamp
  queryCount: number;      // Number of DB queries in this request
  cacheHit?: boolean;      // Whether response was cached
  userId?: string;         // User who made the request
}

export interface ErrorMetrics {
  type: string;           // ERROR_TYPE (database, validation, auth, etc.)
  source: string;         // Where the error occurred
  message: string;        // Error message
  code?: string;          // Error code
  timestamp: number;      // When the error occurred
  userId?: string;        // User associated with the error
  endpoint?: string;      // API endpoint where error occurred
}

export class DatabaseMetricsService {
  /**
   * Record database query metrics to Analytics Engine
   */
  static async recordQuery(
    analytics: AnalyticsEngineDataset | null,
    metrics: DatabaseMetrics
  ): Promise<void> {
    if (!analytics) return;

    try {
      await analytics.writeDataPoint({
        blobs: [
          metrics.queryType,
          metrics.table,
          metrics.success ? 'SUCCESS' : 'ERROR',
          metrics.errorCode || 'NONE',
          metrics.endpoint || 'unknown',
          metrics.userId || 'anonymous'
        ],
        doubles: [
          metrics.duration,
          metrics.rowCount || 0,
          metrics.timestamp
        ],
        indexes: [
          metrics.table,           // Index by table for table-specific queries
          metrics.queryType,       // Index by query type
          `${metrics.table}:${metrics.queryType}` // Combined index
        ]
      });
    } catch (error) {
      // Don't throw - metrics should never break the main flow
      console.error('Failed to record database metrics:', error);
    }
  }

  /**
   * Record API endpoint performance metrics
   */
  static async recordPerformance(
    analytics: AnalyticsEngineDataset | null,
    metrics: PerformanceMetrics
  ): Promise<void> {
    if (!analytics) return;

    try {
      await analytics.writeDataPoint({
        blobs: [
          metrics.endpoint,
          metrics.method,
          metrics.statusCode.toString(),
          metrics.cacheHit ? 'CACHE_HIT' : 'CACHE_MISS',
          metrics.userId || 'anonymous'
        ],
        doubles: [
          metrics.duration,
          metrics.queryCount,
          metrics.timestamp
        ],
        indexes: [
          metrics.endpoint,        // Index by endpoint
          `${metrics.method}:${metrics.endpoint}`, // Method + endpoint
          `status:${metrics.statusCode}`  // Status code grouping
        ]
      });
    } catch (error) {
      console.error('Failed to record performance metrics:', error);
    }
  }

  /**
   * Record error metrics for tracking and alerting
   */
  static async recordError(
    analytics: AnalyticsEngineDataset | null,
    metrics: ErrorMetrics
  ): Promise<void> {
    if (!analytics) return;

    try {
      await analytics.writeDataPoint({
        blobs: [
          metrics.type,
          metrics.source,
          metrics.message.substring(0, 500), // Truncate long messages
          metrics.code || 'UNKNOWN',
          metrics.endpoint || 'unknown',
          metrics.userId || 'anonymous'
        ],
        doubles: [
          metrics.timestamp,
          1 // Error count (always 1 per event)
        ],
        indexes: [
          metrics.type,            // Error type grouping
          metrics.source,          // Error source
          `${metrics.type}:${metrics.source}` // Combined index
        ]
      });
    } catch (error) {
      console.error('Failed to record error metrics:', error);
    }
  }

  /**
   * Helper to extract table name from SQL query
   */
  static extractTableName(query: string): string {
    // Clean up query string
    const cleanQuery = query.replace(/\s+/g, ' ').trim();
    
    // Patterns to match table names in different query types
    const patterns = [
      /(?:FROM|INTO|UPDATE|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i,
      /INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/i,
      /UPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)/i,
      /DELETE\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i
    ];

    for (const pattern of patterns) {
      const match = cleanQuery.match(pattern);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }

    return 'unknown';
  }

  /**
   * Helper to extract query type from SQL
   */
  static extractQueryType(query: string): string {
    const firstWord = query.trim().split(' ')[0].toUpperCase();
    
    // Map complex queries to simple types
    const queryTypeMap: { [key: string]: string } = {
      'SELECT': 'SELECT',
      'INSERT': 'INSERT',
      'UPDATE': 'UPDATE',
      'DELETE': 'DELETE',
      'WITH': 'SELECT', // CTE queries are essentially SELECTs
      'UPSERT': 'INSERT',
      'REPLACE': 'INSERT'
    };

    return queryTypeMap[firstWord] || firstWord;
  }

  /**
   * Create a metrics wrapper for database queries
   */
  static createQueryWrapper(
    analytics: AnalyticsEngineDataset | null,
    context: {
      endpoint?: string;
      userId?: string;
    } = {}
  ) {
    return async function<T>(
      query: string,
      params: any[] = [],
      executor: (query: string, params: any[]) => Promise<T>
    ): Promise<T> {
      const startTime = Date.now();
      const queryType = DatabaseMetricsService.extractQueryType(query);
      const table = DatabaseMetricsService.extractTableName(query);

      try {
        const result = await executor(query, params);
        const duration = Date.now() - startTime;

        // Extract row count if possible
        let rowCount: number | undefined;
        if (result && typeof result === 'object') {
          if ('results' in result && Array.isArray((result as any).results)) {
            rowCount = (result as any).results.length;
          } else if ('changes' in result) {
            rowCount = (result as any).changes;
          } else if ('meta' in result && 'changes' in (result as any).meta) {
            rowCount = (result as any).meta.changes;
          }
        }

        // Record successful query metrics
        await DatabaseMetricsService.recordQuery(analytics, {
          queryType,
          table,
          duration,
          rowCount,
          success: true,
          timestamp: Date.now(),
          endpoint: context.endpoint,
          userId: context.userId
        });

        return result;
      } catch (error: any) {
        const duration = Date.now() - startTime;

        // Record failed query metrics
        await DatabaseMetricsService.recordQuery(analytics, {
          queryType,
          table,
          duration,
          success: false,
          errorCode: error.code || error.name || 'UNKNOWN',
          timestamp: Date.now(),
          endpoint: context.endpoint,
          userId: context.userId
        });

        // Also record as general error
        await DatabaseMetricsService.recordError(analytics, {
          type: 'DATABASE',
          source: `${queryType}:${table}`,
          message: error.message || 'Unknown database error',
          code: error.code || error.name,
          timestamp: Date.now(),
          endpoint: context.endpoint,
          userId: context.userId
        });

        throw error;
      }
    };
  }

  /**
   * Create performance wrapper for API endpoints
   */
  static createPerformanceWrapper(
    analytics: AnalyticsEngineDataset | null,
    endpoint: string,
    method: string,
    context: {
      userId?: string;
    } = {}
  ) {
    return async function<T>(
      handler: () => Promise<Response>,
      options: {
        cacheHit?: boolean;
        queryCount?: number;
      } = {}
    ): Promise<Response> {
      const startTime = Date.now();
      let queryCount = 0;

      try {
        const response = await handler();
        const duration = Date.now() - startTime;

        // Record performance metrics
        await DatabaseMetricsService.recordPerformance(analytics, {
          endpoint,
          method,
          duration,
          statusCode: response.status,
          timestamp: Date.now(),
          queryCount: options.queryCount || queryCount,
          cacheHit: options.cacheHit,
          userId: context.userId
        });

        return response;
      } catch (error: any) {
        const duration = Date.now() - startTime;

        // Record failed request performance
        await DatabaseMetricsService.recordPerformance(analytics, {
          endpoint,
          method,
          duration,
          statusCode: 500,
          timestamp: Date.now(),
          queryCount: options.queryCount || queryCount,
          cacheHit: false,
          userId: context.userId
        });

        // Record the error
        await DatabaseMetricsService.recordError(analytics, {
          type: 'API',
          source: endpoint,
          message: error.message || 'Unknown API error',
          code: error.code || error.name,
          timestamp: Date.now(),
          endpoint,
          userId: context.userId
        });

        throw error;
      }
    };
  }
}

/**
 * Environment interface extension for Analytics Engine datasets
 */
export interface AnalyticsEnv {
  PITCHEY_ANALYTICS?: AnalyticsEngineDataset;
  PITCHEY_PERFORMANCE?: AnalyticsEngineDataset;
  PITCHEY_ERRORS?: AnalyticsEngineDataset;
}

/**
 * Utility function to safely get analytics datasets from environment
 */
export function getAnalyticsDatasets(env: any): {
  database: AnalyticsEngineDataset | null;
  performance: AnalyticsEngineDataset | null;
  errors: AnalyticsEngineDataset | null;
} {
  return {
    database: env.PITCHEY_ANALYTICS || null,
    performance: env.PITCHEY_PERFORMANCE || null,
    errors: env.PITCHEY_ERRORS || null
  };
}