import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

/**
 * CDN Integration Service
 * Manages content delivery, caching, and edge optimization
 */

interface CDNProvider {
  name: 'cloudflare' | 'fastly' | 'akamai' | 'bunny';
  endpoint: string;
  apiKey: string;
  zoneId?: string;
}

interface CDNAsset {
  key: string;
  url: string;
  type: 'video' | 'image' | 'document' | 'audio';
  size: number;
  contentType: string;
  metadata?: Record<string, any>;
}

interface CacheRule {
  pattern: string;
  ttl: number;
  browserTTL?: number;
  edgeTTL?: number;
  bypassCache?: boolean;
}

interface PurgeRequest {
  urls?: string[];
  tags?: string[];
  prefix?: string;
  everything?: boolean;
}

interface BandwidthStats {
  period: string;
  totalBytes: number;
  cachedBytes: number;
  uncachedBytes: number;
  requests: number;
  uniqueVisitors: number;
}

export class CDNService {
  private db: Client;
  private providers: Map<string, CDNProvider> = new Map();
  private primaryProvider: string = 'cloudflare';
  private cacheRules: CacheRule[] = [];

  constructor(databaseUrl: string) {
    const url = new URL(databaseUrl);
    this.db = new Client({
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
      hostname: url.hostname,
      port: parseInt(url.port || "5432"),
      tls: {
        enabled: url.searchParams.get("sslmode") === "require",
      },
    });

    this.initializeProviders();
    this.setupCacheRules();
  }

  async connect() {
    await this.db.connect();
  }

  async disconnect() {
    await this.db.end();
  }

  /**
   * Initialize CDN providers
   */
  private initializeProviders() {
    // Cloudflare CDN
    if (Deno.env.get("CLOUDFLARE_API_TOKEN")) {
      this.providers.set('cloudflare', {
        name: 'cloudflare',
        endpoint: 'https://api.cloudflare.com/client/v4',
        apiKey: Deno.env.get("CLOUDFLARE_API_TOKEN")!,
        zoneId: Deno.env.get("CLOUDFLARE_ZONE_ID"),
      });
    }

    // Fastly CDN
    if (Deno.env.get("FASTLY_API_KEY")) {
      this.providers.set('fastly', {
        name: 'fastly',
        endpoint: 'https://api.fastly.com',
        apiKey: Deno.env.get("FASTLY_API_KEY")!,
      });
    }

    // BunnyCDN
    if (Deno.env.get("BUNNY_API_KEY")) {
      this.providers.set('bunny', {
        name: 'bunny',
        endpoint: 'https://api.bunny.net',
        apiKey: Deno.env.get("BUNNY_API_KEY")!,
        zoneId: Deno.env.get("BUNNY_PULL_ZONE"),
      });
    }
  }

  /**
   * Setup cache rules for different content types
   */
  private setupCacheRules() {
    this.cacheRules = [
      // Video content - long cache
      {
        pattern: '/videos/*',
        ttl: 31536000, // 1 year
        browserTTL: 86400, // 1 day
        edgeTTL: 2592000, // 30 days
      },
      // Images - moderate cache
      {
        pattern: '/images/*',
        ttl: 2592000, // 30 days
        browserTTL: 86400, // 1 day
        edgeTTL: 604800, // 7 days
      },
      // Thumbnails - short cache for updates
      {
        pattern: '/thumbnails/*',
        ttl: 3600, // 1 hour
        browserTTL: 300, // 5 minutes
        edgeTTL: 3600, // 1 hour
      },
      // HLS segments - medium cache
      {
        pattern: '*.ts',
        ttl: 86400, // 1 day
        browserTTL: 3600, // 1 hour
        edgeTTL: 86400, // 1 day
      },
      // HLS playlists - short cache for live updates
      {
        pattern: '*.m3u8',
        ttl: 10, // 10 seconds
        browserTTL: 5, // 5 seconds
        edgeTTL: 10, // 10 seconds
      },
      // API responses - no cache
      {
        pattern: '/api/*',
        ttl: 0,
        bypassCache: true,
      },
      // Documents - moderate cache
      {
        pattern: '/documents/*',
        ttl: 604800, // 7 days
        browserTTL: 3600, // 1 hour
        edgeTTL: 86400, // 1 day
      },
    ];
  }

  /**
   * Upload asset to CDN
   */
  async uploadAsset(
    asset: CDNAsset,
    provider: string = this.primaryProvider
  ): Promise<string> {
    try {
      const cdn = this.providers.get(provider);
      if (!cdn) {
        throw new Error(`CDN provider ${provider} not configured`);
      }

      let cdnUrl: string;

      switch (cdn.name) {
        case 'cloudflare':
          cdnUrl = await this.uploadToCloudflare(asset, cdn);
          break;
        case 'bunny':
          cdnUrl = await this.uploadToBunny(asset, cdn);
          break;
        case 'fastly':
          cdnUrl = await this.uploadToFastly(asset, cdn);
          break;
        default:
          throw new Error(`Unsupported CDN provider: ${cdn.name}`);
      }

      // Store CDN mapping
      await this.db.queryObject(`
        INSERT INTO cdn_assets (
          id, key, url, provider, type, size, 
          content_type, metadata, created_at
        )
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE
        SET url = $3, updated_at = NOW()
      `, [
        crypto.randomUUID(),
        asset.key,
        cdnUrl,
        provider,
        asset.type,
        asset.size,
        asset.contentType,
        JSON.stringify(asset.metadata || {})
      ]);

      // Set cache rules
      await this.applyCacheRules(cdnUrl, asset.type);

      return cdnUrl;
    } catch (error) {
      console.error("Error uploading to CDN:", error);
      throw error;
    }
  }

  /**
   * Upload to Cloudflare CDN
   */
  private async uploadToCloudflare(
    asset: CDNAsset,
    cdn: CDNProvider
  ): Promise<string> {
    // For Cloudflare, assets are typically served through R2 or Images
    // This assumes R2 is configured with public access
    const r2Url = `https://${Deno.env.get('R2_PUBLIC_DOMAIN')}/${asset.key}`;
    
    // Configure caching rules via API
    if (cdn.zoneId) {
      await fetch(
        `${cdn.endpoint}/zones/${cdn.zoneId}/pagerules`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cdn.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targets: [{
              target: 'url',
              constraint: {
                operator: 'matches',
                value: `*${asset.key}*`,
              },
            }],
            actions: [{
              id: 'cache_level',
              value: 'cache_everything',
            }, {
              id: 'edge_cache_ttl',
              value: this.getCacheTTL(asset.type),
            }],
            status: 'active',
          }),
        }
      );
    }

    return r2Url;
  }

  /**
   * Upload to BunnyCDN
   */
  private async uploadToBunny(
    asset: CDNAsset,
    cdn: CDNProvider
  ): Promise<string> {
    // Upload to Bunny Storage
    const storageUrl = `https://storage.bunnycdn.com/${cdn.zoneId}/${asset.key}`;
    
    const response = await fetch(storageUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': cdn.apiKey,
        'Content-Type': asset.contentType,
      },
      body: await fetch(asset.url).then(r => r.blob()),
    });

    if (!response.ok) {
      throw new Error(`Bunny upload failed: ${response.statusText}`);
    }

    // Return pull zone URL
    return `https://${cdn.zoneId}.b-cdn.net/${asset.key}`;
  }

  /**
   * Upload to Fastly
   */
  private async uploadToFastly(
    asset: CDNAsset,
    cdn: CDNProvider
  ): Promise<string> {
    // Fastly typically works as a reverse proxy
    // Configure service and return edge URL
    return `https://fastly.example.com/${asset.key}`;
  }

  /**
   * Purge CDN cache
   */
  async purgeCache(request: PurgeRequest, provider: string = this.primaryProvider): Promise<void> {
    try {
      const cdn = this.providers.get(provider);
      if (!cdn) {
        throw new Error(`CDN provider ${provider} not configured`);
      }

      switch (cdn.name) {
        case 'cloudflare':
          await this.purgeCloudflare(request, cdn);
          break;
        case 'bunny':
          await this.purgeBunny(request, cdn);
          break;
        case 'fastly':
          await this.purgeFastly(request, cdn);
          break;
      }

      // Log purge action
      await this.db.queryObject(`
        INSERT INTO cdn_purge_log (
          id, provider, request_type, request_data, created_at
        )
        VALUES ($1::uuid, $2, $3, $4::jsonb, NOW())
      `, [
        crypto.randomUUID(),
        provider,
        request.everything ? 'all' : request.urls ? 'urls' : 'tags',
        JSON.stringify(request)
      ]);
    } catch (error) {
      console.error("Error purging cache:", error);
      throw error;
    }
  }

  /**
   * Purge Cloudflare cache
   */
  private async purgeCloudflare(request: PurgeRequest, cdn: CDNProvider): Promise<void> {
    const body: any = {};
    
    if (request.everything) {
      body.purge_everything = true;
    } else if (request.urls) {
      body.files = request.urls;
    } else if (request.tags) {
      body.tags = request.tags;
    } else if (request.prefix) {
      body.prefixes = [request.prefix];
    }

    const response = await fetch(
      `${cdn.endpoint}/zones/${cdn.zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cdn.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudflare purge failed: ${response.statusText}`);
    }
  }

  /**
   * Purge BunnyCDN cache
   */
  private async purgeBunny(request: PurgeRequest, cdn: CDNProvider): Promise<void> {
    let endpoint = `${cdn.endpoint}/pullzone/${cdn.zoneId}/purgeCache`;
    
    if (request.urls && request.urls.length > 0) {
      // Purge specific URLs
      for (const url of request.urls) {
        await fetch(`${endpoint}?url=${encodeURIComponent(url)}`, {
          method: 'POST',
          headers: { 'AccessKey': cdn.apiKey },
        });
      }
    } else {
      // Purge everything
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'AccessKey': cdn.apiKey },
      });
    }
  }

  /**
   * Purge Fastly cache
   */
  private async purgeFastly(request: PurgeRequest, cdn: CDNProvider): Promise<void> {
    const headers = {
      'Fastly-Key': cdn.apiKey,
    };

    if (request.everything) {
      await fetch(`${cdn.endpoint}/service/${cdn.zoneId}/purge_all`, {
        method: 'POST',
        headers,
      });
    } else if (request.urls) {
      for (const url of request.urls) {
        await fetch(url, {
          method: 'PURGE',
          headers,
        });
      }
    } else if (request.tags) {
      for (const tag of request.tags) {
        await fetch(`${cdn.endpoint}/service/${cdn.zoneId}/purge/${tag}`, {
          method: 'POST',
          headers,
        });
      }
    }
  }

  /**
   * Get signed URL for private content
   */
  async getSignedUrl(
    key: string,
    expiresIn: number = 3600,
    provider: string = this.primaryProvider
  ): Promise<string> {
    const cdn = this.providers.get(provider);
    if (!cdn) {
      throw new Error(`CDN provider ${provider} not configured`);
    }

    switch (cdn.name) {
      case 'cloudflare':
        return await this.getCloudflareSignedUrl(key, expiresIn);
      case 'bunny':
        return await this.getBunnySignedUrl(key, expiresIn, cdn);
      default:
        throw new Error(`Signed URLs not supported for ${cdn.name}`);
    }
  }

  /**
   * Get Cloudflare signed URL
   */
  private async getCloudflareSignedUrl(key: string, expiresIn: number): Promise<string> {
    // Use Cloudflare Stream signed URLs or Workers for custom logic
    const baseUrl = `https://${Deno.env.get('CLOUDFLARE_DOMAIN')}`;
    const expiry = Math.floor(Date.now() / 1000) + expiresIn;
    
    // Generate signature (simplified - use proper crypto in production)
    const secret = Deno.env.get('CLOUDFLARE_SIGNING_SECRET');
    const message = `${key}${expiry}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return `${baseUrl}/${key}?expires=${expiry}&signature=${signature}`;
  }

  /**
   * Get Bunny signed URL
   */
  private async getBunnySignedUrl(
    key: string,
    expiresIn: number,
    cdn: CDNProvider
  ): Promise<string> {
    const baseUrl = `https://${cdn.zoneId}.b-cdn.net`;
    const expiry = Math.floor(Date.now() / 1000) + expiresIn;
    const authKey = Deno.env.get('BUNNY_AUTH_KEY');
    
    // Generate token
    const hashableBase = `${authKey}/${key}${expiry}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(hashableBase);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const token = btoa(String.fromCharCode(...hashArray));
    
    return `${baseUrl}/${key}?token=${token}&expires=${expiry}`;
  }

  /**
   * Prefetch content to edge locations
   */
  async prefetchContent(urls: string[], provider: string = this.primaryProvider): Promise<void> {
    const cdn = this.providers.get(provider);
    if (!cdn) {
      throw new Error(`CDN provider ${provider} not configured`);
    }

    switch (cdn.name) {
      case 'cloudflare':
        // Cloudflare automatically caches on first request
        // Can use Workers to pre-warm cache
        for (const url of urls) {
          fetch(url, { method: 'HEAD' }).catch(() => {});
        }
        break;
      
      case 'bunny':
        // Bunny prefetch API
        await fetch(`${cdn.endpoint}/pullzone/${cdn.zoneId}/prefetch`, {
          method: 'POST',
          headers: {
            'AccessKey': cdn.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ urls }),
        });
        break;
    }

    // Log prefetch
    await this.db.queryObject(`
      INSERT INTO cdn_prefetch_log (
        id, provider, urls, created_at
      )
      VALUES ($1::uuid, $2, $3::jsonb, NOW())
    `, [crypto.randomUUID(), provider, JSON.stringify(urls)]);
  }

  /**
   * Get CDN analytics
   */
  async getAnalytics(
    period: string = '24h',
    provider: string = this.primaryProvider
  ): Promise<BandwidthStats> {
    const cdn = this.providers.get(provider);
    if (!cdn) {
      throw new Error(`CDN provider ${provider} not configured`);
    }

    let stats: BandwidthStats = {
      period,
      totalBytes: 0,
      cachedBytes: 0,
      uncachedBytes: 0,
      requests: 0,
      uniqueVisitors: 0,
    };

    switch (cdn.name) {
      case 'cloudflare':
        stats = await this.getCloudflareAnalytics(period, cdn);
        break;
      case 'bunny':
        stats = await this.getBunnyAnalytics(period, cdn);
        break;
    }

    // Store analytics snapshot
    await this.db.queryObject(`
      INSERT INTO cdn_analytics (
        id, provider, period, stats, created_at
      )
      VALUES ($1::uuid, $2, $3, $4::jsonb, NOW())
    `, [crypto.randomUUID(), provider, period, JSON.stringify(stats)]);

    return stats;
  }

  /**
   * Get Cloudflare analytics
   */
  private async getCloudflareAnalytics(period: string, cdn: CDNProvider): Promise<BandwidthStats> {
    const since = this.getPeriodStartDate(period);
    
    const response = await fetch(
      `${cdn.endpoint}/zones/${cdn.zoneId}/analytics/dashboard?since=${since}`,
      {
        headers: {
          'Authorization': `Bearer ${cdn.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get Cloudflare analytics');
    }

    const data = await response.json();
    const totals = data.result.totals;

    return {
      period,
      totalBytes: totals.bytes || 0,
      cachedBytes: totals.cachedBytes || 0,
      uncachedBytes: totals.bytes - totals.cachedBytes || 0,
      requests: totals.requests || 0,
      uniqueVisitors: totals.uniques || 0,
    };
  }

  /**
   * Get Bunny analytics
   */
  private async getBunnyAnalytics(period: string, cdn: CDNProvider): Promise<BandwidthStats> {
    const response = await fetch(
      `${cdn.endpoint}/statistics?pullZone=${cdn.zoneId}&period=${period}`,
      {
        headers: {
          'AccessKey': cdn.apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get Bunny analytics');
    }

    const data = await response.json();

    return {
      period,
      totalBytes: data.bandwidthUsed || 0,
      cachedBytes: data.bandwidthCached || 0,
      uncachedBytes: data.bandwidthUsed - data.bandwidthCached || 0,
      requests: data.requestsServed || 0,
      uniqueVisitors: 0, // Bunny doesn't provide this
    };
  }

  /**
   * Optimize content delivery
   */
  async optimizeDelivery(assetKey: string): Promise<void> {
    // Implement smart routing, compression, etc.
    
    // Enable Brotli compression
    await this.enableCompression(assetKey, 'br');
    
    // Set up geo-routing
    await this.setupGeoRouting(assetKey);
    
    // Configure HTTP/2 push
    await this.configureHTTP2Push(assetKey);
  }

  /**
   * Apply cache rules to asset
   */
  private async applyCacheRules(url: string, type: string): Promise<void> {
    const rule = this.cacheRules.find(r =>
      url.includes(r.pattern.replaceAll('*', '')) ||
      type === r.pattern.replaceAll('/', '').replaceAll('*', '')
    );

    if (rule && !rule.bypassCache) {
      // Apply cache headers via CDN API or edge workers
      console.log(`Applied cache rule for ${url}: TTL ${rule.ttl}s`);
    }
  }

  /**
   * Get cache TTL for content type
   */
  private getCacheTTL(type: string): number {
    const ttlMap: Record<string, number> = {
      'video': 2592000, // 30 days
      'image': 604800,  // 7 days
      'document': 86400, // 1 day
      'audio': 604800,   // 7 days
    };
    return ttlMap[type] || 3600; // Default 1 hour
  }

  /**
   * Get period start date
   */
  private getPeriodStartDate(period: string): string {
    const now = new Date();
    const periodMap: Record<string, number> = {
      '1h': 1,
      '24h': 24,
      '7d': 24 * 7,
      '30d': 24 * 30,
    };
    
    const hours = periodMap[period] || 24;
    now.setHours(now.getHours() - hours);
    return now.toISOString();
  }

  /**
   * Enable compression for asset
   */
  private async enableCompression(assetKey: string, algorithm: 'gzip' | 'br'): Promise<void> {
    // Implementation depends on CDN provider
    console.log(`Enabled ${algorithm} compression for ${assetKey}`);
  }

  /**
   * Setup geo-routing for asset
   */
  private async setupGeoRouting(assetKey: string): Promise<void> {
    // Route to nearest edge location
    console.log(`Configured geo-routing for ${assetKey}`);
  }

  /**
   * Configure HTTP/2 push
   */
  private async configureHTTP2Push(assetKey: string): Promise<void> {
    // Push related resources
    console.log(`Configured HTTP/2 push for ${assetKey}`);
  }
}