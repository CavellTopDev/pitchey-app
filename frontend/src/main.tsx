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
import { initSentry } from './monitoring/sentry-config'

// Initialize Sentry for production error tracking
initSentry()

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = createRoot(rootElement);
    
    // Wrap App in error boundary for debugging
    const AppWithErrorCapture = () => {
      try {
        return React.createElement(App);
      } catch (error) {
        console.warn('App initialization error:', error);
        window.__appInitError = error;
        throw error;
      }
    };
    
    root.render(
      React.createElement(AppWithErrorCapture)
    );
  } catch (error) {
    console.warn('main.tsx: Fatal error during app initialization:', error);
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
  console.warn('main.tsx: Root element not found!');
}
