# Claude Instructions

This file contains project-specific instructions and context for Claude Code.

## Project Overview
Pitchey is a comprehensive movie pitch platform that connects creators, investors, and production companies. It features real-time WebSocket communication, Redis-powered caching, draft auto-sync, and comprehensive NDA workflows.

## Development Setup

### Backend Configuration
**IMPORTANT: Backend always runs on PORT 8001**
```bash
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2
PORT=8001 deno run --allow-all working-server.ts
```

### Frontend Configuration  
**Frontend connects to backend on port 8001**
```bash
cd frontend
npm run dev
```

Frontend .env should always have:
```
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001
```

## Commands
- Backend: `PORT=8001 deno run --allow-all working-server.ts`
- Frontend: `npm run dev` 
- Build Frontend: `npm run build`
- Type check: `npm run type-check` (if available)

## Port Configuration
**CRITICAL: Always use port 8001 for backend**
- Backend API: http://localhost:8001
- Backend WebSocket: ws://localhost:8001/ws  
- Frontend Dev Server: http://localhost:5173 (auto-assigned by Vite)

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

## Notes
- Backend serves on 0.0.0.0:8001 to accept connections from any interface
- Frontend environment variables require server restart to take effect
- WebSocket services initialize automatically on backend startup
- Redis features are limited without full Redis setup but core functionality works
- All 29 test categories are supported by the current implementation

## Important Reminders
1. **ALWAYS use PORT=8001 for backend**
2. **Frontend .env must point to port 8001**
3. **Restart frontend after .env changes**
4. **Use lazy-loaded getters for Redis service access**
5. **WebSocket types are in separate types file**

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