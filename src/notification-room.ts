/**
 * Notification Room Durable Object
 * Handles real-time notifications via WebSocket
 */

export class NotificationRoom {
  private state: any; // DurableObjectState
  private connections: Map<string, any>; // WebSocket

  constructor(state: any) {
    this.state = state;
    this.connections = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const WebSocketPair = (globalThis as any).WebSocketPair;
      const pair = WebSocketPair ? new WebSocketPair() : { 0: null, 1: null };
      const [client, server] = Object.values(pair);
      
      this.handleConnection(server, url.searchParams.get("userId") || "anonymous");
      
      return new Response(null, {
        status: 101,
        webSocket: client as any,
      } as any);
    }
    
    // Regular HTTP request
    return new Response("Notification Room Active", { status: 200 });
  }

  private handleConnection(ws: any, userId: string) {
    if (ws?.accept) {
      ws.accept();
    }
    this.connections.set(userId, ws);
    
    ws?.addEventListener?.("message", (event: any) => {
      // Broadcast to all connections
      for (const [id, connection] of this.connections) {
        if (connection?.readyState === 1) { // OPEN = 1
          connection.send(event.data);
        }
      }
    });
    
    ws?.addEventListener?.("close", () => {
      this.connections.delete(userId);
    });
  }
}

export default NotificationRoom;