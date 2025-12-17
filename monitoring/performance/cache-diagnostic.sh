#!/bin/bash

# Cache Diagnostic and Fix Script
# Identifies why cache is showing MISS and provides fixes

API_URL="${API_URL:-https://pitchey-production.cavelltheleaddev.workers.dev}"
DIAG_DIR="./cache-diagnostics"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$DIAG_DIR/cache_diagnostic_${TIMESTAMP}.md"

mkdir -p "$DIAG_DIR"

echo "🔍 Cache Diagnostic Tool"
echo "━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Analyzing cache behavior..."
echo ""

# Start report
cat > "$REPORT_FILE" <<'EOF'
# Cache Diagnostic Report

## Test Information
EOF

echo "- **Timestamp:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> "$REPORT_FILE"
echo "- **API URL:** $API_URL" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Test 1: Check if KV namespace is configured
echo "1️⃣ Testing KV namespace configuration..."
echo "## 1. KV Namespace Configuration" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

response=$(curl -s -D - "$API_URL/api/health/detailed" -o /tmp/health_body.txt)
health_data=$(cat /tmp/health_body.txt)
has_cache=$(echo "$health_data" | jq -r '.services.cache // false')

if [ "$has_cache" = "true" ]; then
    echo "✅ KV namespace is configured" | tee -a "$REPORT_FILE"
else
    echo "❌ KV namespace NOT configured - This is the primary issue!" | tee -a "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "### Fix Required:" >> "$REPORT_FILE"
    echo '```bash' >> "$REPORT_FILE"
    echo '# Create KV namespace' >> "$REPORT_FILE"
    echo 'wrangler kv:namespace create KV --preview' >> "$REPORT_FILE"
    echo '' >> "$REPORT_FILE"
    echo '# Add to wrangler.toml:' >> "$REPORT_FILE"
    echo '[[kv_namespaces]]' >> "$REPORT_FILE"
    echo 'binding = "KV"' >> "$REPORT_FILE"
    echo 'id = "YOUR_KV_ID"' >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
fi

echo "" | tee -a "$REPORT_FILE"

# Test 2: Check cache key patterns
echo "2️⃣ Testing cache key generation..."
echo "## 2. Cache Key Patterns" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Make identical requests to check cache keys
echo "Testing identical requests for cache key consistency:" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

for i in 1 2 3; do
    echo "Request $i:" >> "$REPORT_FILE"
    response=$(curl -s -w "\n===METRICS===\nTime: %{time_total}s\nHTTP: %{http_code}" \
        -H "Accept: application/json" \
        -D - "$API_URL/api/pitches/browse/enhanced?limit=5&sort=newest" 2>/dev/null)
    
    cache_status=$(echo "$response" | grep -i "x-cache-status:" | cut -d: -f2 | tr -d ' \r' || echo "NONE")
    x_response_time=$(echo "$response" | grep -i "x-response-time:" | cut -d: -f2 | tr -d ' \r' || echo "N/A")
    
    echo "- Cache Status: $cache_status" >> "$REPORT_FILE"
    echo "- Response Time: $x_response_time" >> "$REPORT_FILE"
    
    if [ $i -eq 1 ]; then
        echo "  (First request - expected MISS)" >> "$REPORT_FILE"
    else
        if [ "$cache_status" = "HIT" ]; then
            echo "  ✅ Cache working!" >> "$REPORT_FILE"
        else
            echo "  ❌ Should be HIT but got $cache_status" >> "$REPORT_FILE"
        fi
    fi
    
    sleep 1
done

echo "" >> "$REPORT_FILE"

# Test 3: Check different parameter orders
echo "3️⃣ Testing parameter order sensitivity..."
echo "## 3. Parameter Order Sensitivity" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Test same params, different order
urls=(
    "/api/pitches/browse/enhanced?limit=5&sort=newest"
    "/api/pitches/browse/enhanced?sort=newest&limit=5"
)

echo "Testing if parameter order affects cache keys:" >> "$REPORT_FILE"
for url in "${urls[@]}"; do
    response=$(curl -s -D - "$API_URL$url" -o /dev/null)
    cache_status=$(echo "$response" | grep -i "x-cache-status:" | cut -d: -f2 | tr -d ' \r' || echo "NONE")
    echo "- $url → Cache: $cache_status" >> "$REPORT_FILE"
done

echo "" >> "$REPORT_FILE"

# Test 4: Check cache headers
echo "4️⃣ Analyzing cache headers..."
echo "## 4. Cache Headers Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

response=$(curl -s -I "$API_URL/api/pitches/browse/enhanced?limit=5")
echo '```' >> "$REPORT_FILE"
echo "$response" | grep -i -E "(cache|cf-|x-)" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"

# Test 5: Check Cloudflare cache
echo "5️⃣ Testing Cloudflare edge cache..."
echo "## 5. Cloudflare Edge Cache" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

cf_cache_status=$(echo "$response" | grep -i "cf-cache-status:" | cut -d: -f2 | tr -d ' \r' || echo "NONE")
if [ "$cf_cache_status" = "HIT" ]; then
    echo "✅ Cloudflare cache is working" >> "$REPORT_FILE"
else
    echo "⚠️ Cloudflare cache status: $cf_cache_status" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "### Possible Issues:" >> "$REPORT_FILE"
    echo "1. Missing Cache-Control headers" >> "$REPORT_FILE"
    echo "2. Cache Rules not configured in Cloudflare" >> "$REPORT_FILE"
    echo "3. Query strings preventing caching" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"

# Generate fixes
echo "## 🔧 Recommended Fixes" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

cat >> "$REPORT_FILE" <<'EOF'
### Priority 1: Fix Cache Key Generation

The main issue is inconsistent cache key generation. Here's the fix:

```typescript
// src/utils/edge-cache.ts - Update generateKey method
private generateKey(key: string, params?: Record<string, any>): string {
  // Normalize the key path
  const normalizedKey = key.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
  
  if (!params || Object.keys(params).length === 0) {
    return `${this.prefix}:${normalizedKey}`;
  }
  
  // Sort params for consistent keys
  const sorted = Object.keys(params)
    .sort()
    .filter(k => params[k] !== undefined && params[k] !== '')
    .map(k => `${k}:${params[k]}`)
    .join('|');
  
  return `${this.prefix}:${normalizedKey}:${sorted}`;
}
```

### Priority 2: Fix Performance Middleware

Update the cache path normalization:

```typescript
// src/middleware/performance.ts - Update getCachedResponse
async getCachedResponse(request: Request): Promise<Response | null> {
  if (!this.cache || !this.options.enableCache) {
    return null;
  }

  if (request.method !== 'GET') {
    return null;
  }

  const url = new URL(request.url);
  // Normalize path - remove /api prefix if present
  let cacheKey = url.pathname;
  if (cacheKey.startsWith('/api/')) {
    cacheKey = cacheKey.substring(4); // Remove /api prefix
  }
  
  const params = Object.fromEntries(url.searchParams);
  
  const cached = await this.cache.get(cacheKey, params);
  // ... rest of method
}
```

### Priority 3: Add Cache Warming

Add a cache warming endpoint:

```typescript
// Add to worker
if (path === '/api/admin/warm-cache') {
  const endpoints = [
    '/api/pitches/browse/enhanced?limit=5',
    '/api/pitches/browse/enhanced?limit=10&sort=newest',
    '/api/pitches?limit=10'
  ];
  
  for (const endpoint of endpoints) {
    const url = new URL(endpoint, request.url);
    await fetch(url.toString());
  }
  
  return corsResponse(request, { 
    success: true, 
    warmed: endpoints.length 
  });
}
```

### Priority 4: Configure Cloudflare Cache Rules

Add these Page Rules in Cloudflare Dashboard:
1. `*api/pitches*` → Cache Level: Standard, Edge Cache TTL: 5 minutes
2. `*api/health*` → Cache Level: Bypass
3. `*api/auth*` → Cache Level: Bypass

### Priority 5: Add Cache Debugging

Enable cache debugging in development:

```typescript
// Add to EdgeCache class
async get<T>(key: string, params?: Record<string, any>): Promise<T | null> {
  const cacheKey = this.generateKey(key, params);
  
  // Add debug logging
  if (process.env.DEBUG_CACHE === 'true') {
    console.log(`[CACHE] Checking key: ${cacheKey}`);
  }
  
  const cached = await this.kv.get(cacheKey, 'json');
  
  if (cached) {
    console.log(`[CACHE] HIT: ${cacheKey}`);
    return cached as T;
  }
  
  console.log(`[CACHE] MISS: ${cacheKey}`);
  return null;
}
```
EOF

echo "" >> "$REPORT_FILE"
echo "## Summary" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if [ "$has_cache" != "true" ]; then
    echo "❌ **Critical Issue:** KV namespace is not configured. Cache cannot work without it." >> "$REPORT_FILE"
else
    echo "⚠️ **Main Issue:** Cache keys are not matching due to path/parameter inconsistencies." >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "Report saved to: $REPORT_FILE" >> "$REPORT_FILE"

echo ""
echo "✅ Diagnostic complete!"
echo "📄 Report: $REPORT_FILE"
echo ""
echo "Key Findings:"
if [ "$has_cache" != "true" ]; then
    echo "❌ KV namespace NOT configured - cache cannot work!"
    echo "   Run: wrangler kv:namespace create KV"
else
    echo "⚠️ Cache keys not matching - needs code fixes"
fi