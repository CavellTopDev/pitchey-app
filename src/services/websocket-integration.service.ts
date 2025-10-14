/**
 * WebSocket Integration Service
 * Integrates the WebSocket server with the existing HTTP server and provides unified API
 */

import { pitcheyWebSocketServer, WSMessage, WSMessageType } from "./websocket.service.ts";
import { webSocketRateLimiter } from "../middleware/websocket-rate-limiter.ts";
import { webSocketMessageRouter } from "./websocket-message-router.ts";
import { webSocketRedisService } from "./websocket-redis.service.ts";
import { presenceTrackingService, PresenceStatus } from "./presence-tracking.service.ts";
import { messageQueueService, MessagePriority } from "./message-queue.service.ts";
import { webSocketAnalyticsService } from "./websocket-analytics.service.ts";
import { webSocketErrorHandler, WSErrorCode } from "./websocket-error-handler.service.ts";
import { verifyToken } from "../utils/jwt.ts";
import { sentryService, captureException } from "./sentry.service.ts";

/**
 * WebSocket Integration Service Class
 * Provides a unified interface for WebSocket functionality
 */
export class WebSocketIntegrationService {
  private isInitialized = false;
  private httpServer: any = null;

  constructor() {
    console.log("[WebSocket Integration] Service created");
  }

  /**
   * Initialize WebSocket integration with HTTP server
   */
  async initialize(httpServer?: any): Promise<void> {
    if (this.isInitialized) {
      console.warn("[WebSocket Integration] Already initialized");
      return;
    }

    try {
      this.httpServer = httpServer;

      // Initialize all WebSocket services
      console.log("[WebSocket Integration] Initializing WebSocket services...");

      // Services are already initialized in their constructors
      // This is where we could add any additional setup if needed

      this.isInitialized = true;
      console.log("[WebSocket Integration] WebSocket integration initialized successfully");

    } catch (error) {
      console.error("[WebSocket Integration] Failed to initialize:", error);
      captureException(error);
      throw error;
    }
  }

  /**
   * Handle WebSocket upgrade request
   */
  async handleWebSocketUpgrade(request: Request): Promise<Response> {
    try {
      // Extract the WebSocket key from headers
      const upgrade = request.headers.get("upgrade");
      const connection = request.headers.get("connection");
      const webSocketKey = request.headers.get("sec-websocket-key");

      if (
        upgrade !== "websocket" ||
        !connection?.toLowerCase().includes("upgrade") ||
        !webSocketKey
      ) {
        return new Response("Invalid WebSocket request", { status: 400 });
      }

      // AUTHENTICATION: Verify JWT token from query parameter
      const url = new URL(request.url);
      const token = url.searchParams.get("token");
      
      if (!token) {
        return new Response(
          JSON.stringify({ error: "Authentication token required" }), 
          { 
            status: 401, 
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      // Verify the JWT token using the same logic as the main server
      try {
        const verified = await verifyToken(token);
        if (!verified || !verified.userId) {
          return new Response(
            JSON.stringify({ error: "Invalid authentication token" }), 
            { 
              status: 401,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
      } catch (authError) {
        console.error("[WebSocket Integration] Authentication failed:", authError);
        return new Response(
          JSON.stringify({ error: "Authentication failed" }), 
          { 
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      // Create WebSocket pair
      const { socket, response } = Deno.upgradeWebSocket(request);

      // Handle the WebSocket connection
      await this.setupWebSocketConnection(socket, request);

      return response;

    } catch (error) {
      console.error("[WebSocket Integration] WebSocket upgrade failed:", error);
      
      const wsError = await webSocketErrorHandler.handleError(error, {
        operation: "websocket_upgrade"
      });

      return new Response("WebSocket upgrade failed", { status: 500 });
    }
  }

  /**
   * Setup WebSocket connection handlers
   */
  private async setupWebSocketConnection(socket: WebSocket, request: Request): Promise<void> {
    let sessionId: string | null = null;

    socket.onopen = async () => {
      try {
        // Handle connection through the main WebSocket server
        await pitcheyWebSocketServer.handleConnection(socket, request);
      } catch (error) {
        console.error("[WebSocket Integration] Connection setup failed:", error);
        socket.close(1011, "Connection setup failed");
      }
    };

    socket.onmessage = async (event) => {
      try {
        // The main WebSocket server will handle message processing
        // This is just a pass-through
      } catch (error) {
        console.error("[WebSocket Integration] Message handling failed:", error);
        await this.sendErrorToSocket(socket, error);
      }
    };

    socket.onclose = async (event) => {
      try {
        // Handle disconnection cleanup
        if (sessionId) {
          await this.handleSessionCleanup(sessionId, event.code, event.reason);
        }
      } catch (error) {
        console.error("[WebSocket Integration] Disconnect cleanup failed:", error);
        captureException(error);
      }
    };

    socket.onerror = async (event) => {
      console.error("[WebSocket Integration] Socket error:", event);
      await webSocketErrorHandler.handleError(
        new Error("WebSocket error occurred"),
        { operation: "socket_error" }
      );
    };
  }

  /**
   * Send error message to WebSocket
   */
  private async sendErrorToSocket(socket: WebSocket, error: Error): Promise<void> {
    if (socket.readyState === WebSocket.OPEN) {
      const errorMessage: WSMessage = {
        type: WSMessageType.ERROR,
        payload: {
          error: "Message processing failed",
          timestamp: Date.now()
        },
        messageId: crypto.randomUUID()
      };

      try {
        socket.send(JSON.stringify(errorMessage));
      } catch (sendError) {
        console.error("[WebSocket Integration] Failed to send error message:", sendError);
      }
    }
  }

  /**
   * Handle session cleanup
   */
  private async handleSessionCleanup(sessionId: string, code: number, reason: string): Promise<void> {
    try {
      // Reset rate limits for the session
      await webSocketRateLimiter.resetSessionLimits(sessionId);

      // Track session end in analytics
      await webSocketAnalyticsService.trackSessionEnd(sessionId, reason);

      console.log(`[WebSocket Integration] Session ${sessionId} cleaned up (code: ${code})`);

    } catch (error) {
      console.error(`[WebSocket Integration] Session cleanup failed for ${sessionId}:`, error);
      captureException(error);
    }
  }

  /**
   * Send notification to user (called from HTTP endpoints)
   */
  async sendNotificationToUser(
    userId: number,
    notification: {
      type: string;
      title: string;
      message: string;
      relatedId?: number;
      relatedType?: string;
    }
  ): Promise<boolean> {
    try {
      // Try immediate delivery first
      await pitcheyWebSocketServer.sendNotificationToUser(userId, notification);
      
      // If user is offline, queue the notification
      const presence = await presenceTrackingService.getUserPresence(userId);
      if (!presence || presence.status === PresenceStatus.OFFLINE) {
        await messageQueueService.queueNotification(userId, notification, MessagePriority.NORMAL);
      }

      return true;

    } catch (error) {
      console.error(`[WebSocket Integration] Failed to send notification to user ${userId}:`, error);
      await webSocketErrorHandler.handleError(error, {
        userId,
        operation: "send_notification"
      });
      return false;
    }
  }

  /**
   * Send dashboard update to user
   */
  async sendDashboardUpdate(userId: number, metrics: any): Promise<boolean> {
    try {
      await pitcheyWebSocketServer.sendDashboardUpdate(userId, metrics);
      return true;
    } catch (error) {
      console.error(`[WebSocket Integration] Failed to send dashboard update to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Send upload progress update
   */
  async sendUploadProgress(
    userId: number,
    uploadId: string,
    progress: number,
    status: string
  ): Promise<boolean> {
    try {
      await pitcheyWebSocketServer.sendUploadProgress(userId, uploadId, progress, status);
      
      // Also store in Redis for persistence
      await webSocketRedisService.storeUploadProgress(userId, uploadId, progress, status);
      
      return true;
    } catch (error) {
      console.error(`[WebSocket Integration] Failed to send upload progress:`, error);
      return false;
    }
  }

  /**
   * Update pitch statistics in real-time
   */
  async updatePitchStats(pitchId: number, stats: any): Promise<boolean> {
    try {
      await pitcheyWebSocketServer.sendPitchStatsUpdate(pitchId, stats);
      
      // Store in Redis for caching
      await webSocketRedisService.updatePitchStats(pitchId, stats);
      
      return true;
    } catch (error) {
      console.error(`[WebSocket Integration] Failed to update pitch stats:`, error);
      return false;
    }
  }

  /**
   * Broadcast system announcement to all users
   */
  async broadcastSystemAnnouncement(announcement: {
    title: string;
    message: string;
    type: string;
    priority?: MessagePriority;
  }): Promise<boolean> {
    try {
      // Get all online users
      const onlineUsers = await presenceTrackingService.getAllOnlineUsers();
      const userIds = onlineUsers.map(user => user.userId);

      // Queue announcements for all users (including offline ones)
      await messageQueueService.queueSystemAnnouncement(userIds, announcement);

      return true;
    } catch (error) {
      console.error("[WebSocket Integration] Failed to broadcast system announcement:", error);
      return false;
    }
  }

  /**
   * Get user presence status
   */
  async getUserPresence(userId: number): Promise<{
    status: PresenceStatus;
    lastSeen: Date;
    isOnline: boolean;
  } | null> {
    try {
      const presence = await presenceTrackingService.getUserPresence(userId);
      if (!presence) {
        return null;
      }

      return {
        status: presence.status,
        lastSeen: presence.lastSeen,
        isOnline: presence.status === PresenceStatus.ONLINE || presence.status === PresenceStatus.AWAY
      };
    } catch (error) {
      console.error(`[WebSocket Integration] Failed to get user presence:`, error);
      return null;
    }
  }

  /**
   * Get online users that a user follows
   */
  async getFollowingOnlineUsers(userId: number): Promise<Array<{
    userId: number;
    status: PresenceStatus;
    lastSeen: Date;
  }>> {
    try {
      const onlineFollowing = await presenceTrackingService.getFollowingOnlineUsers(userId);
      return onlineFollowing.map(presence => ({
        userId: presence.userId,
        status: presence.status,
        lastSeen: presence.lastSeen
      }));
    } catch (error) {
      console.error(`[WebSocket Integration] Failed to get following online users:`, error);
      return [];
    }
  }

  /**
   * Get WebSocket server statistics
   */
  async getServerStats(): Promise<{
    connections: any;
    presence: any;
    analytics: any;
    errors: any;
    queue: any;
  }> {
    try {
      const [
        connectionStats,
        presenceStats,
        analyticsMetrics,
        errorStats,
        queueStats
      ] = await Promise.allSettled([
        pitcheyWebSocketServer.getStats(),
        presenceTrackingService.getPresenceStats(),
        webSocketAnalyticsService.getDashboardMetrics(),
        webSocketErrorHandler.getErrorStats(),
        messageQueueService.getQueueStats()
      ]);

      return {
        connections: connectionStats.status === 'fulfilled' ? connectionStats.value : null,
        presence: presenceStats.status === 'fulfilled' ? presenceStats.value : null,
        analytics: analyticsMetrics.status === 'fulfilled' ? analyticsMetrics.value : null,
        errors: errorStats.status === 'fulfilled' ? errorStats.value : null,
        queue: queueStats.status === 'fulfilled' ? queueStats.value : null
      };
    } catch (error) {
      console.error("[WebSocket Integration] Failed to get server stats:", error);
      return {
        connections: null,
        presence: null,
        analytics: null,
        errors: null,
        queue: null
      };
    }
  }

  /**
   * Subscribe user to pitch updates
   */
  async subscribeUserToPitch(sessionId: string, pitchId: number): Promise<boolean> {
    try {
      await pitcheyWebSocketServer.subscribeToPitch(sessionId, pitchId);
      return true;
    } catch (error) {
      console.error(`[WebSocket Integration] Failed to subscribe to pitch:`, error);
      return false;
    }
  }

  /**
   * Unsubscribe user from pitch updates
   */
  async unsubscribeUserFromPitch(sessionId: string, pitchId: number): Promise<boolean> {
    try {
      await pitcheyWebSocketServer.unsubscribeFromPitch(sessionId, pitchId);
      return true;
    } catch (error) {
      console.error(`[WebSocket Integration] Failed to unsubscribe from pitch:`, error);
      return false;
    }
  }

  /**
   * Send typing indicator update
   */
  async sendTypingIndicator(
    conversationId: number,
    userId: number,
    isTyping: boolean
  ): Promise<boolean> {
    try {
      await webSocketRedisService.setTypingIndicator(conversationId, userId, isTyping);
      return true;
    } catch (error) {
      console.error("[WebSocket Integration] Failed to send typing indicator:", error);
      return false;
    }
  }

  /**
   * Get health status of WebSocket services
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, {
      status: 'up' | 'down';
      lastCheck: Date;
      details?: string;
    }>;
  }> {
    const services: Record<string, any> = {};
    let healthyCount = 0;
    const totalServices = 5;

    try {
      // Check WebSocket server
      const wsStats = pitcheyWebSocketServer.getStats();
      services.websocket = {
        status: 'up',
        lastCheck: new Date(),
        details: `${wsStats.totalSessions} active sessions`
      };
      healthyCount++;
    } catch {
      services.websocket = { status: 'down', lastCheck: new Date() };
    }

    try {
      // Check Redis service
      const redisEnabled = webSocketRedisService.getRedisStats();
      services.redis = {
        status: redisEnabled ? 'up' : 'down',
        lastCheck: new Date()
      };
      if (redisEnabled) healthyCount++;
    } catch {
      services.redis = { status: 'down', lastCheck: new Date() };
    }

    try {
      // Check presence tracking
      const presenceStats = await presenceTrackingService.getPresenceStats();
      services.presence = {
        status: 'up',
        lastCheck: new Date(),
        details: `${presenceStats.onlineUsers} online users`
      };
      healthyCount++;
    } catch {
      services.presence = { status: 'down', lastCheck: new Date() };
    }

    try {
      // Check message queue
      const queueStats = await messageQueueService.getQueueStats();
      services.messageQueue = {
        status: 'up',
        lastCheck: new Date(),
        details: `${queueStats.totalQueued} queued messages`
      };
      healthyCount++;
    } catch {
      services.messageQueue = { status: 'down', lastCheck: new Date() };
    }

    try {
      // Check analytics
      const analyticsMetrics = await webSocketAnalyticsService.getDashboardMetrics();
      services.analytics = {
        status: 'up',
        lastCheck: new Date()
      };
      healthyCount++;
    } catch {
      services.analytics = { status: 'down', lastCheck: new Date() };
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalServices) {
      status = 'healthy';
    } else if (healthyCount >= totalServices * 0.6) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, services };
  }

  /**
   * Graceful shutdown of all WebSocket services
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    console.log("[WebSocket Integration] Initiating graceful shutdown...");

    try {
      // Shutdown all services
      await Promise.allSettled([
        pitcheyWebSocketServer.shutdown(),
        webSocketRedisService.shutdown(),
        presenceTrackingService.shutdown(),
        messageQueueService.shutdown(),
        webSocketAnalyticsService.shutdown(),
        webSocketErrorHandler.shutdown()
      ]);

      this.isInitialized = false;
      console.log("[WebSocket Integration] Graceful shutdown completed");

    } catch (error) {
      console.error("[WebSocket Integration] Error during shutdown:", error);
      captureException(error);
    }
  }

  /**
   * Check if WebSocket integration is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const webSocketIntegration = new WebSocketIntegrationService();

/**
 * Helper function to add WebSocket support to HTTP server
 */
export function addWebSocketSupport(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    // Check if this is a WebSocket upgrade request
    const upgrade = request.headers.get("upgrade");
    if (upgrade === "websocket") {
      const url = new URL(request.url);
      
      // Check if this is our WebSocket endpoint
      if (url.pathname === "/ws" || url.pathname === "/api/ws") {
        return await webSocketIntegration.handleWebSocketUpgrade(request);
      }
    }

    // Handle regular HTTP requests
    return await handler(request);
  };
}

/**
 * Middleware to add WebSocket headers to HTTP responses
 */
export function addWebSocketHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  
  // Add WebSocket support headers
  headers.set("X-WebSocket-Endpoint", "/ws");
  headers.set("X-WebSocket-Protocol", "pitchey-v1");
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default webSocketIntegration;