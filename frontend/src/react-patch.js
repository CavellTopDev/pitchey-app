// React 18 Compatibility Patch
// This patches React to provide backward compatibility for removed APIs

// Create a proxy for React that intercepts property access
if (typeof window !== 'undefined') {
  const originalReact = window.React;
  
  // Define compatibility properties
  const compatProps = {
    AsyncMode: null,
    unstable_AsyncMode: null,
    ConcurrentMode: null,
    unstable_ConcurrentMode: null
  };
  
  // Create getter that returns Fragment as fallback
  const createCompatGetter = () => {
    return function() {
      // Return Fragment if available, otherwise a pass-through component
      return (this && this.Fragment) || function(props) { return props.children; };
    };
  };
  
  // Patch React before any code tries to use it
  Object.keys(compatProps).forEach(prop => {
    try {
      Object.defineProperty(window, 'React', {
        get: function() {
          if (!originalReact) return originalReact;
          
          // Ensure compatibility properties exist
          if (!(prop in originalReact)) {
            Object.defineProperty(originalReact, prop, {
              get: createCompatGetter(),
              set: function() {}, // Ignore sets
              configurable: true
            });
          }
          
          return originalReact;
        },
        set: function(value) {
          // When React is set, patch it immediately
          if (value && typeof value === 'object') {
            Object.keys(compatProps).forEach(p => {
              if (!(p in value)) {
                try {
                  Object.defineProperty(value, p, {
                    get: createCompatGetter().bind(value),
                    set: function() {},
                    configurable: true
                  });
                } catch (e) {
                  // Fallback to direct assignment
                  value[p] = value.Fragment || function(props) { return props.children; };
                }
              }
            });
          }
          window.React = value;
        },
        configurable: true
      });
    } catch (e) {
      // Silent fail - React might not be available yet
    }
  });
  
  // Also patch the global React if it exists
  if (window.React) {
    const react = window.React;
    Object.keys(compatProps).forEach(prop => {
      if (!(prop in react)) {
        try {
          Object.defineProperty(react, prop, {
            get: createCompatGetter().bind(react),
            set: function() {},
            configurable: true
          });
        } catch (e) {
          react[prop] = react.Fragment || function(props) { return props.children; };
        }
      }
    });
  }
}

export default {};