# Pitchey Platform - Error & Stack Summary Documentation

## Executive Summary
This document provides a comprehensive overview of the Pitchey platform's technical stack, monitoring setup, and error management infrastructure based on the current deployment configuration.

## 🏗️ Technical Stack Overview

### Frontend Architecture
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Deployment**: Cloudflare Pages (https://pitchey-5o8-66n.pages.dev)
- **State Management**: React Context API
- **Routing**: React Router v6
- **UI Components**: Custom components with Tailwind CSS
- **WebSocket Client**: Native WebSocket API with reconnection logic

### Backend Architecture
- **Primary API**: Cloudflare Workers (Edge-first serverless)
  - Production: `https://pitchey-api-prod.ndlovucavelle.workers.dev`
  - Entry Point: `worker-integrated.ts`
- **Local Development**: Wrangler dev server
  - Command: `wrangler dev`
  - Purpose: Runs the Cloudflare Worker locally for development

### Database Layer
- **Primary Database**: Neon PostgreSQL
  - Connection: Pooled connection with SSL
  - Query Method: Raw SQL via postgres.js (no ORM)
  - Migration System: SQL scripts in `src/db/migrations/`
  - Edge Optimization: Neon's built-in connection pooler

### Caching Infrastructure
- **Redis Cache**: Upstash Redis (Global distributed)
  - URL: `https://chief-anteater-20186.upstash.io`
  - Use Cases: Session data, notifications, real-time metrics
  - TTL Strategy: 5-minute cache for dashboards
  - Fallback: In-memory cache when Redis unavailable

### Storage Systems
- **Object Storage**: Cloudflare R2 (S3-compatible)
  - Use Cases: Documents, images, videos, NDAs
  - Access Pattern: Presigned URLs for secure access

### Real-time Communication
- **WebSocket Implementation**: Via Cloudflare Workers
  - Features: Notifications, draft auto-sync, presence tracking
  - Protocol: Standard WebSocket with JSON messaging
  - Connection: `wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws`

## 🔍 Monitoring & Observability

### Error Tracking
- **Sentry Integration**
  - Organization: `pitchey` (Region: de.sentry.io)
  - Project: `node`
  - DSN: `https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536`
  - Features: Error tracking, performance monitoring, release tracking

### Browser Monitoring
- **Chrome DevTools Integration**
  - Network request monitoring
  - Console error tracking
  - Performance profiling
  - WebSocket connection debugging

### Deployment Monitoring
- **Cloudflare Analytics**
  - Worker performance metrics
  - Pages deployment status
  - R2 storage usage
  - KV namespace operations

## 🚨 Common Error Patterns & Resolutions

### Authentication Errors
- **Issue**: Session expiration or cookie problems
- **Pattern**: 401/403 responses on API calls
- **Resolution**: Better Auth session refresh via `/api/auth/session/refresh`

### WebSocket Connection Issues
- **Issue**: Connection drops or reconnection failures
- **Pattern**: WebSocket readyState !== 1
- **Resolution**: Automatic reconnection with exponential backoff

### Database Connection Errors
- **Issue**: Connection pool exhaustion
- **Pattern**: PostgreSQL connection timeout
- **Resolution**: Neon pooler with automatic connection management

### Cache Misses
- **Issue**: Redis unavailable or slow
- **Pattern**: Upstash connection failures
- **Resolution**: Automatic fallback to in-memory cache

## 📊 Performance Optimization Stack

### Edge Computing
- **Cloudflare Workers**: Global edge execution
- **Cloudflare KV**: Edge key-value storage
- **Cache Headers**: Aggressive caching for static assets

### Database Optimization
- **Connection Pooling**: Via Neon's edge pooler
- **Query Optimization**: Indexed queries, pagination
- **Read Replicas**: Future consideration for scale

### Frontend Optimization
- **Code Splitting**: Dynamic imports for routes
- **Lazy Loading**: Components and images
- **Bundle Size**: Tree shaking and minification via Vite

## 🔐 Security Infrastructure

### Authentication System
- **Better Auth**: Session-based authentication
- **Cookie Security**: HTTP-only, Secure, SameSite flags
- **CSRF Protection**: Token validation on state-changing operations

### API Security
- **CORS Configuration**: Strict origin validation
- **Rate Limiting**: Via Cloudflare Workers
- **Input Validation**: Schema validation on all endpoints

## 🚀 Deployment Pipeline

### Frontend Deployment
```bash
# Build and deploy to Cloudflare Pages
npm run build
wrangler pages deploy frontend/dist --project-name=pitchey
```

### Worker Deployment
```bash
# Deploy to Cloudflare Workers
wrangler deploy
```

### Environment Management
- **Local**: `.env` with localhost:8001 backend
- **Production**: `.env.production` with Worker API

## 📈 Metrics & KPIs

### Error Metrics
- **Error Rate**: Tracked via Sentry
- **Error Categories**: Authentication, Database, WebSocket, Cache
- **MTTR**: Mean time to resolution via deployment pipeline

### Performance Metrics
- **TTFB**: Time to first byte < 200ms (edge execution)
- **FCP**: First contentful paint < 1.5s
- **Cache Hit Rate**: > 80% for static content

## 🔄 Real-time Features Stack

### WebSocket Events
- **Notifications**: Real-time push with Redis pub/sub
- **Draft Sync**: 5-second auto-save intervals
- **Presence**: Online/offline/away status tracking
- **Typing Indicators**: Collaborative editing signals
- **Message Queue**: Offline message persistence

### Event Types (from `frontend/src/types/websocket.ts`)
- `notification`: System notifications
- `draft_sync`: Auto-save events
- `presence`: User status updates
- `typing`: Typing indicators
- `message`: Chat messages

## 🛠️ Development Tools

### Local Development
- **Worker Dev**: Wrangler dev server
- **Frontend Dev**: Vite dev server on 5173
- **Worker Dev**: Wrangler dev on 8787

### Testing Infrastructure
- **Unit Tests**: Vitest for frontend
- **E2E Tests**: Playwright (planned)
- **API Tests**: Custom test scripts

## 📝 Known Issues & Priorities

### Current Issues
1. **Browse Tab Mixing**: Content separation needed
2. **NDA Workflow**: Approval flow incomplete
3. **Document Upload**: Multi-file support needed
4. **Access Control**: Granular permissions required

### Recent Fixes (December 2024)
- JWT to Better Auth migration completed
- Production console errors resolved
- Notification polling fixed with 404 handling
- Frontend-backend connection via proxy server
- 37 frontend test failures resolved

## 🔗 Service Endpoints

### Production URLs
- **Frontend**: https://pitchey-5o8-66n.pages.dev
- **API**: https://pitchey-api-prod.ndlovucavelle.workers.dev
- **WebSocket**: wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws

### Local Development URLs
- **Backend Proxy**: http://localhost:8001
- **Frontend Dev**: http://localhost:5173
- **Worker Dev**: http://localhost:8787

## 📚 Documentation Structure

```
docs/
├── API Reference/          # 117+ endpoint documentation
├── Deployment Guides/      # Cloudflare setup
├── Architecture/           # System design details
└── Requirements/           # Client feedback tracking
```

---

*Last Updated: January 2025*
*Platform Version: v0.2*
*Architecture: Edge-first Serverless on Cloudflare Stack*