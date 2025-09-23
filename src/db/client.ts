import { drizzle } from "npm:drizzle-orm/neon-serverless";
import { neon } from "npm:@neondatabase/serverless";
import * as schema from "./schema.ts";

const connectionString = Deno.env.get("DATABASE_URL")!;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Neon serverless client - optimized for edge runtime
const neonClient = neon(connectionString);

export const db = drizzle(neonClient, { schema });
export type Database = typeof db;

// For compatibility with existing code
export const migrationClient = neonClient;