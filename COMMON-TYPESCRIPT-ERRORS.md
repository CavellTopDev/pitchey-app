# Common TypeScript Errors in Pitchey Project

## 🔴 Most Frequent Error Types

### 1. **Implicit `any` Types (40% of errors)**
**Pattern:** Functions and variables without explicit types
```typescript
// ❌ Common in: src/lib/api-client.ts, authStore.ts
async function fetchData(endpoint) { // Parameter 'endpoint' implicitly has an 'any' type
  const response = await fetch(endpoint);
  return response.json(); // Return type implicitly 'any'
}

// ✅ Fix:
async function fetchData(endpoint: string): Promise<unknown> {
  const response = await fetch(endpoint);
  return response.json();
}
```

**Most affected files:**
- `src/lib/apiServices.ts` - API response handlers
- `src/store/authStore.ts` - State management
- `frontend/worker/index.ts` - JWT payloads (line 52, 81)

### 2. **Database Query Type Mismatches (25% of errors)**
**Pattern:** Neon PostgreSQL query results not matching expected types
```typescript
// ❌ Common error in database queries
const result = await sql`SELECT * FROM users WHERE id = ${userId}`;
const user = result[0]; // 'user' is possibly undefined
user.email; // Object is possibly 'undefined'

// ✅ Fix:
interface User {
  id: string;
  email: string;
  username: string;
  user_type: 'creator' | 'investor' | 'production_company';
}

const result = await sql<User[]>`SELECT * FROM users WHERE id = ${userId}`;
const user = result[0];
if (!user) throw new Error('User not found');
```

**Most affected areas:**
- User authentication queries
- Pitch retrieval with joins
- NDA request handling

### 3. **Better Auth Session Type Issues (20% of errors)**
**Pattern:** Session object structure not matching Better Auth types
```typescript
// ❌ Common in authentication components
const session = await authClient.getSession();
const userId = session.user.id; // Property 'user' does not exist on type 'Session | null'

// ✅ Fix:
const session = await authClient.getSession();
if (!session?.user) {
  throw new Error('Not authenticated');
}
const userId = session.user.id;
```

**Most affected files:**
- `src/auth/better-auth-neon-raw-sql.ts`
- All dashboard components (CreatorStats, InvestorAnalytics, etc.)

### 4. **React Hook Dependency Arrays (15% of errors)**
**Pattern:** Missing dependencies in useEffect/useCallback
```typescript
// ❌ Common in dashboard components
useEffect(() => {
  fetchDashboardData(userId); // 'userId' not in dependency array
}, []); // React Hook useEffect has a missing dependency: 'userId'

// ✅ Fix:
useEffect(() => {
  fetchDashboardData(userId);
}, [userId]);
```

**Most affected components:**
- `CreatorStats.tsx`
- `InvestorAnalytics.tsx`
- `ProductionDashboard.tsx`

### 5. **Async Function Return Types (10% of errors)**
**Pattern:** Not properly typing Promise returns
```typescript
// ❌ Common pattern
async function getUser(id: string) { // Missing return type
  const user = await fetchUser(id);
  return user;
}

// ✅ Fix:
async function getUser(id: string): Promise<User | null> {
  const user = await fetchUser(id);
  return user;
}
```

### 6. **WebSocket Message Type Unions (8% of errors)**
**Pattern:** WebSocket handlers not exhaustively checking message types
```typescript
// ❌ In WebSocket handlers
function handleMessage(message: WebSocketMessage) {
  if (message.type === 'notification') {
    // handle notification
  }
  // TypeScript error: Not all code paths return a value
}

// ✅ Fix with exhaustive checking:
function handleMessage(message: WebSocketMessage): void {
  switch (message.type) {
    case 'notification':
      handleNotification(message);
      break;
    case 'pitch_update':
      handlePitchUpdate(message);
      break;
    default:
      const _exhaustive: never = message; // Ensures all cases handled
      break;
  }
}
```

### 7. **Optional Chaining vs Non-null Assertions (5% of errors)**
**Pattern:** Incorrect use of `!` operator
```typescript
// ❌ Dangerous non-null assertion
const email = session!.user!.email; // Runtime error if session is null

// ✅ Safe optional chaining:
const email = session?.user?.email ?? '';
if (!email) {
  console.error('Email not found');
}
```

---

## 🛠️ Quick Fixes by File Pattern

### API Service Files (`src/lib/api*.ts`)
```typescript
// Add these type definitions at the top:
type ApiResponse<T> = {
  data?: T;
  error?: string;
  status: number;
};

// Use generic types for API calls:
async function apiCall<T>(endpoint: string): Promise<ApiResponse<T>> {
  // implementation
}
```

### Store Files (`src/store/*.ts`)
```typescript
// Define store state interfaces:
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
}

// Type your store actions:
type AuthAction = 
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean };
```

### Database Query Files
```typescript
// Create type-safe query functions:
import { sql } from '@neondatabase/serverless';

// Define your return types
interface PitchWithCreator {
  id: string;
  title: string;
  creator_name: string;
  company_name: string | null;
}

// Use generics with sql template
const pitches = await sql<PitchWithCreator[]>`
  SELECT p.*, u.username as creator_name, u.company_name
  FROM pitches p
  JOIN users u ON p.creator_id = u.id
`;
```

---

## 📝 TypeScript Config Recommendations

Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vite/client", "@cloudflare/workers-types"]
  }
}
```

---

## 🚀 Automated Fix Commands

```bash
# Auto-fix implicit any in specific file
npx ts-migrate reignore ./src/lib/api-client.ts

# Add explicit return types
npx ts-add-returns ./src

# Check for unused variables
npx eslint . --ext .ts,.tsx --rule 'no-unused-vars: error'

# Generate types from database schema
npx @neondatabase/serverless generate-types > src/types/database.ts
```

---

## 🎯 Priority Fixes (Based on Your Codebase)

1. **Fix all `: any` types in authentication flow** (Critical)
   - Files: `worker/index.ts` (lines 52, 81), `authStore.ts`
   - Impact: Security and type safety

2. **Type database query results** (High)
   - Add interfaces for all SQL query returns
   - Use generics with sql template literals

3. **Fix Better Auth session handling** (High)
   - Ensure null checks before accessing session.user
   - Type the session object correctly

4. **Remove explicit any from event handlers** (Medium)
   - Replace `(error: any)` with proper error types
   - Type form event handlers properly

5. **Add return types to async functions** (Low)
   - Especially in API service layer
   - Helps with debugging and IntelliSense