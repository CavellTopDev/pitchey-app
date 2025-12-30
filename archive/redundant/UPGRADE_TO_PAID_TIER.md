# Upgrading from Free to Paid Cloudflare Tier

## When to Upgrade

Monitor these metrics in your Free Tier Dashboard (`/admin/free-tier-monitor`):

### 🚨 **Critical Triggers** (Upgrade Immediately)
- Daily requests consistently > 90,000
- CPU violations > 100/day
- KV storage approaching 900MB
- Rate limiting blocking > 10% of requests

### ⚠️ **Warning Triggers** (Plan Upgrade)
- Daily requests consistently > 75,000
- P95 CPU time > 8ms
- Cache hit rate < 70%
- Users reporting slow performance

### 📈 **Growth Triggers** (Natural Upgrade)
- More than 500 daily active users
- Need for real-time features
- File upload requirements
- Advanced analytics needed

## Cloudflare Paid Plans

### Workers Paid ($5/month)
**New Limits:**
- 10 million requests/month (333k/day)
- 30 seconds CPU time per request
- Durable Objects enabled
- WebSocket support
- Workers KV: 1GB free + $0.50/GB

**Perfect for:**
- Growing startups
- Real-time features needed
- Moderate traffic (< 10k users)

### Workers Bundled ($20/month)
**New Limits:**
- 50 million requests included
- 50ms CPU time per request
- Advanced analytics
- Queues included
- R2 storage included (10GB)

**Perfect for:**
- Production applications
- High traffic sites
- File storage needs

## Migration Steps

### Step 1: Update wrangler.toml

```toml
# Enable previously disabled features
[[kv_namespaces]]
binding = "SESSIONS_KV"
id = "your-sessions-kv-id"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-rate-limit-kv-id"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "pitchey-uploads"

[[durable_objects.bindings]]
name = "WEBSOCKET_SESSIONS"
class_name = "WebSocketDurableObject"

# Increase CPU limit
[limits]
cpu_ms = 50  # or remove entirely

# Enable analytics
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "pitchey_analytics"

# Enable queues
[[queues.producers]]
binding = "NOTIFICATION_QUEUE"
queue = "notification-processing"
```

### Step 2: Enable WebSocket Support

1. **Uncomment WebSocket imports in worker-integrated.ts:**
```typescript
import { WebSocketDurableObject } from './websocket-durable-object';

// Remove the stub class
// class WebSocketDurableObject { ... }
```

2. **Update WebSocket handler:**
```typescript
private async handleWebSocketUpgrade(request: Request): Promise<Response> {
  // Implement real WebSocket upgrade
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  // Connect to Durable Object
  const id = this.env.WEBSOCKET_SESSIONS.idFromName(userId);
  const stub = this.env.WEBSOCKET_SESSIONS.get(id);
  return stub.fetch(request);
}
```

3. **Create Durable Object class:**
```typescript
// src/websocket-durable-object.ts
export class WebSocketDurableObject {
  state: DurableObjectState;
  sessions: Set<WebSocket>;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.sessions = new Set();
  }

  async fetch(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    this.handleSession(server);
    
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  handleSession(webSocket: WebSocket) {
    webSocket.accept();
    this.sessions.add(webSocket);
    
    webSocket.addEventListener('message', async (msg) => {
      // Broadcast to all connected clients
      this.broadcast(msg.data);
    });
    
    webSocket.addEventListener('close', () => {
      this.sessions.delete(webSocket);
    });
  }
  
  broadcast(message: string) {
    this.sessions.forEach(session => {
      try {
        session.send(message);
      } catch (err) {
        this.sessions.delete(session);
      }
    });
  }
}
```

### Step 3: Update Frontend

1. **Switch back to WebSocket in App.tsx:**
```typescript
import { WebSocketProvider } from './contexts/WebSocketContext';
// Remove: import { PollingProvider } from './contexts/PollingContext';

// In component:
<WebSocketProvider>
  {/* Your app */}
</WebSocketProvider>
```

2. **Update environment variables:**
```env
VITE_ENABLE_WEBSOCKET=true
VITE_POLL_INTERVAL=0
```

### Step 4: Enable R2 Storage

1. **Create R2 bucket:**
```bash
wrangler r2 bucket create pitchey-uploads
```

2. **Update upload handler:**
```typescript
private async handleUpload(request: Request): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  
  if (!file) {
    return new Response('No file uploaded', { status: 400 });
  }
  
  const key = `uploads/${Date.now()}-${file.name}`;
  await this.env.R2_BUCKET.put(key, file.stream());
  
  return new Response(JSON.stringify({ 
    url: `/api/files/${key}`,
    key 
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Step 5: Remove Free Tier Optimizations

1. **Remove aggressive caching:**
```typescript
// Reduce cache TTLs for better freshness
export const CACHE_CONFIGS = {
  browse: { ttl: 60 },     // Was 300
  profile: { ttl: 30 },     // Was 60
  dashboard: { ttl: 10 },   // Was 30
  static: { ttl: 3600 },    // Keep same
};
```

2. **Relax rate limiting:**
```typescript
export const RATE_LIMIT_CONFIGS = {
  auth: { limit: 10, window: 60 },    // Was 5
  api: { limit: 100, window: 60 },    // Was 30
  upload: { limit: 10, window: 300 }, // Was 2
};
```

3. **Remove CPU time optimizations:**
- Re-enable complex queries
- Remove connection pooling limits
- Enable full analytics

### Step 6: Deploy

```bash
# Update secrets if needed
wrangler secret put STRIPE_SECRET_KEY

# Deploy to production
wrangler deploy --env production

# Verify deployment
curl https://your-worker.workers.dev/api/health
```

## Performance Comparison

| Feature | Free Tier | Paid ($5/month) | Improvement |
|---------|-----------|-----------------|-------------|
| Daily Requests | 100,000 | 333,000 | 3.3x |
| CPU Time | 10ms | 30,000ms | 3000x |
| WebSocket | ❌ | ✅ | Real-time |
| File Upload | ❌ | ✅ (R2) | Enabled |
| Cache Storage | 1GB | Unlimited* | Scalable |
| Analytics | ❌ | ✅ | Full metrics |
| Queues | ❌ | ✅ | Background jobs |

*Additional charges apply for storage over included amounts

## Cost Calculator

### Monthly Costs (Estimated)
```
Base Plan: $5/month
+ R2 Storage (10GB): ~$0.15/month
+ KV Operations (1M): ~$0.50/month
+ Additional requests: $0.50/million
--------------------------------
Total: ~$6-10/month for most apps
```

### When to go Enterprise
- Over 50 million requests/month
- Need guaranteed uptime SLA
- Require dedicated support
- Custom security requirements

## Rollback Plan

If you need to rollback to free tier:

1. **Disable paid features in wrangler.toml**
2. **Switch frontend back to polling**
3. **Re-enable aggressive caching**
4. **Increase rate limiting**
5. **Deploy with:** `wrangler deploy --env free-tier`

## Support

- Cloudflare Dashboard: https://dash.cloudflare.com
- Workers Discord: https://discord.gg/cloudflaredev
- Documentation: https://developers.cloudflare.com/workers/

## Checklist

Before upgrading:
- [ ] Backup current configuration
- [ ] Test in development environment
- [ ] Update environment variables
- [ ] Prepare rollback plan
- [ ] Schedule maintenance window
- [ ] Notify users of improvements

After upgrading:
- [ ] Verify WebSocket connectivity
- [ ] Test file uploads
- [ ] Check analytics dashboard
- [ ] Monitor performance metrics
- [ ] Update documentation
- [ ] Remove "free tier" warnings from UI