import { drizzle } from "npm:drizzle-orm@0.33.0/postgres-js";
import { drizzle as drizzleNeon } from "npm:drizzle-orm@0.33.0/neon-http";
import { neon } from "npm:@neondatabase/serverless@0.9.5";
import postgres from "npm:postgres@^3.4.0";
import * as schema from "./schema.ts";

// Get connection string with fallback for deployment
const connectionString = Deno.env.get("DATABASE_URL") || 
  "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

// Check if we're using a local database or Neon
const isLocalDb = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

// Create appropriate client based on environment
let client: any;
let db: any;

if (isLocalDb) {
  client = postgres(connectionString);
  db = drizzle(client, { schema });
} else {
  // Use Neon with newer syntax
  client = neon(connectionString);
  db = drizzleNeon(client, { schema });
}

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