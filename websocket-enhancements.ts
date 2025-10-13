// WebSocket Enhancements Implementation
// Phase 2A: Complete WebSocket handlers and reliability

// ============================================
// 1. MESSAGE TYPE DEFINITIONS
// ============================================

export enum WebSocketMessageType {
  // Connection Management
  PING = 'ping',
  PONG = 'pong',
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  RECONNECT = 'reconnect',
  
  // Authentication
  AUTH = 'auth',
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  
  // Real-time Updates
  NOTIFICATION_NEW = 'notification:new',
  NOTIFICATION_READ = 'notification:read',
  DASHBOARD_UPDATE = 'dashboard:update',
  METRICS_UPDATE = 'metrics:update',
  
  // Messaging
  MESSAGE_SEND = 'message:send',
  MESSAGE_RECEIVE = 'message:receive',
  MESSAGE_READ = 'message:read',
  TYPING_START = 'typing:start',
  TYPING_STOP = 'typing:stop',
  
  // Presence
  PRESENCE_UPDATE = 'presence:update',
  USER_ONLINE = 'user:online',
  USER_OFFLINE = 'user:offline',
  USER_AWAY = 'user:away',
  
  // Subscriptions
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  SUBSCRIBE_NOTIFICATIONS = 'subscribe:notifications',
  SUBSCRIBE_DASHBOARD = 'subscribe:dashboard',
  SUBSCRIBE_PITCH = 'subscribe:pitch',
  
  // Pitch Interactions
  PITCH_VIEW = 'pitch:view',
  PITCH_LIKE = 'pitch:like',
  PITCH_UNLIKE = 'pitch:unlike',
  PITCH_COMMENT = 'pitch:comment',
  PITCH_UPDATE = 'pitch:update',
  
  // Conversation
  JOIN_CONVERSATION = 'conversation:join',
  LEAVE_CONVERSATION = 'conversation:leave',
  CONVERSATION_UPDATE = 'conversation:update',
  
  // Data Requests
  REQUEST_INITIAL_DATA = 'request:initial_data',
  REQUEST_HISTORY = 'request:history',
  
  // Error Handling
  ERROR = 'error',
  RATE_LIMIT = 'rate_limit',
  
  // Cache
  CACHE_INVALIDATE = 'cache:invalidate',
  CACHE_UPDATE = 'cache:update'
}

// ============================================
// 2. MESSAGE INTERFACES
// ============================================

interface WebSocketMessage<T = any> {
  id?: string;
  type: WebSocketMessageType;
  payload?: T;
  timestamp: string;
  userId?: number;
  metadata?: {
    requestId?: string;
    retryCount?: number;
    origin?: string;
  };
}

interface ErrorPayload {
  code: string;
  message: string;
  details?: any;
  recoverable?: boolean;
}

// ============================================
// 3. BACKEND WEBSOCKET HANDLER IMPLEMENTATIONS
// ============================================

// Add these handlers to working-server.ts WebSocket section

export const websocketHandlers = {
  // Pitch interaction handlers
  [WebSocketMessageType.PITCH_VIEW]: async (ws: WebSocket, data: any, userId: number) => {
    const { pitchId } = data.payload;
    
    // Record view in database
    await db.insert(analyticsEvents).values({
      eventType: 'pitch_view',
      userId,
      entityType: 'pitch',
      entityId: pitchId,
      metadata: { source: 'websocket' },
      createdAt: new Date()
    });
    
    // Update view count
    await db
      .update(pitches)
      .set({ viewCount: sql`view_count + 1` })
      .where(eq(pitches.id, pitchId));
    
    // Broadcast to subscribers
    broadcastToPitchSubscribers(pitchId, {
      type: WebSocketMessageType.METRICS_UPDATE,
      payload: { pitchId, viewCount: await getPitchViewCount(pitchId) }
    });
  },
  
  [WebSocketMessageType.PITCH_LIKE]: async (ws: WebSocket, data: any, userId: number) => {
    const { pitchId } = data.payload;
    
    // Add like to database
    await db.insert(pitchLikes).values({
      userId,
      pitchId,
      createdAt: new Date()
    }).onConflictDoNothing();
    
    // Update like count
    const likeCount = await db
      .select({ count: sql`count(*)` })
      .from(pitchLikes)
      .where(eq(pitchLikes.pitchId, pitchId));
    
    // Send confirmation
    ws.send(JSON.stringify({
      type: WebSocketMessageType.PITCH_LIKE,
      payload: { pitchId, liked: true, likeCount: likeCount[0].count }
    }));
    
    // Notify pitch creator
    const pitch = await db.select().from(pitches).where(eq(pitches.id, pitchId)).limit(1);
    if (pitch[0]) {
      sendNotificationToUser(pitch[0].userId, {
        type: 'pitch_liked',
        message: 'Someone liked your pitch!',
        pitchId
      });
    }
  },
  
  [WebSocketMessageType.PITCH_COMMENT]: async (ws: WebSocket, data: any, userId: number) => {
    const { pitchId, comment } = data.payload;
    
    // Add comment to database
    const newComment = await db.insert(pitchComments).values({
      userId,
      pitchId,
      content: comment,
      createdAt: new Date()
    }).returning();
    
    // Broadcast to pitch subscribers
    broadcastToPitchSubscribers(pitchId, {
      type: WebSocketMessageType.PITCH_COMMENT,
      payload: {
        pitchId,
        comment: {
          ...newComment[0],
          user: await getUserBasicInfo(userId)
        }
      }
    });
  },
  
  [WebSocketMessageType.JOIN_CONVERSATION]: async (ws: WebSocket, data: any, userId: number) => {
    const { conversationId } = data.payload;
    
    // Add to conversation room
    addToRoom(ws, `conversation:${conversationId}`);
    
    // Mark as active in conversation
    await db.insert(conversationActivity).values({
      conversationId,
      userId,
      status: 'active',
      lastActive: new Date()
    }).onConflictDoUpdate({
      target: [conversationActivity.conversationId, conversationActivity.userId],
      set: { status: 'active', lastActive: new Date() }
    });
    
    // Send recent messages
    const messages = await getRecentMessages(conversationId, 50);
    ws.send(JSON.stringify({
      type: WebSocketMessageType.CONVERSATION_UPDATE,
      payload: { conversationId, messages }
    }));
    
    // Notify other participants
    broadcastToRoom(`conversation:${conversationId}`, {
      type: WebSocketMessageType.USER_ONLINE,
      payload: { userId, conversationId }
    }, ws);
  },
  
  [WebSocketMessageType.LEAVE_CONVERSATION]: async (ws: WebSocket, data: any, userId: number) => {
    const { conversationId } = data.payload;
    
    // Remove from room
    removeFromRoom(ws, `conversation:${conversationId}`);
    
    // Update activity status
    await db
      .update(conversationActivity)
      .set({ status: 'inactive' })
      .where(
        and(
          eq(conversationActivity.conversationId, conversationId),
          eq(conversationActivity.userId, userId)
        )
      );
    
    // Notify other participants
    broadcastToRoom(`conversation:${conversationId}`, {
      type: WebSocketMessageType.USER_OFFLINE,
      payload: { userId, conversationId }
    }, ws);
  },
  
  [WebSocketMessageType.SUBSCRIBE_PITCH]: async (ws: WebSocket, data: any, userId: number) => {
    const { pitchId } = data.payload;
    
    // Add to pitch room
    addToRoom(ws, `pitch:${pitchId}`);
    
    // Send current pitch metrics
    const metrics = await getPitchMetrics(pitchId);
    ws.send(JSON.stringify({
      type: WebSocketMessageType.METRICS_UPDATE,
      payload: { pitchId, metrics }
    }));
  },
  
  [WebSocketMessageType.PRESENCE_UPDATE]: async (ws: WebSocket, data: any, userId: number) => {
    const { status } = data.payload; // 'online', 'away', 'offline'
    
    // Update presence in cache/database
    await updateUserPresence(userId, status);
    
    // Broadcast to relevant users (followers, conversation members)
    const followers = await getUserFollowers(userId);
    const conversations = await getUserActiveConversations(userId);
    
    const presenceUpdate = {
      type: WebSocketMessageType.PRESENCE_UPDATE,
      payload: { userId, status, timestamp: new Date().toISOString() }
    };
    
    // Send to followers
    followers.forEach(followerId => {
      sendToUser(followerId, presenceUpdate);
    });
    
    // Send to conversation members
    conversations.forEach(conv => {
      broadcastToRoom(`conversation:${conv.id}`, presenceUpdate, ws);
    });
  }
};

// ============================================
// 4. FRONTEND WEBSOCKET ENHANCEMENTS
// ============================================

// Enhanced WebSocket hook with offline queue and reconnection
export class EnhancedWebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly initialDelay = 1000;
  private readonly maxDelay = 30000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private offlineQueue: WebSocketMessage[] = [];
  private messageHandlers = new Map<string, (data: any) => void>();
  private connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed' = 'disconnected';
  private lastPingTime = Date.now();
  
  constructor(private url: string, private token: string) {
    this.loadOfflineQueue();
    this.connect();
  }
  
  private connect() {
    this.connectionState = 'connecting';
    this.ws = new WebSocket(`${this.url}?token=${this.token}`);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
      
      // Authenticate
      this.send(WebSocketMessageType.AUTH, { token: this.token });
      
      // Flush offline queue
      this.flushOfflineQueue();
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Request initial data
      this.send(WebSocketMessageType.REQUEST_INITIAL_DATA);
    };
    
    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        // Handle system messages
        switch (message.type) {
          case WebSocketMessageType.PING:
            this.send(WebSocketMessageType.PONG, { timestamp: message.timestamp });
            break;
            
          case WebSocketMessageType.PONG:
            this.lastPingTime = Date.now();
            break;
            
          case WebSocketMessageType.ERROR:
            this.handleError(message.payload as ErrorPayload);
            break;
            
          case WebSocketMessageType.AUTH_SUCCESS:
            console.log('Authentication successful');
            break;
            
          case WebSocketMessageType.AUTH_FAILURE:
            console.error('Authentication failed');
            this.connectionState = 'failed';
            break;
            
          default:
            // Handle user-defined messages
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
              handler(message.payload);
            } else {
              console.warn(`Unhandled message type: ${message.type}`);
            }
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.connectionState = 'disconnected';
      this.stopHeartbeat();
      this.reconnect();
    };
  }
  
  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.connectionState = 'failed';
      return;
    }
    
    const delay = Math.min(
      this.initialDelay * Math.pow(2, this.reconnectAttempts),
      this.maxDelay
    );
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  private startHeartbeat() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send(WebSocketMessageType.PING, { timestamp: Date.now() });
        
        // Check for stale connection
        if (Date.now() - this.lastPingTime > 60000) {
          console.warn('Connection appears stale, reconnecting...');
          this.ws.close();
        }
      }
    }, 30000);
  }
  
  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  private handleError(error: ErrorPayload) {
    console.error(`WebSocket error: ${error.code} - ${error.message}`);
    
    switch (error.code) {
      case 'AUTH_FAILED':
        // Redirect to login
        window.location.href = '/login';
        break;
        
      case 'RATE_LIMIT':
        // Show rate limit message
        this.showNotification('Too many requests. Please slow down.');
        break;
        
      default:
        // Show generic error
        this.showNotification(error.message || 'An error occurred');
    }
  }
  
  send(type: WebSocketMessageType, payload?: any) {
    const message: WebSocketMessage = {
      id: this.generateId(),
      type,
      payload,
      timestamp: new Date().toISOString(),
      metadata: {
        requestId: this.generateId()
      }
    };
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.queueMessage(message);
      this.showNotification('Message queued. Will send when connected.');
    }
  }
  
  private queueMessage(message: WebSocketMessage) {
    this.offlineQueue.push(message);
    this.saveOfflineQueue();
  }
  
  private flushOfflineQueue() {
    console.log(`Flushing ${this.offlineQueue.length} queued messages`);
    
    while (this.offlineQueue.length > 0) {
      const message = this.offlineQueue.shift();
      if (message && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      }
    }
    
    this.saveOfflineQueue();
  }
  
  private loadOfflineQueue() {
    const saved = localStorage.getItem('websocket_offline_queue');
    if (saved) {
      try {
        this.offlineQueue = JSON.parse(saved);
      } catch (error) {
        console.error('Failed to load offline queue:', error);
        this.offlineQueue = [];
      }
    }
  }
  
  private saveOfflineQueue() {
    localStorage.setItem('websocket_offline_queue', JSON.stringify(this.offlineQueue));
  }
  
  on(type: WebSocketMessageType, handler: (data: any) => void) {
    this.messageHandlers.set(type, handler);
  }
  
  off(type: WebSocketMessageType) {
    this.messageHandlers.delete(type);
  }
  
  getConnectionState() {
    return this.connectionState;
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private showNotification(message: string) {
    // Implement your notification system
    console.log(`Notification: ${message}`);
  }
  
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
  }
}

// ============================================
// 5. HELPER FUNCTIONS
// ============================================

// Room management for backend
const rooms = new Map<string, Set<WebSocket>>();

function addToRoom(ws: WebSocket, roomName: string) {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  rooms.get(roomName)!.add(ws);
}

function removeFromRoom(ws: WebSocket, roomName: string) {
  rooms.get(roomName)?.delete(ws);
  if (rooms.get(roomName)?.size === 0) {
    rooms.delete(roomName);
  }
}

function broadcastToRoom(roomName: string, message: any, exclude?: WebSocket) {
  const room = rooms.get(roomName);
  if (room) {
    const messageStr = JSON.stringify(message);
    room.forEach(ws => {
      if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }
}

// User connection tracking
const userConnections = new Map<number, Set<WebSocket>>();

function addUserConnection(userId: number, ws: WebSocket) {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId)!.add(ws);
}

function removeUserConnection(userId: number, ws: WebSocket) {
  userConnections.get(userId)?.delete(ws);
  if (userConnections.get(userId)?.size === 0) {
    userConnections.delete(userId);
  }
}

function sendToUser(userId: number, message: any) {
  const connections = userConnections.get(userId);
  if (connections) {
    const messageStr = JSON.stringify(message);
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }
}

// ============================================
// 6. REACT COMPONENT FOR CONNECTION STATUS
// ============================================

export const ConnectionIndicator: React.FC = () => {
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  
  useEffect(() => {
    // Subscribe to connection state changes
    const interval = setInterval(() => {
      // Get state from WebSocket manager
      const state = window.wsManager?.getConnectionState() || 'disconnected';
      setConnectionState(state);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const states = {
    connected: { color: 'green', text: 'Connected', icon: '🟢' },
    connecting: { color: 'yellow', text: 'Connecting...', icon: '🟡' },
    disconnected: { color: 'red', text: 'Disconnected', icon: '🔴' },
    failed: { color: 'red', text: 'Connection Failed', icon: '❌' }
  };
  
  const state = states[connectionState as keyof typeof states] || states.disconnected;
  
  return (
    <div 
      className={`connection-indicator connection-${state.color}`}
      title={`WebSocket: ${state.text}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        backgroundColor: `var(--color-${state.color}-light)`,
        color: `var(--color-${state.color}-dark)`
      }}
    >
      <span>{state.icon}</span>
      <span>{state.text}</span>
    </div>
  );
};