// Global API configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8001';

// Export for use in components that haven't been updated yet
(window as any).API_URL = API_URL;
(window as any).WS_URL = WS_URL;