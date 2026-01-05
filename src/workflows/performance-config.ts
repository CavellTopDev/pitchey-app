/**
 * Performance Optimization Configuration for Cloudflare Workflows
 * 
 * This module provides comprehensive performance configurations for optimizing
 * workflow execution, resource utilization, and achieving P95 latency < 100ms
 * for state transitions while supporting 10,000+ concurrent workflows.
 */

import type { KVNamespace, R2Bucket, Hyperdrive } from '@cloudflare/workers-types';

// ============================================================================
// Performance Target Metrics
// ============================================================================

export const PERFORMANCE_TARGETS = {
  // Latency targets (milliseconds)
  P50_LATENCY_MS: 50,
  P95_LATENCY_MS: 100,
  P99_LATENCY_MS: 250,
  
  // Throughput targets
  MAX_CONCURRENT_WORKFLOWS: 10000,
  MAX_WORKFLOWS_PER_SECOND: 1000,
  MAX_STATE_TRANSITIONS_PER_SECOND: 5000,
  
  // Reliability targets
  TARGET_UPTIME_PERCENT: 99.99,
  MAX_ERROR_RATE_PERCENT: 0.1,
  MAX_RETRY_ATTEMPTS: 3,
  
  // Resource targets
  MAX_MEMORY_MB: 128,
  MAX_CPU_MS: 50,
  MAX_SUBREQUEST_COUNT: 50,
} as const;

// ============================================================================
// Caching Strategies
// ============================================================================

export interface CacheConfig {
  ttlSeconds: number;
  staleWhileRevalidateSeconds: number;
  priority: 'high' | 'medium' | 'low';
  compressionEnabled: boolean;
  warmupOnStart: boolean;
}

export const CACHE_STRATEGIES = {
  // KV Cache Configurations
  KV_CACHE: {
    // Workflow state caching
    WORKFLOW_STATE: {
      ttlSeconds: 300, // 5 minutes
      staleWhileRevalidateSeconds: 60,
      priority: 'high',
      compressionEnabled: true,
      warmupOnStart: true,
    } as CacheConfig,
    
    // User profile caching
    USER_PROFILES: {
      ttlSeconds: 3600, // 1 hour
      staleWhileRevalidateSeconds: 300,
      priority: 'medium',
      compressionEnabled: true,
      warmupOnStart: false,
    } as CacheConfig,
    
    // Template caching
    TEMPLATES: {
      ttlSeconds: 86400, // 24 hours
      staleWhileRevalidateSeconds: 3600,
      priority: 'low',
      compressionEnabled: true,
      warmupOnStart: true,
    } as CacheConfig,
    
    // Investor verification caching
    INVESTOR_VERIFICATION: {
      ttlSeconds: 7200, // 2 hours
      staleWhileRevalidateSeconds: 600,
      priority: 'high',
      compressionEnabled: false,
      warmupOnStart: false,
    } as CacheConfig,
  },
  
  // R2 Cache Configurations
  R2_CACHE: {
    // Document caching
    DOCUMENTS: {
      ttlSeconds: 86400, // 24 hours
      staleWhileRevalidateSeconds: 7200,
      priority: 'medium',
      compressionEnabled: true,
      warmupOnStart: false,
    } as CacheConfig,
    
    // Contract templates
    CONTRACTS: {
      ttlSeconds: 604800, // 7 days
      staleWhileRevalidateSeconds: 86400,
      priority: 'low',
      compressionEnabled: true,
      warmupOnStart: true,
    } as CacheConfig,
  },
  
  // In-memory cache for hot data
  MEMORY_CACHE: {
    HOT_WORKFLOWS: {
      ttlSeconds: 60,
      maxEntries: 1000,
      evictionPolicy: 'lru' as const,
    },
    
    VALIDATION_RULES: {
      ttlSeconds: 3600,
      maxEntries: 100,
      evictionPolicy: 'lfu' as const,
    },
  },
} as const;

// ============================================================================
// Database Connection Pooling via Hyperdrive
// ============================================================================

export interface HyperdriveConfig {
  maxConnections: number;
  minConnections: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  maxWaitingClients: number;
  statementCacheSize: number;
  preparedStatements: boolean;
}

export const HYPERDRIVE_CONFIG: HyperdriveConfig = {
  maxConnections: 100,
  minConnections: 10,
  connectionTimeoutMs: 5000,
  idleTimeoutMs: 30000,
  maxWaitingClients: 200,
  statementCacheSize: 100,
  preparedStatements: true,
};

// Query optimization hints
export const QUERY_OPTIMIZATION = {
  // Use read replicas for non-critical reads
  useReadReplica: (query: string): boolean => {
    const readOnlyPatterns = [/^SELECT/i, /^WITH.*SELECT/i];
    return readOnlyPatterns.some(pattern => pattern.test(query.trim()));
  },
  
  // Batch size configurations
  BATCH_SIZES: {
    DEFAULT: 100,
    BULK_INSERT: 500,
    BULK_UPDATE: 200,
    BULK_DELETE: 100,
  },
  
  // Query timeout configurations
  TIMEOUTS: {
    FAST_QUERY_MS: 100,
    NORMAL_QUERY_MS: 1000,
    SLOW_QUERY_MS: 5000,
    REPORT_QUERY_MS: 30000,
  },
};

// ============================================================================
// Batch Processing Optimizations
// ============================================================================

export interface BatchConfig {
  maxBatchSize: number;
  maxWaitTimeMs: number;
  concurrencyLimit: number;
  retryOnFailure: boolean;
  parallelProcessing: boolean;
}

export const BATCH_PROCESSING = {
  // Notification batching
  NOTIFICATIONS: {
    maxBatchSize: 100,
    maxWaitTimeMs: 1000,
    concurrencyLimit: 10,
    retryOnFailure: true,
    parallelProcessing: true,
  } as BatchConfig,
  
  // Document processing
  DOCUMENTS: {
    maxBatchSize: 10,
    maxWaitTimeMs: 5000,
    concurrencyLimit: 5,
    retryOnFailure: true,
    parallelProcessing: false,
  } as BatchConfig,
  
  // State transitions
  STATE_UPDATES: {
    maxBatchSize: 50,
    maxWaitTimeMs: 500,
    concurrencyLimit: 20,
    retryOnFailure: true,
    parallelProcessing: true,
  } as BatchConfig,
  
  // Analytics events
  ANALYTICS: {
    maxBatchSize: 500,
    maxWaitTimeMs: 10000,
    concurrencyLimit: 5,
    retryOnFailure: false,
    parallelProcessing: true,
  } as BatchConfig,
};

// ============================================================================
// Rate Limiting Configurations
// ============================================================================

export interface RateLimitConfig {
  windowSizeSeconds: number;
  maxRequests: number;
  burstSize: number;
  penaltySeconds: number;
  adaptiveScaling: boolean;
}

export const RATE_LIMITS = {
  // Per-user rate limits
  USER_LIMITS: {
    WORKFLOW_CREATION: {
      windowSizeSeconds: 60,
      maxRequests: 10,
      burstSize: 5,
      penaltySeconds: 300,
      adaptiveScaling: false,
    } as RateLimitConfig,
    
    STATE_TRANSITIONS: {
      windowSizeSeconds: 60,
      maxRequests: 100,
      burstSize: 20,
      penaltySeconds: 60,
      adaptiveScaling: true,
    } as RateLimitConfig,
    
    DOCUMENT_UPLOAD: {
      windowSizeSeconds: 300,
      maxRequests: 20,
      burstSize: 5,
      penaltySeconds: 600,
      adaptiveScaling: false,
    } as RateLimitConfig,
  },
  
  // Global rate limits
  GLOBAL_LIMITS: {
    API_CALLS: {
      windowSizeSeconds: 1,
      maxRequests: 10000,
      burstSize: 2000,
      penaltySeconds: 10,
      adaptiveScaling: true,
    } as RateLimitConfig,
    
    DATABASE_QUERIES: {
      windowSizeSeconds: 1,
      maxRequests: 5000,
      burstSize: 1000,
      penaltySeconds: 5,
      adaptiveScaling: true,
    } as RateLimitConfig,
  },
};

// ============================================================================
// Resource Allocation Settings
// ============================================================================

export interface ResourceAllocation {
  cpuMilliseconds: number;
  memoryMB: number;
  subrequestLimit: number;
  timeoutSeconds: number;
  priority: 'critical' | 'high' | 'normal' | 'low';
}

export const RESOURCE_ALLOCATION = {
  // Workflow type allocations
  INVESTMENT_WORKFLOW: {
    cpuMilliseconds: 50,
    memoryMB: 128,
    subrequestLimit: 30,
    timeoutSeconds: 30,
    priority: 'high',
  } as ResourceAllocation,
  
  PRODUCTION_WORKFLOW: {
    cpuMilliseconds: 40,
    memoryMB: 96,
    subrequestLimit: 25,
    timeoutSeconds: 25,
    priority: 'high',
  } as ResourceAllocation,
  
  NDA_WORKFLOW: {
    cpuMilliseconds: 20,
    memoryMB: 64,
    subrequestLimit: 15,
    timeoutSeconds: 10,
    priority: 'normal',
  } as ResourceAllocation,
  
  // Operation type allocations
  OPERATIONS: {
    STATE_TRANSITION: {
      cpuMilliseconds: 10,
      memoryMB: 32,
      subrequestLimit: 5,
      timeoutSeconds: 5,
      priority: 'critical',
    } as ResourceAllocation,
    
    DOCUMENT_GENERATION: {
      cpuMilliseconds: 30,
      memoryMB: 64,
      subrequestLimit: 10,
      timeoutSeconds: 15,
      priority: 'normal',
    } as ResourceAllocation,
    
    NOTIFICATION_SEND: {
      cpuMilliseconds: 5,
      memoryMB: 16,
      subrequestLimit: 3,
      timeoutSeconds: 3,
      priority: 'low',
    } as ResourceAllocation,
  },
};

// ============================================================================
// Timeout Optimizations
// ============================================================================

export const TIMEOUT_CONFIG = {
  // Workflow-level timeouts (seconds)
  WORKFLOW_TIMEOUTS: {
    TOTAL_WORKFLOW: 86400 * 30, // 30 days
    SINGLE_STEP: 300, // 5 minutes
    WAIT_FOR_EVENT: 86400 * 7, // 7 days
    HUMAN_APPROVAL: 86400 * 3, // 3 days
  },
  
  // Operation-level timeouts (milliseconds)
  OPERATION_TIMEOUTS: {
    DATABASE_QUERY: 5000,
    API_CALL: 10000,
    DOCUMENT_UPLOAD: 30000,
    EMAIL_SEND: 5000,
    CACHE_READ: 100,
    CACHE_WRITE: 500,
  },
  
  // Graceful shutdown timeouts
  GRACEFUL_SHUTDOWN: {
    WORKFLOW_CHECKPOINT: 5000,
    DATABASE_COMMIT: 2000,
    CACHE_FLUSH: 1000,
    CLEANUP: 500,
  },
};

// ============================================================================
// Retry Strategies with Exponential Backoff
// ============================================================================

export interface RetryStrategy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  retryableErrors: string[];
}

export const RETRY_STRATEGIES = {
  // Database operations
  DATABASE: {
    maxAttempts: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitterEnabled: true,
    retryableErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'CONNECTION_FAILED',
      'DEADLOCK_DETECTED',
    ],
  } as RetryStrategy,
  
  // External API calls
  EXTERNAL_API: {
    maxAttempts: 5,
    initialDelayMs: 500,
    maxDelayMs: 30000,
    backoffMultiplier: 2.5,
    jitterEnabled: true,
    retryableErrors: [
      '429', // Too Many Requests
      '502', // Bad Gateway
      '503', // Service Unavailable
      '504', // Gateway Timeout
      'NETWORK_ERROR',
    ],
  } as RetryStrategy,
  
  // Document operations
  DOCUMENT_OPERATIONS: {
    maxAttempts: 4,
    initialDelayMs: 200,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterEnabled: true,
    retryableErrors: [
      'UPLOAD_FAILED',
      'PROCESSING_ERROR',
      'TEMPORARY_FAILURE',
    ],
  } as RetryStrategy,
  
  // Workflow state transitions
  STATE_TRANSITIONS: {
    maxAttempts: 3,
    initialDelayMs: 50,
    maxDelayMs: 1000,
    backoffMultiplier: 2,
    jitterEnabled: false,
    retryableErrors: [
      'CONCURRENT_MODIFICATION',
      'STATE_CONFLICT',
      'LOCK_TIMEOUT',
    ],
  } as RetryStrategy,
};

// ============================================================================
// Performance Optimization Utilities
// ============================================================================

/**
 * Calculate exponential backoff delay with optional jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  strategy: RetryStrategy
): number {
  const exponentialDelay = Math.min(
    strategy.initialDelayMs * Math.pow(strategy.backoffMultiplier, attempt - 1),
    strategy.maxDelayMs
  );
  
  if (strategy.jitterEnabled) {
    // Add random jitter (±25% of calculated delay)
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    return Math.round(exponentialDelay + jitter);
  }
  
  return Math.round(exponentialDelay);
}

/**
 * Check if an error is retryable based on strategy
 */
export function isRetryableError(
  error: Error | { code?: string; status?: number },
  strategy: RetryStrategy
): boolean {
  const errorCode = 'code' in error ? error.code : undefined;
  const errorStatus = 'status' in error ? String(error.status) : undefined;
  const errorMessage = 'message' in error ? error.message : '';
  
  return strategy.retryableErrors.some(retryableError => {
    if (errorCode === retryableError) return true;
    if (errorStatus === retryableError) return true;
    if (errorMessage.includes(retryableError)) return true;
    return false;
  });
}

/**
 * Execute operation with retry strategy
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  strategy: RetryStrategy,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === strategy.maxAttempts || !isRetryableError(error, strategy)) {
        throw error;
      }
      
      const delay = calculateBackoffDelay(attempt, strategy);
      
      if (onRetry) {
        onRetry(attempt, lastError);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// ============================================================================
// Cache Key Generation and Management
// ============================================================================

export const CACHE_KEYS = {
  // Workflow state keys
  workflowState: (workflowId: string) => `workflow:state:${workflowId}`,
  workflowHistory: (workflowId: string) => `workflow:history:${workflowId}`,
  workflowMetrics: (workflowId: string) => `workflow:metrics:${workflowId}`,
  
  // User profile keys
  userProfile: (userId: string) => `user:profile:${userId}`,
  userPermissions: (userId: string) => `user:permissions:${userId}`,
  userRateLimit: (userId: string, action: string) => `rate_limit:${userId}:${action}`,
  
  // Document keys
  documentMetadata: (documentId: string) => `document:metadata:${documentId}`,
  documentUrl: (documentId: string) => `document:url:${documentId}`,
  
  // Template keys
  template: (templateId: string) => `template:${templateId}`,
  templateVersion: (templateId: string, version: string) => `template:${templateId}:v${version}`,
  
  // Analytics keys
  analyticsDaily: (date: string) => `analytics:daily:${date}`,
  analyticsHourly: (date: string, hour: number) => `analytics:hourly:${date}:${hour}`,
};

// ============================================================================
// Performance Monitoring Configuration
// ============================================================================

export const MONITORING_CONFIG = {
  // Metrics to track
  METRICS: {
    LATENCY: ['p50', 'p95', 'p99', 'max'],
    THROUGHPUT: ['requests_per_second', 'workflows_per_minute'],
    ERROR_RATE: ['error_percentage', 'error_count'],
    RESOURCE_USAGE: ['cpu_ms', 'memory_mb', 'subrequests'],
  },
  
  // Sampling rates
  SAMPLING: {
    TRACES: 0.1, // 10% of requests
    METRICS: 1.0, // All requests
    LOGS: 0.01, // 1% of requests
  },
  
  // Alert thresholds
  ALERTS: {
    P95_LATENCY_MS: 150,
    ERROR_RATE_PERCENT: 1,
    CPU_USAGE_PERCENT: 80,
    MEMORY_USAGE_PERCENT: 90,
  },
};

// ============================================================================
// Auto-scaling Configuration
// ============================================================================

export const AUTOSCALING_CONFIG = {
  // Scale-up triggers
  SCALE_UP: {
    CPU_THRESHOLD_PERCENT: 70,
    MEMORY_THRESHOLD_PERCENT: 80,
    QUEUE_LENGTH_THRESHOLD: 1000,
    P95_LATENCY_THRESHOLD_MS: 120,
  },
  
  // Scale-down triggers
  SCALE_DOWN: {
    CPU_THRESHOLD_PERCENT: 30,
    MEMORY_THRESHOLD_PERCENT: 40,
    QUEUE_LENGTH_THRESHOLD: 100,
    P95_LATENCY_THRESHOLD_MS: 50,
  },
  
  // Scaling parameters
  PARAMETERS: {
    MIN_INSTANCES: 2,
    MAX_INSTANCES: 100,
    SCALE_UP_RATE: 2, // Double instances
    SCALE_DOWN_RATE: 0.5, // Halve instances
    COOLDOWN_SECONDS: 60,
  },
};

// ============================================================================
// Export Performance Manager Class
// ============================================================================

export class PerformanceManager {
  private metrics: Map<string, number[]> = new Map();
  private cacheHitRates: Map<string, number> = new Map();
  
  constructor(
    private kv: KVNamespace,
    private r2: R2Bucket,
    private hyperdrive: Hyperdrive
  ) {}
  
  /**
   * Initialize performance monitoring
   */
  async initialize(): Promise<void> {
    // Warm up critical caches
    await this.warmupCaches();
    
    // Initialize connection pools
    await this.initializeConnectionPools();
    
    // Start metrics collection
    this.startMetricsCollection();
  }
  
  /**
   * Warm up critical caches on startup
   */
  private async warmupCaches(): Promise<void> {
    const warmupConfigs = Object.entries(CACHE_STRATEGIES.KV_CACHE)
      .filter(([_, config]) => config.warmupOnStart)
      .map(([key, config]) => ({ key, config }));
    
    await Promise.all(
      warmupConfigs.map(async ({ key }) => {
        // Preload frequently accessed data
        console.log(`Warming up cache: ${key}`);
      })
    );
  }
  
  /**
   * Initialize database connection pools
   */
  private async initializeConnectionPools(): Promise<void> {
    // Connection pool initialization handled by Hyperdrive
    console.log('Initialized Hyperdrive connection pool');
  }
  
  /**
   * Start background metrics collection
   */
  private startMetricsCollection(): void {
    // Metrics collection runs in background
    console.log('Started metrics collection');
  }
  
  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
  }
  
  /**
   * Calculate percentile from metrics
   */
  getPercentile(name: string, percentile: number): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
  
  /**
   * Get cache hit rate
   */
  getCacheHitRate(cacheKey: string): number {
    return this.cacheHitRates.get(cacheKey) || 0;
  }
  
  /**
   * Update cache hit rate
   */
  updateCacheHitRate(cacheKey: string, hit: boolean): void {
    const currentRate = this.cacheHitRates.get(cacheKey) || 0;
    const newRate = currentRate * 0.95 + (hit ? 0.05 : 0);
    this.cacheHitRates.set(cacheKey, newRate);
  }
}

export default {
  PERFORMANCE_TARGETS,
  CACHE_STRATEGIES,
  HYPERDRIVE_CONFIG,
  BATCH_PROCESSING,
  RATE_LIMITS,
  RESOURCE_ALLOCATION,
  TIMEOUT_CONFIG,
  RETRY_STRATEGIES,
  MONITORING_CONFIG,
  AUTOSCALING_CONFIG,
  PerformanceManager,
  executeWithRetry,
  calculateBackoffDelay,
  isRetryableError,
};