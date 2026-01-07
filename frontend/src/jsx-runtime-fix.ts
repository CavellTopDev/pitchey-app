// Fix for jsxDEV errors in production
// Some libraries incorrectly try to use jsxDEV in production builds

import { jsx } from 'react/jsx-runtime';

// Ensure jsxDEV is available globally and on any object that might need it
if (typeof window !== 'undefined') {
  // Production-safe jsxDEV that delegates to jsx
  // Match the correct signature (5 params for jsxDEV vs 3 for jsx)
  const jsxDEVImpl = (type: any, config: any, maybeKey: any, source?: any, self?: any) => {
    return jsx(type, config, maybeKey);
  };

  // Set on window
  (window as any).jsxDEV = jsxDEVImpl;
  
  // Also patch any object that might be looking for jsxDEV
  const originalDefineProperty = Object.defineProperty;
  Object.defineProperty = function(obj: any, prop: string, descriptor: PropertyDescriptor) {
    // If something is trying to access jsxDEV on an object, provide it
    if (prop === 'jsxDEV' && !obj.jsxDEV) {
      obj.jsxDEV = jsxDEVImpl;
    }
    return originalDefineProperty.call(this, obj, prop, descriptor);
  };

  // Patch getter access
  const originalGet = Object.prototype.__lookupGetter__;
  if (originalGet) {
    Object.prototype.__lookupGetter__ = function(prop: string) {
      if (prop === 'jsxDEV' && !(this as any).jsxDEV) {
        (this as any).jsxDEV = jsxDEVImpl;
      }
      return originalGet.call(this, prop);
    };
  }

  // Create a Proxy to catch any access attempts
  const handler = {
    get(target: any, prop: string) {
      if (prop === 'jsxDEV') {
        return jsxDEVImpl;
      }
      return target[prop];
    }
  };

  // Try to patch common module systems
  const patchModuleSystem = () => {
    // Patch require if it exists
    if (typeof (window as any).require !== 'undefined') {
      const originalRequire = (window as any).require;
      (window as any).require = function(id: string) {
        const module = originalRequire(id);
        if (module && typeof module === 'object' && !module.jsxDEV) {
          module.jsxDEV = jsxDEVImpl;
        }
        return module;
      };
    }

    // Patch import if accessible
    if (typeof (window as any).__webpack_require__ !== 'undefined') {
      const originalWebpackRequire = (window as any).__webpack_require__;
      (window as any).__webpack_require__ = function(moduleId: any) {
        const module = originalWebpackRequire(moduleId);
        if (module && typeof module === 'object' && !module.jsxDEV) {
          module.jsxDEV = jsxDEVImpl;
        }
        return module;
      };
    }
  };

  // Apply patches
  patchModuleSystem();
  
  // Also listen for any error and try to patch on the fly
  window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('jsxDEV is not a function')) {
      console.warn('Attempting to patch jsxDEV error...');
      patchModuleSystem();
      
      // Try to find the object that's missing jsxDEV and patch it
      try {
        // This is a heuristic - in minified code, the error often refers to a variable
        const match = event.message.match(/(\w+)\.jsxDEV/);
        if (match && match[1]) {
          const varName = match[1];
          if ((window as any)[varName] && typeof (window as any)[varName] === 'object') {
            (window as any)[varName].jsxDEV = jsxDEVImpl;
          }
        }
      } catch (e) {
        // Ignore patching errors
      }
    }
  });
  
  // AGGRESSIVE FIX: Intercept all property access to provide jsxDEV
  // This uses a getter trap on common minified variable names
  const minifiedVars = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
  
  minifiedVars.forEach(varName => {
    // Try to define getter/setter for each variable
    try {
      let storedValue = (window as any)[varName];
      Object.defineProperty(window, varName, {
        get() {
          // If accessing this variable and it's an object, ensure it has jsxDEV
          if (storedValue && typeof storedValue === 'object' && !storedValue.jsxDEV) {
            try {
              storedValue.jsxDEV = jsxDEVImpl;
            } catch (e) {
              // Try defineProperty
              try {
                Object.defineProperty(storedValue, 'jsxDEV', {
                  value: jsxDEVImpl,
                  writable: true,
                  enumerable: false,
                  configurable: true
                });
              } catch (e2) {
                // Create a proxy that provides jsxDEV
                const proxy = new Proxy(storedValue, {
                  get(target, prop) {
                    if (prop === 'jsxDEV') return jsxDEVImpl;
                    return target[prop];
                  }
                });
                storedValue = proxy;
              }
            }
          }
          return storedValue;
        },
        set(value) {
          storedValue = value;
          // Immediately patch if it's an object
          if (value && typeof value === 'object' && !value.jsxDEV) {
            try {
              value.jsxDEV = jsxDEVImpl;
            } catch (e) {
              // Ignore
            }
          }
        },
        configurable: true
      });
    } catch (e) {
      // Variable might not be configurable or already defined
    }
  });
}

export {};