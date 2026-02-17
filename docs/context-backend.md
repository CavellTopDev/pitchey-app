# Backend Context — Pitchey

Cloudflare Worker handling all API routing, auth, database, caching, and storage.

## Architecture
- **Single Worker**: `src/worker-integrated.ts` — handles all routing via `wrangler deploy`
- **Build**: esbuild (`esbuild.config.js` at root)
- **Runtime**: Cloudflare Workers (V8 isolates, not Node.js)

## Authentication — Better Auth ONLY
- **Cookie-Based Sessions**: Secure HTTP-only cookies (`pitchey-session`)
- **No JWT Headers**: Authorization headers are NOT used
- **Unified Auth Flow**: Single system for all portal types
- Migrated from JWT to Better Auth in December 2024

### Primary Endpoints
- `POST /api/auth/sign-in` — unified sign-in
- `POST /api/auth/sign-up` — registration
- `POST /api/auth/sign-out` — logout
- `GET /api/auth/session` — session check
- `POST /api/auth/session/refresh` — refresh

### Portal-Specific (Backward Compatibility)
- `POST /api/auth/creator/login`
- `POST /api/auth/investor/login`
- `POST /api/auth/production/login`

### Demo Accounts (Password: Demo123)
- Creator: alex.creator@demo.com
- Investor: sarah.investor@demo.com
- Production: stellar.production@demo.com

## Database — Neon PostgreSQL
- **Raw SQL only** — no ORM, uses postgres.js client directly
- **Connection**: Neon pooler (`ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech`)
- **Migrations**: SQL scripts in `src/db/migrations/`, runner at `src/db/migrate.ts`
- **Edge Pooling**: Via Neon's built-in connection pooler
- 120+ API endpoints operational

### Notable Tables
- `calendar_events` — user-created events (columns: `start_date`/`end_date` as timestamp, `attendees` as jsonb, `color`, `reminder`)
- `pitch_engagement` — viewer tracking with `viewer_type` for audience breakdown

## Caching — Upstash Redis
- Global distributed Redis for session/notification caching
- Memory fallback when Redis is unavailable
- Dashboard metrics cached with 5-minute TTL
- Redis services use lazy-loaded getters to avoid static initialization issues

## Storage — Cloudflare R2
- S3-compatible object storage for documents, images, videos
- Accessed via Worker bindings (not HTTP API)

## Cloudflare Bindings
- **R2**: Object storage
- **KV**: Edge caching for frequently accessed data
- **WebSockets**: Via Workers (Durable Objects planned for future)

## RBAC
- Backend: `rbac.service.ts` — 50 permissions across 5 roles
- Roles: admin, creator, investor, production, viewer
- Frontend mirrors this via `usePermissions` hook + `PermissionGuard`

## Key Implementation Details
- All API endpoints route through Worker (no direct backend access)
- Raw SQL queries via postgres.js
- Error responses follow `{ success: false, error: { message: string } }` pattern
- Success responses follow `{ success: true, data: any }` pattern

## Commands
- Local dev: `wrangler dev` (runs on port 8787)
- Deploy: `wrangler deploy`
- Config: `wrangler.toml` at project root
