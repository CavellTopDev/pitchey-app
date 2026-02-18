/**
 * Durable Object for WebSocket Management with Hibernation API
 * Handles real-time notifications across all three portals
 *
 * Protocol aligned with frontend WebSocketContext.tsx expectations:
 * - Connection confirm: { type: "connected" }
 * - Subscribe: { type: "subscribe", data: { channelId } } or { type: "subscribe", channels: [...] }
 * - All outbound wrapped in { type, data, timestamp, id } envelope
 * - Presence statuses: online | away | busy | dnd | offline
 */

import type { Env } from '../worker-integrated';

export type PresenceStatus = 'online' | 'away' | 'busy' | 'dnd' | 'offline';

export interface NotificationSession {
  id: string;
  userId: string;
  portalType: 'creator' | 'investor' | 'production';
  connectionTime: string;
  lastActivity: string;
  username?: string;
  deviceInfo?: {
    userAgent: string;
    ip: string;
  };
  subscriptions: string[]; // Serializable for hibernation (Set not JSON-safe)
}

export interface NotificationMessage {
  id: string;
  type: string;
  userId: string;
  data: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timestamp: string;
  ttl?: number; // Time to live in seconds
}

/**
 * Notification Hub Durable Object
 */
export class NotificationHub implements DurableObject {
  private sessions: Map<WebSocket, NotificationSession>;
  private userSessions: Map<string, Set<WebSocket>>; // userId -> WebSockets
  private queuedMessages: Map<string, NotificationMessage[]>; // Offline message queue
  private presenceTracking: Map<string, { status: PresenceStatus; activity?: string; lastSeen: string }>;

  constructor(
    private state: DurableObjectState,
    private env: Env
  ) {
    this.sessions = new Map();
    this.userSessions = new Map();
    this.queuedMessages = new Map();
    this.presenceTracking = new Map();

    // Restore hibernated connections
    this.state.getWebSockets().forEach((ws) => {
      const attachment = ws.deserializeAttachment() as NotificationSession | null;
      if (attachment) {
        // Restore subscriptions from serialized array
        const session: NotificationSession = {
          ...attachment,
          subscriptions: Array.isArray(attachment.subscriptions) ? attachment.subscriptions : []
        };
        this.sessions.set(ws, session);
        this.addUserSession(session.userId, ws);
      }
    });

    // Configure auto-response for ping/pong to keep connections alive without waking DO
    // Frontend sends literal "ping" text as heartbeat
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(
        JSON.stringify({ type: 'ping' }),
        JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() })
      )
    );
  }

  /**
   * Handle incoming HTTP requests (upgrade, send, broadcast, stats)
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/websocket':
        return this.handleWebSocketUpgrade(request);

      case '/broadcast':
        return this.handleBroadcast(request);

      case '/send':
        return this.handleSendToUser(request);

      case '/presence':
        return this.handlePresenceUpdate(request);

      case '/stats':
        return this.handleStats();

      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  /**
   * Create an envelope-wrapped outbound message matching frontend expectations:
   * { type, data, timestamp, id }
   */
  private createEnvelope(type: string, data: any, id?: string): string {
    return JSON.stringify({
      type,
      data: data ?? {},
      timestamp: new Date().toISOString(),
      id: id || crypto.randomUUID()
    });
  }

  /**
   * Upgrade HTTP connection to WebSocket
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const pairs = new WebSocketPair();
    const [client, server] = Object.values(pairs);

    // Extract session info from headers (Worker pre-authenticates)
    const userId = request.headers.get('X-User-ID');
    const portalType = request.headers.get('X-Portal-Type') as 'creator' | 'investor' | 'production';
    const username = request.headers.get('X-Username') || undefined;
    const userAgent = request.headers.get('User-Agent');

    if (!userId || !portalType) {
      return new Response('Missing authentication', { status: 401 });
    }

    // Accept the WebSocket connection with hibernation
    this.state.acceptWebSocket(server);

    // Create session (using serializable array instead of Set)
    const session: NotificationSession = {
      id: crypto.randomUUID(),
      userId,
      portalType,
      username,
      connectionTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      deviceInfo: {
        userAgent: userAgent || 'Unknown',
        ip: request.headers.get('CF-Connecting-IP') || 'Unknown'
      },
      subscriptions: ['global', `portal:${portalType}`, `user:${userId}`]
    };

    // Attach session to WebSocket for hibernation survival
    server.serializeAttachment(session);

    // Store session
    this.sessions.set(server, session);
    this.addUserSession(userId, server);

    // Update presence
    this.presenceTracking.set(userId, {
      status: 'online',
      lastSeen: new Date().toISOString()
    });
    await this.broadcastPresence(userId, 'online');

    // Send queued messages
    await this.flushQueuedMessages(userId, server);

    // Send "connected" message (frontend expects type: "connected")
    server.send(this.createEnvelope('connected', {
      sessionId: session.id,
      userId,
      portalType
    }));

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle WebSocket message from client
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const session = this.sessions.get(ws);
    if (!session) return;

    // Update last activity
    session.lastActivity = new Date().toISOString();

    try {
      const parsed = JSON.parse(message as string);

      switch (parsed.type) {
        case 'subscribe': {
          // Frontend format: { type: "subscribe", data: { channelId: "..." } }
          // Legacy format: { type: "subscribe", channels: [...] }
          if (parsed.data?.channelId) {
            await this.handleSubscribe(ws, session, [parsed.data.channelId]);
          } else if (Array.isArray(parsed.channels)) {
            await this.handleSubscribe(ws, session, parsed.channels);
          }
          break;
        }

        case 'unsubscribe': {
          // Frontend format: { type: "unsubscribe", data: { channelId: "..." } }
          // Legacy format: { type: "unsubscribe", channels: [...] }
          if (parsed.data?.channelId) {
            await this.handleUnsubscribe(ws, session, [parsed.data.channelId]);
          } else if (Array.isArray(parsed.channels)) {
            await this.handleUnsubscribe(ws, session, parsed.channels);
          }
          break;
        }

        case 'message':
          await this.handleUserMessage(session, parsed);
          break;

        case 'typing': {
          // Frontend format: { type: "typing", data: { conversationId, isTyping } }
          // Legacy format: { type: "typing", pitchId, isTyping }
          const conversationId = parsed.data?.conversationId || parsed.pitchId;
          const isTyping = parsed.data?.isTyping ?? parsed.isTyping ?? true;
          await this.handleTypingIndicator(session, conversationId, isTyping);
          break;
        }

        case 'presence_update': {
          // Frontend format: { type: "presence_update", data: { status, activity } }
          const status = parsed.data?.status || 'online';
          const activity = parsed.data?.activity;
          await this.handlePresenceChange(session, status, activity);
          break;
        }

        case 'presence': {
          // Legacy format: { type: "presence", status }
          await this.handlePresenceChange(session, parsed.status || 'online');
          break;
        }

        case 'request_initial_data': {
          // Frontend requests initial state on connect - ack it
          ws.send(this.createEnvelope('initial_data', {
            notifications: [],
            presence: Object.fromEntries(this.presenceTracking),
            connectedUsers: this.userSessions.size
          }));
          break;
        }

        case 'notification_read': {
          // Frontend marks notification as read - ack
          ws.send(this.createEnvelope('notification_read_ack', {
            notificationId: parsed.data?.notificationId
          }));
          break;
        }

        case 'notifications_clear_all': {
          // Frontend clears all notifications - ack
          ws.send(this.createEnvelope('notifications_cleared', {}));
          break;
        }

        case 'pitch_view_update': {
          // Frontend tracks a pitch view - broadcast to pitch creator
          const pitchId = parsed.data?.pitchId;
          if (pitchId) {
            await this.broadcastToChannel(`pitch:${pitchId}`, this.createEnvelope('pitch_view_update', {
              pitchId,
              viewerId: session.userId,
              timestamp: new Date().toISOString()
            }), session.userId);
          }
          break;
        }

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;
      }

      // Re-serialize session after mutation (subscriptions may have changed)
      ws.serializeAttachment(session);
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      ws.send(this.createEnvelope('error', { message: 'Invalid message format' }));
    }
  }

  /**
   * Handle WebSocket close
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const session = this.sessions.get(ws);
    if (!session) return;

    // Remove session
    this.sessions.delete(ws);
    this.removeUserSession(session.userId, ws);

    // Update presence if no more sessions
    const userSessions = this.userSessions.get(session.userId);
    if (!userSessions || userSessions.size === 0) {
      this.presenceTracking.set(session.userId, {
        status: 'offline',
        lastSeen: new Date().toISOString()
      });
      await this.broadcastPresence(session.userId, 'offline');
    }
  }

  /**
   * Handle WebSocket error
   */
  async webSocketError(ws: WebSocket, error: Error): Promise<void> {
    console.error('WebSocket error:', error);
    const session = this.sessions.get(ws);
    if (session) {
      ws.close(1011, 'Internal error');
    }
  }

  /**
   * Broadcast message to all connected clients (HTTP endpoint)
   */
  private async handleBroadcast(request: Request): Promise<Response> {
    const data = await request.json() as NotificationMessage;

    const targetSessions = this.filterTargetSessions(data);

    let delivered = 0;
    for (const [ws, session] of targetSessions) {
      try {
        // Wrap in envelope
        ws.send(this.createEnvelope(data.type, data.data, data.id));
        delivered++;
      } catch (error) {
        console.error(`Failed to send to ${session.userId}:`, error);
      }
    }

    return Response.json({ delivered, total: targetSessions.size });
  }

  /**
   * Send message to specific user (HTTP endpoint used by pushRealtimeEvent)
   */
  private async handleSendToUser(request: Request): Promise<Response> {
    const body = await request.json() as { userId?: string; message?: any };
    const { userId = '', message } = body;

    const userWebSockets = this.userSessions.get(userId);

    if (!userWebSockets || userWebSockets.size === 0) {
      // User offline, queue message
      await this.queueMessage(userId, message);
      return Response.json({ status: 'queued', userId });
    }

    // Send to all user's connections, wrapped in envelope
    let delivered = 0;
    const envelope = this.createEnvelope(
      message?.type || 'notification',
      message?.data ?? message,
      message?.id
    );

    for (const ws of userWebSockets) {
      try {
        ws.send(envelope);
        delivered++;
      } catch (error) {
        console.error(`Failed to send to WebSocket:`, error);
      }
    }

    return Response.json({ status: 'delivered', userId, connections: delivered });
  }

  /**
   * Handle presence update (HTTP endpoint)
   */
  private async handlePresenceUpdate(request: Request): Promise<Response> {
    const body = await request.json() as { userId?: string; status?: PresenceStatus; activity?: string };
    const { userId = '', status = 'online', activity } = body;

    this.presenceTracking.set(userId, {
      status,
      activity,
      lastSeen: new Date().toISOString()
    });
    await this.broadcastPresence(userId, status, activity);

    return Response.json({ userId, status });
  }

  /**
   * Get statistics
   */
  private async handleStats(): Promise<Response> {
    const stats = {
      totalConnections: this.sessions.size,
      uniqueUsers: this.userSessions.size,
      queuedMessages: Array.from(this.queuedMessages.values())
        .reduce((sum, messages) => sum + messages.length, 0),
      presence: Object.fromEntries(this.presenceTracking),
      portals: {
        creator: 0,
        investor: 0,
        production: 0
      }
    };

    for (const session of this.sessions.values()) {
      stats.portals[session.portalType]++;
    }

    return Response.json(stats);
  }

  /**
   * Subscribe to channels
   */
  private async handleSubscribe(
    ws: WebSocket,
    session: NotificationSession,
    channels: string[]
  ): Promise<void> {
    for (const channel of channels) {
      if (!session.subscriptions.includes(channel)) {
        session.subscriptions.push(channel);
      }
    }

    ws.send(this.createEnvelope('subscribed', { channels }));
  }

  /**
   * Unsubscribe from channels
   */
  private async handleUnsubscribe(
    ws: WebSocket,
    session: NotificationSession,
    channels: string[]
  ): Promise<void> {
    session.subscriptions = session.subscriptions.filter(ch => !channels.includes(ch));

    ws.send(this.createEnvelope('unsubscribed', { channels }));
  }

  /**
   * Handle user-to-user message
   */
  private async handleUserMessage(
    sender: NotificationSession,
    data: any
  ): Promise<void> {
    const targetUserId = data.targetUserId || data.data?.targetUserId;
    const targetWebSockets = this.userSessions.get(targetUserId);

    const envelope = this.createEnvelope('chat_message', {
      from: sender.userId,
      content: data.content || data.data?.content,
      timestamp: new Date().toISOString()
    });

    if (!targetWebSockets || targetWebSockets.size === 0) {
      await this.queueMessage(targetUserId, {
        id: crypto.randomUUID(),
        type: 'chat_message',
        userId: targetUserId,
        data: { from: sender.userId, content: data.content || data.data?.content },
        priority: 'normal',
        timestamp: new Date().toISOString()
      });
    } else {
      for (const ws of targetWebSockets) {
        ws.send(envelope);
      }
    }
  }

  /**
   * Handle typing indicator
   */
  private async handleTypingIndicator(
    session: NotificationSession,
    conversationId: string | number,
    isTyping: boolean
  ): Promise<void> {
    const envelope = this.createEnvelope('typing', {
      userId: session.userId,
      username: session.username,
      conversationId,
      isTyping,
    });

    // Broadcast to conversation channel or all connected users
    const channel = `conversation:${conversationId}`;
    await this.broadcastToChannel(channel, envelope, session.userId);

    // Also try pitch channel for backwards compatibility
    await this.broadcastToChannel(`pitch:${conversationId}`, envelope, session.userId);
  }

  /**
   * Handle presence change
   */
  private async handlePresenceChange(
    session: NotificationSession,
    status: PresenceStatus,
    activity?: string
  ): Promise<void> {
    this.presenceTracking.set(session.userId, {
      status,
      activity,
      lastSeen: new Date().toISOString()
    });
    await this.broadcastPresence(session.userId, status, activity);
  }

  /**
   * Broadcast presence update to all connected users
   * Frontend expects: { type: "presence_update", data: { userId, username, status, lastSeen, activity } }
   */
  private async broadcastPresence(
    userId: string,
    status: PresenceStatus,
    activity?: string
  ): Promise<void> {
    // Find username from session
    let username: string | undefined;
    const userWsSessions = this.userSessions.get(userId);
    if (userWsSessions) {
      for (const ws of userWsSessions) {
        const s = this.sessions.get(ws);
        if (s?.username) { username = s.username; break; }
      }
    }

    const envelope = this.createEnvelope('presence_update', {
      userId,
      username: username || userId,
      status,
      lastSeen: new Date().toISOString(),
      activity
    });

    for (const [ws, session] of this.sessions) {
      if (session.userId !== userId) {
        try {
          ws.send(envelope);
        } catch (error) {
          console.error('Failed to send presence update:', error);
        }
      }
    }
  }

  /**
   * Broadcast to specific channel
   */
  private async broadcastToChannel(
    channel: string,
    envelope: string,
    excludeUserId?: string
  ): Promise<void> {
    for (const [ws, session] of this.sessions) {
      if (session.subscriptions.includes(channel) && session.userId !== excludeUserId) {
        try {
          ws.send(envelope);
        } catch (error) {
          console.error('Failed to broadcast to channel:', error);
        }
      }
    }
  }

  /**
   * Queue message for offline user
   */
  private async queueMessage(
    userId: string,
    message: NotificationMessage
  ): Promise<void> {
    const queue = this.queuedMessages.get(userId) || [];

    if (!message.ttl) {
      message.ttl = 7 * 24 * 60 * 60; // 7 days default
    }

    queue.push(message);

    // Limit queue size
    if (queue.length > 100) {
      queue.shift();
    }

    this.queuedMessages.set(userId, queue);

    // Persist to storage
    await this.state.storage.put(`queue:${userId}`, queue);
  }

  /**
   * Flush queued messages to user
   */
  private async flushQueuedMessages(
    userId: string,
    ws: WebSocket
  ): Promise<void> {
    const queue = await this.state.storage.get<NotificationMessage[]>(`queue:${userId}`) || [];

    if (queue.length === 0) return;

    // Filter expired messages
    const now = Date.now();
    const validMessages = queue.filter(msg => {
      if (!msg.ttl) return true;
      const expires = new Date(msg.timestamp).getTime() + (msg.ttl * 1000);
      return expires > now;
    });

    // Send valid messages wrapped in envelope
    for (const message of validMessages) {
      try {
        ws.send(this.createEnvelope(
          message.type,
          message.data,
          message.id
        ));
      } catch (error) {
        console.error('Failed to flush message:', error);
      }
    }

    // Clear queue
    this.queuedMessages.delete(userId);
    await this.state.storage.delete(`queue:${userId}`);
  }

  /**
   * Filter target sessions based on message
   */
  private filterTargetSessions(
    message: NotificationMessage
  ): Map<WebSocket, NotificationSession> {
    const filtered = new Map<WebSocket, NotificationSession>();

    for (const [ws, session] of this.sessions) {
      if (this.shouldReceiveMessage(session, message)) {
        filtered.set(ws, session);
      }
    }

    return filtered;
  }

  /**
   * Check if session should receive message
   */
  private shouldReceiveMessage(
    session: NotificationSession,
    message: NotificationMessage
  ): boolean {
    if (message.userId && message.userId !== session.userId) {
      return false;
    }

    if (message.type.startsWith('investment.') && session.portalType !== 'investor') {
      return false;
    }

    if (message.type.startsWith('production.') && session.portalType !== 'production') {
      return false;
    }

    return true;
  }

  /**
   * Helper to manage user sessions
   */
  private addUserSession(userId: string, ws: WebSocket): void {
    const sessions = this.userSessions.get(userId) || new Set();
    sessions.add(ws);
    this.userSessions.set(userId, sessions);
  }

  private removeUserSession(userId: string, ws: WebSocket): void {
    const sessions = this.userSessions.get(userId);
    if (sessions) {
      sessions.delete(ws);
      if (sessions.size === 0) {
        this.userSessions.delete(userId);
      }
    }
  }
}
