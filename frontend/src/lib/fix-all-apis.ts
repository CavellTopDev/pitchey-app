// Global API URL fix for all components
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

// Override fetch globally to replace localhost with ngrok URL
const originalFetch = window.fetch;
window.fetch = function(...args) {
  let url = args[0];
  if (typeof url === 'string' && url.includes('http://localhost:8000')) {
    url = url.replace('http://localhost:8000', API_URL);
    args[0] = url;
  }
  return originalFetch.apply(this, args);
};

// Export for components that import this
export { API_URL, WS_URL };