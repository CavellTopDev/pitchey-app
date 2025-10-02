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
  const defaultWsUrl = apiUrl.replace(/^https?:\/\//, '').replace(/^http/, 'ws').replace(/^https/, 'wss');
  const finalWsUrl = wsUrl || (apiUrl.startsWith('https') ? `wss://${defaultWsUrl}` : `ws://${defaultWsUrl}`);

  const config: AppConfig = {
    API_URL: apiUrl,
    WS_URL: finalWsUrl,
    NODE_ENV: nodeEnv,
    IS_PRODUCTION: mode === 'production',
    IS_DEVELOPMENT: mode === 'development',
    MODE: mode
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

// Create and export the configuration
export const config = createConfig();

// Backward compatibility exports
export const API_URL = config.API_URL;
export const WS_URL = config.WS_URL;

// Export for use in components that haven't been updated yet
(window as any).API_URL = API_URL;
(window as any).WS_URL = WS_URL;

export default config;