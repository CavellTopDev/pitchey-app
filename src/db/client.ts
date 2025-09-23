import { drizzle } from "npm:drizzle-orm/neon-serverless";
import { neon } from "npm:@neondatabase/serverless";
import * as schema from "./schema.ts";

// Get connection string with fallback for deployment
const connectionString = Deno.env.get("DATABASE_URL") || 
  "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

// Neon serverless client - optimized for edge runtime
const neonClient = neon(connectionString);

export const db = drizzle(neonClient, { schema });
export type Database = typeof db;

// For compatibility with existing code
export const migrationClient = neonClient;