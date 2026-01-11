#!/usr/bin/env -S deno run --allow-all

/**
 * Local Development Server with Enhanced Session Handling
 * Proxies to Cloudflare Worker for API endpoints and handles session cookies
 */

import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { getCookies, setCookie } from "https://deno.land/std@0.208.0/http/cookie.ts";

const PORT = parseInt(Deno.env.get("PORT") || "8001");
const WORKER_URL = Deno.env.get("WORKER_URL") || "https://pitchey-api-prod.ndlovucavelle.workers.dev";

// Local session store for development
const sessionStore = new Map<string, any>();

const app = new Application();
const router = new Router();

// Enable CORS with enhanced settings for cookies
app.use(oakCors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  exposedHeaders: ["Set-Cookie"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
}));

// Enhanced proxy for all /api/* requests
router.all("/api/(.*)", async (ctx) => {
  const path = ctx.request.url.pathname;
  const method = ctx.request.method;
  
  console.log(`[${new Date().toISOString()}] ${method} ${path}`);
  
  try {
    // Build the worker URL
    const workerUrl = new URL(path, WORKER_URL);
    workerUrl.search = ctx.request.url.search;
    
    // Prepare headers with cookie forwarding
    const headers = new Headers();
    ctx.request.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== 'host' && lowerKey !== 'connection' && lowerKey !== 'accept-encoding') {
        headers.set(key, value);
      }
    });
    
    // Request uncompressed responses to avoid decompression issues
    headers.set('Accept-Encoding', 'identity');
    
    // Ensure cookies are forwarded
    const cookieHeader = ctx.request.headers.get('cookie');
    if (cookieHeader) {
      headers.set('Cookie', cookieHeader);
    }
    
    // Get request body if present
    let body = null;
    if (["POST", "PUT", "PATCH"].includes(method)) {
      try {
        body = await ctx.request.body({ type: "text" }).value;
      } catch {
        // No body or error reading body
      }
    }
    
    // Make request to worker with credentials
    const response = await fetch(workerUrl.toString(), {
      method,
      headers,
      body: body || undefined,
      credentials: 'include', // Important for cookies
    });
    
    // Handle Set-Cookie headers properly
    const setCookieHeaders = response.headers.getSetCookie ? 
      response.headers.getSetCookie() : 
      response.headers.get('set-cookie') ? 
        [response.headers.get('set-cookie')] : [];
    
    // Copy response headers (except set-cookie and CORS headers which we'll handle separately)
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== 'connection' && 
          lowerKey !== 'content-encoding' && 
          lowerKey !== 'set-cookie' &&
          !lowerKey.startsWith('access-control-')) { // Don't copy CORS headers from worker
        ctx.response.headers.set(key, value);
      }
    });
    
    // Set cookies properly
    for (const cookie of setCookieHeaders) {
      if (cookie) {
        ctx.response.headers.append('Set-Cookie', cookie);
      }
    }
    
    // Set response
    ctx.response.status = response.status;
    
    // Handle response body - decompress if needed
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      // For JSON responses, parse and re-stringify to ensure proper format
      try {
        const jsonData = await response.json();
        ctx.response.body = JSON.stringify(jsonData);
        ctx.response.headers.set('content-type', 'application/json');
      } catch (err) {
        // If JSON parsing fails, return error
        console.error('Failed to parse JSON response:', err);
        ctx.response.body = JSON.stringify({ success: false, error: 'Invalid JSON response from server' });
      }
    } else {
      ctx.response.body = await response.text();
    }
    
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