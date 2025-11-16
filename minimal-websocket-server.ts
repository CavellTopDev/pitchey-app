// Minimal WebSocket server for production deployment
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const port = parseInt(Deno.env.get("PORT") || "8000");

// Simple WebSocket upgrade handler
function handleWebSocket(request: Request): Response {
  const { socket, response } = Deno.upgradeWebSocket(request);
  
  socket.onopen = () => {
    console.log("WebSocket connection opened");
    socket.send(JSON.stringify({
      type: "connected",
      message: "WebSocket connection established",
      timestamp: new Date().toISOString()
    }));
  };
  
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Received WebSocket message:", data.type);
      
      // Echo back with response
      socket.send(JSON.stringify({
        type: "response",
        original: data,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error("WebSocket message error:", error);
      socket.send(JSON.stringify({
        type: "error",
        message: "Invalid message format",
        timestamp: new Date().toISOString()
      }));
    }
  };
  
  socket.onclose = () => {
    console.log("WebSocket connection closed");
  };
  
  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
  
  return response;
}

// Main request handler
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // CORS headers for all responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Origin, X-Requested-With",
    "Access-Control-Max-Age": "86400"
  };
  
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  
  // WebSocket upgrade
  if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
    if (url.pathname === "/ws" || url.pathname === "/api/ws") {
      return handleWebSocket(request);
    }
  }
  
  // Health check
  if (url.pathname === "/api/health") {
    return new Response(JSON.stringify({
      status: "ok",
      service: "pitchey-websocket-server",
      timestamp: new Date().toISOString(),
      websocket: {
        available: true,
        endpoints: ["/ws", "/api/ws"],
        features: ["real-time messaging", "ping/pong"]
      },
      redis: {
        enabled: !!Deno.env.get("UPSTASH_REDIS_REST_URL"),
        configured: !!Deno.env.get("UPSTASH_REDIS_REST_TOKEN")
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
  
  // Basic API endpoints for testing
  if (url.pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({
      message: "Minimal API - WebSocket server running",
      endpoint: url.pathname,
      method: request.method,
      websocket_url: `wss://${request.headers.get("host")}/ws`
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
  
  // Default response
  return new Response(JSON.stringify({
    message: "Pitchey WebSocket Server",
    websocket_url: `wss://${request.headers.get("host")}/ws`,
    health_check: "/api/health"
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}

console.log(`🚀 Minimal WebSocket Server starting on port ${port}`);
console.log(`📡 WebSocket endpoint: ws://localhost:${port}/ws`);
console.log(`🏥 Health check: http://localhost:${port}/api/health`);

await serve(handler, { port });