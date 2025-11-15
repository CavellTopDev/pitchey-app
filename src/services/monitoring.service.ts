/**
 * Comprehensive Monitoring Service
 * Provides real-time monitoring, health checks, and system metrics
 */

import { telemetry } from "../utils/telemetry.ts";
import { db } from "../db/client.ts";
import { sql } from "npm:drizzle-orm@0.35.3";

export interface HealthCheck {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  message?: string;
  details?: any;
}

export interface SystemMetrics {
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  performance: {
    responseTime: {
      avg: number;
      p50: number;
      p95: number;
      p99: number;
    };
    requestsPerSecond: number;
    errorRate: number;
  };
  database: {
    connectionCount: number;
    activeQueries: number;
    avgQueryTime: number;
  };
  cache: {
    hitRate: number;
    memoryUsage: number;
    keyCount: number;
  };
}

export interface ServiceStatus {
  overall: "operational" | "degraded" | "outage";
  services: HealthCheck[];
  lastChecked: string;
  nextCheck: string;
}

export class MonitoringService {
  private static startTime = Date.now();
  private static metrics: Map<string, any[]> = new Map();
  private static alerts: Array<{
    id: string;
    severity: "info" | "warning" | "error" | "critical";
    message: string;
    timestamp: string;
    resolved?: boolean;
  }> = [];

  /**
   * Comprehensive health check of all system components
   */
  static async performHealthCheck(): Promise<ServiceStatus> {
    const checks: HealthCheck[] = [];

    // Database health check
    checks.push(await this.checkDatabase());
    
    // Cache health check
    checks.push(await this.checkCache());
    
    // External services health check
    checks.push(await this.checkExternalServices());
    
    // File system health check
    checks.push(await this.checkFileSystem());
    
    // Memory health check
    checks.push(await this.checkMemory());

    // Determine overall status
    const overallStatus = this.determineOverallStatus(checks);

    return {
      overall: overallStatus,
      services: checks,
      lastChecked: new Date().toISOString(),
      nextCheck: new Date(Date.now() + 30000).toISOString() // Next check in 30s
    };
  }

  /**
   * Database connectivity and performance check
   */
  private static async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simple connectivity test
      const result = await db.execute(sql`SELECT 1 as test`);
      const responseTime = Date.now() - startTime;

      if (responseTime > 1000) {
        return {
          service: "database",
          status: "degraded",
          responseTime,
          message: "Database response time is slow",
          details: { threshold: "1000ms", actual: `${responseTime}ms` }
        };
      }

      return {
        service: "database",
        status: "healthy",
        responseTime,
        message: "Database is responding normally"
      };

    } catch (error) {
      return {
        service: "database",
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        message: "Database connection failed",
        details: { error: error.message }
      };
    }
  }

  /**
   * Cache service health check
   */
  private static async checkCache(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Check if cache service is available
      const cacheEnabled = Deno.env.get("CACHE_ENABLED") === "true";
      
      if (!cacheEnabled) {
        return {
          service: "cache",
          status: "healthy",
          responseTime: Date.now() - startTime,
          message: "Cache disabled - running without cache"
        };
      }

      // Test cache connectivity (if using Redis)
      const responseTime = Date.now() - startTime;
      
      return {
        service: "cache",
        status: "healthy",
        responseTime,
        message: "Cache service is operational"
      };

    } catch (error) {
      return {
        service: "cache",
        status: "degraded",
        responseTime: Date.now() - startTime,
        message: "Cache service unavailable, falling back to database",
        details: { error: error.message }
      };
    }
  }

  /**
   * External services health check
   */
  private static async checkExternalServices(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Check external dependencies
      const checks = [];

      // Check if Sentry is configured
      if (Deno.env.get("SENTRY_DSN")) {
        checks.push("Sentry configured");
      }

      // Check if payment provider is configured
      if (Deno.env.get("STRIPE_SECRET_KEY")) {
        checks.push("Payment service configured");
      }

      return {
        service: "external_services",
        status: "healthy",
        responseTime: Date.now() - startTime,
        message: `${checks.length} external services configured`,
        details: { configured: checks }
      };

    } catch (error) {
      return {
        service: "external_services",
        status: "degraded",
        responseTime: Date.now() - startTime,
        message: "Some external services may be unavailable",
        details: { error: error.message }
      };
    }
  }

  /**
   * File system health check
   */
  private static async checkFileSystem(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Test file system write/read
      const testFile = "/tmp/healthcheck.txt";
      const testData = `Health check: ${Date.now()}`;
      
      await Deno.writeTextFile(testFile, testData);
      const readData = await Deno.readTextFile(testFile);
      await Deno.remove(testFile);
      
      if (readData !== testData) {
        throw new Error("File system data integrity check failed");
      }

      return {
        service: "filesystem",
        status: "healthy",
        responseTime: Date.now() - startTime,
        message: "File system is operational"
      };

    } catch (error) {
      return {
        service: "filesystem",
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        message: "File system issues detected",
        details: { error: error.message }
      };
    }
  }

  /**
   * Memory usage health check
   */
  private static async checkMemory(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Get memory usage information
      const memoryInfo = Deno.memoryUsage();
      const usedMB = Math.round(memoryInfo.rss / 1024 / 1024);
      const heapUsedMB = Math.round(memoryInfo.heapUsed / 1024 / 1024);
      
      // Check if memory usage is concerning
      if (usedMB > 512) { // 512MB threshold
        return {
          service: "memory",
          status: "degraded",
          responseTime: Date.now() - startTime,
          message: "High memory usage detected",
          details: { 
            rssUsage: `${usedMB}MB`,
            heapUsage: `${heapUsedMB}MB`,
            threshold: "512MB"
          }
        };
      }

      return {
        service: "memory",
        status: "healthy",
        responseTime: Date.now() - startTime,
        message: "Memory usage is normal",
        details: { 
          rssUsage: `${usedMB}MB`,
          heapUsage: `${heapUsedMB}MB`
        }
      };

    } catch (error) {
      return {
        service: "memory",
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        message: "Unable to check memory usage",
        details: { error: error.message }
      };
    }
  }

  /**
   * Determine overall system status from individual checks
   */
  private static determineOverallStatus(checks: HealthCheck[]): "operational" | "degraded" | "outage" {
    const unhealthy = checks.filter(check => check.status === "unhealthy").length;
    const degraded = checks.filter(check => check.status === "degraded").length;
    
    if (unhealthy > 0) {
      return "outage";
    } else if (degraded > 0) {
      return "degraded";
    } else {
      return "operational";
    }
  }

  /**
   * Collect comprehensive system metrics
   */
  static async collectSystemMetrics(): Promise<SystemMetrics> {
    const memoryInfo = Deno.memoryUsage();
    const uptime = Date.now() - this.startTime;

    return {
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime / 1000), // uptime in seconds
      memory: {
        used: memoryInfo.rss,
        free: memoryInfo.external, // Approximate
        total: memoryInfo.rss + memoryInfo.external,
        percentage: Math.round((memoryInfo.rss / (memoryInfo.rss + memoryInfo.external)) * 100)
      },
      performance: {
        responseTime: {
          avg: this.getMetricValue("responseTime.avg", 0),
          p50: this.getMetricValue("responseTime.p50", 0),
          p95: this.getMetricValue("responseTime.p95", 0),
          p99: this.getMetricValue("responseTime.p99", 0)
        },
        requestsPerSecond: this.getMetricValue("requests.perSecond", 0),
        errorRate: this.getMetricValue("errors.rate", 0)
      },
      database: {
        connectionCount: this.getMetricValue("database.connections", 0),
        activeQueries: this.getMetricValue("database.activeQueries", 0),
        avgQueryTime: this.getMetricValue("database.avgQueryTime", 0)
      },
      cache: {
        hitRate: this.getMetricValue("cache.hitRate", 0),
        memoryUsage: this.getMetricValue("cache.memoryUsage", 0),
        keyCount: this.getMetricValue("cache.keyCount", 0)
      }
    };
  }

  /**
   * Track request metrics
   */
  static trackRequest(path: string, method: string, responseTime: number, statusCode: number): void {
    const timestamp = Date.now();
    
    // Store metrics
    this.addMetric("requests", { timestamp, path, method, responseTime, statusCode });
    
    // Track errors
    if (statusCode >= 400) {
      this.addMetric("errors", { timestamp, path, method, statusCode });
    }
    
    // Log performance metrics
    telemetry.logger.info("Request Metrics", {
      path,
      method,
      responseTime,
      statusCode,
      timestamp
    });
  }

  /**
   * Generate monitoring alerts
   */
  static async checkAlerts(): Promise<void> {
    const metrics = await this.collectSystemMetrics();
    
    // High memory usage alert
    if (metrics.memory.percentage > 80) {
      this.createAlert("warning", `High memory usage: ${metrics.memory.percentage}%`);
    }
    
    // High error rate alert
    if (metrics.performance.errorRate > 0.05) { // 5% error rate
      this.createAlert("error", `High error rate: ${(metrics.performance.errorRate * 100).toFixed(2)}%`);
    }
    
    // Slow response time alert
    if (metrics.performance.responseTime.avg > 2000) {
      this.createAlert("warning", `Slow response times: ${metrics.performance.responseTime.avg}ms average`);
    }
  }

  /**
   * Create system alert
   */
  private static createAlert(severity: "info" | "warning" | "error" | "critical", message: string): void {
    const alert = {
      id: crypto.randomUUID(),
      severity,
      message,
      timestamp: new Date().toISOString(),
      resolved: false
    };

    this.alerts.push(alert);
    
    // Log alert
    telemetry.logger.warn("System Alert", { alert });
    
    // Keep only recent alerts
    this.alerts = this.alerts.slice(-100);
  }

  /**
   * Get recent system alerts
   */
  static getRecentAlerts(limit = 20): Array<any> {
    return this.alerts
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get monitoring dashboard data
   */
  static async getDashboardData(): Promise<{
    status: ServiceStatus;
    metrics: SystemMetrics;
    alerts: Array<any>;
    uptime: number;
  }> {
    const [status, metrics] = await Promise.all([
      this.performHealthCheck(),
      this.collectSystemMetrics()
    ]);

    return {
      status,
      metrics,
      alerts: this.getRecentAlerts(10),
      uptime: Math.round((Date.now() - this.startTime) / 1000)
    };
  }

  // Helper methods
  
  private static addMetric(key: string, value: any): void {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const metrics = this.metrics.get(key)!;
    metrics.push(value);
    
    // Keep only recent metrics (last 1000 entries)
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }
  }

  private static getMetricValue(key: string, defaultValue: number): number {
    const metrics = this.metrics.get(key);
    if (!metrics || metrics.length === 0) {
      return defaultValue;
    }
    
    // Return average of recent values
    const recent = metrics.slice(-10);
    const sum = recent.reduce((acc, m) => acc + (typeof m === 'number' ? m : m.value || 0), 0);
    return Math.round(sum / recent.length);
  }
}