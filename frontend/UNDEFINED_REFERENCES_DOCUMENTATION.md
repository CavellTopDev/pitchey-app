# Undefined References Documentation

## Executive Summary
After analyzing the codebase and researching via Context7 MCP, the main undefined reference issues are related to React Router v6/v7's internal changes where they moved AWAY from `useSyncExternalStore`.

## Key Finding from React Router Documentation
**React Router v6.9.0+ no longer uses `useSyncExternalStore` internally** - they switched to `useState` to fix timing bugs. This means our shim for `useSyncExternalStore` may actually be causing issues rather than fixing them.

## Current Undefined References

### 1. `useSyncExternalStore` (PRIMARY ISSUE)
**Location**: React Router internals
**Error**: "Cannot read properties of undefined (reading 'useSyncExternalStore')"
**Root Cause**: 
- React Router v6.9.0+ REMOVED their dependency on `useSyncExternalStore`
- They switched to `useState` for internal router state syncing
- Our shim is trying to provide something React Router no longer needs

**SOLUTION**: 
- Remove the `useSyncExternalStore` shim from index.html
- Update React Router to latest v6 or v7 which doesn't need this hook
- Ensure React 18+ is properly loaded (which includes this hook natively)

### 2. `useLayoutEffect` (FIXED)
**Location**: React hooks
**Previous Error**: "Cannot read properties of undefined (reading 'useLayoutEffect')"
**Status**: FIXED in react-global.ts by explicitly including all React hooks

### 3. `jsxDEV` (FIXED)
**Location**: Production build
**Previous Error**: "c.jsxDEV is not a function"
**Status**: FIXED by removing jsxDEV from production and using proper JSX runtime

## React Router Version Compatibility

### Current Issue
We're providing a shim for `useSyncExternalStore` but React Router v6.9.0+ doesn't use it anymore. From the React Router changelog:

> "Switched from `useSyncExternalStore` to `useState` for internal `@remix-run/router` router state syncing in `<RouterProvider>`. We found some subtle bugs where router state updates got propagated _before_ other normal `useState` updates"

### Version Requirements
- React Router v7 requires: React 18+, Node 20+
- React Router v6.9.0+ no longer uses `useSyncExternalStore`
- Our current setup is trying to polyfill something that's not needed

## Recommended Actions

### 1. IMMEDIATE FIX
Remove the `useSyncExternalStore` shim from index.html since React Router doesn't use it anymore:

```html
<!-- DELETE ALL OF THIS from index.html -->
<script>
  // This MUST run before React Router or any other modules try to import use-sync-external-store
  (function() {
    if (typeof window !== 'undefined') {
      // Create a fallback useSyncExternalStore implementation
      var useSyncExternalStoreFallback = function(subscribe, getSnapshot) {
        // ... DELETE THIS ENTIRE SHIM ...
      };
      // ... DELETE ALL THE SHIM CODE ...
    }
  })();
</script>
```

### 2. UPDATE DEPENDENCIES
Check React Router version and update if needed:
```bash
npm list react-router-dom
# If version is < 6.9.0, update to latest:
npm update react-router-dom@latest
```

### 3. VERIFY REACT 18
Ensure React 18 is properly installed:
```bash
npm list react react-dom
# Should show 18.x.x for both
```

## Other Undefined Checks in Codebase

### Safe Undefined Checks (Working Correctly)
1. **Window object checks** in hooks/usePerformance.ts:98
   - `if (typeof window === 'undefined') return;`
   - This is correct for SSR compatibility

2. **Optional chaining** throughout services
   - Extensive use of `?.` operator for safe property access
   - All optional TypeScript properties with `?:` are handled correctly

3. **Default values** 
   - `import.meta.env.VITE_API_URL || 'https://pitchey-api-prod.ndlovucavelle.workers.dev'`
   - Proper fallback patterns used throughout

## Conclusion

The main issue is we're trying to fix a problem that no longer exists. React Router moved away from `useSyncExternalStore` in v6.9.0+, so our shim is unnecessary and potentially harmful. The solution is to:

1. Remove the shim
2. Ensure we're on React Router v6.9.0+ or v7
3. Ensure React 18 is properly loaded

The codebase otherwise has good undefined handling with optional chaining, default values, and proper type guards.