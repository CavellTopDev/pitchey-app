/**
 * Centralized Log Aggregation Service for Pitchey Platform
 * Handles log collection, processing, retention, and querying
 */

import { Toucan } from "toucan-js";

// Enhanced log entry interface
interface LogEntry {
  id: string;
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  message: string;
  timestamp: number;
  service: string;
  component?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  errorStack?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  environment: string;
}

interface LogQuery {
  level?: string;
  service?: string;
  component?: string;
  userId?: string;
  traceId?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
  search?: string;
  tags?: string[];
}

interface LogStats {
  totalLogs: number;
  errorCount: number;
  warnCount: number;
  services: Record<string, number>;
  timeRange: {
    start: number;
    end: number;
  };
}

export class LogAggregationService {
  private sentry: Toucan;
  private kv: any;
  private r2: any;

  constructor(sentry: Toucan, bindings: any) {
    this.sentry = sentry;
    this.kv = bindings.KV;
    this.r2 = bindings.R2_BUCKET;
  }

  /**
   * Ingest a new log entry
   */
  async ingestLog(logEntry: Partial<LogEntry>): Promise<void> {
    try {
      // Generate unique ID if not provided
      const id = logEntry.id || this.generateLogId();
      
      // Enrich log entry with defaults
      const enrichedLog: LogEntry = {
        id,
        level: logEntry.level || 'info',
        message: logEntry.message || '',
        timestamp: logEntry.timestamp || Date.now(),
        service: logEntry.service || 'unknown',
        environment: logEntry.environment || 'production',
        component: logEntry.component,
        userId: logEntry.userId,
        sessionId: logEntry.sessionId,
        traceId: logEntry.traceId,
        spanId: logEntry.spanId,
        requestId: logEntry.requestId,
        ipAddress: logEntry.ipAddress,
        userAgent: logEntry.userAgent,
        url: logEntry.url,
        method: logEntry.method,
        statusCode: logEntry.statusCode,
        responseTime: logEntry.responseTime,
        errorStack: logEntry.errorStack,
        metadata: logEntry.metadata || {},
        tags: logEntry.tags || []
      };

      // Validate log entry
      if (!this.validateLogEntry(enrichedLog)) {
        throw new Error('Invalid log entry format');
      }

      // Store in multiple locations for different access patterns
      await Promise.all([
        this.storeInKV(enrichedLog),
        this.storeInR2(enrichedLog),
        this.updateLogStats(enrichedLog),
        this.checkAlertConditions(enrichedLog)
      ]);

      // Send critical errors to Sentry
      if (enrichedLog.level === 'error') {
        this.sentry.captureMessage(enrichedLog.message, {
          level: 'error',
          tags: {
            service: enrichedLog.service,
            component: enrichedLog.component || 'unknown',
            environment: enrichedLog.environment
          },
          extra: {
            logId: enrichedLog.id,
            traceId: enrichedLog.traceId,
            metadata: enrichedLog.metadata
          },
          user: enrichedLog.userId ? { id: enrichedLog.userId } : undefined,
          request: enrichedLog.url ? {
            url: enrichedLog.url,
            method: enrichedLog.method,
            headers: {
              'User-Agent': enrichedLog.userAgent
            }
          } : undefined
        });
      }

    } catch (error) {
      this.sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Ingest multiple log entries in batch
   */
  async ingestBatch(logs: Partial<LogEntry>[]): Promise<void> {
    const batchSize = 100; // Process in chunks to avoid timeout
    
    for (let i = 0; i < logs.length; i += batchSize) {
      const batch = logs.slice(i, i + batchSize);
      await Promise.all(batch.map(log => this.ingestLog(log)));
    }
  }

  /**
   * Query logs with filtering and pagination
   */
  async queryLogs(query: LogQuery): Promise<{ logs: LogEntry[], total: number, hasMore: boolean }> {
    try {
      const { 
        level, 
        service, 
        component, 
        userId, 
        traceId, 
        startTime, 
        endTime, 
        limit = 100, 
        offset = 0,
        search,
        tags
      } = query;

      // Build KV query prefix based on filters
      let prefix = 'logs:';
      if (service) {
        prefix += `${service}:`;
      }

      // Get log keys from KV
      const kvList = await this.kv.list({ 
        prefix, 
        limit: 1000 // Get more than needed for filtering
      });

      // Filter and process logs
      const filteredLogs: LogEntry[] = [];
      let processedCount = 0;

      for (const key of kvList.keys) {
        if (filteredLogs.length >= limit + offset) break;

        const logData = await this.kv.get(key.name);
        if (!logData) continue;

        try {
          const log: LogEntry = JSON.parse(logData);

          // Apply filters
          if (level && log.level !== level) continue;
          if (component && log.component !== component) continue;
          if (userId && log.userId !== userId) continue;
          if (traceId && log.traceId !== traceId) continue;
          if (startTime && log.timestamp < startTime) continue;
          if (endTime && log.timestamp > endTime) continue;
          if (search && !this.matchesSearch(log, search)) continue;
          if (tags && !this.matchesTags(log, tags)) continue;

          processedCount++;

          // Apply pagination
          if (processedCount > offset) {
            filteredLogs.push(log);
          }

        } catch (parseError) {
          // Skip malformed log entries
          continue;
        }
      }

      // Sort by timestamp (newest first)
      filteredLogs.sort((a, b) => b.timestamp - a.timestamp);

      return {
        logs: filteredLogs.slice(0, limit),
        total: processedCount,
        hasMore: processedCount > limit + offset
      };

    } catch (error) {
      this.sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats(timeWindow: number = 3600000): Promise<LogStats> {
    try {
      const now = Date.now();
      const startTime = now - timeWindow;

      const statsKey = `log-stats:${Math.floor(startTime / 300000) * 300000}`; // 5-minute buckets
      let stats = await this.kv.get(statsKey);

      if (!stats) {
        // Calculate stats from logs
        const query: LogQuery = { startTime, endTime: now, limit: 10000 };
        const result = await this.queryLogs(query);
        
        const services: Record<string, number> = {};
        let errorCount = 0;
        let warnCount = 0;

        for (const log of result.logs) {
          services[log.service] = (services[log.service] || 0) + 1;
          if (log.level === 'error') errorCount++;
          if (log.level === 'warn') warnCount++;
        }

        const statsData: LogStats = {
          totalLogs: result.logs.length,
          errorCount,
          warnCount,
          services,
          timeRange: { start: startTime, end: now }
        };

        // Cache stats for 5 minutes
        await this.kv.put(statsKey, JSON.stringify(statsData), { expirationTtl: 300 });
        return statsData;
      }

      return JSON.parse(stats);

    } catch (error) {
      this.sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Search logs using full-text search
   */
  async searchLogs(searchQuery: string, limit: number = 100): Promise<LogEntry[]> {
    try {
      const query: LogQuery = { search: searchQuery, limit };
      const result = await this.queryLogs(query);
      return result.logs;
    } catch (error) {
      this.sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Get logs by trace ID for distributed tracing
   */
  async getTraceLog(traceId: string): Promise<LogEntry[]> {
    try {
      const query: LogQuery = { traceId, limit: 1000 };
      const result = await this.queryLogs(query);
      return result.logs.sort((a, b) => a.timestamp - b.timestamp); // Chronological order for traces
    } catch (error) {
      this.sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Clean up old logs based on retention policy
   */
  async cleanupOldLogs(retentionDays: number = 7): Promise<void> {
    try {
      const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
      const keysToDelete: string[] = [];

      // Get all log keys
      let cursor: string | undefined;
      do {
        const result = await this.kv.list({ 
          prefix: 'logs:', 
          cursor,
          limit: 1000 
        });

        for (const key of result.keys) {
          const logData = await this.kv.get(key.name);
          if (logData) {
            try {
              const log: LogEntry = JSON.parse(logData);
              if (log.timestamp < cutoffTime) {
                keysToDelete.push(key.name);
              }
            } catch {
              // Delete malformed entries
              keysToDelete.push(key.name);
            }
          }
        }

        cursor = result.cursor;
      } while (cursor);

      // Delete old logs in batches
      const batchSize = 100;
      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batch = keysToDelete.slice(i, i + batchSize);
        await Promise.all(batch.map(key => this.kv.delete(key)));
      }

      console.log(`Cleaned up ${keysToDelete.length} old log entries`);

    } catch (error) {
      this.sentry.captureException(error);
      throw error;
    }
  }

  // Private helper methods

  private generateLogId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private validateLogEntry(log: LogEntry): boolean {
    return !!(log.id && log.message && log.timestamp && log.service);
  }

  private async storeInKV(log: LogEntry): Promise<void> {
    const key = `logs:${log.service}:${log.timestamp}:${log.id}`;
    const ttl = 7 * 24 * 60 * 60; // 7 days
    await this.kv.put(key, JSON.stringify(log), { expirationTtl: ttl });
  }

  private async storeInR2(log: LogEntry): Promise<void> {
    try {
      // Store logs in R2 for long-term retention and analytics
      const date = new Date(log.timestamp);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const hour = date.getUTCHours().toString().padStart(2, '0');
      
      const key = `logs/${log.environment}/${dateStr}/${hour}/${log.service}/${log.id}.json`;
      
      await this.r2.put(key, JSON.stringify(log), {
        httpMetadata: {
          contentType: 'application/json',
          cacheControl: 'public, max-age=31536000' // 1 year
        },
        customMetadata: {
          service: log.service,
          level: log.level,
          component: log.component || 'unknown',
          timestamp: log.timestamp.toString()
        }
      });
    } catch (error) {
      // R2 storage failure shouldn't break log ingestion
      console.warn('Failed to store log in R2:', error.message);
    }
  }

  private async updateLogStats(log: LogEntry): Promise<void> {
    try {
      // Update real-time stats
      const statsKey = 'logs:stats:current';
      let stats = await this.kv.get(statsKey);
      
      const currentStats = stats ? JSON.parse(stats) : {
        totalLogs: 0,
        errorCount: 0,
        warnCount: 0,
        services: {},
        lastUpdated: Date.now()
      };

      currentStats.totalLogs++;
      if (log.level === 'error') currentStats.errorCount++;
      if (log.level === 'warn') currentStats.warnCount++;
      currentStats.services[log.service] = (currentStats.services[log.service] || 0) + 1;
      currentStats.lastUpdated = Date.now();

      await this.kv.put(statsKey, JSON.stringify(currentStats), { expirationTtl: 3600 });
    } catch (error) {
      // Stats update failure shouldn't break log ingestion
      console.warn('Failed to update log stats:', error.message);
    }
  }

  private async checkAlertConditions(log: LogEntry): Promise<void> {
    try {
      // Check for alert conditions
      if (log.level === 'error') {
        const alertKey = `alert:error:${log.service}:${Math.floor(Date.now() / 60000)}`;
        const errorCount = await this.kv.get(alertKey) || '0';
        const newCount = parseInt(errorCount) + 1;
        
        await this.kv.put(alertKey, newCount.toString(), { expirationTtl: 300 });

        // Trigger alert if error rate is high
        if (newCount >= 10) { // 10 errors per minute threshold
          await this.triggerAlert('high_error_rate', {
            service: log.service,
            errorCount: newCount,
            timeWindow: '1 minute'
          });
        }
      }
    } catch (error) {
      console.warn('Failed to check alert conditions:', error.message);
    }
  }

  private async triggerAlert(alertType: string, context: any): Promise<void> {
    try {
      const alert = {
        type: alertType,
        timestamp: Date.now(),
        context,
        status: 'triggered'
      };

      await this.kv.put(`alert:${alertType}:${Date.now()}`, JSON.stringify(alert), { expirationTtl: 86400 });

      // Send to Sentry
      this.sentry.captureMessage(`Alert triggered: ${alertType}`, {
        level: 'warning',
        tags: { alertType, service: context.service },
        extra: context
      });
    } catch (error) {
      console.warn('Failed to trigger alert:', error.message);
    }
  }

  private matchesSearch(log: LogEntry, search: string): boolean {
    const searchLower = search.toLowerCase();
    return (
      log.message.toLowerCase().includes(searchLower) ||
      log.service.toLowerCase().includes(searchLower) ||
      (log.component && log.component.toLowerCase().includes(searchLower)) ||
      (log.url && log.url.toLowerCase().includes(searchLower)) ||
      (log.errorStack && log.errorStack.toLowerCase().includes(searchLower))
    );
  }

  private matchesTags(log: LogEntry, tags: string[]): boolean {
    if (!log.tags || log.tags.length === 0) return false;
    return tags.some(tag => log.tags!.includes(tag));
  }
}

/**
 * Log Aggregation Worker
 * Handles HTTP requests for log ingestion and querying
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

    const logService = new LogAggregationService(sentry, env);
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/logs/ingest':
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
          }
          
          const logEntry = await request.json();
          await logService.ingestLog(logEntry);
          return new Response('Log ingested successfully', { status: 201 });

        case '/logs/batch':
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
          }
          
          const logEntries = await request.json();
          await logService.ingestBatch(logEntries);
          return new Response('Batch logs ingested successfully', { status: 201 });

        case '/logs/query':
          const query = Object.fromEntries(url.searchParams.entries());
          const result = await logService.queryLogs(query);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/logs/search':
          const searchQuery = url.searchParams.get('q');
          const limit = parseInt(url.searchParams.get('limit') || '100');
          
          if (!searchQuery) {
            return new Response('Missing search query', { status: 400 });
          }
          
          const searchResults = await logService.searchLogs(searchQuery, limit);
          return new Response(JSON.stringify(searchResults), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/logs/trace':
          const traceId = url.searchParams.get('traceId');
          
          if (!traceId) {
            return new Response('Missing traceId parameter', { status: 400 });
          }
          
          const traceLogs = await logService.getTraceLog(traceId);
          return new Response(JSON.stringify(traceLogs), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/logs/stats':
          const timeWindow = parseInt(url.searchParams.get('timeWindow') || '3600000');
          const stats = await logService.getLogStats(timeWindow);
          return new Response(JSON.stringify(stats), {
            headers: { 'Content-Type': 'application/json' }
          });

        default:
          return new Response('Endpoint not found', { status: 404 });
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

    const logService = new LogAggregationService(sentry, env);

    try {
      if (event.cron === "0 */6 * * *") { // Every 6 hours
        await logService.cleanupOldLogs(7); // Keep logs for 7 days
      }
    } catch (error) {
      sentry.captureException(error);
      throw error;
    }
  }
};