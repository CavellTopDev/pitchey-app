# Production Optimization Guide

## Overview
Complete guide for optimizing Pitchey application performance in production.

## Current Performance Metrics
- **Lighthouse Score**: 99/100 🚀
- **Backend Response**: <200ms average
- **Frontend Load**: <2s initial load
- **Database Queries**: <50ms average

## Optimization Areas

### 1. Database Optimization

#### Indexing Strategy
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_pitches_visibility ON pitches(visibility);
CREATE INDEX idx_pitches_creator ON pitches(creator_id);
CREATE INDEX idx_pitches_created ON pitches(created_at DESC);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_ndas_pitch ON ndas(pitch_id);
CREATE INDEX idx_ndas_user ON ndas(user_id);

-- Composite indexes for complex queries
CREATE INDEX idx_pitches_visibility_created ON pitches(visibility, created_at DESC);
CREATE INDEX idx_portfolio_user_pitch ON portfolio(user_id, pitch_id);
```

#### Query Optimization
```typescript
// Use select specific columns instead of *
const pitches = await db
  .select({
    id: pitches.id,
    title: pitches.title,
    tagline: pitches.tagline,
    thumbnail: pitches.thumbnail,
  })
  .from(pitches)
  .where(eq(pitches.visibility, 'public'))
  .limit(20);

// Use joins efficiently
const pitchesWithCreator = await db
  .select()
  .from(pitches)
  .leftJoin(users, eq(pitches.creatorId, users.id))
  .limit(20);
```

#### Connection Pooling
```typescript
// Neon connection pooling
const DATABASE_URL = "postgresql://...?sslmode=require&pool_mode=transaction";

// Configure pool settings
const pool = {
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};
```

### 2. Caching Strategy

#### Multi-Level Caching
1. **Browser Cache**: Static assets (1 year)
2. **CDN Cache**: Public content (5 minutes)
3. **Redis Cache**: Database queries (1-60 minutes)
4. **In-Memory Cache**: Hot data (<1 minute)

#### Implementation
```typescript
// Cache headers for static assets
const staticHeaders = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Vary': 'Accept-Encoding',
};

// Dynamic content caching
const dynamicHeaders = {
  'Cache-Control': 'public, max-age=300, s-maxage=600',
  'Surrogate-Control': 'max-age=3600',
};
```

### 3. Frontend Optimization

#### Code Splitting
```typescript
// Lazy load routes
const CreatorDashboard = lazy(() => import('./pages/CreatorDashboard'));
const InvestorDashboard = lazy(() => import('./pages/InvestorDashboard'));

// Route-based splitting
<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/creator/*" element={<CreatorDashboard />} />
    <Route path="/investor/*" element={<InvestorDashboard />} />
  </Routes>
</Suspense>
```

#### Bundle Optimization
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui': ['lucide-react', '@radix-ui/react-dialog'],
        },
      },
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
```

#### Image Optimization
```typescript
// Use WebP with fallback
<picture>
  <source srcset={`${image}.webp`} type="image/webp" />
  <img src={`${image}.jpg`} alt={alt} loading="lazy" />
</picture>

// Responsive images
<img 
  srcset={`${image}-400.jpg 400w, ${image}-800.jpg 800w`}
  sizes="(max-width: 400px) 400px, 800px"
  loading="lazy"
/>
```

### 4. API Optimization

#### Pagination
```typescript
// Implement cursor-based pagination
async function getPitches(cursor?: string, limit = 20) {
  const query = db.select().from(pitches).limit(limit);
  
  if (cursor) {
    query.where(gt(pitches.id, parseInt(cursor)));
  }
  
  const results = await query;
  const nextCursor = results[results.length - 1]?.id;
  
  return { data: results, nextCursor };
}
```

#### Response Compression
```typescript
// Enable Brotli compression
const compress = (body: string): Uint8Array => {
  return brotli.compress(new TextEncoder().encode(body));
};

// Add compression headers
headers.set('Content-Encoding', 'br');
headers.set('Vary', 'Accept-Encoding');
```

#### Rate Limiting
```typescript
// Implement rate limiting
const rateLimiter = new Map<string, number[]>();

function checkRateLimit(ip: string, limit = 100): boolean {
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  
  const requests = rateLimiter.get(ip) || [];
  const recentRequests = requests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= limit) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimiter.set(ip, recentRequests);
  return true;
}
```

### 5. Infrastructure Optimization

#### CDN Configuration
```yaml
# Netlify CDN rules (_headers file)
/*
  Cache-Control: public, max-age=0, must-revalidate
/static/*
  Cache-Control: public, max-age=31536000, immutable
/api/*
  Cache-Control: no-cache
```

#### Edge Functions
```typescript
// Deploy compute at edge locations
export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    
    // Serve from edge cache
    const cache = await caches.open('v1');
    const cached = await cache.match(request);
    if (cached) return cached;
    
    // Forward to origin
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  },
};
```

### 6. Monitoring & Alerting

#### Key Metrics to Track
- **Apdex Score**: User satisfaction (target: >0.9)
- **Error Rate**: <1% of requests
- **P95 Latency**: <500ms
- **Cache Hit Ratio**: >80%
- **Database Pool Usage**: <70%

#### Alert Thresholds
```yaml
alerts:
  - name: high_error_rate
    condition: error_rate > 0.05
    window: 5m
    severity: critical
    
  - name: slow_response
    condition: p95_latency > 1000
    window: 10m
    severity: warning
    
  - name: low_cache_hit
    condition: cache_hit_ratio < 0.6
    window: 30m
    severity: info
```

### 7. Security Optimization

#### Headers
```typescript
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
```

#### Input Validation
```typescript
// Validate and sanitize all inputs
import { z } from "zod";

const pitchSchema = z.object({
  title: z.string().min(1).max(200),
  tagline: z.string().max(500),
  description: z.string().max(5000),
  budget: z.number().positive(),
  visibility: z.enum(['public', 'private', 'nda_required']),
});

function validatePitch(data: unknown) {
  return pitchSchema.parse(data);
}
```

### 8. Cost Optimization

#### Service Tiers
| Service | Free Tier | Usage | Cost Optimization |
|---------|-----------|-------|-------------------|
| **Deno Deploy** | Unlimited requests | ✅ Within limits | Use edge caching |
| **Netlify** | 100GB bandwidth | ✅ ~10GB/month | Optimize images |
| **Neon** | 3GB storage | ✅ ~500MB used | Archive old data |
| **Upstash** | 10k commands/day | ⚠️ Monitor usage | Selective caching |
| **Sentry** | 5k errors/month | ✅ <100/month | Filter non-critical |

#### Optimization Tips
1. **Compress all assets** (saves ~70% bandwidth)
2. **Use appropriate image formats** (WebP saves ~30%)
3. **Implement pagination** (reduce data transfer)
4. **Cache aggressively** (reduce database hits)
5. **Archive old data** (reduce storage costs)

### 9. Performance Testing

#### Load Testing
```bash
# Test with k6
k6 run --vus 100 --duration 30s load-test.js

# Test with Apache Bench
ab -n 1000 -c 10 https://pitchey-backend-fresh.deno.dev/api/health
```

#### Performance Budget
```javascript
// performance-budget.json
{
  "timings": {
    "firstContentfulPaint": 1500,
    "timeToInteractive": 3500,
    "firstMeaningfulPaint": 2000
  },
  "sizes": {
    "totalBundleSize": 500000,
    "mainBundleSize": 200000
  }
}
```

### 10. Deployment Optimization

#### Blue-Green Deployment
```bash
# Deploy to staging
deployctl deploy --project=pitchey-staging

# Test staging
./test-production.sh https://pitchey-staging.deno.dev

# Swap to production
deployctl promote --from=staging --to=production
```

#### Rollback Strategy
```bash
# Quick rollback
deployctl rollback --project=pitchey-backend-fresh --version=previous

# Or redeploy known good version
deployctl deploy --project=pitchey-backend-fresh --version=v3.2
```

## Implementation Priority

### Phase 1: Quick Wins (1 day)
- [x] Fix public endpoint issue
- [ ] Add database indexes
- [ ] Enable compression
- [ ] Set cache headers

### Phase 2: Caching (1 week)
- [ ] Implement Redis caching
- [ ] Add browser caching
- [ ] Configure CDN rules
- [ ] Cache database queries

### Phase 3: Code Optimization (2 weeks)
- [ ] Implement code splitting
- [ ] Optimize bundle size
- [ ] Lazy load images
- [ ] Add pagination

### Phase 4: Infrastructure (1 month)
- [ ] Set up edge functions
- [ ] Implement rate limiting
- [ ] Add load balancing
- [ ] Configure auto-scaling

## Monitoring Checklist

### Daily
- [ ] Check error rates
- [ ] Review response times
- [ ] Monitor cache hit ratio
- [ ] Check resource usage

### Weekly
- [ ] Analyze performance trends
- [ ] Review user sessions
- [ ] Check security alerts
- [ ] Update dependencies

### Monthly
- [ ] Load testing
- [ ] Security audit
- [ ] Cost analysis
- [ ] Capacity planning

## Resources

### Tools
- **Monitoring**: [Sentry](https://sentry.io), [UptimeRobot](https://uptimerobot.com)
- **Performance**: [Lighthouse](https://web.dev/measure/), [WebPageTest](https://www.webpagetest.org)
- **Load Testing**: [k6](https://k6.io), [Apache Bench](https://httpd.apache.org/docs/2.4/programs/ab.html)
- **Analysis**: [Bundle Analyzer](https://www.npmjs.com/package/webpack-bundle-analyzer)

### Documentation
- [Web Vitals](https://web.dev/vitals/)
- [Deno Deploy Best Practices](https://deno.com/deploy/docs/best-practices)
- [Netlify Optimization](https://docs.netlify.com/configure-builds/common-configurations/)
- [PostgreSQL Performance](https://wiki.postgresql.org/wiki/Performance_Optimization)

## Conclusion

Following this optimization guide will help maintain excellent performance while scaling. Focus on:
1. **Caching everything cacheable**
2. **Optimizing database queries**
3. **Reducing bundle sizes**
4. **Monitoring continuously**
5. **Iterating based on metrics**

Current performance is excellent (99/100), but continuous optimization ensures it stays that way as the application grows.