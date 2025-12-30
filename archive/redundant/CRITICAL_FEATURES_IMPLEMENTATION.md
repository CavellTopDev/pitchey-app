# Critical Features Implementation Guide

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install @neondatabase/serverless resend
```

### 2. Add Secrets to Cloudflare
```bash
# Database connection
npx wrangler secret put DATABASE_URL
# Enter: postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require

# Email API key (get from https://resend.com)
npx wrangler secret put RESEND_API_KEY
# Enter your Resend API key

# JWT Secret (already set)
npx wrangler secret put JWT_SECRET
# Enter: vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz
```

### 3. Update wrangler.toml

Add these configurations to your `wrangler.toml`:

```toml
# Durable Objects for WebSocket
[durable_objects]
bindings = [
  { name = "WEBSOCKET_ROOM", class_name = "WebSocketRoom" }
]

[[durable_objects.migrations]]
tag = "v1"
new_classes = ["WebSocketRoom"]

# Queues for background jobs
[[queues.producers]]
binding = "EMAIL_QUEUE"
queue = "email-queue"

[[queues.consumers]]
queue = "email-queue"
max_batch_size = 10
max_batch_timeout = 30
max_retries = 3

# Environment variables
[vars]
FRONTEND_URL = "https://pitchey-5o8.pages.dev"
FROM_EMAIL = "notifications@pitchey.com"
```

## 📦 Implementation Details

### Database Service (worker-database.ts)
- ✅ Automatic retry logic (3 attempts)
- ✅ Connection pooling with Neon
- ✅ Transaction support
- ✅ Error handling

**Usage:**
```typescript
const db = new WorkerDatabase({ 
  connectionString: env.DATABASE_URL 
});

// Query
const users = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// Transaction
await db.transaction([
  { sql: 'INSERT INTO pitches ...', params: [...] },
  { sql: 'INSERT INTO pitch_media ...', params: [...] }
]);
```

### WebSocket Service (durable-objects/websocket-room.ts)
- ✅ Hibernatable WebSockets (saves memory)
- ✅ User presence tracking
- ✅ Broadcast messaging
- ✅ Typing indicators
- ✅ Direct notifications

**Client Connection:**
```javascript
const ws = new WebSocket('wss://your-worker.workers.dev/ws?userId=1&userName=John');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data.type);
};

// Send message
ws.send(JSON.stringify({
  type: 'broadcast',
  message: 'Hello everyone!'
}));
```

### Email Service (worker-email.ts)
- ✅ Template system
- ✅ Batch sending (up to 100)
- ✅ HTML emails with layout
- ✅ Attachments support

**Usage:**
```typescript
const emailService = new WorkerEmailService({
  apiKey: env.RESEND_API_KEY,
  fromEmail: env.FROM_EMAIL
});

// Send templated email
await emailService.sendTemplate(
  'user@example.com',
  'welcome',
  { name: 'John', userType: 'creator', loginUrl: '...' }
);

// Send custom email
await emailService.send({
  to: 'user@example.com',
  subject: 'Custom Subject',
  html: '<p>Custom HTML content</p>'
});
```

### Queue Service (worker-queue.ts)
- ✅ Background job processing
- ✅ Automatic retries
- ✅ Dead letter queue support
- ✅ Multiple job types

**Usage:**
```typescript
// Send to queue
await env.EMAIL_QUEUE.send({
  type: 'email',
  payload: {
    to: 'user@example.com',
    subject: 'Welcome',
    template: 'welcome',
    data: { name: 'John' }
  }
});

// Process messages (auto-handled by consumer)
export default {
  async queue(batch, env) {
    const queueService = new WorkerQueueService();
    await queueService.processMessages(batch, env);
  }
};
```

## 🔄 Integration Steps

### Step 1: Update worker-integrated.ts

Add database initialization:
```typescript
constructor(env: Env) {
  this.env = env;
  this.db = new WorkerDatabase({
    connectionString: env.DATABASE_URL
  });
  this.emailService = new WorkerEmailService({
    apiKey: env.RESEND_API_KEY,
    fromEmail: env.FROM_EMAIL
  });
}
```

### Step 2: Replace Mock Database Calls

Change from:
```typescript
const pitches = await this.db.query(`SELECT * FROM pitches`, []);
```

To use the actual database service.

### Step 3: Add WebSocket Endpoint

```typescript
private async handleWebSocketUpgrade(request: Request): Promise<Response> {
  const roomId = 'global'; // or use path params for rooms
  const room = this.env.WEBSOCKET_ROOM.get(
    this.env.WEBSOCKET_ROOM.idFromName(roomId)
  );
  return room.fetch(request);
}
```

### Step 4: Queue Email Jobs

Instead of sending emails directly:
```typescript
// Queue the email
await this.env.EMAIL_QUEUE.send({
  type: 'email',
  payload: {
    to: user.email,
    template: 'ndaApproved',
    data: {
      pitchTitle: pitch.title,
      pitchUrl: `${this.env.FRONTEND_URL}/pitch/${pitch.id}`
    }
  }
});
```

## 🧪 Testing

### Test Database Connection
```bash
curl -X GET https://your-worker.workers.dev/api/health
```

### Test WebSocket
```javascript
// In browser console
const ws = new WebSocket('wss://your-worker.workers.dev/ws?userId=test&userName=Test');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', JSON.parse(e.data));
```

### Test Email (via Queue)
```bash
curl -X POST https://your-worker.workers.dev/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@example.com"}'
```

## 🎯 Next Deployment Steps

1. **Create Queues:**
```bash
npx wrangler queues create email-queue
```

2. **Deploy Worker:**
```bash
wrangler deploy
```

3. **Verify Deployment:**
- Check database connection: `/api/health`
- Test WebSocket connection
- Send test email
- Monitor queue processing

## ⚠️ Important Notes

1. **Durable Objects** require a paid Workers plan ($5/month)
2. **Queues** are included in the Workers paid plan
3. **Resend** offers 100 free emails/day
4. **Neon** free tier: 0.5 GB storage

## 🚨 Troubleshooting

### Database Connection Issues
- Verify DATABASE_URL secret is set correctly
- Check Neon dashboard for connection limits
- Ensure SSL mode is set to 'require'

### WebSocket Not Connecting
- Verify Durable Objects are enabled in your account
- Check wrangler.toml migrations
- Ensure WebSocket upgrade headers are correct

### Emails Not Sending
- Verify RESEND_API_KEY is valid
- Check queue consumer logs
- Verify FROM_EMAIL domain is verified in Resend

### Queue Processing Failures
- Check consumer configuration in wrangler.toml
- Monitor queue metrics in Cloudflare dashboard
- Check for errors in consumer logs

## 📚 Resources

- [Neon + Workers Guide](https://developers.cloudflare.com/workers/databases/third-party-integrations/neon)
- [Durable Objects Guide](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/)
- [Queues Documentation](https://developers.cloudflare.com/queues/)
- [Resend API Docs](https://resend.com/docs)