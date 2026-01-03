// Vite plugin to fix React 18 compatibility issues
export default function reactCompatPlugin() {
  return {
    name: 'vite-plugin-react-compat',
    enforce: 'pre',
    transform(code, id) {
      // Only process JavaScript/TypeScript files from node_modules
      if (!id.includes('node_modules')) {
        return null;
      }
      
      // Fix react-is and other libraries that reference AsyncMode
      if (code.includes('AsyncMode') || code.includes('unstable_AsyncMode')) {
        let transformedCode = code;
        
        // Replace direct property access
        transformedCode = transformedCode.replace(
          /(\w+)\.AsyncMode/g,
          '($1.AsyncMode || $1.Fragment)'
        );
        
        transformedCode = transformedCode.replace(
          /(\w+)\.unstable_AsyncMode/g,
          '($1.unstable_AsyncMode || $1.Fragment)'
        );
        
        // Replace property assignments that might fail
        transformedCode = transformedCode.replace(
          /\.AsyncMode\s*=/g,
          '.AsyncMode = (function() { try { return '
        );
        
        // Fix isAsyncMode functions
        transformedCode = transformedCode.replace(
          /function\s+isAsyncMode\([^)]*\)\s*{[^}]*}/g,
          'function isAsyncMode() { return false; }'
        );
        
        transformedCode = transformedCode.replace(
          /exports\.isAsyncMode\s*=\s*function[^;]+;/g,
          'exports.isAsyncMode = function() { return false; };'
        );
        
        return {
          code: transformedCode,
          map: null
        };
      }
      
      return null;
    },
    // Add a banner to all entry chunks that patches React
    renderChunk(code, chunk) {
      if (chunk.fileName.includes('vendor-react')) {
        const patchCode = `
(function() {
  // React 18 Compatibility Patch
  if (typeof window !== 'undefined') {
    const patchReact = function(React) {
      if (!React || typeof React !== 'object') return React;
      
      const compatProps = {
        AsyncMode: React.Fragment,
        unstable_AsyncMode: React.Fragment,
        ConcurrentMode: React.Fragment,
        unstable_ConcurrentMode: React.Fragment
      };
      
      Object.keys(compatProps).forEach(function(prop) {
        if (!(prop in React)) {
          try {
            Object.defineProperty(React, prop, {
              get: function() { return React.Fragment || function(p) { return p.children; }; },
              set: function() {},
              configurable: true,
              enumerable: false
            });
          } catch (e) {
            React[prop] = compatProps[prop];
          }
        }
      });
      
      return React;
    };
    
    // Patch window.React if it exists
    if (window.React) {
      window.React = patchReact(window.React);
    }
    
    // Intercept React definition
    const originalDefine = Object.getOwnPropertyDescriptor(window, 'React');
    if (!originalDefine || originalDefine.configurable) {
      Object.defineProperty(window, 'React', {
        get: function() { return this._React; },
        set: function(val) { this._React = patchReact(val); },
        configurable: true
      });
    }
  }
})();
`;
        return {
          code: patchCode + code,
          map: null
        };
      }
      return null;
    }
  };
}