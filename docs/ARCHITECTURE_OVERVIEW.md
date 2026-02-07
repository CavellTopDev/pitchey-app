# Pitchey - Full Architecture Overview

> Last updated: February 2026

## High-Level System Diagram

```
                         ┌─────────────────────────────────┐
                         │           USERS                  │
                         │  Creators · Investors · Studios  │
                         └───────────────┬─────────────────┘
                                         │
                                    HTTPS/WSS
                                         │
                    ┌────────────────────┴────────────────────┐
                    │          CLOUDFLARE EDGE NETWORK         │
                    │                                          │
                    │  ┌──────────────┐  ┌──────────────────┐ │
                    │  │  CF Pages    │  │  CF Worker        │ │
                    │  │  (Frontend)  │  │  (Backend API)    │ │
                    │  │  React SPA   │  │  117+ endpoints   │ │
                    │  └──────┬───────┘  └──┬───┬───┬───┬───┘ │
                    │         │             │   │   │   │      │
                    │  ┌──────┴───┐ ┌───┴───┐ ┌┴───┴┐ ┌┴────┐ │
                    │  │ KV Store │ │Durable│ │ R2  │ │Queue│ │
                    │  │ (Cache)  │ │Objects│ │(S3) │ │(Async│ │
                    │  └──────────┘ └───────┘ └─────┘ └─────┘ │
                    └────────────────────┬─────────────────────┘
                                         │
                         ┌───────────────┼───────────────┐
                    ┌────┴────┐   ┌──────┴─────┐  ┌──────┴──────┐
                    │  Neon   │   │  Upstash   │  │   Sentry    │
                    │PostgreSQL│   │  Redis     │  │  (Errors)   │
                    │ (PG 17) │   │  (Cache)   │  │             │
                    └─────────┘   └────────────┘  └─────────────┘
```

---

## Three-Portal Architecture

Pitchey serves three distinct user portals, each with its own dashboard and feature set:

```
                    ┌──────────────────────────────────┐
                    │        PITCHEY PLATFORM           │
                    ├──────────┬───────────┬────────────┤
                    │ CREATOR  │ INVESTOR  │ PRODUCTION │
                    ├──────────┼───────────┼────────────┤
                    │• Pitches │• Portfolio│• Projects  │
                    │• Revenue │• Deals    │• Talent    │
                    │• NDAs    │• Watchlist│• Budget    │
                    │• Contracts│• Metrics │• Schedule  │
                    │• Analytics│• Browse  │• Pipeline  │
                    └──────────┴───────────┴────────────┘
                         Better Auth (session cookies)
                         RBAC enforcement per portal
```

---

## Frontend Architecture

```
frontend/src/
├── pages/          40+ route components (creator/, investor/, production/, admin/)
├── components/     40+ feature dirs (Dashboard, Browse, PitchForm, NDA...)
├── store/          Zustand stores (betterAuthStore, pitchStore, sessionCache)
├── services/       36 API client files (auth, pitch, upload, websocket...)
├── hooks/          17+ custom hooks (useDraftSync, useNotifications...)
└── types/          TypeScript definitions (domain types, websocket, api)
```

**Stack**: React 18 + React Router 7 + Vite 7 + TailwindCSS + Zustand + Radix UI

---

## Backend Architecture

```
src/worker-integrated.ts   <- Single 15K-line Cloudflare Worker entry point

Request Pipeline:
  Tracing -> CORS -> WebSocket detect -> Health check -> Session auth
  -> RBAC portal check -> Rate limit -> Route match -> Handler -> Response

src/
├── handlers/       47 files (dashboard, NDA, notification handlers)
├── routes/         24 files (creator, investor, production, pitches, ndas)
├── middleware/     28 files (RBAC, rate limit, security, cache)
├── services/      100+ files (business logic, WebSocket, uploads)
├── auth/          Better Auth with raw SQL adapter
├── db/            Neon PostgreSQL connection, migrations, queries
└── durable-objects/  WebSocket rooms, notification hub
```

---

## Request Lifecycle

```
  Browser                 CF Edge                  Worker                 Neon DB
    │                       │                        │                      │
    │──── GET /api/... ────>│                        │                      │
    │                       │──── Route to Worker ──>│                      │
    │                       │                        │── Check KV cache ──> │
    │                       │                        │<── cache miss ──────│
    │                       │                        │                      │
    │                       │                        │── Validate session ─>│
    │                       │                        │<── user object ─────│
    │                       │                        │                      │
    │                       │                        │── RBAC check         │
    │                       │                        │── Rate limit check   │
    │                       │                        │                      │
    │                       │                        │── SQL query ────────>│
    │                       │                        │<── result rows ─────│
    │                       │                        │                      │
    │                       │                        │── Cache in KV        │
    │                       │<── JSON response ─────│                      │
    │<── response ─────────│                        │                      │
```

---

## Authentication Flow

```
  Browser                Worker                Better Auth           Neon DB
    │                       │                     │                    │
    │ POST /api/auth/sign-in                      │                    │
    │ {email, password}     │                     │                    │
    │──────────────────────>│                     │                    │
    │                       │─── validate ───────>│                    │
    │                       │                     │── SELECT user ────>│
    │                       │                     │<── user row ──────│
    │                       │                     │── bcrypt verify    │
    │                       │                     │── INSERT session──>│
    │                       │<── session token ──│                    │
    │                       │                     │                    │
    │ Set-Cookie: pitchey-session=xxx             │                    │
    │ (HttpOnly, Secure, SameSite=None)           │                    │
    │<──────────────────────│                     │                    │
```

---

## Caching Strategy (Multi-Layer)

```
                    Request arrives
                         │
                    ┌────▼────┐
               ┌────│In-Memory│  <- fastest (module-level)
               │    │ Cache   │
               │    └────┬────┘
               │    miss │
               │    ┌────▼────┐
               │    │  CF KV  │  <- edge (300s TTL)
          hit  │    │ (Edge)  │
               │    └────┬────┘
               │    miss │
               │    ┌────▼────┐
               │    │ Upstash │  <- global (5-min TTL)
               │    │ Redis   │
               │    └────┬────┘
               │    miss │
               │    ┌────▼────┐
               │    │ Neon    │  <- persistent source of truth
               │    │Postgres │
               │    └─────────┘
               │
               └──> Return cached data
```

---

## Real-Time (WebSocket) Architecture

```
  Client A          Client B           CF Worker        Durable Object
     │                  │                  │              (WebSocketRoom)
     │── ws connect ───>│                  │                  │
     │                  │                  │── upgrade ──────>│
     │                  │                  │<── 101 ─────────│
     │<── connected ───│                  │                  │
     │                  │── ws connect ───>│                  │
     │                  │                  │── upgrade ──────>│
     │                  │                  │<── 101 ─────────│
     │                  │<── connected ───│                  │
     │                  │                  │                  │
     │── send message ─>│                  │                  │
     │                  │                  │── forward ──────>│
     │                  │                  │                  │── broadcast
     │<── message ─────│                  │<── fan out ─────│
     │                  │<── message ─────│                  │
```

Features: notifications, draft auto-sync (5s), presence tracking, typing indicators, offline message queuing.

---

## Live Database Summary

**Project**: `pitchey-production` | **Region**: AWS eu-west-2 | **PostgreSQL 17**
**Total size**: ~93 MB | **Tables**: 163 | **1 View** (`pitch_analytics_summary`)

### Table Inventory by Domain

```
┌──────────────────────┬────────┬──────────────────────────────────┐
│  DOMAIN              │ TABLES │ KEY TABLES                       │
├──────────────────────┼────────┼──────────────────────────────────┤
│  Core Identity       │   7    │ users (10 rows, 376 kB)          │
│                      │        │ sessions, accounts, roles        │
│                      │        │ user_roles, permissions           │
├──────────────────────┼────────┼──────────────────────────────────┤
│  Pitches & Content   │  16    │ pitches (8 rows, 1.5 MB)         │
│                      │        │ pitch_views, pitch_likes,        │
│                      │        │ pitch_comments, pitch_documents   │
│                      │        │ pitch_versions, pitch_templates   │
├──────────────────────┼────────┼──────────────────────────────────┤
│  NDA & Legal         │   9    │ ndas (5 rows, 320 kB)            │
│                      │        │ nda_requests, nda_templates      │
│                      │        │ nda_documents, nda_audit_log     │
│                      │        │ enhanced_ndas, legal_compliance  │
├──────────────────────┼────────┼──────────────────────────────────┤
│  Investment          │  12    │ investments, investment_deals     │
│                      │        │ investment_interests, portfolio   │
│                      │        │ investor_watchlist, deals         │
│                      │        │ investment_documents              │
├──────────────────────┼────────┼──────────────────────────────────┤
│  Production          │   9    │ production_companies, projects    │
│                      │        │ production_budgets, crew, talent  │
│                      │        │ production_deals, schedules       │
├──────────────────────┼────────┼──────────────────────────────────┤
│  Messaging           │   8    │ messages (240 kB), conversations  │
│                      │        │ chat_rooms, typing_indicators     │
│                      │        │ realtime_messages, voice_notes    │
├──────────────────────┼────────┼──────────────────────────────────┤
│  Notifications       │   5    │ notifications (7 rows, 248 kB)   │
│                      │        │ notification_preferences          │
│                      │        │ workflow_notifications             │
├──────────────────────┼────────┼──────────────────────────────────┤
│  Analytics & Logs    │  16    │ request_logs (124K rows, 31 MB)  │
│                      │        │ analytics_events, error_logs      │
│                      │        │ audit_logs, page_views            │
│                      │        │ search_analytics, performance     │
├──────────────────────┼────────┼──────────────────────────────────┤
│  Teams               │   5    │ teams, team_members               │
│                      │        │ team_invitations, team_pitches    │
├──────────────────────┼────────┼──────────────────────────────────┤
│  Email               │   7    │ email_queue, email_alerts         │
│                      │        │ email_campaigns, email_events     │
│                      │        │ email_preferences                 │
├──────────────────────┼────────┼──────────────────────────────────┤
│  Payments            │   7    │ payments, subscriptions           │
│                      │        │ invoices, transactions            │
│                      │        │ credit_transactions               │
├──────────────────────┼────────┼──────────────────────────────────┤
│  Files & Media       │   5    │ uploaded_files (112 kB), files    │
│                      │        │ media_files, file_access_logs     │
├──────────────────────┼────────┼──────────────────────────────────┤
│  System/Config       │  15+   │ feature_flags, rate_limit         │
│                      │        │ portal_configurations, cdn_cache  │
│                      │        │ trending_cache, sso_configs       │
└──────────────────────┴────────┴──────────────────────────────────┘
```

### Top Tables by Size

| Table | Rows | Size | Notes |
|---|---|---|---|
| `request_logs` | 123,733 | **31 MB** | API request logging (dominates storage) |
| `pitches` | 8 | 1.5 MB | Large due to 55 indexes + JSONB columns |
| `error_logs` | 248 | 400 kB | Error tracking |
| `users` | 10 | 376 kB | 90+ columns, 22 indexes |
| `ndas` | 5 | 320 kB | 19 indexes, NDA workflow state |
| `nda_requests` | 2 | 264 kB | NDA request pipeline |
| `notifications` | 7 | 248 kB | User notifications |
| `sessions` | 5 | 200 kB | Better Auth sessions |

### Entity Relationship Diagram (Core)

```
                              ┌──────────┐
                    ┌────────>│  users   │<──────────────┐
                    │         │ (10 rows)│               │
                    │         └──┬───┬───┘               │
                    │            │   │                    │
            ┌───────┴──┐   ┌────┴─┐ └────┐         ┌────┴────────┐
            │ sessions │   │follows│  │teams│        │ contracts   │
            │(BetterAuth)  └──────┘  └──┬──┘        │(milestones) │
            └──────────┘            ┌───┴───┐       └─────────────┘
                                    │team_  │
                              ┌─────│members│
                              │     └───────┘
                    ┌─────────┴───────┐
         ┌─────────┤    pitches      ├──────────┐
         │         │   (8 rows)      │          │
         │         └──┬──┬──┬──┬─────┘          │
         │            │  │  │  │                │
    ┌────┴───┐  ┌─────┴┐ │ ┌┴──┴──┐     ┌──────┴──────┐
    │ ndas   │  │pitch_│ │ │pitch_│     │investments  │
    │(5 rows)│  │views │ │ │likes │     │             │
    └────┬───┘  └──────┘ │ └──────┘     └──────┬──────┘
         │          ┌─────┴──┐            ┌────┴───────┐
    ┌────┴───────┐  │pitch_  │            │investment_ │
    │nda_requests│  │comments│            │deals       │
    │nda_audit   │  └────────┘            │portfolio   │
    │nda_docs    │                        │watchlist   │
    └────────────┘                        └────────────┘
                                               │
                              ┌─────────────────┤
                              │                 │
                    ┌─────────┴──┐    ┌─────────┴────────┐
                    │production_ │    │production_       │
                    │companies   │    │projects          │
                    │            │    │budgets, schedules│
                    └────────────┘    └──────────────────┘
```

### Foreign Key Hub

- `users` - referenced by 100+ foreign keys (nearly every table)
- `pitches` - referenced by 40+ foreign keys
- `ndas` - referenced by nda_audit_log, nda_documents, content_access, info_requests

### Key Table Schemas

**users** (90+ columns): identity, profile, auth, security (2FA, account lock, password history), subscription (Stripe integration), preferences (JSONB), analytics (UTM, device tracking), GDPR compliance, SSO/enterprise fields. Unique on email and username. 22 indexes including GIN trigram for fuzzy search.

**pitches** (100+ columns): content (title, logline, synopsis), media URLs (video, poster, lookbook, script), NDA-protected fields (budget_breakdown, financial_projections, distribution_plan, marketing_strategy, contact_details), AI fields (analysis_score, recommendations, sentiment_score), engagement counters (view_count, like_count, share_count), full-text search indexes (GIN trigram + tsvector with weighted search). 55 indexes.

**ndas** (28 columns): NDA type enum (basic/enhanced/custom), access_granted flag with revocation support, watermark configuration, digital signature tracking (hash, IP, user agent), approval workflow (approved_by, approved_at). Unique constraint on (pitch_id, signer_id). 19 indexes.

**sessions** (8 columns): Better Auth session management. VARCHAR id (not integer), user_id FK with CASCADE delete, token for lookup, expiry tracking. 4 indexes.

---

## CI/CD Pipeline

```
  git push -> ci-cd.yml -> Security Scan -> Frontend (lint+tsc+build) -> Worker (esbuild)
           -> DB validation -> Deploy (CF Pages + CF Workers) -> Integration health checks

  simple-health-check.yml -> runs every 30 min (uptime monitoring)
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + Vite 7 | SPA with hot reload |
| **Routing** | React Router 7 | Client-side routing |
| **State** | Zustand | Lightweight stores (no Redux) |
| **Styling** | TailwindCSS + Radix UI | Utility CSS + accessible primitives |
| **Auth** | Better Auth 1.4 | Session cookies (no JWT) |
| **Backend** | Cloudflare Worker | Edge serverless (single entry point) |
| **Database** | Neon PostgreSQL 17 | Serverless Postgres, raw SQL |
| **Cache L1** | CF KV | Edge key-value (300s TTL) |
| **Cache L2** | Upstash Redis | Global distributed cache |
| **Storage** | Cloudflare R2 | S3-compatible object store |
| **Real-time** | Durable Objects | WebSocket rooms + broadcast |
| **Errors** | Sentry | Error tracking and alerting |
| **CI/CD** | GitHub Actions | 12 workflows, auto-deploy |
| **Testing** | Vitest + Playwright | Unit and E2E tests |

---

## Key Architectural Decisions

1. **Single Worker monolith** - All 117+ API endpoints in one `worker-integrated.ts` file. Simple to deploy, but the file is 15K+ lines.
2. **No ORM** - Raw SQL via `postgres.js` / `@neondatabase/serverless` for maximum performance at the edge.
3. **Session cookies over JWT** - Migrated from JWT to Better Auth for better security (HTTP-only, no client-side token exposure).
4. **Edge-first caching** - 4-layer cache (memory -> KV -> Redis -> DB) keeps latency low globally.
5. **Durable Objects for WebSockets** - Enables stateful real-time features on Cloudflare's serverless platform.
6. **Three-portal RBAC** - Each user type has isolated routes and dashboard, enforced at middleware level.

---

## Notable Observations

1. **`request_logs` dominates storage** at 31 MB / 124K rows - consider rotation or archival.
2. **Index-heavy schema** - `pitches` has 55 indexes on only 8 rows (many duplicate/overlapping).
3. **`users` has 90+ columns** - a very wide table mixing profile, auth, billing, analytics, and enterprise fields.
4. **Low row counts** across all tables - early-stage with demo/test data.
5. **163 tables total** - extensive schema covering features not yet actively used (auctions, SSO, LDAP, voice notes, video calls).
