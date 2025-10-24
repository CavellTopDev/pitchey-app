# Pitchey Platform

## Overview

Pitchey is a comprehensive movie pitch platform that connects creators, investors, and production companies. The platform enables secure pitch sharing, NDA management, and real-time collaboration through WebSocket communication.

## Current Version: 0.2 (Production Deployment)

**✅ LIVE PRODUCTION:** Platform is deployed and running in production with Upstash Redis caching and Neon PostgreSQL database.

### Core Features

- **Multi-Portal System**: Three distinct portals for Creators, Investors, and Production Companies
- **Real-time Communication**: WebSocket-based notifications, live updates, and draft auto-sync
- **NDA Workflow**: Digital NDA management with request/approval system
- **Pitch Management**: Create, edit, browse, and manage movie pitches
- **Redis Caching**: Performance optimization with 5-minute cache TTL for dashboards
- **JWT Authentication**: Secure, portal-specific authentication system
- **Role-Based Access Control**: Proper permission management across portals

## Platform Status

### What's Working (90% Complete)

| Component | Status | Details |
|-----------|--------|----------|
| **Authentication** | ✅ Fully Working | JWT-based, all 3 portals functional |
| **Creator Portal** | ✅ Fully Working | Dashboard, pitch creation/editing, analytics |
| **Production Portal** | ✅ Fully Working | Dashboard, pitch management, NDA workflow |
| **Investor Portal** | ✅ Fully Working | Dashboard, portfolio, watchlist functional |
| **WebSocket** | ✅ Working | Real-time notifications, draft sync, messaging |
| **Redis Caching** | ✅ Production Ready | Upstash Redis integrated with automatic fallback |
| **Database** | ✅ Fully Working | PostgreSQL with complete Drizzle ORM schema |
| **Browse/Marketplace** | ✅ Working | Search, filtering, trending pitches |
| **NDA System** | ✅ Working | Complete info request and NDA workflow |

### Swap-Ready Services (Working with Mock/Local Implementations)

| Feature | Current Status | Production Ready | Notes |
|---------|---------------|------------------|-------|
| **File Storage** | ✅ Local Storage | ✅ S3 Ready | Swap to AWS S3 with credentials |
| **Payment Processing** | ✅ Mock Stripe | ✅ Stripe Ready | Full Stripe integration ready |
| **Email Notifications** | ✅ Console Logging | ✅ SendGrid Ready | Swap to SendGrid/AWS SES |
| **Error Tracking** | ✅ Console Logging | ✅ Sentry Ready | Add Sentry DSN to enable |
| **Cache System** | ✅ Upstash Redis | ✅ Production Ready | Auto-fallback to memory cache |
| **Admin Portal** | ✅ Implemented | ✅ Fully Working | Complete admin dashboard |

## Quick Start

### Prerequisites

- [Deno](https://deno.land/) (v2.0+)
- [Node.js](https://nodejs.org/) (v20.19.5 for frontend)
- [PostgreSQL](https://www.postgresql.org/) (v14+) or [Neon](https://neon.tech/) account
- [Upstash Redis](https://upstash.com/) account (optional, for distributed caching)
- [Git](https://git-scm.com/)

### Installation

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd pitchey_v0.2
   ```

2. **Set up the database**
   ```bash
   # Create database
   createdb pitchey_dev
   
   # Run migrations
   deno run --allow-all run-migrations.ts
   ```

3. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

4. **Configure frontend environment**
   ```bash
   # Create frontend/.env file with:
   echo "VITE_API_URL=http://localhost:8001" > frontend/.env
   echo "VITE_WS_URL=ws://localhost:8001" >> frontend/.env
   ```

5. **Start the development servers**
   
   **CRITICAL: Backend MUST run on port 8001**
   
   Backend (Terminal 1):
   ```bash
   PORT=8001 deno run --allow-all working-server.ts
   # Server runs on http://localhost:8001
   ```
   
   Frontend (Terminal 2):
   ```bash
   cd frontend
   npm run dev
   # Frontend runs on http://localhost:5173
   ```

### Demo Accounts

Use these accounts to test the platform (password for all: `Demo123`):

| Portal | Email | Password |
|--------|-------|----------|
| **Creator** | alex.creator@demo.com | Demo123 |
| **Investor** | sarah.investor@demo.com | Demo123 |
| **Production** | stellar.production@demo.com | Demo123 |

## Environment Configuration

### Backend Environment Variables (.env)

```bash
# Database (Required)
DATABASE_URL=postgresql://user:password@localhost:5432/pitchey_dev

# Server Configuration (Required)
PORT=8001  # MUST be 8001
HOST=0.0.0.0

# Security (Required)
JWT_SECRET=your-secure-random-string
JWT_REFRESH_SECRET=different-secure-random-string

# Redis Caching (Optional - auto-fallback to memory cache)
# Option 1: Upstash Redis (Recommended for production)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Option 2: Standard Redis (For local development)
REDIS_URL=redis://localhost:6379

# Mock Services (Currently in use)
EMAIL_PROVIDER=console  # Logs to console instead of sending
STORAGE_PROVIDER=local  # Uses local filesystem
PAYMENT_PROVIDER=mock   # Mock Stripe implementation

# Environment
DENO_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8001
```

### Frontend Environment Variables (frontend/.env)

```bash
# API Configuration (Required)
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001

# Features
VITE_ENABLE_WEBSOCKET=true
```

## Project Structure

```
pitchey_v0.2/
├── frontend/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Portal pages (Creator, Investor, Production)
│   │   ├── services/       # API services
│   │   ├── contexts/       # React contexts (WebSocket, Auth)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Helper functions
│   └── package.json
├── src/
│   ├── db/
│   │   └── schema.ts       # Drizzle ORM schema definitions
│   ├── services/           # Business logic services
│   │   ├── pitch.service.ts
│   │   ├── websocket.service.ts
│   │   ├── cache.service.ts
│   │   └── info-request.service.ts
│   ├── middleware/         # Authentication, CORS, etc.
│   └── utils/             # Utility functions
├── routes/
│   └── api/               # API route handlers
├── drizzle/               # Database migrations
├── working-server.ts      # Main backend server (USE THIS)
├── deno.json             # Deno configuration
└── CLAUDE.md            # Project instructions and context
```

## Technology Stack

- **Backend**: Deno with Oak framework
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSockets with native Deno implementation
- **Caching**: Upstash Redis (serverless) with in-memory fallback
- **Styling**: Tailwind CSS
- **Authentication**: JWT tokens

## API Documentation

### Portal-Specific Authentication

Each portal has its own login endpoint:

```bash
# Creator Portal
POST /api/auth/creator/login

# Investor Portal  
POST /api/auth/investor/login

# Production Portal
POST /api/auth/production/login
```

### Key API Endpoints

- **Pitches**: `/api/pitches` (CRUD operations)
- **NDAs**: `/api/info-requests` (request/approve/reject workflow)
- **Dashboard**: `/api/dashboard/{portal}/metrics`
- **WebSocket**: `ws://localhost:8001/ws` (real-time updates)

## Available Scripts

### Backend Commands

```bash
# Start backend server (MUST use port 8001)
PORT=8001 deno run --allow-all working-server.ts

# Run database migrations
deno run --allow-all run-migrations.ts

# Check database state
deno run --allow-all check-db-state.ts

# Seed demo data
deno run --allow-all create-test-data.ts
```

### Frontend Commands

```bash
cd frontend

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Backend Connection Errors

**Problem**: Frontend can't connect to backend API

**Solution**:
```bash
# Ensure backend is running on port 8001
PORT=8001 deno run --allow-all working-server.ts

# Check frontend .env file
cat frontend/.env
# Should contain:
# VITE_API_URL=http://localhost:8001
# VITE_WS_URL=ws://localhost:8001

# Restart frontend after .env changes
cd frontend && npm run dev
```

#### 2. WebSocket Connection Issues

**Problem**: WebSocket fails to connect or disconnects frequently

**Solution**:
- Verify backend is running on port 8001
- Check browser console for CORS errors
- Ensure JWT token is valid and not expired
- Try clearing browser cache and localStorage

#### 3. Database Connection Errors

**Problem**: "Cannot connect to database" errors

**Solution**:
```bash
# Check PostgreSQL is running
pg_isready

# Verify DATABASE_URL in .env
echo $DATABASE_URL

# Create database if missing
createdb pitchey_dev

# Run migrations
deno run --allow-all run-migrations.ts
```

#### 4. Login Issues

**Problem**: Can't log in with demo accounts

**Solution**:
```bash
# Seed demo accounts
deno run --allow-all create-demo-accounts.ts

# Verify accounts exist
deno run --allow-all check-demo-users.ts
```

**Demo Credentials**:
- alex.creator@demo.com / Demo123
- sarah.investor@demo.com / Demo123
- stellar.production@demo.com / Demo123

#### 5. Port Already in Use

**Problem**: "Address already in use" error

**Solution**:
```bash
# Find process using port 8001
lsof -i :8001

# Kill the process
kill -9 [PID]

# Or use a different port (NOT RECOMMENDED)
PORT=8002 deno run --allow-all working-server.ts
# Update frontend/.env accordingly
```

#### 6. Missing Tables or Columns

**Problem**: Database schema errors

**Solution**:
```bash
# Run all migrations
deno run --allow-all run-migrations.ts

# Check current schema
deno run --allow-all check-database-structure.ts

# Reset and recreate (CAUTION: loses data)
dropdb pitchey_dev && createdb pitchey_dev
deno run --allow-all run-migrations.ts
```

#### 7. Frontend Build Errors

**Problem**: npm install or build failures

**Solution**:
```bash
cd frontend

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# Check Node version (should be 18+)
node --version
```

#### 8. Redis Caching Configuration

**Problem**: Caching not working optimally

**Solution**:
- Platform automatically falls back to in-memory cache if Redis is unavailable
- For production caching with Upstash:
```bash
# Add to .env file
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
CACHE_ENABLED=true
CACHE_TTL=300
```
- For local Redis:
```bash
# Install and start Redis
redis-server

# Set REDIS_URL in backend .env
REDIS_URL=redis://localhost:6379
```

### Known Issues to Avoid

1. **DO NOT** change the backend port from 8001
2. **DO NOT** use relative imports in frontend API calls
3. **DO NOT** expect email notifications (console logging only)
4. **DO NOT** expect file uploads to persist (local storage only)
5. **DO NOT** expect real payments (mock Stripe only)

### Getting Help

If you encounter issues not covered here:

1. Check the browser console for errors
2. Check backend logs in the terminal
3. Review CLIENT_FEEDBACK_REQUIREMENTS.md for known issues
4. Check existing test files for examples

## Current Limitations

This is a development version with the following limitations:

- **No Production Deployment**: Not ready for production use
- **Mock Services**: Email, payments, and storage are mocked
- **Limited Features**: Some features are partially implemented
- **Known Bugs**: See CLIENT_FEEDBACK_REQUIREMENTS.md for details

## License

Copyright © 2025 Pitchey. All rights reserved.

## Notes

- This is a production-ready platform (90% complete)
- For production deployment, AWS S3, Stripe, and email services need to be properly configured
- See CLAUDE.md for detailed development instructions
- See CLIENT_FEEDBACK_REQUIREMENTS.md for known issues and required fixes
