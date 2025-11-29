/**
 * NotificationRoom Durable Object
 * Manages real-time WebSocket connections and notification delivery
 */

export class NotificationRoom {
  state: DurableObjectState;
  env: any;
  sessions: Map<WebSocket, SessionData> = new Map();
  userSessions: Map<number, Set<WebSocket>> = new Map();

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    // Validate WebSocket upgrade
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 400 });
    }

    // Validate token and get user
    const user = await this.validateToken(token);
    if (!user) {
      return new Response("Invalid token", { status: 401 });
    }

    // Create WebSocket pair
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Handle the session
    await this.handleSession(server, user);

    // Return the client socket
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleSession(ws: WebSocket, user: any) {
    ws.accept();

    // Store session data
    const sessionData: SessionData = {
      userId: user.id,
      username: user.username,
      userType: user.userType,
      connectedAt: Date.now(),
      lastActivity: Date.now()
    };
    
    this.sessions.set(ws, sessionData);

    // Track user sessions
    if (!this.userSessions.has(user.id)) {
      this.userSessions.set(user.id, new Set());
    }
    this.userSessions.get(user.id)!.add(ws);

    // Send connection confirmation
    ws.send(JSON.stringify({
      type: "connection",
      status: "connected",
      userId: user.id,
      message: "Connected to notification service"
    }));

    // Send any pending notifications
    await this.sendPendingNotifications(ws, user.id);

    // Update user presence
    await this.updatePresence(user.id, "online");

    // Set up message handler
    ws.addEventListener("message", async (event: MessageEvent) => {
      await this.handleMessage(ws, sessionData, event.data as string);
    });

    // Set up close handler
    ws.addEventListener("close", async () => {
      await this.handleClose(ws, sessionData);
    });

    // Set up error handler
    ws.addEventListener("error", (error) => {
      console.error("WebSocket error:", error);
    });
  }

  async handleMessage(ws: WebSocket, session: SessionData, message: string) {
    try {
      const data = JSON.parse(message);
      session.lastActivity = Date.now();

      switch (data.type) {
        case "ping":
          ws.send(JSON.stringify({
            type: "pong",
            timestamp: Date.now()
          }));
          break;

        case "notification_read":
          await this.handleNotificationRead(session.userId, data.notificationIds);
          break;

        case "get_notifications":
          await this.sendNotifications(ws, session.userId, data.options);
          break;

        case "get_unread_count":
          await this.sendUnreadCount(ws, session.userId);
          break;

        case "presence_update":
          await this.updatePresence(session.userId, data.status);
          break;

        case "subscribe":
          await this.handleSubscribe(ws, session, data.channels);
          break;

        case "unsubscribe":
          await this.handleUnsubscribe(ws, session, data.channels);
          break;

        case "broadcast":
          // For admin broadcasts
          if (session.userType === "admin") {
            await this.broadcast(data.message, data.filter);
          }
          break;

        default:
          ws.send(JSON.stringify({
            type: "error",
            message: `Unknown message type: ${data.type}`
          }));
      }
    } catch (error) {
      console.error("Message handling error:", error);
      ws.send(JSON.stringify({
        type: "error",
        message: "Failed to process message"
      }));
    }
  }

  async handleClose(ws: WebSocket, session: SessionData) {
    // Remove from sessions
    this.sessions.delete(ws);
    
    // Remove from user sessions
    const userSockets = this.userSessions.get(session.userId);
    if (userSockets) {
      userSockets.delete(ws);
      if (userSockets.size === 0) {
        this.userSessions.delete(session.userId);
        // User has no more connections, update presence
        await this.updatePresence(session.userId, "offline");
      }
    }

    console.log(`User ${session.userId} disconnected`);
  }

  async sendNotification(userId: number, notification: any) {
    const userSockets = this.userSessions.get(userId);
    if (!userSockets || userSockets.size === 0) {
      // User not connected, store for later
      await this.storePendingNotification(userId, notification);
      return;
    }

    const message = JSON.stringify({
      type: "notification",
      data: notification
    });

    // Send to all user's connections
    for (const ws of userSockets) {
      try {
        ws.send(message);
      } catch (error) {
        console.error(`Failed to send notification to user ${userId}:`, error);
      }
    }
  }

  async sendNotifications(ws: WebSocket, userId: number, options: any = {}) {
    try {
      // Fetch notifications from database
      const response = await fetch(`${this.env.API_URL}/api/notifications`, {
        headers: {
          "Authorization": `Bearer ${this.env.INTERNAL_TOKEN}`,
          "X-User-Id": userId.toString()
        }
      });

      if (response.ok) {
        const notifications = await response.json();
        ws.send(JSON.stringify({
          type: "notifications",
          data: notifications
        }));
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      ws.send(JSON.stringify({
        type: "error",
        message: "Failed to fetch notifications"
      }));
    }
  }

  async sendUnreadCount(ws: WebSocket, userId: number) {
    try {
      const response = await fetch(`${this.env.API_URL}/api/notifications/unread/count`, {
        headers: {
          "Authorization": `Bearer ${this.env.INTERNAL_TOKEN}`,
          "X-User-Id": userId.toString()
        }
      });

      if (response.ok) {
        const { count } = await response.json();
        ws.send(JSON.stringify({
          type: "unread_count",
          count
        }));
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  }

  async sendPendingNotifications(ws: WebSocket, userId: number) {
    try {
      // Get pending notifications from storage
      const pending = await this.state.storage.get(`pending:${userId}`);
      if (pending) {
        const notifications = JSON.parse(pending as string);
        for (const notification of notifications) {
          ws.send(JSON.stringify({
            type: "notification",
            data: notification
          }));
        }
        // Clear pending notifications
        await this.state.storage.delete(`pending:${userId}`);
      }
    } catch (error) {
      console.error("Error sending pending notifications:", error);
    }
  }

  async storePendingNotification(userId: number, notification: any) {
    try {
      const key = `pending:${userId}`;
      const existing = await this.state.storage.get(key);
      const notifications = existing ? JSON.parse(existing as string) : [];
      notifications.push(notification);
      
      // Keep only last 100 notifications
      if (notifications.length > 100) {
        notifications.splice(0, notifications.length - 100);
      }
      
      await this.state.storage.put(key, JSON.stringify(notifications));
    } catch (error) {
      console.error("Error storing pending notification:", error);
    }
  }

  async handleNotificationRead(userId: number, notificationIds: number[]) {
    try {
      // Update database
      await fetch(`${this.env.API_URL}/api/notifications/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.env.INTERNAL_TOKEN}`,
          "X-User-Id": userId.toString()
        },
        body: JSON.stringify({ notificationIds })
      });

      // Notify all user's connections
      const userSockets = this.userSessions.get(userId);
      if (userSockets) {
        const message = JSON.stringify({
          type: "notifications_read",
          notificationIds
        });
        
        for (const ws of userSockets) {
          ws.send(message);
        }
      }
    } catch (error) {
      console.error("Error handling notification read:", error);
    }
  }

  async updatePresence(userId: number, status: string) {
    try {
      // Store presence in Durable Object state
      await this.state.storage.put(`presence:${userId}`, {
        status,
        lastSeen: Date.now()
      });

      // Broadcast presence update to relevant users
      await this.broadcastPresence(userId, status);
    } catch (error) {
      console.error("Error updating presence:", error);
    }
  }

  async broadcastPresence(userId: number, status: string) {
    // Get followers of this user (simplified - you'd query the database)
    const message = JSON.stringify({
      type: "presence_update",
      userId,
      status,
      timestamp: Date.now()
    });

    // Broadcast to all connected users for now
    for (const [ws, session] of this.sessions) {
      if (session.userId !== userId) {
        try {
          ws.send(message);
        } catch (error) {
          console.error("Error broadcasting presence:", error);
        }
      }
    }
  }

  async handleSubscribe(ws: WebSocket, session: SessionData, channels: string[]) {
    // Store subscription preferences
    const key = `subscriptions:${session.userId}`;
    await this.state.storage.put(key, channels);
    
    ws.send(JSON.stringify({
      type: "subscribed",
      channels
    }));
  }

  async handleUnsubscribe(ws: WebSocket, session: SessionData, channels: string[]) {
    const key = `subscriptions:${session.userId}`;
    const existing = await this.state.storage.get(key);
    
    if (existing) {
      const current = existing as string[];
      const updated = current.filter(c => !channels.includes(c));
      await this.state.storage.put(key, updated);
    }
    
    ws.send(JSON.stringify({
      type: "unsubscribed",
      channels
    }));
  }

  async broadcast(message: any, filter?: any) {
    const broadcastMessage = JSON.stringify({
      type: "broadcast",
      data: message,
      timestamp: Date.now()
    });

    for (const [ws, session] of this.sessions) {
      // Apply filter if provided
      if (filter) {
        if (filter.userType && session.userType !== filter.userType) continue;
        if (filter.userIds && !filter.userIds.includes(session.userId)) continue;
      }

      try {
        ws.send(broadcastMessage);
      } catch (error) {
        console.error("Error broadcasting:", error);
      }
    }
  }

  async validateToken(token: string | null): Promise<any> {
    if (!token) return null;

    try {
      // Validate with auth service
      const response = await fetch(`${this.env.API_URL}/api/auth/validate`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error("Token validation error:", error);
    }

    return null;
  }

  // Alarm handler for periodic cleanup
  async alarm() {
    // Clean up old pending notifications
    const keys = await this.state.storage.list({ prefix: "pending:" });
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const [key, value] of keys) {
      const notifications = JSON.parse(value as string);
      const filtered = notifications.filter(
        (n: any) => new Date(n.createdAt).getTime() > oneWeekAgo
      );
      
      if (filtered.length === 0) {
        await this.state.storage.delete(key);
      } else if (filtered.length < notifications.length) {
        await this.state.storage.put(key, JSON.stringify(filtered));
      }
    }

    // Schedule next cleanup in 24 hours
    await this.state.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);
  }
}

interface SessionData {
  userId: number;
  username: string;
  userType: string;
  connectedAt: number;
  lastActivity: number;
}