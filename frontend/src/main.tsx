// CRITICAL: Import React global setup FIRST before anything else
// React Router v7 doesn't need use-sync-external-store polyfill
import './react-global';

// Debug: Mark that main.tsx is executing
console.log('main.tsx: Starting execution');

// ENSURE React is available globally before any other imports
import * as React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

console.log('main.tsx: React imported', { React: !!React, createRoot: !!createRoot });

import './index.css'
import './lib/fix-all-apis.ts' // Fix all API URLs globally
import App from './App.tsx'

console.log('main.tsx: App imported', { App: !!App });

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

console.log('main.tsx: Getting root element');
const rootElement = document.getElementById('root');
console.log('main.tsx: Root element found:', !!rootElement);

if (rootElement) {
  console.log('main.tsx: Creating React root');
  const root = createRoot(rootElement);
  console.log('main.tsx: Rendering app');
  root.render(
    React.createElement(StrictMode, {}, React.createElement(App))
  );
  console.log('main.tsx: Render call completed');
} else {
  console.error('main.tsx: Root element not found!');
}
