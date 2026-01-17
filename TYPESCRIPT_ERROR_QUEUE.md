# TypeScript Error Queue - Implementation Required

**Total Errors:** 958
**Build Status:** ✅ Succeeds (esbuild doesn't type-check)
**Generated:** 2026-01-17

---

## Error Summary by Type

| Error Code | Count | Description | Fix Pattern |
|------------|-------|-------------|-------------|
| **TS2339** | 291 | Property does not exist on type | Add type assertions or interfaces |
| **TS7006** | 88 | Parameter implicitly has 'any' type | Add type annotations |
| **TS18046** | 75 | Variable is of type 'unknown' | Add type assertions after JSON parse |
| **TS2345** | 71 | Argument type mismatch | Fix function signatures or use type casting |
| **TS2484** | 58 | Export declaration conflicts | Remove duplicate exports |
| **TS2304** | 50 | Cannot find name | Import missing types (Env, Deno, etc.) |
| **TS7034/7005** | 34 | Variable implicitly has 'any' type | Add explicit type declarations |
| **TS7053** | 15 | Element implicitly has 'any' type | Add index signatures |
| **TS2322** | 15 | Type not assignable | Fix type mismatches |
| **TS1270/1241** | 26 | Decorator issues | Fix decorator function signatures |
| **TS7031** | 12 | Binding element implicitly has 'any' | Type destructured parameters |
| **TS5097** | 10 | Import path cannot end with '.ts' | Remove .ts extension from imports |
| **TS2323** | 10 | Cannot redeclare exported variable | Remove duplicate exports |

---

## Files Requiring Fixes (Priority Order)

### Tier 1: High-Impact Services (250+ errors)

#### 1. `src/services/messaging.service.ts` (79 errors)
**Issues:**
- Export declaration conflicts (TS2484)
- Property access on unknown types
- Missing type annotations

**Fix Pattern:**
```typescript
// Remove duplicate exports at end of file
// Change: export { MessagingService, WebSocketMessage, ... }
// To: (just keep inline exports)

// Add type assertions for request bodies
const data = await request.json() as MessageInput;
```

#### 2. `src/handlers/pitch-validation.ts` (72 errors)
**Issues:**
- `unknown` type from `request.json()`
- Error handling with `unknown` type
- Implicit any on callback parameters

**Fix Pattern:**
```typescript
// Add interface for request body
interface PitchUpdateData {
  title?: string;
  logline?: string;
  synopsis?: string;
  genre?: string;
  format?: string;
  budget?: number;
  status?: string;
  tags?: string[];
  attachments?: string[];
}

const updateData = await request.json() as PitchUpdateData;

// Fix error handling
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
}

// Fix callback types
.map((result: ValidationResult) => result.score)
```

#### 3. `src/handlers/secure-portal-endpoints.ts` (63 errors)
**Issues:**
- Export declaration conflicts
- Property access on unknown types

#### 4. `src/handlers/production-dashboard.ts` (60 errors)
**Issues:**
- Unknown types from JSON parsing
- Missing property definitions

#### 5. `src/services/notification.service.ts` (53 errors)
**Issues:**
- Missing `eq` import from drizzle-orm
- Export declaration conflicts
- Property access issues

**Fix Pattern:**
```typescript
// Add missing import
import { eq } from 'drizzle-orm';

// OR if not using drizzle, replace with raw SQL comparison
```

---

### Tier 2: Database Layer (100+ errors)

#### 6. `src/db/schema/messaging.schema.ts` (25 errors)
**Issues:**
- Parameter `table` implicitly has 'any' type (TS7006)
- Drizzle ORM type definitions

**Fix Pattern:**
```typescript
// Add type to relations callbacks
import { PgTable } from 'drizzle-orm/pg-core';

export const messagesRelations = relations(messages, (helpers: { one: Function, many: Function }) => ({
  // ...
}));
```

#### 7. `src/db/queries/*.ts` (30+ errors total)
**Issues:**
- String not assignable to TemplateStringsArray (TS2345)
- Using string concatenation with Neon SQL

**Fix Pattern:**
```typescript
// WRONG - string concatenation
const query = `SELECT * FROM users WHERE id = ${id}`;
sql(query);  // Error!

// CORRECT - tagged template literal
sql`SELECT * FROM users WHERE id = ${id}`;

// OR - if dynamic query is needed
const result = await sql.unsafe(query);
```

#### 8. `src/db/optimized-connection.ts` (16 errors)
**Issues:**
- NeonQueryFunction type mismatch
- Property 'length' on union type

---

### Tier 3: Handler Files (150+ errors)

#### 9. `src/handlers/auth-password.ts` (26 errors)
**Issues:**
- `ApiResponseBuilder.error` doesn't exist (should be static methods)
- Property access on unknown request body
- `.rows` access on query results

**Fix Pattern:**
```typescript
// Add type assertion for request body
interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
}
const body = await request.json() as PasswordChangeRequest;

// Use correct ApiResponseBuilder methods
return ApiResponseBuilder.badRequest('Invalid password');
// NOT: ApiResponseBuilder.error(...)
```

#### 10. `src/handlers/legal-document-automation.ts` (32 errors)
**Issues:**
- Missing `htmlContent` variable declaration
- Unknown type access

#### 11. `src/handlers/notification-routes.ts` (28 errors)
**Issues:**
- Property access on unknown types
- Missing type assertions

#### 12. `src/handlers/settings.ts` (26 errors)
**Issues:**
- Unknown type from JSON parsing
- Missing interfaces

#### 13. `src/handlers/creator-dashboard.ts` (16 errors)
**Issues:**
- Parameter 'n' implicitly has 'any' type
- Array callbacks need types

**Fix Pattern:**
```typescript
// Fix array callbacks
notifications.map((n: Notification) => n.id)
```

#### 14. `src/handlers/nda.ts` (9 errors)
**Issues:**
- Missing `corsHeaders` import

**Fix:**
```typescript
import { corsHeaders } from '../utils/response';
```

#### 15. `src/handlers/teams.ts` (8 errors)
**Issues:**
- Parameter 'team' implicitly has 'any' type
- Parameter 'sql' implicitly has 'any' type

#### 16. `src/handlers/ab-testing-websocket.ts` (7 errors)
**Issues:**
- `.rows` property doesn't exist on DatabaseRow[]
- Parameter 'row' implicitly has 'any'

**Fix Pattern:**
```typescript
// WorkerDatabase.query() returns DatabaseRow[] directly, not { rows: [] }
const result = await this.db.query(...);
// Use result directly, not result.rows
```

---

### Tier 4: Service Layer (100+ errors)

#### 17. `src/services/pitch-validation.service.ts` (35 errors)
**Issues:**
- Unknown types
- Missing interfaces

#### 18. `src/services/polling-service.ts` (20 errors)

#### 19. `src/services/push-notification.service.ts` (16 errors)

#### 20. `src/services/worker-realtime.service.ts` (12 errors)

#### 21. `src/services/container-orchestrator.ts` (9 errors)
**Issues:**
- Cannot find name 'Env'

**Fix:**
```typescript
import type { Env } from '../worker-integrated';
```

---

### Tier 5: Config & Types (60+ errors)

#### 22. `src/config/hyperdrive-config.ts` (2 errors)
**Issues:**
- Cannot find name 'Env'

#### 23. `src/types/pitch-validation.types.ts` (37 errors)
**Issues:**
- Export declaration conflicts (duplicate exports)

**Fix:**
```typescript
// Remove the redundant export statement at end of file
// Keep only the inline exports
```

---

### Tier 6: Workflows (40+ errors)

#### 24. `src/workflows/creator-production-workflow.ts` (15 errors)
- Export conflicts
- Implicit any parameters

#### 25. `src/workflows/creator-investor-workflow.ts` (15 errors)
- Same issues

#### 26. `src/workflows/nda-state-machine.ts` (9 errors)
- Export conflicts
- Implicit any parameters

---

### Tier 7: Auth Layer (10 errors)

#### 27. `src/auth/better-auth-neon-raw-sql.ts` (4 errors)
**Issues:**
- Property access on unknown type
- NeonQueryFunction type mismatch

**Fix Pattern:**
```typescript
// Add interface for credentials
interface Credentials {
  email: string;
  password: string;
}
const creds = body as Credentials;
```

---

## Common Fix Patterns

### Pattern 1: JSON Body Type Assertion
```typescript
// Before (causes TS18046)
const data = await request.json();
data.userId; // Error!

// After
interface RequestBody {
  userId: string;
  action: string;
}
const data = await request.json() as RequestBody;
```

### Pattern 2: Error Handling
```typescript
// Before (causes TS18046)
catch (error) {
  console.log(error.message); // Error!
}

// After
catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.log(message);
}
```

### Pattern 3: Callback Type Annotations
```typescript
// Before (causes TS7006)
items.map((item) => item.id);

// After
items.map((item: ItemType) => item.id);
```

### Pattern 4: Neon SQL Tagged Templates
```typescript
// Before (causes TS2345)
const query = `SELECT * FROM ${table}`;
sql(query);

// After - Use tagged template
sql`SELECT * FROM users WHERE id = ${id}`;

// After - For dynamic queries
sql.unsafe(`SELECT * FROM ${table}`);
```

### Pattern 5: Remove Duplicate Exports
```typescript
// Before (causes TS2484)
export class MyService { ... }
// ... end of file
export { MyService, Type1, Type2 };

// After - Remove redundant export
export class MyService { ... }
// (remove the export {} statement)
```

### Pattern 6: Import Missing Types
```typescript
// For Env type in services/handlers
import type { Env } from '../worker-integrated';

// For corsHeaders
import { corsHeaders } from '../utils/response';

// For eq (drizzle)
import { eq } from 'drizzle-orm';
```

---

## Implementation Order

### Phase 1: Quick Wins (1-2 hours)
1. Remove duplicate export statements in all files with TS2484 errors
2. Add `import type { Env }` to all files with TS2304 "Cannot find name 'Env'"
3. Add `import { corsHeaders }` to files missing it
4. Fix all `.ts` import extensions (TS5097)

**Expected reduction: ~120 errors**

### Phase 2: Request Body Types (2-3 hours)
1. Create interface definitions for all request bodies
2. Add type assertions after `request.json()`
3. Fix error handling with instanceof checks

**Expected reduction: ~180 errors**

### Phase 3: Callback Annotations (1-2 hours)
1. Add type annotations to all array callbacks
2. Fix implicit any parameters in functions

**Expected reduction: ~100 errors**

### Phase 4: Database Query Fixes (2-3 hours)
1. Convert string concatenation to tagged templates
2. Fix WorkerDatabase result handling
3. Add proper types to drizzle callbacks

**Expected reduction: ~100 errors**

### Phase 5: Service Layer Cleanup (3-4 hours)
1. Fix all property access issues
2. Add missing interfaces
3. Fix type mismatches

**Expected reduction: ~200 errors**

---

## Files to Start With

Priority order for maximum impact:

1. `src/utils/response.ts` - Add corsHeaders export if missing
2. `src/types/pitch-validation.types.ts` - Remove duplicate exports
3. `src/services/messaging.service.ts` - Remove duplicate exports
4. `src/services/notification.service.ts` - Remove duplicate exports
5. `src/handlers/auth-password.ts` - Add type assertions
6. `src/handlers/pitch-validation.ts` - Add type assertions
7. `src/db/queries/*.ts` - Fix SQL template usage

---

## Verification

After each phase:
```bash
# Count remaining errors
npx tsc --noEmit 2>&1 | wc -l

# Verify build still works
npm run build:worker

# Check specific error types
npx tsc --noEmit 2>&1 | grep -oE "TS[0-9]+" | sort | uniq -c | sort -rn
```
