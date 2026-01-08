#!/usr/bin/env -S deno run --allow-all

/**
 * Local Development Server with WebSocket Support
 * Proxies to Cloudflare Worker for API endpoints and WebSocket connections
 */

import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";

const PORT = parseInt(Deno.env.get("PORT") || "8001");
const WORKER_URL = Deno.env.get("WORKER_URL") || "https://pitchey-api-prod.ndlovucavelle.workers.dev";
const WORKER_WS_URL = WORKER_URL.replace('https://', 'wss://');

const app = new Application();
const router = new Router();

// Enable CORS
app.use(oakCors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
}));

// Handle WebSocket upgrade requests
router.get("/ws", (ctx) => {
  if (ctx.request.headers.get("upgrade") === "websocket") {
    console.log(`[${new Date().toISOString()}] WebSocket upgrade request`);
    
    // Get query parameters
    const url = new URL(ctx.request.url);
    const token = url.searchParams.get('token');
    const userId = url.searchParams.get('userId');
    const userType = url.searchParams.get('userType');
    
    if (!ctx.isUpgradable) {
      console.error("WebSocket upgrade not available");
      ctx.response.status = 426;
      ctx.response.body = "Upgrade Required";
      return;
    }
    
    try {
      // Upgrade to WebSocket
      const ws = ctx.upgrade();
      
      // Connect to Worker WebSocket
      const workerWsUrl = `${WORKER_WS_URL}/ws?token=${token}&userId=${userId}&userType=${userType}`;
      console.log(`Connecting to Worker WebSocket: ${workerWsUrl}`);
      
      const workerWs = new WebSocket(workerWsUrl);
      
      // Proxy messages from client to worker
      ws.onmessage = (event) => {
        console.log(`Client -> Worker: ${event.data}`);
        if (workerWs.readyState === WebSocket.OPEN) {
          workerWs.send(event.data);
        }
      };
      
      // Proxy messages from worker to client
      workerWs.onmessage = (event) => {
        console.log(`Worker -> Client: ${event.data}`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(event.data);
        }
      };
      
      // Handle worker WebSocket open
      workerWs.onopen = () => {
        console.log("Worker WebSocket connected");
      };
      
      // Handle worker WebSocket close
      workerWs.onclose = (event) => {
        console.log(`Worker WebSocket closed: ${event.code} ${event.reason}`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(event.code, event.reason);
        }
      };
      
      // Handle worker WebSocket error
      workerWs.onerror = (error) => {
        console.error("Worker WebSocket error:", error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1011, "Worker connection error");
        }
      };
      
      // Handle client close
      ws.onclose = (event) => {
        console.log(`Client WebSocket closed: ${event.code} ${event.reason}`);
        if (workerWs.readyState === WebSocket.OPEN) {
          workerWs.close(event.code, event.reason);
        }
      };
      
      // Handle client error
      ws.onerror = (error) => {
        console.error("Client WebSocket error:", error);
        if (workerWs.readyState === WebSocket.OPEN) {
          workerWs.close(1011, "Client connection error");
        }
      };
      
    } catch (error) {
      console.error("WebSocket upgrade failed:", error);
      ctx.response.status = 500;
      ctx.response.body = "WebSocket upgrade failed";
    }
  } else {
    ctx.response.status = 426;
    ctx.response.body = "Upgrade Required";
  }
});

// Proxy all /api/* requests to the worker
router.all("/api/(.*)", async (ctx) => {
  const path = ctx.request.url.pathname;
  const method = ctx.request.method;
  
  console.log(`[${new Date().toISOString()}] ${method} ${path}`);
  
  try {
    // Build the worker URL
    const workerUrl = new URL(path, WORKER_URL);
    workerUrl.search = ctx.request.url.search;
    
    // Prepare headers
    const headers = new Headers();
    ctx.request.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'connection') {
        headers.set(key, value);
      }
    });
    
    // Get request body if present
    let body = null;
    if (["POST", "PUT", "PATCH"].includes(method)) {
      try {
        body = await ctx.request.body({ type: "text" }).value;
      } catch {
        // No body or unable to read
      }
    }
    
    // Make request to worker
    const response = await fetch(workerUrl.toString(), {
      method,
      headers,
      body,
    });
    
    // Copy response headers
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'connection' && key.toLowerCase() !== 'transfer-encoding') {
        ctx.response.headers.set(key, value);
      }
    });
    
    // Set status and body
    ctx.response.status = response.status;
    ctx.response.body = await response.text();
    
  } catch (error) {
    console.error(`Proxy error: ${error.message}`);
    ctx.response.status = 500;
    ctx.response.body = JSON.stringify({ 
      error: "Proxy error", 
      details: error.message 
    });
  }
});

// Health check
router.get("/health", (ctx) => {
  ctx.response.body = { 
    status: "ok", 
    server: "working-server-ws",
    websocket: "enabled",
    timestamp: new Date().toISOString() 
  };
});

// Root route
router.get("/", (ctx) => {
  ctx.response.body = {
    message: "Pitchey Local Development Server with WebSocket",
    endpoints: {
      api: `http://localhost:${PORT}/api/*`,
      websocket: `ws://localhost:${PORT}/ws`,
      health: `http://localhost:${PORT}/health`
    },
    proxying_to: WORKER_URL
  };
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log(`🚀 Server with WebSocket running on http://localhost:${PORT}`);
console.log(`   Proxying API to: ${WORKER_URL}`);
console.log(`   WebSocket proxy: ws://localhost:${PORT}/ws -> ${WORKER_WS_URL}/ws`);
console.log(`   Frontend should connect to: ws://localhost:${PORT}/ws`);

await app.listen({ port: PORT });