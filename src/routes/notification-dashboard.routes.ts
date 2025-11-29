/**
 * Notification Dashboard API Routes
 * Real-time metrics and analytics endpoints
 */

import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { notificationAnalytics } from "../services/notification-analytics.service";
import { notificationABTestingService } from "../services/notification-ab-testing.service";
import { notificationDigestService } from "../services/notification-digest.service";
import { db } from "../db/db";
import { notifications, notificationQueue, notificationPreferences } from "../db/schema-notifications";
import { users } from "../db/schema";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";
import { redis } from "../lib/redis";
import { WebSocketService } from "../services/websocket.service";

const dashboardRoutes = new Hono();
const wsService = WebSocketService.getInstance();

// Cache keys
const METRICS_CACHE_PREFIX = 'dashboard:metrics:';
const CACHE_TTL = 30; // 30 seconds for real-time data

// Time range parsers
const parseTimeRange = (range: string): { start: Date; end: Date } => {
  const now = new Date();
  const start = new Date();
  
  switch (range) {
    case '1h':
      start.setHours(now.getHours() - 1);
      break;
    case '24h':
      start.setDate(now.getDate() - 1);
      break;
    case '7d':
      start.setDate(now.getDate() - 7);
      break;
    case '30d':
      start.setDate(now.getDate() - 30);
      break;
    default:
      start.setDate(now.getDate() - 1);
  }
  
  return { start, end: now };
};

// Get real-time metrics
const getRealTimeMetrics = async () => {
  try {
    // Get active WebSocket connections
    const activeUsers = wsService.getActiveConnections().size;
    
    // Get queue metrics from Redis
    const queueSize = await redis?.llen('notification:queue') || 0;
    const processingRate = await redis?.get('metrics:processing_rate') || 0;
    
    // Calculate notifications per minute
    const recentNotifications = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(gte(notifications.createdAt, new Date(Date.now() - 60000)));
    
    const notificationsPerMinute = recentNotifications[0]?.count || 0;
    
    // Get error rate from last hour
    const errorMetrics = await db
      .select({
        total: sql<number>`count(*)`,
        failed: sql<number>`count(case when status = 'failed' then 1 end)`
      })
      .from(notificationQueue)
      .where(gte(notificationQueue.createdAt, new Date(Date.now() - 3600000)));
    
    const errorRate = errorMetrics[0]?.total > 0 
      ? (errorMetrics[0].failed / errorMetrics[0].total) * 100 
      : 0;
    
    // Get average delivery time
    const deliveryTime = await db
      .select({
        avgTime: sql<number>`avg(extract(epoch from (processed_at - created_at)) * 1000)`
      })
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.status, 'delivered'),
          gte(notificationQueue.createdAt, new Date(Date.now() - 3600000))
        )
      );
    
    return {
      activeUsers,
      notificationsPerMinute,
      queueSize: Number(queueSize),
      processingRate: Number(processingRate),
      errorRate,
      avgDeliveryTime: Math.round(deliveryTime[0]?.avgTime || 0)
    };
  } catch (error) {
    console.error('Error getting real-time metrics:', error);
    return {
      activeUsers: 0,
      notificationsPerMinute: 0,
      queueSize: 0,
      processingRate: 0,
      errorRate: 0,
      avgDeliveryTime: 0
    };
  }
};

// Get system health metrics
const getSystemHealth = async () => {
  try {
    // Check Redis connection
    const redisHealthy = await redis?.ping() === 'PONG';
    
    // Check database connection
    const dbHealthy = await db
      .select({ count: sql<number>`1` })
      .from(notifications)
      .limit(1)
      .then(() => true)
      .catch(() => false);
    
    // Get queue backlog
    const backlog = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificationQueue)
      .where(eq(notificationQueue.status, 'pending'));
    
    // Get error count from last hour
    const errors = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.status, 'failed'),
          gte(notificationQueue.createdAt, new Date(Date.now() - 3600000))
        )
      );
    
    // Calculate uptime (mock for demo, would use actual monitoring in production)
    const uptime = 99.9;
    
    // Determine overall status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (!dbHealthy || errors[0].count > 100) {
      status = 'critical';
    } else if (!redisHealthy || backlog[0].count > 1000 || errors[0].count > 10) {
      status = 'degraded';
    }
    
    // Get average latency
    const latency = await redis?.get('metrics:avg_latency') || 50;
    
    return {
      status,
      uptime,
      latency: Number(latency),
      queueBacklog: backlog[0].count,
      errorCount: errors[0].count
    };
  } catch (error) {
    console.error('Error getting system health:', error);
    return {
      status: 'critical' as const,
      uptime: 0,
      latency: 0,
      queueBacklog: 0,
      errorCount: 0
    };
  }
};

// Main dashboard endpoint
dashboardRoutes.get("/dashboard", requireAuth, requireRole(['admin']), async (c) => {
  try {
    const timeRange = c.req.header('X-Time-Range') || '24h';
    const channel = c.req.header('X-Channel') || 'all';
    const { start, end } = parseTimeRange(timeRange);
    
    // Check cache
    const cacheKey = `${METRICS_CACHE_PREFIX}${timeRange}:${channel}`;
    const cached = await redis?.get(cacheKey);
    if (cached) {
      return c.json(JSON.parse(cached));
    }
    
    // Get comprehensive metrics
    const [
      realtime,
      systemHealth,
      baseMetrics,
      experiments,
      digestStats
    ] = await Promise.all([
      getRealTimeMetrics(),
      getSystemHealth(),
      notificationAnalytics.getMetrics(start, end),
      notificationABTestingService.getActiveExperiments(),
      notificationDigestService.getDigestStats()
    ]);
    
    // Get hourly activity for chart
    const hourlyActivity = [];
    for (let i = 0; i < 24; i++) {
      const hour = new Date();
      hour.setHours(i, 0, 0, 0);
      const hourEnd = new Date(hour);
      hourEnd.setHours(i + 1, 0, 0, 0);
      
      const activity = await db
        .select({
          notifications: sql<number>`count(*)`,
          delivered: sql<number>`count(case when delivered = true then 1 end)`,
          read: sql<number>`count(case when is_read = true then 1 end)`
        })
        .from(notifications)
        .where(
          and(
            gte(notifications.createdAt, hour),
            lte(notifications.createdAt, hourEnd)
          )
        );
      
      hourlyActivity.push({
        hour: `${i}:00`,
        notifications: activity[0].notifications,
        delivered: activity[0].delivered,
        read: activity[0].read
      });
    }
    
    // Format response
    const response = {
      realtime,
      totals: {
        sent: baseMetrics.totalSent,
        delivered: baseMetrics.totalDelivered,
        read: baseMetrics.totalRead,
        clicked: baseMetrics.totalClicked,
        failed: baseMetrics.totalSent - baseMetrics.totalDelivered
      },
      rates: {
        delivery: baseMetrics.deliveryRate,
        read: baseMetrics.readRate,
        click: baseMetrics.clickRate,
        bounce: 1 - baseMetrics.deliveryRate
      },
      channels: Object.entries(baseMetrics.byChannel).map(([name, data]) => ({
        name,
        sent: data.sent,
        delivered: data.delivered,
        failed: data.failed,
        performance: data.delivered / data.sent * 100
      })),
      types: Object.entries(baseMetrics.byType).map(([type, data]) => ({
        type,
        count: data.sent,
        readRate: data.read / data.delivered,
        trend: 'stable' as const // Would calculate actual trend in production
      })),
      hourlyActivity,
      topUsers: baseMetrics.topUsers.map(user => ({
        id: user.userId,
        name: user.username,
        count: user.notificationCount,
        engagement: user.readRate * 100
      })),
      experiments: experiments.map(exp => ({
        id: exp.id,
        name: exp.name,
        status: exp.isActive ? 'active' : 'completed',
        variantA: exp.results.variantA.conversionRate * 100,
        variantB: exp.results.variantB.conversionRate * 100,
        winner: exp.results.winner,
        confidence: exp.results.confidence
      })),
      systemHealth
    };
    
    // Cache response
    if (redis) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
    }
    
    // Send real-time update via WebSocket
    wsService.broadcast({
      type: 'metrics_update',
      data: { realtime }
    });
    
    return c.json(response);
  } catch (error) {
    console.error('Dashboard error:', error);
    return c.json({ error: 'Failed to fetch dashboard metrics' }, 500);
  }
});

// Stream real-time updates via SSE
dashboardRoutes.get("/dashboard/stream", requireAuth, requireRole(['admin']), async (c) => {
  const stream = new ReadableStream({
    async start(controller) {
      const interval = setInterval(async () => {
        try {
          const metrics = await getRealTimeMetrics();
          const data = `data: ${JSON.stringify({ type: 'metrics_update', data: { realtime: metrics } })}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        } catch (error) {
          console.error('Stream error:', error);
        }
      }, 5000); // Update every 5 seconds
      
      // Cleanup on close
      c.req.raw.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
});

// Get specific metric details
dashboardRoutes.get("/dashboard/metrics/:type", requireAuth, requireRole(['admin']), async (c) => {
  const type = c.req.param('type');
  const timeRange = c.req.query('range') || '24h';
  const { start, end } = parseTimeRange(timeRange);
  
  try {
    let data;
    
    switch (type) {
      case 'conversion-funnel':
        const notificationType = c.req.query('notificationType') || 'all';
        data = await notificationAnalytics.getConversionFunnel(
          notificationType, 
          start, 
          end
        );
        break;
        
      case 'trending-types':
        const days = parseInt(c.req.query('days') || '7');
        data = await notificationAnalytics.getTrendingTypes(days);
        break;
        
      case 'delivery-performance':
        const hours = parseInt(c.req.query('hours') || '24');
        data = await notificationAnalytics.getDeliveryPerformance(hours);
        break;
        
      case 'user-engagement':
        const userId = parseInt(c.req.query('userId') || '0');
        if (!userId) {
          return c.json({ error: 'User ID required' }, 400);
        }
        data = await notificationAnalytics.getUserEngagement(userId);
        break;
        
      default:
        return c.json({ error: 'Unknown metric type' }, 400);
    }
    
    return c.json(data);
  } catch (error) {
    console.error(`Error fetching ${type} metrics:`, error);
    return c.json({ error: 'Failed to fetch metrics' }, 500);
  }
});

// Export metrics
dashboardRoutes.get("/dashboard/export", requireAuth, requireRole(['admin']), async (c) => {
  const format = c.req.query('format') || 'json';
  const timeRange = c.req.query('range') || '24h';
  const { start, end } = parseTimeRange(timeRange);
  
  try {
    const metrics = await notificationAnalytics.getMetrics(start, end);
    
    if (format === 'csv') {
      // Convert to CSV
      const csv = [
        'Metric,Value',
        `Total Sent,${metrics.totalSent}`,
        `Total Delivered,${metrics.totalDelivered}`,
        `Total Read,${metrics.totalRead}`,
        `Total Clicked,${metrics.totalClicked}`,
        `Delivery Rate,${metrics.deliveryRate}`,
        `Read Rate,${metrics.readRate}`,
        `Click Rate,${metrics.clickRate}`,
        `Avg Time to Read,${metrics.avgTimeToRead}`
      ].join('\n');
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="notification-metrics-${Date.now()}.csv"`
        }
      });
    } else {
      // Return as JSON
      return c.json(metrics);
    }
  } catch (error) {
    console.error('Export error:', error);
    return c.json({ error: 'Failed to export metrics' }, 500);
  }
});

// Trigger manual operations
dashboardRoutes.post("/dashboard/operations", requireAuth, requireRole(['admin']), async (c) => {
  const body = await c.req.json();
  const { operation, params } = body;
  
  try {
    let result;
    
    switch (operation) {
      case 'process-digest':
        if (params.frequency === 'daily') {
          await notificationDigestService.processDailyDigests();
        } else {
          await notificationDigestService.processWeeklyDigests();
        }
        result = { success: true, message: 'Digest processing started' };
        break;
        
      case 'clear-cache':
        const pattern = `${METRICS_CACHE_PREFIX}*`;
        await redis?.eval(`
          local keys = redis.call('keys', ARGV[1])
          for i=1,#keys,5000 do
            redis.call('del', unpack(keys, i, math.min(i+4999, #keys)))
          end
          return #keys
        `, 0, pattern);
        result = { success: true, message: 'Cache cleared' };
        break;
        
      case 'reprocess-failed':
        // Reprocess failed notifications
        const failed = await db
          .select()
          .from(notificationQueue)
          .where(eq(notificationQueue.status, 'failed'))
          .limit(100);
        
        for (const item of failed) {
          await db
            .update(notificationQueue)
            .set({ 
              status: 'pending', 
              attempts: 0,
              lastError: null,
              processedAt: null
            })
            .where(eq(notificationQueue.id, item.id));
        }
        
        result = { success: true, message: `Requeued ${failed.length} notifications` };
        break;
        
      default:
        return c.json({ error: 'Unknown operation' }, 400);
    }
    
    return c.json(result);
  } catch (error) {
    console.error('Operation error:', error);
    return c.json({ error: 'Operation failed' }, 500);
  }
});

export { dashboardRoutes };