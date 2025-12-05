/**
 * Durable Object for handling WebSocket connections
 * Manages real-time communication for notifications, chat, and live updates
 */

export class WebSocketRoom {
  private state: DurableObjectState;
  private env: any;
  private sessions: Map<WebSocket, any>;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      await this.handleSession(server, request);
      
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // Handle HTTP requests for room info
    if (url.pathname === "/info") {
      return new Response(JSON.stringify({
        connections: this.sessions.size,
        roomId: this.state.id.toString(),
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  }

  async handleSession(webSocket: WebSocket, request: Request) {
    // Accept the WebSocket connection
    webSocket.accept();

    // Parse user info from query params or headers
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const userId = url.searchParams.get("userId");
    const userType = url.searchParams.get("userType");

    const session = {
      webSocket,
      userId,
      userType,
      token,
      joinedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };

    // Store session
    this.sessions.set(webSocket, session);

    // Send welcome message
    webSocket.send(JSON.stringify({
      type: "connection",
      status: "connected",
      message: "Connected to Pitchey real-time service",
      userId,
      sessionCount: this.sessions.size,
      timestamp: new Date().toISOString(),
    }));

    // Notify others about new user
    this.broadcast(JSON.stringify({
      type: "user-joined",
      userId,
      userType,
      sessionCount: this.sessions.size,
      timestamp: new Date().toISOString(),
    }), webSocket);

    // Handle incoming messages
    webSocket.addEventListener("message", async (event) => {
      try {
        const message = JSON.parse(event.data as string);
        await this.handleMessage(session, message);
      } catch (error) {
        console.error("Error handling message:", error);
        webSocket.send(JSON.stringify({
          type: "error",
          message: "Invalid message format",
        }));
      }
    });

    // Handle close
    webSocket.addEventListener("close", () => {
      this.sessions.delete(webSocket);
      
      // Notify others about user leaving
      this.broadcast(JSON.stringify({
        type: "user-left",
        userId,
        sessionCount: this.sessions.size,
        timestamp: new Date().toISOString(),
      }));
    });

    // Handle errors
    webSocket.addEventListener("error", (error) => {
      console.error("WebSocket error:", error);
      this.sessions.delete(webSocket);
    });
  }

  async handleMessage(session: any, message: any) {
    const { webSocket, userId, userType } = session;

    // Update last activity
    session.lastActivity = new Date().toISOString();

    switch (message.type) {
      case "ping":
        webSocket.send(JSON.stringify({
          type: "pong",
          timestamp: new Date().toISOString(),
        }));
        break;

      case "notification":
        // Send notification to specific user(s)
        if (message.targetUserId) {
          this.sendToUser(message.targetUserId, JSON.stringify({
            type: "notification",
            from: userId,
            data: message.data,
            timestamp: new Date().toISOString(),
          }));
        }
        break;

      case "broadcast":
        // Broadcast to all users except sender
        this.broadcast(JSON.stringify({
          type: "broadcast",
          from: userId,
          data: message.data,
          timestamp: new Date().toISOString(),
        }), webSocket);
        break;

      case "chat":
        // Handle chat messages
        const chatMessage = {
          type: "chat",
          from: userId,
          message: message.message,
          conversationId: message.conversationId,
          timestamp: new Date().toISOString(),
        };
        
        // Send to conversation participants
        if (message.participants) {
          for (const participantId of message.participants) {
            this.sendToUser(participantId, JSON.stringify(chatMessage));
          }
        }
        break;

      case "presence":
        // Update presence status
        session.presence = message.status; // online, away, busy, offline
        
        // Notify others about presence change
        this.broadcast(JSON.stringify({
          type: "presence-update",
          userId,
          status: message.status,
          timestamp: new Date().toISOString(),
        }), webSocket);
        break;

      case "typing":
        // Handle typing indicators
        if (message.conversationId && message.participants) {
          for (const participantId of message.participants) {
            if (participantId !== userId) {
              this.sendToUser(participantId, JSON.stringify({
                type: "typing",
                from: userId,
                conversationId: message.conversationId,
                isTyping: message.isTyping,
                timestamp: new Date().toISOString(),
              }));
            }
          }
        }
        break;

      case "pitch-update":
        // Real-time pitch updates
        this.broadcast(JSON.stringify({
          type: "pitch-update",
          pitchId: message.pitchId,
          action: message.action, // viewed, liked, commented, etc.
          userId,
          timestamp: new Date().toISOString(),
        }), webSocket);
        break;

      case "dashboard-update":
        // Dashboard metric updates
        if (message.targetUserId) {
          this.sendToUser(message.targetUserId, JSON.stringify({
            type: "dashboard-update",
            metrics: message.metrics,
            timestamp: new Date().toISOString(),
          }));
        }
        break;

      default:
        // Echo unknown messages back
        webSocket.send(JSON.stringify({
          type: "echo",
          originalType: message.type,
          data: message,
          timestamp: new Date().toISOString(),
        }));
    }
  }

  // Send message to specific user
  sendToUser(targetUserId: string, message: string) {
    for (const [ws, session] of this.sessions) {
      if (session.userId === targetUserId) {
        try {
          ws.send(message);
        } catch (error) {
          console.error(`Error sending to user ${targetUserId}:`, error);
        }
      }
    }
  }

  // Broadcast to all except specific connection
  broadcast(message: string, except?: WebSocket) {
    for (const [ws, session] of this.sessions) {
      if (ws !== except) {
        try {
          ws.send(message);
        } catch (error) {
          console.error("Error broadcasting:", error);
        }
      }
    }
  }
}