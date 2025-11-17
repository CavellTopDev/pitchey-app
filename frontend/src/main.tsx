import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/fix-all-apis.ts' // Fix all API URLs globally
import App from './App.tsx'

// Sentry (enabled only if VITE_SENTRY_DSN is defined)
import * as Sentry from '@sentry/react'

(() => {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (dsn) {
    Sentry.init({
      dsn,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: true,
        }),
      ],
      tracesSampleRate: 0.2,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      environment: import.meta.env.MODE,
      beforeSend(event) {
        // Scrub Authorization headers and tokens if present
        if (event.request?.headers) {
          delete (event.request.headers as any)['authorization']
        }
        
        // Add context for dashboard-related errors
        if (event.exception && window.location.pathname.includes('/dashboard')) {
          event.tags = {
            ...event.tags,
            component: 'dashboard',
            route: window.location.pathname,
            userAgent: navigator.userAgent.slice(0, 100) // Truncate to avoid too much data
          };
        }
        
        return event
      },
    })
    
    // Enhanced error tracking for async listener issues
    const originalConsoleError = console.error;
    console.error = function(...args) {
      // Check for the specific async listener error
      const errorMessage = args.join(' ');
      if (errorMessage.includes('A listener indicated an asynchronous response by returning true')) {
        Sentry.captureException(new Error(`Async Listener Error: ${errorMessage}`), {
          tags: {
            errorType: 'async_listener',
            component: 'dashboard',
            route: window.location.pathname
          },
          extra: {
            fullErrorMessage: errorMessage,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          }
        });
      }
      originalConsoleError.apply(console, args);
    };
    
    // Track dashboard navigation and loading
    if (window.location.pathname.includes('/dashboard')) {
      Sentry.addBreadcrumb({
        message: `Dashboard page loaded: ${window.location.pathname}`,
        category: 'navigation',
        level: 'info',
        data: {
          pathname: window.location.pathname,
          search: window.location.search,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    console.log('✅ Sentry initialized with dashboard debugging')
  } else {
    console.log('ℹ️ Sentry DSN not set; running without Sentry')
    // Enhanced console fallback for debugging
    window.addEventListener('error', (event) => {
      console.error('FRONTEND ERROR:', event.message, event.error)
      console.error('Error details:', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      })
    })
    window.addEventListener('unhandledrejection', (event) => {
      console.error('UNHANDLED REJECTION:', event.reason)
      console.error('Rejection details:', {
        type: typeof event.reason,
        stack: event.reason?.stack,
        message: event.reason?.message
      })
    })
  }
})()

const AppWrapper = <App />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {AppWrapper}
  </StrictMode>,
)
