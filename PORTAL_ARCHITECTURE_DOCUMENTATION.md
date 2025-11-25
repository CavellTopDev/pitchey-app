# Pitchey Platform Architecture Documentation

## System Overview

The Pitchey platform is a comprehensive movie pitch ecosystem connecting creators, investors, and production companies through three specialized portals, all powered by a unified Cloudflare Workers backend infrastructure.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                            USERS                                     │
├───────────────┬───────────────────┬─────────────────────────────────┤
│   Creators    │    Investors      │    Production Companies         │
└───────┬───────┴────────┬──────────┴────────┬────────────────────────┘
        │                │                   │
        ▼                ▼                   ▼
┌───────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                         │
│                  Deployed on Cloudflare Pages                      │
│                    https://pitchey.pages.dev                       │
├─────────────────┬──────────────────┬──────────────────────────────┤
│ Creator Portal  │ Investor Portal  │ Production Portal            │
│   /creator/*    │   /investor/*    │   /production/*              │
└─────────────────┴──────────────────┴──────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│                  CLOUDFLARE WORKERS (Edge API)                     │
│         https://pitchey-optimized.cavelltheleaddev.workers.dev    │
├───────────────────────────────────────────────────────────────────┤
│  • Authentication & Authorization                                  │
│  • Business Logic                                                  │
│  • API Routing                                                     │
│  • WebSocket Management (Durable Objects)                          │
│  • Edge Caching (KV)                                              │
│  • File Storage (R2)                                              │
└───────────────────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Neon DB      │    │ Upstash Redis│    │ Cloudflare   │
│ PostgreSQL   │    │   (Cache)    │    │     R2       │
│              │    │              │    │  (Storage)   │
└──────────────┘    └──────────────┘    └──────────────┘
```

## Portal Connections

### 1. Creator Portal

**Purpose**: Content creation and pitch management

**Key Features**:
- Pitch creation and editing
- Media uploads (posters, videos, documents)
- Analytics dashboard
- NDA management
- Collaboration tools

**API Endpoints Used**:
```typescript
// Authentication
POST   /api/auth/creator/login
POST   /api/auth/creator/register
POST   /api/auth/logout

// Pitch Management
GET    /api/pitches/my              // Get creator's pitches
POST   /api/pitches                 // Create new pitch
PUT    /api/pitches/:id            // Update pitch
DELETE /api/pitches/:id            // Delete pitch

// Analytics
GET    /api/analytics/dashboard    // Dashboard metrics
GET    /api/analytics/pitch/:id    // Pitch-specific analytics
GET    /api/analytics/realtime     // Real-time activity

// NDA Management
GET    /api/ndas/incoming-requests // NDA requests for creator's pitches
POST   /api/ndas/:id/approve       // Approve NDA request
POST   /api/ndas/:id/reject        // Reject NDA request
```

### 2. Investor Portal

**Purpose**: Investment discovery and portfolio management

**Key Features**:
- Pitch browsing and filtering
- Investment tracking
- NDA requests
- Portfolio analytics
- Payment processing

**API Endpoints Used**:
```typescript
// Authentication
POST   /api/auth/investor/login
POST   /api/auth/investor/register

// Pitch Discovery
GET    /api/pitches/browse          // Browse all pitches
GET    /api/pitches/trending        // Trending pitches
GET    /api/pitches/following       // From followed creators
GET    /api/investment/recommendations // AI recommendations

// NDA Management
POST   /api/ndas/request            // Request NDA access
GET    /api/ndas/outgoing-requests  // Sent NDA requests
GET    /api/ndas/incoming-signed    // Signed NDAs

// Investment
POST   /api/investments/create      // Create investment
GET    /api/investments/portfolio   // Investment portfolio
GET    /api/investments/history     // Transaction history

// Payments
POST   /api/payments/process        // Process payment
GET    /api/payments/subscription-status
GET    /api/payments/credits/balance
```

### 3. Production Portal

**Purpose**: Project management and production pipeline

**Key Features**:
- Project tracking
- Resource allocation
- Team collaboration
- Production pipeline management
- Budget tracking

**API Endpoints Used**:
```typescript
// Authentication
POST   /api/auth/production/login
POST   /api/auth/production/register

// Project Management
GET    /api/production/projects     // All projects
POST   /api/production/projects     // Create project
GET    /api/production/investments/overview

// Collaboration
GET    /api/production/following    // Following activity
POST   /api/messages/send           // Send message
GET    /api/notifications           // Get notifications

// Analytics
GET    /api/analytics/production    // Production metrics
GET    /api/analytics/budget/:id    // Budget tracking
```

## Cloudflare Workers Integration

### Worker Service Architecture

```typescript
// src/worker-service-optimized.ts

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 1. CORS Handling
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // 2. Route Processing
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 3. Authentication Middleware
    if (requiresAuth(pathname)) {
      const auth = await authenticateRequest(request, env);
      if (!auth.success) {
        return auth.error;
      }
    }

    // 4. Route Handling
    return handleRoute(pathname, request, env);
  }
}
```

### Key Cloudflare Services Used

#### 1. **Cloudflare Pages** (Frontend Hosting)
- Global CDN distribution
- Automatic SSL/TLS
- Preview deployments
- Git integration

#### 2. **Cloudflare Workers** (Edge Computing)
- Serverless API endpoints
- Request routing
- Authentication
- Business logic

#### 3. **Durable Objects** (WebSocket Management)
- Real-time connections
- Stateful WebSocket rooms
- Presence tracking
- Live notifications

```typescript
// WebSocket Room Implementation
export class WebSocketRoom {
  state: DurableObjectState;
  connections: Map<string, WebSocket>;

  async handleWebSocket(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    this.connections.set(userId, server);
    
    server.addEventListener('message', async (event) => {
      // Broadcast to relevant connections
      this.broadcast(event.data);
    });
    
    return new Response(null, { status: 101, webSocket: client });
  }
}
```

#### 4. **KV Namespace** (Edge Caching)
- Session storage
- Temporary data
- Cache frequently accessed data

```typescript
// Cache Implementation
const cacheKey = `pitch:${pitchId}`;
const cached = await env.CACHE.get(cacheKey, 'json');
if (cached) return cached;

// Fetch from database
const data = await fetchFromDatabase(pitchId);
await env.CACHE.put(cacheKey, JSON.stringify(data), {
  expirationTtl: 300 // 5 minutes
});
```

#### 5. **R2 Storage** (Object Storage)
- Media files (videos, images)
- Documents (PDFs, pitch decks)
- Zero egress fees
- S3-compatible API

```typescript
// File Upload to R2
const object = await env.R2_BUCKET.put(
  `pitches/${pitchId}/${fileName}`,
  request.body,
  {
    httpMetadata: {
      contentType: request.headers.get('Content-Type'),
    },
  }
);
```

#### 6. **Hyperdrive** (Database Connection Pooling)
- PostgreSQL connection pooling
- Reduced latency
- Connection reuse

```typescript
// Hyperdrive Configuration
const sql = neon(env.HYPERDRIVE.connectionString);
const results = await sql`SELECT * FROM pitches WHERE id = ${id}`;
```

## Database Architecture

### Neon PostgreSQL Schema

```sql
-- Core Tables
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE,
  user_type VARCHAR(50) NOT NULL, -- 'creator', 'investor', 'production'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE pitches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  logline TEXT,
  genre VARCHAR(100),
  status VARCHAR(50),
  visibility VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE investments (
  id SERIAL PRIMARY KEY,
  investor_id INTEGER REFERENCES users(id),
  pitch_id INTEGER REFERENCES pitches(id),
  amount DECIMAL(10, 2),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE nda_requests (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER REFERENCES pitches(id),
  requester_id INTEGER REFERENCES users(id),
  owner_id INTEGER REFERENCES users(id),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Security Implementation

### Authentication Flow

```typescript
// JWT Token Structure
{
  userId: number,
  email: string,
  userType: 'creator' | 'investor' | 'production',
  exp: number // Expiration timestamp
}

// Token Verification
async function authenticateRequest(request: Request, env: Env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { success: false, error: unauthorizedResponse() };
  }
  
  const token = authHeader.substring(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  
  return { success: true, user: payload };
}
```

### Portal-Specific Permissions

```typescript
// Permission Matrix
const permissions = {
  creator: {
    canCreate: ['pitch', 'media', 'nda_template'],
    canRead: ['own_pitches', 'analytics', 'nda_requests'],
    canUpdate: ['own_pitches', 'profile'],
    canDelete: ['own_pitches', 'media']
  },
  investor: {
    canCreate: ['investment', 'nda_request', 'message'],
    canRead: ['public_pitches', 'portfolio', 'analytics'],
    canUpdate: ['profile', 'preferences'],
    canDelete: ['saved_pitches']
  },
  production: {
    canCreate: ['project', 'team', 'resource'],
    canRead: ['all_projects', 'team_data', 'budgets'],
    canUpdate: ['projects', 'resources', 'timeline'],
    canDelete: ['projects', 'resources']
  }
};
```

## Real-time Features

### WebSocket Connection Flow

```
1. Client initiates WebSocket connection
   wss://pitchey-optimized.cavelltheleaddev.workers.dev/ws

2. Worker validates authentication token
   
3. Create/join Durable Object room
   
4. Establish bidirectional communication
   
5. Handle real-time events:
   - Notifications
   - Live analytics
   - Collaboration updates
   - Presence tracking
```

### Event Types

```typescript
enum WebSocketEventType {
  // Notifications
  NOTIFICATION = 'notification',
  
  // Analytics
  VIEW_UPDATE = 'view_update',
  LIKE_UPDATE = 'like_update',
  
  // Collaboration
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  MESSAGE = 'message',
  
  // NDA
  NDA_REQUEST = 'nda_request',
  NDA_APPROVED = 'nda_approved',
  NDA_REJECTED = 'nda_rejected'
}
```

## Deployment Pipeline

### Frontend Deployment (Cloudflare Pages)

```bash
# Build frontend with production API URL
VITE_API_URL=https://pitchey-optimized.cavelltheleaddev.workers.dev \
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy frontend/dist --project-name=pitchey
```

### Backend Deployment (Cloudflare Workers)

```bash
# Deploy Worker with configurations
wrangler deploy

# Set environment secrets
wrangler secret put JWT_SECRET
wrangler secret put DATABASE_URL
wrangler secret put SENTRY_DSN
```

## Monitoring and Observability

### Sentry Integration
- Error tracking
- Performance monitoring
- User session replay
- Custom dashboards per portal

### Cloudflare Analytics
- Request metrics
- Geographic distribution
- Cache hit rates
- Worker performance

### Custom Metrics
- Portal-specific KPIs
- Business metrics
- User engagement
- System health

## Scalability Considerations

1. **Edge Caching**: Aggressive caching at edge locations
2. **Database Pooling**: Hyperdrive for connection management
3. **CDN Distribution**: Global content delivery
4. **Async Processing**: Background jobs for heavy operations
5. **Rate Limiting**: Per-user and per-IP limits

## Cost Optimization

1. **R2 Storage**: Zero egress fees for media
2. **Worker Bundling**: Single worker for all endpoints
3. **KV Caching**: Reduce database queries
4. **Conditional Requests**: ETags for static content
5. **Compression**: Brotli/Gzip for all responses

## Future Enhancements

1. **GraphQL Gateway**: Unified query interface
2. **Edge AI**: ML models at the edge
3. **Multi-region Database**: Geographic distribution
4. **Advanced Analytics**: Real-time data pipeline
5. **Mobile Apps**: Native iOS/Android clients

## Support and Maintenance

- **Documentation**: Comprehensive API docs
- **Monitoring**: 24/7 automated alerts
- **Backups**: Daily database snapshots
- **Updates**: Zero-downtime deployments
- **Support**: Multi-channel user support