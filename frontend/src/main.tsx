// CRITICAL: Import React global setup FIRST before anything else
// React Router v7 doesn't need use-sync-external-store polyfill
import './react-global';

// TypeScript declarations for debugging
declare global {
  interface Window {
    __lastError?: Error;
    __lastRejection?: any;
    __appInitError?: Error;
    __fatalInitError?: Error;
    __errorBoundaryError?: Error;
  }
}

// Debug: Mark that main.tsx is executing

// ENSURE React is available globally before any other imports
import * as React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';


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
  // Store error for debugging
  window.__lastError = event.error;
})
window.addEventListener('unhandledrejection', (event) => {
  console.error('UNHANDLED REJECTION:', event.reason)
  console.error('Rejection details:', {
    type: typeof event.reason,
    stack: event.reason?.stack,
    message: event.reason?.message
  })
  // Store rejection for debugging
  window.__lastRejection = event.reason;
})

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = createRoot(rootElement);
    
    // Wrap App in error boundary for debugging
    const AppWithErrorCapture = () => {
      try {
        return React.createElement(App);
      } catch (error) {
        console.error('App initialization error:', error);
        window.__appInitError = error;
        throw error;
      }
    };
    
    root.render(
      React.createElement(AppWithErrorCapture)
    );
  } catch (error) {
    console.error('main.tsx: Fatal error during app initialization:', error);
    window.__fatalInitError = error;
    // Display error on page
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: monospace;">
        <h1>Initialization Error</h1>
        <pre>${error.message}</pre>
        <pre>${error.stack}</pre>
      </div>
    `;
  }
} else {
  console.error('main.tsx: Root element not found!');
}
