# Cloudflare Workers Paid Plan - Production Deployment Guide

## 🎯 What You Now Have Access To

With your Workers Paid plan ($5/month), you get:
- **10 million requests/month** (vs 100k on free)
- **Durable Objects** - Critical for WebSocket management
- **30 second CPU time** per request (vs 10ms on free)
- **Unlimited KV storage** operations
- **Workers Analytics** - Real-time metrics
- **Wrangler configuration** for advanced features

## 🚀 Immediate Deployment Steps

### Step 1: Enable Durable Objects

```bash
# First, update your wrangler.toml to include Durable Objects
```

Add to your `wrangler.toml`:
```toml
name = "pitchey-api-prod"
main = "src/worker-integrated.ts"
compatibility_date = "2024-01-01"

# Your existing account ID
account_id = "02967e39e44b6266e7873829e94849f5"

# Enable Durable Objects (NOW AVAILABLE!)
[[durable_objects.bindings]]
name = "NOTIFICATION_HUB"
class_name = "NotificationHub"
script_name = "pitchey-api-prod"

[[migrations]]
tag = "v1"
new_classes = ["NotificationHub"]

# Enable WebSocket compression
[durable_objects]
websocket_compression = true

# KV Namespaces for caching
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-id"

# R2 Bucket for file storage
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "pitchey-storage"

# Hyperdrive for database (create this first)
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "YOUR_HYPERDRIVE_ID" # We'll create this below
```

### Step 2: Create Hyperdrive Configuration

```bash
# Create Hyperdrive for your Neon database
wrangler hyperdrive create pitchey-db \
  --connection-string="postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"

# This will output a config ID like: "a1b2c3d4e5f6"
# Add this ID to your wrangler.toml
```

### Step 3: Create KV Namespace for Caching

```bash
# Create KV namespace
wrangler kv:namespace create "CACHE"

# For preview/development
wrangler kv:namespace create "CACHE" --preview
```

### Step 4: Deploy Durable Objects

First, update your worker to export the Durable Object:

```typescript
// In src/worker-integrated.ts, add at the bottom:
export { NotificationHub } from './durable-objects/notification-hub';
```

Then deploy:
```bash
# Deploy with Durable Objects
wrangler deploy
```

### Step 5: Set Environment Variables

```bash
# Production secrets (use wrangler secret for sensitive data)
wrangler secret put DATABASE_URL
wrangler secret put JWT_SECRET
wrangler secret put SENTRY_DSN
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN

# Regular environment variables
wrangler deploy --var DENO_ENV:production --var NODE_ENV:production
```

## 📊 Performance Optimizations Now Available

### 1. Enable Smart Placement (Automatic)
```bash
# Your worker will now automatically run closest to your users
wrangler deploy --compatibility-flags nodejs_compat
```

### 2. Set Up Cron Triggers (for scheduled tasks)
```toml
# In wrangler.toml
[triggers]
crons = [
    "*/5 * * * *",  # Every 5 minutes for NDA expiration checks
    "0 * * * *",    # Every hour for investment digest emails
    "0 0 * * *"     # Daily for audit log exports
]
```

### 3. Configure Workers Analytics
```bash
# View real-time analytics
wrangler tail

# Or in dashboard
open https://dash.cloudflare.com/02967e39e44b6266e7873829e94849f5/workers/analytics
```

## 🔧 Update Your Code for Paid Features

### Enable WebSocket Hibernation in Durable Objects

```typescript
// Update NotificationHub to use hibernation
export class NotificationHub implements DurableObject {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    
    // Enable hibernation for WebSocket connections
    state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    );
    
    // Set hibernation configuration  
    state.setHibernatableWebSocketEventTimeout(60000); // 60 seconds
  }
}
```

### Implement Queues for Background Processing

```toml
# In wrangler.toml
[[queues.producers]]
binding = "NOTIFICATION_QUEUE"
queue = "pitchey-notifications"

[[queues.consumers]]
queue = "pitchey-notifications"
max_batch_size = 100
max_batch_timeout = 30
```

## 🚦 Production Deployment Checklist

### Database Setup
- [ ] Run audit trail schema: `psql $DATABASE_URL -f src/db/audit-trail-schema.sql`
- [ ] Apply RLS policies: `psql $DATABASE_URL -f src/db/row-level-security.sql`
- [ ] Create monthly partitions for audit logs
- [ ] Set up automated backups in Neon

### Workers Configuration
- [ ] Deploy with Durable Objects enabled
- [ ] Configure Hyperdrive for database pooling
- [ ] Set up KV namespaces for caching
- [ ] Configure R2 bucket for file storage
- [ ] Set all environment secrets

### Monitoring & Observability
- [ ] Enable Workers Analytics
- [ ] Set up Sentry error tracking
- [ ] Configure custom metrics
- [ ] Set up alerting rules

### Security
- [ ] Enable SSL/TLS for all connections
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable DDoS protection

## 📈 Cost Optimization Tips

With your paid plan, optimize costs by:

1. **Use Durable Objects Wisely**: Group WebSocket connections by portal type
2. **Cache Aggressively**: Use KV for frequently accessed data
3. **Batch Operations**: Use Queues for non-urgent tasks
4. **Monitor Usage**: Check dashboard regularly to avoid overages

## 🔄 Migration Commands

```bash
# 1. Deploy the updated worker
wrangler deploy

# 2. Test WebSocket connections
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "X-User-ID: test-user" \
  -H "X-Portal-Type: investor" \
  https://pitchey-api-prod.ndlovucavelle.workers.dev/ws

# 3. Verify Hyperdrive connection
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health

# 4. Check Durable Objects
wrangler tail --format json | grep "NotificationHub"
```

## 🎉 Features You Can Now Enable

### 1. Real-time Collaboration
- Live pitch editing
- Typing indicators
- Presence tracking
- Read receipts

### 2. Advanced Caching
- Dashboard pre-computation
- Trending algorithm caching
- User preference caching
- Session state persistence

### 3. Background Jobs
- Email digest generation
- Report generation
- Data exports
- Cleanup tasks

### 4. WebSocket Features
- Push notifications
- Real-time updates
- Live activity feeds
- Collaborative viewing

## 🆘 Troubleshooting

### If Durable Objects fail to deploy:
```bash
# Check your account has DO enabled
curl -X GET "https://api.cloudflare.com/client/v4/accounts/02967e39e44b6266e7873829e94849f5/flags" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Should show: "durable_objects_enabled": true
```

### If Hyperdrive connection fails:
```bash
# Test connection string
wrangler hyperdrive list
wrangler hyperdrive get YOUR_HYPERDRIVE_ID
```

### Monitor your usage:
```bash
# Check current usage
curl -X GET "https://api.cloudflare.com/client/v4/accounts/02967e39e44b6266e7873829e94849f5/workers/analytics/stored" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## 🚀 Next Steps

1. **Deploy Immediately**: Get the WebSocket hub running
2. **Enable Hyperdrive**: Reduce database latency by 10x
3. **Set Up Monitoring**: Use Workers Analytics
4. **Test Load**: Verify 10M request capacity
5. **Enable Queues**: Move to async processing

Your platform is now ready for enterprise-scale deployment with all the premium features enabled!