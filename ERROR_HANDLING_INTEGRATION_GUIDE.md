# Error Handling Integration Guide

This guide shows how to integrate the enhanced error handling system into your existing `working-server.ts` file for better user experience and edge case handling.

## Overview of Improvements

The new error handling system addresses the following edge cases identified in testing:

1. **Invalid JSON Response** - Proper JSON parsing with detailed error messages
2. **Missing Parameter Validation** - Comprehensive input validation with field-specific errors
3. **Database Constraint Violations** - User-friendly database error messages
4. **Authentication Edge Cases** - Helpful authentication error guidance
5. **Centralized Error Handling** - Consistent error responses across all endpoints

## Files Created

### Core Middleware Files

1. `/src/middleware/json-validation.middleware.ts` - JSON parsing and validation
2. `/src/utils/database-error-handler.ts` - Database error conversion
3. `/src/utils/auth-error-handler.ts` - Authentication error handling
4. `/src/middleware/error-handling.middleware.ts` - Centralized error handling
5. `/src/examples/improved-endpoints.ts` - Example implementations

## Integration Steps

### Step 1: Add Imports to working-server.ts

Add these imports at the top of your `working-server.ts` file:

```typescript
// Enhanced error handling imports
import { createEndpointHandler, withDatabaseErrorHandling } from "./src/middleware/error-handling.middleware.ts";
import { ValidationSchemas } from "./src/middleware/json-validation.middleware.ts";
import { globalAuthRateLimiter } from "./src/utils/auth-error-handler.ts";
import { handleDatabaseError } from "./src/utils/database-error-handler.ts";
```

### Step 2: Update Authentication Endpoints

Replace your existing login endpoints with enhanced versions:

#### Before (lines ~838-899):
```typescript
if (url.pathname === "/api/auth/login" && method === "POST") {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return validationErrorResponse("Email and password are required");
    }
    // ... rest of login logic
  } catch (error) {
    return serverErrorResponse("Login failed");
  }
}
```

#### After:
```typescript
if (url.pathname === "/api/auth/login" && method === "POST") {
  return await createEndpointHandler(
    async (request, body, context) => {
      const { email, password } = body!;
      const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
      
      // Rate limiting
      const rateLimitResult = globalAuthRateLimiter.recordAttempt(clientIP);
      if (!rateLimitResult.allowed) {
        throw new Error(rateLimitResult.error!.message);
      }
      
      // Your existing demo account logic
      const demoAccount = Object.values(demoAccounts).find(acc => acc.email === email);
      if (demoAccount && password === demoAccount.password) {
        globalAuthRateLimiter.recordSuccess(clientIP);
        
        // Your existing JWT creation logic
        const token = await create(/* ... your JWT logic ... */);
        
        return successResponse({
          success: true,
          token,
          user: demoAccount,
          message: "Login successful"
        });
      }
      
      // Invalid credentials - this will be handled by auth error handler
      throw new Error('Invalid email or password');
    },
    {
      requireJson: true,
      validationSchema: ValidationSchemas.login
    }
  )(request);
}
```

### Step 3: Update Registration Endpoints

#### Before (lines ~1015-1044):
```typescript
if (url.pathname === "/api/auth/register" && method === "POST") {
  try {
    const body = await request.json();
    const { email, password, username, userType, companyName } = body;

    if (!email || !password || !username || !userType) {
      return validationErrorResponse("Missing required fields");
    }

    const result = await UserService.createUser({
      email, password, username, userType, companyName
    });

    if (result.success) {
      return successResponse({
        user: result.user,
        message: "Registration successful"
      });
    }

    return errorResponse(result.error || "Registration failed", 400);
  } catch (error) {
    return serverErrorResponse("Registration failed");
  }
}
```

#### After:
```typescript
if (url.pathname === "/api/auth/register" && method === "POST") {
  return await createEndpointHandler(
    async (request, body, context) => {
      const { email, password, username, userType, companyName } = body!;
      
      const result = await withDatabaseErrorHandling(async () => {
        return await UserService.createUser({
          email, password, username, userType, companyName
        });
      }, context);
      
      if (result.success) {
        return createdResponse({
          user: result.user,
          message: "Registration successful"
        });
      }
      
      // This will be handled by database error handler if it's a constraint violation
      throw new Error(result.error || "Registration failed");
    },
    {
      requireJson: true,
      validationSchema: ValidationSchemas.register
    }
  )(request);
}
```

### Step 4: Update Database Operations

Wrap all database operations with error handling:

#### Before:
```typescript
const pitches = await db.select().from(pitchesTable).where(eq(pitchesTable.creatorId, userId));
```

#### After:
```typescript
const pitches = await withDatabaseErrorHandling(async () => {
  return await db.select().from(pitchesTable).where(eq(pitchesTable.creatorId, userId));
}, context);
```

### Step 5: Update Critical Endpoints

Apply the enhanced error handling to these critical endpoints:

1. **Pitch Creation** (`/api/pitches` POST)
2. **Message Sending** (`/api/messages` POST)  
3. **User Profile Updates** (`/api/users/:id` PUT)
4. **NDA Operations** (`/api/ndas` POST)
5. **File Uploads** (`/api/upload` POST)

Example for pitch creation:

```typescript
if (url.pathname === "/api/pitches" && method === "POST") {
  return await createEndpointHandler(
    async (request, body, context) => {
      const { title, description, budget, genre } = body!;
      const userId = context?.userId;
      
      const result = await withDatabaseErrorHandling(async () => {
        // Your existing pitch creation logic
        return await PitchService.createPitch({
          title, description, budget, genre, creatorId: userId
        });
      }, context);
      
      return createdResponse(result);
    },
    {
      requireAuth: true,
      requireJson: true,
      userType: 'creator',
      validationSchema: ValidationSchemas.createPitch
    }
  )(request);
}
```

## Error Response Examples

### Before (Generic Errors):
```json
{
  "success": false,
  "error": "Registration failed"
}
```

### After (Detailed Errors):
```json
{
  "success": false,
  "error": "An account with this email address already exists",
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "details": {
      "code": "CONFLICT",
      "field": "email",
      "details": "Please use a different email address or try logging in"
    }
  }
}
```

## Testing the Improvements

### 1. Test JSON Validation
```bash
# Invalid JSON
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "invalid json"

# Expected Response:
# {
#   "success": false,
#   "error": "Invalid JSON syntax: unexpected character found",
#   "metadata": { "timestamp": "..." }
# }
```

### 2. Test Parameter Validation
```bash
# Missing required fields
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Expected Response:
# {
#   "success": false,
#   "error": "Field 'password' is required",
#   "metadata": { "timestamp": "..." }
# }
```

### 3. Test Database Constraints
```bash
# Duplicate email registration
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "existing@example.com", "password": "Password123", "username": "test", "userType": "creator"}'

# Expected Response:
# {
#   "success": false,
#   "error": "An account with this email address already exists",
#   "metadata": {
#     "timestamp": "...",
#     "details": {
#       "code": "CONFLICT",
#       "field": "email",
#       "details": "Please use a different email address or try logging in"
#     }
#   }
# }
```

### 4. Test Authentication Errors
```bash
# Invalid token format
curl -X GET http://localhost:8000/api/pitches \
  -H "Authorization: InvalidToken"

# Expected Response:
# {
#   "success": false,
#   "error": "Invalid authentication token format",
#   "metadata": {
#     "timestamp": "...",
#     "details": {
#       "code": "INVALID_TOKEN_FORMAT",
#       "details": "Please log in again to get a fresh authentication token"
#     }
#   }
# }
```

## Migration Strategy

### Phase 1: Critical Endpoints (High Impact)
1. Authentication endpoints (`/api/auth/*`)
2. User registration endpoints
3. Pitch creation/editing endpoints

### Phase 2: User-Facing Endpoints (Medium Impact)  
1. Message endpoints (`/api/messages/*`)
2. Profile endpoints (`/api/users/*`)
3. NDA endpoints (`/api/ndas/*`)

### Phase 3: Administrative Endpoints (Low Impact)
1. Analytics endpoints
2. Admin dashboard endpoints  
3. System health endpoints

## Benefits

After integration, users will experience:

1. **Clear Error Messages**: Instead of generic "Registration failed", users get "An account with this email address already exists"
2. **Field-Specific Validation**: Errors point to exactly which field has the problem
3. **Helpful Guidance**: Each error includes suggested actions
4. **Consistent Responses**: All endpoints use the same error response format
5. **Better Security**: Rate limiting and secure error messages that don't expose internal details

## Backward Compatibility

This implementation is designed to be non-breaking:
- Existing successful responses remain unchanged
- Error responses are enhanced but maintain the `success: false` structure
- All existing functionality is preserved
- New features are additive only

## Monitoring

The enhanced error handling includes:
- Request ID tracking for debugging
- Sentry integration for error reporting
- Detailed logging without exposing sensitive data
- Performance monitoring for error rates

## Support

If you encounter issues during integration:
1. Check the console for detailed error logs with request IDs
2. Review the example implementations in `/src/examples/improved-endpoints.ts`
3. Test individual components using the provided test cases
4. Monitor Sentry dashboard for any unexpected errors