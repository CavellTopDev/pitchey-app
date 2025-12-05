import { config } from '../config';

interface LoginResponse {
  success: boolean;
  user: any;
  sessionId?: string;
  error?: string;
}

interface SessionResponse {
  success: boolean;
  user: any;
  session: {
    createdAt: number;
    expiresAt: number;
  };
}

class SecureAuthService {
  private baseURL = config.API_URL;

  /**
   * Login with secure session cookies
   */
  async login(portal: string, email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/${portal}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // No need to store token - it's in HTTPOnly cookie
      // Store only non-sensitive user data
      if (data.user) {
        sessionStorage.setItem('user', JSON.stringify(data.user));
        sessionStorage.setItem('userType', data.user.userType);
      }

      return data;
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseURL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage
      sessionStorage.clear();
      // localStorage is no longer used for auth tokens
    }
  }

  /**
   * Validate current session
   */
  async validateSession(): Promise<SessionResponse | null> {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/session`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      // Update stored user data
      if (data.user) {
        sessionStorage.setItem('user', JSON.stringify(data.user));
        sessionStorage.setItem('userType', data.user.userType);
      }

      return data;
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  /**
   * Check if user appears to be logged in (client-side check only)
   */
  isAuthenticated(): boolean {
    // This is just a client-side hint - real auth is cookie-based
    return !!sessionStorage.getItem('user');
  }

  /**
   * Get stored user data (client-side only)
   */
  getUser(): any {
    const userStr = sessionStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * Invalidate all sessions (for security)
   */
  async invalidateAllSessions(): Promise<void> {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/sessions/invalidate-all`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to invalidate sessions');
      }

      sessionStorage.clear();
    } catch (error) {
      console.error('Invalidate sessions error:', error);
      throw error;
    }
  }

  /**
   * Get active sessions count
   */
  async getActiveSessionsCount(): Promise<number> {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/sessions/count`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return 0;
      }

      const data = await response.json();
      return data.activeSessions || 0;
    } catch (error) {
      console.error('Get sessions count error:', error);
      return 0;
    }
  }

  /**
   * Configure axios/fetch to include credentials
   */
  configureHttpClient(client: any): void {
    // For axios
    if (client.defaults) {
      client.defaults.withCredentials = true;
      // Remove Authorization header - we're using cookies now
      delete client.defaults.headers.common['Authorization'];
    }
    // For fetch - always include credentials: 'include'
  }
}

export const secureAuthService = new SecureAuthService();

/**
 * Axios interceptor for secure sessions
 */
export function setupAxiosForSecureSessions(axios: any) {
  // Request interceptor
  axios.interceptors.request.use(
    (config: any) => {
      // Always include credentials for cookie-based auth
      config.withCredentials = true;
      // Remove any Authorization header - we use cookies now
      delete config.headers['Authorization'];
      return config;
    },
    (error: any) => Promise.reject(error)
  );

  // Response interceptor
  axios.interceptors.response.use(
    (response: any) => response,
    async (error: any) => {
      if (error.response?.status === 401) {
        // Session expired or invalid
        sessionStorage.clear();
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );
}

/**
 * Fetch wrapper with secure session support
 */
export async function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include', // Always include cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}