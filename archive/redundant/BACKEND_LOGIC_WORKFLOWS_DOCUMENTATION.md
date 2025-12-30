# Pitchey Backend Logic Workflows Documentation

## Executive Summary
Pitchey's backend implements a comprehensive enterprise-grade architecture supporting three distinct user portals (Creator, Investor, Production) with advanced features including real-time collaboration, NDA workflows, investment tracking, and AI-powered analytics.

## 🏗️ Architecture Overview

### Technology Stack
- **Runtime**: Cloudflare Workers (Edge Computing)
- **Database**: Neon PostgreSQL (via Hyperdrive connection pooling)
- **Authentication**: Better Auth with JWT sessions
- **Real-time**: WebSockets via Durable Objects
- **Cache**: Cloudflare KV & Upstash Redis
- **Storage**: Cloudflare R2 (S3-compatible)
- **Monitoring**: Sentry, GitHub Actions, Custom Health Checks

### Service Architecture
```
┌─────────────────────────────────────────────────────┐
│                   Edge Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   CDN/Cache │  │  WebSocket  │  │   Worker    │ │
│  │  (KV Store) │  │   (Durable  │  │  (Better    │ │
│  │             │  │   Objects)  │  │   Auth)     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────┐
│               Enterprise Services                    │
│  ┌───────────────────────────────────────────────┐  │
│  │ ML Service │ Data Science │ Security Service  │  │
│  ├───────────────────────────────────────────────┤  │
│  │ Distributed │ Edge Compute │ Automation       │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────┐
│                  Data Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Neon      │  │   Redis     │  │     R2      │ │
│  │ PostgreSQL  │  │   Cache     │  │   Storage   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────┘
```

## 🔐 Authentication & Authorization Workflows

### 1. Portal-Specific Authentication
Each portal has dedicated authentication with role validation:

#### Creator Portal Login Flow
```typescript
POST /api/auth/creator/login
├── Validate email/password
├── Check userType === 'creator'
├── Generate JWT with Better Auth
├── Create session in database
├── Return token + user profile
└── Set secure HTTP-only cookies
```

#### Investor Portal Login Flow
```typescript
POST /api/auth/investor/login
├── Validate email/password
├── Check userType === 'investor'
├── Generate JWT with Better Auth
├── Create session with investment permissions
├── Return token + portfolio data
└── Enable NDA request capabilities
```

#### Production Portal Login Flow
```typescript
POST /api/auth/production/login
├── Validate email/password
├── Check userType === 'production'
├── Generate JWT with Better Auth
├── Create session with production tools
├── Return token + company profile
└── Enable project management features
```

### 2. Session Management
- **Token Expiry**: 7 days with auto-refresh
- **Session Cache**: 5-minute KV cache for performance
- **Multi-device**: Supports concurrent sessions
- **Revocation**: Immediate logout across all devices

## 📝 Core Business Workflows

### 1. Pitch Creation & Management Workflow

#### Create Pitch (Creator Only)
```typescript
POST /api/pitches/create
├── Verify creator authentication
├── Validate pitch data
│   ├── Required fields check
│   ├── Media upload validation
│   └── Genre/format validation
├── Generate unique pitch ID
├── Store in PostgreSQL
├── Upload media to R2
├── Create analytics entry
├── Trigger real-time notification
└── Return pitch with public URL
```

#### Update Pitch
```typescript
PUT /api/pitches/:id/update
├── Verify ownership (creator === pitch.userId)
├── Check pitch status (not in production)
├── Validate updates
├── Update database
├── Invalidate cache
├── Notify followers
└── Log change history
```

### 2. NDA (Non-Disclosure Agreement) Workflow

#### Request NDA (Investor/Production)
```typescript
POST /api/ndas/request
├── Verify investor/production role
├── Check pitch availability
├── Verify no existing NDA
├── Create NDA request record
│   ├── Set status: 'pending'
│   ├── Generate request ID
│   └── Set expiry (30 days)
├── Notify pitch creator
├── Send email notification
└── Return request confirmation
```

#### Approve/Reject NDA (Creator)
```typescript
POST /api/ndas/:id/approve
├── Verify creator owns the pitch
├── Check NDA status === 'pending'
├── Update NDA status
│   ├── If approved:
│   │   ├── Grant access permissions
│   │   ├── Generate signed NDA document
│   │   ├── Store in R2
│   │   └── Enable secure content access
│   └── If rejected:
│       ├── Update status to 'rejected'
│       └── Send rejection notification
├── Update analytics
└── Trigger WebSocket notification
```

#### NDA Document Generation
```typescript
generateNDADocument(nda)
├── Load template based on type
├── Inject party information
├── Add digital signatures
├── Generate PDF via worker
├── Encrypt with AES-256
├── Store in R2 with access control
└── Return secure download URL
```

### 3. Investment Tracking Workflow

#### Create Investment (Investor)
```typescript
POST /api/investments/create
├── Verify investor authentication
├── Validate investment amount
├── Check pitch status (seeking investment)
├── Verify signed NDA exists
├── Create investment record
│   ├── Status: 'pending'
│   ├── Generate transaction ID
│   └── Set terms & conditions
├── Update pitch funding progress
├── Notify creator
├── Generate investment agreement
└── Return investment details
```

#### Investment Lifecycle
```
pending → due_diligence → negotiation → committed → active → completed
         ↓                ↓              ↓
      rejected        withdrawn      defaulted
```

### 4. Real-time Collaboration Workflow

#### WebSocket Connection
```typescript
WS /ws?token=JWT
├── Verify JWT token
├── Extract user context
├── Create/join room (Durable Object)
├── Subscribe to relevant channels
│   ├── User notifications
│   ├── Pitch updates (if following)
│   └── Investment alerts
├── Maintain heartbeat
└── Handle reconnection
```

#### Real-time Events
- **Notification**: New NDA request, investment update
- **Collaboration**: Live pitch editing, comments
- **Analytics**: Real-time view tracking
- **Presence**: Online/offline status

### 5. Analytics & Reporting Workflow

#### View Tracking
```typescript
POST /api/analytics/track
├── Capture event details
│   ├── User ID (if authenticated)
│   ├── Session ID
│   ├── Event type
│   └── Metadata (pitch_id, duration, etc.)
├── Batch write to analytics_events
├── Update aggregates (async)
├── Trigger ML pipeline (if configured)
└── Return tracking confirmation
```

#### Analytics Aggregation (Scheduled)
```typescript
CRON */5 * * * * (Every 5 minutes)
├── Query recent events
├── Calculate metrics
│   ├── Views by pitch
│   ├── Engagement rates
│   ├── Conversion funnels
│   └── User behavior patterns
├── Update analytics_aggregates table
├── Invalidate dashboard caches
└── Send alerts if thresholds exceeded
```

## 🎯 Enterprise Service Capabilities

### 1. Machine Learning Service
- **Pitch Recommendation**: Content-based filtering + collaborative filtering
- **Success Prediction**: Historical data analysis for investment likelihood
- **Genre Classification**: Automatic categorization based on content
- **Sentiment Analysis**: Review and feedback sentiment scoring

### 2. Data Science Service
- **Performance Metrics**: Real-time KPIs and dashboards
- **Trend Analysis**: Market trends and investment patterns
- **User Segmentation**: Behavioral clustering for targeted features
- **Predictive Analytics**: Forecasting platform growth and usage

### 3. Security Service
- **Authentication**: Multi-factor authentication support
- **Authorization**: Role-based access control (RBAC)
- **Encryption**: AES-256 for sensitive data
- **Rate Limiting**: DDoS protection and API throttling
- **Audit Logging**: Complete activity trail for compliance

### 4. Distributed Computing Service
- **Global Edge Deployment**: 285+ locations worldwide
- **Load Balancing**: Intelligent traffic routing
- **Auto-scaling**: Dynamic resource allocation
- **Geo-routing**: Nearest edge server selection
- **Failover**: Automatic redundancy switching

### 5. Edge Computing Service
- **CDN Distribution**: Static asset caching
- **Edge Processing**: Computation at user's nearest location
- **WebSocket at Edge**: Real-time connections via Durable Objects
- **Cache Strategy**: Multi-layer caching (Browser → CDN → KV → Redis)

### 6. Automation Service
- **CI/CD Pipeline**: Automated testing and deployment
- **Health Monitoring**: Continuous uptime checks
- **Backup Automation**: Scheduled database backups
- **Alert Management**: Intelligent alert routing and escalation
- **Report Generation**: Automated business intelligence reports

## 📊 Database Schema Core Relationships

### User Types & Permissions
```sql
users
├── creators
│   ├── can: create/edit/delete own pitches
│   ├── can: approve/reject NDAs
│   └── can: view investment offers
├── investors
│   ├── can: browse public pitches
│   ├── can: request NDAs
│   └── can: make investments
└── production_companies
    ├── can: browse public pitches
    ├── can: request NDAs
    └── can: create production deals
```

### Data Flow
```
User Action → Worker → Auth Check → Business Logic → Database
                ↓                          ↓            ↓
            WebSocket                   Cache       Analytics
             Update                    Update        Event
```

## 🔄 Monitoring & Maintenance

### Health Check Endpoints
- `/api/health` - Main health status
- `/api/*/overview` - Service-specific health
- `/api/pitches/public` - Database connectivity

### GitHub Actions Workflows
1. **Production Monitoring** (Every 5 minutes)
   - Health checks all endpoints
   - Performance metrics collection
   - Error rate monitoring via Sentry
   - Slack notifications on failures

2. **Security Monitoring** (Daily)
   - SSL certificate validation
   - Security header checks
   - Vulnerability scanning

3. **Database Monitoring** (Hourly)
   - Query performance analysis
   - Connection pool health
   - Data integrity verification

## 🚀 Deployment Pipeline

### Production Deployment Flow
```
Code Push → GitHub Actions → Build → Test → Deploy to Cloudflare
                                ↓
                          Sentry Release
                                ↓
                          Health Check
                                ↓
                        Alert if Issues
```

### Rollback Strategy
1. Immediate revert via Cloudflare dashboard
2. Previous version stored for 30 days
3. Database migrations are backward compatible
4. Zero-downtime deployments

## 📈 Performance Optimizations

### Caching Strategy
1. **Browser Cache**: Static assets (1 year)
2. **CDN Cache**: API responses (5 minutes)
3. **KV Cache**: Session data (5 minutes)
4. **Redis Cache**: Computed analytics (1 hour)

### Query Optimization
- Indexed columns for common queries
- Batch operations for bulk updates
- Connection pooling via Hyperdrive
- Read replicas for analytics queries

### Response Time Targets
- Health check: < 100ms
- API endpoints: < 500ms
- Database queries: < 200ms
- WebSocket latency: < 50ms

## 🔒 Security Best Practices

1. **Authentication**
   - JWT with secure signing
   - HTTP-only cookies
   - CSRF protection
   - Session invalidation

2. **Data Protection**
   - Encryption at rest and in transit
   - PII masking in logs
   - Secure file uploads with virus scanning
   - SQL injection prevention via parameterized queries

3. **Access Control**
   - Portal-specific authentication
   - Role-based permissions
   - Resource-level authorization
   - API rate limiting per user

4. **Compliance**
   - GDPR data handling
   - SOC 2 audit trail
   - PCI DSS for payments (when implemented)
   - DMCA content protection

## 📝 API Documentation Standards

Each endpoint follows REST conventions:
- `GET` - Read operations
- `POST` - Create operations
- `PUT` - Full updates
- `PATCH` - Partial updates
- `DELETE` - Remove operations

Response format:
```json
{
  "success": boolean,
  "data": object | array,
  "error": string (if success: false),
  "timestamp": ISO8601,
  "metadata": {
    "page": number,
    "limit": number,
    "total": number
  }
}
```

## 🎬 Conclusion

The Pitchey backend implements a robust, scalable architecture designed for the entertainment industry's unique needs. With Better Auth integration, comprehensive monitoring, and enterprise-grade services, the platform is ready for production use and future scaling.

For technical questions or implementation details, refer to the source code or contact the development team.

---
*Last Updated: December 1, 2025*
*Version: 1.0.0*
*Status: Production Ready with Better Auth Integration*