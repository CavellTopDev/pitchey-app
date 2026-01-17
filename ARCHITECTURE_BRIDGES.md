# Architecture Bridge Solutions for Pitchey

## Current Architecture Analysis

### Current Stack
- **Frontend**: React (Vite) → Cloudflare Pages
- **Backend**: Cloudflare Workers (TypeScript)
- **Database**: Neon PostgreSQL (Raw SQL, no ORM)
- **Cache**: Upstash Redis
- **Storage**: Cloudflare R2

### Current Pain Points
1. **No Type Safety** between frontend and backend
2. **Manual endpoint synchronization**
3. **No API contract validation**
4. **Raw SQL queries without abstraction**
5. **Missing real-time synchronization**

## Bridge Solutions

### 1. 🎯 **tRPC - Type-Safe API Layer** (RECOMMENDED)
End-to-end type safety without code generation.

#### Benefits
- **Automatic type inference** from backend to frontend
- **No code generation** needed
- **Works with Cloudflare Workers**
- **Zero runtime overhead**
- **Instant API changes reflected in frontend**

#### Implementation
```typescript
// backend/src/trpc/router.ts
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const appRouter = t.router({
  pitch: t.router({
    getAll: t.procedure
      .input(z.object({
        genre: z.string().optional(),
        limit: z.number().default(10)
      }))
      .query(async ({ input, ctx }) => {
        // Your existing logic, but type-safe!
        return await ctx.db.query('SELECT * FROM pitches WHERE...');
      }),
    
    create: t.procedure
      .input(PitchSchema) // Reuse your Zod schemas!
      .mutation(async ({ input, ctx }) => {
        return await ctx.db.insert('pitches', input);
      })
  })
});

// frontend/src/lib/trpc.ts
import { createTRPCProxyClient } from '@trpc/client';
import type { AppRouter } from '../../backend/src/trpc/router';

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [/* ... */]
});

// Usage - fully typed!
const pitches = await trpc.pitch.getAll.query({ genre: 'Action' });
```

### 2. 🔄 **GraphQL with Pothos** (Alternative)
Schema-first approach with strong typing.

#### Benefits
- **Single endpoint** for all queries
- **Selective field fetching** (reduces bandwidth)
- **Built-in introspection**
- **Great for complex relationships**

#### Implementation
```typescript
// backend/src/graphql/schema.ts
import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

builder.objectType('Pitch', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    creator: t.field({
      type: 'User',
      resolve: (pitch) => getUser(pitch.creatorId)
    }),
    ndas: t.field({
      type: ['NDA'],
      resolve: (pitch) => getNDAsForPitch(pitch.id)
    })
  })
});

// Single query gets exactly what you need
const PITCH_WITH_CREATOR = gql`
  query GetPitch($id: ID!) {
    pitch(id: $id) {
      title
      creator { name, email }
      ndas { status, signedAt }
    }
  }
`;
```

### 3. 🛡️ **Zod API Contract Validation**
Shared schemas between frontend and backend.

#### Implementation
```typescript
// shared/schemas/index.ts
import { z } from 'zod';

export const PitchSchema = z.object({
  title: z.string().min(1).max(200),
  logline: z.string().max(500),
  genre: z.enum(['Action', 'Comedy', 'Drama']),
  budget: z.number().positive()
});

export type Pitch = z.infer<typeof PitchSchema>;

// backend: Validate incoming requests
const validated = PitchSchema.parse(requestBody);

// frontend: Type-safe forms
const form = useForm<Pitch>({
  resolver: zodResolver(PitchSchema)
});
```

### 4. 🔌 **Hono with OpenAPI** 
Modern web framework with auto-generated docs.

#### Benefits
- **Cloudflare Workers optimized**
- **OpenAPI spec generation**
- **Type-safe routing**
- **Built-in validation**

```typescript
// backend/src/api/index.ts
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';

const app = new OpenAPIHono();

app.openapi(
  {
    method: 'get',
    path: '/api/pitches/{id}',
    request: {
      params: z.object({ id: z.string() })
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: PitchSchema
          }
        }
      }
    }
  },
  async (c) => {
    const { id } = c.req.valid('param');
    // Your logic here
  }
);

// Auto-generates OpenAPI docs!
app.doc('/openapi.json', { /* ... */ });
```

### 5. 🔄 **Real-time Sync with Partykit**
Replace WebSocket complexity with simple real-time sync.

```typescript
// Automatic real-time updates
import * as Party from "partykit";

export default class PitchRoom extends Party.Server {
  async onMessage(message: string, sender: Party.Connection) {
    const update = JSON.parse(message);
    
    // Broadcast to all connected clients
    this.room.broadcast(message, [sender.id]);
    
    // Persist to database
    await this.env.db.update(update);
  }
}
```

### 6. 🗄️ **Drizzle ORM** (Database Bridge)
Type-safe SQL with migration support.

```typescript
// src/db/schema.ts
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const pitches = pgTable('pitches', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Type-safe queries
const results = await db
  .select()
  .from(pitches)
  .where(eq(pitches.genre, 'Action'))
  .limit(10);
```

### 7. 🚀 **API Gateway Pattern with Cloudflare Service Bindings**
Connect multiple Workers seamlessly.

```typescript
// wrangler.toml
[[services]]
binding = "AUTH_SERVICE"
service = "auth-worker"

[[services]]
binding = "PITCH_SERVICE"
service = "pitch-worker"

// Main worker
export default {
  async fetch(request: Request, env: Env) {
    // Route to appropriate service
    if (request.url.includes('/auth')) {
      return env.AUTH_SERVICE.fetch(request);
    }
    if (request.url.includes('/pitches')) {
      return env.PITCH_SERVICE.fetch(request);
    }
  }
}
```

## Recommended Implementation Plan

### Phase 1: Type Safety (Week 1)
1. **Install tRPC** for end-to-end type safety
2. **Create shared Zod schemas** in a `/shared` folder
3. **Set up tRPC router** wrapping existing handlers

### Phase 2: Database Abstraction (Week 2)
1. **Add Drizzle ORM** for type-safe queries
2. **Generate types from existing database**
3. **Gradually migrate raw SQL to Drizzle**

### Phase 3: Real-time Features (Week 3)
1. **Implement Partykit** for WebSocket replacement
2. **Add optimistic updates** to frontend
3. **Set up subscription patterns**

### Phase 4: Documentation (Week 4)
1. **Generate OpenAPI spec** from tRPC/Hono
2. **Create API playground**
3. **Auto-generate client SDKs**

## Quick Wins (Can Implement Today)

### 1. Shared Types Package
```bash
# Create shared types package
mkdir packages/shared-types
cd packages/shared-types
npm init -y

# Install in both frontend and backend
npm install ../packages/shared-types
```

### 2. API Response Wrapper
```typescript
// shared/api-response.ts
export class ApiResponse<T> {
  constructor(
    public success: boolean,
    public data?: T,
    public error?: string,
    public meta?: Record<string, any>
  ) {}

  static ok<T>(data: T, meta?: Record<string, any>) {
    return new ApiResponse(true, data, undefined, meta);
  }

  static error(error: string) {
    return new ApiResponse(false, undefined, error);
  }
}
```

### 3. Environment-based API Client
```typescript
// frontend/src/lib/api-bridge.ts
class ApiBridge {
  private client: typeof trpc | typeof graphql | ApiClient;
  
  constructor() {
    // Use tRPC in dev, REST in prod
    this.client = import.meta.env.DEV 
      ? trpc 
      : new ApiClient();
  }
  
  // Unified interface
  async getPitches(filters?: any) {
    if ('pitch' in this.client) {
      return this.client.pitch.getAll.query(filters);
    } else {
      return this.client.get('/api/pitches', { params: filters });
    }
  }
}

export const api = new ApiBridge();
```

### 4. Request/Response Interceptors
```typescript
// Add to worker-integrated.ts
const middleware = {
  validateRequest: (schema: ZodSchema) => async (req: Request) => {
    const body = await req.json();
    return schema.parse(body);
  },
  
  typedResponse: <T>(data: T) => {
    return Response.json({
      success: true,
      data,
      timestamp: Date.now()
    });
  }
};
```

## Migration Strategy

### Option A: Incremental (Recommended)
1. Add tRPC alongside existing REST endpoints
2. Migrate one module at a time
3. Keep REST as fallback
4. Remove REST once stable

### Option B: Parallel Development
1. Create new tRPC-based API
2. Run both APIs simultaneously
3. Gradually move frontend to new API
4. Deprecate old API

### Option C: Full Rewrite
1. Stop feature development
2. Rewrite with tRPC + Drizzle
3. Full migration in one release
4. Higher risk but cleaner result

## Performance Considerations

### Caching Strategy
```typescript
// Use Cloudflare KV for tRPC responses
const cachedRouter = t.middleware(async ({ next, ctx, path }) => {
  const cacheKey = `trpc:${path}:${JSON.stringify(input)}`;
  
  // Check cache
  const cached = await ctx.env.KV.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Execute and cache
  const result = await next();
  await ctx.env.KV.put(cacheKey, JSON.stringify(result), {
    expirationTtl: 300 // 5 minutes
  });
  
  return result;
});
```

## Recommended Stack

### For Pitchey's Specific Needs:
1. **tRPC** - Immediate type safety with minimal changes
2. **Drizzle ORM** - Type-safe database with migrations
3. **Zod** - Shared validation schemas
4. **Partykit** - Simple WebSocket replacement
5. **Hono** - Modern routing with OpenAPI

This combination provides:
- ✅ End-to-end type safety
- ✅ Auto-generated documentation
- ✅ Real-time capabilities
- ✅ Database migrations
- ✅ Cloudflare Workers optimization

## Next Steps

1. **Install tRPC** (1 hour)
   ```bash
   npm install @trpc/server @trpc/client
   ```

2. **Create first tRPC router** (2 hours)
   - Wrap existing pitch endpoints
   - Test with frontend

3. **Add Drizzle** (3 hours)
   - Generate schema from existing database
   - Create first typed query

4. **Deploy and test** (1 hour)
   - Ensure Cloudflare Workers compatibility
   - Monitor performance

Total time to basic implementation: ~1 day

## Conclusion

The best bridge for Pitchey is **tRPC + Drizzle ORM** because:
- Minimal changes to existing code
- Instant type safety
- Works perfectly with Cloudflare Workers
- No build step or code generation
- Can be added incrementally

Start with tRPC for the API layer, then add Drizzle for database type safety. This combination will eliminate most of your current pain points while maintaining your existing architecture.