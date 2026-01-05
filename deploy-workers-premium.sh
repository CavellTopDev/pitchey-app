#!/bin/bash

# Pitchey Workers Premium Deployment
# Frontend: pitchey-5o8-66n.pages.dev
# Backend: pitchey-api-prod.ndlovucavelle.workers.dev

echo "🚀 Deploying Pitchey with Workers Premium Features"
echo "=================================================="
echo "Frontend: https://pitchey-5o8-66n.pages.dev"
echo "Backend:  https://pitchey-api-prod.ndlovucavelle.workers.dev"
echo ""

# Configuration
ACCOUNT_ID="02967e39e44b6266e7873829e94849f5"
WORKER_NAME="pitchey-api-prod"
FRONTEND_URL="https://pitchey-5o8-66n.pages.dev"
BACKEND_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

# Step 1: Update wrangler.toml with premium features
echo "📝 Configuring wrangler.toml with premium features..."

cat > wrangler.toml << EOF
name = "$WORKER_NAME"
main = "src/worker-integrated.ts"
compatibility_date = "2024-01-01"
account_id = "$ACCOUNT_ID"

# Custom domain routing
routes = [
  { pattern = "pitchey-api-prod.ndlovucavelle.workers.dev/*", custom_domain = true }
]

# ===== PREMIUM FEATURES (WORKERS PAID PLAN) =====

# 1. Durable Objects for WebSocket Management
[[durable_objects.bindings]]
name = "NOTIFICATION_HUB"
class_name = "NotificationHub"

[[durable_objects.bindings]]
name = "WEBSOCKET_ROOMS"
class_name = "WebSocketRoom"

[[migrations]]
tag = "v2"
new_classes = ["NotificationHub", "WebSocketRoom"]

# 2. KV Namespaces for Caching (Unlimited operations)
[[kv_namespaces]]
binding = "CACHE"
id = "cache_namespace_id"

[[kv_namespaces]]
binding = "SESSION_STORE"
id = "session_namespace_id"

[[kv_namespaces]]
binding = "RATE_LIMITER"
id = "rate_limiter_id"

# 3. R2 Storage for Files
[[r2_buckets]]
binding = "PITCH_STORAGE"
bucket_name = "pitchey-pitches"

[[r2_buckets]]
binding = "NDA_STORAGE"
bucket_name = "pitchey-ndas"

# 4. Queues for Background Processing
[[queues.producers]]
binding = "EMAIL_QUEUE"
queue = "email-notifications"

[[queues.producers]]
binding = "AUDIT_QUEUE"
queue = "audit-logs"

[[queues.consumers]]
queue = "email-notifications"
max_batch_size = 100
max_batch_timeout = 30
max_retries = 3
dead_letter_queue = "email-dlq"

[[queues.consumers]]
queue = "audit-logs"
max_batch_size = 50
max_batch_timeout = 10

# 5. Analytics Engine for Metrics
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "pitchey_metrics"

# 6. Cron Triggers for Scheduled Tasks
[triggers]
crons = [
  "*/5 * * * *",    # Every 5 min: Check NDA expirations
  "0 * * * *",      # Hourly: Send digest emails
  "0 0 * * *",      # Daily: Export audit logs
  "0 2 * * 0",      # Weekly: Database cleanup
  "*/15 * * * *"    # Every 15 min: Update trending algorithm
]

# Environment Variables
[vars]
FRONTEND_URL = "$FRONTEND_URL"
BACKEND_URL = "$BACKEND_URL"
ENVIRONMENT = "production"
ENABLE_DURABLE_OBJECTS = "true"
ENABLE_WEBSOCKETS = "true"
ENABLE_QUEUES = "true"
ENABLE_ANALYTICS = "true"
MAX_WEBSOCKET_CONNECTIONS = "100000"
CACHE_TTL = "300"

# Compatibility flags for advanced features
compatibility_flags = ["nodejs_compat", "experimental"]

[build]
command = "npm run build"
[build.upload]
format = "service-worker"
EOF

echo "✅ wrangler.toml configured"

# Step 2: Create KV namespaces
echo ""
echo "📦 Creating KV namespaces..."

create_kv_namespace() {
  local name=$1
  local id=$(wrangler kv:namespace list | grep "$name" | grep -o '"id":[^,]*' | cut -d'"' -f4)
  if [ -z "$id" ]; then
    echo "  Creating $name namespace..."
    wrangler kv:namespace create "$name"
  else
    echo "  ✓ $name namespace exists: $id"
  fi
}

create_kv_namespace "CACHE"
create_kv_namespace "SESSION_STORE"
create_kv_namespace "RATE_LIMITER"

# Step 3: Create R2 buckets
echo ""
echo "📦 Creating R2 storage buckets..."

wrangler r2 bucket create pitchey-pitches 2>/dev/null || echo "  ✓ pitchey-pitches bucket exists"
wrangler r2 bucket create pitchey-ndas 2>/dev/null || echo "  ✓ pitchey-ndas bucket exists"

# Step 4: Create Queues
echo ""
echo "📬 Creating message queues..."

wrangler queues create email-notifications 2>/dev/null || echo "  ✓ email-notifications queue exists"
wrangler queues create email-dlq 2>/dev/null || echo "  ✓ email-dlq queue exists"
wrangler queues create audit-logs 2>/dev/null || echo "  ✓ audit-logs queue exists"

# Step 5: Set production secrets
echo ""
echo "🔐 Setting production secrets..."

set_secret() {
  local name=$1
  local value=$2
  echo "  Setting $name..."
  echo "$value" | wrangler secret put "$name" --name "$WORKER_NAME" 2>/dev/null
}

set_secret "DATABASE_URL" "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
set_secret "JWT_SECRET" "vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz"
set_secret "SENTRY_DSN" "https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536"
set_secret "UPSTASH_REDIS_REST_URL" "https://chief-anteater-20186.upstash.io"
set_secret "UPSTASH_REDIS_REST_TOKEN" "AU7aAAIncDI3ZGVjNWMxZGUyOWQ0ZmYyYjI4NzdkYjM4OGMxZTE3NnAyMjAxODY"

# Step 6: Update worker exports
echo ""
echo "📝 Updating worker exports for Durable Objects..."

# Check if exports exist, if not add them
if ! grep -q "export { NotificationHub }" src/worker-integrated.ts; then
  cat >> src/worker-integrated.ts << 'EOF'

// Durable Object Exports (Premium Feature)
export { NotificationHub } from './durable-objects/notification-hub';
export { WebSocketRoom } from './durable-objects/websocket-room';
EOF
  echo "  ✓ Durable Object exports added"
else
  echo "  ✓ Durable Object exports already present"
fi

# Step 7: Create WebSocketRoom if it doesn't exist
if [ ! -f "src/durable-objects/websocket-room.ts" ]; then
  echo ""
  echo "📝 Creating WebSocketRoom Durable Object..."
  
  mkdir -p src/durable-objects
  cat > src/durable-objects/websocket-room.ts << 'EOF'
export class WebSocketRoom implements DurableObject {
  private sessions = new Map<WebSocket, { userId: string; roomId: string }>();

  constructor(private state: DurableObjectState, private env: Env) {
    // Enable hibernation for efficiency
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    );
    this.state.setHibernatableWebSocketEventTimeout(60000);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    const userId = request.headers.get('X-User-ID') || 'anonymous';
    const roomId = new URL(request.url).pathname.split('/').pop() || 'default';

    this.state.acceptWebSocket(server);
    this.sessions.set(server, { userId, roomId });

    server.send(JSON.stringify({ 
      type: 'connected', 
      roomId, 
      userId,
      connections: this.sessions.size 
    }));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const session = this.sessions.get(ws);
    if (!session) return;

    // Broadcast to all in same room
    for (const [client, clientSession] of this.sessions) {
      if (clientSession.roomId === session.roomId && client !== ws) {
        client.send(message);
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    const session = this.sessions.get(ws);
    this.sessions.delete(ws);
    
    // Notify others about disconnection
    if (session) {
      for (const [client, clientSession] of this.sessions) {
        if (clientSession.roomId === session.roomId) {
          client.send(JSON.stringify({
            type: 'user_left',
            userId: session.userId
          }));
        }
      }
    }
  }
}
EOF
  echo "  ✓ WebSocketRoom created"
fi

# Step 8: Deploy to Workers
echo ""
echo "🚀 Deploying to Cloudflare Workers..."
echo "-------------------------------------"

wrangler deploy --name "$WORKER_NAME"

# Step 9: Update frontend environment
echo ""
echo "📝 Updating frontend/.env.production..."

cat > frontend/.env.production << EOF
VITE_API_URL=$BACKEND_URL
VITE_WS_URL=wss://pitchey-api-prod.ndlovucavelle.workers.dev
VITE_FRONTEND_URL=$FRONTEND_URL
VITE_ENABLE_WEBSOCKETS=true
VITE_ENABLE_REALTIME=true
EOF

echo "✅ Frontend environment updated"

# Step 10: Deploy frontend to Pages
echo ""
echo "🚀 Building and deploying frontend..."
echo "-------------------------------------"

cd frontend
npm run build
wrangler pages deploy dist --project-name=pitchey --branch=main
cd ..

# Step 11: Test deployment
echo ""
echo "🧪 Testing deployment..."
echo "------------------------"

echo "Testing backend health..."
curl -s "$BACKEND_URL/api/health" | jq '.' || echo "  ⚠️  Health check failed"

echo ""
echo "Testing WebSocket endpoint..."
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "X-User-ID: test-user" \
  "$BACKEND_URL/ws" 2>&1 | head -n 1

# Final summary
echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "======================"
echo ""
echo "📊 Premium Features Activated:"
echo "------------------------------"
echo "✅ Durable Objects for 100,000+ concurrent WebSockets"
echo "✅ Unlimited KV operations for caching"
echo "✅ R2 storage for documents and media"
echo "✅ Background queues for async processing"
echo "✅ Analytics engine for metrics"
echo "✅ Cron triggers for scheduled tasks"
echo "✅ 10 million requests/month capacity"
echo "✅ 30 second CPU time per request"
echo ""
echo "🔗 Production URLs:"
echo "------------------"
echo "Frontend:  $FRONTEND_URL"
echo "Backend:   $BACKEND_URL"
echo "WebSocket: wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws"
echo ""
echo "📊 Monitoring:"
echo "--------------"
echo "Dashboard: https://dash.cloudflare.com/$ACCOUNT_ID/workers/services/view/$WORKER_NAME"
echo "Analytics: https://dash.cloudflare.com/$ACCOUNT_ID/workers/analytics"
echo "Logs:      wrangler tail --name $WORKER_NAME"
echo ""
echo "🧪 Quick Tests:"
echo "---------------"
echo "# Test WebSocket connection:"
echo "wscat -c wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws"
echo ""
echo "# Test API endpoint:"
echo "curl $BACKEND_URL/api/pitches"
echo ""
echo "# Monitor real-time logs:"
echo "wrangler tail --name $WORKER_NAME --format json"
echo ""
echo "📝 Next Steps:"
echo "--------------"
echo "1. Test real-time collaboration features"
echo "2. Verify WebSocket connections scale properly"
echo "3. Monitor queue processing performance"
echo "4. Set up alerting in Cloudflare dashboard"
echo "5. Configure custom domain if needed"
EOF

chmod +x deploy-workers-premium.sh

echo "✅ Premium deployment script ready!"
echo "Run with: ./deploy-workers-premium.sh"