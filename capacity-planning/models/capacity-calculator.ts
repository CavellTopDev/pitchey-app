/**
 * Capacity Planning Calculator for Pitchey Platform
 * Scales from current usage to 1M+ daily active users
 */

export interface UserProfile {
  type: 'creator' | 'investor' | 'production';
  actionsPerDay: number;
  dataVolumeGB: number;
  sessionDurationMinutes: number;
}

export interface WorkloadMetrics {
  readWriteRatio: number;
  peakHourMultiplier: number;
  cacheHitRate: number;
  avgRequestSizeKB: number;
  avgResponseSizeKB: number;
  avgProcessingTimeMs: number;
}

export interface ResourceRequirements {
  computeUnits: number;
  memoryGB: number;
  storageGB: number;
  bandwidthGbps: number;
  dbConnections: number;
  cacheSize: number;
}

export class CapacityCalculator {
  // Cloudflare Workers Limits
  private static readonly WORKER_CPU_LIMIT_MS = 10;
  private static readonly WORKER_MEMORY_MB = 128;
  private static readonly WORKER_SUBREQUESTS = 50;
  private static readonly WORKER_REQUEST_SIZE_MB = 100;
  
  // Neon Database Limits (per compute unit)
  private static readonly NEON_CONNECTIONS_PER_CU = 100;
  private static readonly NEON_IOPS_PER_CU = 3000;
  private static readonly NEON_THROUGHPUT_MBPS = 100;
  
  // User profiles based on analysis
  private static readonly USER_PROFILES: Record<string, UserProfile> = {
    creator: {
      type: 'creator',
      actionsPerDay: 50,
      dataVolumeGB: 0.5,
      sessionDurationMinutes: 45
    },
    investor: {
      type: 'investor',
      actionsPerDay: 30,
      dataVolumeGB: 0.1,
      sessionDurationMinutes: 30
    },
    production: {
      type: 'production',
      actionsPerDay: 40,
      dataVolumeGB: 0.2,
      sessionDurationMinutes: 35
    }
  };

  // Workload characteristics
  private static readonly WORKLOAD: WorkloadMetrics = {
    readWriteRatio: 10, // 10:1 read to write
    peakHourMultiplier: 3.5,
    cacheHitRate: 0.85,
    avgRequestSizeKB: 5,
    avgResponseSizeKB: 25,
    avgProcessingTimeMs: 3
  };

  /**
   * Calculate resource requirements for given DAU
   */
  static calculateRequirements(
    dailyActiveUsers: number,
    userDistribution = { creator: 0.6, investor: 0.3, production: 0.1 }
  ): ResourceRequirements {
    // Calculate requests per second
    const totalActionsPerDay = this.calculateTotalActions(dailyActiveUsers, userDistribution);
    const avgRequestsPerSecond = totalActionsPerDay / 86400;
    const peakRequestsPerSecond = avgRequestsPerSecond * this.WORKLOAD.peakHourMultiplier;
    
    // Calculate data volume
    const totalDataVolumeGB = this.calculateDataVolume(dailyActiveUsers, userDistribution);
    
    // Compute requirements
    const computeUnits = this.calculateComputeUnits(peakRequestsPerSecond);
    const memoryGB = this.calculateMemoryRequirements(peakRequestsPerSecond, dailyActiveUsers);
    const storageGB = this.calculateStorageRequirements(dailyActiveUsers, totalDataVolumeGB);
    const bandwidthGbps = this.calculateBandwidthRequirements(peakRequestsPerSecond);
    const dbConnections = this.calculateDbConnections(peakRequestsPerSecond);
    const cacheSize = this.calculateCacheSize(dailyActiveUsers, totalDataVolumeGB);
    
    return {
      computeUnits,
      memoryGB,
      storageGB,
      bandwidthGbps,
      dbConnections,
      cacheSize
    };
  }

  /**
   * Calculate total actions per day
   */
  private static calculateTotalActions(
    dau: number,
    distribution: Record<string, number>
  ): number {
    let total = 0;
    for (const [type, percentage] of Object.entries(distribution)) {
      const profile = this.USER_PROFILES[type];
      total += dau * percentage * profile.actionsPerDay;
    }
    return total;
  }

  /**
   * Calculate total data volume
   */
  private static calculateDataVolume(
    dau: number,
    distribution: Record<string, number>
  ): number {
    let total = 0;
    for (const [type, percentage] of Object.entries(distribution)) {
      const profile = this.USER_PROFILES[type];
      total += dau * percentage * profile.dataVolumeGB;
    }
    return total;
  }

  /**
   * Calculate compute units needed
   */
  private static calculateComputeUnits(peakRps: number): number {
    // Workers can handle ~1000 req/s per instance with 10ms CPU limit
    const workerInstances = Math.ceil(peakRps / 1000);
    
    // Add 30% buffer for safety
    return Math.ceil(workerInstances * 1.3);
  }

  /**
   * Calculate memory requirements
   */
  private static calculateMemoryRequirements(peakRps: number, dau: number): number {
    // Base memory for application
    const baseMemoryGB = 2;
    
    // Memory for concurrent connections (assume 1KB per connection)
    const connectionMemoryGB = (peakRps * 10 * 1024) / (1024 * 1024 * 1024);
    
    // Cache memory (10% of daily active data)
    const cacheMemoryGB = (dau * 0.001); // 1MB per 1000 users
    
    return Math.ceil(baseMemoryGB + connectionMemoryGB + cacheMemoryGB);
  }

  /**
   * Calculate storage requirements
   */
  private static calculateStorageRequirements(dau: number, dailyDataGB: number): number {
    // Historical data (365 days retention)
    const historicalDataGB = dailyDataGB * 365;
    
    // User generated content (10GB per 1000 users)
    const ugcStorageGB = (dau / 1000) * 10;
    
    // Backups and replicas (3x multiplier)
    const totalStorageGB = (historicalDataGB + ugcStorageGB) * 3;
    
    return Math.ceil(totalStorageGB);
  }

  /**
   * Calculate bandwidth requirements
   */
  private static calculateBandwidthRequirements(peakRps: number): number {
    const avgPacketSizeKB = this.WORKLOAD.avgRequestSizeKB + this.WORKLOAD.avgResponseSizeKB;
    const peakBandwidthMbps = (peakRps * avgPacketSizeKB * 8) / 1024;
    
    // Convert to Gbps and add 50% buffer
    return (peakBandwidthMbps / 1024) * 1.5;
  }

  /**
   * Calculate database connections needed
   */
  private static calculateDbConnections(peakRps: number): number {
    // Assume connection pooling with 10:1 request to connection ratio
    const activeConnections = Math.ceil(peakRps / 10);
    
    // Add idle connections (50% of active)
    const totalConnections = activeConnections * 1.5;
    
    return Math.ceil(totalConnections);
  }

  /**
   * Calculate cache size requirements
   */
  private static calculateCacheSize(dau: number, dailyDataGB: number): number {
    // Hot data is typically 20% of daily data
    const hotDataGB = dailyDataGB * 0.2;
    
    // Session data (100KB per active user)
    const sessionDataGB = (dau * 100) / (1024 * 1024);
    
    // Frequently accessed content (5% of total storage)
    const frequentContentGB = (dau / 1000) * 0.5;
    
    return Math.ceil(hotDataGB + sessionDataGB + frequentContentGB);
  }

  /**
   * Generate scaling milestones
   */
  static generateScalingMilestones(): Array<{
    dau: number;
    requirements: ResourceRequirements;
    estimatedCost: number;
  }> {
    const milestones = [
      1000,      // 1K DAU
      10000,     // 10K DAU
      50000,     // 50K DAU
      100000,    // 100K DAU
      250000,    // 250K DAU
      500000,    // 500K DAU
      1000000,   // 1M DAU
      2000000    // 2M DAU
    ];

    return milestones.map(dau => ({
      dau,
      requirements: this.calculateRequirements(dau),
      estimatedCost: this.estimateMonthlyCost(this.calculateRequirements(dau))
    }));
  }

  /**
   * Estimate monthly cost based on requirements
   */
  static estimateMonthlyCost(requirements: ResourceRequirements): number {
    // Cloudflare Workers pricing
    const workersCost = requirements.computeUnits * 5; // $5 per worker
    
    // Neon database pricing (per compute unit)
    const dbComputeUnits = Math.ceil(requirements.dbConnections / this.NEON_CONNECTIONS_PER_CU);
    const dbCost = dbComputeUnits * 50; // $50 per CU
    
    // Storage costs
    const storageCost = requirements.storageGB * 0.1; // $0.10 per GB
    
    // Bandwidth costs (Cloudflare has free egress)
    const bandwidthCost = 0;
    
    // Redis cache costs (Upstash)
    const cacheCost = requirements.cacheSize * 0.5; // $0.50 per GB
    
    // R2 storage costs
    const r2Cost = (requirements.storageGB / 10) * 0.015; // $0.015 per GB
    
    return workersCost + dbCost + storageCost + bandwidthCost + cacheCost + r2Cost;
  }

  /**
   * Calculate Worker distribution for global coverage
   */
  static calculateGlobalDistribution(
    dau: number,
    regions = {
      'north-america': 0.35,
      'europe': 0.25,
      'asia-pacific': 0.30,
      'south-america': 0.05,
      'africa': 0.03,
      'middle-east': 0.02
    }
  ): Record<string, ResourceRequirements> {
    const distribution: Record<string, ResourceRequirements> = {};
    
    for (const [region, percentage] of Object.entries(regions)) {
      const regionalDau = dau * percentage;
      distribution[region] = this.calculateRequirements(regionalDau);
    }
    
    return distribution;
  }

  /**
   * Predict growth and future requirements
   */
  static predictGrowth(
    currentDau: number,
    monthlyGrowthRate: number,
    months: number
  ): Array<{
    month: number;
    predictedDau: number;
    requirements: ResourceRequirements;
    cost: number;
  }> {
    const predictions = [];
    
    for (let month = 0; month <= months; month++) {
      const predictedDau = currentDau * Math.pow(1 + monthlyGrowthRate, month);
      const requirements = this.calculateRequirements(predictedDau);
      const cost = this.estimateMonthlyCost(requirements);
      
      predictions.push({
        month,
        predictedDau: Math.round(predictedDau),
        requirements,
        cost: Math.round(cost)
      });
    }
    
    return predictions;
  }
}

// Export utility functions for immediate use
export function calculateCapacityForDau(dau: number) {
  return CapacityCalculator.calculateRequirements(dau);
}

export function generateCapacityReport() {
  const milestones = CapacityCalculator.generateScalingMilestones();
  const growth = CapacityCalculator.predictGrowth(1000, 0.15, 24); // 15% monthly growth for 2 years
  
  return {
    milestones,
    growth,
    globalDistribution: CapacityCalculator.calculateGlobalDistribution(1000000)
  };
}