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
**IMPORTANT: Backend always runs on PORT 8001 locally**
```bash
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2
PORT=8001 deno run --allow-all working-server.ts
```

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
wrangler deploy --env production
```

## Commands

### Local Development
- Backend: `PORT=8001 deno run --allow-all working-server.ts`
- Frontend: `npm run dev` 
- Worker: `wrangler dev`

### Production Deployment
- Deploy Frontend: `wrangler pages deploy frontend/dist --project-name=pitchey`
- Deploy Worker: `wrangler deploy --env production`

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

## Authentication
- JWT-based authentication
- Portal-specific login endpoints:
  - Creator: POST /api/auth/creator/login
  - Investor: POST /api/auth/investor/login  
  - Production: POST /api/auth/production/login

## Demo Accounts (password: Demo123)
- Creator: alex.creator@demo.com
- Investor: sarah.investor@demo.com
- Production: stellar.production@demo.com

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

## Latest Improvements & Status (November 2025)

### ✅ COMPLETED: Frontend-Backend Consistency Fixes
**Major Resolution**: Conducted comprehensive frontend-backend API consistency analysis and resolved critical issues.

#### **Fixed Issues:**
1. **Homepage Display Issues**: ✅ RESOLVED
   - Fixed text overlapping and "scribbly lines" on hero text
   - Resolved Chrome-specific text color changes (white to black)
   - Restored floating decoration icons with proper responsive behavior
   
2. **Missing API Endpoints**: ✅ RESOLVED  
   - Added `/api/user/notifications` - User notifications with pagination
   - Added `/api/search/users` - Advanced user search functionality
   - Fixed authentication patterns and response handling

3. **Frontend-Backend Inconsistencies**: ✅ RESOLVED
   - Identified and fixed 87+ API inconsistencies
   - Resolved database field mapping mismatches
   - Fixed authentication flow inconsistencies

### ⚠️ Remaining Client Requirements
**See CLIENT_FEEDBACK_REQUIREMENTS.md for detailed tracking**

#### **High Priority (Not Yet Addressed):**
1. **Investor Portal Issues**: Dashboard functionality needs review
2. **Browse Section**: Tab filtering and content organization  
3. **NDA Workflow**: Complete implementation and user experience
4. **Access Control**: Role-based permissions refinement

#### **Enhancement Requests:**
- Character editing and reordering in pitch creation
- Document upload system improvements (multiple files, custom NDA)
- General browse view with comprehensive sorting
- Themes field conversion to free-text
- New "World" field for world-building descriptions

### 🔧 Recent Technical Fixes:
- **CSS & Responsive Design**: Fixed text rendering, overlapping, and Chrome compatibility
- **API Architecture**: Added missing endpoints, standardized authentication patterns  
- **Service Layer**: Resolved naming conflicts, unified response handling
- **Database Integration**: Fixed field mappings and query consistency
- **WebSocket Services**: Maintained real-time functionality during updates

For complete details, implementation notes, and testing criteria, refer to:
📄 **CLIENT_FEEDBACK_REQUIREMENTS.md**
📄 **CODEBASE_INCONSISTENCIES_REPORT.md**
📄 **CLOUDFLARE_DEPLOYMENT_GUIDE.md** - Complete deployment instructions
📄 **DEPLOYMENT_ARCHITECTURE.md** - Technical architecture details