# Pitchey Platform Deployment Architecture

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Service Interaction Diagrams](#service-interaction-diagrams)
4. [Data Flow Architecture](#data-flow-architecture)
5. [Security Architecture](#security-architecture)
6. [Performance Optimization Architecture](#performance-optimization-architecture)
7. [Scalability Design](#scalability-design)
8. [Backup and Recovery Architecture](#backup-and-recovery-architecture)
9. [Monitoring and Observability](#monitoring-and-observability)
10. [Cost Optimization Strategy](#cost-optimization-strategy)

## Executive Summary

The Pitchey platform leverages a modern serverless architecture combining Cloudflare's edge network, Deno Deploy's runtime, and Neon's serverless PostgreSQL to deliver a highly scalable, performant, and cost-effective movie pitch platform. This architecture supports three distinct user portals (Creator, Investor, Production), real-time WebSocket communications, and comprehensive content management capabilities.

### Key Architectural Decisions

- **Edge-First Design**: Cloudflare Workers handle initial request processing at the edge
- **Progressive Enhancement**: Gradual migration from monolithic to microservices
- **Serverless Everything**: No managed servers, automatic scaling
- **Global Distribution**: Content served from 200+ edge locations
- **Zero Egress Costs**: R2 storage eliminates bandwidth charges

## System Architecture Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GLOBAL USER BASE                             │
│     Creators (US/EU/APAC) | Investors | Production Companies         │
└──────────────┬──────────────────────────────────┬──────────────────┘
               │                                  │
               ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE GLOBAL NETWORK                         │
│                         (200+ PoPs Worldwide)                        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Cloudflare     │  │   Cloudflare     │  │   Cloudflare     │  │
│  │    Pages        │  │    Workers       │  │   R2 Storage     │  │
│  │  (Frontend)     │  │  (API Gateway)   │  │  (File Storage)  │  │
│  └────────┬────────┘  └────────┬─────────┘  └──────────────────┘  │
│           │                    │                                    │
│  ┌────────▼────────────────────▼─────────────────────────────────┐ │
│  │              Cloudflare Edge Services                          │ │
│  │  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐    │ │
│  │  │    KV    │  │   Durable    │  │    Hyperdrive       │    │ │
│  │  │  Store   │  │   Objects    │  │  (DB Connection     │    │ │
│  │  │ (Cache)  │  │  (WebSocket) │  │     Pooling)        │    │ │
│  │  └──────────┘  └──────────────┘  └─────────────────────┘    │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ HTTPS/WSS
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      APPLICATION TIER                                │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Deno Deploy                               │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │   │
│  │  │   REST API  │  │  WebSocket   │  │   Background     │  │   │
│  │  │   Server    │  │    Server    │  │     Jobs         │  │   │
│  │  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘  │   │
│  │         │                 │                   │             │   │
│  │  ┌──────▼─────────────────▼───────────────────▼─────────┐  │   │
│  │  │              Business Logic Layer                     │  │   │
│  │  │  Auth | Pitches | NDAs | Messages | Analytics        │  │   │
│  │  └───────────────────────┬───────────────────────────────┘  │   │
│  │                          │                                  │   │
│  │  ┌───────────────────────▼───────────────────────────────┐  │   │
│  │  │              Data Access Layer (Drizzle ORM)          │  │   │
│  │  └───────────────────────┬───────────────────────────────┘  │   │
│  └───────────────────────────┼─────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ PostgreSQL/Redis
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA TIER                                    │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────┐        ┌────────────────────────────┐  │
│  │   Neon PostgreSQL      │        │    Upstash Redis          │  │
│  │  ┌──────────────────┐  │        │  ┌──────────────────────┐ │  │
│  │  │   Primary DB     │  │        │  │  Distributed Cache   │ │  │
│  │  │  ┌────────────┐  │  │        │  │  ┌────────────────┐ │ │  │
│  │  │  │   Tables   │  │  │        │  │  │  Session Data  │ │ │  │
│  │  │  │  - users   │  │  │        │  │  │  Dashboard     │ │ │  │
│  │  │  │  - pitches │  │  │        │  │  │  Metrics       │ │ │  │
│  │  │  │  - ndas    │  │  │        │  │  │  Query Cache   │ │ │  │
│  │  │  │  - messages│  │  │        │  │  │  Rate Limits   │ │ │  │
│  │  │  └────────────┘  │  │        │  │  └────────────────┘ │ │  │
│  │  └──────────────────┘  │        │  └──────────────────────┘ │  │
│  └────────────────────────┘        └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### Frontend Layer (Cloudflare Pages)
- **Purpose**: Serve static React application
- **Technologies**: React, TypeScript, Vite, Tailwind CSS
- **Features**:
  - Server-side rendering capabilities
  - Automatic code splitting
  - Progressive Web App support
  - Offline functionality with service workers

#### API Gateway Layer (Cloudflare Workers)
- **Purpose**: Edge request processing and routing
- **Responsibilities**:
  - Request validation and sanitization
  - Authentication token verification
  - Rate limiting and DDoS protection
  - Response caching
  - Request proxying to backend

#### Application Layer (Deno Deploy)
- **Purpose**: Core business logic and processing
- **Responsibilities**:
  - User authentication and authorization
  - Business rule enforcement
  - Database operations
  - WebSocket connection management
  - Email notifications (queued)
  - Background job processing

#### Data Layer
- **Primary Database (Neon PostgreSQL)**:
  - User data and authentication
  - Pitch content and metadata
  - NDA agreements and workflows
  - Messaging and notifications
  - Analytics events

- **Cache Layer (Upstash Redis)**:
  - Session management
  - Dashboard metrics (5-min TTL)
  - API response caching
  - Rate limiting counters
  - WebSocket room states

## Service Interaction Diagrams

### Authentication Flow

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Client  │      │  Worker  │      │   Deno   │      │   Neon   │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                  │                  │                  │
     │ POST /login      │                  │                  │
     ├─────────────────►│                  │                  │
     │                  │ Validate request │                  │
     │                  ├─────────────────►│                  │
     │                  │                  │ Query user       │
     │                  │                  ├─────────────────►│
     │                  │                  │◄─────────────────┤
     │                  │                  │ User data        │
     │                  │                  │                  │
     │                  │                  │ Verify password  │
     │                  │                  │ Generate JWT     │
     │                  │◄─────────────────┤                  │
     │                  │ Cache token      │                  │
     │◄─────────────────┤                  │                  │
     │ JWT + User data  │                  │                  │
     │                  │                  │                  │
```

### Pitch Creation Flow

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Client  │      │  Worker  │      │   Deno   │      │   Neon   │      │    R2    │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                  │                  │                  │                  │
     │ POST /pitches    │                  │                  │                  │
     ├─────────────────►│                  │                  │                  │
     │                  │ Auth check       │                  │                  │
     │                  ├─────────────────►│                  │                  │
     │                  │                  │ Validate data    │                  │
     │                  │                  │                  │                  │
     │                  │                  │ Begin transaction│                  │
     │                  │                  ├─────────────────►│                  │
     │                  │                  │                  │                  │
     │ Upload files     │                  │                  │                  │
     ├─────────────────►│                  │                  │                  │
     │                  │ Store in R2      │                  │                  │
     │                  ├──────────────────┼──────────────────┼─────────────────►│
     │                  │◄─────────────────┼──────────────────┼──────────────────┤
     │                  │ File URLs        │                  │                  │
     │                  │                  │                  │                  │
     │                  │ Save pitch       │                  │                  │
     │                  ├─────────────────►│                  │                  │
     │                  │                  │ Insert pitch     │                  │
     │                  │                  ├─────────────────►│                  │
     │                  │                  │◄─────────────────┤                  │
     │                  │                  │ Pitch ID         │                  │
     │                  │                  │                  │                  │
     │                  │                  │ Commit           │                  │
     │                  │                  ├─────────────────►│                  │
     │                  │◄─────────────────┤                  │                  │
     │                  │ Invalidate cache │                  │                  │
     │◄─────────────────┤                  │                  │                  │
     │ Success + ID     │                  │                  │                  │
```

### WebSocket Real-time Flow

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│ Client A │      │  Durable │      │   Deno   │      │  Redis   │      │ Client B │
└────┬─────┘      │  Object  │      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │            └────┬─────┘            │                  │                  │
     │ WSS Connect     │                  │                  │                  │
     ├────────────────►│                  │                  │                  │
     │                 │ Auth + Room Join │                  │                  │
     │                 ├─────────────────►│                  │                  │
     │                 │                  │ Store presence   │                  │
     │                 │                  ├─────────────────►│                  │
     │                 │◄─────────────────┤                  │                  │
     │◄────────────────┤ Connected        │                  │                  │
     │                 │                  │                  │                  │
     │ Send message    │                  │                  │                  │
     ├────────────────►│                  │                  │                  │
     │                 │ Broadcast        │                  │                  │
     │                 ├─────────────────►│                  │                  │
     │                 │                  │ Pub/Sub          │                  │
     │                 │                  ├─────────────────►│                  │
     │                 │                  │                  ├─────────────────►│
     │                 │                  │                  │ Receive message │
     │                 │◄─────────────────┼──────────────────┼──────────────────┤
     │◄────────────────┤ Echo back        │                  │ Broadcast       │
```

## Data Flow Architecture

### Request Processing Pipeline

```
                    ┌─────────────────────────────────┐
                    │     Incoming HTTP Request       │
                    └────────────┬────────────────────┘
                                 │
                    ┌────────────▼────────────────────┐
                    │   Cloudflare Edge (Worker)      │
                    │  ┌────────────────────────────┐ │
                    │  │  1. DDoS Protection        │ │
                    │  │  2. Rate Limiting          │ │
                    │  │  3. Geo-blocking           │ │
                    │  └────────────┬───────────────┘ │
                    │               │                  │
                    │  ┌────────────▼───────────────┐ │
                    │  │  Request Validation        │ │
                    │  │  - Header checks           │ │
                    │  │  - Body validation         │ │
                    │  │  - Auth token verification  │ │
                    │  └────────────┬───────────────┘ │
                    │               │                  │
                    │  ┌────────────▼───────────────┐ │
                    │  │  Cache Check (KV)          │ │
                    │  │  - Response cache          │ │
                    │  │  - Static assets           │ │
                    │  └─────┬──────┴───────────────┘ │
                    └─────────┼────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Cache Hit?       │
                    └─────┬──────┬───────┘
                          │ No   │ Yes
                          │      │
           ┌──────────────▼──┐   └────────────┐
           │  Proxy to Deno  │                │
           └─────────┬───────┘    ┌───────────▼──────────┐
                     │             │   Return Cached      │
           ┌─────────▼───────────┐ │   Response          │
           │   Deno Deploy       │ └──────────────────────┘
           │  ┌────────────────┐ │
           │  │ Business Logic │ │
           │  └───────┬────────┘ │
           │          │          │
           │  ┌───────▼────────┐ │
           │  │ Database Query │ │
           │  └───────┬────────┘ │
           └──────────┼──────────┘
                      │
           ┌──────────▼──────────┐
           │  Response Pipeline  │
           │  1. Cache update    │
           │  2. Headers         │
           │  3. Compression     │
           └─────────────────────┘
```

### Data Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Data Storage Layers                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  HOT STORAGE (Frequently Accessed)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Cloudflare KV                                       │   │
│  │  - User sessions (24hr TTL)                         │   │
│  │  - API responses (5min TTL)                         │   │
│  │  - Static content (1hr TTL)                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  WARM STORAGE (Active Data)                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Upstash Redis                                      │   │
│  │  - Dashboard metrics                                │   │
│  │  - WebSocket room states                           │   │
│  │  - Rate limiting counters                          │   │
│  │  - Query result cache                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  PERSISTENT STORAGE (Source of Truth)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Neon PostgreSQL                                    │   │
│  │  ┌───────────────────────────────────────────────┐ │   │
│  │  │  Transactional Data                          │ │   │
│  │  │  - Users, Pitches, NDAs                      │ │   │
│  │  │  - Messages, Notifications                   │ │   │
│  │  │  - Analytics Events                          │ │   │
│  │  └───────────────────────────────────────────────┘ │   │
│  │  ┌───────────────────────────────────────────────┐ │   │
│  │  │  Indexes for Performance                     │ │   │
│  │  │  - user_email_idx                           │ │   │
│  │  │  - pitch_status_idx                         │ │   │
│  │  │  - nda_user_compound_idx                    │ │   │
│  │  └───────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  COLD STORAGE (Files & Backups)                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Cloudflare R2                                      │   │
│  │  - Pitch documents (PDFs, images)                   │   │
│  │  - User uploads                                     │   │
│  │  - Database backups                                 │   │
│  │  - System logs                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Security Architecture

### Defense in Depth Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                   Security Layers                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: Network Security (Cloudflare)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • DDoS Protection (Automatic)                      │   │
│  │  • WAF Rules (OWASP Top 10)                        │   │
│  │  • Bot Management                                   │   │
│  │  • SSL/TLS Encryption (Force HTTPS)                 │   │
│  │  • Geo-blocking (Country restrictions)             │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│  Layer 2: Application Security (Worker)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • Rate Limiting (100 req/min per IP)              │   │
│  │  • CORS Policy (Strict origin checking)            │   │
│  │  • CSP Headers (Content Security Policy)           │   │
│  │  • Input Validation (Schema-based)                 │   │
│  │  • Request Sanitization                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│  Layer 3: Authentication & Authorization (Deno)             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • JWT Token Validation (HS256)                    │   │
│  │  • Role-Based Access Control (RBAC)               │   │
│  │  • Portal-Specific Permissions                     │   │
│  │  • Session Management                              │   │
│  │  • Password Hashing (Argon2)                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│  Layer 4: Data Security (Database)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • Encryption at Rest (AES-256)                    │   │
│  │  • Encryption in Transit (TLS 1.3)                 │   │
│  │  • Row-Level Security (RLS)                        │   │
│  │  • Audit Logging                                   │   │
│  │  • Backup Encryption                               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Authentication & Authorization Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Request    │────►│   Validate   │────►│   Check      │
│   with JWT   │     │   JWT Token  │     │   Permissions│
└──────────────┘     └──────┬───────┘     └──────┬───────┘
                             │                     │
                    ┌────────▼───────┐    ┌───────▼──────┐
                    │  Token Invalid │    │ Permission   │
                    │  Return 401    │    │ Denied       │
                    └────────────────┘    │ Return 403   │
                                         └──────────────┘
                             │
                    ┌────────▼───────┐
                    │  Valid Request │
                    │  Process       │
                    └────────────────┘
```

### Security Headers Configuration

```javascript
// Applied at Worker level
const SECURITY_HEADERS = {
  'Content-Security-Policy': 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://pitchey-api-production.cavelltheleaddev.workers.dev wss://pitchey-backend-fresh.deno.dev; " +
    "font-src 'self' data:; " +
    "object-src 'none'; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "upgrade-insecure-requests",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};
```

## Performance Optimization Architecture

### Caching Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Layer Cache                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Browser Cache (Client-side)                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • Static Assets: 1 year                           │   │
│  │  • API Responses: Cache-Control headers            │   │
│  │  • Service Worker: Offline support                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│  CDN Cache (Cloudflare Edge)                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • HTML Pages: 5 minutes                           │   │
│  │  • CSS/JS: 1 month                                 │   │
│  │  • Images: 1 year                                  │   │
│  │  • API Responses: Vary by endpoint                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│  Application Cache (KV Store)                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • User Sessions: 24 hours                         │   │
│  │  • Dashboard Data: 5 minutes                       │   │
│  │  • Public Pitches: 10 minutes                      │   │
│  │  • Search Results: 10 minutes                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│  Database Cache (Redis)                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • Query Results: 5 minutes                        │   │
│  │  • Computed Metrics: 5 minutes                     │   │
│  │  • User Preferences: Session lifetime              │   │
│  │  • Rate Limit Counters: 1 minute                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Database Optimization

```sql
-- Key Performance Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_pitches_creator ON pitches(creator_id);
CREATE INDEX idx_pitches_status ON pitches(status);
CREATE INDEX idx_pitches_created ON pitches(created_at DESC);
CREATE INDEX idx_ndas_pitch_user ON ndas(pitch_id, user_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_analytics_user_event ON analytics_events(user_id, event_type, created_at);

-- Composite Indexes for Common Queries
CREATE INDEX idx_pitch_search ON pitches(status, genre, budget_range) 
  WHERE status = 'published';
CREATE INDEX idx_user_dashboard ON pitches(creator_id, status, created_at DESC);
CREATE INDEX idx_investor_portfolio ON investments(investor_id, status);
```

### Hyperdrive Connection Pooling

```
┌─────────────────────────────────────────────────────┐
│              Hyperdrive Architecture                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Worker Requests                                     │
│     │  │  │  │                                      │
│     ▼  ▼  ▼  ▼                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │         Hyperdrive Pool Manager              │  │
│  │  ┌────────────────────────────────────────┐ │  │
│  │  │  Connection Pool (Size: 100)          │ │  │
│  │  │  • Min Connections: 10                │ │  │
│  │  │  • Max Connections: 100               │ │  │
│  │  │  • Idle Timeout: 30s                  │ │  │
│  │  │  • Connection Lifetime: 1hr           │ │  │
│  │  └────────────────────────────────────────┘ │  │
│  │                                              │  │
│  │  ┌────────────────────────────────────────┐ │  │
│  │  │  Query Queue & Multiplexing           │ │  │
│  │  │  • Statement Caching                  │ │  │
│  │  │  • Prepared Statements                │ │  │
│  │  │  • Connection Reuse                   │ │  │
│  │  └────────────────────────────────────────┘ │  │
│  └──────────────┬───────────────────────────────┘  │
│                 │                                    │
│                 ▼                                    │
│     Neon PostgreSQL (Single Connection)             │
└─────────────────────────────────────────────────────┘
```

## Scalability Design

### Horizontal Scaling Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Auto-Scaling Components                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Cloudflare Workers (Automatic Scaling)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Load < 1000 req/s:  1 instance per PoP            │   │
│  │  Load > 1000 req/s:  Auto-scale to N instances     │   │
│  │  Max Capacity:       10M+ requests/second          │   │
│  │  Geographic:         200+ locations worldwide      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Deno Deploy (Automatic Scaling)                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Regions:            35 global regions             │   │
│  │  Auto-scale:         Based on CPU/Memory           │   │
│  │  Max Instances:      Unlimited                     │   │
│  │  Cold Start:         < 100ms                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Neon PostgreSQL (Serverless Scaling)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Compute:            0.25 - 7 CPU                  │   │
│  │  Memory:             1GB - 28GB                    │   │
│  │  Storage:            Unlimited                     │   │
│  │  Auto-suspend:       After 5min idle               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Upstash Redis (Serverless Scaling)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Regions:            Global replication            │   │
│  │  Throughput:         10K - 1M ops/sec             │   │
│  │  Storage:            256MB - 100GB                 │   │
│  │  Availability:       99.99% SLA                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Load Distribution Strategy

```
                    Global Load Balancer
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    US-WEST           US-EAST            EU-WEST
         │                 │                 │
    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
    │ Worker  │      │ Worker  │      │ Worker  │
    │ Instance│      │ Instance│      │ Instance│
    └────┬────┘      └────┬────┘      └────┬────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                     Deno Deploy
                    (Closest Region)
```

## Backup and Recovery Architecture

### Backup Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Backup Architecture                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Continuous Backups                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Database (Neon)                                    │   │
│  │  • Point-in-time Recovery: 30 days                 │   │
│  │  • Snapshots: Every 60 minutes                     │   │
│  │  • Transaction Logs: Continuous                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Daily Backups                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Application Data                                   │   │
│  │  • Database Export: 2:00 AM UTC                    │   │
│  │  • Redis Snapshot: 3:00 AM UTC                     │   │
│  │  • R2 Sync: 4:00 AM UTC                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Weekly Backups                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Full System Backup                                 │   │
│  │  • Complete DB dump                                │   │
│  │  • All file storage                                │   │
│  │  • Configuration backup                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Backup Storage Locations                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Primary:   R2 Bucket (pitchey-backups)            │   │
│  │  Secondary: External S3 (cross-region)             │   │
│  │  Archive:   Glacier (30+ days)                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Disaster Recovery Plan

```
┌─────────────────────────────────────────────────────────────┐
│              Disaster Recovery Procedures                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  RTO (Recovery Time Objective): 4 hours                     │
│  RPO (Recovery Point Objective): 1 hour                     │
│                                                              │
│  Recovery Scenarios                                         │
│                                                              │
│  1. Database Failure                                        │
│     ├─ Detection: < 1 minute (health checks)               │
│     ├─ Failover to replica: < 5 minutes                    │
│     ├─ Full recovery: < 30 minutes                         │
│     └─ Data loss: < 1 hour                                 │
│                                                              │
│  2. Regional Outage                                         │
│     ├─ Detection: Immediate (Cloudflare)                   │
│     ├─ Traffic rerouting: Automatic                        │
│     ├─ Service continuity: No downtime                     │
│     └─ Data consistency: Eventually consistent             │
│                                                              │
│  3. Complete System Failure                                 │
│     ├─ Initiate DR plan: < 15 minutes                      │
│     ├─ Restore database: < 1 hour                          │
│     ├─ Restore services: < 2 hours                         │
│     ├─ Full functionality: < 4 hours                       │
│     └─ Maximum data loss: 1 hour                          │
│                                                              │
│  Recovery Steps                                             │
│  1. Assess damage and determine scenario                    │
│  2. Notify stakeholders                                     │
│  3. Initiate appropriate recovery procedure                 │
│  4. Restore data from latest backup                         │
│  5. Verify system functionality                             │
│  6. Resume normal operations                                │
│  7. Post-mortem analysis                                    │
└─────────────────────────────────────────────────────────────┘
```

## Monitoring and Observability

### Monitoring Stack

```
┌─────────────────────────────────────────────────────────────┐
│                  Observability Platform                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Metrics Collection                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Application Metrics                                │   │
│  │  • Request rate, latency, errors                   │   │
│  │  • Database query performance                      │   │
│  │  • Cache hit/miss ratios                          │   │
│  │  • WebSocket connections                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Log Aggregation                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Centralized Logging                               │   │
│  │  • Application logs (Deno)                         │   │
│  │  • Worker logs (Cloudflare)                        │   │
│  │  • Database logs (Neon)                            │   │
│  │  • Security events                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Alerting Rules                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Critical Alerts (Page immediately)                │   │
│  │  • Service down > 1 minute                        │   │
│  │  • Error rate > 5%                                │   │
│  │  • Database connection failures                    │   │
│  │  • Security breaches                              │   │
│  │                                                    │   │
│  │  Warning Alerts (Notify team)                      │   │
│  │  • Response time > 2s                             │   │
│  │  • Cache miss rate > 50%                          │   │
│  │  • CPU usage > 80%                                │   │
│  │  • Storage > 80% capacity                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Health Check System

```
GET /api/health
├─ Response Time Check
├─ Database Connectivity
├─ Redis Connectivity  
├─ Worker Status
└─ Dependency Health

Response Format:
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2025-11-09T10:00:00Z",
  "services": {
    "database": {
      "status": "healthy",
      "latency": 15,
      "details": "Connected to primary"
    },
    "cache": {
      "status": "healthy",
      "latency": 5,
      "hit_rate": 0.92
    },
    "storage": {
      "status": "healthy",
      "available": true
    },
    "websocket": {
      "status": "healthy",
      "connections": 245
    }
  },
  "metrics": {
    "uptime": 864000,
    "requests_per_second": 1250,
    "average_response_time": 125,
    "error_rate": 0.001
  }
}
```

## Cost Optimization Strategy

### Resource Utilization

```
┌─────────────────────────────────────────────────────────────┐
│                 Cost Optimization Tiers                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Free Tier Usage (Current)                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Service          │ Limit        │ Usage    │ Cost  │   │
│  │──────────────────┼──────────────┼──────────┼───────│   │
│  │  CF Pages        │ Unlimited    │ 50GB/mo  │ $0    │   │
│  │  CF Workers      │ 100K req/day │ 80K/day  │ $0    │   │
│  │  Deno Deploy     │ 100K req/day │ 60K/day  │ $0    │   │
│  │  Neon DB         │ 3GB/1hr comp │ 2GB/45m  │ $0    │   │
│  │  Upstash Redis   │ 10K cmd/day  │ 8K/day   │ $0    │   │
│  │  R2 Storage      │ 10GB         │ 5GB      │ $0    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Scaling Thresholds                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  When to Upgrade:                                   │   │
│  │  • Workers: > 90K requests/day → $5/mo plan        │   │
│  │  • Deno: > 90K requests/day → $10/mo plan          │   │
│  │  • Neon: > 2.5GB storage → $19/mo plan             │   │
│  │  • Redis: > 9K commands/day → $10/mo plan          │   │
│  │  • R2: > 10GB storage → $0.015/GB/mo               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Optimization Strategies                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Aggressive Caching                              │   │
│  │     - Cache at edge (KV)                           │   │
│  │     - Long TTLs for static content                 │   │
│  │     - Query result caching                         │   │
│  │                                                    │   │
│  │  2. Request Consolidation                          │   │
│  │     - Batch API calls                              │   │
│  │     - GraphQL for flexible queries                 │   │
│  │     - WebSocket for real-time updates              │   │
│  │                                                    │   │
│  │  3. Storage Optimization                           │   │
│  │     - Image compression                            │   │
│  │     - Lazy loading                                 │   │
│  │     - Archival policies                            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Monthly Cost Projection

```
Current (Free Tier):        $0/month
10K Users:                  $50/month  
100K Users:                 $250/month
1M Users:                   $2,000/month

Cost Breakdown at Scale (100K users):
- Cloudflare Workers:       $20
- Deno Deploy:              $50
- Neon PostgreSQL:          $100
- Upstash Redis:            $50
- R2 Storage:               $30
- Total:                    $250/month
```

---

**Document Version**: 1.0.0
**Last Updated**: November 9, 2025
**Architecture Status**: Production Active
**Next Review**: December 2025