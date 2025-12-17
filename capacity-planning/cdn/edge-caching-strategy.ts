/**
 * CDN and Edge Caching Optimization Strategy
 * Cloudflare-specific caching rules and edge distribution
 */

export interface CacheRule {
  pattern: string;
  ttl: number; // seconds
  cacheLevel: 'bypass' | 'basic' | 'simplified' | 'aggressive' | 'cache_everything';
  edgeTTL?: number;
  browserTTL?: number;
  bypassConditions?: string[];
  purgeStrategy?: 'tag' | 'prefix' | 'exact';
}

export interface EdgeLocation {
  region: string;
  pop: string; // Point of Presence
  tier: 'premium' | 'standard' | 'china';
  latency: number; // ms to origin
}

export interface CacheMetrics {
  hitRate: number;
  bandwidth: number;
  requests: number;
  dataCached: number;
  costSavings: number;
}

export class EdgeCachingStrategy {
  // Cloudflare's global network
  private static readonly EDGE_LOCATIONS: EdgeLocation[] = [
    // Tier 1 - Premium POPs
    { region: 'us-west', pop: 'LAX', tier: 'premium', latency: 10 },
    { region: 'us-east', pop: 'EWR', tier: 'premium', latency: 15 },
    { region: 'eu-west', pop: 'LHR', tier: 'premium', latency: 20 },
    { region: 'eu-central', pop: 'FRA', tier: 'premium', latency: 25 },
    { region: 'asia-pacific', pop: 'SIN', tier: 'premium', latency: 30 },
    { region: 'asia-northeast', pop: 'NRT', tier: 'premium', latency: 35 },
    // Tier 2 - Standard POPs
    { region: 'south-america', pop: 'GRU', tier: 'standard', latency: 50 },
    { region: 'africa', pop: 'JNB', tier: 'standard', latency: 60 },
    { region: 'middle-east', pop: 'DXB', tier: 'standard', latency: 45 },
    { region: 'oceania', pop: 'SYD', tier: 'standard', latency: 40 },
    // China Network (requires separate license)
    { region: 'china', pop: 'PEK', tier: 'china', latency: 70 },
    { region: 'china', pop: 'SHA', tier: 'china', latency: 75 }
  ];

  // Optimized cache rules by content type
  private static readonly CACHE_RULES: CacheRule[] = [
    // Static assets - aggressive caching
    {
      pattern: '/static/*',
      ttl: 31536000, // 1 year
      cacheLevel: 'cache_everything',
      browserTTL: 2592000, // 30 days
      edgeTTL: 31536000,
      purgeStrategy: 'tag'
    },
    // Images and media
    {
      pattern: '*.{jpg,jpeg,png,gif,svg,webp,ico,mp4,webm}',
      ttl: 86400 * 30, // 30 days
      cacheLevel: 'cache_everything',
      browserTTL: 86400 * 7, // 7 days
      edgeTTL: 86400 * 30,
      purgeStrategy: 'prefix'
    },
    // API responses - selective caching
    {
      pattern: '/api/public/*',
      ttl: 300, // 5 minutes
      cacheLevel: 'simplified',
      edgeTTL: 300,
      browserTTL: 0, // No browser cache
      bypassConditions: ['cookie:session', 'header:authorization']
    },
    // User dashboards - dynamic content
    {
      pattern: '/api/dashboard/*',
      ttl: 60, // 1 minute
      cacheLevel: 'basic',
      edgeTTL: 60,
      browserTTL: 0,
      bypassConditions: ['cookie:session']
    },
    // Search results
    {
      pattern: '/api/search/*',
      ttl: 600, // 10 minutes
      cacheLevel: 'simplified',
      edgeTTL: 600,
      browserTTL: 60
    },
    // WebSocket endpoints - no cache
    {
      pattern: '/ws/*',
      ttl: 0,
      cacheLevel: 'bypass',
      bypassConditions: ['*']
    },
    // Authentication - never cache
    {
      pattern: '/api/auth/*',
      ttl: 0,
      cacheLevel: 'bypass',
      bypassConditions: ['*']
    }
  ];

  /**
   * Generate Cloudflare Worker cache configuration
   */
  static generateWorkerCacheConfig(): string {
    return `
// Cloudflare Worker cache configuration
export const cacheConfig = {
  // Cache API configuration
  cacheApi: {
    cacheName: 'pitchey-cache-v1',
    defaultTTL: 3600,
    maxAge: 86400,
    sMaxAge: 86400,
    staleWhileRevalidate: 60,
    staleIfError: 86400
  },

  // KV cache configuration
  kvCache: {
    namespace: 'CACHE_KV',
    defaultTTL: 300,
    compressionThreshold: 1024 // Compress if > 1KB
  },

  // Cache tags for purging
  cacheTags: {
    static: 'static-assets',
    api: 'api-responses',
    user: (userId: string) => \`user-\${userId}\`,
    pitch: (pitchId: string) => \`pitch-\${pitchId}\`,
    dashboard: 'dashboard-data'
  }
};

// Cache handler middleware
export async function handleCache(request: Request, env: any): Promise<Response | null> {
  const url = new URL(request.url);
  const cacheKey = new Request(url.toString(), request);
  const cache = caches.default;

  // Check if request should bypass cache
  if (shouldBypassCache(request)) {
    return null;
  }

  // Try to get from cache
  let response = await cache.match(cacheKey);

  if (response) {
    // Add cache hit header
    response = new Response(response.body, response);
    response.headers.set('CF-Cache-Status', 'HIT');
    response.headers.set('Age', calculateAge(response));
    return response;
  }

  return null; // Cache miss
}

// Store response in cache
export async function storeInCache(
  request: Request,
  response: Response,
  ttl: number = 3600
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);

  // Clone response for caching
  const responseToCache = response.clone();

  // Add cache headers
  const headers = new Headers(responseToCache.headers);
  headers.set('Cache-Control', \`public, max-age=\${ttl}\`);
  headers.set('CF-Cache-Status', 'MISS');
  headers.set('CF-Cache-Tag', getCacheTags(request));

  const cachedResponse = new Response(responseToCache.body, {
    status: responseToCache.status,
    statusText: responseToCache.statusText,
    headers
  });

  // Store in cache
  await cache.put(cacheKey, cachedResponse);

  return response;
}

// Intelligent cache key generation
export function generateCacheKey(request: Request): string {
  const url = new URL(request.url);
  const method = request.method;
  const acceptEncoding = request.headers.get('Accept-Encoding') || '';
  const acceptLanguage = request.headers.get('Accept-Language') || 'en';
  
  // Include important query params
  const importantParams = ['page', 'limit', 'sort', 'filter'];
  const queryParams = new URLSearchParams();
  
  for (const param of importantParams) {
    const value = url.searchParams.get(param);
    if (value) {
      queryParams.set(param, value);
    }
  }

  // Generate cache key
  const baseKey = \`\${method}:\${url.pathname}\`;
  const paramsKey = queryParams.toString();
  const variantKey = \`\${acceptEncoding}:\${acceptLanguage}\`;
  
  return \`\${baseKey}?\${paramsKey}#\${variantKey}\`;
}

// Cache warming for critical paths
export async function warmCache(env: any): Promise<void> {
  const criticalPaths = [
    '/api/public/trending',
    '/api/public/featured',
    '/api/public/categories'
  ];

  const promises = criticalPaths.map(async (path) => {
    const request = new Request(\`https://pitchey.com\${path}\`);
    const response = await fetch(request);
    await storeInCache(request, response, 3600);
  });

  await Promise.all(promises);
}
`;
  }

  /**
   * Generate cache purge strategies
   */
  static generatePurgeStrategies(): {
    tagBased: string;
    prefixBased: string;
    selective: string;
    full: string;
  } {
    return {
      tagBased: `
// Tag-based cache purging
export async function purgeByTag(tag: string, env: any): Promise<void> {
  const apiToken = env.CF_API_TOKEN;
  const zoneId = env.CF_ZONE_ID;
  
  const response = await fetch(
    \`https://api.cloudflare.com/client/v4/zones/\${zoneId}/purge_cache\`,
    {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${apiToken}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tags: [tag]
      })
    }
  );
  
  if (!response.ok) {
    throw new Error(\`Failed to purge cache tag: \${tag}\`);
  }
}
`,
      prefixBased: `
// Prefix-based cache purging
export async function purgeByPrefix(prefix: string, env: any): Promise<void> {
  const apiToken = env.CF_API_TOKEN;
  const zoneId = env.CF_ZONE_ID;
  
  const response = await fetch(
    \`https://api.cloudflare.com/client/v4/zones/\${zoneId}/purge_cache\`,
    {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${apiToken}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prefixes: [\`https://pitchey.com\${prefix}\`]
      })
    }
  );
  
  if (!response.ok) {
    throw new Error(\`Failed to purge cache prefix: \${prefix}\`);
  }
}
`,
      selective: `
// Selective cache purging based on patterns
export async function selectivePurge(
  patterns: string[],
  env: any
): Promise<void> {
  const files = patterns.map(pattern => \`https://pitchey.com\${pattern}\`);
  
  const response = await fetch(
    \`https://api.cloudflare.com/client/v4/zones/\${env.CF_ZONE_ID}/purge_cache\`,
    {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${env.CF_API_TOKEN}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ files })
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to purge selected cache entries');
  }
}
`,
      full: `
// Full cache purge (use sparingly)
export async function purgeEverything(env: any): Promise<void> {
  const response = await fetch(
    \`https://api.cloudflare.com/client/v4/zones/\${env.CF_ZONE_ID}/purge_cache\`,
    {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${env.CF_API_TOKEN}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        purge_everything: true
      })
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to purge entire cache');
  }
}
`
    };
  }

  /**
   * Calculate optimal cache distribution
   */
  static calculateCacheDistribution(
    totalCacheSizeGB: number,
    regions: Record<string, number> // region -> traffic percentage
  ): Record<string, {
    sizeGB: number;
    ttl: number;
    preloadPriority: number;
  }> {
    const distribution: Record<string, any> = {};
    
    for (const [region, trafficPercentage] of Object.entries(regions)) {
      const location = this.EDGE_LOCATIONS.find(loc => loc.region === region);
      if (!location) continue;
      
      // Allocate cache based on traffic and latency
      const latencyFactor = 1 + (location.latency / 100);
      const sizeFactor = trafficPercentage * latencyFactor;
      
      distribution[region] = {
        sizeGB: totalCacheSizeGB * sizeFactor,
        ttl: this.calculateOptimalTTL(location.latency, trafficPercentage),
        preloadPriority: Math.round(trafficPercentage * 100)
      };
    }
    
    return distribution;
  }

  /**
   * Calculate optimal TTL based on latency and traffic
   */
  private static calculateOptimalTTL(latency: number, trafficPercentage: number): number {
    // Higher latency = longer TTL
    // Higher traffic = shorter TTL (more updates)
    const latencyFactor = Math.min(latency / 10, 10); // 1-10x multiplier
    const trafficFactor = Math.max(1 - trafficPercentage, 0.1); // 0.1-1x multiplier
    
    const baseTTL = 300; // 5 minutes base
    return Math.round(baseTTL * latencyFactor * trafficFactor);
  }

  /**
   * Generate cache warming schedule
   */
  static generateCacheWarmingSchedule(
    peakHours: number[], // Array of peak hours (0-23)
    criticalEndpoints: string[]
  ): Array<{
    cronExpression: string;
    endpoints: string[];
    priority: 'high' | 'medium' | 'low';
  }> {
    const schedule = [];
    
    // Pre-warm cache 30 minutes before peak hours
    for (const hour of peakHours) {
      const warmHour = hour === 0 ? 23 : hour - 1;
      const warmMinute = 30;
      
      schedule.push({
        cronExpression: `${warmMinute} ${warmHour} * * *`,
        endpoints: criticalEndpoints,
        priority: 'high' as const
      });
    }
    
    // Regular cache warming every 4 hours
    schedule.push({
      cronExpression: '0 */4 * * *',
      endpoints: criticalEndpoints.filter(ep => ep.includes('/public/')),
      priority: 'medium' as const
    });
    
    // Daily full cache warming at 3 AM
    schedule.push({
      cronExpression: '0 3 * * *',
      endpoints: criticalEndpoints,
      priority: 'low' as const
    });
    
    return schedule;
  }

  /**
   * Calculate cache hit rate improvements
   */
  static projectCacheImprovements(
    currentMetrics: CacheMetrics,
    optimizations: {
      addTieredCache: boolean;
      increaseT TL: boolean;
      implementSmartInvalidation: boolean;
      enableStaleWhileRevalidate: boolean;
    }
  ): {
    projectedHitRate: number;
    bandwidthSavings: number;
    costSavings: number;
    responseTimeImprovement: number;
  } {
    let hitRateImprovement = 0;
    
    if (optimizations.addTieredCache) {
      hitRateImprovement += 0.15; // 15% improvement
    }
    if (optimizations.increaseTTL) {
      hitRateImprovement += 0.10; // 10% improvement
    }
    if (optimizations.implementSmartInvalidation) {
      hitRateImprovement += 0.08; // 8% improvement
    }
    if (optimizations.enableStaleWhileRevalidate) {
      hitRateImprovement += 0.05; // 5% improvement
    }
    
    const projectedHitRate = Math.min(
      currentMetrics.hitRate + hitRateImprovement,
      0.95 // Maximum realistic hit rate
    );
    
    // Calculate savings
    const hitRateDelta = projectedHitRate - currentMetrics.hitRate;
    const bandwidthSavings = currentMetrics.bandwidth * hitRateDelta;
    const costSavings = bandwidthSavings * 0.08; // $0.08 per GB
    const responseTimeImprovement = hitRateDelta * 200; // 200ms improvement per hit
    
    return {
      projectedHitRate,
      bandwidthSavings,
      costSavings,
      responseTimeImprovement
    };
  }

  /**
   * Generate Cloudflare Page Rules for optimization
   */
  static generatePageRules(): string {
    return `
# Cloudflare Page Rules Configuration

# Rule 1: Cache Everything for Static Assets
URL Pattern: pitchey.com/static/*
Settings:
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month
- Browser Cache TTL: 1 week
- Bypass Cache on Cookie: session=*

# Rule 2: API Caching with Conditions
URL Pattern: pitchey.com/api/public/*
Settings:
- Cache Level: Standard
- Edge Cache TTL: 5 minutes
- Bypass Cache on Cookie: auth_token=*
- Cache Key: ${uri}?${args}

# Rule 3: Aggressive Caching for Media
URL Pattern: pitchey.com/media/*
Settings:
- Cache Level: Cache Everything
- Edge Cache TTL: 1 year
- Browser Cache TTL: 1 month
- Polish: Lossy
- Mirage: On
- WebP: On

# Rule 4: Dynamic Content Optimization
URL Pattern: pitchey.com/dashboard/*
Settings:
- Cache Level: Bypass
- Security Level: High
- SSL: Full (Strict)
- Always Use HTTPS: On

# Rule 5: Search Results Caching
URL Pattern: pitchey.com/api/search?*
Settings:
- Cache Level: Standard
- Edge Cache TTL: 10 minutes
- Cache Key: ${uri}?q=${arg_q}&sort=${arg_sort}
- Origin Cache Control: On

# Rule 6: WebSocket Bypass
URL Pattern: pitchey.com/ws/*
Settings:
- Cache Level: Bypass
- WebSockets: On
- SSL: Full

# Rule 7: Rate Limiting for Auth
URL Pattern: pitchey.com/api/auth/*
Settings:
- Cache Level: Bypass
- Rate Limiting: 10 requests per minute per IP
- Challenge Passage: 30 minutes

# Rule 8: Geo-based Routing
URL Pattern: pitchey.com/*
Settings:
- Cache Level: Standard
- Edge Cache TTL: by region
- Load Balancing: Geo Steering
`;
  }
}

// Export utility functions
export function getCacheRule(path: string): CacheRule | undefined {
  return EdgeCachingStrategy['CACHE_RULES'].find(rule => {
    const pattern = new RegExp(rule.pattern.replace('*', '.*'));
    return pattern.test(path);
  });
}

export function shouldCache(request: Request): boolean {
  const url = new URL(request.url);
  const method = request.method;
  
  // Only cache GET requests
  if (method !== 'GET') return false;
  
  // Check for bypass conditions
  const hasAuthHeader = request.headers.has('Authorization');
  const hasSessionCookie = request.headers.get('Cookie')?.includes('session');
  
  if (hasAuthHeader || hasSessionCookie) return false;
  
  // Check if path matches cache rules
  const rule = getCacheRule(url.pathname);
  return rule ? rule.cacheLevel !== 'bypass' : false;
}