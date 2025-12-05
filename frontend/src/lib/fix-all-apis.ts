// Global API URL fix for all components
import { config } from '../config';

// Lazy getters to avoid temporal dead zone issues during module initialization
let _API_URL: string | null = null;
let _WS_URL: string | null = null;

function getAPIURL(): string {
  if (!_API_URL) {
    _API_URL = config.API_URL;
  }
  return _API_URL;
}

function getWSURL(): string {
  if (!_WS_URL) {
    _WS_URL = config.WS_URL;
  }
  return _WS_URL;
}

// Override fetch globally to replace localhost with ngrok URL
const originalFetch = window.fetch;
window.fetch = function(...args) {
  let url = args[0];
  if (typeof url === 'string' && url.includes('http://localhost:8001')) {
    url = url.replace('http://localhost:8001', getAPIURL());
    args[0] = url;
  }
  return originalFetch.apply(this, args);
};

// Export lazy getters for components that import this
export const API_URL = new Proxy({}, {
  get() { return getAPIURL(); }
}) as any as string;

export const WS_URL = new Proxy({}, {
  get() { return getWSURL(); }
}) as any as string;