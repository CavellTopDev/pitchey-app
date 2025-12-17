# Pitchey Cache Optimization Strategy

## Current Issues Analysis

### Root Cause of Cache MISS Problem

1. **Cache Key Inconsistency**: Current cache keys don't match between set/get operations
2. **Missing Authentication Context**: User-specific data cached without user context
3. **Improper TTL Configuration**: Some endpoints set with inappropriate TTLs
4. **KV Namespace Issues**: Configuration might be incorrect or KV not properly bound

## Optimal Cache Key Strategy

### Hierarchical Namespace Design

```typescript
// Cache key format: {environment}:{service}:{endpoint}:{version}:{context}:{params}
// Examples:
// prod:api:pitches:v1:public:limit=10&offset=0
// prod:api:dashboard:v1:user=123:stats
// prod:api:auth:v1:global:session=abc123
```

### Cache Key Components

1. **Environment**: `prod|staging|dev`
2. **Service**: `api|static|websocket`
3. **Endpoint**: `pitches|users|dashboard|auth|ndas`
4. **Version**: `v1|v2` (for cache invalidation on API changes)
5. **Context**: `public|user={id}|role={type}|global`
6. **Parameters**: Sorted query parameters

## Tiered Caching System

### Hot Tier (Edge Cache API - Sub-50ms)
- **TTL**: 30-300 seconds
- **Use Cases**: Frequently accessed, low-latency needs
- **Data**: Public listings, trending content, static data

### Warm Tier (KV Storage - 100-500ms)
- **TTL**: 5-60 minutes
- **Use Cases**: User-specific data, computed results
- **Data**: Dashboard stats, user profiles, filtered lists

### Cold Tier (Database + Smart Cache - 500ms+)
- **TTL**: 1-24 hours
- **Use Cases**: Heavy computations, aggregations
- **Data**: Analytics, reports, background jobs

## Top 20 Endpoints for Caching

### Critical (Hot Tier) - Public Data
1. `GET /api/pitches/trending` - TTL: 300s
2. `GET /api/pitches/new` - TTL: 180s
3. `GET /api/pitches/public` - TTL: 300s
4. `GET /api/genres/list` - TTL: 3600s
5. `GET /api/creators/featured` - TTL: 600s

### Important (Warm Tier) - User-Specific
6. `GET /api/dashboard/stats` - TTL: 300s
7. `GET /api/user/profile` - TTL: 600s
8. `GET /api/pitches/my` - TTL: 120s
9. `GET /api/notifications/recent` - TTL: 60s
10. `GET /api/ndas/status` - TTL: 300s

### Moderate (Warm Tier) - Computed Data
11. `GET /api/analytics/pitch-stats` - TTL: 900s
12. `GET /api/search/suggestions` - TTL: 600s
13. `GET /api/investors/matching` - TTL: 600s
14. `GET /api/pitches/recommendations` - TTL: 900s
15. `GET /api/marketplace/browse` - TTL: 300s

### Background (Cold Tier) - Heavy Operations
16. `GET /api/reports/engagement` - TTL: 3600s
17. `GET /api/analytics/user-behavior` - TTL: 7200s
18. `GET /api/admin/system-stats` - TTL: 300s
19. `GET /api/search/results` - TTL: 600s
20. `GET /api/audit/activity` - TTL: 1800s

## Cache Invalidation Strategy Matrix

| Event Type | Affected Cache Patterns | Invalidation Method |
|------------|-------------------------|-------------------|
| New Pitch Created | `pitches:*`, `dashboard:*`, `trending:*` | Tag-based |
| User Profile Update | `user:{id}:*`, `profile:*` | User-specific |
| NDA Status Change | `ndas:*`, `dashboard:*` | Document-specific |
| System Config Change | `config:*`, `admin:*` | Global flush |
| Marketplace Update | `marketplace:*`, `browse:*` | Category-based |

## Business Logic for TTL Decisions

### Public Content (300-3600s)
- **Rationale**: Changes infrequently, high traffic
- **Examples**: Genre lists, featured content, public pitches
- **TTL Logic**: Balance freshness vs. performance

### User-Specific Data (60-600s)
- **Rationale**: Personalized, medium frequency updates
- **Examples**: Dashboards, profiles, notifications
- **TTL Logic**: Fresh enough for user experience

### Real-time Data (30-120s)
- **Rationale**: Frequent updates, consistency critical
- **Examples**: Notifications, active sessions, live stats
- **TTL Logic**: Near real-time requirements

### Heavy Computations (900-7200s)
- **Rationale**: Expensive to compute, acceptable staleness
- **Examples**: Analytics, reports, aggregations
- **TTL Logic**: Performance over perfect freshness

## Implementation Priority

1. **Phase 1**: Fix cache key consistency and KV binding
2. **Phase 2**: Implement tiered caching for top 10 endpoints
3. **Phase 3**: Add cache warming and invalidation
4. **Phase 4**: Optimize remaining endpoints and monitoring