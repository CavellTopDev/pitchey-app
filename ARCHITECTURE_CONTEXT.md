# System Context: Pitchey Platform Architecture

You are working with a production movie pitch marketplace platform called "Pitchey" that has the following architecture:

## Current Stack
- Frontend: React + Vite SPA deployed on Cloudflare Pages (https://pitchey-5o8.pages.dev)
- API Layer: Cloudflare Worker (https://pitchey-api-prod.ndlovucavelle.workers.dev) proxying to Deno backend
- Backend: Deno/TypeScript runtime on Deno Deploy (https://pitchey-backend-fresh.deno.dev) - progressive migration to Workers underway
- Database: Neon PostgreSQL (55+ tables) with Hyperdrive connection pooling (ID: 983d4a1818264b5dbdca26bacf167dee)
- ORM: Drizzle ORM for type-safe database operations
- Caching: Upstash Redis (Deno) + Cloudflare KV (Worker)
- Edge Services:
  - Cloudflare KV for distributed caching
  - R2 for file storage (bucket: pitchey-uploads)
  - Durable Objects for WebSocket/real-time features (planned)

## Key Configuration Files
- wrangler.toml - Worker configuration with KV, R2, Hyperdrive bindings
- deno.json - Deno configuration and import maps
- frontend/vite.config.ts - Vite build with optimized chunking
- frontend/.env.production - Frontend environment variables
- CLAUDE.md - Project-specific instructions

## CI/CD Pipeline
- GitHub Actions workflows: deploy.yml (Deno/cloudflare-pages), deploy-cloudflare.yml (Cloudflare)
- Auto-deploys to Cloudflare on push to main branch
- Separate deployment stages for Worker and Pages
- Preview deployments on pull requests
- Environment variables managed via GitHub Secrets and Cloudflare dashboard

## Database Schema Management
- Drizzle ORM configuration in drizzle.config.ts
- Schema definitions in src/db/schema.ts (single file, 55+ tables)
- Migrations in drizzle/ folder
- Schema push/migrate commands via Drizzle Kit
- Connection through Neon serverless driver with connection pooling

## Key Technical Details
- Multi-portal authentication system (creators, investors, production companies)
- JWT-based authentication with portal-specific endpoints
- WebSocket support for real-time features (notifications, draft sync, presence)
- CORS configuration for cross-origin requests
- Environment variables prefixed with VITE_ for frontend
- Worker environment bindings for KV, R2, Hyperdrive, and secrets
- Backend ALWAYS runs on PORT 8001 locally

## Current Migration Status
- Phase 0: ✅ Complete - Frontend on Pages, Worker proxy to Deno
- Phase 1: In Progress - Moving read-heavy endpoints to Workers
- Phase 2: Planned - Authentication migration to edge
- Phase 3: Planned - Write operations migration
- Phase 4: Planned - WebSocket via Durable Objects

## Known Issues (CLIENT_FEEDBACK_REQUIREMENTS.md)
- Investor portal sign-out functionality broken
- Browse section tabs showing mixed content
- NDA workflow unclear/non-functional
- Access control: Investors incorrectly able to create pitches

## Common Commands
```bash
# Database operations
npm run db:push          # Push schema changes to Neon
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio GUI

# Deployment
git push origin main     # Triggers GitHub Actions deployment
wrangler deploy --env production  # Manual Worker deploy

# Local development
cd frontend && npm run dev       # Start Vite dev server (port 5173)
PORT=8001 deno run --allow-all working-server.ts  # Deno backend (MUST be port 8001)
wrangler dev             # Start Worker locally with bindings

# Monitoring
wrangler tail --env production   # Live Worker logs
wrangler kv:key list --binding CACHE  # View KV cache entries
```

## Environment Configuration
- Frontend API URL: VITE_API_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev
- Database: Neon PostgreSQL via Hyperdrive binding (ID: 983d4a1818264b5dbdca26bacf167dee)
- JWT secrets: Managed through wrangler secret put JWT_SECRET
- KV namespace: Bound as CACHE (ID: 98c88a185eb448e4868fcc87e458b3ac)
- R2 bucket: Bound as R2_BUCKET (pitchey-uploads)

## Demo Accounts (password: Demo123)
- Creator: alex.creator@demo.com
- Investor: sarah.investor@demo.com
- Production: stellar.production@demo.com

## Guidance for Assistance
1. Type safety with Drizzle ORM and TypeScript
2. Edge-first architecture patterns
3. Progressive migration strategy maintaining zero downtime
4. Cloudflare Worker constraints and best practices
5. Database connection pooling through Hyperdrive
6. Global CDN and edge caching strategies
7. PORT 8001 requirement for local backend development
8. WebSocket currently proxied, Durable Objects migration planned
