# Pitchey White Screen Error - Debugging & Resolution Guide

## 🚨 Current Error Identified

**Error:** `Cannot read properties of undefined (reading 'useLayoutEffect')`
**Location:** Browser console on production site (https://pitchey-5o8-66n.pages.dev/)
**Impact:** Complete white screen - React fails to render

---

## Root Cause Analysis

The error occurs because React hooks (specifically `useLayoutEffect`) are undefined when a component tries to use them. This is a React initialization/bundling issue where:

1. **Chunk Loading Order**: Some vendor chunks are loading before React is fully initialized
2. **Module System Conflict**: The production build has conflicts between ESM and CommonJS modules
3. **Missing Hook Export**: `useLayoutEffect` is not properly exposed in the global React object

---

## Immediate Fix

### Option 1: Enhanced React Global Setup (Quick Fix)

Update `/frontend/src/react-global.ts` to explicitly include `useLayoutEffect`:

```typescript
// Add this to the ReactWithHooks object (line 37-44)
const ReactWithHooks = Object.assign({}, React, {
  // Existing hooks...
  useLayoutEffect: React.useLayoutEffect, // ADD THIS LINE
  useEffect: React.useEffect,            // ADD THIS LINE
  useState: React.useState,               // ADD THIS LINE
  useCallback: React.useCallback,         // ADD THIS LINE
  useMemo: React.useMemo,                // ADD THIS LINE
  useRef: React.useRef,                  // ADD THIS LINE
  useContext: React.useContext,          // ADD THIS LINE
  useReducer: React.useReducer,          // ADD THIS LINE
  // ... rest of existing hooks
});
```

### Option 2: Fix Vite Build Configuration

Update `/frontend/vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Force React to be in its own chunk that loads first
        manualChunks: {
          'react-core': ['react', 'react-dom', 'react-dom/client'],
          'vendor-misc': [/* other vendors */]
        },
        // Ensure proper chunk loading order
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'react-core') {
            return 'chunks/[name]-[hash].js'; // Load first
          }
          return 'chunks/[name]-[hash].js';
        }
      }
    },
    // Ensure React is treated as external in dev but bundled in prod
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/node_modules/]
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client']
  }
});
```

---

## Setting Up Sentry for White Screen Monitoring

### 1. Enable Sentry with Proper Error Boundaries

Create `/frontend/src/components/ErrorBoundary.tsx`:

```typescript
import React from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    
    // Send to Sentry with context
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack
        }
      },
      tags: {
        error_boundary: true,
        error_type: 'white_screen'
      }
    });
  }

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback } = this.props;
      
      if (Fallback) {
        return <Fallback 
          error={this.state.error!} 
          resetError={() => this.setState({ hasError: false, error: null })}
        />;
      }
      
      // Default fallback
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
          <h1>Application Error</h1>
          <p>Something went wrong. Please refresh the page.</p>
          <details style={{ marginTop: '20px' }}>
            <summary>Error Details</summary>
            <pre>{this.state.error?.stack}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default Sentry.withProfiler(ErrorBoundary);
```

### 2. Initialize Sentry Properly

Update `/frontend/src/main.tsx`:

```typescript
import * as Sentry from "@sentry/react";

// Initialize Sentry BEFORE React
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536",
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      // Capture replays on errors
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0, // Always capture on error
  
  beforeSend(event, hint) {
    // Tag white screen errors
    if (event.exception?.values?.[0]?.value?.includes('useLayoutEffect')) {
      event.tags = { ...event.tags, white_screen: true, react_init_error: true };
      event.fingerprint = ['white-screen-react-init'];
    }
    return event;
  }
});

// Then wrap your app
const AppWithErrorBoundary = (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {AppWithErrorBoundary}
  </StrictMode>
);
```

### 3. Add White Screen Detection

Create `/frontend/src/utils/whiteScreenDetector.ts`:

```typescript
export function detectWhiteScreen() {
  // Check if React failed to mount after 5 seconds
  setTimeout(() => {
    const root = document.getElementById('root');
    const hasContent = root && root.children.length > 0;
    const hasReactRoot = root?.querySelector('[data-reactroot]') || 
                         root?.querySelector('._app') ||
                         root?.firstElementChild;
    
    if (!hasContent || !hasReactRoot) {
      // White screen detected
      const error = new Error('White screen detected - React failed to mount');
      
      // Log locally
      console.error('WHITE SCREEN DETECTED', {
        hasRoot: !!root,
        hasContent,
        hasReactRoot: !!hasReactRoot,
        childCount: root?.children.length || 0
      });
      
      // Send to Sentry
      if (window.Sentry) {
        window.Sentry.captureException(error, {
          tags: {
            white_screen: true,
            detection_method: 'timeout'
          },
          extra: {
            root_exists: !!root,
            has_content: hasContent,
            child_count: root?.children.length || 0
          }
        });
      }
      
      // Show fallback UI
      if (root) {
        root.innerHTML = `
          <div style="padding: 40px; font-family: system-ui; text-align: center;">
            <h1>Loading Error</h1>
            <p>The application failed to load properly.</p>
            <button onclick="location.reload()" 
                    style="padding: 10px 20px; margin-top: 20px; cursor: pointer;">
              Reload Page
            </button>
          </div>
        `;
      }
    }
  }, 5000);
}

// Call in main.tsx
detectWhiteScreen();
```

---

## Debugging Steps

### 1. Local Testing

```bash
# Build production bundle locally
cd frontend
npm run build

# Serve locally to test
npx serve -s dist -l 3000

# Check browser console for errors
```

### 2. Check Build Output

```bash
# Analyze bundle
npm run build -- --analyze

# Look for:
# - React being split into multiple chunks
# - Circular dependencies
# - Missing exports
```

### 3. Verify React Initialization

Add debug logging to `/frontend/src/react-global.ts`:

```typescript
console.log('React Init Check:', {
  React: typeof React,
  useLayoutEffect: typeof React?.useLayoutEffect,
  useState: typeof React?.useState,
  hooks: Object.keys(React || {}).filter(k => k.startsWith('use'))
});
```

---

## Prevention Checklist

- [ ] React is imported first in main.tsx
- [ ] All hooks are explicitly exported in react-global.ts
- [ ] Vite config forces React into a single early-loading chunk
- [ ] Error boundary wraps the entire app
- [ ] Sentry captures initialization errors
- [ ] White screen detector runs on page load
- [ ] Build process validates React availability

---

## Monitoring Dashboard

### Sentry Queries for White Screen Errors

1. **Find all white screen errors:**
   ```
   tags:white_screen OR error.value:"useLayoutEffect"
   ```

2. **React initialization errors:**
   ```
   tags:react_init_error OR fingerprint:white-screen-react-init
   ```

3. **Create alert for white screen:**
   - Condition: `tags:white_screen` 
   - Threshold: 1 event in 5 minutes
   - Action: Alert dev team immediately

---

## Emergency Rollback

If white screen persists after deployment:

```bash
# Rollback to previous deployment
wrangler pages deployments list --project-name=pitchey
wrangler pages deployments rollback --project-name=pitchey --deployment-id=<PREVIOUS_ID>

# Or deploy a minimal working version
git checkout last-known-good-commit
npm run build
wrangler pages deploy frontend/dist --project-name=pitchey
```

---

*Last Updated: January 2025*
*Critical: This error prevents ALL users from accessing the application*