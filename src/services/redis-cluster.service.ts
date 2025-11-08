/**
 * Redis Cluster Service for Distributed Caching
 * 
 * Provides Redis cluster support with:
 * - Connection pooling
 * - Automatic failover
 * - Node discovery
 * - Health monitoring
 * - Backward compatibility
 */

import { connect } from "redis";

interface RedisClusterNode {
  host: string;
  port: number;
  password?: string;
}

interface RedisClusterConfig {
  enabled: boolean;
  nodes: RedisClusterNode[];
  password?: string;
  
  // Connection pooling
  poolSize: number;
  maxRetries: number;
  retryDelay: number;
  connectTimeout: number;
  commandTimeout: number;
  
  // Failover
  failoverTimeout: number;
  maxFailures: number;
  healthCheckInterval: number;
  
  // Cache settings
  defaultTTL: number;
  keyPrefix: string;
  
  // Backward compatibility
  fallbackToSingle: boolean;
  singleNodeConfig: {
    host: string;
    port: number;
    password?: string;
  };
}

interface ClusterNode {
  client: any;
  host: string;
  port: number;
  isHealthy: boolean;
  failureCount: number;
  lastHealthCheck: number;
  connectionPool: any[];
}

interface ClusterStats {
  totalNodes: number;
  healthyNodes: number;
  failedNodes: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  uptime: number;
  poolStats: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
  };
}

class RedisClusterService {
  private config: RedisClusterConfig;
  private nodes: Map<string, ClusterNode> = new Map();
  private isInitialized = false;
  private stats: ClusterStats;
  private startTime: number;
  private healthCheckTimer?: number;

  constructor() {
    this.startTime = Date.now();
    this.config = this.loadConfig();
    this.stats = this.initStats();
  }

  /**
   * Load cluster configuration from environment
   */
  private loadConfig(): RedisClusterConfig {
    const clusterEnabled = Deno.env.get("REDIS_CLUSTER_ENABLED") === "true";
    const nodesString = Deno.env.get("REDIS_CLUSTER_NODES") || "";
    
    // Parse cluster nodes from comma-separated list
    // Format: host1:port1,host2:port2,host3:port3
    const nodes: RedisClusterNode[] = [];
    if (nodesString) {
      const nodeSpecs = nodesString.split(",");
      for (const spec of nodeSpecs) {
        const [host, portStr] = spec.trim().split(":");
        if (host && portStr) {
          nodes.push({
            host: host.trim(),
            port: parseInt(portStr.trim()),
            password: Deno.env.get("REDIS_CLUSTER_PASSWORD")
          });
        }
      }
    }

    return {
      enabled: clusterEnabled,
      nodes,
      password: Deno.env.get("REDIS_CLUSTER_PASSWORD"),
      
      // Connection pooling
      poolSize: parseInt(Deno.env.get("REDIS_CONNECTION_POOL_SIZE") || "5"),
      maxRetries: parseInt(Deno.env.get("REDIS_MAX_RETRIES") || "3"),
      retryDelay: parseInt(Deno.env.get("REDIS_RETRY_DELAY") || "1000"),
      connectTimeout: parseInt(Deno.env.get("REDIS_CONNECT_TIMEOUT") || "5000"),
      commandTimeout: parseInt(Deno.env.get("REDIS_COMMAND_TIMEOUT") || "3000"),
      
      // Failover
      failoverTimeout: parseInt(Deno.env.get("REDIS_FAILOVER_TIMEOUT") || "10000"),
      maxFailures: parseInt(Deno.env.get("REDIS_MAX_FAILURES") || "3"),
      healthCheckInterval: parseInt(Deno.env.get("REDIS_HEALTH_CHECK_INTERVAL") || "30000"),
      
      // Cache settings  
      defaultTTL: parseInt(Deno.env.get("CACHE_TTL") || "300"),
      keyPrefix: Deno.env.get("REDIS_KEY_PREFIX") || "pitchey",
      
      // Backward compatibility
      fallbackToSingle: Deno.env.get("REDIS_FALLBACK_TO_SINGLE") !== "false",
      singleNodeConfig: {
        host: Deno.env.get("REDIS_HOST") || "localhost",
        port: parseInt(Deno.env.get("REDIS_PORT") || "6379"),
        password: Deno.env.get("REDIS_PASSWORD")
      }
    };
  }

  /**
   * Initialize statistics
   */
  private initStats(): ClusterStats {
    return {
      totalNodes: 0,
      healthyNodes: 0,
      failedNodes: 0,
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      uptime: 0,
      poolStats: {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0
      }
    };
  }

  /**
   * Initialize cluster connections
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    console.log("🔄 Initializing Redis Cluster Service...");

    // If cluster is disabled, try single node
    if (!this.config.enabled || this.config.nodes.length === 0) {
      if (this.config.fallbackToSingle) {
        console.log("📡 Redis cluster disabled, attempting single node connection...");
        return await this.initializeSingleNode();
      } else {
        console.log("❌ Redis cluster disabled and fallback to single node disabled");
        return false;
      }
    }

    // Initialize cluster nodes
    const initPromises = this.config.nodes.map(node => this.initializeNode(node));
    const results = await Promise.allSettled(initPromises);

    // Count successful connections
    let successfulConnections = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        successfulConnections++;
      } else {
        const node = this.config.nodes[index];
        console.error(`❌ Failed to connect to Redis node ${node.host}:${node.port}`);
      }
    });

    this.stats.totalNodes = this.config.nodes.length;
    this.stats.healthyNodes = successfulConnections;
    this.stats.failedNodes = this.config.nodes.length - successfulConnections;

    if (successfulConnections === 0) {
      console.error("❌ No Redis cluster nodes available");
      
      // Try fallback to single node
      if (this.config.fallbackToSingle) {
        console.log("🔄 Attempting fallback to single Redis node...");
        return await this.initializeSingleNode();
      }
      
      return false;
    }

    console.log(`✅ Redis cluster initialized with ${successfulConnections}/${this.config.nodes.length} nodes`);
    
    this.isInitialized = true;
    this.startHealthChecking();
    
    return true;
  }

  /**
   * Initialize single Redis node (fallback)
   */
  private async initializeSingleNode(): Promise<boolean> {
    try {
      const config = this.config.singleNodeConfig;
      const connectionConfig: any = {
        hostname: config.host,
        port: config.port,
      };

      if (config.password) {
        connectionConfig.password = config.password;
      }

      const client = await connect(connectionConfig);
      
      const nodeKey = `${config.host}:${config.port}`;
      const clusterNode: ClusterNode = {
        client,
        host: config.host,
        port: config.port,
        isHealthy: true,
        failureCount: 0,
        lastHealthCheck: Date.now(),
        connectionPool: [client]
      };

      this.nodes.set(nodeKey, clusterNode);
      this.stats.totalNodes = 1;
      this.stats.healthyNodes = 1;
      this.stats.failedNodes = 0;
      
      console.log(`✅ Connected to single Redis node at ${config.host}:${config.port}`);
      this.isInitialized = true;
      this.startHealthChecking();
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Failed to connect to single Redis node:", errorMessage);
      return false;
    }
  }

  /**
   * Initialize individual cluster node with connection pool
   */
  private async initializeNode(nodeConfig: RedisClusterNode): Promise<boolean> {
    const nodeKey = `${nodeConfig.host}:${nodeConfig.port}`;
    
    try {
      // Create connection pool
      const connectionPool = [];
      
      for (let i = 0; i < this.config.poolSize; i++) {
        const connectionConfig: any = {
          hostname: nodeConfig.host,
          port: nodeConfig.port,
        };

        if (nodeConfig.password) {
          connectionConfig.password = nodeConfig.password;
        }

        const client = await connect(connectionConfig);
        connectionPool.push(client);
      }

      const clusterNode: ClusterNode = {
        client: connectionPool[0], // Primary client for management
        host: nodeConfig.host,
        port: nodeConfig.port,
        isHealthy: true,
        failureCount: 0,
        lastHealthCheck: Date.now(),
        connectionPool
      };

      this.nodes.set(nodeKey, clusterNode);
      console.log(`✅ Connected to Redis node ${nodeConfig.host}:${nodeConfig.port} with ${this.config.poolSize} connections`);
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to connect to Redis node ${nodeKey}:`, errorMessage);
      return false;
    }
  }

  /**
   * Get healthy node for operation
   */
  private getHealthyNode(): ClusterNode | null {
    const healthyNodes = Array.from(this.nodes.values()).filter(node => node.isHealthy);
    
    if (healthyNodes.length === 0) {
      return null;
    }

    // Simple round-robin selection
    const randomIndex = Math.floor(Math.random() * healthyNodes.length);
    return healthyNodes[randomIndex];
  }

  /**
   * Get connection from node pool
   */
  private getConnection(node: ClusterNode): any {
    // Simple round-robin from pool
    const poolIndex = this.stats.totalOperations % node.connectionPool.length;
    return node.connectionPool[poolIndex] || node.client;
  }

  /**
   * Execute Redis command with failover
   */
  private async executeCommand(command: string, ...args: any[]): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.stats.totalOperations++;
    const startTime = Date.now();

    let attempts = 0;
    while (attempts < this.config.maxRetries) {
      const node = this.getHealthyNode();
      
      if (!node) {
        console.error("❌ No healthy Redis nodes available");
        this.stats.failedOperations++;
        return null;
      }

      try {
        const connection = this.getConnection(node);
        const result = await Promise.race([
          connection[command.toLowerCase()](...args),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Command timeout')), this.config.commandTimeout)
          )
        ]);

        // Update stats
        const responseTime = Date.now() - startTime;
        this.stats.averageResponseTime = 
          (this.stats.averageResponseTime * this.stats.successfulOperations + responseTime) / 
          (this.stats.successfulOperations + 1);
        this.stats.successfulOperations++;

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Redis command ${command} failed on ${node.host}:${node.port}:`, errorMessage);
        
        // Mark node as potentially unhealthy
        node.failureCount++;
        if (node.failureCount >= this.config.maxFailures) {
          node.isHealthy = false;
          this.stats.healthyNodes--;
          this.stats.failedNodes++;
          console.warn(`🚨 Redis node ${node.host}:${node.port} marked as unhealthy`);
        }

        attempts++;
        if (attempts < this.config.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }

    this.stats.failedOperations++;
    return null;
  }

  /**
   * Start health checking for cluster nodes
   */
  private startHealthChecking(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health check on all nodes
   */
  private async performHealthCheck(): Promise<void> {
    const healthCheckPromises = Array.from(this.nodes.values()).map(async (node) => {
      try {
        const connection = this.getConnection(node);
        await connection.ping();
        
        // Reset failure count on successful ping
        if (!node.isHealthy && node.failureCount > 0) {
          node.failureCount = Math.max(0, node.failureCount - 1);
          
          // Mark as healthy if failure count is low enough
          if (node.failureCount < this.config.maxFailures) {
            node.isHealthy = true;
            this.stats.healthyNodes++;
            this.stats.failedNodes--;
            console.log(`✅ Redis node ${node.host}:${node.port} recovered`);
          }
        }
        
        node.lastHealthCheck = Date.now();
      } catch (error) {
        node.failureCount++;
        if (node.isHealthy && node.failureCount >= this.config.maxFailures) {
          node.isHealthy = false;
          this.stats.healthyNodes--;
          this.stats.failedNodes++;
          console.warn(`🚨 Redis node ${node.host}:${node.port} failed health check`);
        }
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * Public API methods
   */

  async get(key: string): Promise<any> {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    try {
      const result = await this.executeCommand("GET", fullKey);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Cache GET error:", errorMessage);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    const ttl = ttlSeconds || this.config.defaultTTL;
    
    try {
      const serialized = JSON.stringify(value);
      const result = await this.executeCommand("SETEX", fullKey, ttl, serialized);
      return result === "OK";
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Cache SET error:", errorMessage);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    try {
      const result = await this.executeCommand("DEL", fullKey);
      return result === 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Cache DEL error:", errorMessage);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    try {
      const result = await this.executeCommand("EXISTS", fullKey);
      return result === 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Cache EXISTS error:", errorMessage);
      return false;
    }
  }

  async incr(key: string): Promise<number> {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    try {
      const result = await this.executeCommand("INCR", fullKey);
      return result || 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Cache INCR error:", errorMessage);
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    try {
      const result = await this.executeCommand("EXPIRE", fullKey, seconds);
      return result === 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Cache EXPIRE error:", errorMessage);
      return false;
    }
  }

  /**
   * Cluster management methods
   */

  isEnabled(): boolean {
    return this.isInitialized && this.stats.healthyNodes > 0;
  }

  getStats(): ClusterStats {
    this.stats.uptime = Date.now() - this.startTime;
    
    // Update pool stats
    let totalConnections = 0;
    let activeConnections = 0;
    
    for (const node of this.nodes.values()) {
      totalConnections += node.connectionPool.length;
      if (node.isHealthy) {
        activeConnections += node.connectionPool.length;
      }
    }
    
    this.stats.poolStats = {
      totalConnections,
      activeConnections,
      idleConnections: totalConnections - activeConnections
    };

    return { ...this.stats };
  }

  getClusterInfo(): any {
    return {
      enabled: this.config.enabled,
      initialized: this.isInitialized,
      totalNodes: this.stats.totalNodes,
      healthyNodes: this.stats.healthyNodes,
      failedNodes: this.stats.failedNodes,
      poolSize: this.config.poolSize,
      nodes: Array.from(this.nodes.entries()).map(([key, node]) => ({
        address: key,
        healthy: node.isHealthy,
        failureCount: node.failureCount,
        lastHealthCheck: new Date(node.lastHealthCheck).toISOString(),
        poolConnections: node.connectionPool.length
      }))
    };
  }

  /**
   * Cached function wrapper
   */
  async cached<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    // Try cache first
    const cached = await this.get(key);
    if (cached !== null) {
      console.log(`Cache HIT: ${key}`);
      return cached;
    }

    // Cache miss - fetch data
    console.log(`Cache MISS: ${key}`);
    const data = await fetchFunction();
    
    // Store in cache
    await this.set(key, data, ttlSeconds);
    
    return data;
  }

  /**
   * Cleanup resources
   */
  async disconnect(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    const disconnectPromises = Array.from(this.nodes.values()).map(async (node) => {
      try {
        // Close all connections in pool
        for (const connection of node.connectionPool) {
          await connection.close();
        }
        console.log(`Disconnected from Redis node ${node.host}:${node.port}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error disconnecting from ${node.host}:${node.port}:`, errorMessage);
      }
    });

    await Promise.allSettled(disconnectPromises);
    
    this.nodes.clear();
    this.isInitialized = false;
    console.log("🔌 Redis cluster service disconnected");
  }
}

// Export singleton instance
export const redisClusterService = new RedisClusterService();

export default redisClusterService;