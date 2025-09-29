import { drizzle } from "npm:drizzle-orm/postgres-js";
import { drizzle as drizzleNeon } from "npm:drizzle-orm/neon-http";
import { neon, neonConfig } from "npm:@neondatabase/serverless";
import postgres from "npm:postgres";
import * as schema from "./schema.ts";

// Configure Neon for Edge/Serverless environments
neonConfig.fetchConnectionCache = true;

// Get connection string with fallback for deployment
const connectionString = Deno.env.get("DATABASE_URL") || 
  "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

// Check if we're using a local database or Neon
const isLocalDb = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

// Create appropriate client based on environment with optimized settings
const client = isLocalDb 
  ? postgres(connectionString, {
      max: 20,                  // Maximum number of connections in pool
      idle_timeout: 20,         // Idle timeout in seconds
      connect_timeout: 10,      // Connection timeout in seconds
      max_lifetime: 60 * 30,    // Max lifetime of a connection (30 minutes)
      prepare: false,           // Disable prepared statements for better compatibility
    })
  : neon(connectionString);

// Create drizzle instance with appropriate adapter
export const db = isLocalDb
  ? drizzle(client as any, { schema })
  : drizzleNeon(client as any, { schema });

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

// Export the raw client for direct queries if needed
export const rawClient = client;

// Cleanup function for graceful shutdown
export async function closeDatabase() {
  if (isLocalDb && client && typeof client.end === 'function') {
    await client.end();
  }
}