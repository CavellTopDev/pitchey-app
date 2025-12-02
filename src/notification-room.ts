/**
 * Notification Room Durable Object
 * Handles real-time notifications via WebSocket
 */

export class NotificationRoom {
  private state: DurableObjectState;
  private connections: Map<string, WebSocket>;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.connections = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      this.handleConnection(server, url.searchParams.get("userId") || "anonymous");
      
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }
    
    // Regular HTTP request
    return new Response("Notification Room Active", { status: 200 });
  }

  private handleConnection(ws: WebSocket, userId: string) {
    ws.accept();
    this.connections.set(userId, ws);
    
    ws.addEventListener("message", (event) => {
      // Broadcast to all connections
      for (const [id, connection] of this.connections) {
        if (connection.readyState === WebSocket.READY_STATE_OPEN) {
          connection.send(event.data);
        }
      }
    });
    
    ws.addEventListener("close", () => {
      this.connections.delete(userId);
    });
  }
}

export default NotificationRoom;