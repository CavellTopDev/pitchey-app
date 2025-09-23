// WebSocket server for real-time updates
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { AuthService } from "./src/services/auth.service.ts";

const WS_PORT = 8001;

interface WSClient {
  id: string;
  userId: number;
  username: string;
  socket: WebSocket;
}

const clients = new Map<string, WSClient>();

// Broadcast message to all connected clients
function broadcast(message: any, excludeClient?: string) {
  const payload = JSON.stringify(message);
  clients.forEach((client, id) => {
    if (id !== excludeClient && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(payload);
    }
  });
}

// Broadcast to specific users
function sendToUser(userId: number, message: any) {
  const payload = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.userId === userId && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(payload);
    }
  });
}

// Handle WebSocket connections
async function handleWebSocket(request: Request): Promise<Response> {
  // Extract auth token from query params
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Verify token and get user
    const user = await AuthService.verifyToken(token);
    
    // Upgrade to WebSocket
    const { socket, response } = Deno.upgradeWebSocket(request);
    const clientId = crypto.randomUUID();
    
    socket.onopen = () => {
      console.log(`Client connected: ${user.username} (${clientId})`);
      
      // Store client
      clients.set(clientId, {
        id: clientId,
        userId: user.id,
        username: user.username,
        socket,
      });
      
      // Send welcome message
      socket.send(JSON.stringify({
        type: "connected",
        clientId,
        username: user.username,
        totalClients: clients.size,
      }));
      
      // Notify others
      broadcast({
        type: "user_joined",
        username: user.username,
        totalClients: clients.size,
      }, clientId);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case "ping":
            socket.send(JSON.stringify({ type: "pong" }));
            break;
            
          case "pitch_view":
            // Broadcast pitch view to all
            broadcast({
              type: "pitch_viewed",
              pitchId: message.pitchId,
              username: user.username,
              timestamp: new Date().toISOString(),
            }, clientId);
            break;
            
          case "pitch_like":
            // Broadcast pitch like
            broadcast({
              type: "pitch_liked",
              pitchId: message.pitchId,
              username: user.username,
              timestamp: new Date().toISOString(),
            }, clientId);
            break;
            
          case "pitch_comment":
            // Broadcast new comment
            broadcast({
              type: "new_comment",
              pitchId: message.pitchId,
              comment: message.comment,
              username: user.username,
              timestamp: new Date().toISOString(),
            }, clientId);
            break;
            
          case "nda_signed":
            // Notify pitch owner
            sendToUser(message.ownerId, {
              type: "nda_signed",
              pitchId: message.pitchId,
              signedBy: user.username,
              timestamp: new Date().toISOString(),
            });
            break;
            
          case "typing":
            // Broadcast typing indicator
            broadcast({
              type: "user_typing",
              pitchId: message.pitchId,
              username: user.username,
              isTyping: message.isTyping,
            }, clientId);
            break;
            
          default:
            console.log("Unknown message type:", message.type);
        }
      } catch (error) {
        console.error("Error processing message:", error);
      }
    };

    socket.onclose = () => {
      console.log(`Client disconnected: ${user.username} (${clientId})`);
      
      // Remove client
      clients.delete(clientId);
      
      // Notify others
      broadcast({
        type: "user_left",
        username: user.username,
        totalClients: clients.size,
      });
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return response;
  } catch (error) {
    console.error("Auth failed:", error);
    return new Response("Unauthorized", { status: 401 });
  }
}

// HTTP handler for health check and WebSocket upgrade
const handler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  
  // Health check endpoint
  if (url.pathname === "/health") {
    return new Response(JSON.stringify({
      status: "healthy",
      clients: clients.size,
      timestamp: new Date().toISOString(),
    }), {
      headers: { "content-type": "application/json" },
    });
  }
  
  // WebSocket upgrade
  if (url.pathname === "/ws") {
    return await handleWebSocket(request);
  }
  
  // Stats endpoint
  if (url.pathname === "/stats") {
    const stats = {
      totalClients: clients.size,
      users: Array.from(clients.values()).map(c => ({
        username: c.username,
        userId: c.userId,
      })),
      timestamp: new Date().toISOString(),
    };
    
    return new Response(JSON.stringify(stats), {
      headers: { 
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
    });
  }
  
  return new Response("WebSocket server", { status: 200 });
};

console.log(`🔌 WebSocket server running on ws://localhost:${WS_PORT}`);
console.log(`   Health check: http://localhost:${WS_PORT}/health`);
console.log(`   WebSocket endpoint: ws://localhost:${WS_PORT}/ws?token=<jwt_token>`);

await serve(handler, { port: WS_PORT });