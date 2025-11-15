/**
 * WebSocket Cluster and Optimization Service
 * Provides advanced WebSocket management with clustering, load balancing, and performance optimization
 */

import { telemetry } from "../utils/telemetry.ts";

export interface WebSocketConnection {
  id: string;
  socket: WebSocket;
  userId?: string;
  rooms: Set<string>;
  lastActivity: number;
  messageCount: number;
  subscriptions: Set<string>;
  metadata: {
    userAgent?: string;
    ip?: string;
    sessionId?: string;
    connectedAt: number;
  };
}

export interface WebSocketRoom {
  id: string;
  name: string;
  connections: Set<string>;
  messageQueue: WebSocketMessage[];
  maxConnections?: number;
  persistent: boolean;
  metadata: {
    createdAt: number;
    lastActivity: number;
    messageCount: number;
    owner?: string;
  };
}

export interface WebSocketMessage {
  id: string;
  type: "broadcast" | "room" | "private" | "system";
  payload: any;
  target?: string; // room or user ID
  sender?: string; // connection ID
  timestamp: number;
  priority: number; // 1-10, higher = more important
  ttl?: number; // time to live in ms
  persistent?: boolean;
}

export interface ClusterNode {
  id: string;
  address: string;
  port: number;
  connections: number;
  load: number;
  lastHeartbeat: number;
  status: "active" | "degraded" | "failed";
  capabilities: string[];
}

export interface WebSocketMetrics {
  totalConnections: number;
  activeRooms: number;
  messagesPerSecond: number;
  averageLatency: number;
  bandwidthUsage: number;
  errorRate: number;
  clusterHealth: number;
}

export class WebSocketClusterService {
  private static connections = new Map<string, WebSocketConnection>();
  private static rooms = new Map<string, WebSocketRoom>();
  private static messageQueue: WebSocketMessage[] = [];
  private static clusterNodes = new Map<string, ClusterNode>();
  private static metrics: WebSocketMetrics = {
    totalConnections: 0,
    activeRooms: 0,
    messagesPerSecond: 0,
    averageLatency: 0,
    bandwidthUsage: 0,
    errorRate: 0,
    clusterHealth: 100
  };
  
  private static nodeId = crypto.randomUUID();
  private static isClusterEnabled = false;
  private static heartbeatInterval?: number;
  
  /**
   * Initialize WebSocket cluster service
   */
  static initialize(config: {
    enableClustering?: boolean;
    nodeAddress?: string;
    nodePort?: number;
    capabilities?: string[];
  } = {}) {
    console.log("🔧 Initializing WebSocket cluster service...");
    
    this.isClusterEnabled = config.enableClustering || false;
    
    if (this.isClusterEnabled) {
      console.log(`   🌐 Cluster mode enabled (Node ID: ${this.nodeId.substring(0, 8)})`);
      
      // Register this node in the cluster
      this.registerNode({
        id: this.nodeId,
        address: config.nodeAddress || "localhost",
        port: config.nodePort || 8001,
        connections: 0,
        load: 0,
        lastHeartbeat: Date.now(),
        status: "active",
        capabilities: config.capabilities || ["websocket", "rooms", "messaging"]
      });
      
      // Start heartbeat
      this.startHeartbeat();
    }
    
    // Create default system rooms
    this.createRoom("system", "System Notifications", { persistent: true });
    this.createRoom("lobby", "General Lobby", { persistent: true });
    
    // Start background tasks
    this.startMessageProcessor();
    this.startMetricsCollector();
    this.startConnectionCleaner();
    
    console.log("✅ WebSocket cluster service initialized");
  }
  
  /**
   * Handle new WebSocket connection
   */
  static handleConnection(
    socket: WebSocket, 
    request: Request,
    connectionId?: string
  ): string {
    const id = connectionId || crypto.randomUUID();
    const url = new URL(request.url);
    
    const connection: WebSocketConnection = {
      id,
      socket,
      rooms: new Set(),
      lastActivity: Date.now(),
      messageCount: 0,
      subscriptions: new Set(),
      metadata: {
        userAgent: request.headers.get("user-agent") || undefined,
        ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        sessionId: url.searchParams.get("sessionId") || undefined,
        connectedAt: Date.now()
      }
    };
    
    this.connections.set(id, connection);
    this.updateMetrics();
    
    // Setup socket event handlers
    this.setupSocketHandlers(connection);
    
    // Join default room
    this.joinRoom(id, "lobby");
    
    // Send welcome message
    this.sendToConnection(id, {
      type: "system",
      payload: {
        event: "connected",
        connectionId: id,
        timestamp: Date.now(),
        serverInfo: {
          nodeId: this.nodeId.substring(0, 8),
          clustered: this.isClusterEnabled
        }
      }
    });
    
    telemetry.logger.info("WebSocket connection established", {
      connectionId: id,
      ip: connection.metadata.ip,
      userAgent: connection.metadata.userAgent?.substring(0, 50)
    });
    
    return id;
  }
  
  /**
   * Setup socket event handlers
   */
  private static setupSocketHandlers(connection: WebSocketConnection) {
    const { socket, id } = connection;
    
    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        await this.handleMessage(id, data);
        
        connection.lastActivity = Date.now();
        connection.messageCount++;
        
      } catch (error) {
        telemetry.logger.error("WebSocket message error", error, { connectionId: id });
        this.sendToConnection(id, {
          type: "system",
          payload: {
            event: "error",
            message: "Invalid message format",
            timestamp: Date.now()
          }
        });
      }
    };
    
    socket.onclose = () => {
      this.handleDisconnection(id);
    };
    
    socket.onerror = (error) => {
      telemetry.logger.error("WebSocket error", error, { connectionId: id });
      this.handleDisconnection(id);
    };
  }
  
  /**
   * Handle incoming WebSocket message
   */
  private static async handleMessage(connectionId: string, data: any) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    const { type, payload } = data;
    
    switch (type) {
      case "ping":
        this.sendToConnection(connectionId, {
          type: "system",
          payload: { event: "pong", timestamp: Date.now() }
        });
        break;
        
      case "join_room":
        if (payload.roomId) {
          await this.joinRoom(connectionId, payload.roomId);
        }
        break;
        
      case "leave_room":
        if (payload.roomId) {
          await this.leaveRoom(connectionId, payload.roomId);
        }
        break;
        
      case "room_message":
        if (payload.roomId && payload.message) {
          await this.broadcastToRoom(payload.roomId, {
            type: "room",
            payload: {
              event: "message",
              message: payload.message,
              sender: connectionId,
              timestamp: Date.now()
            },
            sender: connectionId
          });
        }
        break;
        
      case "private_message":
        if (payload.targetConnectionId && payload.message) {
          await this.sendToConnection(payload.targetConnectionId, {
            type: "private",
            payload: {
              event: "private_message",
              message: payload.message,
              sender: connectionId,
              timestamp: Date.now()
            },
            sender: connectionId
          });
        }
        break;
        
      case "subscribe":
        if (payload.channel) {
          connection.subscriptions.add(payload.channel);
          this.sendToConnection(connectionId, {
            type: "system",
            payload: {
              event: "subscribed",
              channel: payload.channel,
              timestamp: Date.now()
            }
          });
        }
        break;
        
      case "unsubscribe":
        if (payload.channel) {
          connection.subscriptions.delete(payload.channel);
          this.sendToConnection(connectionId, {
            type: "system",
            payload: {
              event: "unsubscribed",
              channel: payload.channel,
              timestamp: Date.now()
            }
          });
        }
        break;
        
      default:
        telemetry.logger.warn("Unknown WebSocket message type", { type, connectionId });
    }
  }
  
  /**
   * Handle WebSocket disconnection
   */
  static handleDisconnection(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    // Leave all rooms
    for (const roomId of connection.rooms) {
      this.leaveRoom(connectionId, roomId, false);
    }
    
    // Remove connection
    this.connections.delete(connectionId);
    this.updateMetrics();
    
    telemetry.logger.info("WebSocket connection closed", {
      connectionId,
      duration: Date.now() - connection.metadata.connectedAt,
      messageCount: connection.messageCount
    });
  }
  
  /**
   * Join a room
   */
  static async joinRoom(connectionId: string, roomId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;
    
    let room = this.rooms.get(roomId);
    if (!room) {
      // Auto-create room
      room = this.createRoom(roomId, `Room ${roomId}`, { persistent: false });
    }
    
    // Check room capacity
    if (room.maxConnections && room.connections.size >= room.maxConnections) {
      this.sendToConnection(connectionId, {
        type: "system",
        payload: {
          event: "room_full",
          roomId,
          timestamp: Date.now()
        }
      });
      return false;
    }
    
    // Add to room
    room.connections.add(connectionId);
    connection.rooms.add(roomId);
    room.metadata.lastActivity = Date.now();
    
    // Notify room members
    this.broadcastToRoom(roomId, {
      type: "room",
      payload: {
        event: "user_joined",
        connectionId,
        roomId,
        memberCount: room.connections.size,
        timestamp: Date.now()
      }
    }, connectionId);
    
    // Send room info to new member
    this.sendToConnection(connectionId, {
      type: "system",
      payload: {
        event: "joined_room",
        roomId,
        roomName: room.name,
        memberCount: room.connections.size,
        timestamp: Date.now()
      }
    });
    
    return true;
  }
  
  /**
   * Leave a room
   */
  static async leaveRoom(connectionId: string, roomId: string, notify = true): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    const room = this.rooms.get(roomId);
    
    if (!connection || !room || !connection.rooms.has(roomId)) {
      return false;
    }
    
    // Remove from room
    room.connections.delete(connectionId);
    connection.rooms.delete(roomId);
    room.metadata.lastActivity = Date.now();
    
    if (notify) {
      // Notify room members
      this.broadcastToRoom(roomId, {
        type: "room",
        payload: {
          event: "user_left",
          connectionId,
          roomId,
          memberCount: room.connections.size,
          timestamp: Date.now()
        }
      });
      
      // Confirm to leaving user
      this.sendToConnection(connectionId, {
        type: "system",
        payload: {
          event: "left_room",
          roomId,
          timestamp: Date.now()
        }
      });
    }
    
    // Clean up empty non-persistent rooms
    if (room.connections.size === 0 && !room.persistent) {
      this.rooms.delete(roomId);
    }
    
    return true;
  }
  
  /**
   * Create a new room
   */
  static createRoom(
    id: string, 
    name: string, 
    options: {
      maxConnections?: number;
      persistent?: boolean;
      owner?: string;
    } = {}
  ): WebSocketRoom {
    const room: WebSocketRoom = {
      id,
      name,
      connections: new Set(),
      messageQueue: [],
      maxConnections: options.maxConnections,
      persistent: options.persistent || false,
      metadata: {
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
        owner: options.owner
      }
    };
    
    this.rooms.set(id, room);
    
    telemetry.logger.info("WebSocket room created", {
      roomId: id,
      name,
      maxConnections: options.maxConnections,
      persistent: options.persistent
    });
    
    return room;
  }
  
  /**
   * Broadcast message to all connections
   */
  static async broadcastToAll(message: Partial<WebSocketMessage>, excludeConnectionId?: string) {
    const fullMessage: WebSocketMessage = {
      id: crypto.randomUUID(),
      type: "broadcast",
      priority: 5,
      timestamp: Date.now(),
      ...message
    };
    
    for (const [connectionId, connection] of this.connections) {
      if (excludeConnectionId && connectionId === excludeConnectionId) continue;
      
      try {
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(JSON.stringify(fullMessage));
        }
      } catch (error) {
        telemetry.logger.error("Broadcast error", error, { connectionId });
        this.handleDisconnection(connectionId);
      }
    }
  }
  
  /**
   * Broadcast message to room
   */
  static async broadcastToRoom(
    roomId: string, 
    message: Partial<WebSocketMessage>, 
    excludeConnectionId?: string
  ) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const fullMessage: WebSocketMessage = {
      id: crypto.randomUUID(),
      type: "room",
      target: roomId,
      priority: 5,
      timestamp: Date.now(),
      ...message
    };
    
    room.metadata.messageCount++;
    room.metadata.lastActivity = Date.now();
    
    for (const connectionId of room.connections) {
      if (excludeConnectionId && connectionId === excludeConnectionId) continue;
      
      const connection = this.connections.get(connectionId);
      if (connection) {
        try {
          if (connection.socket.readyState === WebSocket.OPEN) {
            connection.socket.send(JSON.stringify(fullMessage));
          }
        } catch (error) {
          telemetry.logger.error("Room broadcast error", error, { connectionId, roomId });
          this.leaveRoom(connectionId, roomId, false);
        }
      }
    }
  }
  
  /**
   * Send message to specific connection
   */
  static sendToConnection(connectionId: string, message: Partial<WebSocketMessage>): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    const fullMessage: WebSocketMessage = {
      id: crypto.randomUUID(),
      type: "private",
      target: connectionId,
      priority: 5,
      timestamp: Date.now(),
      ...message
    };
    
    try {
      connection.socket.send(JSON.stringify(fullMessage));
      return true;
    } catch (error) {
      telemetry.logger.error("Send message error", error, { connectionId });
      this.handleDisconnection(connectionId);
      return false;
    }
  }
  
  /**
   * Send message to subscribers of a channel
   */
  static async broadcastToChannel(channel: string, message: Partial<WebSocketMessage>) {
    for (const [connectionId, connection] of this.connections) {
      if (connection.subscriptions.has(channel)) {
        this.sendToConnection(connectionId, {
          ...message,
          type: "broadcast",
          payload: {
            ...message.payload,
            channel
          }
        });
      }
    }
  }
  
  // Background processes
  
  private static startMessageProcessor() {
    setInterval(() => {
      this.processMessageQueue();
    }, 100); // Process every 100ms
  }
  
  private static processMessageQueue() {
    if (this.messageQueue.length === 0) return;
    
    // Sort by priority and timestamp
    this.messageQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.timestamp - b.timestamp; // Older first
    });
    
    // Process up to 100 messages per cycle
    const messagesToProcess = this.messageQueue.splice(0, 100);
    
    for (const message of messagesToProcess) {
      // Check TTL
      if (message.ttl && Date.now() > message.timestamp + message.ttl) {
        continue; // Skip expired messages
      }
      
      // Route message
      switch (message.type) {
        case "broadcast":
          this.broadcastToAll(message);
          break;
        case "room":
          if (message.target) {
            this.broadcastToRoom(message.target, message);
          }
          break;
        case "private":
          if (message.target) {
            this.sendToConnection(message.target, message);
          }
          break;
      }
    }
  }
  
  private static startMetricsCollector() {
    setInterval(() => {
      this.updateMetrics();
    }, 1000); // Update every second
  }
  
  private static updateMetrics() {
    const now = Date.now();
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.socket.readyState === WebSocket.OPEN);
    
    this.metrics.totalConnections = activeConnections.length;
    this.metrics.activeRooms = this.rooms.size;
    
    // Calculate messages per second (rough estimate)
    const totalMessages = activeConnections.reduce((sum, conn) => sum + conn.messageCount, 0);
    this.metrics.messagesPerSecond = totalMessages; // Simplified calculation
    
    // Update cluster health
    if (this.isClusterEnabled) {
      const activeNodes = Array.from(this.clusterNodes.values())
        .filter(node => node.status === "active");
      this.metrics.clusterHealth = (activeNodes.length / this.clusterNodes.size) * 100;
    }
  }
  
  private static startConnectionCleaner() {
    setInterval(() => {
      this.cleanupConnections();
    }, 60000); // Clean every minute
  }
  
  private static cleanupConnections() {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    for (const [connectionId, connection] of this.connections) {
      // Clean up stale connections
      if (now - connection.lastActivity > staleThreshold || 
          connection.socket.readyState === WebSocket.CLOSED) {
        this.handleDisconnection(connectionId);
      }
    }
    
    // Clean up empty non-persistent rooms
    for (const [roomId, room] of this.rooms) {
      if (!room.persistent && room.connections.size === 0 && 
          now - room.metadata.lastActivity > staleThreshold) {
        this.rooms.delete(roomId);
      }
    }
  }
  
  // Cluster management
  
  private static registerNode(node: ClusterNode) {
    this.clusterNodes.set(node.id, node);
    
    telemetry.logger.info("Cluster node registered", {
      nodeId: node.id,
      address: node.address,
      port: node.port,
      capabilities: node.capabilities
    });
  }
  
  private static startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
      this.checkNodeHealth();
    }, 30000); // Every 30 seconds
  }
  
  private static sendHeartbeat() {
    const thisNode = this.clusterNodes.get(this.nodeId);
    if (!thisNode) return;
    
    thisNode.lastHeartbeat = Date.now();
    thisNode.connections = this.connections.size;
    thisNode.load = Math.min(100, (this.connections.size / 1000) * 100); // Simple load calculation
  }
  
  private static checkNodeHealth() {
    const now = Date.now();
    const heartbeatTimeout = 90000; // 90 seconds
    
    for (const [nodeId, node] of this.clusterNodes) {
      if (nodeId === this.nodeId) continue; // Skip self
      
      if (now - node.lastHeartbeat > heartbeatTimeout) {
        node.status = "failed";
        telemetry.logger.warn("Cluster node failed", { nodeId });
      }
    }
  }
  
  // Public API methods
  
  static getMetrics(): WebSocketMetrics {
    return { ...this.metrics };
  }
  
  static getConnections(): Array<{ id: string; userId?: string; rooms: string[]; lastActivity: number }> {
    return Array.from(this.connections.entries()).map(([id, conn]) => ({
      id,
      userId: conn.userId,
      rooms: Array.from(conn.rooms),
      lastActivity: conn.lastActivity
    }));
  }
  
  static getRooms(): Array<{ id: string; name: string; memberCount: number; persistent: boolean }> {
    return Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      memberCount: room.connections.size,
      persistent: room.persistent
    }));
  }
  
  static getClusterStatus() {
    return {
      enabled: this.isClusterEnabled,
      nodeId: this.nodeId,
      nodes: Array.from(this.clusterNodes.values()),
      health: this.metrics.clusterHealth
    };
  }
  
  static queueMessage(message: WebSocketMessage) {
    this.messageQueue.push(message);
  }
  
  static associateUser(connectionId: string, userId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.userId = userId;
      return true;
    }
    return false;
  }
  
  static getConnectionsByUser(userId: string): string[] {
    return Array.from(this.connections.entries())
      .filter(([, conn]) => conn.userId === userId)
      .map(([id]) => id);
  }
  
  static shutdown() {
    console.log("🛑 Shutting down WebSocket cluster service...");
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Close all connections
    for (const [connectionId, connection] of this.connections) {
      try {
        connection.socket.close(1001, "Server shutdown");
      } catch (error) {
        // Ignore close errors
      }
    }
    
    this.connections.clear();
    this.rooms.clear();
    this.messageQueue.length = 0;
    
    console.log("✅ WebSocket cluster service shut down");
  }
}