// React 18 Compatibility Initialization
// This must run before any React code loads
(function() {
  'use strict';
  
  // Wait for React to be available
  function patchReact() {
    // Try to get React from various sources
    var React = window.React || 
                (typeof require !== 'undefined' && require('react')) ||
                {};
    
    // Define AsyncMode as a fallback to Fragment
    if (!React.AsyncMode && !React.unstable_AsyncMode) {
      try {
        Object.defineProperty(React, 'AsyncMode', {
          get: function() { 
            return React.Fragment || function(props) { return props.children; };
          },
          set: function() {}, // Ignore attempts to set
          configurable: true
        });
        
        Object.defineProperty(React, 'unstable_AsyncMode', {
          get: function() { 
            return React.Fragment || function(props) { return props.children; };
          },
          set: function() {}, // Ignore attempts to set
          configurable: true
        });
      } catch (e) {
        // If we can't define properties, create simple fallbacks
        React.AsyncMode = React.Fragment || function(props) { return props.children; };
        React.unstable_AsyncMode = React.Fragment || function(props) { return props.children; };
      }
    }
    
    // Also patch ConcurrentMode for completeness
    if (!React.ConcurrentMode && !React.unstable_ConcurrentMode) {
      try {
        Object.defineProperty(React, 'ConcurrentMode', {
          get: function() { 
            return React.Fragment || function(props) { return props.children; };
          },
          set: function() {}, // Ignore attempts to set
          configurable: true
        });
        
        Object.defineProperty(React, 'unstable_ConcurrentMode', {
          get: function() { 
            return React.Fragment || function(props) { return props.children; };
          },
          set: function() {}, // Ignore attempts to set
          configurable: true
        });
      } catch (e) {
        React.ConcurrentMode = React.Fragment || function(props) { return props.children; };
        React.unstable_ConcurrentMode = React.Fragment || function(props) { return props.children; };
      }
    }
    
    // Ensure React is available globally
    if (typeof window !== 'undefined') {
      window.React = React;
    }
  }
  
  // Try to patch immediately
  patchReact();
  
  // Also patch after DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', patchReact);
    }
  }
  
  // Patch on first script execution as well
  if (typeof window !== 'undefined') {
    var originalDefine = window.define;
    var originalRequire = window.require;
    
    // Intercept AMD define
    if (typeof originalDefine === 'function' && originalDefine.amd) {
      window.define = function() {
        patchReact();
        return originalDefine.apply(this, arguments);
      };
      window.define.amd = originalDefine.amd;
    }
    
    // Intercept CommonJS require
    if (typeof originalRequire === 'function') {
      window.require = function(id) {
        var result = originalRequire.apply(this, arguments);
        if (id === 'react' || id.includes('react')) {
          patchReact();
        }
        return result;
      };
    }
  }
})();