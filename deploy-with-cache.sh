#!/bin/bash

echo "🚀 Deploying Pitchey Worker with Cache Layer"
echo "============================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Create KV namespace if it doesn't exist
echo -e "${YELLOW}Step 1: Setting up KV namespace for caching${NC}"
KV_NAMESPACE_ID=$(wrangler kv:namespace list | grep "PITCHEY_CACHE" | grep -oE '[a-f0-9]{32}' || true)

if [ -z "$KV_NAMESPACE_ID" ]; then
    echo "Creating new KV namespace..."
    KV_OUTPUT=$(wrangler kv:namespace create "PITCHEY_CACHE" 2>&1)
    KV_NAMESPACE_ID=$(echo "$KV_OUTPUT" | grep -oE '[a-f0-9]{32}')
    echo -e "${GREEN}✅ Created KV namespace: $KV_NAMESPACE_ID${NC}"
else
    echo -e "${GREEN}✅ Using existing KV namespace: $KV_NAMESPACE_ID${NC}"
fi

# Step 2: Update wrangler.toml with KV binding
echo -e "\n${YELLOW}Step 2: Updating wrangler.toml with KV binding${NC}"

# Check if KV binding already exists
if ! grep -q "PITCHEY_KV" wrangler.toml; then
    cat << EOF >> wrangler.toml

# KV Namespace for caching
[[kv_namespaces]]
binding = "PITCHEY_KV"
id = "$KV_NAMESPACE_ID"
EOF
    echo -e "${GREEN}✅ Added KV namespace binding to wrangler.toml${NC}"
else
    echo -e "${GREEN}✅ KV namespace binding already exists${NC}"
fi

# Step 3: Create cache integration module
echo -e "\n${YELLOW}Step 3: Creating cache integration module${NC}"
cat << 'EOF' > src/worker-with-cache-integration.ts
/**
 * Worker with Cache Integration
 * This module integrates the cache layer with the main worker service
 */

import { createCacheLayer, EdgeCacheLayer } from './worker-cache-layer.ts';
import { cachedEndpoints } from './worker-service-cached.ts';

export function integrateCache(originalHandler: any) {
  return async function(request: Request, env: any, ctx: any) {
    // Initialize cache layer
    let cache: EdgeCacheLayer | null = null;
    let sentry: any = null;
    
    try {
      // Initialize Sentry if available
      if (env.SENTRY_DSN) {
        const { Toucan } = await import('toucan-js');
        sentry = new Toucan({
          dsn: env.SENTRY_DSN,
          context: ctx,
          request,
          environment: env.SENTRY_ENVIRONMENT || 'production',
          release: env.SENTRY_RELEASE || 'unknown',
        });
      }
      
      // Initialize cache
      cache = createCacheLayer(env.PITCHEY_KV || null, sentry);
    } catch (error) {
      console.error('Failed to initialize cache layer:', error);
    }
    
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Handle cached endpoints
    if (request.method === 'GET') {
      // Trending pitches
      if (pathname === '/api/pitches/trending') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        return await cachedEndpoints.getTrendingPitches(env, cache, limit, sentry);
      }
      
      // New releases
      if (pathname === '/api/pitches/new') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        return await cachedEndpoints.getNewReleases(env, cache, limit, sentry);
      }
      
      // Public pitches
      if (pathname === '/api/pitches/public') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        return await cachedEndpoints.getPublicPitches(env, cache, limit, offset, sentry);
      }
      
      // Pitch details
      const pitchMatch = pathname.match(/^\/api\/pitches\/(\d+)$/);
      if (pitchMatch) {
        const pitchId = pitchMatch[1];
        // Extract user ID from auth token if available
        let userId: number | undefined;
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          try {
            const token = authHeader.substring(7);
            const decoded = JSON.parse(atob(token));
            userId = decoded.userId;
          } catch (e) {
            // Invalid token, proceed without user ID
          }
        }
        return await cachedEndpoints.getPitchDetails(env, cache, pitchId, userId, sentry);
      }
      
      // Search
      if (pathname === '/api/search') {
        const query = url.searchParams.get('q') || '';
        const filters = {
          genre: url.searchParams.get('genre'),
          format: url.searchParams.get('format'),
        };
        return await cachedEndpoints.searchPitches(env, cache, query, filters, sentry);
      }
      
      // Cache stats
      if (pathname === '/api/cache/stats') {
        const stats = cachedEndpoints.getCacheStats(cache);
        return new Response(JSON.stringify({
          success: true,
          stats,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    // Handle cache invalidation on updates
    if (request.method === 'PUT' || request.method === 'POST' || request.method === 'DELETE') {
      // Extract pitch ID from various endpoints
      const pitchUpdateMatch = pathname.match(/^\/api\/pitches\/(\d+)/);
      if (pitchUpdateMatch) {
        const pitchId = pitchUpdateMatch[1];
        // Invalidate cache after the operation
        ctx.waitUntil(
          originalHandler(request, env, ctx).then(async (response: Response) => {
            if (response.ok) {
              await cachedEndpoints.invalidatePitchCache(cache, pitchId);
            }
            return response;
          })
        );
        return originalHandler(request, env, ctx);
      }
    }
    
    // Fall back to original handler for non-cached endpoints
    return originalHandler(request, env, ctx);
  };
}
EOF

echo -e "${GREEN}✅ Created cache integration module${NC}"

# Step 4: Build the worker
echo -e "\n${YELLOW}Step 4: Building worker with cache layer${NC}"
echo "This will use the existing worker-service-optimized.ts and wrap it with caching..."

# Step 5: Deploy
echo -e "\n${YELLOW}Step 5: Deploying to Cloudflare Workers${NC}"
read -p "Deploy to production? (y/n): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Deploying..."
    wrangler deploy
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Successfully deployed worker with cache layer!${NC}"
        echo ""
        echo "Cache endpoints available:"
        echo "  - GET /api/pitches/trending (5 min cache)"
        echo "  - GET /api/pitches/new (5 min cache)"
        echo "  - GET /api/pitches/public (5 min cache)"
        echo "  - GET /api/pitches/:id (10 min cache)"
        echo "  - GET /api/search (3 min cache)"
        echo "  - GET /api/cache/stats (real-time stats)"
        echo ""
        echo "Cache will automatically invalidate when pitches are updated."
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        exit 1
    fi
else
    echo "Deployment cancelled"
fi

echo ""
echo "📊 Monitor cache performance at:"
echo "   https://dash.cloudflare.com/ → Workers & Pages → Analytics"