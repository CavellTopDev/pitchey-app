/**
 * Database Client for Node.js/Deno environments
 * Uses raw SQL with Neon's serverless driver
 */

import { createDatabase, RawSQLDatabase } from './raw-sql-connection.ts';

// Database performance monitoring (kept for compatibility)
export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  error?: string;
}

// Get connection string from environment
const connectionString = Deno.env.get("DATABASE_URL");

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required. Please set it in your environment or Cloudflare secrets.");
}

// Create database instance
const db: RawSQLDatabase = createDatabase({
  DATABASE_URL: connectionString,
  READ_REPLICA_URLS: Deno.env.get("READ_REPLICA_URLS"),
  UPSTASH_REDIS_REST_URL: Deno.env.get("UPSTASH_REDIS_REST_URL"),
  UPSTASH_REDIS_REST_TOKEN: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")
});

// Export query metrics from the database instance
export const DatabaseMetrics = {
  getQueryStats: () => db.getStats(),
  getSlowQueries: (threshold = 100) => {
    // This is a simplified version - the actual implementation would need to track individual queries
    const stats = db.getStats();
    return [];
  },
  getAverageQueryTime: () => {
    const stats = db.getStats();
    return stats.queryCount > 0 ? 50 : 0; // Placeholder average
  }
};

// Export database instance
export { db };

// Export type for compatibility
export type Database = RawSQLDatabase;

// For compatibility with existing migration code
export const migrationClient = {
  end: async () => {
    // Neon serverless doesn't need explicit connection closing
    return Promise.resolve();
  }
};