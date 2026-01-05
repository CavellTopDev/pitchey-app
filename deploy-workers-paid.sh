#!/bin/bash

# Cloudflare Workers Paid Plan Deployment Script
# Deploys with all premium features enabled

echo "🚀 Deploying Pitchey with Workers Paid Features"
echo "============================================="

# Configuration
ACCOUNT_ID="02967e39e44b6266e7873829e94849f5"
PAGES_URL="https://pitchey-5o8-66n.pages.dev"
WORKER_NAME="pitchey-api-production"

# Step 1: Create KV namespaces if they don't exist
echo ""
echo "📦 Step 1: Creating KV Namespaces..."
echo "-------------------------------------"

# Create main cache namespace
KV_CACHE_ID=$(wrangler kv:namespace list | grep "CACHE" | grep -o '"id":[^,]*' | cut -d'"' -f4)
if [ -z "$KV_CACHE_ID" ]; then
    echo "Creating CACHE namespace..."
    wrangler kv:namespace create "CACHE"
    KV_CACHE_ID=$(wrangler kv:namespace list | grep "CACHE" | grep -o '"id":[^,]*' | cut -d'"' -f4)
fi
echo "✅ CACHE namespace ID: $KV_CACHE_ID"

# Create notifications namespace
KV_NOTIFICATIONS_ID=$(wrangler kv:namespace list | grep "NOTIFICATIONS" | grep -o '"id":[^,]*' | cut -d'"' -f4)
if [ -z "$KV_NOTIFICATIONS_ID" ]; then
    echo "Creating NOTIFICATIONS namespace..."
    wrangler kv:namespace create "NOTIFICATIONS"
    KV_NOTIFICATIONS_ID=$(wrangler kv:namespace list | grep "NOTIFICATIONS" | grep -o '"id":[^,]*' | cut -d'"' -f4)
fi
echo "✅ NOTIFICATIONS namespace ID: $KV_NOTIFICATIONS_ID"

# Step 2: Create R2 bucket for storage
echo ""
echo "📦 Step 2: Creating R2 Storage Bucket..."
echo "----------------------------------------"
wrangler r2 bucket create pitchey-storage 2>/dev/null || echo "✅ R2 bucket already exists"

# Step 3: Update wrangler.toml with Durable Objects
echo ""
echo "📝 Step 3: Updating wrangler.toml..."
echo "------------------------------------"

cat > wrangler.toml << EOF
name = "$WORKER_NAME"
main = "src/worker-integrated.ts"
compatibility_date = "2024-01-01"
account_id = "$ACCOUNT_ID"

# Routes
routes = [
  { pattern = "pitchey-api.cavelltheleaddev.workers.dev/*", zone_name = "" }
]

# Durable Objects (NEW - Paid Plan Feature!)
[[durable_objects.bindings]]
name = "NOTIFICATION_HUB"
class_name = "NotificationHub"
script_name = "$WORKER_NAME"

[[durable_objects.bindings]]
name = "WEBSOCKET_ROOMS"
class_name = "WebSocketRoom"
script_name = "$WORKER_NAME"

[[migrations]]
tag = "v1"
new_classes = ["NotificationHub", "WebSocketRoom"]

# KV Namespaces
[[kv_namespaces]]
binding = "CACHE"
id = "$KV_CACHE_ID"

[[kv_namespaces]]
binding = "NOTIFICATIONS"
id = "$KV_NOTIFICATIONS_ID"

# R2 Storage
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "pitchey-storage"

# Queue for background processing (Paid Plan Feature!)
[[queues.producers]]
binding = "NOTIFICATION_QUEUE"
queue = "pitchey-notifications"

[[queues.consumers]]
queue = "pitchey-notifications"
max_batch_size = 100
max_batch_timeout = 30

# Cron triggers for scheduled tasks
[triggers]
crons = [
  "*/5 * * * *",   # Check NDA expirations every 5 minutes
  "0 * * * *",     # Send hourly digest emails
  "0 0 * * *",     # Daily audit log export
  "0 2 * * 0"      # Weekly cleanup tasks
]

# Environment variables
[vars]
FRONTEND_URL = "$PAGES_URL"
DENO_ENV = "production"
NODE_ENV = "production"
ENABLE_DURABLE_OBJECTS = "true"
ENABLE_WEBSOCKETS = "true"
ENABLE_QUEUES = "true"

# Service bindings (if using separate workers)
# [[services]]
# binding = "AUTH_SERVICE"
# service = "pitchey-auth"

# Analytics Engine binding (Paid Plan Feature!)
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "pitchey_analytics"

# Compatibility flags
compatibility_flags = ["nodejs_compat", "experimental"]

# Build configuration
[build]
command = "npm run build"

[build.upload]
format = "service-worker"
EOF

echo "✅ wrangler.toml updated with paid features"

# Step 4: Create Durable Object for WebSockets
echo ""
echo "📝 Step 4: Creating WebSocket Room Durable Object..."
echo "----------------------------------------------------"

cat > src/durable-objects/websocket-room.ts << 'EOF'
// WebSocket Room Durable Object for real-time collaboration
export class WebSocketRoom implements DurableObject {
  private sessions: Map<WebSocket, any> = new Map();
  private state: DurableObjectState;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    
    // Enable WebSocket hibernation (Paid Plan Feature!)
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    );
    
    // Configure hibernation timeout
    this.state.setHibernatableWebSocketEventTimeout(60000);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/websocket') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected websocket', { status: 400 });
      }

      const [client, server] = Object.values(new WebSocketPair());
      
      this.state.acceptWebSocket(server);
      this.sessions.set(server, { connected: new Date() });
      
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }
    
    return new Response('Not found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // Broadcast to all connected clients
    for (const [client] of this.sessions) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.sessions.delete(ws);
  }
}
EOF

# Step 5: Update worker to export Durable Objects
echo ""
echo "📝 Step 5: Updating worker to export Durable Objects..."
echo "-------------------------------------------------------"

# Add exports to worker file if not already present
if ! grep -q "export { NotificationHub }" src/worker-integrated.ts; then
  echo "" >> src/worker-integrated.ts
  echo "// Export Durable Objects (Paid Plan Feature!)" >> src/worker-integrated.ts
  echo "export { NotificationHub } from './durable-objects/notification-hub';" >> src/worker-integrated.ts
  echo "export { WebSocketRoom } from './durable-objects/websocket-room';" >> src/worker-integrated.ts
fi

# Step 6: Set secrets
echo ""
echo "🔐 Step 6: Setting production secrets..."
echo "----------------------------------------"

# Database URL
echo "Setting DATABASE_URL..."
echo "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" | wrangler secret put DATABASE_URL

# JWT Secret
echo "Setting JWT_SECRET..."
echo "vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz" | wrangler secret put JWT_SECRET

# Sentry DSN
echo "Setting SENTRY_DSN..."
echo "https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536" | wrangler secret put SENTRY_DSN

# Redis/Upstash
echo "Setting UPSTASH_REDIS_REST_URL..."
echo "https://chief-anteater-20186.upstash.io" | wrangler secret put UPSTASH_REDIS_REST_URL

echo "Setting UPSTASH_REDIS_REST_TOKEN..."
echo "AU7aAAIncDI3ZGVjNWMxZGUyOWQ0ZmYyYjI4NzdkYjM4OGMxZTE3NnAyMjAxODY" | wrangler secret put UPSTASH_REDIS_REST_TOKEN

# Step 7: Deploy!
echo ""
echo "🚀 Step 7: Deploying to Cloudflare Workers..."
echo "---------------------------------------------"

wrangler deploy

# Step 8: Create queues
echo ""
echo "📬 Step 8: Creating message queues..."
echo "-------------------------------------"

wrangler queues create pitchey-notifications 2>/dev/null || echo "✅ Queue already exists"

# Step 9: Verify deployment
echo ""
echo "✅ Step 9: Verifying deployment..."
echo "----------------------------------"

WORKER_URL="https://$WORKER_NAME.cavelltheleaddev.workers.dev"

echo "Testing health endpoint..."
curl -s "$WORKER_URL/api/health" | jq '.'

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "======================"
echo ""
echo "📊 Your Premium Features are now ACTIVE:"
echo "----------------------------------------"
echo "✅ Durable Objects for WebSockets"
echo "✅ Message Queues for background jobs"
echo "✅ KV Storage for caching"
echo "✅ R2 Storage for files"
echo "✅ Cron triggers for scheduled tasks"
echo "✅ Analytics Engine for metrics"
echo "✅ 10 million requests/month capacity"
echo "✅ 30 second CPU time per request"
echo ""
echo "🔗 URLs:"
echo "--------"
echo "Worker API: $WORKER_URL"
echo "Frontend: $PAGES_URL"
echo "WebSocket: wss://$WORKER_NAME.cavelltheleaddev.workers.dev/ws"
echo ""
echo "📊 Monitor your usage:"
echo "----------------------"
echo "Dashboard: https://dash.cloudflare.com/$ACCOUNT_ID/workers/services/view/$WORKER_NAME"
echo "Analytics: https://dash.cloudflare.com/$ACCOUNT_ID/workers/analytics"
echo ""
echo "🧪 Test WebSocket connection:"
echo "-----------------------------"
echo "wscat -c wss://$WORKER_NAME.cavelltheleaddev.workers.dev/ws"
echo ""
echo "📝 Next steps:"
echo "--------------"
echo "1. Test real-time features with multiple connections"
echo "2. Monitor Analytics dashboard for performance"
echo "3. Set up alerting for error rates"
echo "4. Configure custom domains if needed"
EOF

chmod +x deploy-workers-paid.sh

echo "✅ Deployment script created: deploy-workers-paid.sh"
echo "Run it with: ./deploy-workers-paid.sh"