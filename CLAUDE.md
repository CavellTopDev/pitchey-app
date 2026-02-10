# Claude Instructions

This file contains project-specific instructions and context for Claude Code.

## Project Overview
Pitchey is a comprehensive movie pitch platform that connects creators, investors, and production companies. The platform uses a modern edge-first serverless architecture powered entirely by Cloudflare Workers.

### Production Architecture
- **Frontend**: Cloudflare Pages (https://pitchey-5o8.pages.dev)
- **Backend API**: Cloudflare Workers (https://pitchey-api-prod.ndlovucavelle.workers.dev) - PRIMARY backend
- **Database**: Neon PostgreSQL (raw SQL queries, no ORM)
  - Connection: `postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
- **Cache**: Upstash Redis (global distributed)
- **Storage**: Cloudflare R2 (S3-compatible object storage)
- **WebSockets**: Via Cloudflare Workers (Durable Objects planned for future)

## Project Structure
The root directory contains only essential files and directories:
- **12 root files**: package.json, package-lock.json, tsconfig.json, wrangler.toml, eslint.config.js, esbuild.config.js, .gitignore, .mcp.json, CLAUDE.md, README.md, .env.example, .env.production.example
- **10 directories**: src/, frontend/, .github/, docs/, scripts/, node_modules/, dist/, .wrangler/, .claude/, .git/

## Development Setup

### Local Development Configuration
**IMPORTANT: Use `wrangler dev` for local backend development**
```bash
# Start Worker locally with bindings
wrangler dev
```

The Worker runs locally with `wrangler dev`, providing API access for frontend development.

### Frontend Configuration  
**Frontend connects to backend on port 8001 (local) or Worker API (production)**
```bash
cd frontend
npm run dev
```

#### Local Development (.env)
```
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001
```

#### Production (.env.production)
```
VITE_API_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev
VITE_WS_URL=wss://pitchey-api-prod.ndlovucavelle.workers.dev
```

### Worker Development
```bash
# Test Worker locally with bindings
wrangler dev

# Deploy to production
wrangler deploy
```

## Commands

### Local Development
- Backend: `wrangler dev`
- Frontend: `npm run dev`

### Production Deployment
- Deploy Frontend: `wrangler pages deploy frontend/dist --project-name=pitchey`
- Deploy Worker: `wrangler deploy`

### Build Commands
- Build Frontend: `npm run build`
- Type check: `npm run type-check`

## Service URLs

### Local Development
**CRITICAL: Always use port 8001 for backend locally**
- Backend API: http://localhost:8001
- Backend WebSocket: ws://localhost:8001/ws  
- Frontend Dev Server: http://localhost:5173 (auto-assigned by Vite)
- Worker Dev: http://localhost:8787 (wrangler dev)

### Production URLs
- Frontend: https://pitchey-5o8.pages.dev
- API & WebSocket: https://pitchey-api-prod.ndlovucavelle.workers.dev
- WebSocket: wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws

## Real-time Features
The platform includes comprehensive WebSocket integration:
- Real-time notifications with Redis caching
- Live dashboard metrics with 5-minute cache TTL
- Draft auto-sync with 5-second intervals
- Presence tracking (online/offline/away status)
- Collaborative editing with typing indicators
- Message queuing for offline users
- Upload progress tracking

## Code Conventions
- Use TypeScript for all new code
- Follow existing patterns in the codebase
- WebSocket types are centralized in `frontend/src/types/websocket.ts`
- Redis services use lazy-loaded getters to avoid static initialization issues

## Database
- **Technology**: Neon PostgreSQL with raw SQL queries (no ORM)
- **Connection**: Uses postgres.js client directly
- **Migrations**: SQL scripts in `src/db/migrations/`
- **Edge Pooling**: Via Neon's built-in connection pooler

## 🔐 AUTHENTICATION - Better Auth ONLY

### Better Auth Session-Based Authentication
- **Cookie-Based Sessions**: All authentication uses secure HTTP-only cookies
- **No JWT Headers**: Authorization headers are NOT used - sessions managed entirely via cookies
- **Unified Auth Flow**: Single authentication system for all portal types
- **Legacy Note**: Platform was migrated from JWT to Better Auth in December 2024

### Better Auth Primary Endpoints
- **Sign In**: `POST /api/auth/sign-in` (unified for all portals)
- **Sign Up**: `POST /api/auth/sign-up` 
- **Sign Out**: `POST /api/auth/sign-out`
- **Session Check**: `GET /api/auth/session`
- **Session Refresh**: `POST /api/auth/session/refresh`

### Portal-Specific Endpoints (Backward Compatibility)
These endpoints still work but internally use Better Auth:
- Creator: `POST /api/auth/creator/login`
- Investor: `POST /api/auth/investor/login`  
- Production: `POST /api/auth/production/login`

### Demo Accounts
**Password for all accounts: Demo123**
- Creator: alex.creator@demo.com
- Investor: sarah.investor@demo.com
- Production: stellar.production@demo.com

## Architecture Notes

### Cloudflare Stack
- **Pages**: React frontend with global CDN distribution
- **Workers**: Primary backend API (`worker-integrated.ts`) handling all routing
- **R2**: Object storage for documents, images, and videos
- **KV**: Edge caching for frequently accessed data
- **WebSockets**: Implemented via Workers (free tier limitations prevent Durable Objects)

### Key Implementation Details
- Frontend environment variables require restart to take effect
- Redis (Upstash) handles caching with memory fallback when unavailable
- All API endpoints route through Worker (no direct backend access)
- Raw SQL queries via postgres.js (no ORM abstraction)

## Important Reminders

### Local Development
1. **Use `wrangler dev` for local backend**
2. **Frontend .env must point to http://localhost:8787 (wrangler dev port)**
3. **Restart frontend after environment variable changes**
4. **WebSocket types defined in `frontend/src/types/websocket.ts`**

### Production Deployment
1. **Frontend**: `wrangler pages deploy frontend/dist --project-name=pitchey`
2. **Worker API**: `wrangler deploy` (deploys worker-integrated.ts)
3. **Documentation**: Organized in `docs/` folder
4. **No direct backend access** - all requests go through Worker API

## Current Status

### Working Features
- **Authentication**: Better Auth session-based auth for all three portals
- **Core Functionality**: Pitch creation, browsing, NDA management
- **Real-time**: WebSocket notifications, draft auto-sync, presence tracking
- **Storage**: R2 integration for documents and media
- **API**: 117+ endpoints documented and operational

### Known Issues & Priorities
1. **Browse Section**: Tab content separation (Trending/New tabs mixed)
2. **Document Upload**: Multiple files and custom NDA support needed
3. **NDA Workflow**: Complete approval flow implementation
4. **Access Control**: Granular role-based permissions

### Recent Fixes (December 2024)
- Migrated from JWT to Better Auth session-based authentication
- Fixed all production console errors and self-reference issues  
- Resolved notification polling with proper 404 handling
- Connected frontend to production API via local proxy server
- Fixed 37 failing frontend tests

### Documentation
All documentation has been organized in the `docs/` folder:
- **API Reference**: Complete endpoint documentation
- **Deployment Guides**: Cloudflare setup and configuration
- **Architecture**: System design and technical details
- **Requirements**: Client feedback and implementation status