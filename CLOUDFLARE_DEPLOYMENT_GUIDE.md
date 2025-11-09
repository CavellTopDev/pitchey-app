# Cloudflare Deployment Guide for Pitchey Platform

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Service URLs and Endpoints](#service-urls-and-endpoints)
3. [Environment Variables Configuration](#environment-variables-configuration)
4. [Deployment Steps](#deployment-steps)
5. [Testing Procedures](#testing-procedures)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Performance Optimization](#performance-optimization)
8. [Security Considerations](#security-considerations)
9. [Monitoring and Maintenance](#monitoring-and-maintenance)

## Architecture Overview

### Production Infrastructure Stack

```
┌────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                            │
├────────────────────────────────────────────────────────────┤
│  Browser → CDN → Cloudflare Pages (React Frontend)         │
│  https://pitchey.pages.dev                                 │
└────────────────────┬───────────────────────────────────────┘
                      │ HTTPS/WSS
                      ↓
┌────────────────────────────────────────────────────────────┐
│                  EDGE LAYER (Cloudflare)                    │
├────────────────────────────────────────────────────────────┤
│  Cloudflare Workers (API Proxy & Enhancement)              │
│  https://pitchey-api-production.cavelltheleaddev.workers.dev│
│  ├─ KV Namespace (Edge Cache)                              │
│  ├─ R2 Storage (File Uploads)                              │
│  ├─ Durable Objects (WebSocket Rooms)                      │
│  └─ Hyperdrive (Database Connection Pooling)               │
└────────────────────┬───────────────────────────────────────┘
                      │ HTTPS (Proxied)
                      ↓
┌────────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                          │
├────────────────────────────────────────────────────────────┤
│  Deno Deploy (Full Backend API)                            │
│  https://pitchey-backend-fresh.deno.dev                    │
│  ├─ REST API Endpoints                                     │
│  ├─ WebSocket Server                                       │
│  ├─ Authentication (JWT)                                   │
│  └─ Business Logic                                         │
└────────────────────┬───────────────────────────────────────┘
                      │ PostgreSQL/Redis
                      ↓
┌────────────────────────────────────────────────────────────┐
│                   DATA LAYER                                │
├────────────────────────────────────────────────────────────┤
│  ├─ Neon PostgreSQL (Primary Database)                     │
│  │  └─ Hyperdrive Pool (via Worker)                       │
│  └─ Upstash Redis (Distributed Cache)                      │
└────────────────────────────────────────────────────────────┘
```

### Service Architecture Components

#### 1. **Frontend (Cloudflare Pages)**
- **Technology**: React + TypeScript + Vite
- **Deployment**: Automatic via Git integration
- **CDN**: Global Cloudflare CDN with 200+ PoPs
- **Features**:
  - Automatic SSL/TLS
  - HTTP/3 support
  - Brotli compression
  - Custom headers and redirects
  - Preview deployments for branches

#### 2. **API Proxy Layer (Cloudflare Workers)**
- **Purpose**: Edge computing and performance optimization
- **Features**:
  - Request routing and load balancing
  - Edge caching with KV storage
  - File uploads to R2 storage
  - WebSocket room management via Durable Objects
  - Database connection pooling via Hyperdrive
  - Progressive API migration

#### 3. **Backend API (Deno Deploy)**
- **Technology**: Deno with Oak framework
- **Features**:
  - Full REST API implementation
  - WebSocket server for real-time features
  - JWT authentication
  - Business logic processing
  - Database operations via Drizzle ORM

#### 4. **Data Storage**
- **Primary Database**: Neon PostgreSQL (Serverless)
  - Connection pooling via Hyperdrive
  - Automatic scaling and branching
  - Point-in-time recovery
  
- **Cache Layer**: Upstash Redis
  - Serverless Redis with global replication
  - REST API for edge compatibility
  - Automatic eviction policies
  
- **File Storage**: Cloudflare R2
  - S3-compatible API
  - Zero egress fees
  - Global replication

## Service URLs and Endpoints

### Production URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | https://pitchey.pages.dev | Main application UI |
| **Worker API** | https://pitchey-api-production.cavelltheleaddev.workers.dev | Edge API proxy |
| **Backend API** | https://pitchey-backend-fresh.deno.dev | Full API implementation |
| **WebSocket** | wss://pitchey-backend-fresh.deno.dev/ws | Real-time communications |

### API Endpoints Structure

```
https://pitchey-api-production.cavelltheleaddev.workers.dev/api/
├── /auth/
│   ├── /creator/login      # Creator portal authentication
│   ├── /investor/login     # Investor portal authentication
│   ├── /production/login   # Production company authentication
│   ├── /refresh            # Token refresh
│   └── /logout             # Session termination
├── /pitches/
│   ├── GET /               # List pitches
│   ├── GET /:id            # Get specific pitch
│   ├── POST /              # Create pitch
│   ├── PUT /:id            # Update pitch
│   └── DELETE /:id         # Delete pitch
├── /dashboard/
│   ├── /creator/metrics    # Creator dashboard data
│   ├── /investor/metrics   # Investor dashboard data
│   └── /production/metrics # Production dashboard data
├── /info-requests/         # NDA workflow endpoints
├── /messages/              # Messaging system
├── /notifications/         # User notifications
├── /analytics/             # Platform analytics
└── /health                 # Health check endpoint
```

## Environment Variables Configuration

### Frontend Environment Variables (Cloudflare Pages)

Create via Cloudflare Dashboard → Pages → Settings → Environment Variables:

```bash
# Production Environment
VITE_API_URL=https://pitchey-api-production.cavelltheleaddev.workers.dev
VITE_WS_URL=wss://pitchey-backend-fresh.deno.dev
VITE_ENV=production
VITE_ENABLE_WEBSOCKET=true
VITE_ENABLE_ANALYTICS=true
```

### Worker Environment Variables (Cloudflare Workers)

Set via `wrangler secret put` or Cloudflare Dashboard:

```bash
# API Configuration
FRONTEND_URL=https://pitchey.pages.dev
ORIGIN_URL=https://pitchey-backend-fresh.deno.dev

# Security (use wrangler secret)
wrangler secret put JWT_SECRET
# Enter: [32+ character secure string]

# Database (via Hyperdrive)
# Configured automatically via wrangler.toml
```

### Backend Environment Variables (Deno Deploy)

Set via Deno Deploy Dashboard → Settings → Environment Variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/pitchey?sslmode=require

# Security
JWT_SECRET=[same as Worker secret]
JWT_REFRESH_SECRET=[different 32+ char string]

# Redis Cache
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AcXXXX...

# Service Configuration
FRONTEND_URL=https://pitchey.pages.dev
PORT=8000
HOST=0.0.0.0

# Features
CACHE_ENABLED=true
CACHE_TTL=300
EMAIL_PROVIDER=console
STORAGE_PROVIDER=r2
PAYMENT_PROVIDER=mock
```

## Deployment Steps

### Prerequisites

1. **Install Required Tools**:
```bash
# Install Wrangler CLI
npm install -g wrangler

# Install Deno
curl -fsSL https://deno.land/x/install/install.sh | sh

# Install Deno Deploy CLI
deno install --allow-all --no-check -r -f https://deno.land/x/deploy/deployctl.ts
```

2. **Setup Accounts**:
- Cloudflare account with Pages and Workers enabled
- Deno Deploy account
- Neon PostgreSQL account
- Upstash Redis account (optional but recommended)

### Step 1: Database Setup (Neon PostgreSQL)

1. **Create Neon Project**:
```bash
# Visit https://console.neon.tech
# Create new project "pitchey-production"
# Copy connection string
```

2. **Setup Hyperdrive for Connection Pooling**:
```bash
# Create Hyperdrive configuration
wrangler hyperdrive create pitchey-db \
  --connection-string "postgresql://user:pass@ep-xxx.neon.tech/pitchey?sslmode=require"

# Note the returned Hyperdrive ID
# Update wrangler.toml with the ID
```

3. **Run Database Migrations**:
```bash
# Clone repository
git clone [repository-url]
cd pitchey_v0.2

# Set database URL
export DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/pitchey?sslmode=require"

# Run migrations
deno run --allow-all run-migrations.ts

# Seed demo data (optional)
deno run --allow-all create-demo-accounts.ts
```

### Step 2: Deploy Backend to Deno Deploy

1. **Connect GitHub Repository**:
```bash
# Visit https://dash.deno.com
# Click "New Project"
# Select "Deploy from GitHub"
# Choose repository and branch
```

2. **Configure Deployment**:
```yaml
Entry Point: working-server.ts
Environment Variables: [Set all from section above]
```

3. **Manual Deployment** (Alternative):
```bash
cd pitchey_v0.2
deployctl deploy \
  --project=pitchey-backend-fresh \
  --entrypoint=working-server.ts \
  --env-file=.env.production
```

### Step 3: Setup Cloudflare Workers

1. **Configure R2 Storage**:
```bash
# Create R2 bucket
wrangler r2 bucket create pitchey-uploads

# Verify creation
wrangler r2 bucket list
```

2. **Configure KV Namespace**:
```bash
# Create KV namespace for caching
wrangler kv:namespace create "CACHE"

# Note the ID and update wrangler.toml
```

3. **Deploy Worker**:
```bash
cd pitchey_v0.2

# Set secrets
wrangler secret put JWT_SECRET
# Enter your secure JWT secret

# Deploy to production
wrangler deploy --env production

# Or deploy with specific configuration
wrangler deploy \
  --name pitchey-api-production \
  --env production \
  --compatibility-date 2024-11-01
```

### Step 4: Deploy Frontend to Cloudflare Pages

1. **Connect Repository**:
```bash
# Visit Cloudflare Dashboard → Pages
# Click "Create a project"
# Connect to Git
# Select repository
```

2. **Configure Build Settings**:
```yaml
Framework preset: React
Build command: npm run build
Build output directory: dist
Root directory: frontend
Node version: 20.19.5
```

3. **Set Environment Variables**:
```bash
VITE_API_URL=https://pitchey-api-production.cavelltheleaddev.workers.dev
VITE_WS_URL=wss://pitchey-backend-fresh.deno.dev
VITE_ENV=production
```

4. **Manual Deployment** (Alternative):
```bash
cd frontend
npm install
npm run build

# Deploy with Wrangler
wrangler pages deploy dist \
  --project-name=pitchey \
  --branch=main
```

### Step 5: Configure Upstash Redis (Optional but Recommended)

1. **Create Redis Database**:
```bash
# Visit https://console.upstash.com
# Create new Redis database
# Select global replication for best performance
```

2. **Copy Credentials**:
```bash
# Copy REST URL and Token
# Add to Deno Deploy environment variables
```

### Step 6: DNS Configuration

1. **Custom Domain** (Optional):
```bash
# In Cloudflare Dashboard → Pages → Custom domains
# Add your domain
# Update DNS records as instructed
```

2. **SSL Configuration**:
- Automatic with Cloudflare Pages
- Full (strict) SSL mode recommended

## Testing Procedures

### 1. Basic Connectivity Test

```bash
# Test frontend
curl -I https://pitchey.pages.dev
# Should return 200 OK

# Test Worker API
curl https://pitchey-api-production.cavelltheleaddev.workers.dev/api/health
# Should return: {"status":"healthy","timestamp":"..."}

# Test Backend API
curl https://pitchey-backend-fresh.deno.dev/api/health
# Should return: {"status":"healthy","services":{...}}
```

### 2. Authentication Test

```bash
# Test Creator Login
curl -X POST https://pitchey-api-production.cavelltheleaddev.workers.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'

# Should return JWT token
```

### 3. WebSocket Test

```javascript
// Test WebSocket connection
const ws = new WebSocket('wss://pitchey-backend-fresh.deno.dev/ws');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', e.data);
ws.send(JSON.stringify({ type: 'ping' }));
```

### 4. Full Integration Test

```bash
# Run comprehensive test suite
cd pitchey_v0.2
./comprehensive-platform-test.sh

# Check individual portals
./test-creator-portal.sh
./test-investor-portal.sh
./test-production-portal.sh
```

### 5. Performance Test

```bash
# Test response times
ab -n 100 -c 10 https://pitchey.pages.dev/

# Test API performance
ab -n 100 -c 10 https://pitchey-api-production.cavelltheleaddev.workers.dev/api/health
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Frontend Not Loading

**Symptoms**: Blank page or 404 errors

**Solutions**:
```bash
# Check deployment status
wrangler pages deployment list --project-name=pitchey

# Verify build output
cd frontend
npm run build
ls -la dist/  # Should contain index.html

# Check environment variables
# Cloudflare Dashboard → Pages → Settings → Environment variables
```

#### 2. API Connection Errors

**Symptoms**: "Failed to fetch" or CORS errors

**Solutions**:
```bash
# Verify Worker deployment
wrangler tail --env production

# Check CORS configuration
curl -I -X OPTIONS https://pitchey-api-production.cavelltheleaddev.workers.dev/api/health \
  -H "Origin: https://pitchey.pages.dev" \
  -H "Access-Control-Request-Method: GET"

# Update Worker CORS settings if needed
```

#### 3. WebSocket Connection Failed

**Symptoms**: "WebSocket connection failed" in console

**Solutions**:
```javascript
// Check WebSocket URL in frontend
console.log(import.meta.env.VITE_WS_URL);
// Should be: wss://pitchey-backend-fresh.deno.dev

// Test direct connection
const ws = new WebSocket('wss://pitchey-backend-fresh.deno.dev/ws');
ws.onerror = (e) => console.error('WebSocket error:', e);
```

#### 4. Database Connection Issues

**Symptoms**: 500 errors on API calls

**Solutions**:
```bash
# Test database connection
deno run --allow-all check-database-connection.ts

# Verify Hyperdrive configuration
wrangler hyperdrive list

# Check connection string format
# Must include ?sslmode=require for Neon
```

#### 5. Cache Not Working

**Symptoms**: Slow performance, no cache headers

**Solutions**:
```bash
# Check KV namespace
wrangler kv:key list --namespace-id=98c88a185eb448e4868fcc87e458b3ac

# Verify Redis connection
curl https://pitchey-backend-fresh.deno.dev/api/cache/status

# Check cache headers
curl -I https://pitchey-api-production.cavelltheleaddev.workers.dev/api/pitches
```

#### 6. Authentication Failures

**Symptoms**: 401 Unauthorized errors

**Solutions**:
```bash
# Verify JWT secret matches across services
# Worker and Deno Deploy must have same JWT_SECRET

# Check token expiration
# Decode JWT at https://jwt.io to verify exp claim

# Test token refresh
curl -X POST https://pitchey-api-production.cavelltheleaddev.workers.dev/api/auth/refresh \
  -H "Authorization: Bearer [your-token]"
```

### Error Monitoring

```bash
# Real-time Worker logs
wrangler tail --env production

# Deno Deploy logs
# Visit https://dash.deno.com → Project → Logs

# Pages build logs
# Cloudflare Dashboard → Pages → View build

# Check error rates
# Cloudflare Dashboard → Analytics → Workers
```

## Performance Optimization

### 1. Cloudflare Optimization

```javascript
// wrangler.toml optimizations
[build]
command = "npm run build"
[build.upload]
format = "modules"
main = "./src/worker-simple.ts"

[miniflare]
kv_persist = true  // Persist KV data locally

// Cache strategies in Worker
const cache = caches.default;
const cacheKey = new Request(url, request);
const cachedResponse = await cache.match(cacheKey);

if (cachedResponse) {
  return cachedResponse;
}
```

### 2. Hyperdrive Configuration

```toml
# Optimal Hyperdrive settings
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "983d4a1818264b5dbdca26bacf167dee"
# Connection pooling handled automatically
# Max connections: 100
# Idle timeout: 30s
```

### 3. R2 Storage Optimization

```javascript
// Multipart upload for large files
const multipartUpload = await env.R2_BUCKET.createMultipartUpload(key);
// Upload parts in parallel
const parts = await Promise.all(chunks.map(uploadPart));
// Complete upload
await multipartUpload.complete(parts);
```

### 4. KV Cache Patterns

```javascript
// Cache with TTL
await env.CACHE.put(key, value, {
  expirationTtl: 300, // 5 minutes
  metadata: { timestamp: Date.now() }
});

// Batch operations
const keys = ['key1', 'key2', 'key3'];
const values = await env.CACHE.get(keys);
```

### 5. Frontend Optimization

```javascript
// vite.config.ts optimizations
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'ui': ['@headlessui/react', '@heroicons/react']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

## Security Considerations

### 1. Authentication Security

```javascript
// Secure JWT configuration
const JWT_OPTIONS = {
  algorithm: 'HS256',
  expiresIn: '24h',
  issuer: 'pitchey.pages.dev',
  audience: 'pitchey-api'
};

// Token validation middleware
async function validateToken(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('No token provided');
  
  return await verifyJWT(token, env.JWT_SECRET, JWT_OPTIONS);
}
```

### 2. CORS Configuration

```javascript
// Strict CORS policy
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://pitchey.pages.dev',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
};
```

### 3. Rate Limiting

```javascript
// Worker rate limiting with Durable Objects
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  async checkLimit(ip: string, limit: number = 100): Promise<boolean> {
    const now = Date.now();
    const minute = 60 * 1000;
    const requests = this.requests.get(ip) || [];
    
    // Remove old requests
    const recent = requests.filter(time => now - time < minute);
    
    if (recent.length >= limit) {
      return false; // Rate limit exceeded
    }
    
    recent.push(now);
    this.requests.set(ip, recent);
    return true;
  }
}
```

### 4. Input Validation

```javascript
// Validate and sanitize inputs
function validatePitchInput(data: any) {
  const schema = z.object({
    title: z.string().min(1).max(200),
    logline: z.string().min(10).max(500),
    synopsis: z.string().min(50).max(5000),
    genre: z.enum(['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller']),
    budget_range: z.enum(['micro', 'low', 'medium', 'high', 'blockbuster'])
  });
  
  return schema.parse(data);
}
```

### 5. Content Security Policy

```javascript
// Pages _headers file
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://pitchey-api-production.cavelltheleaddev.workers.dev wss://pitchey-backend-fresh.deno.dev
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## Monitoring and Maintenance

### 1. Health Monitoring

```bash
# Setup health check endpoints
GET /api/health          # Basic health
GET /api/health/detailed # Detailed service status

# Automated monitoring script
#!/bin/bash
while true; do
  response=$(curl -s https://pitchey-api-production.cavelltheleaddev.workers.dev/api/health)
  if [[ $response != *"healthy"* ]]; then
    echo "Health check failed at $(date)"
    # Send alert
  fi
  sleep 60
done
```

### 2. Analytics Integration

```javascript
// Cloudflare Analytics
// Automatic with Pages and Workers

// Custom analytics events
async function trackEvent(event: string, properties: any) {
  await env.ANALYTICS.writeDataPoint({
    timestamp: Date.now(),
    event,
    properties
  });
}
```

### 3. Backup Procedures

```bash
# Database backup
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_${DATE}.sql

# Upload to R2
wrangler r2 object put pitchey-backups/db_${DATE}.sql --file=backup_${DATE}.sql

# KV backup
wrangler kv:bulk export --namespace-id=98c88a185eb448e4868fcc87e458b3ac > kv_backup_${DATE}.json
```

### 4. Update Procedures

```bash
# Zero-downtime deployment
# 1. Deploy new Worker version
wrangler deploy --env production

# 2. Deploy new Deno version
deployctl deploy --project=pitchey-backend-fresh

# 3. Deploy new frontend
cd frontend && npm run build
wrangler pages deploy dist --branch=main

# Rollback if needed
wrangler rollback --env production
```

### 5. Cost Monitoring

```yaml
# Free tier limits
Cloudflare Pages:
  - Builds: 500/month
  - Bandwidth: Unlimited
  - Requests: Unlimited

Cloudflare Workers:
  - Requests: 100,000/day (free)
  - CPU time: 10ms/invocation (free)
  - KV: 100,000 reads/day

Deno Deploy:
  - Requests: 100,000/day
  - CPU time: 50ms/request
  - Bandwidth: 100GB/month

Neon PostgreSQL:
  - Storage: 3GB
  - Compute: 1 hour/day
  - Branches: 10

Upstash Redis:
  - Commands: 10,000/day
  - Storage: 256MB
  - Bandwidth: 10GB/month
```

## Disaster Recovery

### 1. Backup Strategy

```yaml
Frequency:
  - Database: Daily automated backups
  - KV Store: Weekly snapshots
  - R2 Storage: Continuous replication
  - Code: Git repository

Retention:
  - Daily backups: 7 days
  - Weekly backups: 4 weeks
  - Monthly backups: 12 months
```

### 2. Recovery Procedures

```bash
# Database recovery
pg_restore -d $DATABASE_URL backup_20251109.sql

# KV recovery
wrangler kv:bulk put --namespace-id=98c88a185eb448e4868fcc87e458b3ac kv_backup.json

# Full platform recovery
./disaster-recovery.sh --restore --date 20251109
```

### 3. Failover Configuration

```javascript
// Automatic failover in Worker
const PRIMARY_API = 'https://pitchey-backend-fresh.deno.dev';
const BACKUP_API = 'https://pitchey-backup.deno.dev';

async function fetchWithFailover(path: string, options: RequestInit) {
  try {
    const response = await fetch(PRIMARY_API + path, options);
    if (!response.ok) throw new Error('Primary API error');
    return response;
  } catch (error) {
    console.error('Primary API failed, using backup:', error);
    return fetch(BACKUP_API + path, options);
  }
}
```

## Support and Resources

### Documentation Links
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Deno Deploy Docs](https://deno.com/deploy/docs)
- [Neon PostgreSQL Docs](https://neon.tech/docs)
- [Upstash Redis Docs](https://docs.upstash.com/redis)

### Support Channels
- **Cloudflare Support**: support@cloudflare.com
- **Deno Deploy Support**: https://discord.gg/deno
- **Neon Support**: support@neon.tech
- **Upstash Support**: support@upstash.com

### Monitoring Dashboards
- **Cloudflare Analytics**: https://dash.cloudflare.com/analytics
- **Deno Deploy Metrics**: https://dash.deno.com/projects/pitchey-backend-fresh
- **Neon Console**: https://console.neon.tech
- **Upstash Console**: https://console.upstash.com

---

**Document Version**: 1.0.0
**Last Updated**: November 9, 2025
**Maintained By**: Pitchey Platform Team
**Status**: Production Deployment Active