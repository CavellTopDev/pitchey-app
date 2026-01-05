/**
 * Durable Object for WebSocket Management with Hibernation API
 * Handles real-time notifications across all three portals
 */

export interface NotificationSession {
  id: string;
  userId: string;
  portalType: 'creator' | 'investor' | 'production';
  connectionTime: Date;
  lastActivity: Date;
  deviceInfo?: {
    userAgent: string;
    ip: string;
  };
  subscriptions: Set<string>; // Channel subscriptions
}

export interface NotificationMessage {
  id: string;
  type: NotificationType;
  userId: string;
  data: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timestamp: Date;
  ttl?: number; // Time to live in seconds
}

export enum NotificationType {
  // Investment notifications
  INVESTMENT_INTEREST = 'investment.interest_expressed',
  INVESTMENT_COMMITTED = 'investment.committed',
  INVESTMENT_FUNDED = 'investment.funded',
  
  // Production notifications  
  PRODUCTION_INTEREST = 'production.interest',
  PRODUCTION_MEETING = 'production.meeting_scheduled',
  PRODUCTION_PROPOSAL = 'production.proposal_received',
  
  // NDA notifications
  NDA_REQUESTED = 'nda.requested',
  NDA_APPROVED = 'nda.approved',
  NDA_SIGNED = 'nda.signed',
  NDA_EXPIRING = 'nda.expiring',
  
  // Container job notifications
  CONTAINER_JOB_STARTED = 'container.job.started',
  CONTAINER_JOB_PROGRESS = 'container.job.progress',
  CONTAINER_JOB_COMPLETED = 'container.job.completed',
  CONTAINER_JOB_FAILED = 'container.job.failed',
  CONTAINER_HEALTH_WARNING = 'container.health.warning',
  CONTAINER_COST_ALERT = 'container.cost.alert',
  CONTAINER_SCALING = 'container.scaling',
  
  // System notifications
  SYSTEM_MAINTENANCE = 'system.maintenance',
  SYSTEM_UPDATE = 'system.update',
  
  // Real-time collaboration
  PITCH_COMMENT = 'pitch.comment',
  PITCH_UPDATE = 'pitch.update',
  USER_TYPING = 'user.typing',
  USER_PRESENCE = 'user.presence'
}

/**
 * Notification Hub Durable Object
 */
export class NotificationHub implements DurableObject {
  private sessions: Map<WebSocket, NotificationSession>;
  private userSessions: Map<string, Set<WebSocket>>; // userId -> WebSockets
  private queuedMessages: Map<string, NotificationMessage[]>; // Offline message queue
  private presenceTracking: Map<string, 'online' | 'away' | 'offline'>;
  
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
      const session = ws.deserializeAttachment() as NotificationSession;
      if (session) {
        this.sessions.set(ws, session);
        this.addUserSession(session.userId, ws);
      }
    });
    
    // Configure auto-response for ping/pong to keep connections alive without waking DO
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    );
    
    // Set hibernation configuration
    this.state.setHibernatableWebSocketEventTimeout(60000); // 60 second timeout
  }
  
  /**
   * Handle WebSocket upgrade request
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
   * Upgrade HTTP connection to WebSocket
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const pairs = new WebSocketPair();
    const [client, server] = Object.values(pairs);
    
    // Extract session info from headers
    const userId = request.headers.get('X-User-ID');
    const portalType = request.headers.get('X-Portal-Type') as 'creator' | 'investor' | 'production';
    const userAgent = request.headers.get('User-Agent');
    
    if (!userId || !portalType) {
      return new Response('Missing authentication', { status: 401 });
    }
    
    // Accept the WebSocket connection
    this.state.acceptWebSocket(server);
    
    // Create session
    const session: NotificationSession = {
      id: crypto.randomUUID(),
      userId,
      portalType,
      connectionTime: new Date(),
      lastActivity: new Date(),
      deviceInfo: {
        userAgent: userAgent || 'Unknown',
        ip: request.headers.get('CF-Connecting-IP') || 'Unknown'
      },
      subscriptions: new Set(['global', `portal:${portalType}`, `user:${userId}`])
    };
    
    // Attach session to WebSocket for hibernation survival
    server.serializeAttachment(session);
    
    // Store session
    this.sessions.set(server, session);
    this.addUserSession(userId, server);
    
    // Update presence
    this.presenceTracking.set(userId, 'online');
    await this.broadcastPresence(userId, 'online');
    
    // Send queued messages
    await this.flushQueuedMessages(userId, server);
    
    // Send welcome message
    server.send(JSON.stringify({
      type: 'connection.established',
      sessionId: session.id,
      timestamp: new Date().toISOString()
    }));
    
    return new Response(null, { status: 101, webSocket: client });
  }
  
  /**
   * Handle WebSocket message
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const session = this.sessions.get(ws);
    if (!session) return;
    
    // Update last activity
    session.lastActivity = new Date();
    
    try {
      const data = JSON.parse(message as string);
      
      switch (data.type) {
        case 'subscribe':
          await this.handleSubscribe(ws, session, data.channels);
          break;
          
        case 'unsubscribe':
          await this.handleUnsubscribe(ws, session, data.channels);
          break;
          
        case 'message':
          await this.handleUserMessage(session, data);
          break;
          
        case 'typing':
          await this.handleTypingIndicator(session, data);
          break;
          
        case 'presence':
          await this.handlePresenceChange(session, data.status);
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format' 
      }));
    }
  }
  
  /**
   * Handle WebSocket close
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const session = this.sessions.get(ws);
    if (!session) return;
    
    console.log(`WebSocket closed for user ${session.userId}: ${code} - ${reason}`);
    
    // Remove session
    this.sessions.delete(ws);
    this.removeUserSession(session.userId, ws);
    
    // Update presence if no more sessions
    const userSessions = this.userSessions.get(session.userId);
    if (!userSessions || userSessions.size === 0) {
      this.presenceTracking.set(session.userId, 'offline');
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
      // Try to recover or close connection
      ws.close(1011, 'Internal error');
    }
  }
  
  /**
   * Broadcast message to all connected clients
   */
  private async handleBroadcast(request: Request): Promise<Response> {
    const data = await request.json() as NotificationMessage;
    
    // Filter sessions based on message targeting
    const targetSessions = this.filterTargetSessions(data);
    
    // Send to connected clients
    let delivered = 0;
    for (const [ws, session] of targetSessions) {
      try {
        ws.send(JSON.stringify(data));
        delivered++;
      } catch (error) {
        console.error(`Failed to send to ${session.userId}:`, error);
      }
    }
    
    return Response.json({ 
      delivered,
      total: targetSessions.size 
    });
  }
  
  /**
   * Send message to specific user
   */
  private async handleSendToUser(request: Request): Promise<Response> {
    const { userId, message } = await request.json();
    
    const userWebSockets = this.userSessions.get(userId);
    
    if (!userWebSockets || userWebSockets.size === 0) {
      // User offline, queue message
      await this.queueMessage(userId, message);
      return Response.json({ 
        status: 'queued',
        userId 
      });
    }
    
    // Send to all user's connections
    let delivered = 0;
    for (const ws of userWebSockets) {
      try {
        ws.send(JSON.stringify(message));
        delivered++;
      } catch (error) {
        console.error(`Failed to send to WebSocket:`, error);
      }
    }
    
    return Response.json({ 
      status: 'delivered',
      userId,
      connections: delivered 
    });
  }
  
  /**
   * Handle presence update
   */
  private async handlePresenceUpdate(request: Request): Promise<Response> {
    const { userId, status } = await request.json();
    
    this.presenceTracking.set(userId, status);
    await this.broadcastPresence(userId, status);
    
    return Response.json({ 
      userId,
      status 
    });
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
    
    // Count by portal type
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
      session.subscriptions.add(channel);
    }
    
    ws.send(JSON.stringify({
      type: 'subscribed',
      channels
    }));
  }
  
  /**
   * Unsubscribe from channels
   */
  private async handleUnsubscribe(
    ws: WebSocket,
    session: NotificationSession,
    channels: string[]
  ): Promise<void> {
    for (const channel of channels) {
      session.subscriptions.delete(channel);
    }
    
    ws.send(JSON.stringify({
      type: 'unsubscribed',
      channels
    }));
  }
  
  /**
   * Handle user-to-user message
   */
  private async handleUserMessage(
    sender: NotificationSession,
    data: any
  ): Promise<void> {
    const targetUserId = data.targetUserId;
    const targetWebSockets = this.userSessions.get(targetUserId);
    
    const message = {
      type: 'user.message',
      from: sender.userId,
      data: data.content,
      timestamp: new Date().toISOString()
    };
    
    if (!targetWebSockets || targetWebSockets.size === 0) {
      // Queue for offline user
      await this.queueMessage(targetUserId, message as NotificationMessage);
    } else {
      // Deliver to online user
      for (const ws of targetWebSockets) {
        ws.send(JSON.stringify(message));
      }
    }
  }
  
  /**
   * Handle typing indicator
   */
  private async handleTypingIndicator(
    session: NotificationSession,
    data: any
  ): Promise<void> {
    const message = {
      type: 'user.typing',
      userId: session.userId,
      pitchId: data.pitchId,
      isTyping: data.isTyping,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast to all users viewing the same pitch
    const channel = `pitch:${data.pitchId}`;
    await this.broadcastToChannel(channel, message, session.userId);
  }
  
  /**
   * Handle presence change
   */
  private async handlePresenceChange(
    session: NotificationSession,
    status: 'online' | 'away' | 'offline'
  ): Promise<void> {
    this.presenceTracking.set(session.userId, status);
    await this.broadcastPresence(session.userId, status);
  }
  
  /**
   * Broadcast presence update
   */
  private async broadcastPresence(
    userId: string,
    status: 'online' | 'away' | 'offline'
  ): Promise<void> {
    const message = {
      type: 'user.presence',
      userId,
      status,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast to all connected users
    for (const [ws, session] of this.sessions) {
      if (session.userId !== userId) {
        try {
          ws.send(JSON.stringify(message));
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
    message: any,
    excludeUserId?: string
  ): Promise<void> {
    for (const [ws, session] of this.sessions) {
      if (session.subscriptions.has(channel) && session.userId !== excludeUserId) {
        try {
          ws.send(JSON.stringify(message));
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
    
    // Add TTL if not set
    if (!message.ttl) {
      message.ttl = 7 * 24 * 60 * 60; // 7 days default
    }
    
    queue.push(message);
    
    // Limit queue size
    if (queue.length > 100) {
      queue.shift(); // Remove oldest
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
    // Load from storage
    const queue = await this.state.storage.get<NotificationMessage[]>(`queue:${userId}`) || [];
    
    if (queue.length === 0) return;
    
    // Filter expired messages
    const now = Date.now();
    const validMessages = queue.filter(msg => {
      if (!msg.ttl) return true;
      const expires = new Date(msg.timestamp).getTime() + (msg.ttl * 1000);
      return expires > now;
    });
    
    // Send valid messages
    for (const message of validMessages) {
      try {
        ws.send(JSON.stringify(message));
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
      // Check if session should receive this message
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
    // User-specific message
    if (message.userId && message.userId !== session.userId) {
      return false;
    }
    
    // Check portal type for portal-specific messages
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

/**
 * WebSocket Request/Response pair for auto-response
 */
class WebSocketRequestResponsePair {
  constructor(
    public readonly request: string,
    public readonly response: string
  ) {}
}