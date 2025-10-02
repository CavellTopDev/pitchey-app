// Legacy API configuration - use /src/config.ts for new implementations
import { config } from '../config';

export const API_URL = config.API_URL;
export const WS_URL = config.WS_URL;

// Export for use in components that haven't been updated yet
(window as any).API_URL = API_URL;
(window as any).WS_URL = WS_URL;