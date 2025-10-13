import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react"
import './index.css'
import './lib/fix-all-apis.ts' // Fix all API URLs globally
import App from './App.tsx'

// Initialize Sentry only in production
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_NODE_ENV || 'production',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: import.meta.env.VITE_NODE_ENV === 'production' ? 0.1 : 1.0,
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    // Release tracking
    release: "pitchey-frontend@1.0.0",
  });
  console.log('✅ Sentry initialized for React frontend');
} else {
  console.log('⚠️ Sentry disabled in development');
}

const AppWithErrorBoundary = import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN ? (
  <Sentry.ErrorBoundary fallback={<div>An error has occurred. Please refresh the page.</div>} showDialog>
    <App />
  </Sentry.ErrorBoundary>
) : (
  <App />
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {AppWithErrorBoundary}
  </StrictMode>,
)
