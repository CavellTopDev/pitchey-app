/**
 * React Global Setup - Production JSX Runtime Only
 */

// Force React to be available globally (required for Vite builds)
import * as React from 'react';

// Ensure React is available globally
if (typeof window !== 'undefined') {
  (window as any).React = React;
}

// Export React for global access
export default React;