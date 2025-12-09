# Pitchey Platform - Developer Onboarding Guide

**Version**: 1.0  
**Date**: December 7, 2024  
**Enhanced with Context7 Documentation**

## Welcome to Pitchey Development Team! 🎬

This guide will get you up and running with the Pitchey platform codebase. We've leveraged Context7 to provide you with the most accurate, up-to-date documentation patterns.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Environment Setup](#environment-setup)
3. [Development Workflow](#development-workflow)
4. [Testing Strategy](#testing-strategy)
5. [Deployment Process](#deployment-process)
6. [Common Tasks & Recipes](#common-tasks--recipes)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Routing**: React Router v7 (see Context7 docs)
- **Backend**: Cloudflare Workers (Edge Runtime)
- **Database**: Neon PostgreSQL with Drizzle ORM
- **Real-time**: WebSockets via Durable Objects
- **Cache**: Upstash Redis (global edge cache)
- **Storage**: Cloudflare R2 (S3-compatible)

### Project Structure
```
pitchey_v0.2/
├── frontend/               # React application
│   ├── src/
│   │   ├── pages/         # Route components (3 portals)
│   │   ├── components/    # Reusable UI components
│   │   ├── services/      # API service layer
│   │   ├── store/         # Zustand state management
│   │   └── lib/           # Utilities and helpers
│   └── dist/              # Build output
│
├── src/
│   ├── db/                # Database schema & migrations
│   ├── routes/            # API route handlers
│   └── worker-production-db.ts  # Main worker entry
│
├── wrangler.toml          # Cloudflare Worker config
└── deno.json              # Deno configuration
```

---

## Environment Setup

### Prerequisites
```bash
# Required tools
- Node.js 18+ (frontend)
- Deno 1.40+ (backend development)
- Wrangler CLI (Cloudflare deployment)
- PostgreSQL 15+ (local development)
- Redis/Valkey (optional, for cache testing)
```

### 1. Clone and Install
```bash
# Clone the repository
git clone [repository-url]
cd pitchey_v0.2

# Install frontend dependencies
cd frontend
npm install

# Install Deno dependencies (auto-installed on run)
cd ..
deno cache working-server.ts
```

### 2. Database Setup
```bash
# Start PostgreSQL locally
docker-compose up -d postgres

# Run migrations
DATABASE_URL="postgresql://postgres:password@localhost:5432/pitchey" \
deno run --allow-all src/db/migrate.ts

# Seed demo data
DATABASE_URL="postgresql://postgres:password@localhost:5432/pitchey" \
deno run --allow-all scripts/seed-db.ts
```

### 3. Environment Variables

#### Local Development (.env)
```bash
# Backend (Deno server)
PORT=8001  # ALWAYS use 8001 for local backend
JWT_SECRET="test-secret-key-for-development"
DATABASE_URL="postgresql://postgres:password@localhost:5432/pitchey"
CACHE_ENABLED=false  # Set true if using Redis locally
FRONTEND_URL="http://localhost:5173"

# Frontend (.env in frontend/)
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001
```

#### Production (.env.production)
```bash
# Frontend production URLs
VITE_API_URL=https://pitchey-production.cavelltheleaddev.workers.dev
VITE_WS_URL=wss://pitchey-production.cavelltheleaddev.workers.dev

# Backend secrets (managed via Cloudflare secrets)
DATABASE_URL=[Neon connection string]
JWT_SECRET=[Production secret]
UPSTASH_REDIS_REST_URL=[Upstash URL]
UPSTASH_REDIS_REST_TOKEN=[Upstash token]
```

---

## Development Workflow

### Testing Production (Client-Side)

#### Direct Browser Testing
1. **Open https://pitchey.pages.dev**
2. **Open Browser DevTools Console (F12)**
3. **Run these tests:**

```javascript
// Test 1: Check API connectivity
await fetch('https://pitchey-production.cavelltheleaddev.workers.dev/api/health')
  .then(r => r.json())

// Test 2: Login as Creator
const loginResponse = await fetch('https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/creator/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'alex.creator@demo.com',
    password: 'Demo123'
  })
}).then(r => r.json());
console.log('Login successful:', loginResponse);

// Test 3: Store token and test dashboard
if (loginResponse.token) {
  localStorage.setItem('authToken', loginResponse.token);
  localStorage.setItem('userType', 'creator');
  
  // Test authenticated request
  await fetch('https://pitchey-production.cavelltheleaddev.workers.dev/api/creator/dashboard', {
    headers: { 
      'Authorization': `Bearer ${loginResponse.token}` 
    }
  }).then(r => r.json()).then(console.log);
}

// Test 4: WebSocket connection
const ws = new WebSocket('wss://pitchey-production.cavelltheleaddev.workers.dev/ws');
ws.onopen = () => console.log('WebSocket connected');
ws.onmessage = (e) => console.log('WebSocket message:', e.data);
ws.onerror = (e) => console.error('WebSocket error:', e);
```

#### Automated Testing Script
```bash
# Run from terminal to test production
curl -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}' | jq .
```

### Working with React Router (Context7 Pattern)

Based on React Router v7 documentation from Context7:

```typescript
// Route Parameters (from Context7 docs)
import { useParams } from "react-router";

function PitchDetail() {
  const { pitchId } = useParams();
  // pitchId available from /pitch/:pitchId route
}

// Programmatic Navigation
import { useNavigate } from "react-router";

function LoginForm() {
  const navigate = useNavigate();
  
  const handleLogin = async () => {
    // After successful login
    navigate(`/${userType}/dashboard`, {
      state: { from: location.pathname }
    });
  };
}

// Protected Routes Pattern
function RoleProtectedRoute({ allowedRoles }) {
  const { userType } = useAuthStore();
  
  if (!allowedRoles.includes(userType)) {
    return <Navigate to="/login" />;
  }
  
  return <Outlet />;
}
```

### Working with Cloudflare Workers

Based on Cloudflare Workers documentation from Context7:

#### KV Storage Pattern
```typescript
// Store data in KV
await env.KV.put("key", JSON.stringify(data), {
  expirationTtl: 3600 // 1 hour
});

// Retrieve from KV
const cached = await env.KV.get("key", "json");
```

#### Durable Objects for WebSockets
```typescript
// From Context7 Cloudflare docs
export class WebSocketRoom extends DurableObject {
  async fetch(request: Request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    // Use new Hibernatable API (not legacy accept())
    this.ctx.acceptWebSocket(server);
    
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
  
  async webSocketMessage(ws: WebSocket, message: string) {
    // Broadcast to all connected clients
    for (const client of this.ctx.getWebSockets()) {
      client.send(message);
    }
  }
}
```

### Database Operations with Drizzle

```typescript
// Query pattern
const pitches = await db
  .select()
  .from(schema.pitches)
  .where(eq(schema.pitches.creatorId, userId))
  .orderBy(desc(schema.pitches.createdAt));

// Insert with returning
const [newPitch] = await db
  .insert(schema.pitches)
  .values({ title, logline, genre })
  .returning();

// Update
await db
  .update(schema.pitches)
  .set({ status: 'published' })
  .where(eq(schema.pitches.id, pitchId));
```

---

## Testing Strategy

### Unit Tests (Frontend)
```bash
cd frontend
npm run test
```

### E2E Tests (Production Testing)
```bash
# Test production frontend at https://pitchey.pages.dev
# Using curl to test the production API directly

# 1. Test Creator Portal Login
curl -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'

# 2. Test pitch listing (public endpoint)
curl https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches

# 3. Test with authentication
TOKEN="your-jwt-token-from-login"
curl https://pitchey-production.cavelltheleaddev.workers.dev/api/creator/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

### Browser Testing (Client-Side Verification)
```javascript
// Open browser console at https://pitchey.pages.dev and run:

// Test API connectivity
fetch('https://pitchey-production.cavelltheleaddev.workers.dev/api/health')
  .then(r => r.json())
  .then(console.log);

// Test authentication flow
fetch('https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/creator/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'alex.creator@demo.com',
    password: 'Demo123'
  })
}).then(r => r.json()).then(console.log);
```

### Production API Testing
```bash
# Create production test script
cat > test-production-client.sh << 'EOF'
#!/bin/bash

# Production URLs
API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
FRONTEND_URL="https://pitchey.pages.dev"

echo "🧪 Testing Pitchey Production Environment"
echo "==========================================="

# 1. Test Frontend Loading
echo "\n1️⃣ Testing Frontend at $FRONTEND_URL"
curl -I $FRONTEND_URL 2>/dev/null | head -n 1

# 2. Test API Health
echo "\n2️⃣ Testing API Health"
curl -s $API_URL/api/health | jq .

# 3. Test Creator Login
echo "\n3️⃣ Testing Creator Login"
RESPONSE=$(curl -s -X POST $API_URL/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')
echo $RESPONSE | jq .
TOKEN=$(echo $RESPONSE | jq -r '.token')

# 4. Test Authenticated Endpoint
echo "\n4️⃣ Testing Authenticated Dashboard"
curl -s $API_URL/api/creator/dashboard \
  -H "Authorization: Bearer $TOKEN" | jq .

# 5. Test Public Pitches
echo "\n5️⃣ Testing Public Pitch Listing"
curl -s $API_URL/api/pitches | jq .

# 6. Test WebSocket Connection
echo "\n6️⃣ Testing WebSocket Connection"
echo "WebSocket URL: wss://pitchey-production.cavelltheleaddev.workers.dev/ws"
echo "(Use browser console for WebSocket testing)"

echo "\n✅ Production tests complete!"
EOF

chmod +x test-production-client.sh
./test-production-client.sh
```

---

## Deployment Process

### Deploy to Cloudflare Workers
```bash
# 1. Build frontend
cd frontend
npm run build

# 2. Deploy frontend to Pages
npx wrangler pages deploy dist --project-name=pitchey --commit-dirty=true

# 3. Deploy worker
cd ..
npx wrangler deploy

# URL: https://pitchey-production.cavelltheleaddev.workers.dev
```

### Deploy to Deno Deploy (Alternative)
```bash
# Deploy backend
DENO_DEPLOY_TOKEN=[your-token] \
deployctl deploy --project=pitchey-backend-fresh \
  --entrypoint=working-server.ts \
  --env="DATABASE_URL=[neon-url]" \
  --production
```

---

## Common Tasks & Recipes

### Adding a New API Endpoint

1. **Add to Worker** (`src/worker-production-db.ts`):
```typescript
// Example: Add new analytics endpoint
if (path === '/api/analytics/custom' && method === 'GET') {
  if (!userPayload) {
    return corsResponse(request, {
      success: false,
      message: 'Authentication required',
    }, 401);
  }
  
  const data = await db.select()...;
  
  return corsResponse(request, {
    success: true,
    data
  });
}
```

2. **Add to Frontend Service** (`frontend/src/services/`):
```typescript
export const analyticsAPI = {
  async getCustomAnalytics() {
    const response = await api.get('/api/analytics/custom');
    return response.data;
  }
};
```

### Adding a New Portal Page

1. **Create Component** (`frontend/src/pages/[portal]/NewPage.tsx`)
2. **Add Route** (`frontend/src/App.tsx`):
```typescript
<Route path="/creator/new-page" element={
  <RoleProtectedRoute allowedRoles={['creator']}>
    <NewPage />
  </RoleProtectedRoute>
} />
```

3. **Add Navigation** (in appropriate dashboard)

### Implementing Real-time Features

Using WebSocket pattern from Context7:
```typescript
// Frontend WebSocket hook
function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  
  useEffect(() => {
    const ws = new WebSocket(config.WS_URL);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'auth',
        token: localStorage.getItem('authToken')
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Handle message based on type
    };
    
    setSocket(ws);
    return () => ws.close();
  }, []);
  
  return socket;
}
```

---

## Troubleshooting

### Common Issues & Solutions

#### 1. "Pitch not found" Error
- **Cause**: API response structure mismatch
- **Solution**: Check `response.data.data` pattern in api.ts

#### 2. WebSocket Connection Failed
- **Cause**: Backend not running or wrong port
- **Solution**: Ensure backend is on PORT 8001

#### 3. Database Connection Issues
- **Cause**: PostgreSQL not running
- **Solution**: `docker-compose up -d postgres`

#### 4. CORS Errors
- **Cause**: Frontend/backend URL mismatch
- **Solution**: Check VITE_API_URL matches backend port

#### 5. Authentication Loop
- **Cause**: JWT expired or invalid
- **Solution**: Clear localStorage and re-login

### Debug Commands

```bash
# Check backend logs
deno run --inspect working-server.ts

# Check worker logs
npx wrangler tail

# Database console
PGPASSWORD=password psql -h localhost -U postgres -d pitchey

# Redis CLI (if using)
redis-cli ping
```

---

## Best Practices

### Code Style
- Use TypeScript for all new code
- Follow existing patterns in codebase
- No unnecessary comments (code should be self-documenting)
- Use proper error handling with try/catch

### Git Workflow
```bash
# Feature branch
git checkout -b feature/your-feature

# Commit with clear messages
git add .
git commit -m "feat: Add new analytics endpoint"

# Push and create PR
git push origin feature/your-feature
```

### Security
- Never commit secrets (.env files)
- Always validate user input
- Use parameterized queries (Drizzle handles this)
- Implement proper CORS headers

### Performance
- Use KV cache for frequently accessed data
- Implement pagination for large datasets
- Use WebSocket for real-time features
- Optimize bundle size with dynamic imports

---

## Resources

### Documentation
- **Interactive Elements Guide**: `INTERACTIVE_ELEMENTS_DOCUMENTATION.md`
- **Platform Audit Report**: `PLATFORM_AUDIT_REPORT.md`
- **Client Requirements**: `CLIENT_FEEDBACK_REQUIREMENTS.md`
- **Deployment Guide**: `CLOUDFLARE_DEPLOYMENT_GUIDE.md`

### External Documentation (via Context7)
- [React Router v7](https://reactrouter.com)
- [Cloudflare Workers](https://developers.cloudflare.com/workers)
- [Drizzle ORM](https://orm.drizzle.team)
- [Deno Deploy](https://deno.com/deploy)

### Support Channels
- GitHub Issues: [repository]/issues
- Internal Slack: #pitchey-dev
- Documentation: This guide + Context7 resources

---

## Quick Start Checklist

- [ ] Clone repository
- [ ] Install dependencies (npm install in frontend/)
- [ ] Set up PostgreSQL database
- [ ] Run migrations
- [ ] Create .env files
- [ ] Start backend on PORT 8001
- [ ] Start frontend dev server
- [ ] Login with demo account
- [ ] Make your first code change
- [ ] Run tests
- [ ] Create pull request

---

## Conclusion

You're now ready to start developing on the Pitchey platform! This guide combines our internal documentation with Context7-sourced best practices for React Router, Cloudflare Workers, and modern web development patterns.

Remember:
1. **Backend always runs on PORT 8001 locally**
2. **Use the new WebSocket Hibernatable API** (not legacy accept())
3. **Follow existing patterns** in the codebase
4. **Test thoroughly** before deploying
5. **Ask questions** - we're here to help!

Welcome to the team! 🚀