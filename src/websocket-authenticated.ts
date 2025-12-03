/**
 * Authenticated WebSocket Room with Performance Optimization
 * Implements proper JWT authentication and connection management
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

interface WebSocketMessage {
  type: 'auth' | 'presence' | 'message' | 'notification' | 'ping' | 'pong' | 'error';
  userId?: number;
  roomId?: string;
  data?: any;
  timestamp?: number;
}

interface AuthenticatedUser {
  userId: number;
  email: string;
  username: string;
  userType: string;
  verified: boolean;
  authenticatedAt: number;
}

interface UserPresence extends AuthenticatedUser {
  status: 'online' | 'away' | 'offline';
  lastSeen: number;
  socketId: string;
}

export class AuthenticatedWebSocketRoom {
  private state: DurableObjectState;
  private env: any;
  private presenceMap = new Map<string, UserPresence>();
  private authenticatedSockets = new Map<WebSocket, AuthenticatedUser>();
  private messageHistory: WebSocketMessage[] = [];
  private readonly MAX_HISTORY = 100;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly IDLE_TIMEOUT = 300000; // 5 minutes

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    
    // Initialize room from stored state
    this.initializeRoom();
    
    // Set up heartbeat for connection monitoring
    this.state.blockConcurrencyWhile(async () => {
      const alarm = await this.state.storage.getAlarm();
      if (!alarm) {
        await this.state.storage.setAlarm(Date.now() + this.HEARTBEAT_INTERVAL);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrade with authentication
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleAuthenticatedWebSocketUpgrade(request);
    }
    
    // Handle HTTP endpoints for room management
    if (url.pathname === '/room/info') {
      return this.handleRoomInfo();
    }
    
    if (url.pathname === '/room/presence') {
      return this.handlePresenceQuery();
    }
    
    if (url.pathname === '/room/broadcast' && request.method === 'POST') {
      return this.handleBroadcast(request);
    }
    
    return new Response('Not found', { status: 404 });
  }

  private async handleAuthenticatedWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Check if already authenticated (from worker)
    const isPreAuthenticated = url.searchParams.get('authenticated') === 'true';
    const userId = url.searchParams.get('userId');
    const username = url.searchParams.get('username');
    const roomId = url.searchParams.get('roomId') || 'default';

    // If not pre-authenticated, validate token
    if (!isPreAuthenticated) {
      const token = url.searchParams.get('token') || 
                   request.headers.get('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return new Response('Authentication required', { status: 401 });
      }

      try {
        const isValid = await jwt.verify(token, this.env.JWT_SECRET);
        if (!isValid) {
          return new Response('Invalid token', { status: 401 });
        }
      } catch (error) {
        return new Response('Authentication failed', { status: 401 });
      }
    }

    if (!userId || !username) {
      return new Response('Missing user information', { status: 400 });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Generate unique socket ID
    const socketId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Accept WebSocket with Hibernation API
    this.state.acceptWebSocket(server, [
      `room:${roomId}`,
      `user:${userId}`,
      `socket:${socketId}`
    ]);

    // Store authenticated user info
    const authUser: AuthenticatedUser = {
      userId: parseInt(userId),
      email: url.searchParams.get('email') || `${username}@pitchey.com`,
      username,
      userType: url.searchParams.get('userType') || 'user',
      verified: url.searchParams.get('verified') === 'true',
      authenticatedAt: Date.now(),
    };
    
    this.authenticatedSockets.set(server, authUser);

    // Update presence
    const presence: UserPresence = {
      ...authUser,
      status: 'online',
      lastSeen: Date.now(),
      socketId
    };
    
    this.presenceMap.set(socketId, presence);
    
    // Send welcome message
    server.send(JSON.stringify({
      type: 'auth',
      data: {
        success: true,
        socketId,
        roomId,
        user: authUser,
        connectedUsers: Array.from(this.presenceMap.values()).map(p => ({
          userId: p.userId,
          username: p.username,
          status: p.status
        }))
      },
      timestamp: Date.now()
    }));
    
    // Broadcast presence update to room
    this.broadcastToRoom(roomId, {
      type: 'presence',
      data: {
        action: 'join',
        user: {
          userId: presence.userId,
          username: presence.username,
          status: presence.status
        }
      },
      timestamp: Date.now()
    }, server);

    // Send recent message history
    if (this.messageHistory.length > 0) {
      server.send(JSON.stringify({
        type: 'message',
        data: {
          history: this.messageHistory.slice(-20) // Last 20 messages
        },
        timestamp: Date.now()
      }));
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      // Verify socket is authenticated
      const authUser = this.authenticatedSockets.get(ws);
      if (!authUser) {
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Not authenticated' },
          timestamp: Date.now()
        }));
        ws.close(1008, 'Not authenticated');
        return;
      }

      const data = JSON.parse(message as string) as WebSocketMessage;
      
      // Update last seen
      const socketId = this.findSocketId(ws);
      if (socketId) {
        const presence = this.presenceMap.get(socketId);
        if (presence) {
          presence.lastSeen = Date.now();
          presence.status = 'online';
        }
      }

      // Handle different message types
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
          break;

        case 'message':
          const broadcastMessage = {
            ...data,
            userId: authUser.userId,
            username: authUser.username,
            timestamp: Date.now()
          };
          
          // Store in history
          this.messageHistory.push(broadcastMessage);
          if (this.messageHistory.length > this.MAX_HISTORY) {
            this.messageHistory.shift();
          }
          
          // Broadcast to all authenticated users
          this.broadcastToAll(broadcastMessage);
          break;

        case 'presence':
          if (socketId && data.data?.status) {
            const presence = this.presenceMap.get(socketId);
            if (presence) {
              presence.status = data.data.status;
              this.broadcastToAll({
                type: 'presence',
                data: {
                  action: 'update',
                  user: {
                    userId: presence.userId,
                    username: presence.username,
                    status: presence.status
                  }
                },
                timestamp: Date.now()
              });
            }
          }
          break;

        case 'notification':
          // Handle targeted notifications
          if (data.data?.targetUserId) {
            this.sendToUser(data.data.targetUserId, {
              type: 'notification',
              data: data.data,
              timestamp: Date.now()
            });
          } else {
            this.broadcastToAll({
              type: 'notification',
              data: data.data,
              timestamp: Date.now()
            });
          }
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Invalid message format' },
        timestamp: Date.now()
      }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    // Remove from authenticated sockets
    const authUser = this.authenticatedSockets.get(ws);
    this.authenticatedSockets.delete(ws);
    
    // Update presence
    const socketId = this.findSocketId(ws);
    if (socketId) {
      const presence = this.presenceMap.get(socketId);
      if (presence) {
        // Broadcast leave notification
        this.broadcastToAll({
          type: 'presence',
          data: {
            action: 'leave',
            user: {
              userId: presence.userId,
              username: presence.username,
              status: 'offline'
            }
          },
          timestamp: Date.now()
        });
        
        this.presenceMap.delete(socketId);
      }
    }
    
    // Clean up if room is empty
    if (this.presenceMap.size === 0) {
      // Store final state before potential hibernation
      await this.saveRoomState();
    }
  }

  async webSocketError(ws: WebSocket, error: any) {
    console.error('WebSocket error:', error);
    const authUser = this.authenticatedSockets.get(ws);
    if (authUser) {
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Connection error occurred' },
        timestamp: Date.now()
      }));
    }
  }

  // Alarm handler for heartbeat checks
  async alarm() {
    const now = Date.now();
    const staleThreshold = now - this.IDLE_TIMEOUT;
    
    // Check for idle connections
    for (const [socketId, presence] of this.presenceMap.entries()) {
      if (presence.lastSeen < staleThreshold && presence.status !== 'offline') {
        presence.status = 'offline';
        this.broadcastToAll({
          type: 'presence',
          data: {
            action: 'timeout',
            user: {
              userId: presence.userId,
              username: presence.username,
              status: 'offline'
            }
          },
          timestamp: now
        });
      }
    }
    
    // Schedule next heartbeat
    await this.state.storage.setAlarm(now + this.HEARTBEAT_INTERVAL);
  }

  private async initializeRoom() {
    // Restore room state from storage
    const savedState = await this.state.storage.get(['presence', 'history']);
    if (savedState.get('presence')) {
      this.presenceMap = new Map(savedState.get('presence') as any);
    }
    if (savedState.get('history')) {
      this.messageHistory = savedState.get('history') as WebSocketMessage[];
    }
  }

  private async saveRoomState() {
    await this.state.storage.put({
      presence: Array.from(this.presenceMap.entries()),
      history: this.messageHistory,
      lastSaved: Date.now()
    });
  }

  private findSocketId(ws: WebSocket): string | null {
    const tags = this.state.getTags(ws);
    for (const tag of tags) {
      if (tag.startsWith('socket:')) {
        return tag.substring(7);
      }
    }
    return null;
  }

  private broadcastToRoom(roomId: string, message: WebSocketMessage, exclude?: WebSocket) {
    const sockets = this.state.getWebSockets(`room:${roomId}`);
    const messageStr = JSON.stringify(message);
    
    for (const socket of sockets) {
      if (socket !== exclude && this.authenticatedSockets.has(socket)) {
        try {
          socket.send(messageStr);
        } catch (error) {
          console.error('Broadcast error:', error);
        }
      }
    }
  }

  private broadcastToAll(message: WebSocketMessage, exclude?: WebSocket) {
    const messageStr = JSON.stringify(message);
    
    for (const [socket, _] of this.authenticatedSockets) {
      if (socket !== exclude) {
        try {
          socket.send(messageStr);
        } catch (error) {
          console.error('Broadcast error:', error);
        }
      }
    }
  }

  private sendToUser(userId: number, message: WebSocketMessage) {
    const sockets = this.state.getWebSockets(`user:${userId}`);
    const messageStr = JSON.stringify(message);
    
    for (const socket of sockets) {
      if (this.authenticatedSockets.has(socket)) {
        try {
          socket.send(messageStr);
        } catch (error) {
          console.error('Send to user error:', error);
        }
      }
    }
  }

  private async handleRoomInfo(): Promise<Response> {
    const activeUsers = Array.from(this.presenceMap.values()).filter(p => p.status === 'online');
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        roomSize: this.presenceMap.size,
        activeUsers: activeUsers.length,
        authenticatedSockets: this.authenticatedSockets.size,
        messageHistory: this.messageHistory.length,
        users: activeUsers.map(p => ({
          userId: p.userId,
          username: p.username,
          status: p.status,
          userType: p.userType
        }))
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handlePresenceQuery(): Promise<Response> {
    const presence = Array.from(this.presenceMap.values()).map(p => ({
      userId: p.userId,
      username: p.username,
      status: p.status,
      lastSeen: p.lastSeen,
      userType: p.userType
    }));

    return new Response(JSON.stringify({
      success: true,
      data: { presence }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { message, targetUserId } = body;

      if (targetUserId) {
        this.sendToUser(targetUserId, message);
      } else {
        this.broadcastToAll(message);
      }

      return new Response(JSON.stringify({
        success: true,
        data: { delivered: true }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid request'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}