/**
 * Infrastructure Monitoring Service for Pitchey Platform
 * Monitors Cloudflare Workers, R2, KV, Durable Objects, and other infrastructure components
 */

import { Toucan } from "toucan-js";

// Infrastructure metrics interfaces
interface WorkerMetrics {
  cpuTime: number;
  memoryUsage: number;
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  subrequests: number;
  kvsReads: number;
  kvsWrites: number;
  r2Operations: number;
  durableObjectInvocations: number;
  scheduledEventsTriggered: number;
  edgeLocations: string[];
}

interface R2Metrics {
  bucketName: string;
  objectCount: number;
  totalSize: number;
  uploadCount: number;
  downloadCount: number;
  deleteCount: number;
  listOperations: number;
  avgUploadTime: number;
  avgDownloadTime: number;
  errorCount: number;
  bandwidth: number;
}

interface KVMetrics {
  namespace: string;
  keyCount: number;
  readOperations: number;
  writeOperations: number;
  deleteOperations: number;
  listOperations: number;
  avgReadLatency: number;
  avgWriteLatency: number;
  storageUsed: number;
  errorCount: number;
  cacheMisses: number;
  cacheHits: number;
}

interface DurableObjectMetrics {
  className: string;
  activeInstances: number;
  totalRequests: number;
  errorCount: number;
  avgResponseTime: number;
  memoryUsage: number;
  websocketConnections: number;
  messagesSent: number;
  messagesReceived: number;
  storageOperations: number;
}

interface InfrastructureHealth {
  worker: {
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    errorRate: number;
    cpuUtilization: number;
    memoryUtilization: number;
  };
  kv: {
    status: 'healthy' | 'degraded' | 'down';
    latency: number;
    errorRate: number;
    availability: number;
  };
  r2: {
    status: 'healthy' | 'degraded' | 'down';
    latency: number;
    errorRate: number;
    availability: number;
  };
  durableObjects: {
    status: 'healthy' | 'degraded' | 'down';
    activeInstances: number;
    responseTime: number;
    errorRate: number;
  };
  database: {
    status: 'healthy' | 'degraded' | 'down';
    connectionPool: number;
    queryLatency: number;
    errorRate: number;
  };
}

interface RateLimitMetrics {
  endpoint: string;
  requestCount: number;
  throttledRequests: number;
  throttleRate: number;
  avgRequestRate: number;
  peakRequestRate: number;
  uniqueIPs: number;
  suspiciousActivity: number;
}

export class InfrastructureMonitoringService {
  private sentry: Toucan;
  private kv: any;
  private r2: any;
  private websocketRoom: any;
  private notificationRoom: any;

  constructor(sentry: Toucan, bindings: any) {
    this.sentry = sentry;
    this.kv = bindings.KV;
    this.r2 = bindings.R2_BUCKET;
    this.websocketRoom = bindings.WEBSOCKET_ROOM;
    this.notificationRoom = bindings.NOTIFICATION_ROOM;
  }

  /**
   * Monitor Worker performance and resource usage
   */
  async monitorWorkerMetrics(): Promise<WorkerMetrics> {
    const startTime = Date.now();
    let metrics: WorkerMetrics;

    try {
      // Get current memory usage from performance API
      const memoryInfo = (performance as any).memory || {};
      
      // Get stored metrics from previous monitoring cycle
      const storedMetrics = await this.getStoredWorkerMetrics();
      
      metrics = {
        cpuTime: this.getCPUTime(),
        memoryUsage: memoryInfo.usedJSHeapSize || 0,
        requestCount: storedMetrics.requestCount + 1,
        errorCount: storedMetrics.errorCount,
        avgResponseTime: Date.now() - startTime,
        p95ResponseTime: storedMetrics.p95ResponseTime,
        subrequests: storedMetrics.subrequests,
        kvsReads: storedMetrics.kvsReads,
        kvsWrites: storedMetrics.kvsWrites,
        r2Operations: storedMetrics.r2Operations,
        durableObjectInvocations: storedMetrics.durableObjectInvocations,
        scheduledEventsTriggered: storedMetrics.scheduledEventsTriggered,
        edgeLocations: ['DFW', 'LAX', 'LHR', 'SIN'] // Would be dynamically determined
      };

      // Store updated metrics
      await this.storeWorkerMetrics(metrics);
      
      // Send to Sentry for tracking
      this.sentry.addBreadcrumb({
        message: 'Worker metrics collected',
        category: 'infrastructure',
        level: 'info',
        data: {
          memoryUsage: metrics.memoryUsage,
          requestCount: metrics.requestCount,
          avgResponseTime: metrics.avgResponseTime
        }
      });

      return metrics;

    } catch (error) {
      this.sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Monitor R2 storage metrics
   */
  async monitorR2Metrics(): Promise<R2Metrics> {
    const startTime = Date.now();

    try {
      // Test R2 operations to measure performance
      const testKey = `monitoring-test-${Date.now()}`;
      const testData = 'monitoring-test-data';

      // Measure upload performance
      const uploadStart = Date.now();
      await this.r2.put(testKey, testData);
      const uploadTime = Date.now() - uploadStart;

      // Measure download performance
      const downloadStart = Date.now();
      const downloaded = await this.r2.get(testKey);
      const downloadTime = Date.now() - downloadStart;

      // Clean up test object
      await this.r2.delete(testKey);

      // Get stored metrics
      const storedMetrics = await this.getStoredR2Metrics();

      const metrics: R2Metrics = {
        bucketName: 'pitchey-uploads',
        objectCount: storedMetrics.objectCount,
        totalSize: storedMetrics.totalSize,
        uploadCount: storedMetrics.uploadCount + 1,
        downloadCount: storedMetrics.downloadCount + 1,
        deleteCount: storedMetrics.deleteCount + 1,
        listOperations: storedMetrics.listOperations,
        avgUploadTime: this.updateAverage(storedMetrics.avgUploadTime, uploadTime, storedMetrics.uploadCount),
        avgDownloadTime: this.updateAverage(storedMetrics.avgDownloadTime, downloadTime, storedMetrics.downloadCount),
        errorCount: storedMetrics.errorCount,
        bandwidth: storedMetrics.bandwidth
      };

      await this.storeR2Metrics(metrics);

      // Check for performance degradation
      if (uploadTime > 5000 || downloadTime > 3000) {
        this.sentry.captureMessage('R2 performance degradation detected', {
          level: 'warning',
          tags: { component: 'r2-storage' },
          extra: { uploadTime, downloadTime }
        });
      }

      return metrics;

    } catch (error) {
      this.sentry.captureException(error);
      
      // Update error count
      const storedMetrics = await this.getStoredR2Metrics();
      storedMetrics.errorCount++;
      await this.storeR2Metrics(storedMetrics);
      
      throw error;
    }
  }

  /**
   * Monitor KV store metrics
   */
  async monitorKVMetrics(): Promise<KVMetrics> {
    try {
      const testKey = `kv-monitoring-test-${Date.now()}`;
      const testValue = JSON.stringify({ test: true, timestamp: Date.now() });

      // Measure write performance
      const writeStart = Date.now();
      await this.kv.put(testKey, testValue, { expirationTtl: 60 });
      const writeTime = Date.now() - writeStart;

      // Measure read performance
      const readStart = Date.now();
      const readValue = await this.kv.get(testKey);
      const readTime = Date.now() - readStart;

      // Test list operations
      const listStart = Date.now();
      const keyList = await this.kv.list({ prefix: 'kv-monitoring-test', limit: 10 });
      const listTime = Date.now() - listStart;

      // Clean up
      await this.kv.delete(testKey);

      // Get stored metrics
      const storedMetrics = await this.getStoredKVMetrics();

      const metrics: KVMetrics = {
        namespace: 'default',
        keyCount: keyList.keys.length,
        readOperations: storedMetrics.readOperations + 1,
        writeOperations: storedMetrics.writeOperations + 1,
        deleteOperations: storedMetrics.deleteOperations + 1,
        listOperations: storedMetrics.listOperations + 1,
        avgReadLatency: this.updateAverage(storedMetrics.avgReadLatency, readTime, storedMetrics.readOperations),
        avgWriteLatency: this.updateAverage(storedMetrics.avgWriteLatency, writeTime, storedMetrics.writeOperations),
        storageUsed: storedMetrics.storageUsed,
        errorCount: storedMetrics.errorCount,
        cacheMisses: readValue ? storedMetrics.cacheMisses : storedMetrics.cacheMisses + 1,
        cacheHits: readValue ? storedMetrics.cacheHits + 1 : storedMetrics.cacheHits
      };

      await this.storeKVMetrics(metrics);

      return metrics;

    } catch (error) {
      this.sentry.captureException(error);
      
      // Update error count
      const storedMetrics = await this.getStoredKVMetrics();
      storedMetrics.errorCount++;
      await this.storeKVMetrics(storedMetrics);
      
      throw error;
    }
  }

  /**
   * Monitor Durable Objects metrics
   */
  async monitorDurableObjectMetrics(): Promise<DurableObjectMetrics[]> {
    const metrics: DurableObjectMetrics[] = [];

    try {
      // Monitor WebSocket Room Durable Object
      const wsMetrics = await this.monitorWebSocketRoom();
      metrics.push(wsMetrics);

      // Monitor Notification Room Durable Object
      const notificationMetrics = await this.monitorNotificationRoom();
      metrics.push(notificationMetrics);

      return metrics;

    } catch (error) {
      this.sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Get comprehensive infrastructure health status
   */
  async getInfrastructureHealth(): Promise<InfrastructureHealth> {
    try {
      const [workerMetrics, kvMetrics, r2Metrics, doMetrics] = await Promise.all([
        this.monitorWorkerMetrics(),
        this.monitorKVMetrics(),
        this.monitorR2Metrics(),
        this.monitorDurableObjectMetrics()
      ]);

      // Calculate database health (would integrate with actual DB monitoring)
      const dbHealth = await this.checkDatabaseHealth();

      const health: InfrastructureHealth = {
        worker: {
          status: this.determineWorkerStatus(workerMetrics),
          responseTime: workerMetrics.avgResponseTime,
          errorRate: workerMetrics.errorCount / Math.max(workerMetrics.requestCount, 1),
          cpuUtilization: workerMetrics.cpuTime / 100,
          memoryUtilization: workerMetrics.memoryUsage / (50 * 1024 * 1024) // Assuming 50MB limit
        },
        kv: {
          status: this.determineKVStatus(kvMetrics),
          latency: kvMetrics.avgReadLatency,
          errorRate: kvMetrics.errorCount / Math.max(kvMetrics.readOperations, 1),
          availability: kvMetrics.cacheHits / Math.max(kvMetrics.cacheHits + kvMetrics.cacheMisses, 1)
        },
        r2: {
          status: this.determineR2Status(r2Metrics),
          latency: r2Metrics.avgDownloadTime,
          errorRate: r2Metrics.errorCount / Math.max(r2Metrics.downloadCount + r2Metrics.uploadCount, 1),
          availability: 1.0 // Would calculate based on successful operations
        },
        durableObjects: {
          status: this.determineDOStatus(doMetrics),
          activeInstances: doMetrics.reduce((sum, m) => sum + m.activeInstances, 0),
          responseTime: doMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / Math.max(doMetrics.length, 1),
          errorRate: doMetrics.reduce((sum, m) => sum + m.errorCount, 0) / Math.max(doMetrics.reduce((sum, m) => sum + m.totalRequests, 0), 1)
        },
        database: dbHealth
      };

      // Store health status
      await this.kv.put('infrastructure:health', JSON.stringify(health), { expirationTtl: 300 });

      return health;

    } catch (error) {
      this.sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Monitor rate limiting metrics
   */
  async monitorRateLimiting(): Promise<RateLimitMetrics[]> {
    try {
      const endpoints = [
        '/api/auth/login',
        '/api/pitches',
        '/api/upload',
        '/api/payments',
        '/api/messages'
      ];

      const metrics: RateLimitMetrics[] = [];

      for (const endpoint of endpoints) {
        const rateLimitData = await this.kv.get(`rate-limit:${endpoint}`);
        
        if (rateLimitData) {
          const data = JSON.parse(rateLimitData);
          metrics.push({
            endpoint,
            requestCount: data.requests || 0,
            throttledRequests: data.throttled || 0,
            throttleRate: data.throttled / Math.max(data.requests, 1),
            avgRequestRate: data.avgRate || 0,
            peakRequestRate: data.peakRate || 0,
            uniqueIPs: data.uniqueIPs || 0,
            suspiciousActivity: data.suspicious || 0
          });
        }
      }

      return metrics;

    } catch (error) {
      this.sentry.captureException(error);
      return [];
    }
  }

  // Private helper methods

  private async getStoredWorkerMetrics(): Promise<WorkerMetrics> {
    try {
      const stored = await this.kv.get('worker:metrics');
      return stored ? JSON.parse(stored) : this.getDefaultWorkerMetrics();
    } catch {
      return this.getDefaultWorkerMetrics();
    }
  }

  private async storeWorkerMetrics(metrics: WorkerMetrics): Promise<void> {
    await this.kv.put('worker:metrics', JSON.stringify(metrics), { expirationTtl: 3600 });
  }

  private async getStoredR2Metrics(): Promise<R2Metrics> {
    try {
      const stored = await this.kv.get('r2:metrics');
      return stored ? JSON.parse(stored) : this.getDefaultR2Metrics();
    } catch {
      return this.getDefaultR2Metrics();
    }
  }

  private async storeR2Metrics(metrics: R2Metrics): Promise<void> {
    await this.kv.put('r2:metrics', JSON.stringify(metrics), { expirationTtl: 3600 });
  }

  private async getStoredKVMetrics(): Promise<KVMetrics> {
    try {
      const stored = await this.kv.get('kv:metrics');
      return stored ? JSON.parse(stored) : this.getDefaultKVMetrics();
    } catch {
      return this.getDefaultKVMetrics();
    }
  }

  private async storeKVMetrics(metrics: KVMetrics): Promise<void> {
    await this.kv.put('kv:metrics', JSON.stringify(metrics), { expirationTtl: 3600 });
  }

  private async monitorWebSocketRoom(): Promise<DurableObjectMetrics> {
    try {
      // Get a WebSocket room instance
      const id = this.websocketRoom.newUniqueId();
      const room = this.websocketRoom.get(id);

      // Test basic functionality
      const startTime = Date.now();
      const response = await room.fetch(new Request('https://example.com/test'));
      const responseTime = Date.now() - startTime;

      const storedMetrics = await this.getStoredDOMetrics('WebSocketRoom');

      return {
        className: 'WebSocketRoom',
        activeInstances: storedMetrics.activeInstances,
        totalRequests: storedMetrics.totalRequests + 1,
        errorCount: response.ok ? storedMetrics.errorCount : storedMetrics.errorCount + 1,
        avgResponseTime: this.updateAverage(storedMetrics.avgResponseTime, responseTime, storedMetrics.totalRequests),
        memoryUsage: storedMetrics.memoryUsage,
        websocketConnections: storedMetrics.websocketConnections,
        messagesSent: storedMetrics.messagesSent,
        messagesReceived: storedMetrics.messagesReceived,
        storageOperations: storedMetrics.storageOperations + 1
      };

    } catch (error) {
      const storedMetrics = await this.getStoredDOMetrics('WebSocketRoom');
      storedMetrics.errorCount++;
      return storedMetrics;
    }
  }

  private async monitorNotificationRoom(): Promise<DurableObjectMetrics> {
    try {
      // Similar monitoring for notification room
      const storedMetrics = await this.getStoredDOMetrics('NotificationRoom');

      return {
        className: 'NotificationRoom',
        activeInstances: storedMetrics.activeInstances,
        totalRequests: storedMetrics.totalRequests,
        errorCount: storedMetrics.errorCount,
        avgResponseTime: storedMetrics.avgResponseTime,
        memoryUsage: storedMetrics.memoryUsage,
        websocketConnections: storedMetrics.websocketConnections,
        messagesSent: storedMetrics.messagesSent,
        messagesReceived: storedMetrics.messagesReceived,
        storageOperations: storedMetrics.storageOperations
      };

    } catch (error) {
      const storedMetrics = await this.getStoredDOMetrics('NotificationRoom');
      storedMetrics.errorCount++;
      return storedMetrics;
    }
  }

  private async getStoredDOMetrics(className: string): Promise<DurableObjectMetrics> {
    try {
      const stored = await this.kv.get(`do:metrics:${className}`);
      return stored ? JSON.parse(stored) : this.getDefaultDOMetrics(className);
    } catch {
      return this.getDefaultDOMetrics(className);
    }
  }

  private async checkDatabaseHealth(): Promise<InfrastructureHealth['database']> {
    try {
      // This would integrate with actual database monitoring
      // For now, return mock health data
      return {
        status: 'healthy',
        connectionPool: 10,
        queryLatency: 50,
        errorRate: 0.001
      };
    } catch {
      return {
        status: 'down',
        connectionPool: 0,
        queryLatency: 0,
        errorRate: 1.0
      };
    }
  }

  private getCPUTime(): number {
    // This would require integration with Cloudflare's CPU time API
    return Math.random() * 10; // Mock value
  }

  private updateAverage(currentAvg: number, newValue: number, count: number): number {
    return ((currentAvg * count) + newValue) / (count + 1);
  }

  private determineWorkerStatus(metrics: WorkerMetrics): 'healthy' | 'degraded' | 'down' {
    const errorRate = metrics.errorCount / Math.max(metrics.requestCount, 1);
    const memoryUsage = metrics.memoryUsage / (50 * 1024 * 1024);
    
    if (errorRate > 0.1 || memoryUsage > 0.9 || metrics.avgResponseTime > 5000) {
      return 'down';
    } else if (errorRate > 0.05 || memoryUsage > 0.7 || metrics.avgResponseTime > 2000) {
      return 'degraded';
    }
    return 'healthy';
  }

  private determineKVStatus(metrics: KVMetrics): 'healthy' | 'degraded' | 'down' {
    const errorRate = metrics.errorCount / Math.max(metrics.readOperations + metrics.writeOperations, 1);
    
    if (errorRate > 0.1 || metrics.avgReadLatency > 1000) {
      return 'down';
    } else if (errorRate > 0.05 || metrics.avgReadLatency > 500) {
      return 'degraded';
    }
    return 'healthy';
  }

  private determineR2Status(metrics: R2Metrics): 'healthy' | 'degraded' | 'down' {
    const errorRate = metrics.errorCount / Math.max(metrics.uploadCount + metrics.downloadCount, 1);
    
    if (errorRate > 0.1 || metrics.avgDownloadTime > 5000) {
      return 'down';
    } else if (errorRate > 0.05 || metrics.avgDownloadTime > 2000) {
      return 'degraded';
    }
    return 'healthy';
  }

  private determineDOStatus(metrics: DurableObjectMetrics[]): 'healthy' | 'degraded' | 'down' {
    const totalErrors = metrics.reduce((sum, m) => sum + m.errorCount, 0);
    const totalRequests = metrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const errorRate = totalErrors / Math.max(totalRequests, 1);
    
    if (errorRate > 0.1) {
      return 'down';
    } else if (errorRate > 0.05) {
      return 'degraded';
    }
    return 'healthy';
  }

  private getDefaultWorkerMetrics(): WorkerMetrics {
    return {
      cpuTime: 0,
      memoryUsage: 0,
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      subrequests: 0,
      kvsReads: 0,
      kvsWrites: 0,
      r2Operations: 0,
      durableObjectInvocations: 0,
      scheduledEventsTriggered: 0,
      edgeLocations: []
    };
  }

  private getDefaultR2Metrics(): R2Metrics {
    return {
      bucketName: 'pitchey-uploads',
      objectCount: 0,
      totalSize: 0,
      uploadCount: 0,
      downloadCount: 0,
      deleteCount: 0,
      listOperations: 0,
      avgUploadTime: 0,
      avgDownloadTime: 0,
      errorCount: 0,
      bandwidth: 0
    };
  }

  private getDefaultKVMetrics(): KVMetrics {
    return {
      namespace: 'default',
      keyCount: 0,
      readOperations: 0,
      writeOperations: 0,
      deleteOperations: 0,
      listOperations: 0,
      avgReadLatency: 0,
      avgWriteLatency: 0,
      storageUsed: 0,
      errorCount: 0,
      cacheMisses: 0,
      cacheHits: 0
    };
  }

  private getDefaultDOMetrics(className: string): DurableObjectMetrics {
    return {
      className,
      activeInstances: 0,
      totalRequests: 0,
      errorCount: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
      websocketConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      storageOperations: 0
    };
  }
}

/**
 * Infrastructure Monitoring Worker
 */
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      context: {
        waitUntil: (promise: Promise<any>) => promise,
        request,
      },
      environment: env.ENVIRONMENT || 'production',
      release: env.SENTRY_RELEASE,
    });

    const infraService = new InfrastructureMonitoringService(sentry, env);
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/infra/health':
          const health = await infraService.getInfrastructureHealth();
          return new Response(JSON.stringify(health), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/infra/worker':
          const workerMetrics = await infraService.monitorWorkerMetrics();
          return new Response(JSON.stringify(workerMetrics), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/infra/kv':
          const kvMetrics = await infraService.monitorKVMetrics();
          return new Response(JSON.stringify(kvMetrics), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/infra/r2':
          const r2Metrics = await infraService.monitorR2Metrics();
          return new Response(JSON.stringify(r2Metrics), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/infra/durable-objects':
          const doMetrics = await infraService.monitorDurableObjectMetrics();
          return new Response(JSON.stringify(doMetrics), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/infra/rate-limits':
          const rateLimitMetrics = await infraService.monitorRateLimiting();
          return new Response(JSON.stringify(rateLimitMetrics), {
            headers: { 'Content-Type': 'application/json' }
          });

        default:
          return new Response('Infrastructure monitoring endpoint not found', { status: 404 });
      }

    } catch (error) {
      sentry.captureException(error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  async scheduled(event: ScheduledEvent, env: any): Promise<void> {
    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      environment: env.ENVIRONMENT || 'production',
      release: env.SENTRY_RELEASE,
    });

    const infraService = new InfrastructureMonitoringService(sentry, env);

    try {
      if (event.cron === "*/5 * * * *") { // Every 5 minutes
        await infraService.getInfrastructureHealth();
        await infraService.monitorRateLimiting();
      }
    } catch (error) {
      sentry.captureException(error);
      throw error;
    }
  }
};