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
      tracesSampleRate: 0.2,              // adjust as needed
      replaysSessionSampleRate: 0.1,      // adjust as needed
      replaysOnErrorSampleRate: 1.0,
      environment: import.meta.env.MODE,
      beforeSend(event) {
        // Scrub Authorization headers and tokens if present
        if (event.request?.headers) {
          delete (event.request.headers as any)['authorization']
        }
        return event
      },
    })
    console.log('✅ Sentry initialized')
  } else {
    console.log('ℹ️ Sentry DSN not set; running without Sentry')
    // Basic console fallback for errors
    window.addEventListener('error', (event) => {
      console.error('FRONTEND ERROR:', event.message, event.error)
    })
    window.addEventListener('unhandledrejection', (event) => {
      console.error('UNHANDLED REJECTION:', event.reason)
    })
  }
})()

const AppWrapper = <App />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {AppWrapper}
  </StrictMode>,
)
