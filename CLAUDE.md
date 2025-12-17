# Claude Instructions

This file contains project-specific instructions and context for Claude Code.

## Project Overview
Pitchey is a comprehensive movie pitch platform that connects creators, investors, and production companies. The platform uses a modern edge-first serverless architecture with Cloudflare Workers, Neon PostgreSQL, and Upstash Redis. It features real-time WebSocket communication via Durable Objects, edge caching, draft auto-sync, and comprehensive NDA workflows.

### Production Architecture
- **Frontend**: Cloudflare Pages (https://pitchey.pages.dev)
- **API**: Cloudflare Workers (https://pitchey-production.cavelltheleaddev.workers.dev)
- **Database**: Neon PostgreSQL with Hyperdrive edge pooling
- **Cache**: Upstash Redis (global distributed)
- **Storage**: Cloudflare R2 (S3-compatible)
- **WebSockets**: Cloudflare Durable Objects

## Development Setup

### Local Development Configuration
**IMPORTANT: Backend uses proxy server on PORT 8001 locally**
```bash
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2
# Start proxy server (proxies to production API)
PORT=8001 deno run --allow-all working-server.ts
```

This proxy server forwards all `/api/*` requests to the production Cloudflare Worker, allowing local frontend development with production data.

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
VITE_API_URL=https://pitchey-production.cavelltheleaddev.workers.dev
VITE_WS_URL=wss://pitchey-production.cavelltheleaddev.workers.dev
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
- Backend: `PORT=8001 deno run --allow-all working-server.ts`
- Frontend: `npm run dev` 
- Worker: `wrangler dev`

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
- Frontend: https://pitchey.pages.dev
- API & WebSocket: https://pitchey-production.cavelltheleaddev.workers.dev
- WebSocket: wss://pitchey-production.cavelltheleaddev.workers.dev/ws

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
- Uses Drizzle ORM with PostgreSQL
- Neon database for production
- Local PostgreSQL for development
- Schema files in `src/db/schema.ts`

## 🔐 AUTHENTICATION - BETTER AUTH IMPLEMENTED ⚠️

### ⭐ CRITICAL UPDATE: Better Auth is NOW the Primary Authentication System
**The platform has been migrated from JWT to Better Auth's session-based authentication**

### Better Auth Integration Details
- **Primary Auth System**: Better Auth with cookie-based sessions (NOT JWT anymore!)
- **Session Management**: Server-side sessions stored in cookies
- **No More JWT Headers**: Authorization headers are NOT used - sessions are in cookies
- **Portal Compatibility**: All portal endpoints work but route through Better Auth internally

### Better Auth Primary Endpoints
- **Sign In**: `POST /api/auth/sign-in` (unified for all portals)
- **Sign Up**: `POST /api/auth/sign-up` 
- **Sign Out**: `POST /api/auth/sign-out`
- **Session Check**: `GET /api/auth/session`
- **Session Refresh**: `POST /api/auth/session/refresh`

### Portal-Specific Endpoints (Legacy - Still Work via Better Auth)
These endpoints are maintained for backward compatibility but use Better Auth internally:
- Creator: `POST /api/auth/creator/login` → Routes to Better Auth
- Investor: `POST /api/auth/investor/login` → Routes to Better Auth  
- Production: `POST /api/auth/production/login` → Routes to Better Auth

### Demo Accounts (All Work with Better Auth!)
**Password for all accounts: Demo123**
- Creator: alex.creator@demo.com
- Investor: sarah.investor@demo.com
- Production: stellar.production@demo.com

### Migration Notes
- ✅ **JWT to Better Auth migration COMPLETE**
- ✅ **All demo accounts work with Better Auth**
- ✅ **Cookie-based sessions replace JWT tokens**
- ✅ **No Authorization headers needed anymore**

## Architecture Notes

### Cloudflare Integration
- **Pages**: Hosts the React frontend with global CDN
- **Workers**: Provides edge API gateway with caching and routing
- **R2**: S3-compatible object storage with zero egress fees
- **KV**: Edge key-value storage for caching
- **Hyperdrive**: Database connection pooling at the edge
- **Durable Objects**: WebSocket room management

### Key Points
- Backend serves on 0.0.0.0:8001 locally to accept connections from any interface
- Frontend environment variables require server restart to take effect
- WebSocket services initialize automatically on backend startup
- Redis features use Upstash in production, fallback to memory cache if unavailable
- Worker proxies unmatched routes to Deno Deploy backend (progressive migration)
- All 29 test categories are supported by the current implementation

## Important Reminders

### Local Development
1. **ALWAYS use PORT=8001 for backend locally**
2. **Frontend .env must point to port 8001 for local dev**
3. **Restart frontend after .env changes**
4. **Use lazy-loaded getters for Redis service access**
5. **WebSocket types are in separate types file**

### Production Deployment
1. **Frontend deploys to Cloudflare Pages**
2. **Worker handles all API routing and edge caching**
3. **Database uses Neon with Hyperdrive edge pooling**
4. **WebSockets handled via Cloudflare Durable Objects**
5. **Check CLOUDFLARE_DEPLOYMENT_GUIDE.md for full instructions**

## Latest Improvements & Status (December 2024)

### ✅ COMPLETED: Critical Fixes (December 10, 2024)

#### **Major Achievements:**
1. **Test Suite Fixed**: ✅ RESOLVED
   - Fixed all 37 failing tests in frontend test suite
   - Achieved 189 passing tests, 2 skipped
   - Resolved async testing issues with proper waitFor patterns

2. **Investor Portal Fixed**: ✅ RESOLVED
   - Fixed critical sign-out functionality (was completely broken)
   - Restored investor dashboard with real production data
   - Created proxy server for local development
   - All investor endpoints confirmed working

3. **Documentation Updated**: ✅ RESOLVED
   - Created comprehensive API documentation (117+ endpoints)
   - Updated client requirements status
   - Documented deployment architecture

### 📊 Current System Status

#### **Working Features:**
- **All Three Portal Logins**: Creator, Investor, Production - all functional
- **Core Features**: Authentication, Dashboard Data, Pitch Creation, NDA System
- **API Infrastructure**: 117+ endpoints implemented and documented
- **Real-time Features**: WebSocket support, Redis caching, Draft auto-sync

### ⚠️ Remaining Priority Items
**See CLIENT_REQUIREMENTS_UPDATE_DEC10.md for complete details**

#### **High Priority:**
1. **Browse Section**: Tab content separation issue (Trending/New tabs mixed)
2. **Document Upload**: Multiple files, custom NDA, R2 storage integration  
3. **NDA Workflow**: Complete approval flow and notifications
4. **Access Control**: Granular role-based permissions

#### **Enhancement Requests:**
- Character editing and reordering in pitch creation
- Document upload system improvements (multiple files, custom NDA)
- General browse view with comprehensive sorting
- Themes field conversion to free-text
- New "World" field for world-building descriptions

### 🔧 Recent Technical Fixes (December 10, 2024):
- **Test Suite**: Fixed async testing patterns, resolved 37 test failures
- **Investor Portal**: Fixed sign-out functionality (cursor styling issue)
- **Dashboard Data**: Connected frontend to production API via proxy server
- **Documentation**: Created comprehensive API endpoint documentation
- **Development Setup**: Implemented local proxy server for easier development

For complete details, implementation notes, and testing criteria, refer to:
📄 **CLIENT_REQUIREMENTS_UPDATE_DEC10.md** - Latest status and fixes
📄 **API_ENDPOINTS_DOCUMENTATION.md** - Complete API reference (117+ endpoints)
📄 **CLIENT_FEEDBACK_REQUIREMENTS.md** - Original requirements tracking
📄 **CLOUDFLARE_DEPLOYMENT_GUIDE.md** - Complete deployment instructions
📄 **DEPLOYMENT_ARCHITECTURE.md** - Technical architecture details