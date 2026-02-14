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
window.fetch = function(...args: Parameters<typeof fetch>) {
  let input = args[0];
  
  // Handle string URLs
  if (typeof input === 'string' && input.includes('http://localhost:8001')) {
    args[0] = input.replace('http://localhost:8001', getAPIURL());
  }
  // Handle URL objects
  else if (input instanceof URL) {
    const urlString = input.toString();
    if (urlString.includes('http://localhost:8001')) {
      args[0] = new URL(urlString.replace('http://localhost:8001', getAPIURL()));
    }
  }
  // Handle Request objects
  else if (input instanceof Request) {
    const urlString = input.url;
    if (urlString.includes('http://localhost:8001')) {
      const newUrl = urlString.replace('http://localhost:8001', getAPIURL());
      args[0] = new Request(newUrl, input);
    }
  }
  
  return originalFetch.apply(globalThis, args);
} as typeof fetch;

// Export lazy getters for components that import this
export const API_URL = new Proxy({}, {
  get() { return getAPIURL(); }
}) as any as string;

export const WS_URL = new Proxy({}, {
  get() { return getWSURL(); }
}) as any as string;