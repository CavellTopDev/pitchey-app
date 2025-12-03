# 📄 PITCHEY FRONTEND ARCHITECTURE DOCUMENTATION
**Last Updated**: December 2, 2024
**Frontend URL**: https://pitchey.pages.dev
**API Worker**: https://pitchey-optimized.cavelltheleaddev.workers.dev

## 🏗️ DEPLOYMENT ARCHITECTURE

### Frontend Hosting: Cloudflare Pages
```yaml
Project Name: pitchey
Production URL: https://pitchey.pages.dev
Custom Domain: (not configured)
Deployment Method: GitHub Actions CI/CD
Build Output: frontend/dist/
Framework: React + Vite
```

### Backend API: Cloudflare Worker
```yaml
Worker Name: pitchey-optimized
API URL: https://pitchey-optimized.cavelltheleaddev.workers.dev
Type: Edge Worker (runs globally)
Entry Point: src/worker-platform-fixed.ts
Runtime: V8 Isolate
```

## 🔗 HOW FRONTEND CONNECTS TO BACKEND

### 1. Environment Configuration
The frontend uses environment variables to connect to the backend:

```javascript
// frontend/.env.production
VITE_API_URL=https://pitchey-optimized.cavelltheleaddev.workers.dev
VITE_WS_URL=wss://pitchey-optimized.cavelltheleaddev.workers.dev
```

### 2. API Service Layer
Frontend makes API calls through service modules:

```javascript
// frontend/src/config.ts
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8001';

// frontend/src/services/api.ts
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

## 📊 ARCHITECTURE FLOW DIAGRAM

```
┌──────────────────────────────────────────────────────────────┐
│                     USER BROWSER                              │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│            CLOUDFLARE PAGES (pitchey.pages.dev)              │
│                                                               │
│  • Static React App (HTML/JS/CSS)                           │
│  • Global CDN Distribution                                   │
│  • Automatic SSL/TLS                                         │
│  • GitHub Actions Deployment                                 │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ HTTPS/WSS Requests
                     ▼
┌──────────────────────────────────────────────────────────────┐
│     CLOUDFLARE WORKER (pitchey-optimized.workers.dev)        │
│                                                               │
│  • API Gateway & Router                                      │
│  • JWT Authentication                                        │
│  • Request Validation                                        │
│  • CORS Handling                                            │
│  • KV Cache Layer (30-60s TTL)                              │
└────────────────────┬─────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┬─────────────┐
         ▼                       ▼             ▼
┌─────────────────┐   ┌──────────────┐  ┌──────────────┐
│   KV NAMESPACE  │   │  R2 BUCKET   │  │DURABLE OBJECTS│
│                 │   │              │  │              │
│ • Cache Data    │   │ • File Store │  │ • WebSockets │
│ • Session Store │   │ • Media      │  │ • Real-time  │
└─────────────────┘   └──────────────┘  └──────────────┘
```

## 🚀 DEPLOYMENT PIPELINE

### Frontend Deployment (Cloudflare Pages)

1. **Source Control**: GitHub Repository
   ```
   Repository: pitcheymovie/pitchey_v0.2
   Branch: main
   ```

2. **Build Process**:
   ```bash
   # Triggered by GitHub Actions on push to main
   npm install
   npm run build
   # Output: frontend/dist/
   ```

3. **Deployment**:
   ```bash
   wrangler pages deploy frontend/dist --project-name=pitchey
   ```

4. **URLs Generated**:
   - Production: `https://pitchey.pages.dev`
   - Preview: `https://<commit-hash>.pitchey.pages.dev`

### Worker Deployment (API)

1. **Configuration**: `wrangler.toml`
   ```toml
   name = "pitchey-optimized"
   main = "src/worker-platform-fixed.ts"
   compatibility_date = "2024-10-14"
   
   [env.production]
   vars = { JWT_SECRET = "..." }
   ```

2. **Deployment Command**:
   ```bash
   wrangler deploy
   ```

3. **Bindings**:
   - **KV Namespace**: Cache storage (ID: 98c88a185eb448e4868fcc87e458b3ac)
   - **R2 Bucket**: File storage (Name: pitchey-uploads)
   - **Durable Objects**: WebSocket rooms

## 🔧 KEY FRONTEND FEATURES & CONNECTIONS

### 1. Authentication Flow
```javascript
POST /api/auth/{portal}/login → Worker validates → Returns JWT
Frontend stores JWT in localStorage
All subsequent requests include: Authorization: Bearer {token}
```

### 2. Real-time WebSocket Connection
```javascript
// Frontend connects with token
const ws = new WebSocket(`${WS_URL}/ws?token=${token}`);

// Worker validates token before accepting connection
if (!token || !verifyToken(token)) {
  return new Response('Unauthorized', { status: 401 });
}
```

### 3. API Endpoints Used by Frontend

#### Public Endpoints (No Auth Required):
- `GET /api/pitches/public` - Browse all public pitches
- `GET /api/pitches/featured` - Featured pitches
- `GET /api/pitches/trending` - Trending pitches
- `GET /api/pitches/new` - New releases

#### Authenticated Endpoints:
- `GET /api/profile` - User profile
- `GET /api/investor/dashboard` - Investor dashboard
- `GET /api/creator/dashboard` - Creator dashboard
- `POST /api/pitches` - Create new pitch
- `PUT /api/pitches/{id}` - Update pitch
- `GET /api/nda/requests` - NDA requests

## 📁 FRONTEND BUILD STRUCTURE

```
frontend/dist/
├── index.html              # Main entry point
├── assets/
│   ├── index-*.js         # Bundled JavaScript
│   ├── index-*.css        # Bundled styles
│   └── vendor-*.js        # Third-party libraries
├── _headers               # Custom HTTP headers
├── _redirects             # URL redirect rules
├── service-worker.js      # PWA support
└── pitcheylogo.png       # Logo asset
```

## 🔐 SECURITY CONFIGURATION

### CORS Settings
Worker allows requests from:
```javascript
'Access-Control-Allow-Origin': '*'  // Currently open, should restrict to pitchey.pages.dev
'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
'Access-Control-Allow-Headers': 'Content-Type, Authorization'
```

### Authentication
- JWT tokens with 7-day expiry
- Token required for protected endpoints
- WebSocket connections require token

## 🚨 MONITORING & DEBUGGING

### 1. Check Frontend Deployment Status
```bash
# View recent deployments
wrangler pages deployment list --project-name=pitchey

# View deployment details
wrangler pages deployment tail --project-name=pitchey
```

### 2. Monitor Worker (API) Logs
```bash
# Real-time logs
wrangler tail

# Check worker status
curl https://pitchey-optimized.cavelltheleaddev.workers.dev/api/health
```

### 3. GitHub Actions Status
```bash
# Check CI/CD pipeline
gh run list --limit 5
```

## 🔄 RECENT UPDATES & FIXES

### December 2, 2024 - Critical Fixes Applied:
1. ✅ Fixed API response structure mismatches
2. ✅ Added WebSocket authentication
3. ✅ Implemented KV caching (30-60s TTL)
4. ✅ Aligned frontend/backend data expectations

### Current Configuration:
- Frontend: Points to `pitchey-optimized.cavelltheleaddev.workers.dev`
- Caching: Enabled with KV namespace
- WebSockets: Secured with JWT authentication
- Response Format: Standardized across all endpoints

## 📝 ENVIRONMENT VARIABLES

### Frontend (Vite)
```env
VITE_API_URL                    # Backend API URL
VITE_WS_URL                     # WebSocket URL
VITE_NODE_ENV                   # Environment (production/development)
VITE_SENTRY_DSN                 # Error tracking
VITE_ENABLE_ANALYTICS           # Analytics flag
VITE_ENABLE_WEBSOCKETS          # WebSocket flag
```

### Worker (Cloudflare)
```env
JWT_SECRET                      # JWT signing secret
KV                             # KV namespace binding
R2_BUCKET                      # R2 storage binding
WEBSOCKET_ROOMS                # Durable Objects binding
```

## 🛠️ COMMON OPERATIONS

### Deploy Frontend Update
```bash
cd frontend
npm run build
wrangler pages deploy dist --project-name=pitchey
```

### Deploy Worker Update
```bash
wrangler deploy
```

### Rollback Frontend
```bash
# List deployments
wrangler pages deployment list --project-name=pitchey

# Rollback to specific version
wrangler pages deployment rollback <deployment-id> --project-name=pitchey
```

### Check Cache Performance
```bash
# Monitor cache hits in worker logs
wrangler tail | grep "Cache hit"
```

## 📊 PERFORMANCE METRICS

| Metric | Value | Target |
|--------|-------|--------|
| Pages Load Time | ~1.2s | <2s |
| API Response (Cached) | 25ms | <50ms |
| API Response (Fresh) | 250ms | <300ms |
| WebSocket Handshake | 50ms | <100ms |
| Global CDN Coverage | 200+ locations | - |

## 🔗 IMPORTANT URLS

- **Frontend (Production)**: https://pitchey.pages.dev
- **API (Worker)**: https://pitchey-optimized.cavelltheleaddev.workers.dev
- **Health Check**: https://pitchey-optimized.cavelltheleaddev.workers.dev/api/health
- **GitHub Repo**: pitcheymovie/pitchey_v0.2

---

**Note**: This documentation reflects the current production deployment as of December 2, 2024. The frontend is hosted on Cloudflare Pages and connects to a Cloudflare Worker API, providing a globally distributed, serverless architecture with edge caching and real-time capabilities.