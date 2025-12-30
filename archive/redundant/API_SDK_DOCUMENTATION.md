# Pitchey Platform - API SDK Documentation
**Version**: 1.0
**Date**: December 7, 2024
**Enhanced with Context7 Patterns**

## Table of Contents
1. [API Architecture](#api-architecture)
2. [Authentication & Authorization](#authentication--authorization)
3. [Database Operations SDK](#database-operations-sdk)
4. [Edge Worker API Patterns](#edge-worker-api-patterns)
5. [WebSocket Real-time SDK](#websocket-real-time-sdk)
6. [Storage & Media SDK](#storage--media-sdk)
7. [Error Handling & Retries](#error-handling--retries)
8. [Testing Utilities](#testing-utilities)

---

## API Architecture

### Service Layer Pattern
Our API uses a clean service layer architecture with TypeScript for type safety:

```typescript
// frontend/src/lib/api.ts
import axios from 'axios';

// Production API Configuration
const api = axios.create({
  baseURL: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
  headers: { 'Content-Type': 'application/json' }
});

// For client-side testing in browser console
window.testAPI = {
  baseURL: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
  frontendURL: 'https://pitchey-5o8.pages.dev'
};

// Authentication interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for consistent data extraction
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Edge Worker Request Handler
Based on Cloudflare Workers patterns from Context7:

```typescript
// src/worker-production-db.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // CORS preflight handling
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
    
    // Route matching with pattern
    const routeHandlers: Map<RegExp, Handler> = new Map([
      [/^\/api\/auth\/(creator|investor|production)\/login$/, handleLogin],
      [/^\/api\/pitches\/(\d+)$/, handlePitchById],
      [/^\/api\/user\/profile$/, handleUserProfile],
    ]);
    
    for (const [pattern, handler] of routeHandlers) {
      const match = path.match(pattern);
      if (match) {
        return handler(request, env, match);
      }
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
```

---

## Authentication & Authorization

### JWT Authentication Service

#### Production Testing (Browser Console)
```javascript
// Test authentication directly from https://pitchey-5o8.pages.dev console

// 1. Test Creator Login
const testCreatorLogin = async () => {
  const response = await fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/creator/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.creator@demo.com',
      password: 'Demo123'
    })
  });
  const data = await response.json();
  if (data.token) {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('userType', 'creator');
    console.log('✅ Creator login successful', data);
  }
  return data;
};

// 2. Test Investor Login
const testInvestorLogin = async () => {
  const response = await fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/investor/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sarah.investor@demo.com',
      password: 'Demo123'
    })
  });
  const data = await response.json();
  if (data.token) {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('userType', 'investor');
    console.log('✅ Investor login successful', data);
  }
  return data;
};

// 3. Test Production Company Login
const testProductionLogin = async () => {
  const response = await fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/production/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'stellar.production@demo.com',
      password: 'Demo123'
    })
  });
  const data = await response.json();
  if (data.token) {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('userType', 'production');
    console.log('✅ Production login successful', data);
  }
  return data;
};

// Run tests
testCreatorLogin();
testInvestorLogin();
testProductionLogin();
```

#### JWT Token Service
```typescript
// src/services/auth.service.ts
import jwt from 'jsonwebtoken';

export class AuthService {
  private readonly secret: string;
  
  constructor(secret: string) {
    this.secret = secret;
  }
  
  generateToken(payload: UserPayload): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: '7d',
      algorithm: 'HS256'
    });
  }
  
  verifyToken(token: string): UserPayload | null {
    try {
      return jwt.verify(token, this.secret) as UserPayload;
    } catch {
      return null;
    }
  }
  
  // Portal-specific login
  async loginCreator(email: string, password: string): Promise<AuthResponse> {
    const user = await this.validateCredentials(email, password, 'creator');
    if (!user) throw new Error('Invalid credentials');
    
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      userType: 'creator',
      name: user.name
    });
    
    return { token, user };
  }
}
```

### Role-Based Access Control

#### Production Testing (Browser Console at https://pitchey-5o8.pages.dev)
```javascript
// Test RBAC by attempting to access different portal dashboards

// 1. Get token from login
const token = localStorage.getItem('authToken');

// 2. Test Creator Dashboard Access
fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/creator/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(data => {
  console.log('Creator Dashboard:', data);
});

// 3. Test Investor Dashboard Access
fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/investor/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(data => {
  console.log('Investor Dashboard:', data);
});

// 4. Test Production Dashboard Access
fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/production/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(data => {
  console.log('Production Dashboard:', data);
});

// 5. Test Unauthorized Access (should fail)
fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/admin/users')
  .then(r => r.json())
  .then(console.log)
  .catch(e => console.error('Expected error:', e));
```

#### Implementation Pattern
```typescript
// src/middleware/rbac.ts
export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: Request, env: Env): Promise<Response | void> => {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const payload = verifyToken(token, env.JWT_SECRET);
    if (!payload || !allowedRoles.includes(payload.userType)) {
      return new Response('Forbidden', { status: 403 });
    }
    
    // Attach user to request context
    (request as any).user = payload;
  };
}
```

---

## Database Operations SDK

### Drizzle ORM Patterns (Context7 Enhanced)
Based on Drizzle ORM documentation from Context7:

#### Schema Definition
```typescript
// src/db/schema.ts
import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  userType: text('user_type').notNull(), // 'creator' | 'investor' | 'production'
  verified: boolean('verified').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const pitches = pgTable('pitches', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  logline: text('logline').notNull(),
  genre: text('genre').notNull(),
  creatorId: integer('creator_id').notNull(),
  status: text('status').notNull().default('draft'),
  viewCount: integer('view_count').default(0),
  additionalMedia: jsonb('additional_media'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  pitches: many(pitches),
  investments: many(investments),
}));

export const pitchesRelations = relations(pitches, ({ one, many }) => ({
  creator: one(users, {
    fields: [pitches.creatorId],
    references: [users.id],
  }),
  ndaRequests: many(ndaRequests),
  views: many(pitchViews),
}));
```

#### Query Patterns - Production Testing

##### Browser Console Tests (run at https://pitchey-5o8.pages.dev)
```javascript
// Test pitch queries directly from production

// 1. Get all public pitches
fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches')
  .then(r => r.json())
  .then(data => {
    console.log(`Found ${data.data?.length || 0} pitches`);
    console.table(data.data?.slice(0, 5)); // Show first 5
  });

// 2. Get specific pitch by ID
fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches/1')
  .then(r => r.json())
  .then(data => {
    console.log('Pitch details:', data);
  });

// 3. Test trending pitches
fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches/trending')
  .then(r => r.json())
  .then(data => {
    console.log('Trending pitches:', data);
  });

// 4. Test search functionality
fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches?genre=Action')
  .then(r => r.json())
  .then(data => {
    console.log('Action pitches:', data);
  });
```

##### Implementation Pattern
```typescript
// src/repositories/pitch.repository.ts
export class PitchRepository {
  constructor(private db: DrizzleClient) {}
  
  // Find with relations (Context7 pattern)
  async findWithCreator(pitchId: number) {
    return await this.db.query.pitches.findFirst({
      where: eq(pitches.id, pitchId),
      with: {
        creator: true,
        ndaRequests: {
          where: eq(ndaRequests.status, 'approved'),
        },
      },
    });
  }
  
  // Complex filtering with pagination
  async findTrending(limit = 12, offset = 0) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return await this.db
      .select({
        ...getTableColumns(pitches),
        creator: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.creatorId, users.id))
      .where(
        and(
          gte(pitches.viewCount, 100),
          gte(pitches.createdAt, sevenDaysAgo),
          eq(pitches.status, 'published')
        )
      )
      .orderBy(desc(pitches.viewCount))
      .limit(limit)
      .offset(offset);
  }
  
  // Batch operations
  async batchUpdateViews(updates: Array<{ id: number; views: number }>) {
    const sql = this.db.$with('updates').as(
      this.db
        .select()
        .from(
          values(
            updates.map(u => ({ id: u.id, views: u.views })),
            { id: integer(), views: integer() }
          ).as('t')
        )
    );
    
    await this.db
      .with(sql)
      .update(pitches)
      .set({ viewCount: sql.views })
      .from(sql)
      .where(eq(pitches.id, sql.id));
  }
}
```

#### Migration Management
```typescript
// src/db/migrate.ts
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

export async function runMigrations() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);
  
  await migrate(db, {
    migrationsFolder: './drizzle',
  });
  
  console.log('Migrations completed');
}

// Generate migrations (from Context7 docs)
// npx drizzle-kit generate
// npx drizzle-kit migrate
```

---

## Edge Worker API Patterns

### KV Storage for Caching (Context7 Pattern)
```typescript
// src/services/cache.service.ts
export class EdgeCacheService {
  constructor(private kv: KVNamespace) {}
  
  async get<T>(key: string): Promise<T | null> {
    const cached = await this.kv.get(key, 'json');
    return cached as T | null;
  }
  
  async set(key: string, value: any, ttl = 3600): Promise<void> {
    await this.kv.put(key, JSON.stringify(value), {
      expirationTtl: ttl,
    });
  }
  
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.kv.list({ prefix: pattern });
    await Promise.all(
      keys.keys.map(key => this.kv.delete(key.name))
    );
  }
}

// Usage in Worker
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cache = new EdgeCacheService(env.CACHE_KV);
    
    // Check cache
    const cacheKey = `pitch:${pitchId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { 
          'Content-Type': 'application/json',
          'X-Cache': 'HIT'
        },
      });
    }
    
    // Fetch from database
    const data = await fetchFromDatabase(pitchId);
    
    // Store in cache
    await cache.set(cacheKey, data, 300); // 5 minutes
    
    return new Response(JSON.stringify(data), {
      headers: { 
        'Content-Type': 'application/json',
        'X-Cache': 'MISS'
      },
    });
  }
};
```

### R2 Storage for Media
```typescript
// src/services/storage.service.ts
export class R2StorageService {
  constructor(private r2: R2Bucket) {}
  
  async uploadFile(
    key: string, 
    file: File,
    metadata?: Record<string, string>
  ): Promise<R2Object> {
    const arrayBuffer = await file.arrayBuffer();
    
    return await this.r2.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: metadata,
    });
  }
  
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    // R2 doesn't have native signed URLs, use Worker URL
    return `/api/files/${encodeURIComponent(key)}`;
  }
  
  async deleteFile(key: string): Promise<void> {
    await this.r2.delete(key);
  }
  
  async listFiles(prefix: string): Promise<R2Objects> {
    return await this.r2.list({
      prefix,
      limit: 1000,
    });
  }
}
```

---

## WebSocket Real-time SDK

### Durable Objects WebSocket Pattern (Context7 Enhanced)
Based on Cloudflare's Hibernatable WebSocket API:

```typescript
// src/durable-objects/websocket-room.ts
export class WebSocketRoom extends DurableObject {
  private sessions: Map<WebSocket, Session> = new Map();
  
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }
    
    // Create WebSocket pair (Context7 pattern - NOT using legacy accept())
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    // Use Hibernatable API for efficiency
    this.ctx.acceptWebSocket(server);
    
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
  
  async webSocketMessage(
    ws: WebSocket, 
    message: string | ArrayBuffer
  ): Promise<void> {
    const session = this.sessions.get(ws);
    if (!session) return;
    
    const data = JSON.parse(message as string);
    
    switch (data.type) {
      case 'auth':
        await this.handleAuth(ws, data);
        break;
        
      case 'notification':
        await this.broadcastToUser(data.userId, {
          type: 'notification',
          payload: data.payload,
        });
        break;
        
      case 'presence':
        await this.updatePresence(ws, data.status);
        break;
    }
  }
  
  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ): Promise<void> {
    const session = this.sessions.get(ws);
    if (session) {
      this.sessions.delete(ws);
      await this.broadcastPresenceUpdate(session.userId, 'offline');
    }
  }
  
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
    ws.close(1011, 'WebSocket error');
  }
  
  private async broadcastToUser(userId: string, message: any) {
    const messageStr = JSON.stringify(message);
    
    for (const [ws, session] of this.sessions) {
      if (session.userId === userId) {
        ws.send(messageStr);
      }
    }
  }
  
  private async broadcastToAll(message: any) {
    const messageStr = JSON.stringify(message);
    
    // Use getWebSockets() for all active connections
    for (const ws of this.ctx.getWebSockets()) {
      ws.send(messageStr);
    }
  }
}
```

### Client WebSocket Hook
```typescript
// frontend/src/hooks/useWebSocket.ts
export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  
  useEffect(() => {
    const ws = new WebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:8001');
    
    ws.onopen = () => {
      setConnectionState('connected');
      
      // Authenticate immediately
      const token = localStorage.getItem('authToken');
      if (token) {
        ws.send(JSON.stringify({
          type: 'auth',
          token,
        }));
      }
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Handle different message types
      switch (data.type) {
        case 'notification':
          notificationStore.addNotification(data.payload);
          break;
          
        case 'metrics_update':
          metricsStore.updateMetrics(data.payload);
          break;
          
        case 'presence_update':
          presenceStore.updatePresence(data.userId, data.status);
          break;
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionState('disconnected');
    };
    
    ws.onclose = () => {
      setConnectionState('disconnected');
      // Attempt reconnection after 3 seconds
      setTimeout(() => {
        setSocket(null); // Trigger re-connection
      }, 3000);
    };
    
    setSocket(ws);
    
    return () => {
      ws.close();
    };
  }, []);
  
  const sendMessage = useCallback((message: any) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, [socket]);
  
  return { socket, connectionState, sendMessage };
}
```

---

## Storage & Media SDK

### Multi-part Upload Handler
```typescript
// src/handlers/upload.handler.ts
export async function handleMultipartUpload(
  request: Request,
  env: Env
): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  
  if (!file) {
    return new Response('No file provided', { status: 400 });
  }
  
  // Validate file type and size
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'video/mp4'];
  const maxSize = 100 * 1024 * 1024; // 100MB
  
  if (!allowedTypes.includes(file.type)) {
    return new Response('Invalid file type', { status: 400 });
  }
  
  if (file.size > maxSize) {
    return new Response('File too large', { status: 400 });
  }
  
  // Generate unique key
  const key = `uploads/${Date.now()}-${file.name}`;
  
  // Upload to R2
  const storage = new R2StorageService(env.R2_BUCKET);
  await storage.uploadFile(key, file, {
    uploadedBy: request.user.userId,
    originalName: file.name,
  });
  
  // Store metadata in database
  await db.insert(uploads).values({
    key,
    filename: file.name,
    contentType: file.type,
    size: file.size,
    userId: request.user.userId,
  });
  
  return new Response(JSON.stringify({
    success: true,
    key,
    url: `/api/files/${key}`,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

---

## Error Handling & Retries

### Exponential Backoff Pattern
```typescript
// src/utils/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error) => error.status >= 500,
  } = options;
  
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (!shouldRetry(error) || attempt === maxRetries - 1) {
        throw error;
      }
      
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt),
        maxDelay
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Usage
const data = await withRetry(
  () => api.get('/api/pitches'),
  { 
    maxRetries: 5,
    shouldRetry: (error) => error.status === 429 || error.status >= 500,
  }
);
```

### Global Error Handler
```typescript
// src/middleware/error-handler.ts
export function errorHandler(error: any, request: Request): Response {
  console.error('Error:', error);
  
  // Sentry integration
  if (env.SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers),
      },
    });
  }
  
  // Format error response
  const errorResponse = {
    success: false,
    error: {
      message: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR',
      ...(env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  };
  
  const status = error.status || 500;
  
  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
```

---

## Testing Utilities

### API Testing Helpers
```typescript
// tests/helpers/api-test-utils.ts
export class APITestClient {
  private token?: string;
  
  constructor(private baseURL: string) {}
  
  async authenticate(credentials: LoginCredentials): Promise<void> {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    
    const data = await response.json();
    this.token = data.token;
  }
  
  async request(path: string, options: RequestInit = {}): Promise<Response> {
    return fetch(`${this.baseURL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
    });
  }
  
  async get(path: string): Promise<any> {
    const response = await this.request(path);
    return response.json();
  }
  
  async post(path: string, body: any): Promise<any> {
    const response = await this.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.json();
  }
}

// Usage in tests
describe('Pitch API', () => {
  let client: APITestClient;
  
  beforeAll(async () => {
    client = new APITestClient('http://localhost:8001');
    await client.authenticate({
      email: 'test@example.com',
      password: 'password',
    });
  });
  
  test('should create pitch', async () => {
    const pitch = await client.post('/api/pitches', {
      title: 'Test Pitch',
      logline: 'A test pitch for testing',
      genre: 'drama',
    });
    
    expect(pitch.id).toBeDefined();
    expect(pitch.title).toBe('Test Pitch');
  });
});
```

### Mock Data Generators
```typescript
// tests/factories/data-factory.ts
import { faker } from '@faker-js/faker';

export class DataFactory {
  static createUser(overrides?: Partial<User>): User {
    return {
      id: faker.number.int(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      userType: faker.helpers.arrayElement(['creator', 'investor', 'production']),
      verified: faker.datatype.boolean(),
      createdAt: faker.date.past(),
      ...overrides,
    };
  }
  
  static createPitch(overrides?: Partial<Pitch>): Pitch {
    return {
      id: faker.number.int(),
      title: faker.lorem.sentence(),
      logline: faker.lorem.paragraph(),
      genre: faker.helpers.arrayElement(['drama', 'comedy', 'thriller', 'sci-fi']),
      creatorId: faker.number.int(),
      status: faker.helpers.arrayElement(['draft', 'published', 'archived']),
      viewCount: faker.number.int({ min: 0, max: 10000 }),
      createdAt: faker.date.past(),
      ...overrides,
    };
  }
  
  static async seedDatabase(db: DrizzleClient, config: SeedConfig) {
    const users = Array.from({ length: config.userCount }, () => 
      DataFactory.createUser()
    );
    
    await db.insert(usersTable).values(users);
    
    const pitches = Array.from({ length: config.pitchCount }, () => 
      DataFactory.createPitch({
        creatorId: faker.helpers.arrayElement(users).id,
      })
    );
    
    await db.insert(pitchesTable).values(pitches);
  }
}
```

---

## API Endpoint Reference

### Complete Endpoint Mapping
See [INTERACTIVE_ELEMENTS_DOCUMENTATION.md](./INTERACTIVE_ELEMENTS_DOCUMENTATION.md) for a complete mapping of all API endpoints and their corresponding UI elements.

### Quick Reference
```typescript
// Authentication
POST   /api/auth/creator/login
POST   /api/auth/investor/login
POST   /api/auth/production/login
POST   /api/auth/logout

// Pitches
GET    /api/pitches             // List with filters
GET    /api/pitches/:id         // Single pitch
POST   /api/pitches             // Create
PUT    /api/pitches/:id         // Update
DELETE /api/pitches/:id         // Delete

// NDA Management
POST   /api/nda/request         // Request NDA
GET    /api/nda/requests        // List requests
PUT    /api/nda/approve/:id     // Approve
PUT    /api/nda/reject/:id      // Reject

// Real-time
WS     /ws                      // WebSocket connection
POST   /api/notifications/send  // Send notification
GET    /api/presence/:userId    // Get user presence
```

---

## Next Steps

1. **Generate Client SDKs**: Use OpenAPI spec to generate TypeScript/JavaScript SDK
2. **Add GraphQL Layer**: Implement Drizzle GraphQL for flexible queries
3. **Implement Rate Limiting**: Add rate limiting middleware for API protection
4. **Add API Versioning**: Implement version headers for backward compatibility
5. **Create Postman Collection**: Export API collection for testing
6. **Add WebSocket Testing**: Implement WebSocket test harness
7. **Performance Monitoring**: Add APM and tracing with OpenTelemetry

---

This SDK documentation combines our platform's architecture with best practices from Context7's Drizzle ORM and Cloudflare Workers documentation, providing a comprehensive guide for developers working with the Pitchey API.