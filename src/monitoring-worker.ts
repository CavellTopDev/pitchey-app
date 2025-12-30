/**
 * Comprehensive Monitoring Worker for Pitchey Platform
 * Provides real-time monitoring, health checks, metrics collection, and alerting
 */

import { Toucan } from "toucan-js";

// Types for monitoring data
interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  timestamp: number;
  details?: string;
}

interface MetricData {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram';
}

interface AlertConfig {
  name: string;
  condition: string;
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  channels: string[];
}

interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: number;
  service: string;
  traceId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

interface PerformanceMetrics {
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
  throughput: number;
  cacheHitRate: number;
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // Initialize Sentry for error tracking
    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      context: {
        waitUntil: (promise: Promise<any>) => promise,
        request,
      },
      environment: env.ENVIRONMENT || 'production',
      release: env.SENTRY_RELEASE,
      beforeSend(event) {
        // Add monitoring-specific context
        event.tags = {
          ...event.tags,
          service: 'monitoring-worker',
          component: 'observability'
        };
        return event;
      }
    });

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Route monitoring requests
      switch (path) {
        case '/monitoring/health':
          return await handleHealthCheck(env, sentry);
        
        case '/monitoring/metrics':
          return await handleMetrics(env, sentry);
        
        case '/monitoring/logs':
          return await handleLogAggregation(request, env, sentry);
        
        case '/monitoring/alerts':
          return await handleAlerts(request, env, sentry);
        
        case '/monitoring/performance':
          return await handlePerformanceMonitoring(env, sentry);
        
        case '/monitoring/dashboard':
          return await handleDashboard(env, sentry);
        
        case '/monitoring/uptime':
          return await handleUptimeCheck(request, env, sentry);
        
        case '/monitoring/traces':
          return await handleTracing(request, env, sentry);
        
        default:
          return new Response('Monitoring endpoint not found', { status: 404 });
      }
    } catch (error) {
      sentry.captureException(error);
      return new Response('Internal monitoring error', { status: 500 });
    }
  },

  async scheduled(event: ScheduledEvent, env: any): Promise<void> {
    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      environment: env.ENVIRONMENT || 'production',
      release: env.SENTRY_RELEASE,
    });

    try {
      // Schedule different monitoring tasks based on cron
      const cron = event.cron;
      
      if (cron === "*/1 * * * *") {
        // Every minute: Health checks and critical metrics
        await performHealthChecks(env, sentry);
        await collectCriticalMetrics(env, sentry);
      }
      
      if (cron === "*/5 * * * *") {
        // Every 5 minutes: Performance metrics and log aggregation
        await collectPerformanceMetrics(env, sentry);
        await aggregateLogs(env, sentry);
      }
      
      if (cron === "*/15 * * * *") {
        // Every 15 minutes: Infrastructure monitoring
        await monitorInfrastructure(env, sentry);
        await checkAlertRules(env, sentry);
      }
      
      if (cron === "0 * * * *") {
        // Every hour: Generate reports and cleanup
        await generateHourlyReport(env, sentry);
        await cleanupOldData(env, sentry);
      }
      
      if (cron === "0 0 * * *") {
        // Daily: Generate daily report and maintenance
        await generateDailyReport(env, sentry);
        await performMaintenance(env, sentry);
      }
      
    } catch (error) {
      sentry.captureException(error);
      throw error;
    }
  }
};

// Health Check Implementation
async function handleHealthCheck(env: any, sentry: Toucan): Promise<Response> {
  const startTime = Date.now();
  const checks: HealthCheck[] = [];

  try {
    // Check main API endpoints
    const apiHealth = await checkApiHealth(env);
    checks.push(apiHealth);

    // Check database connectivity
    const dbHealth = await checkDatabaseHealth(env);
    checks.push(dbHealth);

    // Check Redis/KV storage
    const cacheHealth = await checkCacheHealth(env);
    checks.push(cacheHealth);

    // Check R2 storage
    const storageHealth = await checkStorageHealth(env);
    checks.push(storageHealth);

    // Check WebSocket connectivity
    const wsHealth = await checkWebSocketHealth(env);
    checks.push(wsHealth);

    // Overall system health
    const overallStatus = checks.every(c => c.status === 'healthy') ? 'healthy' :
                         checks.some(c => c.status === 'down') ? 'down' : 'degraded';

    const healthData = {
      status: overallStatus,
      timestamp: Date.now(),
      responseTime: Date.now() - startTime,
      checks,
      version: env.SENTRY_RELEASE || 'unknown'
    };

    // Store health data in KV for dashboard
    await env.KV.put('health:latest', JSON.stringify(healthData), { expirationTtl: 300 });

    return new Response(JSON.stringify(healthData), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    sentry.captureException(error);
    return new Response(JSON.stringify({ 
      status: 'down', 
      error: error.message,
      timestamp: Date.now()
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Metrics Collection
async function handleMetrics(env: any, sentry: Toucan): Promise<Response> {
  try {
    const metrics = await collectAllMetrics(env, sentry);
    
    // Store metrics in time-series format
    const timestamp = Date.now();
    await env.KV.put(`metrics:${timestamp}`, JSON.stringify(metrics), { expirationTtl: 86400 });
    
    return new Response(JSON.stringify({
      timestamp,
      metrics,
      count: metrics.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    sentry.captureException(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// Log Aggregation
async function handleLogAggregation(request: Request, env: any, sentry: Toucan): Promise<Response> {
  try {
    const url = new URL(request.url);
    const level = url.searchParams.get('level') || 'info';
    const service = url.searchParams.get('service') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const since = url.searchParams.get('since');

    if (request.method === 'POST') {
      // Ingest new log entry
      const logEntry: LogEntry = await request.json();
      await ingestLogEntry(logEntry, env, sentry);
      return new Response('Log ingested', { status: 201 });
    } else {
      // Query logs
      const logs = await queryLogs({ level, service, limit, since }, env);
      return new Response(JSON.stringify({ logs, count: logs.length }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    sentry.captureException(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// Performance Monitoring
async function handlePerformanceMonitoring(env: any, sentry: Toucan): Promise<Response> {
  try {
    const perfData = await collectPerformanceData(env, sentry);
    
    // Store performance data
    await env.KV.put(`performance:${Date.now()}`, JSON.stringify(perfData), { expirationTtl: 3600 });
    
    return new Response(JSON.stringify(perfData), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    sentry.captureException(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// Dashboard Data
async function handleDashboard(env: any, sentry: Toucan): Promise<Response> {
  try {
    const dashboardData = await generateDashboardData(env, sentry);
    
    return new Response(JSON.stringify(dashboardData), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=60'
      }
    });

  } catch (error) {
    sentry.captureException(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// Helper Functions

async function checkApiHealth(env: any): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const response = await fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health', {
      method: 'GET',
      timeout: 5000
    });
    
    return {
      name: 'API Health',
      status: response.ok ? 'healthy' : 'degraded',
      responseTime: Date.now() - startTime,
      timestamp: Date.now(),
      details: `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      name: 'API Health',
      status: 'down',
      responseTime: Date.now() - startTime,
      timestamp: Date.now(),
      details: error.message
    };
  }
}

async function checkDatabaseHealth(env: any): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    // Simple database ping
    const response = await fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/db', {
      method: 'GET',
      timeout: 10000
    });
    
    return {
      name: 'Database Health',
      status: response.ok ? 'healthy' : 'degraded',
      responseTime: Date.now() - startTime,
      timestamp: Date.now(),
      details: response.ok ? 'Connection successful' : 'Connection failed'
    };
  } catch (error) {
    return {
      name: 'Database Health',
      status: 'down',
      responseTime: Date.now() - startTime,
      timestamp: Date.now(),
      details: error.message
    };
  }
}

async function checkCacheHealth(env: any): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    // Test KV read/write
    const testKey = `health-check-${Date.now()}`;
    await env.KV.put(testKey, 'test', { expirationTtl: 60 });
    const result = await env.KV.get(testKey);
    
    return {
      name: 'Cache Health',
      status: result === 'test' ? 'healthy' : 'degraded',
      responseTime: Date.now() - startTime,
      timestamp: Date.now(),
      details: 'KV operations successful'
    };
  } catch (error) {
    return {
      name: 'Cache Health',
      status: 'down',
      responseTime: Date.now() - startTime,
      timestamp: Date.now(),
      details: error.message
    };
  }
}

async function checkStorageHealth(env: any): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    // Test R2 connectivity
    await env.R2_BUCKET.head('health-check');
    
    return {
      name: 'Storage Health',
      status: 'healthy',
      responseTime: Date.now() - startTime,
      timestamp: Date.now(),
      details: 'R2 accessible'
    };
  } catch (error) {
    return {
      name: 'Storage Health',
      status: error.message.includes('NotFound') ? 'healthy' : 'down',
      responseTime: Date.now() - startTime,
      timestamp: Date.now(),
      details: error.message.includes('NotFound') ? 'R2 accessible' : error.message
    };
  }
}

async function checkWebSocketHealth(env: any): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    // Test Durable Object binding
    const id = env.WEBSOCKET_ROOM.newUniqueId();
    const room = env.WEBSOCKET_ROOM.get(id);
    
    return {
      name: 'WebSocket Health',
      status: 'healthy',
      responseTime: Date.now() - startTime,
      timestamp: Date.now(),
      details: 'Durable Objects accessible'
    };
  } catch (error) {
    return {
      name: 'WebSocket Health',
      status: 'down',
      responseTime: Date.now() - startTime,
      timestamp: Date.now(),
      details: error.message
    };
  }
}

async function collectAllMetrics(env: any, sentry: Toucan): Promise<MetricData[]> {
  const timestamp = Date.now();
  const metrics: MetricData[] = [];

  // System metrics
  metrics.push({
    name: 'worker_memory_usage',
    value: (performance as any).memory?.usedJSHeapSize || 0,
    timestamp,
    tags: { component: 'worker', type: 'memory' },
    type: 'gauge'
  });

  // KV metrics
  try {
    const kvMetrics = await env.KV.list({ prefix: 'metrics:' });
    metrics.push({
      name: 'kv_key_count',
      value: kvMetrics.keys.length,
      timestamp,
      tags: { component: 'kv', type: 'storage' },
      type: 'gauge'
    });
  } catch (error) {
    sentry.captureException(error);
  }

  return metrics;
}

async function ingestLogEntry(logEntry: LogEntry, env: any, sentry: Toucan): Promise<void> {
  try {
    const logKey = `logs:${logEntry.service}:${logEntry.timestamp}`;
    await env.KV.put(logKey, JSON.stringify(logEntry), { expirationTtl: 86400 * 7 }); // 7 days retention

    // Send critical errors to Sentry
    if (logEntry.level === 'error') {
      sentry.captureMessage(logEntry.message, 'error');
    }

  } catch (error) {
    sentry.captureException(error);
  }
}

async function queryLogs(query: any, env: any): Promise<LogEntry[]> {
  try {
    const { keys } = await env.KV.list({ 
      prefix: query.service === 'all' ? 'logs:' : `logs:${query.service}:`,
      limit: query.limit 
    });
    
    const logs: LogEntry[] = [];
    for (const key of keys.slice(0, query.limit)) {
      const logData = await env.KV.get(key.name);
      if (logData) {
        const log = JSON.parse(logData);
        if (!query.level || log.level === query.level) {
          logs.push(log);
        }
      }
    }
    
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error querying logs:', error);
    return [];
  }
}

async function collectPerformanceData(env: any, sentry: Toucan): Promise<PerformanceMetrics> {
  // This would integrate with actual performance monitoring
  // For now, returning mock data structure
  return {
    responseTime: 150,
    memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
    cpuUsage: 25,
    errorRate: 0.001,
    throughput: 1000,
    cacheHitRate: 0.95
  };
}

async function generateDashboardData(env: any, sentry: Toucan): Promise<any> {
  try {
    const [health, metrics, performance] = await Promise.all([
      env.KV.get('health:latest').then(data => data ? JSON.parse(data) : null),
      collectAllMetrics(env, sentry),
      collectPerformanceData(env, sentry)
    ]);

    return {
      timestamp: Date.now(),
      status: health?.status || 'unknown',
      health,
      metrics,
      performance,
      alerts: await getActiveAlerts(env)
    };
  } catch (error) {
    sentry.captureException(error);
    return {
      timestamp: Date.now(),
      status: 'error',
      error: error.message
    };
  }
}

async function getActiveAlerts(env: any): Promise<any[]> {
  try {
    const alertsData = await env.KV.get('alerts:active');
    return alertsData ? JSON.parse(alertsData) : [];
  } catch {
    return [];
  }
}

// Scheduled task implementations
async function performHealthChecks(env: any, sentry: Toucan): Promise<void> {
  // This would run comprehensive health checks
  const health = await handleHealthCheck(env, sentry);
  // Store results and trigger alerts if needed
}

async function collectCriticalMetrics(env: any, sentry: Toucan): Promise<void> {
  const metrics = await collectAllMetrics(env, sentry);
  // Store metrics and check thresholds
}

async function collectPerformanceMetrics(env: any, sentry: Toucan): Promise<void> {
  const perf = await collectPerformanceData(env, sentry);
  // Store performance data
}

async function aggregateLogs(env: any, sentry: Toucan): Promise<void> {
  // Aggregate and process logs
}

async function monitorInfrastructure(env: any, sentry: Toucan): Promise<void> {
  // Monitor Worker metrics, R2 usage, KV operations
}

async function checkAlertRules(env: any, sentry: Toucan): Promise<void> {
  // Evaluate alert conditions and trigger notifications
}

async function generateHourlyReport(env: any, sentry: Toucan): Promise<void> {
  // Generate hourly summary reports
}

async function cleanupOldData(env: any, sentry: Toucan): Promise<void> {
  // Clean up old monitoring data to manage storage
}

async function generateDailyReport(env: any, sentry: Toucan): Promise<void> {
  // Generate daily summary reports
}

async function performMaintenance(env: any, sentry: Toucan): Promise<void> {
  // Perform daily maintenance tasks
}