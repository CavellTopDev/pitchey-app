# Service Bindings Implementation Plan

## Current Architecture
```
Single Monolithic Worker (src/worker-browse-fix.ts)
├── Investment endpoints
├── User endpoints  
├── Auth endpoints
├── Browse endpoints
└── Health endpoints
```

## Target Architecture
```
Main Router Worker (50KB)
├── Service Binding → Creator Worker (1.5MB)
├── Service Binding → Investor Worker (1.2MB)  
├── Service Binding → Production Worker (1.8MB)
├── Service Binding → Auth Worker (500KB)
└── Service Binding → Browse Worker (800KB)
```

## Implementation Steps

### Step 1: Create Router Worker
**File**: `src/router-worker.ts`
```typescript
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    
    // Route based on path prefix
    if (url.pathname.startsWith('/api/auth/creator') || url.pathname.startsWith('/api/creator/')) {
      return env.CREATOR_SERVICE.fetch(request);
    }
    
    if (url.pathname.startsWith('/api/auth/investor') || url.pathname.startsWith('/api/investor/')) {
      return env.INVESTOR_SERVICE.fetch(request);
    }
    
    if (url.pathname.startsWith('/api/auth/production') || url.pathname.startsWith('/api/production/')) {
      return env.PRODUCTION_SERVICE.fetch(request);
    }
    
    if (url.pathname.startsWith('/api/auth/')) {
      return env.AUTH_SERVICE.fetch(request);
    }
    
    if (url.pathname.startsWith('/api/browse') || url.pathname.startsWith('/api/search')) {
      return env.BROWSE_SERVICE.fetch(request);
    }
    
    // Default: Handle in router or return 404
    return new Response('Not Found', { status: 404 });
  }
};
```

### Step 2: Configure Service Bindings
**File**: `wrangler.router.toml`
```toml
name = "pitchey-router"
main = "src/router-worker.ts"

[[services]]
binding = "CREATOR_SERVICE"
service = "pitchey-creator-worker"

[[services]]
binding = "INVESTOR_SERVICE"  
service = "pitchey-investor-worker"

[[services]]
binding = "PRODUCTION_SERVICE"
service = "pitchey-production-worker"

[[services]]
binding = "AUTH_SERVICE"
service = "pitchey-auth-worker"

[[services]]
binding = "BROWSE_SERVICE"
service = "pitchey-browse-worker"
```

### Step 3: Create Portal-Specific Workers
Each worker gets its own:
- `wrangler.[portal].toml` configuration
- `src/[portal]-worker.ts` entry point
- Shared database/caching services

### Step 4: Deployment Strategy
1. Deploy all service workers first
2. Deploy router worker with service bindings
3. Update main domain routing to router worker
4. Monitor and validate functionality
5. Deprecate monolithic worker

## Benefits
- **Bundle Size**: 5MB → 1-2MB per worker
- **Cold Start**: 10ms → 2-5ms (smaller bundles)
- **Development**: Independent teams can deploy separately  
- **Cost**: Zero cost for service binding calls
- **Scaling**: Each portal scales independently

## Migration Risk Mitigation
- Blue/green deployment with gradual traffic shift
- Keep monolithic worker as fallback
- Extensive integration testing before cutover
- Monitor error rates and latency during migration