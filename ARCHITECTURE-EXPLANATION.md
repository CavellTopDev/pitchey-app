# 🏗️ Pitchey Architecture: How Localhost Connects to Neon DB & Cloudflare Workers

## 📊 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         LOCAL DEVELOPMENT                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Browser] http://localhost:5173                                 │
│      ↓                                                           │
│  [Vite Dev Server] - React Frontend                             │
│      ↓                                                           │
│  [API Calls] http://localhost:8001/api/*                        │
│      ↓                                                           │
│  [Deno Proxy Server] working-server.ts (Port 8001)              │
│      ↓                                                           │
│      └─► Forwards all /api/* requests to Production Worker      │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                                 ↓
                                 ↓ HTTPS
                                 ↓
┌──────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE EDGE NETWORK                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Cloudflare Worker]                                             │
│  URL: https://pitchey-api-prod.ndlovucavelle.workers.dev        │
│  File: src/worker-integrated.ts                                  │
│                                                                   │
│  Features:                                                        │
│  • Better Auth (Session-based authentication)                    │
│  • Request routing & middleware                                  │
│  • Rate limiting (KV namespace)                                  │
│  • WebSocket support (Durable Objects)                           │
│  • File storage (R2 buckets)                                     │
│  • Queue processing                                              │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                                 ↓
                                 ↓ PostgreSQL Protocol
                                 ↓
┌──────────────────────────────────────────────────────────────────┐
│                          NEON DATABASE                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Neon PostgreSQL]                                               │
│  Region: eu-west-2 (London)                                      │
│  Connection: Serverless driver (@neondatabase/serverless)        │
│  URL: postgresql://neondb_owner:***@ep-old-snow-abpr94lc...     │
│                                                                   │
│  Features:                                                        │
│  • Serverless PostgreSQL                                         │
│  • Auto-scaling                                                  │
│  • Connection pooling                                            │
│  • Raw SQL queries (no ORM)                                      │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

## 🔄 Request Flow Example

1. **Frontend (localhost:5173)** makes API call:
   ```javascript
   fetch('http://localhost:8001/api/pitches')
   ```

2. **Deno Proxy (localhost:8001)** intercepts and forwards:
   ```typescript
   // working-server.ts
   const workerUrl = "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches"
   const response = await fetch(workerUrl, { headers, body })
   ```

3. **Cloudflare Worker** receives request:
   ```typescript
   // worker-integrated.ts
   export default {
     async fetch(request: Request, env: Env) {
       // Authenticate via Better Auth
       // Query Neon database
       const db = createDatabase(env.DATABASE_URL)
       const pitches = await db.query('SELECT * FROM pitches')
       return Response.json({ success: true, data: pitches })
     }
   }
   ```

4. **Neon Database** executes query:
   - Uses serverless PostgreSQL
   - Returns results via secure connection
   - No direct connection from localhost

## 🚀 GitHub Actions CI/CD Pipeline

```yaml
# .github/workflows/deploy-production.yml
1. Push to main branch
2. GitHub Actions triggered
3. Run tests (frontend + backend)
4. Run database migrations on Neon
5. Build frontend (npm run build)
6. Deploy Worker (wrangler deploy)
7. Deploy frontend to Cloudflare Pages
```

## 🔑 Key Points

### Why This Architecture?

1. **Security**: Localhost never connects directly to production database
2. **Consistency**: Same API endpoints work locally and in production
3. **Edge-first**: Cloudflare Workers run at edge locations globally
4. **Serverless**: No servers to manage, automatic scaling
5. **Cost-effective**: Pay only for what you use

### Local Development Flow
- **Frontend**: React app with Vite HMR (Hot Module Replacement)
- **Proxy**: Deno server forwards API calls to production Worker
- **No local database**: Uses production data safely through Worker API
- **Environment separation**: Different auth sessions for local vs production

### Production Flow
- **Frontend**: Cloudflare Pages (CDN distributed)
- **API**: Cloudflare Workers (edge computing)
- **Database**: Neon PostgreSQL (serverless, auto-scaling)
- **Cache**: Upstash Redis (global distributed cache)
- **Storage**: Cloudflare R2 (S3-compatible object storage)

## 📦 Technology Stack

### Frontend
- React 18 with TypeScript
- Vite for development/building
- TailwindCSS for styling
- Better Auth for authentication

### Backend (Cloudflare Worker)
- TypeScript
- Hono/Oak-style routing
- Raw SQL with Neon serverless driver
- No ORM (direct SQL queries)

### Infrastructure
- **Database**: Neon PostgreSQL (serverless)
- **Hosting**: Cloudflare (Workers + Pages)
- **Cache**: Upstash Redis
- **Storage**: Cloudflare R2
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry

## 🔐 Authentication Flow

1. **Login**: POST to `/api/auth/sign-in`
2. **Session**: Stored in HTTP-only cookie
3. **Worker**: Validates session on each request
4. **Database**: Sessions stored in Neon `sessions` table
5. **No JWT**: Pure session-based auth via Better Auth

## 📊 Database Connection Details

```typescript
// How Worker connects to Neon
import { neon } from '@neondatabase/serverless'

const sql = neon(env.DATABASE_URL)
const results = await sql`SELECT * FROM pitches WHERE status = 'published'`
```

- Connection pooling handled by Neon
- Automatic retries on connection failure
- Read replicas for scaling (if configured)
- SQL queries cached in Upstash Redis

## 🎯 Summary

**Your localhost setup:**
1. ✅ Frontend (5173) → Proxy (8001) → Worker API → Neon DB
2. ✅ No direct database connection from localhost
3. ✅ Production Worker handles all database queries
4. ✅ GitHub Actions deploys to Cloudflare on push to main
5. ✅ Completely serverless, edge-first architecture

This is a modern **Jamstack** architecture using the **Cloudflare Workers** pattern, where your local development safely proxies through the production API layer without needing local database setup.