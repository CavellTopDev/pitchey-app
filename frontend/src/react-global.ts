// CRITICAL: This file ensures React is globally available for all chunks
// Must be imported before any React-dependent code
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';

// Import useSyncExternalStore directly for React 18
import { useSyncExternalStore as importedUseSyncExternalStore } from 'react';

// Import JSX runtime for production
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';

// Create jsxDEV as a wrapper around jsx for production
// This handles the different signature that jsxDEV expects
const jsxDEV = (type: any, config: any, maybeKey: any, source?: any, self?: any) => {
  // In production, jsxDEV delegates to jsx
  // jsxDEV has 5 params, jsx has 3
  return jsx(type, config, maybeKey);
};

// CRITICAL FIX: Ensure useSyncExternalStore is available
// Use the imported version or React's version or fallback
const useSyncExternalStore = importedUseSyncExternalStore || 
  (React as any).useSyncExternalStore || 
  function(subscribe: any, getSnapshot: any, getServerSnapshot?: any) {
    // Fallback implementation for compatibility
    const [value, setValue] = React.useState(() => 
      getSnapshot ? getSnapshot() : undefined
    );
    
    React.useEffect(() => {
      if (!subscribe || !getSnapshot) return;
      
      // Set initial value
      setValue(getSnapshot());
      
      // Subscribe to changes
      const unsubscribe = subscribe(() => {
        setValue(getSnapshot());
      });
      
      return unsubscribe;
    }, [subscribe, getSnapshot]);
    
    return value;
  };

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
    // React 18 specific hooks
    useSyncExternalStore: useSyncExternalStore,
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
  (window as any).jsxDEV = jsxDEV;
  
  // Also make jsx-runtime available as a module-like object
  const jsxRuntime = { jsx, jsxs, Fragment, jsxDEV };
  const jsxDevRuntime = { jsxDEV, Fragment, jsx, jsxs };
  
  (window as any)['react/jsx-runtime'] = jsxRuntime;
  (window as any)['react/jsx-dev-runtime'] = jsxDevRuntime;
  
  // Patch module.exports pattern that some libraries might use
  if (typeof module !== 'undefined' && module.exports) {
    // Intercept any module that might be looking for jsxDEV
    let originalExports = module.exports;
    Object.defineProperty(module, 'exports', {
      get() {
        return originalExports;
      },
      set(value) {
        if (value && typeof value === 'object') {
          // Ensure jsxDEV is available on any module exports
          if (!value.jsxDEV) {
            value.jsxDEV = jsxDEV;
          }
        }
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
      jsxDEV: !!(window as any).jsxDEV
    });
  }
}

// CRITICAL FIX: Some bundled modules expect jsxDEV on their exports
// This patches any object access to provide jsxDEV when missing
if (typeof window !== 'undefined' && typeof Proxy !== 'undefined') {
  const originalObjectCreate = Object.create;
  Object.create = function(proto: any, ...args: any[]) {
    const obj = originalObjectCreate.call(Object, proto, ...args);
    
    // If this looks like a module export object, ensure it has jsxDEV
    if (obj && typeof obj === 'object' && !obj.jsxDEV) {
      try {
        Object.defineProperty(obj, 'jsxDEV', {
          value: jsxDEV,
          configurable: true,
          enumerable: false,
          writable: true
        });
      } catch (e) {
        // Ignore if we can't add the property
      }
    }
    return obj;
  };
  
  // Also patch any existing objects that might be module exports
  const patchObject = (obj: any) => {
    if (obj && typeof obj === 'object' && !obj.jsxDEV) {
      try {
        obj.jsxDEV = jsxDEV;
      } catch (e) {
        // Try with defineProperty if direct assignment fails
        try {
          Object.defineProperty(obj, 'jsxDEV', {
            value: jsxDEV,
            configurable: true,
            enumerable: false,
            writable: true
          });
        } catch (e2) {
          // Ignore
        }
      }
    }
  };
  
  // Patch common global objects that might be module containers
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach(varName => {
    if ((window as any)[varName]) {
      patchObject((window as any)[varName]);
    }
    // Also define a getter that patches on access
    try {
      let value = (window as any)[varName];
      Object.defineProperty(window, varName, {
        get() {
          if (value && typeof value === 'object' && !value.jsxDEV) {
            value.jsxDEV = jsxDEV;
          }
          return value;
        },
        set(newValue) {
          value = newValue;
          if (newValue && typeof newValue === 'object' && !newValue.jsxDEV) {
            newValue.jsxDEV = jsxDEV;
          }
        },
        configurable: true
      });
    } catch (e) {
      // Variable might already be defined
    }
  });
  
  // Watch for new global variables and patch them
  const watchedVars = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  watchedVars.forEach(varName => {
    try {
      Object.defineProperty(window, varName, {
        get() {
          return (window as any)[`__${varName}`];
        },
        set(value) {
          patchObject(value);
          (window as any)[`__${varName}`] = value;
        },
        configurable: true
      });
    } catch (e) {
      // Variable might already be defined
    }
  });
}

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
    // React 18 hooks
    useSyncExternalStore: useSyncExternalStore,
    useId: (React as any).useId || (() => ':r' + Math.random().toString(36).substr(2, 9) + ':'),
    useTransition: (React as any).useTransition || (() => [false, (fn: any) => fn()]),
    useDeferredValue: (React as any).useDeferredValue || ((value: any) => value),
    useInsertionEffect: (React as any).useInsertionEffect || React.useLayoutEffect || React.useEffect,
  });

// Re-export for use in other files
export { ReactExport as React, ReactDOM, ReactDOMClient, jsx, jsxs, Fragment, jsxDEV, useSyncExternalStore };