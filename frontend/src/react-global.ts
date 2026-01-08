// CRITICAL: This file ensures React is globally available for all chunks
// Must be imported before any React-dependent code
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import { useSyncExternalStore } from 'use-sync-external-store/shim';

// IMMEDIATELY make React available globally to prevent undefined errors
if (typeof window !== 'undefined') {
  // Ensure React has useSyncExternalStore (needed for Zustand in production)
  if (!React.useSyncExternalStore) {
    (React as any).useSyncExternalStore = useSyncExternalStore;
  }
  
  // Make React available globally with all hooks
  const ReactWithHooks = Object.assign({}, React, {
    // Ensure all hooks are available
    useSyncExternalStore: React.useSyncExternalStore || useSyncExternalStore,
    useId: (React as any).useId || (() => ':r' + Math.random().toString(36).substr(2, 9) + ':'),
    useTransition: (React as any).useTransition || (() => [false, (fn: any) => fn()]),
    useDeferredValue: (React as any).useDeferredValue || ((value: any) => value),
    useInsertionEffect: (React as any).useInsertionEffect || React.useLayoutEffect || React.useEffect,
  });
  
  // Set React globally for all module systems
  (window as any).React = ReactWithHooks;
  (window as any).ReactDOM = ReactDOM;
  (window as any).ReactDOMClient = ReactDOMClient;
  (globalThis as any).React = ReactWithHooks;
  (globalThis as any).ReactDOM = ReactDOM;
  (globalThis as any).ReactDOMClient = ReactDOMClient;
}

// Export React with all necessary hooks
export default React;
export { React, ReactDOM, ReactDOMClient };