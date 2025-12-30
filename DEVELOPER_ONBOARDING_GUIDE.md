# Pitchey Platform: Developer Onboarding & Best Practices Guide

**Version 2.0 - Enterprise CI/CD Edition**  
**Last Updated: December 2024**  
**Maintainer: Platform Engineering Team**

---

## 🎯 Table of Contents

### Part 1: Quick Start Guide
- [Welcome Aboard](#welcome-aboard)
- [Essential Tools & Setup](#essential-tools--setup)
- [Your First Day Checklist](#your-first-day-checklist)
- [First Deployment Walkthrough](#first-deployment-walkthrough)
- [Common Issues & Solutions](#common-issues--solutions)

### Part 2: Development Workflows
- [Git Branch Strategy](#git-branch-strategy)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Code Review Best Practices](#code-review-best-practices)
- [Testing Requirements](#testing-requirements)
- [Documentation Standards](#documentation-standards)

### Part 3: Platform Architecture
- [Service Architecture Overview](#service-architecture-overview)
- [Database Schema & Migrations](#database-schema--migrations)
- [API Design Patterns](#api-design-patterns)
- [WebSocket Implementation](#websocket-implementation)
- [Caching Strategies](#caching-strategies)

### Part 4: Operational Excellence
- [Monitoring & Debugging](#monitoring--debugging)
- [Performance Optimization](#performance-optimization)
- [Security Best Practices](#security-best-practices)
- [Incident Response Procedures](#incident-response-procedures)
- [On-Call Responsibilities](#on-call-responsibilities)

---

## Part 1: Quick Start Guide

### Welcome Aboard

Welcome to the Pitchey development team! You're joining a platform that connects creators, investors, and production companies in the entertainment industry. Our tech stack is modern, serverless, and edge-first.

**Your Impact**: Every line of code you write affects thousands of creators pitching their dreams and investors discovering the next big hit.

### Essential Tools & Setup

#### 🛠️ Required Software Installation

```bash
#!/bin/bash
# quick-setup.sh - Run this on your first day!

echo "🚀 Installing Pitchey Development Environment..."

# 1. Core Tools
brew install node@18 git curl jq watchman

# 2. Deno for local proxy server
curl -fsSL https://deno.land/install.sh | sh
echo 'export DENO_INSTALL="$HOME/.deno"' >> ~/.zshrc
echo 'export PATH="$DENO_INSTALL/bin:$PATH"' >> ~/.zshrc

# 3. Cloudflare Wrangler
npm install -g wrangler@latest

# 4. Database Tools
brew install postgresql@15 redis

# 5. Development Utilities
npm install -g tsx typescript @playwright/test concurrently

# 6. Security Tools
brew install git-secrets gnupg

# 7. VS Code Extensions (if using VS Code)
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension bradlc.vscode-tailwindcss
code --install-extension prisma.prisma

echo "✅ Base installation complete!"
```

#### 🔑 Environment Configuration

```bash
# Setup your local environment
cp .env.example .env.local

# Edit .env.local with your editor
nano .env.local
```

**Critical Environment Variables:**

```bash
# .env.local - NEVER commit this file!

# Authentication (use strong local secret)
JWT_SECRET=your-super-secret-local-jwt-key-min-32-chars
AUTH_COOKIE_NAME=pitchey-auth
SESSION_DURATION=86400

# Database (local PostgreSQL)
DATABASE_URL=postgresql://postgres:password@localhost:5432/pitchey_dev
DATABASE_POOL_SIZE=20

# Redis Cache (local Redis)
REDIS_URL=redis://localhost:6379
CACHE_TTL=300

# API Configuration
PORT=8001  # CRITICAL: Backend always runs on 8001
API_RATE_LIMIT=100
API_TIMEOUT=30000

# Frontend Development
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001
VITE_ENV=development

# Feature Flags
ENABLE_WEBSOCKET=true
ENABLE_DEBUG_MODE=true
ENABLE_MOCK_DATA=false

# Monitoring (optional for local)
SENTRY_DSN=
LOG_LEVEL=debug
```

### Your First Day Checklist

#### Morning (9 AM - 12 PM)

- [ ] **Access Setup**
  ```bash
  # Verify GitHub access
  git clone git@github.com:pitchey/platform.git
  cd platform
  
  # Verify Cloudflare access
  wrangler whoami
  
  # Should output your Cloudflare account email
  ```

- [ ] **Database Setup**
  ```bash
  # Start PostgreSQL
  brew services start postgresql@15
  
  # Create development database
  createdb pitchey_dev
  
  # Run migrations
  npm run db:migrate:local
  
  # Seed with test data
  npm run db:seed
  
  # Verify connection
  psql -d pitchey_dev -c "SELECT COUNT(*) FROM users;"
  ```

- [ ] **Run the Application**
  ```bash
  # Terminal 1: Start backend proxy (IMPORTANT: Port 8001)
  PORT=8001 deno run --allow-all working-server.ts
  
  # Terminal 2: Start frontend
  cd frontend
  npm install
  npm run dev
  
  # Terminal 3: Start Worker (optional)
  wrangler dev --local
  ```

- [ ] **Verify Everything Works**
  ```bash
  # Check health endpoints
  curl http://localhost:8001/health
  # Should return: {"status":"ok"}
  
  # Check frontend
  open http://localhost:5173
  # Should load the Pitchey homepage
  ```

#### Afternoon (1 PM - 5 PM)

- [ ] **Explore the Platform**
  ```bash
  # Login with demo accounts (password: Demo123)
  
  # Creator Portal
  Email: alex.creator@demo.com
  Features: Create pitches, upload documents, track views
  
  # Investor Portal
  Email: sarah.investor@demo.com
  Features: Browse pitches, sign NDAs, contact creators
  
  # Production Portal
  Email: stellar.production@demo.com
  Features: Scout talent, manage projects, bulk operations
  ```

- [ ] **Make Your First Contribution**
  ```bash
  # Create your feature branch
  git checkout -b feat/add-your-name-to-contributors
  
  # Add your name to CONTRIBUTORS.md
  echo "- Your Name (@github-username)" >> CONTRIBUTORS.md
  
  # Commit with conventional commit message
  git add CONTRIBUTORS.md
  git commit -m "feat: add [Your Name] to contributors list"
  
  # Push and create PR
  git push origin feat/add-your-name-to-contributors
  gh pr create --title "feat: add [Your Name] to contributors" \
               --body "Adding myself to the contributors list"
  ```

### First Deployment Walkthrough

#### Local Testing Deployment

```bash
# 1. Build and validate
npm run build
npm run test
npm run type-check

# 2. Deploy to development environment
wrangler deploy --env development

# 3. Test the deployment
curl https://pitchey-dev.workers.dev/health

# 4. Run smoke tests
npm run test:smoke -- --env=development
```

#### Your First Production Deployment

```bash
# 1. Ensure you're on main branch
git checkout main
git pull origin main

# 2. Run pre-deployment checks
./scripts/validate-environment.sh production

# 3. Create deployment tag
VERSION=$(date +%Y.%m.%d)-$(git rev-parse --short HEAD)
git tag -a "v$VERSION" -m "Release version $VERSION"

# 4. Trigger deployment pipeline
git push origin "v$VERSION"

# The CI/CD pipeline will:
# - Run all tests
# - Security scans
# - Build artifacts
# - Deploy to production
# - Run post-deployment validation
```

### Common Issues & Solutions

#### Issue 1: Port 8001 Already in Use

```bash
# Find and kill the process
lsof -i :8001
kill -9 [PID]

# Or use a different port temporarily
PORT=8002 deno run --allow-all working-server.ts
# Update frontend .env accordingly
```

#### Issue 2: Database Connection Refused

```bash
# Check PostgreSQL is running
brew services list | grep postgresql

# Restart if needed
brew services restart postgresql@15

# Check connection
psql -U postgres -c "SELECT 1"
```

#### Issue 3: TypeScript Errors

```bash
# Clear cache and reinstall
rm -rf node_modules .next .turbo
npm clean-install

# Rebuild TypeScript definitions
npm run type-check -- --force
```

#### Issue 4: WebSocket Connection Failed

```bash
# Ensure backend is running on correct port
curl http://localhost:8001/ws

# Check CORS settings in worker
# Should include localhost:5173 in allowed origins
```

---

## Part 2: Development Workflows

### Git Branch Strategy

We follow a **Git Flow** inspired model with some modifications:

```mermaid
gitGraph
    commit id: "main"
    branch develop
    checkout develop
    commit id: "dev work"
    branch feature/user-auth
    checkout feature/user-auth
    commit id: "auth logic"
    commit id: "tests"
    checkout develop
    merge feature/user-auth
    branch release/1.0
    checkout release/1.0
    commit id: "version bump"
    checkout main
    merge release/1.0 tag: "v1.0.0"
    checkout develop
    merge main
```

#### Branch Naming Conventions

```bash
# Feature branches
feature/add-payment-integration
feature/JIRA-123-user-dashboard

# Bug fixes
bugfix/fix-login-redirect
bugfix/JIRA-456-nda-validation

# Hotfixes (urgent production fixes)
hotfix/critical-auth-bypass
hotfix/database-connection-leak

# Release branches
release/1.2.0
release/2024.12.15

# Experimental/Proof of Concept
experiment/websocket-scaling
poc/ai-pitch-analysis
```

### Pull Request Guidelines

#### PR Template

```markdown
## 📋 Description
Brief description of what this PR does

## 🎯 Related Issues
Closes #123
Relates to #456

## ✅ Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] TypeScript types updated
- [ ] Database migrations included
- [ ] Security implications reviewed
- [ ] Performance impact considered
- [ ] Accessibility requirements met
- [ ] Cross-browser tested

## 📸 Screenshots/Videos
(if UI changes)

## 🧪 Testing Instructions
1. Step-by-step guide
2. Expected behavior
3. Edge cases to verify

## 🚀 Deployment Notes
- [ ] No special deployment steps required
- [ ] Requires database migration
- [ ] Requires secret rotation
- [ ] Requires cache clear

## 📊 Performance Impact
- Bundle size change: +0.5KB
- API response time: No change
- Database queries: Added 1 indexed query
```

#### PR Size Guidelines

```typescript
// Ideal PR sizes
const PR_GUIDELINES = {
  tiny: {
    lines: "< 50",
    files: "1-2",
    reviewTime: "< 10 min",
    examples: ["typo fixes", "config updates"]
  },
  small: {
    lines: "50-200",
    files: "3-5",
    reviewTime: "< 30 min",
    examples: ["bug fixes", "small features"]
  },
  medium: {
    lines: "200-500",
    files: "5-10",
    reviewTime: "< 1 hour",
    examples: ["new endpoints", "component refactors"]
  },
  large: {
    lines: "500+",
    files: "10+",
    reviewTime: "1+ hours",
    examples: ["new features", "major refactors"],
    note: "Consider breaking into smaller PRs"
  }
};
```

### Code Review Best Practices

#### For Reviewers

```typescript
// Code Review Checklist
interface ReviewChecklist {
  security: {
    noHardcodedSecrets: boolean;
    inputValidation: boolean;
    authorizationChecks: boolean;
    sqlInjectionPrevention: boolean;
  };
  
  performance: {
    efficientQueries: boolean;
    appropriateCaching: boolean;
    noN1Problems: boolean;
    bundleSizeImpact: boolean;
  };
  
  code_quality: {
    readableCode: boolean;
    appropriateAbstractions: boolean;
    testCoverage: boolean;
    errorHandling: boolean;
  };
  
  business_logic: {
    requirementsMet: boolean;
    edgeCasesHandled: boolean;
    backwardsCompatible: boolean;
  };
}

// Review Comments Examples

// ✅ Good feedback
"Consider extracting this logic into a reusable utility function 
to improve maintainability. See src/utils/validation.ts for similar patterns."

// ❌ Poor feedback
"This is wrong."

// ✅ Security concern
"🔒 Security: This endpoint lacks rate limiting. Consider adding 
the rateLimiter middleware to prevent abuse. Example:
router.post('/api/resource', rateLimiter(100), handler);"

// ✅ Performance suggestion
"⚡ Performance: This query could benefit from an index on 
(user_id, created_at). Currently doing a full table scan."
```

#### For Authors

```bash
# Before requesting review

# 1. Self-review your changes
git diff main...HEAD

# 2. Run all checks locally
npm run precommit

# 3. Test edge cases
npm run test -- --grep "edge cases"

# 4. Update documentation
npm run docs:generate

# 5. Check bundle size impact
npm run build:analyze
```

### Testing Requirements

#### Test Coverage Targets

```javascript
// coverage.config.js
module.exports = {
  global: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80
  },
  critical: {
    // Critical paths require higher coverage
    'src/auth/**': {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95
    },
    'src/payments/**': {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95
    }
  }
};
```

#### Test Structure

```typescript
// Example test file: user.service.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserService } from './user.service';
import { mockDatabase } from '@/test/mocks';

describe('UserService', () => {
  let service: UserService;
  
  beforeEach(() => {
    service = new UserService(mockDatabase);
  });
  
  afterEach(() => {
    mockDatabase.reset();
  });
  
  describe('createUser', () => {
    it('should create a user with valid data', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        role: 'creator'
      };
      
      // Act
      const user = await service.createUser(userData);
      
      // Assert
      expect(user).toMatchObject({
        email: userData.email,
        role: userData.role
      });
      expect(user.password).not.toBe(userData.password); // Should be hashed
    });
    
    it('should throw on duplicate email', async () => {
      // Arrange
      const email = 'duplicate@example.com';
      await service.createUser({ email, password: 'Pass123!', role: 'creator' });
      
      // Act & Assert
      await expect(
        service.createUser({ email, password: 'Pass456!', role: 'investor' })
      ).rejects.toThrow('Email already exists');
    });
    
    // Edge cases
    it('should handle SQL injection attempts', async () => {
      const maliciousEmail = "admin'--@example.com";
      const user = await service.createUser({
        email: maliciousEmail,
        password: 'Pass123!',
        role: 'creator'
      });
      
      expect(user.email).toBe(maliciousEmail); // Should be safely stored
    });
  });
});
```

### Documentation Standards

#### Code Documentation

```typescript
/**
 * Creates a new pitch in the system with automatic draft saving
 * 
 * @param {CreatePitchDTO} pitchData - The pitch creation data
 * @param {string} userId - The authenticated user's ID
 * @param {RequestContext} ctx - Request context for tracing
 * 
 * @returns {Promise<Pitch>} The created pitch with generated ID
 * 
 * @throws {ValidationError} If pitch data is invalid
 * @throws {UnauthorizedError} If user lacks permission
 * @throws {DatabaseError} If database operation fails
 * 
 * @example
 * ```typescript
 * const pitch = await createPitch({
 *   title: "The Next Big Thing",
 *   genre: "SciFi",
 *   logline: "In a world where...",
 *   synopsis: "Detailed story..."
 * }, userId, ctx);
 * ```
 * 
 * @since 1.2.0
 * @see {@link updatePitch} For updating existing pitches
 * @see {@link PitchSchema} For data structure
 */
export async function createPitch(
  pitchData: CreatePitchDTO,
  userId: string,
  ctx: RequestContext
): Promise<Pitch> {
  // Implementation
}
```

#### API Documentation

```yaml
# api-docs/pitches.yaml
/api/pitches:
  post:
    summary: Create a new pitch
    tags: [Pitches]
    security:
      - bearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/CreatePitchRequest'
          examples:
            minimal:
              summary: Minimal pitch
              value:
                title: "Untitled Screenplay"
                genre: "Drama"
                logline: "A compelling story..."
            complete:
              summary: Complete pitch with all fields
              value:
                title: "The Matrix Reborn"
                genre: "SciFi"
                logline: "When reality glitches..."
                synopsis: "Full synopsis..."
                themes: ["Reality", "Freedom", "Technology"]
                comparisons: ["The Matrix", "Inception"]
    responses:
      '201':
        description: Pitch created successfully
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Pitch'
      '400':
        $ref: '#/components/responses/ValidationError'
      '401':
        $ref: '#/components/responses/Unauthorized'
      '429':
        $ref: '#/components/responses/RateLimited'
```

---

## Part 3: Platform Architecture

### Service Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        Web[React SPA]
        Mobile[Mobile App]
        API[API Clients]
    end
    
    subgraph "Edge Layer"
        CF[Cloudflare Workers]
        DO[Durable Objects]
        Cache[Edge Cache]
    end
    
    subgraph "Application Layer"
        Auth[Auth Service]
        Pitch[Pitch Service]
        NDA[NDA Service]
        WS[WebSocket Service]
        Analytics[Analytics Service]
    end
    
    subgraph "Data Layer"
        Neon[(Neon PostgreSQL)]
        Redis[(Redis Cache)]
        R2[R2 Object Storage]
        KV[KV Store]
    end
    
    Web --> CF
    Mobile --> CF
    API --> CF
    
    CF --> Auth
    CF --> Pitch
    CF --> NDA
    CF --> WS
    CF --> Analytics
    
    Auth --> Neon
    Pitch --> Neon
    NDA --> Neon
    
    Auth --> Redis
    Pitch --> Redis
    
    Pitch --> R2
    
    CF --> Cache
    CF --> KV
    
    WS --> DO
```

### Database Schema & Migrations

#### Core Schema Design

```sql
-- Core user system with role-based access
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('creator', 'investor', 'production', 'admin')),
    profile JSONB DEFAULT '{}',
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    
    -- Indexes for performance
    INDEX idx_users_email (email),
    INDEX idx_users_role (role),
    INDEX idx_users_created (created_at DESC)
);

-- Pitches with full-text search
CREATE TABLE pitches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    genre VARCHAR(100) NOT NULL,
    logline TEXT NOT NULL,
    synopsis TEXT,
    themes TEXT[],
    status VARCHAR(50) DEFAULT 'draft',
    visibility VARCHAR(50) DEFAULT 'private',
    view_count INTEGER DEFAULT 0,
    
    -- Full-text search
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', title), 'A') ||
        setweight(to_tsvector('english', logline), 'B') ||
        setweight(to_tsvector('english', COALESCE(synopsis, '')), 'C')
    ) STORED,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    
    -- Indexes
    INDEX idx_pitches_creator (creator_id),
    INDEX idx_pitches_status (status),
    INDEX idx_pitches_search USING GIN (search_vector),
    INDEX idx_pitches_created (created_at DESC)
);

-- NDA tracking with audit trail
CREATE TABLE ndas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    signed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    document_version VARCHAR(50),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one NDA per user per pitch
    UNIQUE(pitch_id, user_id),
    
    -- Indexes
    INDEX idx_ndas_pitch (pitch_id),
    INDEX idx_ndas_user (user_id),
    INDEX idx_ndas_status (status)
);
```

#### Migration Best Practices

```typescript
// migrations/001_add_pitch_analytics.ts
import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Always use transactions for safety
  await db.transaction().execute(async (trx) => {
    // Create new table
    await trx.schema
      .createTable('pitch_analytics')
      .addColumn('id', 'uuid', (col) => 
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('pitch_id', 'uuid', (col) =>
        col.references('pitches.id').onDelete('cascade').notNull()
      )
      .addColumn('event_type', 'varchar(50)', (col) => col.notNull())
      .addColumn('user_id', 'uuid', (col) => col.references('users.id'))
      .addColumn('metadata', 'jsonb', (col) => col.defaultTo('{}'))
      .addColumn('created_at', 'timestamptz', (col) => 
        col.defaultTo(sql`now()`).notNull()
      )
      .execute();
    
    // Add indexes
    await trx.schema
      .createIndex('idx_pitch_analytics_pitch')
      .on('pitch_analytics')
      .columns(['pitch_id', 'created_at'])
      .execute();
    
    // Backfill data if needed
    await trx
      .insertInto('pitch_analytics')
      .columns(['pitch_id', 'event_type', 'metadata'])
      .expression((eb) =>
        eb.selectFrom('pitches')
          .select([
            'id as pitch_id',
            eb.lit('view').as('event_type'),
            eb.lit({ source: 'migration' }).as('metadata')
          ])
          .where('view_count', '>', 0)
      )
      .execute();
  });
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('pitch_analytics').execute();
}
```

### API Design Patterns

#### RESTful API Structure

```typescript
// src/routes/pitch.routes.ts
import { Router } from '@/core/router';
import { authenticate, authorize, validate, rateLimiter } from '@/middleware';
import { PitchController } from '@/controllers/pitch.controller';
import { CreatePitchSchema, UpdatePitchSchema } from '@/schemas/pitch.schema';

const router = new Router();
const controller = new PitchController();

// Public endpoints
router.get('/api/pitches/trending',
  rateLimiter({ requests: 100, window: '1m' }),
  controller.getTrending
);

// Protected endpoints
router.post('/api/pitches',
  authenticate(),
  authorize('creator'),
  rateLimiter({ requests: 10, window: '1h' }),
  validate(CreatePitchSchema),
  controller.create
);

router.patch('/api/pitches/:id',
  authenticate(),
  authorize('creator'),
  validate(UpdatePitchSchema),
  controller.update
);

// Batch operations
router.post('/api/pitches/batch',
  authenticate(),
  authorize('admin'),
  rateLimiter({ requests: 1, window: '1m' }),
  controller.batchOperation
);

export default router;
```

#### Error Handling Pattern

```typescript
// src/core/errors.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(details: any) {
    super(400, 'Validation failed', 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

// Global error handler
export async function errorHandler(
  error: Error,
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Log to monitoring
  ctx.waitUntil(
    logError(error, {
      url: request.url,
      method: request.method,
      userId: (request as any).userId
    })
  );
  
  // Handle known errors
  if (error instanceof AppError) {
    return new Response(
      JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      }),
      {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // Handle unknown errors
  const errorId = crypto.randomUUID();
  console.error(`Unexpected error ${errorId}:`, error);
  
  return new Response(
    JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        reference: errorId
      }
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
```

### WebSocket Implementation

#### Real-time Communication Layer

```typescript
// src/websocket/websocket.service.ts
export class WebSocketService {
  private connections: Map<string, WebSocket> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  
  constructor(
    private durableObject: DurableObjectNamespace,
    private redis: Redis
  ) {}
  
  async handleConnection(
    request: Request,
    env: Env
  ): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }
    
    // Authenticate the connection
    const token = new URL(request.url).searchParams.get('token');
    const user = await this.authenticateToken(token);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    // Accept the WebSocket connection
    server.accept();
    
    // Store connection
    const connectionId = crypto.randomUUID();
    this.connections.set(connectionId, server);
    
    // Setup event handlers
    server.addEventListener('message', async (event) => {
      await this.handleMessage(connectionId, user, event.data);
    });
    
    server.addEventListener('close', () => {
      this.handleDisconnect(connectionId, user);
    });
    
    // Send initial state
    server.send(JSON.stringify({
      type: 'connection',
      payload: {
        connectionId,
        userId: user.id,
        timestamp: Date.now()
      }
    }));
    
    // Track presence
    await this.updatePresence(user.id, 'online');
    
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
  
  private async handleMessage(
    connectionId: string,
    user: User,
    data: string
  ): Promise<void> {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'join_room':
          await this.joinRoom(connectionId, user, message.room);
          break;
          
        case 'leave_room':
          await this.leaveRoom(connectionId, message.room);
          break;
          
        case 'broadcast':
          await this.broadcast(user, message.room, message.payload);
          break;
          
        case 'typing':
          await this.broadcastTyping(user, message.room, message.isTyping);
          break;
          
        case 'ping':
          this.connections.get(connectionId)?.send(
            JSON.stringify({ type: 'pong', timestamp: Date.now() })
          );
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendError(connectionId, 'Invalid message format');
    }
  }
  
  private async joinRoom(
    connectionId: string,
    user: User,
    roomId: string
  ): Promise<void> {
    // Check permissions
    if (!await this.canJoinRoom(user, roomId)) {
      this.sendError(connectionId, 'Permission denied');
      return;
    }
    
    // Add to room
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(connectionId);
    
    // Notify room members
    await this.broadcastToRoom(roomId, {
      type: 'user_joined',
      payload: {
        userId: user.id,
        username: user.name,
        timestamp: Date.now()
      }
    }, connectionId);
    
    // Send room state to new member
    const roomState = await this.getRoomState(roomId);
    this.connections.get(connectionId)?.send(
      JSON.stringify({
        type: 'room_state',
        payload: roomState
      })
    );
  }
  
  private async broadcast(
    sender: User,
    roomId: string,
    payload: any
  ): Promise<void> {
    const message = {
      type: 'message',
      payload: {
        ...payload,
        senderId: sender.id,
        senderName: sender.name,
        timestamp: Date.now()
      }
    };
    
    await this.broadcastToRoom(roomId, message);
    
    // Store in message history
    await this.redis.lpush(
      `room:${roomId}:messages`,
      JSON.stringify(message)
    );
    await this.redis.ltrim(`room:${roomId}:messages`, 0, 99);
  }
  
  private async broadcastToRoom(
    roomId: string,
    message: any,
    exclude?: string
  ): Promise<void> {
    const connections = this.rooms.get(roomId);
    if (!connections) return;
    
    const messageStr = JSON.stringify(message);
    
    for (const connId of connections) {
      if (connId === exclude) continue;
      
      const ws = this.connections.get(connId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }
  }
}
```

### Caching Strategies

#### Multi-Layer Cache Implementation

```typescript
// src/cache/cache-manager.ts
export class CacheManager {
  private readonly layers = {
    edge: 'cloudflare-kv',    // L1: Edge cache (global)
    redis: 'upstash-redis',    // L2: Distributed cache
    memory: 'in-memory'        // L3: Local memory cache
  };
  
  constructor(
    private kv: KVNamespace,
    private redis: Redis,
    private env: Env
  ) {}
  
  /**
   * Get from cache with fallback layers
   */
  async get<T>(
    key: string,
    options?: CacheOptions
  ): Promise<T | null> {
    const startTime = Date.now();
    
    // Try L1: Edge cache
    if (!options?.skipEdge) {
      const edgeValue = await this.kv.get(key, 'json');
      if (edgeValue) {
        this.recordHit('edge', Date.now() - startTime);
        return edgeValue as T;
      }
    }
    
    // Try L2: Redis
    if (!options?.skipRedis) {
      const redisValue = await this.redis.get(key);
      if (redisValue) {
        // Promote to edge cache
        await this.kv.put(key, redisValue, {
          expirationTtl: options?.edgeTtl || 60
        });
        
        this.recordHit('redis', Date.now() - startTime);
        return JSON.parse(redisValue) as T;
      }
    }
    
    this.recordMiss(Date.now() - startTime);
    return null;
  }
  
  /**
   * Set in all cache layers
   */
  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<void> {
    const serialized = JSON.stringify(value);
    
    // Set in all layers concurrently
    await Promise.all([
      // Edge cache
      this.kv.put(key, serialized, {
        expirationTtl: options?.edgeTtl || 300,
        metadata: {
          created: Date.now(),
          tags: options?.tags
        }
      }),
      
      // Redis cache
      this.redis.setex(
        key,
        options?.redisTtl || 3600,
        serialized
      )
    ]);
  }
  
  /**
   * Invalidate by pattern or tags
   */
  async invalidate(
    pattern: string | { tags: string[] }
  ): Promise<void> {
    if (typeof pattern === 'string') {
      // Invalidate by key pattern
      await this.invalidatePattern(pattern);
    } else {
      // Invalidate by tags
      await this.invalidateTags(pattern.tags);
    }
  }
  
  private async invalidatePattern(pattern: string): Promise<void> {
    // KV doesn't support pattern deletion, need to track keys
    const keys = await this.getKeysByPattern(pattern);
    
    await Promise.all([
      // Delete from KV
      Promise.all(keys.map(key => this.kv.delete(key))),
      
      // Delete from Redis
      this.redis.eval(
        `for _,k in ipairs(redis.call('keys', ARGV[1])) do 
          redis.call('del', k) 
        end`,
        0,
        pattern
      )
    ]);
  }
  
  /**
   * Cache warming strategy
   */
  async warmCache(keys: CacheWarmingConfig[]): Promise<void> {
    console.log(`Warming ${keys.length} cache entries...`);
    
    const results = await Promise.allSettled(
      keys.map(async (config) => {
        const data = await config.loader();
        await this.set(config.key, data, config.options);
      })
    );
    
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.error(`Failed to warm ${failed.length} entries`);
    }
  }
}

// Cache configuration
export const CACHE_CONFIG = {
  // Static content (long TTL)
  static: {
    edgeTtl: 86400,  // 24 hours
    redisTtl: 604800 // 7 days
  },
  
  // User sessions
  session: {
    edgeTtl: 300,    // 5 minutes
    redisTtl: 3600   // 1 hour
  },
  
  // API responses
  api: {
    pitches: {
      list: { edgeTtl: 60, redisTtl: 300 },
      detail: { edgeTtl: 300, redisTtl: 3600 },
      trending: { edgeTtl: 30, redisTtl: 60 }
    }
  }
};
```

---

## Part 4: Operational Excellence

### Monitoring & Debugging

#### Comprehensive Monitoring Setup

```typescript
// src/monitoring/monitor.ts
export class MonitoringService {
  private metrics: MetricsCollector;
  private tracer: Tracer;
  private profiler: Profiler;
  
  constructor(private env: Env) {
    this.metrics = new MetricsCollector(env);
    this.tracer = new Tracer(env);
    this.profiler = new Profiler(env);
  }
  
  /**
   * Wrap API handler with monitoring
   */
  instrumentHandler(
    name: string,
    handler: Handler
  ): Handler {
    return async (request: Request, env: Env, ctx: ExecutionContext) => {
      const span = this.tracer.startSpan(name);
      const timer = this.metrics.startTimer();
      
      try {
        // Add request context
        span.setAttributes({
          'http.method': request.method,
          'http.url': request.url,
          'http.user_agent': request.headers.get('user-agent'),
          'cf.ray': request.headers.get('cf-ray')
        });
        
        // Execute handler
        const response = await handler(request, env, ctx);
        
        // Record success metrics
        span.setStatus({ code: SpanStatusCode.OK });
        this.metrics.recordRequest({
          method: request.method,
          path: new URL(request.url).pathname,
          status: response.status,
          duration: timer.end()
        });
        
        return response;
        
      } catch (error) {
        // Record error metrics
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message
        });
        
        this.metrics.recordError({
          method: request.method,
          path: new URL(request.url).pathname,
          error: error as Error
        });
        
        throw error;
        
      } finally {
        span.end();
      }
    };
  }
  
  /**
   * Custom debug logging
   */
  debug(message: string, context?: any): void {
    if (this.env.DEBUG_MODE) {
      console.log(
        JSON.stringify({
          level: 'debug',
          message,
          context,
          timestamp: new Date().toISOString(),
          environment: this.env.ENVIRONMENT
        })
      );
    }
  }
}
```

#### Debugging Production Issues

```bash
# Real-time log streaming
wrangler tail --format=pretty

# Filter specific errors
wrangler tail --search="error" --search="500"

# Monitor specific user
wrangler tail --search="userId:123456"

# Export logs for analysis
wrangler tail --format=json > logs.json
jq '.[] | select(.level == "error")' logs.json
```

### Performance Optimization

#### Database Query Optimization

```typescript
// src/db/query-optimizer.ts
export class QueryOptimizer {
  /**
   * N+1 query prevention using DataLoader
   */
  createLoader<K, V>(
    batchFn: (keys: K[]) => Promise<V[]>
  ): DataLoader<K, V> {
    return new DataLoader(batchFn, {
      cache: true,
      maxBatchSize: 100,
      batchScheduleFn: (callback) => setTimeout(callback, 10)
    });
  }
  
  /**
   * Optimized pagination with cursor
   */
  async paginateWithCursor<T>(
    query: Kysely<any>,
    options: {
      cursor?: string;
      limit: number;
      orderBy: string;
    }
  ): Promise<PaginatedResult<T>> {
    let finalQuery = query.limit(options.limit + 1);
    
    if (options.cursor) {
      const decodedCursor = this.decodeCursor(options.cursor);
      finalQuery = finalQuery.where(
        options.orderBy,
        '>',
        decodedCursor.value
      );
    }
    
    const results = await finalQuery.execute();
    const hasMore = results.length > options.limit;
    
    if (hasMore) {
      results.pop();
    }
    
    return {
      items: results.slice(0, options.limit),
      nextCursor: hasMore
        ? this.encodeCursor({
            value: results[results.length - 1][options.orderBy]
          })
        : null,
      hasMore
    };
  }
  
  /**
   * Query result caching with invalidation
   */
  async cachedQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: {
      ttl: number;
      tags?: string[];
    }
  ): Promise<T> {
    // Try cache first
    const cached = await cache.get<T>(key);
    if (cached) return cached;
    
    // Execute query
    const result = await queryFn();
    
    // Cache result
    await cache.set(key, result, {
      ttl: options.ttl,
      tags: options.tags
    });
    
    return result;
  }
}
```

#### Frontend Performance

```typescript
// frontend/src/utils/performance.ts

/**
 * Lazy load components
 */
export const LazyDashboard = lazy(() =>
  import(
    /* webpackChunkName: "dashboard" */
    /* webpackPrefetch: true */
    '@/pages/Dashboard'
  )
);

/**
 * Image optimization
 */
export function OptimizedImage({
  src,
  alt,
  ...props
}: ImageProps) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <img
      ref={imgRef}
      src={isIntersecting ? src : undefined}
      alt={alt}
      loading="lazy"
      {...props}
    />
  );
}

/**
 * API request deduplication
 */
export const apiCache = new Map();

export async function cachedFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const key = `${url}:${JSON.stringify(options)}`;
  
  // Return cached promise if exists
  if (apiCache.has(key)) {
    return apiCache.get(key);
  }
  
  // Create new promise
  const promise = fetch(url, options)
    .then(response => {
      // Cache successful responses
      if (response.ok) {
        setTimeout(() => apiCache.delete(key), 5000);
      } else {
        apiCache.delete(key);
      }
      return response;
    })
    .catch(error => {
      apiCache.delete(key);
      throw error;
    });
  
  apiCache.set(key, promise);
  return promise;
}
```

### Security Best Practices

#### Authentication & Authorization

```typescript
// src/auth/security.ts
export class SecurityManager {
  /**
   * Secure password hashing
   */
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }
  
  /**
   * JWT with refresh tokens
   */
  async generateTokenPair(
    userId: string,
    role: string
  ): Promise<TokenPair> {
    const accessToken = await this.signJWT(
      { userId, role, type: 'access' },
      { expiresIn: '15m' }
    );
    
    const refreshToken = await this.signJWT(
      { userId, type: 'refresh' },
      { expiresIn: '7d' }
    );
    
    // Store refresh token hash
    await this.storeRefreshToken(userId, refreshToken);
    
    return { accessToken, refreshToken };
  }
  
  /**
   * Rate limiting with sliding window
   */
  async checkRateLimit(
    key: string,
    limit: number,
    window: number
  ): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - window;
    
    // Get recent requests
    const requests = await redis.zrangebyscore(
      `rate:${key}`,
      windowStart,
      now
    );
    
    if (requests.length >= limit) {
      return false;
    }
    
    // Add current request
    await redis.zadd(`rate:${key}`, now, `${now}:${crypto.randomUUID()}`);
    
    // Clean old entries
    await redis.zremrangebyscore(`rate:${key}`, 0, windowStart);
    
    // Set TTL
    await redis.expire(`rate:${key}`, Math.ceil(window / 1000));
    
    return true;
  }
  
  /**
   * Input sanitization
   */
  sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      // Remove potential XSS
      return DOMPurify.sanitize(input, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: []
      });
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }
    
    if (input && typeof input === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    
    return input;
  }
  
  /**
   * CORS configuration
   */
  setCORSHeaders(request: Request, response: Response): Response {
    const origin = request.headers.get('Origin');
    const allowedOrigins = [
      'https://pitchey-5o8.pages.dev',
      'http://localhost:5173'
    ];
    
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      response.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
    }
    
    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'"
    );
    
    return response;
  }
}
```

### Incident Response Procedures

#### Incident Command Structure

```typescript
// src/incident/incident-manager.ts
export class IncidentManager {
  private incidents: Map<string, Incident> = new Map();
  
  /**
   * Declare an incident
   */
  async declareIncident(
    severity: 'SEV-1' | 'SEV-2' | 'SEV-3' | 'SEV-4',
    title: string,
    description: string
  ): Promise<Incident> {
    const incident: Incident = {
      id: crypto.randomUUID(),
      severity,
      title,
      description,
      status: 'investigating',
      declaredAt: new Date(),
      commander: null,
      timeline: [],
      affectedServices: []
    };
    
    this.incidents.set(incident.id, incident);
    
    // Trigger notifications based on severity
    await this.notifyIncident(incident);
    
    // Create incident channel
    await this.createIncidentChannel(incident);
    
    // Start automated diagnostics
    await this.runDiagnostics(incident);
    
    return incident;
  }
  
  /**
   * Automated diagnostics
   */
  private async runDiagnostics(
    incident: Incident
  ): Promise<DiagnosticReport> {
    const report: DiagnosticReport = {
      timestamp: new Date(),
      health: await this.checkHealth(),
      metrics: await this.getMetrics(),
      recentErrors: await this.getRecentErrors(),
      recentDeployments: await this.getRecentDeployments()
    };
    
    // Add to incident timeline
    this.addTimelineEntry(incident.id, {
      timestamp: new Date(),
      action: 'diagnostics_completed',
      data: report
    });
    
    return report;
  }
  
  /**
   * Incident response automation
   */
  async executePlaybook(
    incidentId: string,
    playbook: string
  ): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error('Incident not found');
    
    switch (playbook) {
      case 'database_degradation':
        await this.handleDatabaseDegradation(incident);
        break;
        
      case 'high_error_rate':
        await this.handleHighErrorRate(incident);
        break;
        
      case 'ddos_attack':
        await this.handleDDoSAttack(incident);
        break;
        
      default:
        console.warn(`Unknown playbook: ${playbook}`);
    }
  }
  
  private async handleHighErrorRate(
    incident: Incident
  ): Promise<void> {
    // 1. Enable circuit breaker
    await this.enableCircuitBreaker();
    
    // 2. Increase logging
    await this.setLogLevel('debug');
    
    // 3. Check recent deployments
    const deployments = await this.getRecentDeployments();
    if (deployments.length > 0) {
      // Consider rollback
      this.addTimelineEntry(incident.id, {
        timestamp: new Date(),
        action: 'rollback_suggested',
        data: deployments[0]
      });
    }
    
    // 4. Scale up resources
    await this.scaleResources({ workers: 2 });
  }
}
```

### On-Call Responsibilities

#### On-Call Runbook

```markdown
# On-Call Engineer Responsibilities

## Daily Tasks (Start of Shift)

### 1. Health Check (5 minutes)
```bash
# Check system health
./scripts/health-monitor.sh status

# Review overnight alerts
./scripts/check-alerts.sh --since="8 hours ago"

# Check error rates
curl https://api.monitoring.com/errors?period=24h
```

### 2. Metrics Review (10 minutes)
- [ ] Check dashboard: https://dashboard.pitchey.com
- [ ] Review key metrics:
  - Error rate < 1%
  - P95 latency < 500ms
  - Database connections < 80%
  - Cache hit rate > 70%

### 3. Deployment Status (5 minutes)
- [ ] Check pending deployments
- [ ] Review deployment queue
- [ ] Verify staging environment

## Incident Response

### SEV-1 (Critical) Response
**Response Time: < 15 minutes**

1. **Acknowledge** (< 5 min)
   - Respond in #incidents channel
   - Take incident commander role

2. **Assess** (< 10 min)
   ```bash
   ./scripts/incident-response.sh assess
   ```

3. **Mitigate** (Immediate)
   - Execute relevant playbook
   - Consider emergency rollback
   - Enable maintenance mode if needed

4. **Communicate** (Every 30 min)
   - Update status page
   - Slack updates
   - Customer communications

### SEV-2 (Major) Response
**Response Time: < 30 minutes**

Similar to SEV-1 but with longer response windows

## Escalation Path

```mermaid
graph TD
    A[On-Call L1] -->|15 min| B[On-Call L2]
    B -->|30 min| C[Team Lead]
    C -->|45 min| D[Director]
    D -->|60 min| E[CTO]
```

## Emergency Contacts

- **PagerDuty**: +1-555-ONCALL
- **Cloudflare Support**: enterprise@cloudflare.com
- **Database Admin**: dba@pitchey.com
- **Security Team**: security@pitchey.com

## Common Commands

### Rollback Deployment
```bash
./scripts/rollback-deployment.sh production
```

### Emergency Cache Clear
```bash
./scripts/clear-cache.sh --all --force
```

### Database Connection Reset
```bash
./scripts/reset-db-connections.sh
```

### Enable Maintenance Mode
```bash
wrangler secret put MAINTENANCE_MODE true
```
```

---

## 🎓 Continuous Learning

### Weekly Learning Goals

- **Week 1**: Master the codebase structure
- **Week 2**: Understand the data model
- **Week 3**: Learn deployment pipeline
- **Week 4**: Shadow on-call rotation

### Recommended Resources

1. **Internal Documentation**
   - [API Documentation](./API_ENDPOINTS_DOCUMENTATION.md)
   - [Security Guidelines](./ENHANCED_SECURITY_IMPLEMENTATION.md)
   - [Architecture Decisions](./DEPLOYMENT_ARCHITECTURE.md)

2. **External Learning**
   - Cloudflare Workers documentation
   - PostgreSQL performance tuning
   - React performance patterns
   - WebSocket best practices

3. **Certifications to Consider**
   - AWS Certified Developer
   - Cloudflare Certified Developer
   - PostgreSQL Associate Certification

### Mentorship Program

Every new developer is paired with a senior engineer for:
- Daily standups (first week)
- Weekly 1-on-1s (first month)
- Code review buddying
- On-call shadowing

---

## 🚀 Your Growth Path

### 30-60-90 Day Plan

#### First 30 Days
- Complete onboarding checklist
- Ship 3+ small features
- Fix 5+ bugs
- Review 10+ PRs

#### First 60 Days
- Lead a feature development
- Participate in on-call rotation
- Present tech talk
- Contribute to documentation

#### First 90 Days
- Own a service area
- Mentor new team member
- Lead incident response
- Propose architecture improvement

---

## 📞 Getting Help

### Slack Channels
- `#dev-help` - Technical questions
- `#incidents` - Production issues
- `#random` - Team chat
- `#announcements` - Important updates

### Key People
- **Tech Lead**: @tech-lead
- **Platform Team**: @platform-team
- **DevOps**: @devops-team
- **Security**: @security-team

### Documentation
- **Wiki**: https://wiki.pitchey.internal
- **API Docs**: https://api-docs.pitchey.com
- **Runbooks**: https://runbooks.pitchey.com

---

## 🎉 Welcome to the Team!

You're now part of something special. The Pitchey platform is where dreams become reality, where creators find their voice, and where the next big entertainment properties are discovered.

**Your code matters. Your ideas matter. You matter.**

Let's build something amazing together! 🚀

---

*This guide is maintained by the Platform Engineering Team.*  
*Last updated: December 2024*  
*Questions? Reach out in #dev-help*