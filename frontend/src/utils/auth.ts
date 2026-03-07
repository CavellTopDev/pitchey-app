// Authentication utilities for portal validation and cleanup

export interface PortalValidation {
  isValidPortal: boolean;
  currentPortal: string;
  expectedPortal: string;
  redirectPath: string;
}

/**
 * Validates if the user is on the correct portal based on their userType
 */
export const validatePortalAccess = (userType: string | null, currentPath: string): PortalValidation => {
  if (!userType) {
    return {
      isValidPortal: false,
      currentPortal: 'unknown',
      expectedPortal: 'login',
      redirectPath: '/'
    };
  }

  // Extract current portal from path
  let currentPortal = 'home';
  if (currentPath.startsWith('/creator')) currentPortal = 'creator';
  else if (currentPath.startsWith('/investor')) currentPortal = 'investor';
  else if (currentPath.startsWith('/production')) currentPortal = 'production';

  // Check if user is on correct portal
  const expectedPortal = userType;
  const isValidPortal = currentPortal === 'home' || currentPortal === expectedPortal;

  return {
    isValidPortal,
    currentPortal,
    expectedPortal,
    redirectPath: isValidPortal ? currentPath : `/${expectedPortal}/dashboard`
  };
};

/**
 * Comprehensive authentication state cleanup for portal switches
 */
export const clearAuthenticationState = () => {
  // Clear WebSocket state to prevent reconnect loops after portal switch
  const wsKeys = [
    'pitchey_last_ws_attempt',
    'pitchey_ws_queue',
    'pitchey_ws_ratelimit',
    'pitchey_ws_circuit_breaker',
    'pitchey_websocket_disabled',
    'pitchey_websocket_loop_detected',
  ];
  wsKeys.forEach(key => localStorage.removeItem(key));

  sessionStorage.clear();
};

