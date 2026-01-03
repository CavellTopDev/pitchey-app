/**
 * React 18 Compatibility Layer
 * Provides polyfills for deprecated React APIs to ensure compatibility
 */

import React from 'react';

// Polyfill for deprecated React.AsyncMode
if (!React.AsyncMode && React.unstable_AsyncMode) {
  // @ts-ignore
  React.AsyncMode = React.unstable_AsyncMode;
} else if (!React.AsyncMode) {
  // AsyncMode was removed in React 18, provide a no-op fallback
  // @ts-ignore
  React.AsyncMode = React.Fragment;
}

// Polyfill for deprecated React.unstable_ConcurrentMode
if (!React.ConcurrentMode && React.unstable_ConcurrentMode) {
  // @ts-ignore
  React.ConcurrentMode = React.unstable_ConcurrentMode;
} else if (!React.ConcurrentMode) {
  // ConcurrentMode was removed in React 18, provide Fragment as fallback
  // @ts-ignore
  React.ConcurrentMode = React.Fragment;
}

// Ensure StrictMode exists (it should in React 18)
if (!React.StrictMode) {
  // @ts-ignore
  React.StrictMode = React.Fragment;
}

export default React;