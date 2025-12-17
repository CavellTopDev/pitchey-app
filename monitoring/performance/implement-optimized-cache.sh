#!/bin/bash

# Pitchey Cache Optimization Implementation Script
# This script implements the optimized caching strategy

set -e

echo "🚀 Implementing Optimized Cache System for Pitchey"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="/home/supremeisbeing/pitcheymovie/pitchey_v0.2"
WORKER_FILE="${PROJECT_ROOT}/src/worker-production-db.ts"
BACKUP_DIR="${PROJECT_ROOT}/backups/cache-implementation-$(date +%Y%m%d_%H%M%S)"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Create backup
create_backup() {
    log_info "Creating backup of current implementation..."
    mkdir -p "$BACKUP_DIR"
    
    # Backup key files
    cp "$WORKER_FILE" "$BACKUP_DIR/worker-production-db.ts.bak" 2>/dev/null || true
    cp "${PROJECT_ROOT}/src/middleware/performance.ts" "$BACKUP_DIR/performance.ts.bak" 2>/dev/null || true
    cp "${PROJECT_ROOT}/src/utils/edge-cache.ts" "$BACKUP_DIR/edge-cache.ts.bak" 2>/dev/null || true
    cp "${PROJECT_ROOT}/wrangler.toml" "$BACKUP_DIR/wrangler.toml.bak" 2>/dev/null || true
    
    log_success "Backup created at $BACKUP_DIR"
}

# Check current cache status
check_current_status() {
    log_info "Checking current cache implementation status..."
    
    # Check if KV namespace is configured
    if grep -q "CACHE_KV" "${PROJECT_ROOT}/wrangler.toml" 2>/dev/null; then
        log_success "KV namespace configured in wrangler.toml"
    else
        log_warning "KV namespace not found in wrangler.toml"
    fi
    
    # Check if cache middleware exists
    if [ -f "${PROJECT_ROOT}/src/cache/edge-cache-manager.ts" ]; then
        log_success "Edge cache manager exists"
    else
        log_warning "Edge cache manager not found"
    fi
    
    # Check worker implementation
    if grep -q "EdgeCache\|cacheMiddleware" "$WORKER_FILE" 2>/dev/null; then
        log_success "Cache middleware integrated in worker"
    else
        log_warning "Cache middleware not integrated in worker"
    fi
}

# Update wrangler.toml configuration
update_wrangler_config() {
    log_info "Updating wrangler.toml configuration..."
    
    local wrangler_file="${PROJECT_ROOT}/wrangler.toml"
    
    # Check if KV binding exists
    if ! grep -q "PITCHEY_KV" "$wrangler_file" 2>/dev/null; then
        log_info "Adding KV namespace binding..."
        
        # Add KV binding if not exists
        cat >> "$wrangler_file" << 'EOF'

# Cache KV namespace
[[kv_namespaces]]
binding = "PITCHEY_KV"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"
EOF
        log_warning "KV namespace IDs need to be configured manually"
    else
        log_success "KV namespace already configured"
    fi
}

# Create cache configuration file
create_cache_config() {
    log_info "Creating cache configuration..."
    
    cat > "${PROJECT_ROOT}/src/cache/cache-config.ts" << 'EOF'
/**
 * Centralized Cache Configuration
 */

export const CACHE_CONFIG = {
  environment: 'production', // Will be set by environment variable
  version: 'v1',
  defaultTtl: 300000, // 5 minutes in milliseconds
  
  // Tier configurations
  tiers: {
    hot: {
      maxTtl: 300, // 5 minutes
      useEdgeCache: true,
      useKV: false,
      compressionThreshold: 1024
    },
    warm: {
      maxTtl: 3600, // 1 hour
      useEdgeCache: true,
      useKV: true,
      compressionThreshold: 2048
    },
    cold: {
      maxTtl: 86400, // 24 hours
      useEdgeCache: false,
      useKV: true,
      compressionThreshold: 4096
    }
  },
  
  // Global settings
  enableMetrics: true,
  enableCompression: true,
  maxKeySize: 512,
  maxValueSize: 25 * 1024 * 1024 // 25MB KV limit
};

export const ENDPOINT_CACHE_MAP = {
  '/api/pitches/trending': 'hot',
  '/api/pitches/new': 'hot',
  '/api/pitches/public': 'hot',
  '/api/genres/list': 'warm',
  '/api/creators/featured': 'warm',
  '/api/dashboard/stats': 'warm',
  '/api/user/profile': 'warm',
  '/api/analytics/': 'cold',
  '/api/reports/': 'cold'
} as const;
EOF

    log_success "Cache configuration created"
}

# Update worker to use optimized cache
update_worker_implementation() {
    log_info "Updating worker to use optimized cache middleware..."
    
    # Create a patch file for the worker
    cat > "${PROJECT_ROOT}/cache-integration.patch" << 'EOF'
--- a/src/worker-production-db.ts
+++ b/src/worker-production-db.ts
@@ -1,6 +1,7 @@
 /**
  * Production Worker with Real Database Connection
  * Uses Neon PostgreSQL for data persistence
+ * Optimized with intelligent caching system
  */
 
 import jwt from '@tsndr/cloudflare-worker-jwt';
@@ -14,8 +15,8 @@ import { SessionManager, RateLimiter } from './auth/session-manager.ts';
 import { logError, getErrorMessage, errorToResponse } from './utils/error-serializer.ts';
 import { Security } from './security-enhancements.ts';
-import { EdgeCache } from './utils/edge-cache.ts';
-import { PerformanceMiddleware } from './middleware/performance.ts';
+import { OptimizedCacheMiddleware, createOptimizedCacheMiddleware } from './cache/optimized-cache-middleware.ts';
+import { ImprovedCacheWarmer, PITCHEY_WARMING_CONFIG } from './cache/improved-cache-warmer.ts';
 
 // Optimize Neon configuration for Cloudflare Workers
 neonConfig.useSecureWebSocket = true;          // Use wss:// protocol for security
EOF

    log_warning "Worker integration requires manual code changes"
    log_info "Patch file created at ${PROJECT_ROOT}/cache-integration.patch"
}

# Create environment-specific configurations
create_environment_configs() {
    log_info "Creating environment-specific configurations..."
    
    # Development config
    cat > "${PROJECT_ROOT}/.env.cache.development" << 'EOF'
CACHE_ENVIRONMENT=development
CACHE_VERSION=v1
CACHE_DEFAULT_TTL=60
CACHE_ENABLE_METRICS=true
CACHE_ENABLE_COMPRESSION=false
CACHE_MAX_CONCURRENT_WARMING=3
EOF

    # Production config
    cat > "${PROJECT_ROOT}/.env.cache.production" << 'EOF'
CACHE_ENVIRONMENT=production
CACHE_VERSION=v1
CACHE_DEFAULT_TTL=300
CACHE_ENABLE_METRICS=true
CACHE_ENABLE_COMPRESSION=true
CACHE_MAX_CONCURRENT_WARMING=5
EOF

    log_success "Environment configurations created"
}

# Generate test scripts
generate_test_scripts() {
    log_info "Generating test scripts..."
    
    # Create cache test runner script
    cat > "${PROJECT_ROOT}/scripts/test-cache.sh" << 'EOF'
#!/bin/bash

# Cache Testing Script
echo "🧪 Running cache tests..."

# Set environment
export ENVIRONMENT=${1:-local}

# Run tests
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2

echo "📝 Running cache validation tests..."
deno run --allow-net --allow-env monitoring/performance/run-cache-tests.ts

echo "🔥 Testing cache warming..."
curl -X POST "http://localhost:8001/api/admin/cache/warm" \
  -H "Content-Type: application/json" \
  || echo "Cache warming endpoint not available"

echo "📊 Cache test complete!"
EOF

    chmod +x "${PROJECT_ROOT}/scripts/test-cache.sh"
    
    # Create cache monitoring script
    cat > "${PROJECT_ROOT}/scripts/monitor-cache.sh" << 'EOF'
#!/bin/bash

# Cache Monitoring Script
echo "📊 Cache Performance Monitor"

BASE_URL=${1:-http://localhost:8001}

echo "Checking cache headers for key endpoints..."
endpoints=(
    "/api/pitches/trending"
    "/api/pitches/new"
    "/api/pitches/public"
    "/api/dashboard/stats"
    "/api/genres/list"
)

for endpoint in "${endpoints[@]}"; do
    echo "Testing $endpoint..."
    response=$(curl -s -I "$BASE_URL$endpoint")
    cache_status=$(echo "$response" | grep -i "x-cache" || echo "No cache header")
    response_time=$(echo "$response" | grep -i "x-response-time" || echo "No timing")
    echo "  Cache: $cache_status"
    echo "  Time: $response_time"
    echo ""
done

echo "Monitoring complete!"
EOF

    chmod +x "${PROJECT_ROOT}/scripts/monitor-cache.sh"
    
    log_success "Test scripts generated"
}

# Create deployment checklist
create_deployment_checklist() {
    log_info "Creating deployment checklist..."
    
    cat > "${PROJECT_ROOT}/CACHE_DEPLOYMENT_CHECKLIST.md" << 'EOF'
# Cache Optimization Deployment Checklist

## Pre-deployment Checklist

### 1. KV Namespace Configuration
- [ ] Create KV namespace in Cloudflare dashboard
- [ ] Update wrangler.toml with correct namespace IDs
- [ ] Test KV access in development

### 2. Worker Integration
- [ ] Import optimized cache middleware
- [ ] Replace existing cache implementation
- [ ] Add cache warming endpoints
- [ ] Test locally with wrangler dev

### 3. Environment Variables
- [ ] Set CACHE_ENVIRONMENT variable
- [ ] Configure cache TTL settings
- [ ] Enable/disable compression based on environment

### 4. Testing
- [ ] Run cache validation tests
- [ ] Test cache warming functionality
- [ ] Verify cache hit rates
- [ ] Load test with concurrent requests

## Deployment Steps

### 1. Deploy to Staging
```bash
wrangler deploy --env staging
```

### 2. Run Cache Tests
```bash
ENVIRONMENT=staging ./scripts/test-cache.sh
```

### 3. Monitor Cache Performance
```bash
./scripts/monitor-cache.sh https://staging-url
```

### 4. Deploy to Production
```bash
wrangler deploy
```

### 5. Warm Production Cache
```bash
curl -X POST "https://production-url/api/admin/cache/warm"
```

## Post-deployment Monitoring

### Key Metrics to Watch
- Cache hit rate (target: >80%)
- Response times (target: <200ms for cached responses)
- Error rates (should not increase)
- Memory usage (stay within KV limits)

### Monitoring Commands
```bash
# Check cache status
./scripts/monitor-cache.sh https://production-url

# Run full validation
ENVIRONMENT=production deno run --allow-net monitoring/performance/run-cache-tests.ts
```

## Rollback Procedure

If issues are detected:

1. Check backup files in: `backups/cache-implementation-*`
2. Revert worker deployment:
   ```bash
   git checkout HEAD~1 src/worker-production-db.ts
   wrangler deploy
   ```
3. Monitor system recovery

## Performance Targets

| Metric | Target | Current | Status |
|--------|---------|---------|---------|
| Cache Hit Rate | >80% | TBD | ⏳ |
| P95 Response Time | <200ms | TBD | ⏳ |
| Cache Miss Latency | <500ms | TBD | ⏳ |
| Error Rate | <1% | TBD | ⏳ |

## Contact Information

For issues or questions:
- Check logs in Cloudflare Workers dashboard
- Review cache metrics at /api/admin/cache/stats
- Refer to cache optimization strategy document
EOF

    log_success "Deployment checklist created"
}

# Create monitoring dashboard configuration
create_monitoring_config() {
    log_info "Creating monitoring configuration..."
    
    cat > "${PROJECT_ROOT}/monitoring/cache-dashboard.json" << 'EOF'
{
  "dashboard": {
    "title": "Pitchey Cache Performance",
    "panels": [
      {
        "title": "Cache Hit Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "cache_hits / (cache_hits + cache_misses) * 100",
            "legendFormat": "Hit Rate %"
          }
        ],
        "thresholds": [
          { "value": 80, "color": "green" },
          { "value": 60, "color": "yellow" },
          { "value": 0, "color": "red" }
        ]
      },
      {
        "title": "Response Times",
        "type": "graph",
        "targets": [
          {
            "expr": "avg(cache_response_time_ms)",
            "legendFormat": "Average Response Time"
          },
          {
            "expr": "quantile(0.95, cache_response_time_ms)",
            "legendFormat": "95th Percentile"
          }
        ]
      },
      {
        "title": "Cache Operations",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(cache_hits[5m])",
            "legendFormat": "Cache Hits/sec"
          },
          {
            "expr": "rate(cache_misses[5m])",
            "legendFormat": "Cache Misses/sec"
          },
          {
            "expr": "rate(cache_sets[5m])",
            "legendFormat": "Cache Sets/sec"
          }
        ]
      },
      {
        "title": "Top Cached Endpoints",
        "type": "table",
        "targets": [
          {
            "expr": "topk(10, sum(cache_hits) by (endpoint))",
            "legendFormat": "{{ endpoint }}"
          }
        ]
      }
    ]
  },
  "alerts": [
    {
      "name": "Low Cache Hit Rate",
      "condition": "cache_hit_rate < 70",
      "severity": "warning",
      "message": "Cache hit rate has dropped below 70%"
    },
    {
      "name": "High Cache Miss Latency",
      "condition": "avg(cache_miss_latency_ms) > 1000",
      "severity": "critical",
      "message": "Cache miss latency is above 1 second"
    },
    {
      "name": "Cache Error Rate High",
      "condition": "cache_error_rate > 0.05",
      "severity": "critical",
      "message": "Cache error rate is above 5%"
    }
  ]
}
EOF

    log_success "Monitoring configuration created"
}

# Main implementation function
main() {
    echo "Starting cache optimization implementation..."
    echo ""
    
    # Step 1: Create backup
    create_backup
    echo ""
    
    # Step 2: Check current status
    check_current_status
    echo ""
    
    # Step 3: Update configurations
    update_wrangler_config
    echo ""
    
    # Step 4: Create cache components
    create_cache_config
    echo ""
    
    # Step 5: Update worker (manual step)
    update_worker_implementation
    echo ""
    
    # Step 6: Environment configurations
    create_environment_configs
    echo ""
    
    # Step 7: Generate test scripts
    generate_test_scripts
    echo ""
    
    # Step 8: Create deployment checklist
    create_deployment_checklist
    echo ""
    
    # Step 9: Create monitoring config
    create_monitoring_config
    echo ""
    
    # Final summary
    echo "🎉 Cache Optimization Implementation Complete!"
    echo "============================================="
    echo ""
    echo "📋 Next Steps:"
    echo "1. Review and update KV namespace IDs in wrangler.toml"
    echo "2. Manually integrate cache middleware in worker file"
    echo "3. Test locally with: wrangler dev"
    echo "4. Run cache tests: ./scripts/test-cache.sh"
    echo "5. Deploy to staging and validate"
    echo "6. Follow deployment checklist for production"
    echo ""
    echo "📂 Important Files Created:"
    echo "• Cache Strategy: monitoring/performance/cache-optimization-strategy.md"
    echo "• Optimized Middleware: src/cache/optimized-cache-middleware.ts"
    echo "• Improved Warmer: src/cache/improved-cache-warmer.ts"
    echo "• Test Suite: monitoring/performance/cache-validation-test.ts"
    echo "• Test Runner: monitoring/performance/run-cache-tests.ts"
    echo "• Deployment Checklist: CACHE_DEPLOYMENT_CHECKLIST.md"
    echo ""
    echo "🔍 Monitor Progress:"
    echo "• Cache performance: ./scripts/monitor-cache.sh"
    echo "• Full validation: ./scripts/test-cache.sh"
    echo "• Dashboard config: monitoring/cache-dashboard.json"
    echo ""
    log_success "Ready for cache optimization deployment!"
}

# Run main function
main "$@"