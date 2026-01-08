// CRITICAL: This file ensures React is globally available for all chunks
// Must be imported before any React-dependent code
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
// Import the actual use-sync-external-store package that Zustand needs
import { useSyncExternalStore } from 'use-sync-external-store/shim';

// IMMEDIATELY make React available globally to prevent undefined errors
if (typeof window !== 'undefined') {
  // Patch React with useSyncExternalStore if missing
  if (!React.useSyncExternalStore) {
    (React as any).useSyncExternalStore = useSyncExternalStore;
  }
  
  // Replace the stub React with the real one
  (window as any).React = React;
  (window as any).ReactDOM = ReactDOM;
  (window as any).ReactDOMClient = ReactDOMClient;
  (globalThis as any).React = React;
  (globalThis as any).ReactDOM = ReactDOM;
  
  // Update the use-sync-external-store module with the real implementation
  const realModule = { 
    useSyncExternalStore,
    useSyncExternalStoreWithSelector: useSyncExternalStore,
    useSyncExternalStoreExports: useSyncExternalStore
  };
  (window as any)['use-sync-external-store'] = realModule;
  (window as any)['use-sync-external-store/shim'] = realModule;
  (window as any)['use-sync-external-store/shim/index'] = realModule;
}

// Import JSX runtime for production - NO jsxDEV!
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';

// Ensure React is available globally IMMEDIATELY
if (typeof window !== 'undefined') {
  // Make a copy of React with all hooks explicitly available
  const ReactWithHooks = Object.assign({}, React, {
    // Core hooks that MUST be available
    useState: React.useState,
    useEffect: React.useEffect,
    useLayoutEffect: React.useLayoutEffect,  // CRITICAL: This was missing!
    useContext: React.useContext,
    useReducer: React.useReducer,
    useCallback: React.useCallback,
    useMemo: React.useMemo,
    useRef: React.useRef,
    useImperativeHandle: React.useImperativeHandle,
    useDebugValue: React.useDebugValue,
    // React 18 specific hooks - use imported implementation
    useSyncExternalStore: useSyncExternalStore || (React as any).useSyncExternalStore,
    useId: (React as any).useId || (() => ':r' + Math.random().toString(36).substr(2, 9) + ':'),
    useTransition: (React as any).useTransition || (() => [false, (fn: any) => fn()]),
    useDeferredValue: (React as any).useDeferredValue || ((value: any) => value),
    useInsertionEffect: (React as any).useInsertionEffect || React.useLayoutEffect || React.useEffect,
  });
  
  (window as any).React = ReactWithHooks;
  (window as any).ReactDOM = ReactDOM;
  (window as any).ReactDOMClient = ReactDOMClient;
  
  // Also set on globalThis for better compatibility
  (globalThis as any).React = ReactWithHooks;
  (globalThis as any).ReactDOM = ReactDOM;
  (globalThis as any).ReactDOMClient = ReactDOMClient;
  
  // CRITICAL: Also provide for module systems that might look for it
  if (!(window as any).module) {
    (window as any).module = {};
  }
  if (!(window as any).exports) {
    (window as any).exports = {};
  }
  
  // Provide React for CommonJS-style requires
  (window as any).exports.React = ReactWithHooks;
  (window as any).module.exports = (window as any).module.exports || {};
  (window as any).module.exports.React = ReactWithHooks;
  
  // Provide JSX runtime globally (for production)
  (window as any).jsx = jsx;
  (window as any).jsxs = jsxs;
  (window as any).Fragment = Fragment;
  
  // Also make jsx-runtime available as a module-like object
  const jsxRuntime = { jsx, jsxs, Fragment };
  
  (window as any)['react/jsx-runtime'] = jsxRuntime;
  // In production, jsx-dev-runtime should use the same as jsx-runtime
  (window as any)['react/jsx-dev-runtime'] = jsxRuntime;
  
  // Patch module.exports pattern that some libraries might use
  if (typeof module !== 'undefined' && module.exports) {
    // Intercept any module that might be looking for jsxDEV
    let originalExports = module.exports;
    Object.defineProperty(module, 'exports', {
      get() {
        return originalExports;
      },
      set(value) {
        originalExports = value;
      }
    });
  }
  
  // Log to verify React is available (only in dev)
  if (process.env.NODE_ENV !== 'production') {
    console.log('React globally initialized:', {
      React: !!React,
      forwardRef: !!React.forwardRef,
      createElement: !!React.createElement,
      Component: !!React.Component,
      jsx: !!jsx,
      jsxs: !!jsxs
    });
  }
}

// No jsxDEV patching needed in production!

// Create enhanced React export with all hooks
const ReactExport = typeof window !== 'undefined' && (window as any).React ? 
  (window as any).React : Object.assign({}, React, {
    // Core hooks
    useState: React.useState,
    useEffect: React.useEffect,
    useLayoutEffect: React.useLayoutEffect,
    useContext: React.useContext,
    useReducer: React.useReducer,
    useCallback: React.useCallback,
    useMemo: React.useMemo,
    useRef: React.useRef,
    useImperativeHandle: React.useImperativeHandle,
    useDebugValue: React.useDebugValue,
    // React 18 hooks - use imported implementation
    useSyncExternalStore: useSyncExternalStore || (React as any).useSyncExternalStore,
    useId: (React as any).useId || (() => ':r' + Math.random().toString(36).substr(2, 9) + ':'),
    useTransition: (React as any).useTransition || (() => [false, (fn: any) => fn()]),
    useDeferredValue: (React as any).useDeferredValue || ((value: any) => value),
    useInsertionEffect: (React as any).useInsertionEffect || React.useLayoutEffect || React.useEffect,
  });

// Re-export for use in other files
export { ReactExport as React, ReactDOM, ReactDOMClient, jsx, jsxs, Fragment };