/**
 * Scheduled Task Handler for Cloudflare Workers
 * Handles all cron-triggered tasks
 */

import { CacheWarmer, DEFAULT_WARMING_CONFIG } from './cache-warmer.ts';
import { EdgeCacheLayer } from './worker-cache-layer.ts';
import { Toucan } from 'toucan-js';

export interface ScheduledTask {
  name: string;
  schedule: string;
  handler: (event: ScheduledEvent, env: any, ctx: ExecutionContext) => Promise<void>;
  enabled: boolean;
}

// Task implementations
const scheduledTasks: Record<string, ScheduledTask> = {
  cacheWarming: {
    name: 'Cache Warming',
    schedule: '*/5 * * * *',
    enabled: true,
    handler: async (event, env, ctx) => {
      console.log('[Scheduled] Starting cache warming task');
      
      const sentry = env.SENTRY_DSN ? new Toucan({
        dsn: env.SENTRY_DSN,
        context: ctx,
        environment: env.SENTRY_ENVIRONMENT || 'production'
      }) : undefined;
      
      try {
        const cache = new EdgeCacheLayer(env.PITCHEY_KV || null, sentry);
        const warmer = new CacheWarmer(cache, DEFAULT_WARMING_CONFIG, sentry);
        
        const result = await warmer.warmCache(env);
        
        // Store results in KV for monitoring
        if (env.METRICS_KV) {
          await env.METRICS_KV.put(
            `cache_warming_${Date.now()}`,
            JSON.stringify(result),
            { expirationTtl: 86400 } // Keep for 24 hours
          );
        }
        
        console.log(`[Scheduled] Cache warming completed: ${result.message}`);
      } catch (error) {
        console.error('[Scheduled] Cache warming failed:', error);
        if (sentry) {
          sentry.captureException(error);
        }
      }
    }
  },

  healthCheck: {
    name: 'Health Check',
    schedule: '*/2 * * * *',
    enabled: true,
    handler: async (event, env, ctx) => {
      console.log('[Scheduled] Running health checks');
      
      const endpoints = [
        '/api/db-test',
        '/api/pitches/trending?limit=1',
        '/api/pitches/new?limit=1'
      ];
      
      const results = await Promise.allSettled(
        endpoints.map(async (endpoint) => {
          const url = `${env.WORKER_URL || 'https://pitchey-api-prod.ndlovucavelle.workers.dev'}${endpoint}`;
          const response = await fetch(url, {
            signal: AbortSignal.timeout(5000)
          });
          
          return {
            endpoint,
            status: response.status,
            ok: response.ok,
            time: Date.now()
          };
        })
      );
      
      // Check for failures
      const failures = results.filter(r => 
        r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
      );
      
      if (failures.length > 0) {
        console.error(`[Scheduled] Health check failures: ${failures.length}/${endpoints.length}`);
        
        // Send alert if configured
        if (env.SLACK_WEBHOOK_URL) {
          await sendSlackAlert(env.SLACK_WEBHOOK_URL, {
            text: '🚨 Health Check Alert',
            blocks: [{
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Health check failed*\nFailures: ${failures.length}/${endpoints.length}\nTime: ${new Date().toISOString()}`
              }
            }]
          });
        }
      } else {
        console.log('[Scheduled] All health checks passed');
      }
      
      // Store results
      if (env.METRICS_KV) {
        await env.METRICS_KV.put(
          `health_check_${Date.now()}`,
          JSON.stringify({ results, timestamp: Date.now() }),
          { expirationTtl: 86400 }
        );
      }
    }
  },

  cacheCleanup: {
    name: 'Cache Cleanup',
    schedule: '0 * * * *',
    enabled: true,
    handler: async (event, env, ctx) => {
      console.log('[Scheduled] Starting cache cleanup');
      
      if (!env.PITCHEY_KV) {
        console.log('[Scheduled] No KV namespace, skipping cleanup');
        return;
      }
      
      try {
        // List all keys
        const list = await env.PITCHEY_KV.list();
        let deletedCount = 0;
        
        for (const key of list.keys) {
          // Check if key has metadata
          const { metadata } = await env.PITCHEY_KV.getWithMetadata(key.name);
          
          if (metadata && metadata.timestamp) {
            const age = Date.now() - metadata.timestamp;
            const maxAge = 3600000; // 1 hour
            
            if (age > maxAge) {
              await env.PITCHEY_KV.delete(key.name);
              deletedCount++;
            }
          }
        }
        
        console.log(`[Scheduled] Cache cleanup completed: ${deletedCount} keys deleted`);
      } catch (error) {
        console.error('[Scheduled] Cache cleanup failed:', error);
      }
    }
  },

  metricsCollection: {
    name: 'Metrics Collection',
    schedule: '*/15 * * * *',
    enabled: true,
    handler: async (event, env, ctx) => {
      console.log('[Scheduled] Collecting performance metrics');
      
      const metrics = {
        timestamp: Date.now(),
        cache: {},
        database: {},
        requests: {}
      };
      
      // Collect cache stats
      if (env.PITCHEY_KV) {
        try {
          const cacheStats = await env.PITCHEY_KV.get('cache_stats', 'json');
          metrics.cache = cacheStats || {};
        } catch (error) {
          console.error('[Scheduled] Failed to get cache stats:', error);
        }
      }
      
      // Collect database pool stats
      try {
        const poolStats = await fetch(`${env.WORKER_URL || 'https://pitchey-api-prod.ndlovucavelle.workers.dev'}/api/pool/stats`);
        if (poolStats.ok) {
          metrics.database = await poolStats.json();
        }
      } catch (error) {
        console.error('[Scheduled] Failed to get pool stats:', error);
      }
      
      // Store metrics
      if (env.ANALYTICS) {
        env.ANALYTICS.writeDataPoint({
          doubles: [
            metrics.cache.hitRate || 0,
            metrics.database.activeConnections || 0
          ],
          blobs: [JSON.stringify(metrics)]
        });
      }
      
      // Store in KV for dashboard
      if (env.METRICS_KV) {
        await env.METRICS_KV.put(
          `metrics_${Date.now()}`,
          JSON.stringify(metrics),
          { expirationTtl: 604800 } // Keep for 7 days
        );
      }
      
      console.log('[Scheduled] Metrics collection completed');
    }
  },

  connectionPoolHealth: {
    name: 'Connection Pool Health',
    schedule: '*/10 * * * *',
    enabled: true,
    handler: async (event, env, ctx) => {
      console.log('[Scheduled] Checking connection pool health');
      
      try {
        // Test database connection
        const { dbPool } = await import('./worker-database-pool-enhanced.ts');
        const testQuery = await dbPool.testConnection(env);
        
        if (!testQuery.success) {
          console.error('[Scheduled] Database connection test failed');
          
          // Try to reset the pool
          await dbPool.reset();
          console.log('[Scheduled] Connection pool reset');
          
          // Send alert
          if (env.SLACK_WEBHOOK_URL) {
            await sendSlackAlert(env.SLACK_WEBHOOK_URL, {
              text: '⚠️ Database Connection Issue',
              blocks: [{
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Connection pool health check failed*\nPool has been reset\nTime: ${new Date().toISOString()}`
                }
              }]
            });
          }
        } else {
          console.log('[Scheduled] Connection pool healthy');
        }
        
        // Get pool stats
        const stats = dbPool.getStats();
        
        // Store stats
        if (env.METRICS_KV) {
          await env.METRICS_KV.put(
            `pool_health_${Date.now()}`,
            JSON.stringify({ ...stats, timestamp: Date.now() }),
            { expirationTtl: 86400 }
          );
        }
      } catch (error) {
        console.error('[Scheduled] Connection pool health check failed:', error);
      }
    }
  }
};

// Helper function to send Slack alerts
async function sendSlackAlert(webhookUrl: string, payload: any): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      console.error('Failed to send Slack alert:', response.statusText);
    }
  } catch (error) {
    console.error('Error sending Slack alert:', error);
  }
}

// Main scheduled handler
export async function scheduled(
  event: ScheduledEvent,
  env: any,
  ctx: ExecutionContext
): Promise<void> {
  console.log(`[Scheduled] Cron triggered at ${new Date().toISOString()}`);
  console.log(`[Scheduled] Cron expression: ${event.cron}`);
  
  // Map cron expressions to tasks
  const cronToTask: Record<string, string> = {
    '*/5 * * * *': 'cacheWarming',
    '*/2 * * * *': 'healthCheck',
    '0 * * * *': 'cacheCleanup',
    '*/15 * * * *': 'metricsCollection',
    '*/10 * * * *': 'connectionPoolHealth'
  };
  
  const taskName = cronToTask[event.cron];
  
  if (!taskName) {
    console.log(`[Scheduled] No task mapped for cron: ${event.cron}`);
    return;
  }
  
  const task = scheduledTasks[taskName];
  
  if (!task || !task.enabled) {
    console.log(`[Scheduled] Task ${taskName} is disabled or not found`);
    return;
  }
  
  console.log(`[Scheduled] Executing task: ${task.name}`);
  
  try {
    await task.handler(event, env, ctx);
    console.log(`[Scheduled] Task ${task.name} completed successfully`);
  } catch (error) {
    console.error(`[Scheduled] Task ${task.name} failed:`, error);
    
    // Report error to Sentry if configured
    if (env.SENTRY_DSN) {
      const sentry = new Toucan({
        dsn: env.SENTRY_DSN,
        context: ctx,
        environment: env.SENTRY_ENVIRONMENT || 'production'
      });
      
      sentry.captureException(error, {
        tags: {
          task: task.name,
          cron: event.cron
        }
      });
    }
  }
}

// Export for Worker
export default {
  scheduled
};