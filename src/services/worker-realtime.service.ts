/**
 * Worker Real-time Service
 * Handles WebSocket connections and real-time messaging for Cloudflare Workers
 */

import { getCorsHeaders } from '../utils/response';
import { WorkerDatabase } from './worker-database';
import { BetterAuthSessionHandler } from '../auth/better-auth-session-handler';

interface RealtimeMessage {
  type: 'notification' | 'dashboard_update' | 'chat_message' | 'presence_update' | 'typing_indicator' | 'upload_progress' | 'pitch_view_update' | 'connection' | 'ping' | 'pong';
  payload: any;
  timestamp: string;
  userId?: string;
  channel?: string;
}

interface UserSession {
  userId: string;
  websocket: WebSocket;
  userType: 'creator' | 'investor' | 'production';
  channels: Set<string>;
  lastActivity: Date;
  authenticated: boolean;
}

interface WorkerRealtimeConfig {
  heartbeatInterval: number;
  sessionTimeout: number;
  maxChannelsPerUser: number;
  enablePresence: boolean;
  enableBroadcast: boolean;
}

export class WorkerRealtimeService {
  private sessions: Map<string, UserSession> = new Map();
  private channels: Map<string, Set<string>> = new Map(); // channel -> userIds
  private heartbeatTimer: any = null;
  private db: WorkerDatabase;
  private config: WorkerRealtimeConfig;
  private env: any;
  private sessionHandler: BetterAuthSessionHandler;

  constructor(env: any, db: WorkerDatabase) {
    this.env = env;
    this.db = db;
    
    try {
      this.sessionHandler = new BetterAuthSessionHandler(env);
    } catch (error) {
      console.error('Error initializing BetterAuthSessionHandler:', error);
      // For now, we'll continue without session handler and fail gracefully
    }
    
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      sessionTimeout: 300000,  // 5 minutes
      maxChannelsPerUser: 50,
      enablePresence: true,
      enableBroadcast: true
    };
    
    this.startHeartbeat();
  }

  /**
   * Validate session from request using Better Auth
   */
  private async validateSessionFromRequest(request: Request): Promise<{ valid: boolean; user?: any }> {
    if (!this.sessionHandler) {
      console.error('SessionHandler not available - WebSocket authentication disabled');
      return { valid: false };
    }
    
    try {
      return await this.sessionHandler.validateSession(request);
    } catch (error) {
      console.error('Session validation error:', error);
      return { valid: false };
    }
  }
  
  /**
   * Validate token for WebSocket connection (cross-origin fallback)
   */
  private async validateTokenForWebSocket(token: string): Promise<{ valid: boolean; user?: any }> {
    if (!token) return { valid: false };
    
    try {
      // Query the database directly to validate the session token
      const sql = this.db.getSql();
      
      // Check if this is a valid session token
      const sessions = await sql`
        SELECT s.*, u.id as user_id, u.email, u.username, u.user_type, 
               u.first_name, u.last_name, u.company_name, u.profile_image
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${token}
        AND s.expires_at > NOW()
        LIMIT 1
      `;
      
      if (sessions && sessions.length > 0) {
        const session = sessions[0];
        return {
          valid: true,
          user: {
            id: session.user_id,
            email: session.email,
            username: session.username,
            userType: session.user_type,
            firstName: session.first_name,
            lastName: session.last_name,
            companyName: session.company_name,
            profileImage: session.profile_image
          }
        };
      }
      
      return { valid: false };
    } catch (error) {
      console.error('Token validation error:', error);
      return { valid: false };
    }
  }

  /**
   * Handle WebSocket upgrade request
   */
  async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Check if WebSocketPair is available (not available on free tier)
    if (typeof WebSocketPair === 'undefined') {
      return new Response(JSON.stringify({
        error: 'WebSocket not available on free tier',
        alternative: 'Use polling endpoints instead',
        endpoints: {
          notifications: '/api/poll/notifications',
          messages: '/api/poll/messages',
          updates: '/api/poll/updates'
        }
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin'))
        }
      });
    }
    
    // Better Auth: Validate authentication via session cookies or token for cross-origin WebSocket
    try {
      let user = null;
      let userId: string;
      let userType: string;
      
      // First, try cookie-based authentication
      const sessionResult = await this.validateSessionFromRequest(request);
      
      if (sessionResult.valid && sessionResult.user) {
        user = sessionResult.user;
        userId = user.id.toString();
        userType = user.userType || 'creator';
      } else {
        // For cross-origin WebSocket connections where cookies aren't sent,
        // allow token-based authentication as a fallback
        const token = url.searchParams.get('token');
        
        if (token) {
          // Validate the token using Better Auth's session verification
          const tokenValidation = await this.validateTokenForWebSocket(token);
          
          if (tokenValidation.valid && tokenValidation.user) {
            user = tokenValidation.user;
            userId = user.id.toString();
            userType = user.userType || 'creator';
          }
        }
      }
      
      // If still no authentication, allow anonymous connection with limited features
      if (!user) {
        // Allow anonymous WebSocket connection for public notifications only
        userId = `anonymous-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        userType = 'anonymous';
        
        console.log('Allowing anonymous WebSocket connection:', userId);
      }

    // Create WebSocket pair
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection
    server.accept();

    // Create user session with proper authentication status
    const isAuthenticated = user !== null && userType !== 'anonymous';
    const session: UserSession = {
      userId,
      websocket: server,
      userType: userType as 'creator' | 'investor' | 'production',
      channels: new Set(),
      lastActivity: new Date(),
      authenticated: isAuthenticated
    };

    this.sessions.set(userId, session);

    // Set up message handlers
    server.addEventListener('message', (event) => {
      this.handleMessage(userId, event.data as string);
    });

    server.addEventListener('close', () => {
      this.handleDisconnect(userId);
    });

    server.addEventListener('error', (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      this.handleDisconnect(userId);
    });

    // Send connection confirmation
    this.sendToUser(userId, {
      type: 'connection',
      payload: {
        status: 'connected',
        userId,
        timestamp: new Date().toISOString(),
        serverTime: Date.now()
      },
      timestamp: new Date().toISOString()
    });

    // Update user presence
    if (this.config.enablePresence) {
      await this.updateUserPresence(userId, 'online');
    }

      // Return the WebSocket connection to the client
      return new Response(null, {
        status: 101,
        webSocket: client
      });
    } catch (error) {
      console.error('WebSocket upgrade error:', error);
      
      return new Response(JSON.stringify({
        error: 'WebSocket upgrade failed',
        message: 'Unable to establish WebSocket connection',
        fallback: 'Use polling endpoints instead'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin'))
        }
      });
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(userId: string, data: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) return;

    session.lastActivity = new Date();

    try {
      const message: RealtimeMessage = JSON.parse(data);

      switch (message.type) {
        case 'ping':
          this.sendToUser(userId, {
            type: 'pong',
            payload: { timestamp: Date.now() },
            timestamp: new Date().toISOString()
          });
          break;

        case 'notification':
          await this.handleNotificationMessage(userId, message);
          break;

        case 'chat_message':
          await this.handleChatMessage(userId, message);
          break;

        case 'presence_update':
          await this.handlePresenceUpdate(userId, message);
          break;

        case 'typing_indicator':
          await this.handleTypingIndicator(userId, message);
          break;

        case 'dashboard_update':
          await this.handleDashboardUpdate(userId, message);
          break;

        case 'pitch_view_update':
          await this.handlePitchViewUpdate(userId, message);
          break;

        default:
          console.warn(`Unknown message type: ${message.type} from user ${userId}`);
      }
    } catch (error) {
      console.error(`Error parsing message from user ${userId}:`, error);
      this.sendToUser(userId, {
        type: 'notification',
        payload: {
          error: 'Invalid message format',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle notification messages
   */
  private async handleNotificationMessage(userId: string, message: RealtimeMessage): Promise<void> {
    const { targetUserId, notificationData } = message.payload;

    if (targetUserId) {
      // Send to specific user
      this.sendToUser(targetUserId, {
        type: 'notification',
        payload: {
          from: userId,
          data: notificationData,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

      // Store notification in database
      try {
        await this.db.query(`
          INSERT INTO notifications (user_id, type, content, created_at)
          VALUES ($1, $2, $3, NOW())
        `, [targetUserId, 'realtime', JSON.stringify(notificationData)]);
      } catch (error) {
        console.error('Error storing notification:', error);
      }
    }
  }

  /**
   * Handle chat messages
   */
  private async handleChatMessage(userId: string, message: RealtimeMessage): Promise<void> {
    const { conversationId, content, participants } = message.payload;

    const chatMessage: RealtimeMessage = {
      type: 'chat_message',
      payload: {
        conversationId,
        senderId: userId,
        content,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    // Send to all participants
    if (participants && Array.isArray(participants)) {
      for (const participantId of participants) {
        if (participantId !== userId) { // Don't echo back to sender
          this.sendToUser(participantId, chatMessage);
        }
      }
    }
  }

  /**
   * Handle presence updates
   */
  private async handlePresenceUpdate(userId: string, message: RealtimeMessage): Promise<void> {
    const { status } = message.payload; // online, away, busy, offline

    await this.updateUserPresence(userId, status);

    // Broadcast presence to relevant channels
    const session = this.sessions.get(userId);
    if (session) {
      for (const channel of session.channels) {
        this.broadcastToChannel(channel, {
          type: 'presence_update',
          payload: {
            userId,
            status,
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        }, userId);
      }
    }
  }

  /**
   * Handle typing indicators
   */
  private async handleTypingIndicator(userId: string, message: RealtimeMessage): Promise<void> {
    const { conversationId, isTyping, participants } = message.payload;

    if (participants && Array.isArray(participants)) {
      for (const participantId of participants) {
        if (participantId !== userId) {
          this.sendToUser(participantId, {
            type: 'typing_indicator',
            payload: {
              conversationId,
              userId,
              isTyping,
              timestamp: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  /**
   * Handle dashboard updates
   */
  private async handleDashboardUpdate(userId: string, message: RealtimeMessage): Promise<void> {
    const { metrics, targetUsers } = message.payload;

    const updateMessage: RealtimeMessage = {
      type: 'dashboard_update',
      payload: {
        metrics,
        updatedBy: userId,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    if (targetUsers && Array.isArray(targetUsers)) {
      for (const targetUserId of targetUsers) {
        this.sendToUser(targetUserId, updateMessage);
      }
    }
  }

  /**
   * Handle pitch view updates
   */
  private async handlePitchViewUpdate(userId: string, message: RealtimeMessage): Promise<void> {
    const { pitchId, action, metadata } = message.payload;

    // Broadcast to interested users (e.g., pitch creator, team members)
    const updateMessage: RealtimeMessage = {
      type: 'pitch_view_update',
      payload: {
        pitchId,
        action, // viewed, liked, commented, etc.
        userId,
        metadata,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    // Get pitch owner and notify them
    try {
      const result = await this.db.query(`
        SELECT creator_id FROM pitches WHERE id = $1
      `, [pitchId]);

      if (result.rows && result.rows.length > 0) {
        const creatorId = result.rows[0].creator_id;
        if (creatorId !== userId) { // Don't notify creator of their own actions
          this.sendToUser(creatorId.toString(), updateMessage);
        }
      }
    } catch (error) {
      console.error('Error getting pitch creator for update:', error);
    }
  }

  /**
   * Send message to specific user
   */
  private sendToUser(userId: string, message: RealtimeMessage): boolean {
    const session = this.sessions.get(userId);
    if (session && session.websocket.readyState === WebSocket.READY_STATE_OPEN) {
      try {
        session.websocket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error(`Error sending message to user ${userId}:`, error);
        this.handleDisconnect(userId);
        return false;
      }
    }
    return false;
  }

  /**
   * Broadcast message to all users in a channel
   */
  private broadcastToChannel(channelId: string, message: RealtimeMessage, excludeUserId?: string): void {
    const channelUsers = this.channels.get(channelId);
    if (channelUsers) {
      for (const userId of channelUsers) {
        if (userId !== excludeUserId) {
          this.sendToUser(userId, message);
        }
      }
    }
  }

  /**
   * Subscribe user to a channel
   */
  public subscribeUserToChannel(userId: string, channelId: string): boolean {
    const session = this.sessions.get(userId);
    if (!session) return false;

    if (session.channels.size >= this.config.maxChannelsPerUser) {
      console.warn(`User ${userId} exceeded maximum channels limit`);
      return false;
    }

    // Add user to session channels
    session.channels.add(channelId);

    // Add user to global channel mapping
    if (!this.channels.has(channelId)) {
      this.channels.set(channelId, new Set());
    }
    this.channels.get(channelId)!.add(userId);

    return true;
  }

  /**
   * Unsubscribe user from a channel
   */
  public unsubscribeUserFromChannel(userId: string, channelId: string): boolean {
    const session = this.sessions.get(userId);
    if (session) {
      session.channels.delete(channelId);
    }

    const channelUsers = this.channels.get(channelId);
    if (channelUsers) {
      channelUsers.delete(userId);
      if (channelUsers.size === 0) {
        this.channels.delete(channelId);
      }
    }

    return true;
  }

  /**
   * Handle user disconnect
   */
  private async handleDisconnect(userId: string): Promise<void> {
    console.log(`User ${userId} disconnected from WebSocket`);

    const session = this.sessions.get(userId);
    if (!session) return;

    // Update presence to offline
    if (this.config.enablePresence) {
      await this.updateUserPresence(userId, 'offline');
    }

    // Remove from all channels
    for (const channelId of session.channels) {
      this.unsubscribeUserFromChannel(userId, channelId);
    }

    // Remove session
    this.sessions.delete(userId);

    console.log(`Cleaned up session for user ${userId}`);
  }

  /**
   * Update user presence
   */
  private async updateUserPresence(userId: string, status: string): Promise<void> {
    try {
      // Update in database
      await this.db.query(`
        INSERT INTO user_presence (user_id, status, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET status = $2, updated_at = NOW()
      `, [userId, status]);
    } catch (error) {
      console.error('Error updating user presence:', error);
    }
  }

  /**
   * Start heartbeat to clean up stale connections
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = new Date();
      const staleUsers: string[] = [];

      for (const [userId, session] of this.sessions) {
        const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
        
        if (timeSinceActivity > this.config.sessionTimeout) {
          staleUsers.push(userId);
        } else {
          // Send ping to keep connection alive
          try {
            session.websocket.send(JSON.stringify({
              type: 'ping',
              payload: { timestamp: now.getTime() },
              timestamp: now.toISOString()
            }));
          } catch (error) {
            console.error(`Error sending ping to user ${userId}:`, error);
            staleUsers.push(userId);
          }
        }
      }

      // Clean up stale connections
      for (const userId of staleUsers) {
        this.handleDisconnect(userId);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Get service statistics
   */
  public getStats(): object {
    return {
      activeSessions: this.sessions.size,
      activeChannels: this.channels.size,
      totalChannelSubscriptions: Array.from(this.channels.values()).reduce((sum, users) => sum + users.size, 0),
      config: this.config,
      uptime: process.uptime() || 0
    };
  }

  /**
   * Broadcast system message to all connected users
   */
  public broadcastSystemMessage(message: string, type: string = 'system'): void {
    const systemMessage: RealtimeMessage = {
      type: 'notification',
      payload: {
        type,
        message,
        timestamp: new Date().toISOString(),
        system: true
      },
      timestamp: new Date().toISOString()
    };

    for (const userId of this.sessions.keys()) {
      this.sendToUser(userId, systemMessage);
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Close all WebSocket connections
    for (const [userId, session] of this.sessions) {
      try {
        session.websocket.close();
      } catch (error) {
        console.error(`Error closing WebSocket for user ${userId}:`, error);
      }
    }

    this.sessions.clear();
    this.channels.clear();
  }
}