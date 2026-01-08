// CRITICAL: This file ensures React is globally available for all chunks
// Must be imported before any React-dependent code
import * as ReactImport from 'react';
import * as ReactDOMImport from 'react-dom';
import * as ReactDOMClientImport from 'react-dom/client';

// IMMEDIATELY make React available globally to prevent undefined errors
if (typeof window !== 'undefined') {
  // Set React globally for all module systems
  (window as any).React = ReactImport;
  (window as any).ReactDOM = ReactDOMImport;
  (window as any).ReactDOMClient = ReactDOMClientImport;
  (globalThis as any).React = ReactImport;
  (globalThis as any).ReactDOM = ReactDOMImport;
  (globalThis as any).ReactDOMClient = ReactDOMClientImport;
}

// Re-export React modules
export { ReactImport as React, ReactDOMImport as ReactDOM, ReactDOMClientImport as ReactDOMClient };
export default ReactImport;