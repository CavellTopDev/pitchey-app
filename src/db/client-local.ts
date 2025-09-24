import { drizzle } from "npm:drizzle-orm/postgres-js";
import postgres from "npm:postgres";
import * as schema from "./schema.ts";

// Get connection string with fallback for local development
const connectionString = Deno.env.get("DATABASE_URL") || 
  "postgresql://postgres:password@localhost:5432/pitchey";

// PostgreSQL client for local development
const sql = postgres(connectionString);

export const db = drizzle(sql, { schema });
export type Database = typeof db;

// For compatibility with existing code
export const migrationClient = sql;