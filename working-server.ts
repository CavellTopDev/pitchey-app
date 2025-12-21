#!/usr/bin/env -S deno run --allow-all

/**
 * Local Development Server
 * Proxies to Cloudflare Worker for API endpoints
 */

import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";

const PORT = parseInt(Deno.env.get("PORT") || "8001");
const WORKER_URL = Deno.env.get("WORKER_URL") || "https://pitchey-api.ndlovucavelle.workers.dev";

const app = new Application();
const router = new Router();

// Enable CORS
app.use(oakCors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
}));

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
        // No body or error reading body
      }
    }
    
    // Make request to worker
    const response = await fetch(workerUrl.toString(), {
      method,
      headers,
      body: body || undefined,
    });
    
    // Copy response headers
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'connection' && key.toLowerCase() !== 'content-encoding') {
        ctx.response.headers.set(key, value);
      }
    });
    
    // Set response
    ctx.response.status = response.status;
    ctx.response.body = await response.text();
    
  } catch (error) {
    console.error(`Error proxying request:`, error);
    ctx.response.status = 500;
    ctx.response.body = JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

// Health check
router.get("/health", (ctx) => {
  ctx.response.body = JSON.stringify({
    status: "ok",
    timestamp: new Date().toISOString(),
    workerUrl: WORKER_URL
  });
});

// WebSocket proxy for notifications
router.get("/ws", async (ctx) => {
  if (!ctx.isUpgradable) {
    ctx.throw(501);
  }
  
  const ws = await ctx.upgrade();
  console.log("WebSocket connection established");
  
  ws.onmessage = (event) => {
    console.log("WebSocket message:", event.data);
    // Echo messages for now
    ws.send(JSON.stringify({
      type: "echo",
      data: event.data
    }));
  };
  
  ws.onclose = () => {
    console.log("WebSocket connection closed");
  };
});

app.use(router.routes());
app.use(router.allowedMethods());

// Start server
console.log(`🚀 Local development server running on http://localhost:${PORT}`);
console.log(`🔗 Proxying API requests to ${WORKER_URL}`);
console.log(`📝 Frontend should use: http://localhost:${PORT}`);

await app.listen({ port: PORT });