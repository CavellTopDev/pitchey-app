// Authentication utilities for portal validation and cleanup

export interface UserType {
  type: 'creator' | 'investor' | 'production';
}

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
  
  // Clear localStorage - both namespaced and legacy
  const authKeys = [
    'authToken', 
    'user', 
    'userType',
    'pitchey_last_ws_attempt',
    'pitchey_ws_queue',
    'pitchey_ws_ratelimit',
    'pitchey_ws_circuit_breaker',
    'pitchey_websocket_disabled',
    'pitchey_websocket_loop_detected',
    'demoMode'
  ];
  
  authKeys.forEach(key => {
    localStorage.removeItem(key);
    // Also remove namespaced versions
    const namespacedKey = `pitchey:${key}`;
    localStorage.removeItem(namespacedKey);
  });
  
  // Clear sessionStorage completely
  sessionStorage.clear();
  
  // Clear any API interceptor cached tokens
  const event = new CustomEvent('auth:cleared');
  window.dispatchEvent(event);
  
};

/**
 * Safe portal switching that prevents authentication conflicts
 */
export const switchPortal = (targetPortal: 'creator' | 'investor' | 'production') => {
  
  // Clear all auth state first
  clearAuthenticationState();
  
  // DISABLED: This was causing redirect loops with Better Auth
  // Better Auth handles authentication, not this redirect
  // setTimeout(() => {
  //   const redirectPath = `/login/${targetPortal}`;
  //   window.location.replace(redirectPath);
  // }, 100);
};

/**
 * Check if user authentication state matches their portal
 */
export const checkAuthPortalConsistency = (): boolean => {
  const token = localStorage.getItem('authToken');
  const user = localStorage.getItem('user');
  const userType = localStorage.getItem('userType');
  
  if (!token || !user || !userType) {
    return false; // Not authenticated
  }
  
  try {
    const userData = JSON.parse(user);
    // Check if localStorage userType matches the user object
    return userData.userType === userType;
  } catch {
    return false; // Corrupted data
  }
};

/**
 * Get safe user data from localStorage
 */
export const getSafeUserData = () => {
  try {
    const userStr = localStorage.getItem('user');
    const userType = localStorage.getItem('userType');
    const token = localStorage.getItem('authToken');
    
    if (!userStr || !userType || !token) {
      return { user: null, userType: null, token: null, isValid: false };
    }
    
    const user = JSON.parse(userStr);
    const isValid = user.userType === userType;
    
    return { user, userType, token, isValid };
  } catch (error) {
    console.warn('Failed to parse user data:', error);
    return { user: null, userType: null, token: null, isValid: false };
  }
};