import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/fix-all-apis.ts' // Fix all API URLs globally
import App from './App.tsx'

// Sentry temporarily completely removed to resolve initialization errors
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

const AppWrapper = <App />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {AppWrapper}
  </StrictMode>,
)
