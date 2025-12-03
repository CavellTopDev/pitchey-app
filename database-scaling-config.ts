/**
 * Database Scaling Configuration
 * Implements read replica routing, connection pooling, and automatic failover
 */

import { Client } from '@neondatabase/serverless';

export interface DatabaseConfig {
  primary: {
    host: string;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
    max_connections: number;
  };
  replicas: Array<{
    id: string;
    region: string;
    host: string;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
    max_connections: number;
    weight: number;
    healthy: boolean;
  }>;
  pooling: {
    min_connections: number;
    max_connections: number;
    idle_timeout: number;
    connection_timeout: number;
    statement_timeout: number;
    query_timeout: number;
  };
  routing: {
    read_preference: 'primary' | 'replica' | 'nearest';
    write_preference: 'primary';
    failover_timeout: number;
    health_check_interval: number;
    retry_attempts: number;
    retry_delay: number;
  };
}

// Production database configuration
export const DATABASE_SCALING_CONFIG: DatabaseConfig = {
  primary: {
    host: 'ep-patient-mode-a50k5xfp.us-east-2.aws.neon.tech',
    database: 'pitchey',
    user: 'pitchey',
    password: process.env.DATABASE_PASSWORD || '',
    ssl: true,
    max_connections: 100
  },
  replicas: [
    {
      id: 'us-west-replica',
      region: 'us-west-2',
      host: 'ep-patient-mode-replica-west.us-west-2.aws.neon.tech',
      database: 'pitchey',
      user: 'pitchey_read',
      password: process.env.REPLICA_PASSWORD || '',
      ssl: true,
      max_connections: 50,
      weight: 30,
      healthy: true
    },
    {
      id: 'eu-replica',
      region: 'eu-central-1',
      host: 'ep-patient-mode-replica-eu.eu-central-1.aws.neon.tech',
      database: 'pitchey',
      user: 'pitchey_read',
      password: process.env.REPLICA_PASSWORD || '',
      ssl: true,
      max_connections: 50,
      weight: 25,
      healthy: true
    },
    {
      id: 'asia-replica',
      region: 'ap-southeast-1',
      host: 'ep-patient-mode-replica-asia.ap-southeast-1.aws.neon.tech',
      database: 'pitchey',
      user: 'pitchey_read',
      password: process.env.REPLICA_PASSWORD || '',
      ssl: true,
      max_connections: 50,
      weight: 20,
      healthy: true
    }
  ],
  pooling: {
    min_connections: 5,
    max_connections: 100,
    idle_timeout: 30000,  // 30 seconds
    connection_timeout: 5000,  // 5 seconds
    statement_timeout: 30000,  // 30 seconds
    query_timeout: 60000  // 60 seconds
  },
  routing: {
    read_preference: 'nearest',
    write_preference: 'primary',
    failover_timeout: 5000,  // 5 seconds
    health_check_interval: 30000,  // 30 seconds
    retry_attempts: 3,
    retry_delay: 1000  // 1 second
  }
};

// Connection pool manager
export class DatabasePoolManager {
  private primaryPool: Client[] = [];
  private replicaPools: Map<string, Client[]> = new Map();
  private activeConnections: Map<string, number> = new Map();
  private healthStatus: Map<string, boolean> = new Map();
  private lastHealthCheck: Map<string, number> = new Map();
  private config: DatabaseConfig;
  
  constructor(config: DatabaseConfig = DATABASE_SCALING_CONFIG) {
    this.config = config;
    this.initializePools();
    this.startHealthChecks();
  }
  
  private async initializePools(): Promise<void> {
    // Initialize primary pool
    for (let i = 0; i < this.config.pooling.min_connections; i++) {
      const client = this.createClient(this.config.primary);
      this.primaryPool.push(client);
    }
    
    // Initialize replica pools
    for (const replica of this.config.replicas) {
      const pool: Client[] = [];
      for (let i = 0; i < this.config.pooling.min_connections; i++) {
        const client = this.createClient(replica);
        pool.push(client);
      }
      this.replicaPools.set(replica.id, pool);
      this.healthStatus.set(replica.id, true);
    }
    
    this.healthStatus.set('primary', true);
  }
  
  private createClient(config: any): Client {
    return new Client({
      host: config.host,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: this.config.pooling.connection_timeout,
      statement_timeout: this.config.pooling.statement_timeout,
      query_timeout: this.config.pooling.query_timeout,
      idle_in_transaction_session_timeout: this.config.pooling.idle_timeout
    });
  }
  
  // Get connection for read queries
  async getReadConnection(region?: string): Promise<Client> {
    const preference = this.config.routing.read_preference;
    
    switch (preference) {
      case 'primary':
        return this.getPrimaryConnection();
        
      case 'replica':
        return this.getReplicaConnection(region);
        
      case 'nearest':
      default:
        return this.getNearestConnection(region);
    }
  }
  
  // Get connection for write queries
  async getWriteConnection(): Promise<Client> {
    return this.getPrimaryConnection();
  }
  
  private async getPrimaryConnection(): Promise<Client> {
    if (!this.healthStatus.get('primary')) {
      throw new Error('Primary database is unhealthy');
    }
    
    const activeCount = this.activeConnections.get('primary') || 0;
    
    // Check if we need to create a new connection
    if (this.primaryPool.length === 0 && activeCount < this.config.primary.max_connections) {
      const client = this.createClient(this.config.primary);
      await client.connect();
      this.activeConnections.set('primary', activeCount + 1);
      return client;
    }
    
    // Get from pool
    const client = this.primaryPool.shift();
    if (!client) {
      throw new Error('No available connections in primary pool');
    }
    
    this.activeConnections.set('primary', activeCount + 1);
    return client;
  }
  
  private async getReplicaConnection(preferredRegion?: string): Promise<Client> {
    // Find healthy replicas
    const healthyReplicas = this.config.replicas.filter(
      r => this.healthStatus.get(r.id)
    );
    
    if (healthyReplicas.length === 0) {
      // Fallback to primary
      console.warn('No healthy replicas, falling back to primary');
      return this.getPrimaryConnection();
    }
    
    // Select replica based on region or weight
    let selectedReplica;
    if (preferredRegion) {
      selectedReplica = healthyReplicas.find(r => r.region === preferredRegion);
    }
    
    if (!selectedReplica) {
      // Weighted random selection
      selectedReplica = this.selectByWeight(healthyReplicas);
    }
    
    const pool = this.replicaPools.get(selectedReplica.id);
    if (!pool || pool.length === 0) {
      const activeCount = this.activeConnections.get(selectedReplica.id) || 0;
      
      if (activeCount < selectedReplica.max_connections) {
        const client = this.createClient(selectedReplica);
        await client.connect();
        this.activeConnections.set(selectedReplica.id, activeCount + 1);
        return client;
      }
      
      throw new Error(`No available connections for replica ${selectedReplica.id}`);
    }
    
    const client = pool.shift()!;
    const activeCount = this.activeConnections.get(selectedReplica.id) || 0;
    this.activeConnections.set(selectedReplica.id, activeCount + 1);
    
    return client;
  }
  
  private async getNearestConnection(region?: string): Promise<Client> {
    // Try to get replica in same region first
    if (region) {
      const localReplica = this.config.replicas.find(
        r => r.region === region && this.healthStatus.get(r.id)
      );
      
      if (localReplica) {
        const pool = this.replicaPools.get(localReplica.id);
        if (pool && pool.length > 0) {
          return pool.shift()!;
        }
      }
    }
    
    // Fallback to any healthy replica
    return this.getReplicaConnection(region);
  }
  
  private selectByWeight(replicas: any[]): any {
    const totalWeight = replicas.reduce((sum, r) => sum + r.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const replica of replicas) {
      currentWeight += replica.weight;
      if (random < currentWeight) {
        return replica;
      }
    }
    
    return replicas[0];
  }
  
  // Release connection back to pool
  async releaseConnection(client: Client, type: 'primary' | string): Promise<void> {
    const activeCount = this.activeConnections.get(type) || 1;
    this.activeConnections.set(type, Math.max(0, activeCount - 1));
    
    if (type === 'primary') {
      if (this.primaryPool.length < this.config.pooling.max_connections) {
        this.primaryPool.push(client);
      } else {
        await client.end();
      }
    } else {
      const pool = this.replicaPools.get(type);
      if (pool && pool.length < this.config.pooling.max_connections) {
        pool.push(client);
      } else {
        await client.end();
      }
    }
  }
  
  // Health checks
  private startHealthChecks(): void {
    setInterval(async () => {
      await this.checkHealth('primary', this.config.primary);
      
      for (const replica of this.config.replicas) {
        await this.checkHealth(replica.id, replica);
      }
    }, this.config.routing.health_check_interval);
  }
  
  private async checkHealth(id: string, config: any): Promise<void> {
    try {
      const client = this.createClient(config);
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      
      this.healthStatus.set(id, true);
      this.lastHealthCheck.set(id, Date.now());
      
    } catch (error) {
      console.error(`Health check failed for ${id}:`, error);
      this.healthStatus.set(id, false);
      this.lastHealthCheck.set(id, Date.now());
      
      // Trigger failover if primary is down
      if (id === 'primary') {
        await this.handlePrimaryFailover();
      }
    }
  }
  
  private async handlePrimaryFailover(): Promise<void> {
    console.error('Primary database failure detected, initiating failover');
    
    // Find the healthiest replica to promote
    const healthyReplicas = this.config.replicas.filter(
      r => this.healthStatus.get(r.id)
    );
    
    if (healthyReplicas.length === 0) {
      console.error('CRITICAL: No healthy databases available');
      return;
    }
    
    // Sort by weight (prefer higher weight replicas)
    const newPrimary = healthyReplicas.sort((a, b) => b.weight - a.weight)[0];
    
    console.log(`Promoting ${newPrimary.id} to primary`);
    
    // Update configuration (in production, this would update DNS or proxy)
    this.config.primary = {
      ...newPrimary,
      max_connections: this.config.primary.max_connections
    };
    
    // Reinitialize primary pool
    this.primaryPool = [];
    for (let i = 0; i < this.config.pooling.min_connections; i++) {
      const client = this.createClient(this.config.primary);
      this.primaryPool.push(client);
    }
  }
  
  // Get pool statistics
  getPoolStats(): any {
    const stats = {
      primary: {
        available: this.primaryPool.length,
        active: this.activeConnections.get('primary') || 0,
        healthy: this.healthStatus.get('primary'),
        lastCheck: this.lastHealthCheck.get('primary')
      },
      replicas: {}
    };
    
    for (const replica of this.config.replicas) {
      const pool = this.replicaPools.get(replica.id);
      stats.replicas[replica.id] = {
        region: replica.region,
        available: pool?.length || 0,
        active: this.activeConnections.get(replica.id) || 0,
        healthy: this.healthStatus.get(replica.id),
        lastCheck: this.lastHealthCheck.get(replica.id)
      };
    }
    
    return stats;
  }
}

// Query router for read/write splitting
export class QueryRouter {
  private poolManager: DatabasePoolManager;
  private queryCache: Map<string, { result: any, timestamp: number }> = new Map();
  private cacheConfig = {
    enabled: true,
    ttl: 60000,  // 1 minute
    maxSize: 1000
  };
  
  constructor(poolManager: DatabasePoolManager) {
    this.poolManager = poolManager;
  }
  
  // Execute query with automatic routing
  async execute(
    query: string,
    params: any[] = [],
    options: {
      type?: 'read' | 'write';
      cache?: boolean;
      region?: string;
      timeout?: number;
    } = {}
  ): Promise<any> {
    const queryType = options.type || this.detectQueryType(query);
    const useCache = options.cache !== false && queryType === 'read';
    
    // Check cache for read queries
    if (useCache && this.cacheConfig.enabled) {
      const cacheKey = this.getCacheKey(query, params);
      const cached = this.queryCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheConfig.ttl) {
        return cached.result;
      }
    }
    
    // Get appropriate connection
    let client: Client;
    let connectionType: string;
    
    if (queryType === 'write') {
      client = await this.poolManager.getWriteConnection();
      connectionType = 'primary';
    } else {
      client = await this.poolManager.getReadConnection(options.region);
      connectionType = options.region || 'auto';
    }
    
    try {
      // Execute query with timeout
      const timeoutMs = options.timeout || 30000;
      const result = await this.executeWithTimeout(client, query, params, timeoutMs);
      
      // Cache successful read queries
      if (useCache && this.cacheConfig.enabled) {
        const cacheKey = this.getCacheKey(query, params);
        this.queryCache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
        
        // Enforce cache size limit
        if (this.queryCache.size > this.cacheConfig.maxSize) {
          const firstKey = this.queryCache.keys().next().value;
          this.queryCache.delete(firstKey);
        }
      }
      
      return result;
      
    } finally {
      // Release connection back to pool
      await this.poolManager.releaseConnection(client, connectionType);
    }
  }
  
  private detectQueryType(query: string): 'read' | 'write' {
    const normalizedQuery = query.trim().toUpperCase();
    
    if (
      normalizedQuery.startsWith('SELECT') ||
      normalizedQuery.startsWith('WITH') ||
      normalizedQuery.startsWith('SHOW') ||
      normalizedQuery.startsWith('DESCRIBE') ||
      normalizedQuery.startsWith('EXPLAIN')
    ) {
      return 'read';
    }
    
    return 'write';
  }
  
  private getCacheKey(query: string, params: any[]): string {
    return `${query}:${JSON.stringify(params)}`;
  }
  
  private async executeWithTimeout(
    client: Client,
    query: string,
    params: any[],
    timeoutMs: number
  ): Promise<any> {
    return Promise.race([
      client.query(query, params),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
      )
    ]);
  }
  
  // Clear query cache
  clearCache(): void {
    this.queryCache.clear();
  }
  
  // Get cache statistics
  getCacheStats(): any {
    return {
      size: this.queryCache.size,
      maxSize: this.cacheConfig.maxSize,
      ttl: this.cacheConfig.ttl,
      enabled: this.cacheConfig.enabled
    };
  }
}

// Database monitoring and alerting
export class DatabaseMonitor {
  private poolManager: DatabasePoolManager;
  private metrics: {
    queries: number;
    errors: number;
    avgLatency: number;
    slowQueries: number;
    cacheHits: number;
    cacheMisses: number;
  } = {
    queries: 0,
    errors: 0,
    avgLatency: 0,
    slowQueries: 0,
    cacheHits: 0,
    cacheMisses: 0
  };
  
  private alerts: Array<{
    type: string;
    message: string;
    timestamp: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> = [];
  
  constructor(poolManager: DatabasePoolManager) {
    this.poolManager = poolManager;
    this.startMonitoring();
  }
  
  private startMonitoring(): void {
    // Monitor pool health
    setInterval(() => {
      const stats = this.poolManager.getPoolStats();
      
      // Check primary health
      if (!stats.primary.healthy) {
        this.addAlert('critical', 'Primary database is unhealthy');
      }
      
      // Check replica health
      let unhealthyReplicas = 0;
      for (const [id, replicaStats] of Object.entries(stats.replicas as any)) {
        if (!replicaStats.healthy) {
          unhealthyReplicas++;
        }
        
        // Check connection pool exhaustion
        if (replicaStats.available === 0 && replicaStats.active > 40) {
          this.addAlert('high', `Connection pool near exhaustion for ${id}`);
        }
      }
      
      if (unhealthyReplicas > 1) {
        this.addAlert('high', `${unhealthyReplicas} replicas are unhealthy`);
      }
      
      // Check for high error rate
      if (this.metrics.queries > 0) {
        const errorRate = (this.metrics.errors / this.metrics.queries) * 100;
        if (errorRate > 5) {
          this.addAlert('high', `High database error rate: ${errorRate.toFixed(2)}%`);
        }
      }
      
      // Check for slow queries
      if (this.metrics.avgLatency > 1000) {
        this.addAlert('medium', `High average query latency: ${this.metrics.avgLatency}ms`);
      }
      
    }, 30000);  // Every 30 seconds
  }
  
  private addAlert(severity: 'low' | 'medium' | 'high' | 'critical', message: string): void {
    this.alerts.push({
      type: 'database',
      message,
      timestamp: Date.now(),
      severity
    });
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
    
    // Log critical alerts
    if (severity === 'critical') {
      console.error(`CRITICAL DATABASE ALERT: ${message}`);
    }
  }
  
  // Record query metrics
  recordQuery(latency: number, success: boolean, cached: boolean = false): void {
    this.metrics.queries++;
    
    if (!success) {
      this.metrics.errors++;
    }
    
    if (cached) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
    
    if (latency > 5000) {
      this.metrics.slowQueries++;
    }
    
    // Update average latency (simplified moving average)
    this.metrics.avgLatency = 
      (this.metrics.avgLatency * (this.metrics.queries - 1) + latency) / 
      this.metrics.queries;
  }
  
  // Get monitoring dashboard data
  getDashboard(): any {
    const stats = this.poolManager.getPoolStats();
    
    return {
      pools: stats,
      metrics: this.metrics,
      alerts: this.alerts.slice(-10),  // Last 10 alerts
      health: {
        primary: stats.primary.healthy,
        replicas: Object.values(stats.replicas).filter((r: any) => r.healthy).length,
        totalReplicas: Object.keys(stats.replicas).length
      },
      performance: {
        errorRate: this.metrics.queries > 0 ? 
          (this.metrics.errors / this.metrics.queries * 100).toFixed(2) : 0,
        cacheHitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0 ?
          (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100).toFixed(2) : 0,
        avgLatency: this.metrics.avgLatency.toFixed(2),
        slowQueryRate: this.metrics.queries > 0 ?
          (this.metrics.slowQueries / this.metrics.queries * 100).toFixed(2) : 0
      }
    };
  }
}

// Export configured instances
export const poolManager = new DatabasePoolManager(DATABASE_SCALING_CONFIG);
export const queryRouter = new QueryRouter(poolManager);
export const dbMonitor = new DatabaseMonitor(poolManager);

// Helper function for easy query execution
export async function query(
  sql: string,
  params?: any[],
  options?: any
): Promise<any> {
  return queryRouter.execute(sql, params, options);
}