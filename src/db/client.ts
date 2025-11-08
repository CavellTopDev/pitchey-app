import { drizzle } from "npm:drizzle-orm@0.35.3/postgres-js";
import { drizzle as drizzleNeon } from "npm:drizzle-orm@0.35.3/neon-http";
import { neon } from "npm:@neondatabase/serverless@0.9.5";
import postgres from "npm:postgres@^3.4.0";
import * as schema from "./schema.ts";

// Database performance monitoring
export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  error?: string;
}

class DatabaseMetrics {
  private static queryHistory: QueryMetrics[] = [];
  private static maxHistorySize = 100;

  static recordQuery(query: string, duration: number, error?: string) {
    this.queryHistory.unshift({
      query,
      duration,
      timestamp: new Date(),
      error
    });

    if (this.queryHistory.length > this.maxHistorySize) {
      this.queryHistory = this.queryHistory.slice(0, this.maxHistorySize);
    }

    // Log slow queries (>100ms)
    if (duration > 100) {
      console.warn(`🐌 Slow query detected (${duration}ms):`, query.substring(0, 200));
    }
  }

  static getSlowQueries(threshold = 100): QueryMetrics[] {
    return this.queryHistory.filter(q => q.duration > threshold);
  }

  static getAverageQueryTime(): number {
    if (this.queryHistory.length === 0) return 0;
    const total = this.queryHistory.reduce((sum, q) => sum + q.duration, 0);
    return total / this.queryHistory.length;
  }

  static getQueryStats() {
    return {
      totalQueries: this.queryHistory.length,
      averageTime: this.getAverageQueryTime(),
      slowQueries: this.getSlowQueries().length,
      recentQueries: this.queryHistory.slice(0, 10)
    };
  }
}

// Get connection string with fallback for deployment
const connectionString = Deno.env.get("DATABASE_URL") || 
  "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

// Check if we're using a local database or Neon
const isLocalDb = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

// Create appropriate client based on environment with optimized connection pooling
let client: any;
let db: any;

if (isLocalDb) {
  // Local PostgreSQL with connection pooling
  client = postgres(connectionString, {
    max: 20,                    // Maximum connections in pool
    idle_timeout: 20,          // Close idle connections after 20s
    connect_timeout: 10,       // Connection timeout
    max_lifetime: 60 * 30,     // Max connection lifetime (30 minutes)
    transform: postgres.camel, // Convert snake_case to camelCase
  });
  db = drizzle(client, { schema });
} else {
  // Neon serverless with optimized HTTP client
  const neonClient = neon(connectionString, {
    fullResults: true,
    // fetchConnectionCache: true,  // Removed - not supported in current version
  });
  
  // Wrap client with query monitoring
  const monitoredClient = async (query: string, params?: any[]) => {
    const start = performance.now();
    try {
      const result = await neonClient(query, params);
      const duration = performance.now() - start;
      DatabaseMetrics.recordQuery(query, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      DatabaseMetrics.recordQuery(query, duration, error instanceof Error ? error.message : String(error));
      throw error;
    }
  };
  
  db = drizzleNeon(neonClient, { 
    schema,
    logger: process.env.NODE_ENV === "development"
  });
}

// Export query metrics for monitoring
export { DatabaseMetrics };

export { db };

export type Database = typeof db;

// For compatibility with existing code - provide a safe wrapper
export const migrationClient = isLocalDb 
  ? client // postgres-js client has the methods the migrator expects
  : {
      // Neon serverless adapter - provide minimal interface for migration cleanup only
      end: async () => {
        // Neon serverless doesn't need explicit connection closing
        return Promise.resolve();
      }
    };