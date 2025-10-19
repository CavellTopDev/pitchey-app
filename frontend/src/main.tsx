import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/fix-all-apis.ts' // Fix all API URLs globally
import App from './App.tsx'

// Simple error logging (replaced Sentry)
function logFrontendError(error: any, context?: any) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] FRONTEND ERROR:`, error);
  if (context) {
    console.error('Context:', context);
  }
}

// Set up global error handler
window.addEventListener('error', (event) => {
  logFrontendError(event.error, {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logFrontendError(event.reason, { type: 'unhandled_promise_rejection' });
});

console.log('✅ Frontend error logging initialized (Sentry removed)');

// Simple app wrapper without Sentry
const AppWrapper = <App />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {AppWrapper}
  </StrictMode>,
)
