#!/usr/bin/env node

/**
 * CORS Proxy for Local Development
 * Proxies requests from local frontend to production API with CORS headers
 */

const http = require('http');
const https = require('https');
const url = require('url');

const API_BASE = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
const PROXY_PORT = 8003;

const server = http.createServer((req, res) => {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse the request URL
  const requestUrl = req.url;
  const targetUrl = `${API_BASE}${requestUrl}`;
  
  console.log(`🔄 Proxying: ${req.method} ${requestUrl} -> ${targetUrl}`);

  // Parse target URL
  const parsedUrl = url.parse(targetUrl);
  
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 443,
    path: parsedUrl.path,
    method: req.method,
    headers: {
      ...req.headers,
      host: parsedUrl.hostname
    }
  };

  // Remove origin header to avoid CORS issues
  delete options.headers.origin;
  delete options.headers.referer;

  const proxy = https.request(options, (proxyRes) => {
    // Copy status code
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    
    // Pipe response data
    proxyRes.pipe(res, { end: true });
  });

  proxy.on('error', (err) => {
    console.error(`❌ Proxy error: ${err.message}`);
    res.writeHead(500);
    res.end(`Proxy error: ${err.message}`);
  });

  // Pipe request data
  req.pipe(proxy, { end: true });
});

server.listen(PROXY_PORT, () => {
  console.log('🎬 Pitchey CORS Proxy Server Started');
  console.log('====================================');
  console.log(`📡 Proxy Server: http://localhost:${PROXY_PORT}`);
  console.log(`🎯 Target API: ${API_BASE}`);
  console.log(`🌐 Frontend: http://127.0.0.1:5174`);
  console.log('');
  console.log('🔧 To use this proxy:');
  console.log('1. Update frontend/.env:');
  console.log(`   VITE_API_URL=http://localhost:${PROXY_PORT}`);
  console.log('2. Restart the frontend development server');
  console.log('3. All API calls will be proxied without CORS restrictions');
  console.log('');
  console.log('✅ Ready to test Crawl4AI integration!');
  console.log('Press Ctrl+C to stop the proxy server');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Stopping CORS proxy server...');
  server.close(() => {
    console.log('✅ Proxy server stopped');
    process.exit(0);
  });
});