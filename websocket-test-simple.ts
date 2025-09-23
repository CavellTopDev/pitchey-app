// Simple WebSocket server test
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const port = 8001;

const handler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { 
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
    });
  }

  // WebSocket upgrade
  if (url.pathname === "/ws" && request.headers.get("upgrade") === "websocket") {
    const token = url.searchParams.get("token");
    
    if (!token) {
      return new Response("Missing authentication token", { status: 401 });
    }

    const { socket, response } = Deno.upgradeWebSocket(request);

    socket.onopen = () => {
      console.log('WebSocket connected');
      
      // Send welcome message
      socket.send(JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
      }));
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Received:', message);
        
        switch (message.type) {
          case 'ping':
            socket.send(JSON.stringify({ 
              type: 'pong', 
              timestamp: new Date().toISOString()
            }));
            break;
            
          case 'echo':
            socket.send(JSON.stringify({
              type: 'echo_response',
              content: message.content,
              timestamp: new Date().toISOString(),
            }));
            break;
            
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error processing message:', error);
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return response;
  }

  // Health check
  if (url.pathname === "/health") {
    return new Response(JSON.stringify({ 
      status: "healthy",
      timestamp: new Date().toISOString()
    }), {
      headers: { "content-type": "application/json" },
    });
  }

  return new Response("WebSocket Test Server", { status: 200 });
};

console.log(`🧪 Simple WebSocket test server running on http://0.0.0.0:${port}`);
console.log(`   WebSocket endpoint: ws://localhost:${port}/ws?token=test`);
console.log(`   Health check: http://localhost:${port}/health`);

await serve(handler, { port });