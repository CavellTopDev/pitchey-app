/**
 * Centralized environment configuration with validation
 * This file provides type-safe access to environment variables
 */

interface AppConfig {
  API_URL: string;
  WS_URL: string;
  NODE_ENV: string;
  IS_PRODUCTION: boolean;
  IS_DEVELOPMENT: boolean;
  MODE: string;
  WEBSOCKET_ENABLED: boolean;
}

/**
 * Validates and returns environment configuration
 * Throws error if required environment variables are missing
 */
function createConfig(): AppConfig {
  // Get environment variables from Vite's import.meta.env
  const apiUrl = import.meta.env.VITE_API_URL;
  const wsUrl = import.meta.env.VITE_WS_URL;
  const nodeEnv = import.meta.env.VITE_NODE_ENV || import.meta.env.MODE || 'development';
  const mode = import.meta.env.MODE;

  // Validate required environment variables
  if (!apiUrl) {
    throw new Error('VITE_API_URL environment variable is required');
  }

  // Default WebSocket URL if not provided
  let finalWsUrl = wsUrl;
  if (!wsUrl) {
    // Convert API URL to WebSocket URL
    if (apiUrl.startsWith('https://')) {
      finalWsUrl = apiUrl.replace('https://', 'wss://');
    } else if (apiUrl.startsWith('http://')) {
      finalWsUrl = apiUrl.replace('http://', 'ws://');
    } else {
      // Fallback - assume http for local development
      finalWsUrl = `ws://${apiUrl}`;
    }
  }

  const config: AppConfig = {
    API_URL: apiUrl,
    WS_URL: finalWsUrl,
    NODE_ENV: nodeEnv,
    IS_PRODUCTION: mode === 'production',
    IS_DEVELOPMENT: mode === 'development',
    MODE: mode,
    // Enable WebSocket in production with Cloudflare Workers (Durable Objects support)
    WEBSOCKET_ENABLED: import.meta.env.VITE_DISABLE_WEBSOCKET !== 'true'
  };

  // Log configuration in development
  if (config.IS_DEVELOPMENT) {
    console.log('🔧 Environment Configuration:', {
      API_URL: config.API_URL,
      WS_URL: config.WS_URL,
      NODE_ENV: config.NODE_ENV,
      MODE: config.MODE,
      IS_PRODUCTION: config.IS_PRODUCTION,
      IS_DEVELOPMENT: config.IS_DEVELOPMENT
    });
  }

  return config;
}

// Create configuration with lazy initialization to avoid temporal dead zone
let _config: AppConfig | null = null;
export const config = new Proxy({} as AppConfig, {
  get(target, prop) {
    if (!_config) {
      _config = createConfig();
    }
    return _config[prop as keyof AppConfig];
  }
});

// Backward compatibility exports with lazy evaluation
// Use getter functions to avoid proxy issues in template strings
export function getApiUrl(): string {
  return config.API_URL;
}

export function getWsUrl(): string {
  return config.WS_URL;
}

// For backward compatibility, export direct access (should work correctly now)
export const API_URL = config.API_URL;
export const WS_URL = config.WS_URL;

// Export for use in components that haven't been updated yet (lazy)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'API_URL', {
    get() { return config.API_URL; }
  });
  Object.defineProperty(window, 'WS_URL', {
    get() { return config.WS_URL; }
  });
}

export default config;