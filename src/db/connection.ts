/**
 * Database Connection Helper for Cloudflare Workers Free Tier
 * Uses Neon PostgreSQL with HTTP connection
 */

import { neon } from '@neondatabase/serverless';

export interface Env {
  DATABASE_URL: string;
  JWT_SECRET?: string;
  SESSIONS_KV?: KVNamespace;
  KV?: KVNamespace;
  [key: string]: any;
}

/**
 * Get database connection with proper error handling
 */
export function getDb(env: Env) {
  if (!env.DATABASE_URL) {
    // Debug-level: this fires on non-DB code paths and is expected behavior
    console.debug('DATABASE_URL not configured — skipping DB connection');
    return null;
  }
  
  try {
    // Use HTTP connection for Cloudflare Workers free tier
    return neon(env.DATABASE_URL);
  } catch (error) {
    console.error('Database connection error:', error);
    return null;
  }
}

/**
 * Safe database query wrapper
 */
export async function safeQuery<T = any>(
  sql: ReturnType<typeof neon> | null,
  query: any,
  defaultValue: T
): Promise<T> {
  if (!sql) {
    return defaultValue;
  }
  
  try {
    const result = await query(sql);
    return result || defaultValue;
  } catch (error) {
    console.error('Query error:', error);
    return defaultValue;
  }
}