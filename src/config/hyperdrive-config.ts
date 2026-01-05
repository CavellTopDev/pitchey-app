/**
 * Cloudflare Hyperdrive Configuration for Neon PostgreSQL
 * Eliminates database connection overhead with global connection pooling
 */

import postgres from 'postgres';
import { neon } from '@neondatabase/serverless';

export interface HyperdriveConfig {
  binding: string;
  caching: {
    maxAge: number;
    staleWhileRevalidate: number;
  };
  connectionPool: {
    maxConnections: number;
    idleTimeout: number;
  };
}

export interface DatabaseStrategy {
  method: 'hyperdrive' | 'neon-http' | 'neon-websocket' | 'direct';
  description: string;
  useCase: string[];
  config?: any;
}

/**
 * Database connection strategy selector
 */
export class DatabaseConnectionManager {
  private strategies: Map<string, DatabaseStrategy> = new Map();
  
  constructor(private env: Env) {
    this.initializeStrategies();
  }
  
  /**
   * Initialize available connection strategies
   */
  private initializeStrategies(): void {
    // Hyperdrive for multi-query operations
    this.strategies.set('hyperdrive', {
      method: 'hyperdrive',
      description: 'Pre-warmed connection pool with global distribution',
      useCase: [
        'Multiple queries per request',
        'Complex transactions',
        'Dashboard data aggregation',
        'Report generation'
      ],
      config: {
        maxAge: 60,
        staleWhileRevalidate: 300
      }
    });
    
    // Neon HTTP for single queries
    this.strategies.set('neon-http', {
      method: 'neon-http',
      description: 'Stateless HTTP queries for simple operations',
      useCase: [
        'Single read queries',
        'Simple inserts/updates',
        'Health checks',
        'Configuration lookups'
      ]
    });
    
    // Neon WebSocket for interactive transactions
    this.strategies.set('neon-websocket', {
      method: 'neon-websocket',
      description: 'WebSocket connection for complex transactions',
      useCase: [
        'Interactive transactions',
        'Long-running operations',
        'Batch processing',
        'Migration scripts'
      ]
    });
    
    // Direct connection (development only)
    this.strategies.set('direct', {
      method: 'direct',
      description: 'Direct PostgreSQL connection without pooling',
      useCase: [
        'Local development',
        'Debugging',
        'Schema migrations'
      ]
    });
  }
  
  /**
   * Get optimal connection based on operation type
   */
  getConnection(operationType: 'read' | 'write' | 'transaction' | 'batch'): any {
    switch (operationType) {
      case 'read':
        return this.getReadConnection();
      case 'write':
        return this.getWriteConnection();
      case 'transaction':
        return this.getTransactionConnection();
      case 'batch':
        return this.getBatchConnection();
      default:
        return this.getDefaultConnection();
    }
  }
  
  /**
   * Get read-optimized connection
   */
  private getReadConnection() {
    // Use Hyperdrive for cached reads
    if (this.env.HYPERDRIVE) {
      return postgres(this.env.HYPERDRIVE.connectionString, {
        prepare: false, // Required for Hyperdrive
        types: {
          bigint: postgres.BigInt
        }
      });
    }
    
    // Fallback to Neon HTTP
    return neon(this.env.DATABASE_URL);
  }
  
  /**
   * Get write-optimized connection
   */
  private getWriteConnection() {
    // Use Hyperdrive for writes to maintain connection
    if (this.env.HYPERDRIVE) {
      return postgres(this.env.HYPERDRIVE.connectionString, {
        prepare: false,
        max: 1, // Single connection for writes
        idle_timeout: 20
      });
    }
    
    // Fallback to Neon HTTP
    return neon(this.env.DATABASE_URL);
  }
  
  /**
   * Get transaction-capable connection
   */
  private getTransactionConnection() {
    // Hyperdrive is best for transactions
    if (this.env.HYPERDRIVE) {
      return postgres(this.env.HYPERDRIVE.connectionString, {
        prepare: false,
        max: 3, // Limited connections for transactions
        idle_timeout: 30
      });
    }
    
    // Fallback to WebSocket pool
    return postgres(this.env.DATABASE_URL.replace('?sslmode=require', '?sslmode=require&pgbouncer=true'));
  }
  
  /**
   * Get batch operation connection
   */
  private getBatchConnection() {
    // Use Hyperdrive for batch operations
    if (this.env.HYPERDRIVE) {
      return postgres(this.env.HYPERDRIVE.connectionString, {
        prepare: false,
        max: 5, // More connections for parallel batch ops
        idle_timeout: 60
      });
    }
    
    // Fallback to direct connection
    return postgres(this.env.DATABASE_URL);
  }
  
  /**
   * Get default connection
   */
  private getDefaultConnection() {
    if (this.env.HYPERDRIVE) {
      return postgres(this.env.HYPERDRIVE.connectionString, {
        prepare: false
      });
    }
    
    return neon(this.env.DATABASE_URL);
  }
}

/**
 * Query execution with caching strategy
 */
export class CachedQueryExecutor {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  
  constructor(
    private db: DatabaseConnectionManager,
    private kv?: KVNamespace
  ) {}
  
  /**
   * Execute query with multi-layer caching
   */
  async execute<T>(
    query: string,
    params: any[],
    options: {
      cacheKey?: string;
      ttl?: number;
      cacheLayer?: 'memory' | 'kv' | 'both';
      operationType?: 'read' | 'write' | 'transaction' | 'batch';
    } = {}
  ): Promise<T> {
    const {
      cacheKey,
      ttl = 60,
      cacheLayer = 'both',
      operationType = 'read'
    } = options;
    
    // Check cache for read operations
    if (operationType === 'read' && cacheKey) {
      const cached = await this.getFromCache(cacheKey, cacheLayer);
      if (cached) return cached as T;
    }
    
    // Get appropriate connection
    const connection = this.db.getConnection(operationType);
    
    // Execute query
    const result = await connection(query, ...params);
    
    // Cache result for read operations
    if (operationType === 'read' && cacheKey) {
      await this.putInCache(cacheKey, result, ttl, cacheLayer);
    }
    
    return result as T;
  }
  
  /**
   * Get from cache
   */
  private async getFromCache(
    key: string,
    layer: 'memory' | 'kv' | 'both'
  ): Promise<any> {
    // Check memory cache
    if (layer === 'memory' || layer === 'both') {
      const memCached = this.cache.get(key);
      if (memCached && Date.now() - memCached.timestamp < 60000) {
        return memCached.data;
      }
    }
    
    // Check KV cache
    if ((layer === 'kv' || layer === 'both') && this.kv) {
      const kvCached = await this.kv.get(key, { type: 'json' });
      if (kvCached) {
        // Update memory cache
        if (layer === 'both') {
          this.cache.set(key, { data: kvCached, timestamp: Date.now() });
        }
        return kvCached;
      }
    }
    
    return null;
  }
  
  /**
   * Put in cache
   */
  private async putInCache(
    key: string,
    data: any,
    ttl: number,
    layer: 'memory' | 'kv' | 'both'
  ): Promise<void> {
    // Store in memory cache
    if (layer === 'memory' || layer === 'both') {
      this.cache.set(key, { data, timestamp: Date.now() });
    }
    
    // Store in KV cache
    if ((layer === 'kv' || layer === 'both') && this.kv) {
      await this.kv.put(key, JSON.stringify(data), {
        expirationTtl: ttl
      });
    }
  }
  
  /**
   * Invalidate cache
   */
  async invalidate(pattern: string): Promise<void> {
    // Clear memory cache
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
    
    // Clear KV cache (would need to track keys)
    // In production, use cache tags or versioning
  }
}

/**
 * Dashboard-specific caching strategy
 */
export class DashboardCache {
  private readonly CACHE_DURATION = {
    stats: 300,        // 5 minutes for aggregate stats
    lists: 120,        // 2 minutes for lists
    details: 60,       // 1 minute for details
    realtime: 10       // 10 seconds for real-time data
  };
  
  constructor(
    private executor: CachedQueryExecutor,
    private userId: string,
    private portalType: string
  ) {}
  
  /**
   * Get dashboard stats with caching
   */
  async getStats(): Promise<any> {
    const cacheKey = `dashboard:${this.portalType}:${this.userId}:stats`;
    
    return this.executor.execute(
      `
      SELECT 
        COUNT(DISTINCT pitches.id) as total_pitches,
        COUNT(DISTINCT investments.id) as total_investments,
        SUM(investments.amount) as total_invested,
        COUNT(DISTINCT ndas.id) as active_ndas
      FROM users
      LEFT JOIN pitches ON pitches.creator_id = users.id
      LEFT JOIN investments ON investments.investor_id = users.id
      LEFT JOIN ndas ON ndas.user_id = users.id AND ndas.status = 'active'
      WHERE users.id = $1
      `,
      [this.userId],
      {
        cacheKey,
        ttl: this.CACHE_DURATION.stats,
        cacheLayer: 'both',
        operationType: 'read'
      }
    );
  }
  
  /**
   * Get recent activity with caching
   */
  async getRecentActivity(limit: number = 10): Promise<any> {
    const cacheKey = `dashboard:${this.portalType}:${this.userId}:activity:${limit}`;
    
    return this.executor.execute(
      `
      SELECT 
        event_type,
        event_data,
        created_at
      FROM activity_log
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [this.userId, limit],
      {
        cacheKey,
        ttl: this.CACHE_DURATION.realtime,
        cacheLayer: 'memory', // Memory only for real-time data
        operationType: 'read'
      }
    );
  }
  
  /**
   * Get trending pitches with caching
   */
  async getTrendingPitches(): Promise<any> {
    const cacheKey = `trending:${this.portalType}:pitches`;
    
    return this.executor.execute(
      `
      SELECT 
        p.*,
        COUNT(DISTINCT v.user_id) as view_count,
        COUNT(DISTINCT i.investor_id) as investor_count,
        SUM(i.amount) as total_raised
      FROM pitches p
      LEFT JOIN pitch_views v ON v.pitch_id = p.id
      LEFT JOIN investments i ON i.pitch_id = p.id
      WHERE p.status = 'published'
        AND p.visibility_settings->>'${this.portalType}_visible' = 'true'
      GROUP BY p.id
      ORDER BY view_count DESC, total_raised DESC
      LIMIT 10
      `,
      [],
      {
        cacheKey,
        ttl: this.CACHE_DURATION.lists,
        cacheLayer: 'both',
        operationType: 'read'
      }
    );
  }
}

/**
 * Hyperdrive configuration for wrangler.toml
 */
export const hyperdriveConfig = `
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "your-hyperdrive-config-id"

[hyperdrive.caching]
# Query result cache duration in seconds
max_age = 60
# Serve stale content while revalidating
stale_while_revalidate = 300

[hyperdrive.connection_pooling]
# Maximum connections in the pool
max_connections = 10
# Idle connection timeout in seconds
idle_timeout = 270
`;

/**
 * Example Worker using Hyperdrive
 */
export const workerExample = `
import { DatabaseConnectionManager, CachedQueryExecutor, DashboardCache } from './hyperdrive-config';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Initialize database manager
    const dbManager = new DatabaseConnectionManager(env);
    const executor = new CachedQueryExecutor(dbManager, env.CACHE);
    
    // Parse user context from request
    const userId = request.headers.get('X-User-ID');
    const portalType = request.headers.get('X-Portal-Type');
    
    if (!userId || !portalType) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Dashboard endpoint example
    if (url.pathname === '/api/dashboard/stats') {
      const cache = new DashboardCache(executor, userId, portalType);
      const stats = await cache.getStats();
      
      return Response.json(stats, {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
        }
      });
    }
    
    // Trending pitches with caching
    if (url.pathname === '/api/pitches/trending') {
      const cache = new DashboardCache(executor, userId, portalType);
      const trending = await cache.getTrendingPitches();
      
      return Response.json(trending, {
        headers: {
          'Cache-Control': 'public, max-age=120, stale-while-revalidate=240'
        }
      });
    }
    
    // Write operation example
    if (url.pathname === '/api/pitches' && request.method === 'POST') {
      const data = await request.json();
      const connection = dbManager.getConnection('write');
      
      const result = await connection\`
        INSERT INTO pitches (title, description, creator_id)
        VALUES (\${data.title}, \${data.description}, \${userId})
        RETURNING *
      \`;
      
      // Invalidate relevant caches
      await executor.invalidate(\`dashboard:\${portalType}:\${userId}\`);
      await executor.invalidate('trending');
      
      return Response.json(result[0]);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
`;

/**
 * Migration helper for Hyperdrive setup
 */
export class HyperdriveMigration {
  /**
   * Create Hyperdrive configuration
   */
  static async createConfig(
    accountId: string,
    databaseUrl: string
  ): Promise<string> {
    // This would call Cloudflare API to create Hyperdrive config
    // For now, returning instructions
    return `
    # Create Hyperdrive configuration via Wrangler CLI:
    
    wrangler hyperdrive create pitchey-db \\
      --connection-string="${databaseUrl}" \\
      --caching-disabled=false
    
    # Then add to wrangler.toml:
    [[hyperdrive]]
    binding = "HYPERDRIVE"
    id = "<config-id-from-create-command>"
    `;
  }
  
  /**
   * Test Hyperdrive connection
   */
  static async testConnection(env: Env): Promise<boolean> {
    try {
      const sql = postgres(env.HYPERDRIVE.connectionString, {
        prepare: false
      });
      
      const result = await sql`SELECT NOW() as current_time`;
      console.log('Hyperdrive connection successful:', result);
      
      return true;
    } catch (error) {
      console.error('Hyperdrive connection failed:', error);
      return false;
    }
  }
}