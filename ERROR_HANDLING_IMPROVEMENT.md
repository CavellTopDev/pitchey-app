# Error Handling Improvement: Circular Reference Fix

## Problem
The application was experiencing "Maximum call stack size exceeded" errors in production when Drizzle ORM database queries failed. These errors occurred because:

1. Drizzle error objects contain circular references
2. When `console.error()` was called with these objects, JavaScript tried to serialize them
3. The circular references caused infinite recursion during serialization
4. This resulted in stack overflow errors that crashed the error logging itself

## Solution
Created a comprehensive error serialization utility (`src/utils/error-serializer.ts`) that:

### Features
1. **Circular Reference Safe**: Extracts error information without traversing circular references
2. **Database Error Aware**: Specifically handles PostgreSQL/Drizzle error properties
3. **Type Detection**: Identifies error types (standard, database, drizzle, unknown)
4. **Stack Trace Limiting**: Limits stack traces to prevent excessive logging
5. **Cause Chain Handling**: Safely processes nested error causes

### API Functions
- `serializeError(error)` - Safely extracts error information
- `logError(error, context, additionalData)` - Safe logging with context
- `getErrorMessage(error)` - Quick access to error message
- `errorToResponse(error, fallbackMessage)` - API-safe error response format

### Updated Endpoints
Fixed error handling in critical production endpoints:
- `/api/notifications/unread` (line ~5810)
- `/api/portfolio/summary` (line ~2710)
- Login endpoints (line ~310)
- Investment interests endpoints (line ~3276)
- Session validation (line ~171)
- Cache operations (lines ~438, ~452)
- Main worker error handler (line ~8760)

## Usage Example
```typescript
// Before (problematic)
} catch (error) {
  console.error('Database error:', error); // Can cause stack overflow
  return { success: false, message: error.message };
}

// After (safe)
} catch (error) {
  logError(error, 'Database operation failed');
  return {
    success: false,
    message: getErrorMessage(error),
    error: errorToResponse(error)
  };
}
```

## Benefits
1. **Production Stability**: Eliminates crash-causing circular reference errors
2. **Better Debugging**: Preserves important error details (SQL state, error codes)
3. **Consistent Logging**: Standardized error handling across the codebase
4. **API Safety**: Clean error responses without circular references
5. **Environment Aware**: Includes technical details only in development

## Testing
The utility was tested with various error types including:
- Standard JavaScript errors
- Mock Drizzle errors with circular references
- Non-object error values (strings, numbers, null)
- Nested error causes

All tests passed without stack overflow errors while preserving essential debugging information.