// Global API URL fix for all components
import { config } from '../config';

const API_URL = config.API_URL;
const WS_URL = config.WS_URL;

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