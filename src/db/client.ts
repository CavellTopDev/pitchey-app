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

// Create appropriate client based on environment
const client = isLocalDb 
  ? postgres(connectionString)
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