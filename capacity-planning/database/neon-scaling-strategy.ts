/**
 * Neon Database Scaling and Sharding Strategy
 * Handles database partitioning, read replicas, and connection pooling
 */

import { sql } from 'drizzle-orm';

export interface ShardConfig {
  shardId: string;
  region: string;
  connectionString: string;
  minConnections: number;
  maxConnections: number;
  dataRange: {
    startKey: string;
    endKey: string;
  };
}

export interface PartitionStrategy {
  type: 'range' | 'hash' | 'list' | 'composite';
  key: string;
  partitions: number;
  subPartitions?: number;
}

export interface ReadReplicaConfig {
  region: string;
  endpoint: string;
  weight: number; // Load balancing weight
  maxLag: number; // Maximum replication lag in ms
}

export class NeonScalingStrategy {
  // Neon compute unit specifications
  private static readonly COMPUTE_SIZES = {
    '0.25': { cpu: 0.25, ram: 1, connections: 25, price: 19 },
    '0.5': { cpu: 0.5, ram: 2, connections: 50, price: 39 },
    '1': { cpu: 1, ram: 4, connections: 100, price: 79 },
    '2': { cpu: 2, ram: 8, connections: 200, price: 159 },
    '4': { cpu: 4, ram: 16, connections: 400, price: 319 },
    '8': { cpu: 8, ram: 32, connections: 800, price: 639 }
  };

  // Sharding strategies for different tables
  private static readonly SHARDING_STRATEGIES = {
    users: {
      type: 'hash' as const,
      key: 'user_id',
      partitions: 16,
      description: 'Hash-based sharding on user_id for even distribution'
    },
    pitches: {
      type: 'composite' as const,
      key: 'created_at',
      partitions: 12, // Monthly partitions
      subPartitions: 4, // By status
      description: 'Time-range partitioning with status subpartitions'
    },
    messages: {
      type: 'range' as const,
      key: 'timestamp',
      partitions: 365, // Daily partitions
      description: 'Time-based partitioning for efficient purging'
    },
    analytics: {
      type: 'range' as const,
      key: 'event_date',
      partitions: 12,
      description: 'Monthly partitions for analytics data'
    }
  };

  /**
   * Calculate optimal compute size based on workload
   */
  static calculateOptimalComputeSize(
    connections: number,
    cpuUsage: number,
    memoryGB: number
  ): string {
    for (const [size, specs] of Object.entries(this.COMPUTE_SIZES)) {
      if (
        specs.connections >= connections &&
        specs.cpu >= cpuUsage &&
        specs.ram >= memoryGB
      ) {
        return size;
      }
    }
    return '8'; // Maximum available
  }

  /**
   * Generate sharding configuration for a given scale
   */
  static generateShardingConfig(
    totalUsers: number,
    regions: string[]
  ): ShardConfig[] {
    const shards: ShardConfig[] = [];
    const usersPerShard = 100000; // 100K users per shard
    const numShards = Math.ceil(totalUsers / usersPerShard);
    
    for (let i = 0; i < numShards; i++) {
      const region = regions[i % regions.length];
      const shardId = `shard-${region}-${i.toString().padStart(3, '0')}`;
      
      shards.push({
        shardId,
        region,
        connectionString: `postgres://neon:${shardId}@${region}.neon.tech/pitchey-${shardId}`,
        minConnections: 10,
        maxConnections: 100,
        dataRange: {
          startKey: this.generateShardKey(i * usersPerShard),
          endKey: this.generateShardKey((i + 1) * usersPerShard - 1)
        }
      });
    }
    
    return shards;
  }

  /**
   * Generate consistent hash for shard key
   */
  private static generateShardKey(value: number): string {
    // Simple hash function for demonstration
    const hash = value.toString(16).padStart(8, '0');
    return hash;
  }

  /**
   * Create partition DDL for a table
   */
  static generatePartitionDDL(
    tableName: string,
    strategy: PartitionStrategy
  ): string {
    switch (strategy.type) {
      case 'range':
        return this.generateRangePartitionDDL(tableName, strategy);
      case 'hash':
        return this.generateHashPartitionDDL(tableName, strategy);
      case 'list':
        return this.generateListPartitionDDL(tableName, strategy);
      case 'composite':
        return this.generateCompositePartitionDDL(tableName, strategy);
      default:
        throw new Error(`Unknown partition type: ${strategy.type}`);
    }
  }

  /**
   * Generate range partition DDL
   */
  private static generateRangePartitionDDL(
    tableName: string,
    strategy: PartitionStrategy
  ): string {
    const ddl: string[] = [];
    
    // Create parent table
    ddl.push(`
CREATE TABLE ${tableName} (
  -- table columns here
) PARTITION BY RANGE (${strategy.key});
`);
    
    // Create partitions
    const currentDate = new Date();
    for (let i = 0; i < strategy.partitions; i++) {
      const partitionDate = new Date(currentDate);
      partitionDate.setMonth(partitionDate.getMonth() + i);
      
      const startDate = partitionDate.toISOString().split('T')[0];
      const endDate = new Date(partitionDate);
      endDate.setMonth(endDate.getMonth() + 1);
      const endDateStr = endDate.toISOString().split('T')[0];
      
      ddl.push(`
CREATE TABLE ${tableName}_p${i} PARTITION OF ${tableName}
FOR VALUES FROM ('${startDate}') TO ('${endDateStr}');
`);
    }
    
    // Create indexes on partitions
    ddl.push(`
-- Create indexes on each partition
DO $$
DECLARE
  partition_name TEXT;
BEGIN
  FOR partition_name IN 
    SELECT tablename FROM pg_tables 
    WHERE tablename LIKE '${tableName}_p%'
  LOOP
    EXECUTE format('CREATE INDEX idx_%s_${strategy.key} ON %I (${strategy.key})', 
                   partition_name, partition_name);
  END LOOP;
END $$;
`);
    
    return ddl.join('\n');
  }

  /**
   * Generate hash partition DDL
   */
  private static generateHashPartitionDDL(
    tableName: string,
    strategy: PartitionStrategy
  ): string {
    const ddl: string[] = [];
    
    ddl.push(`
CREATE TABLE ${tableName} (
  -- table columns here
) PARTITION BY HASH (${strategy.key});
`);
    
    for (let i = 0; i < strategy.partitions; i++) {
      ddl.push(`
CREATE TABLE ${tableName}_p${i} PARTITION OF ${tableName}
FOR VALUES WITH (modulus ${strategy.partitions}, remainder ${i});
`);
    }
    
    return ddl.join('\n');
  }

  /**
   * Generate list partition DDL
   */
  private static generateListPartitionDDL(
    tableName: string,
    strategy: PartitionStrategy
  ): string {
    // Implementation for list partitioning
    return `
CREATE TABLE ${tableName} (
  -- table columns here
) PARTITION BY LIST (${strategy.key});

-- Add list partitions based on specific values
CREATE TABLE ${tableName}_active PARTITION OF ${tableName}
FOR VALUES IN ('active', 'pending');

CREATE TABLE ${tableName}_inactive PARTITION OF ${tableName}
FOR VALUES IN ('inactive', 'archived');
`;
  }

  /**
   * Generate composite partition DDL
   */
  private static generateCompositePartitionDDL(
    tableName: string,
    strategy: PartitionStrategy
  ): string {
    const ddl: string[] = [];
    
    ddl.push(`
CREATE TABLE ${tableName} (
  -- table columns here
) PARTITION BY RANGE (${strategy.key});
`);
    
    // Create main partitions
    for (let i = 0; i < strategy.partitions; i++) {
      const partitionName = `${tableName}_p${i}`;
      ddl.push(`
CREATE TABLE ${partitionName} PARTITION OF ${tableName}
FOR VALUES FROM (...) TO (...)
PARTITION BY HASH (status);
`);
      
      // Create subpartitions
      if (strategy.subPartitions) {
        for (let j = 0; j < strategy.subPartitions; j++) {
          ddl.push(`
CREATE TABLE ${partitionName}_sp${j} PARTITION OF ${partitionName}
FOR VALUES WITH (modulus ${strategy.subPartitions}, remainder ${j});
`);
        }
      }
    }
    
    return ddl.join('\n');
  }

  /**
   * Configure read replicas for load distribution
   */
  static configureReadReplicas(
    primaryRegion: string,
    replicaRegions: string[],
    readWriteRatio: number
  ): ReadReplicaConfig[] {
    const replicas: ReadReplicaConfig[] = [];
    
    // Calculate weights based on read/write ratio
    const totalReads = readWriteRatio;
    const weightPerReplica = totalReads / (replicaRegions.length + 1); // +1 for primary
    
    // Add primary as a read replica with lower weight
    replicas.push({
      region: primaryRegion,
      endpoint: `${primaryRegion}-primary.neon.tech`,
      weight: weightPerReplica * 0.3, // 30% of reads to primary
      maxLag: 0 // No lag on primary
    });
    
    // Add read replicas
    for (const region of replicaRegions) {
      replicas.push({
        region,
        endpoint: `${region}-replica.neon.tech`,
        weight: weightPerReplica * (0.7 / replicaRegions.length),
        maxLag: 1000 // 1 second max lag
      });
    }
    
    return replicas;
  }

  /**
   * Generate connection pooling configuration
   */
  static generatePoolerConfig(
    maxConnections: number,
    expectedConcurrency: number
  ): {
    poolMode: 'session' | 'transaction' | 'statement';
    poolSize: number;
    maxClientConn: number;
    defaultPoolSize: number;
    minPoolSize: number;
    reservePoolSize: number;
    reservePoolTimeout: number;
    maxDbConnections: number;
    statsPeriod: number;
  } {
    // Calculate optimal pool settings
    const poolSize = Math.min(maxConnections, expectedConcurrency * 2);
    const minPoolSize = Math.max(5, poolSize * 0.25);
    const reservePoolSize = Math.max(2, poolSize * 0.1);
    
    return {
      poolMode: 'transaction', // Best for serverless
      poolSize,
      maxClientConn: expectedConcurrency * 3,
      defaultPoolSize: poolSize,
      minPoolSize,
      reservePoolSize,
      reservePoolTimeout: 5,
      maxDbConnections: maxConnections,
      statsPeriod: 60
    };
  }

  /**
   * Generate auto-vacuum configuration for partitioned tables
   */
  static generateAutoVacuumConfig(
    tableSize: number, // in GB
    writeRate: number // writes per second
  ): string {
    const vacuumThreshold = Math.max(50, writeRate * 60); // 1 minute of writes
    const analyzeThreshold = vacuumThreshold * 0.1;
    const vacuumScaleFactor = tableSize > 100 ? 0.01 : 0.1; // Smaller factor for large tables
    
    return `
-- Auto-vacuum configuration for high-throughput tables
ALTER TABLE pitches SET (
  autovacuum_vacuum_threshold = ${vacuumThreshold},
  autovacuum_analyze_threshold = ${analyzeThreshold},
  autovacuum_vacuum_scale_factor = ${vacuumScaleFactor},
  autovacuum_analyze_scale_factor = ${vacuumScaleFactor * 0.5},
  autovacuum_vacuum_cost_delay = 10,
  autovacuum_vacuum_cost_limit = 1000
);

-- Aggressive settings for time-series data
ALTER TABLE analytics SET (
  autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_threshold = 500,
  autovacuum_vacuum_scale_factor = 0,
  autovacuum_analyze_scale_factor = 0,
  autovacuum_freeze_min_age = 50000000,
  autovacuum_freeze_max_age = 100000000
);
`;
  }

  /**
   * Calculate database size projections
   */
  static projectDatabaseGrowth(
    currentSizeGB: number,
    dailyGrowthRate: number,
    retentionDays: number,
    compressionRatio: number = 0.3
  ): Array<{
    day: number;
    sizeGB: number;
    compressedSizeGB: number;
    partitionsNeeded: number;
    estimatedCost: number;
  }> {
    const projections = [];
    
    for (let day = 0; day <= 365; day += 30) {
      const growthFactor = Math.pow(1 + dailyGrowthRate, day);
      const totalSize = currentSizeGB * growthFactor;
      const activeSize = totalSize * (Math.min(retentionDays, day) / 365);
      const compressedSize = activeSize * compressionRatio;
      const partitionsNeeded = Math.ceil(activeSize / 100); // 100GB per partition
      
      // Neon pricing: $0.09 per GB/month
      const storageCost = compressedSize * 0.09;
      const computeCost = this.COMPUTE_SIZES['1'].price * Math.ceil(partitionsNeeded / 10);
      
      projections.push({
        day,
        sizeGB: activeSize,
        compressedSizeGB: compressedSize,
        partitionsNeeded,
        estimatedCost: storageCost + computeCost
      });
    }
    
    return projections;
  }
}

// Export utility functions
export function calculateShardForUser(userId: string, numShards: number): number {
  // Simple hash-based sharding
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % numShards;
}

export function generateMigrationScript(fromShards: number, toShards: number): string {
  return `
-- Migration script from ${fromShards} to ${toShards} shards
BEGIN;

-- Create new shard tables
${Array.from({ length: toShards }, (_, i) => `
CREATE TABLE users_shard_${i} (LIKE users INCLUDING ALL);
`).join('')}

-- Migrate data with consistent hashing
INSERT INTO users_shard_0 SELECT * FROM users WHERE mod(hashtext(user_id::text), ${toShards}) = 0;
${Array.from({ length: toShards - 1 }, (_, i) => `
INSERT INTO users_shard_${i + 1} SELECT * FROM users WHERE mod(hashtext(user_id::text), ${toShards}) = ${i + 1};
`).join('')}

-- Verify migration
SELECT 'Original count:', count(*) FROM users
UNION ALL
SELECT 'New shards count:', sum(count) FROM (
  ${Array.from({ length: toShards }, (_, i) => `
  SELECT count(*) as count FROM users_shard_${i}
  ${i < toShards - 1 ? 'UNION ALL' : ''}
  `).join('')}
) as shard_counts;

COMMIT;
`;
}