/**
 * WebSocket Analytics Service
 * Comprehensive tracking and analysis of WebSocket events and metrics
 */

import { AnalyticsService } from "./analytics.service.ts";
import { redisService } from "./redis.service.ts";
import { captureException, addBreadcrumb } from "./logging.service.ts";
import { WSSession, WSMessage, WSMessageType } from "./websocket.service.ts";
import { PresenceStatus } from "./presence-tracking.service.ts";
import { MessagePriority } from "./message-queue.service.ts";
import { db } from "../db/client.ts";
import { analyticsEvents, users, pitches } from "../db/schema.ts";
import { eq, and, desc, sql, inArray, gte, lte } from "drizzle-orm";

// Analytics event types
export enum WSAnalyticsEventType {
  // Connection events
  CONNECTION_ESTABLISHED = "ws_connection_established",
  CONNECTION_LOST = "ws_connection_lost",
  CONNECTION_FAILED = "ws_connection_failed",
  RECONNECTION_ATTEMPT = "ws_reconnection_attempt",
  
  // Message events
  MESSAGE_SENT = "ws_message_sent",
  MESSAGE_RECEIVED = "ws_message_received",
  MESSAGE_FAILED = "ws_message_failed",
  MESSAGE_QUEUED = "ws_message_queued",
  MESSAGE_DELIVERED = "ws_message_delivered",
  
  // Presence events
  PRESENCE_CHANGED = "ws_presence_changed",
  USER_ACTIVITY = "ws_user_activity",
  
  // Feature usage
  TYPING_INDICATOR = "ws_typing_indicator",
  DRAFT_SYNC = "ws_draft_sync",
  NOTIFICATION_READ = "ws_notification_read",
  UPLOAD_PROGRESS = "ws_upload_progress",
  PITCH_VIEW = "ws_pitch_view",
  
  // Performance events
  LATENCY_MEASURED = "ws_latency_measured",
  RATE_LIMIT_HIT = "ws_rate_limit_hit",
  ERROR_OCCURRED = "ws_error_occurred",
  
  // System events
  SERVER_BROADCAST = "ws_server_broadcast",
  MAINTENANCE_MODE = "ws_maintenance_mode"
}

// Metrics data structure
export interface WSMetrics {
  timestamp: Date;
  totalConnections: number;
  activeUsers: number;
  messagesSent: number;
  messagesReceived: number;
  messagesQueued: number;
  avgLatency: number;
  errorRate: number;
  reconnectionRate: number;
  featureUsage: Record<string, number>;
  presenceDistribution: Record<PresenceStatus, number>;
}

// Session analytics data
export interface SessionAnalytics {
  sessionId: string;
  userId: number;
  userType: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  reconnections: number;
  features: string[];
  avgLatency: number;
  clientInfo: Record<string, any>;
}

// Real-time analytics dashboard data
export interface DashboardMetrics {
  connections: {
    total: number;
    byUserType: Record<string, number>;
    recentChanges: number;
  };
  messages: {
    totalSent: number;
    totalReceived: number;
    totalQueued: number;
    ratePerMinute: number;
    errorRate: number;
  };
  performance: {
    avgLatency: number;
    serverLoad: number;
    uptime: number;
  };
  features: {
    activeFeatures: string[];
    usageStats: Record<string, number>;
  };
  alerts: {
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: Date;
  }[];
}

/**
 * WebSocket Analytics Service Class
 */
export class WebSocketAnalyticsService {
  private metricsCache = new Map<string, any>();
  private sessionAnalytics = new Map<string, SessionAnalytics>();
  private realtimeMetrics: WSMetrics;
  private aggregationInterval: number = 0;
  private cleanupInterval: number = 0;
  
  // Performance tracking
  private latencyMeasurements: number[] = [];
  private messageCounters = {
    sent: 0,
    received: 0,
    queued: 0,
    errors: 0
  };

  constructor() {
    this.realtimeMetrics = this.initializeMetrics();
    this.setupIntervals();
    console.log("[WebSocket Analytics] Initialized");
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): WSMetrics {
    return {
      timestamp: new Date(),
      totalConnections: 0,
      activeUsers: 0,
      messagesSent: 0,
      messagesReceived: 0,
      messagesQueued: 0,
      avgLatency: 0,
      errorRate: 0,
      reconnectionRate: 0,
      featureUsage: {},
      presenceDistribution: {
        [PresenceStatus.ONLINE]: 0,
        [PresenceStatus.AWAY]: 0,
        [PresenceStatus.OFFLINE]: 0,
        [PresenceStatus.DO_NOT_DISTURB]: 0
      }
    };
  }

  /**
   * Setup periodic aggregation and cleanup
   */
  private setupIntervals(): void {
    // Aggregate metrics every minute
    this.aggregationInterval = setInterval(async () => {
      await this.aggregateMetrics();
    }, 60 * 1000);

    // Cleanup old data every hour
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupOldData();
    }, 60 * 60 * 1000);
  }

  /**
   * Track session start
   */
  async trackSessionStart(session: WSSession): Promise<void> {
    try {
      const sessionAnalytics: SessionAnalytics = {
        sessionId: session.id,
        userId: session.userId ?? 0,
        userType: session.userType,
        startTime: new Date(),
        duration: 0,
        messagesSent: 0,
        messagesReceived: 0,
        errors: 0,
        reconnections: 0,
        features: [],
        avgLatency: 0,
        clientInfo: session.clientInfo
      };

      this.sessionAnalytics.set(session.id, sessionAnalytics);

      // Track in base analytics
      await AnalyticsService.trackEvent({
        eventType: WSAnalyticsEventType.CONNECTION_ESTABLISHED,
        eventCategory: 'websocket',
        userId: session.userId ?? undefined,
        sessionId: session.id,
        eventData: {
          userType: session.userType,
          clientInfo: session.clientInfo,
          timestamp: new Date()
        }
      });

      // Update real-time metrics
      this.realtimeMetrics.totalConnections++;
      this.realtimeMetrics.activeUsers = new Set(
        Array.from(this.sessionAnalytics.values()).map(s => s.userId)
      ).size;

      console.log(`[WebSocket Analytics] Session started: ${session.id} for user ${session.userId}`);

    } catch (error) {
      console.error(`[WebSocket Analytics] Failed to track session start:`, error);
      if (error instanceof Error) {
        captureException(error, { service: 'WebSocketAnalytics' });
      }
    }
  }

  /**
   * Track session end
   */
  async trackSessionEnd(sessionId: string, reason?: string): Promise<void> {
    try {
      const sessionAnalytics = this.sessionAnalytics.get(sessionId);
      if (!sessionAnalytics) {
        return;
      }

      sessionAnalytics.endTime = new Date();
      sessionAnalytics.duration = sessionAnalytics.endTime.getTime() - sessionAnalytics.startTime.getTime();

      // Track in base analytics
      await AnalyticsService.trackEvent({
        eventType: WSAnalyticsEventType.CONNECTION_LOST,
        eventCategory: 'websocket',
        userId: sessionAnalytics.userId,
        sessionId,
        eventData: {
          duration: sessionAnalytics.duration,
          messagesSent: sessionAnalytics.messagesSent,
          messagesReceived: sessionAnalytics.messagesReceived,
          errors: sessionAnalytics.errors,
          reason,
          timestamp: new Date()
        }
      });

      // Store session summary in Redis for analysis
      await this.storeSessionSummary(sessionAnalytics);

      // Update real-time metrics
      this.realtimeMetrics.totalConnections--;
      this.realtimeMetrics.activeUsers = new Set(
        Array.from(this.sessionAnalytics.values())
          .filter(s => s.sessionId !== sessionId)
          .map(s => s.userId)
      ).size;

      // Remove from tracking
      this.sessionAnalytics.delete(sessionId);

      console.log(`[WebSocket Analytics] Session ended: ${sessionId} (duration: ${sessionAnalytics.duration}ms)`);

    } catch (error) {
      console.error(`[WebSocket Analytics] Failed to track session end:`, error);
      if (error instanceof Error) {
        captureException(error, { service: 'WebSocketAnalytics' });
      }
    }
  }

  /**
   * Track message event
   */
  async trackMessage(
    sessionId: string,
    message: WSMessage,
    direction: 'sent' | 'received',
    latency?: number
  ): Promise<void> {
    try {
      const sessionAnalytics = this.sessionAnalytics.get(sessionId);
      if (sessionAnalytics) {
        if (direction === 'sent') {
          sessionAnalytics.messagesSent++;
        } else {
          sessionAnalytics.messagesReceived++;
        }

        // Track feature usage
        if (!sessionAnalytics.features.includes(message.type)) {
          sessionAnalytics.features.push(message.type);
        }

        // Update latency
        if (latency) {
          this.latencyMeasurements.push(latency);
          if (this.latencyMeasurements.length > 100) {
            this.latencyMeasurements.shift();
          }
        }
      }

      // Update global counters
      if (direction === 'sent') {
        this.messageCounters.sent++;
        this.realtimeMetrics.messagesSent++;
      } else {
        this.messageCounters.received++;
        this.realtimeMetrics.messagesReceived++;
      }

      // Track feature usage globally
      const featureKey = message.type;
      this.realtimeMetrics.featureUsage[featureKey] = 
        (this.realtimeMetrics.featureUsage[featureKey] || 0) + 1;

      // Track in base analytics for important message types
      if (this.shouldTrackMessage(message.type)) {
        await AnalyticsService.trackEvent({
          eventType: direction === 'sent' ? WSAnalyticsEventType.MESSAGE_SENT : WSAnalyticsEventType.MESSAGE_RECEIVED,
          eventCategory: 'websocket',
          userId: sessionAnalytics?.userId,
          sessionId,
          eventData: {
            messageType: message.type,
            messageId: message.messageId,
            latency,
            timestamp: new Date()
          }
        });
      }

    } catch (error) {
      console.error(`[WebSocket Analytics] Failed to track message:`, error);
      if (error instanceof Error) {
        captureException(error, { service: 'WebSocketAnalytics' });
      }
    }
  }

  /**
   * Track error event
   */
  async trackError(
    sessionId: string,
    errorType: string,
    errorMessage: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      const sessionAnalytics = this.sessionAnalytics.get(sessionId);
      if (sessionAnalytics) {
        sessionAnalytics.errors++;
      }

      // Update global error counter
      this.messageCounters.errors++;
      this.realtimeMetrics.errorRate = this.messageCounters.errors / 
        (this.messageCounters.sent + this.messageCounters.received + 1);

      // Track in base analytics
      await AnalyticsService.trackEvent({
        eventType: WSAnalyticsEventType.ERROR_OCCURRED,
        eventCategory: 'websocket',
        userId: sessionAnalytics?.userId,
        sessionId,
        eventData: {
          errorType,
          errorMessage,
          context,
          timestamp: new Date()
        }
      });

      // Log to console for debugging
      addBreadcrumb({
        category: 'websocket.error',
        message: errorMessage,
        level: 'error',
        data: { errorType, sessionId, context }
      });

    } catch (error) {
      console.error(`[WebSocket Analytics] Failed to track error:`, error);
      if (error instanceof Error) {
        captureException(error, { service: 'WebSocketAnalytics' });
      }
    }
  }

  /**
   * Track latency measurement
   */
  async trackLatency(sessionId: string, latency: number, messageType?: WSMessageType): Promise<void> {
    try {
      this.latencyMeasurements.push(latency);
      
      // Keep only last 1000 measurements
      if (this.latencyMeasurements.length > 1000) {
        this.latencyMeasurements.shift();
      }

      // Update average latency
      this.realtimeMetrics.avgLatency = this.latencyMeasurements.reduce((a, b) => a + b, 0) / 
        this.latencyMeasurements.length;

      // Track session latency
      const sessionAnalytics = this.sessionAnalytics.get(sessionId);
      if (sessionAnalytics) {
        sessionAnalytics.avgLatency = this.realtimeMetrics.avgLatency;
      }

      // Track significant latency spikes
      if (latency > 5000) { // 5 seconds
        await AnalyticsService.trackEvent({
          eventType: WSAnalyticsEventType.LATENCY_MEASURED,
          eventCategory: 'websocket',
          userId: sessionAnalytics?.userId,
          sessionId,
          eventData: {
            latency,
            messageType,
            isSpike: true,
            timestamp: new Date()
          }
        });
      }

    } catch (error) {
      console.error(`[WebSocket Analytics] Failed to track latency:`, error);
      if (error instanceof Error) {
        captureException(error, { service: 'WebSocketAnalytics' });
      }
    }
  }

  /**
   * Track rate limit hit
   */
  async trackRateLimit(
    sessionId: string,
    messageType: WSMessageType,
    limitType: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await AnalyticsService.trackEvent({
        eventType: WSAnalyticsEventType.RATE_LIMIT_HIT,
        eventCategory: 'websocket',
        userId: this.sessionAnalytics.get(sessionId)?.userId,
        sessionId,
        eventData: {
          messageType,
          limitType,
          details,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error(`[WebSocket Analytics] Failed to track rate limit:`, error);
      if (error instanceof Error) {
        captureException(error, { service: 'WebSocketAnalytics' });
      }
    }
  }

  /**
   * Track presence change
   */
  async trackPresenceChange(
    userId: number,
    oldStatus: PresenceStatus,
    newStatus: PresenceStatus,
    sessionId?: string
  ): Promise<void> {
    try {
      // Update presence distribution
      if (oldStatus !== PresenceStatus.OFFLINE) {
        this.realtimeMetrics.presenceDistribution[oldStatus]--;
      }
      this.realtimeMetrics.presenceDistribution[newStatus]++;

      await AnalyticsService.trackEvent({
        eventType: WSAnalyticsEventType.PRESENCE_CHANGED,
        eventCategory: 'websocket',
        userId,
        sessionId,
        eventData: {
          oldStatus,
          newStatus,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error(`[WebSocket Analytics] Failed to track presence change:`, error);
      if (error instanceof Error) {
        captureException(error, { service: 'WebSocketAnalytics' });
      }
    }
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(
    sessionId: string,
    feature: string,
    action: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const sessionAnalytics = this.sessionAnalytics.get(sessionId);
      if (sessionAnalytics && !sessionAnalytics.features.includes(feature)) {
        sessionAnalytics.features.push(feature);
      }

      // Update global feature usage
      const featureKey = `${feature}_${action}`;
      this.realtimeMetrics.featureUsage[featureKey] = 
        (this.realtimeMetrics.featureUsage[featureKey] || 0) + 1;

      await AnalyticsService.trackEvent({
        eventType: WSAnalyticsEventType.USER_ACTIVITY,
        eventCategory: 'websocket',
        userId: sessionAnalytics?.userId,
        sessionId,
        eventData: {
          feature,
          action,
          metadata,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error(`[WebSocket Analytics] Failed to track feature usage:`, error);
      if (error instanceof Error) {
        captureException(error, { service: 'WebSocketAnalytics' });
      }
    }
  }

  /**
   * Get real-time dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      const recentMinute = Date.now() - 60000;
      const recentConnections = Array.from(this.sessionAnalytics.values())
        .filter(s => s.startTime.getTime() > recentMinute).length;

      const userTypeCounts = Array.from(this.sessionAnalytics.values())
        .reduce((acc, session) => {
          acc[session.userType] = (acc[session.userType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      const messagesPerMinute = this.messageCounters.sent + this.messageCounters.received;

      return {
        connections: {
          total: this.realtimeMetrics.totalConnections,
          byUserType: userTypeCounts,
          recentChanges: recentConnections
        },
        messages: {
          totalSent: this.realtimeMetrics.messagesSent,
          totalReceived: this.realtimeMetrics.messagesReceived,
          totalQueued: this.realtimeMetrics.messagesQueued,
          ratePerMinute: messagesPerMinute,
          errorRate: this.realtimeMetrics.errorRate
        },
        performance: {
          avgLatency: this.realtimeMetrics.avgLatency,
          serverLoad: await this.calculateServerLoad(),
          uptime: this.getUptime()
        },
        features: {
          activeFeatures: Object.keys(this.realtimeMetrics.featureUsage),
          usageStats: this.realtimeMetrics.featureUsage
        },
        alerts: await this.generateAlerts()
      };

    } catch (error) {
      console.error(`[WebSocket Analytics] Failed to get dashboard metrics:`, error);
      return this.getDefaultDashboardMetrics();
    }
  }

  /**
   * Get analytics summary for time period
   */
  async getAnalyticsSummary(
    startDate: Date,
    endDate: Date,
    userId?: number
  ): Promise<{
    sessions: number;
    messages: number;
    features: string[];
    avgLatency: number;
    errors: number;
    topFeatures: { feature: string; usage: number }[];
  }> {
    try {
      // Query analytics events from database
      let query = db.select()
        .from(analyticsEvents)
        .where(and(
          gte(analyticsEvents.createdAt, startDate),
          lte(analyticsEvents.createdAt, endDate)
        ));

      if (userId) {
        query = query.where(eq(analyticsEvents.userId, userId));
      }

      const events = await query;

      // Aggregate data
      const sessions = new Set(events.map((e: any) => e.sessionId).filter(Boolean)).size;
      const messages = events.filter((e: any) => 
        e.eventType.includes('message_sent') || e.eventType.includes('message_received')
      ).length;
      
      const features = new Set(
        events.map((e: any) => e.eventData?.messageType || e.eventData?.feature).filter(Boolean)
      );

      const latencies = events
        .map((e: any) => e.eventData?.latency)
        .filter((l: any) => typeof l === 'number') as number[];
      
      const avgLatency = latencies.length > 0 ? 
        latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length : 0;

      const errors = events.filter((e: any) => e.eventType.includes('error')).length;

      // Calculate top features
      const featureUsage = events.reduce((acc: Record<string, number>, event: any) => {
        const feature = event.eventData?.messageType || event.eventData?.feature;
        if (feature) {
          acc[feature] = (acc[feature] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const topFeatures = Object.entries(featureUsage)
        .map(([feature, usage]) => ({ feature, usage: Number(usage) }))
        .sort((a, b) => Number(b.usage) - Number(a.usage))
        .slice(0, 10);

      return {
        sessions,
        messages,
        features: Array.from(features) as string[],
        avgLatency,
        errors,
        topFeatures
      };

    } catch (error) {
      console.error(`[WebSocket Analytics] Failed to get analytics summary:`, error);
      return {
        sessions: 0,
        messages: 0,
        features: [],
        avgLatency: 0,
        errors: 0,
        topFeatures: []
      };
    }
  }

  /**
   * Store session summary in Redis
   */
  private async storeSessionSummary(sessionAnalytics: SessionAnalytics): Promise<void> {
    try {
      const summaryKey = `pitchey:session_summary:${sessionAnalytics.sessionId}`;
      await redisService.set(summaryKey, sessionAnalytics, 24 * 3600); // 24 hours TTL
    } catch (error) {
      console.error(`[WebSocket Analytics] Failed to store session summary:`, error);
    }
  }

  /**
   * Check if message type should be tracked
   */
  private shouldTrackMessage(messageType: WSMessageType): boolean {
    // Don't track high-frequency, low-value messages
    const skipTypes = [WSMessageType.PING, WSMessageType.PONG];
    return !skipTypes.includes(messageType);
  }

  /**
   * Aggregate metrics periodically
   */
  private async aggregateMetrics(): Promise<void> {
    try {
      // Store current metrics in Redis for historical analysis
      const metricsKey = `pitchey:metrics:${Date.now()}`;
      await redisService.set(metricsKey, this.realtimeMetrics, 24 * 3600); // 24 hours TTL

      // Reset counters for next period
      this.messageCounters = {
        sent: 0,
        received: 0,
        queued: 0,
        errors: 0
      };

      this.realtimeMetrics.timestamp = new Date();

    } catch (error) {
      console.error(`[WebSocket Analytics] Failed to aggregate metrics:`, error);
      if (error instanceof Error) {
        captureException(error, { service: 'WebSocketAnalytics' });
      }
    }
  }

  /**
   * Clean up old analytics data
   */
  private async cleanupOldData(): Promise<void> {
    try {
      // Clean up session analytics older than 24 hours
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      
      for (const [sessionId, analytics] of this.sessionAnalytics.entries()) {
        if (analytics.startTime.getTime() < dayAgo) {
          this.sessionAnalytics.delete(sessionId);
        }
      }

      console.log(`[WebSocket Analytics] Cleaned up old analytics data`);

    } catch (error) {
      console.error(`[WebSocket Analytics] Failed to cleanup old data:`, error);
      if (error instanceof Error) {
        captureException(error, { service: 'WebSocketAnalytics' });
      }
    }
  }

  /**
   * Calculate server load (placeholder)
   */
  private async calculateServerLoad(): Promise<number> {
    // In a real implementation, this would check CPU, memory, etc.
    const connectionLoad = this.realtimeMetrics.totalConnections / 1000; // Assume 1000 is max
    const messageLoad = (this.messageCounters.sent + this.messageCounters.received) / 10000; // Per minute
    return Math.min(100, (connectionLoad + messageLoad) * 100);
  }

  /**
   * Get server uptime
   */
  private getUptime(): number {
    return process.uptime ? process.uptime() : 0;
  }

  /**
   * Generate system alerts
   */
  private async generateAlerts(): Promise<DashboardMetrics['alerts']> {
    const alerts: DashboardMetrics['alerts'] = [];

    // High error rate alert
    if (this.realtimeMetrics.errorRate > 0.05) { // 5%
      alerts.push({
        level: 'error',
        message: `High error rate detected: ${(this.realtimeMetrics.errorRate * 100).toFixed(2)}%`,
        timestamp: new Date()
      });
    }

    // High latency alert
    if (this.realtimeMetrics.avgLatency > 3000) { // 3 seconds
      alerts.push({
        level: 'warning',
        message: `High average latency: ${this.realtimeMetrics.avgLatency.toFixed(0)}ms`,
        timestamp: new Date()
      });
    }

    // High connection count
    if (this.realtimeMetrics.totalConnections > 500) {
      alerts.push({
        level: 'info',
        message: `High connection count: ${this.realtimeMetrics.totalConnections} active connections`,
        timestamp: new Date()
      });
    }

    return alerts;
  }

  /**
   * Get default dashboard metrics
   */
  private getDefaultDashboardMetrics(): DashboardMetrics {
    return {
      connections: { total: 0, byUserType: {}, recentChanges: 0 },
      messages: { totalSent: 0, totalReceived: 0, totalQueued: 0, ratePerMinute: 0, errorRate: 0 },
      performance: { avgLatency: 0, serverLoad: 0, uptime: 0 },
      features: { activeFeatures: [], usageStats: {} },
      alerts: []
    };
  }

  /**
   * Shutdown analytics service
   */
  async shutdown(): Promise<void> {
    console.log("[WebSocket Analytics] Shutting down...");
    
    clearInterval(this.aggregationInterval);
    clearInterval(this.cleanupInterval);
    
    // Store final metrics
    await this.aggregateMetrics();
    
    // Clear caches
    this.sessionAnalytics.clear();
    this.metricsCache.clear();
    this.latencyMeasurements = [];
    
    console.log("[WebSocket Analytics] Shutdown complete");
  }
}

// Export singleton instance
export const webSocketAnalyticsService = new WebSocketAnalyticsService();
export default webSocketAnalyticsService;