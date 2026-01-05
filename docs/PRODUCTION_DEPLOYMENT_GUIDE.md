# Pitchey Production Deployment Guide

## 🌐 Production Environment

**Frontend**: https://pitchey-5o8-66n.pages.dev/  
**Backend API**: https://pitchey-api-prod.ndlovucavelle.workers.dev  
**GitHub Repository**: Connected to Cloudflare Pages for automatic deployments

## 📋 Current Production Status

### ✅ Working Components
- **Health Monitoring**: 100% endpoint health after recent fixes
- **Authentication**: Better Auth session-based system
- **Database**: Neon PostgreSQL with 16+ active connections
- **Caching**: KV cache properly configured
- **Storage**: R2 storage for documents and media
- **Frontend**: React 18 with optimized build pipeline

### 🔴 Critical Issues Identified (2026-01-05)

1. **Missing Environment Variables**
   - `BETTER_AUTH_SECRET` - Required for auth encryption
   - `BETTER_AUTH_URL` - Required for auth callbacks
   - `DATABASE_URL` - Missing from Worker environment

2. **Missing Database Tables**
   - `likes` table - Required for pitch interactions
   - `request_logs` table - Required for monitoring
   - Other potential schema mismatches

3. **Security Vulnerabilities**
   - Hardcoded password in `src/utils/jwt.ts:100`
   - Need to migrate to environment variables

## 🛠️ Required Fixes

### 1. Environment Variables Configuration

Add the following to production Worker:

```bash
# Authentication
BETTER_AUTH_SECRET=<secure-random-string-32-chars>
BETTER_AUTH_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev

# Database
DATABASE_URL=postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require

# Email (if configured)
RESEND_API_KEY=<your-resend-key>
# OR
SENDGRID_API_KEY=<your-sendgrid-key>
```

### 2. Database Schema Migration

Required SQL migration to create missing tables:

```sql
-- Create missing tables
CREATE TABLE IF NOT EXISTS likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    pitch_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pitch_id) REFERENCES pitches(id) ON DELETE CASCADE,
    UNIQUE(user_id, pitch_id)
);

CREATE TABLE IF NOT EXISTS request_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    response_time INTEGER NOT NULL,
    status_code INTEGER NOT NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    error_type VARCHAR(100),
    error_message TEXT,
    error_stack TEXT,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

### 3. Security Hardening

Remove hardcoded credentials and use environment variables.

## 🔄 Deployment Process

### Step 1: Update Environment Variables
```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put DATABASE_URL
wrangler secret put RESEND_API_KEY
```

### Step 2: Deploy Database Schema
```bash
# Run migration script
DATABASE_URL="your-db-url" deno run --allow-all src/db/migrate.ts
```

### Step 3: Deploy Worker
```bash
wrangler deploy
```

### Step 4: Verify Deployment
```bash
deno run --allow-net health-check.ts
```

## 📊 Monitoring & Health Checks

### Health Endpoints
- **Enhanced Health**: `/health` - Comprehensive system status
- **Basic Health**: `/api/health` - Quick database check
- **API Status**: `/api/trending` - API functionality test

### Expected Health Response
```json
{
  "status": "healthy",
  "environment": "production",
  "checks": {
    "database": "healthy",
    "cache": "healthy", 
    "storage": "healthy",
    "email": "healthy",
    "auth": "healthy"
  },
  "errors": []
}
```

## 🔐 Security Configuration

### Authentication
- **Type**: Better Auth session-based (migrated from JWT December 2024)
- **Sessions**: HTTP-only cookies
- **Portal Access**: Creator, Investor, Production portals
- **Demo Accounts**: Available with password "Demo123"

### Database Security
- **Connection**: TLS/SSL required
- **Pooling**: Neon built-in connection pooler
- **Credentials**: Environment variables only

### API Security
- **Rate Limiting**: Enabled per wrangler.toml
- **CORS**: Configured for frontend domain
- **Headers**: Security headers applied

## 📁 Architecture Overview

```
Frontend (Cloudflare Pages)
├── React 18 with TypeScript
├── Vite build system with React compatibility fixes
├── Tailwind CSS for styling
├── Better Auth integration
└── Real-time WebSocket support

Backend (Cloudflare Worker)
├── Worker integrated with all services
├── Better Auth for authentication  
├── Raw SQL queries via Neon
├── KV for caching
├── R2 for file storage
├── Durable Objects for real-time features
└── Analytics Engine for metrics

Database (Neon PostgreSQL)
├── Connection pooling enabled
├── SSL/TLS encrypted
├── 16+ active connections
├── EU-West-2 region
└── Automatic backups
```

## 🚀 Feature Status

### ✅ Fully Operational
- User authentication (all portals)
- Pitch browsing and viewing
- Dashboard analytics
- File uploads to R2
- Real-time notifications
- Health monitoring
- Security headers

### 🟡 Partially Working
- Pitch creation (needs schema fixes)
- NDA workflows (needs table fixes)
- Request logging (needs schema)
- Investment tracking

### 🔴 Requires Attention
- Missing environment variables
- Incomplete database schema
- Hardcoded security credentials

## 📞 Support Contacts

**Repository**: Connected to GitHub for automatic deployments  
**Frontend URL**: https://pitchey-5o8-66n.pages.dev/  
**API URL**: https://pitchey-api-prod.ndlovucavelle.workers.dev  

**Last Updated**: January 5, 2026  
**Health Status**: 83.3% (improving to 100% after fixes)