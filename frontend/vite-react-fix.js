/**
 * Vite Plugin to Fix React AsyncMode Issues
 * Handles legacy React components that try to set deprecated AsyncMode properties
 */

export function reactAsyncModeFix() {
  return {
    name: 'react-asyncmode-fix',
    transform(code, id) {
      // Skip non-JS files and files already processed
      if (!id.endsWith('.js') && !id.endsWith('.jsx') && !id.endsWith('.ts') && !id.endsWith('.tsx')) {
        return null;
      }

      let modified = false;
      let fixedCode = code;

      // Fix 1: Wrap React property assignments in try-catch
      const reactProps = ['AsyncMode', 'unstable_AsyncMode', 'ContextConsumer', 'ContextProvider', 'Fragment', 'Element', 'ForwardRef', 'Lazy', 'Memo', 'Portal', 'Profiler', 'StrictMode', 'Suspense', 'SuspenseList', 'isAsyncMode', 'isConcurrentMode', 'isContextConsumer', 'isContextProvider', 'isElement', 'isForwardRef', 'isFragment', 'isLazy', 'isMemo', 'isPortal', 'isProfiler', 'isStrictMode', 'isSuspense', 'isSuspenseList', 'isValidElementType', 'typeOf'];
      
      for (const prop of reactProps) {
        if (fixedCode.includes(prop)) {
          // Replace direct property assignments with safe assignments
          fixedCode = fixedCode.replace(
            new RegExp(`(\\w+)\\.${prop}\\s*=([^;]+);`, 'g'),
            `try { $1.${prop} = $2; } catch(e) { /* ${prop} assignment error handled */ }`
          );
          
          // Replace exports assignments
          fixedCode = fixedCode.replace(
            new RegExp(`exports\\.${prop}\\s*=([^;]+);`, 'g'),
            `try { if (typeof exports !== 'undefined') exports.${prop} = $1; } catch(e) { /* exports assignment failed */ }`
          );
          
          modified = true;
        }
      }

      // Fix 2: Replace problematic react-is checks
      if (fixedCode.includes('react-is') && fixedCode.includes('AsyncMode')) {
        // Replace old react-is AsyncMode exports
        fixedCode = fixedCode.replace(
          /var AsyncMode = REACT_ASYNC_MODE_TYPE;/g,
          'var AsyncMode = null; // Deprecated in React 18'
        );

        // Fix function that tries to access React.AsyncMode
        fixedCode = fixedCode.replace(
          /React\.AsyncMode/g,
          '(React.AsyncMode || React.Fragment)'
        );

        modified = true;
      }

      // Fix 3: Handle react-smooth specific issues
      if (id.includes('react-smooth') || id.includes('recharts')) {
        // Wrap all React property assignments in react-smooth
        if (fixedCode.includes('Object.defineProperty') && fixedCode.includes('AsyncMode')) {
          fixedCode = fixedCode.replace(
            /Object\.defineProperty\([^,]+,\s*['"]AsyncMode['"][^}]+}\)/g,
            'try { $& } catch(e) { /* AsyncMode deprecated */ }'
          );
          modified = true;
        }
      }

      // Fix 4: Handle prop-types issues
      if (id.includes('prop-types') && fixedCode.includes('AsyncMode')) {
        fixedCode = fixedCode.replace(
          /exports\.AsyncMode\s*=\s*AsyncMode;/g,
          'try { exports.AsyncMode = AsyncMode; } catch(e) { exports.AsyncMode = null; }'
        );
        modified = true;
      }

      // Fix 5: Handle exports undefined errors in UMD modules (Context7 pattern) - Conservative approach
      if (fixedCode.includes('Cannot set properties of undefined') || (fixedCode.includes('exports') && fixedCode.includes('typeof exports'))) {
        // Very targeted fix for the specific error pattern
        // Just add exports safety check at the beginning of problematic modules
        if (fixedCode.includes('typeof exports') && fixedCode.includes('exports.') && !fixedCode.includes('window.exports')) {
          fixedCode = `
// UMD exports safety (Context7 pattern)
if (typeof exports === 'undefined' && typeof window !== 'undefined') {
  window.exports = {};
  if (typeof module === 'undefined') {
    window.module = { exports: window.exports };
  }
}
${fixedCode}`;
          modified = true;
        }
      }

      // Fix 6: Global React object protection
      if (fixedCode.includes('window.React') || fixedCode.includes('global.React')) {
        const reactProtection = `
(function() {
  var originalReact = typeof React !== 'undefined' ? React : {};
  var reactHandler = {
    get: function(target, prop) {
      if (prop === 'AsyncMode' || prop === 'unstable_AsyncMode') {
        return target.Fragment || function(props) { return props.children; };
      }
      return target[prop];
    },
    set: function(target, prop, value) {
      if (prop === 'AsyncMode' || prop === 'unstable_AsyncMode') {
        // Silently ignore deprecated AsyncMode assignments
        return true;
      }
      target[prop] = value;
      return true;
    }
  };
  
  if (typeof window !== 'undefined' && !window.__reactFixed) {
    try {
      if (typeof Proxy !== 'undefined') {
        window.React = new Proxy(originalReact, reactHandler);
      }
      window.__reactFixed = true;
    } catch(e) { /* Proxy not supported */ }
  }
})();
`;
        
        fixedCode = reactProtection + fixedCode;
        modified = true;
      }

      return modified ? { code: fixedCode, map: null } : null;
    }
  };
}