/**
 * Session cache to prevent excessive API calls and rate limiting
 */

interface CachedSession {
  user: any | null;
  timestamp: number;
}

const SESSION_CACHE_KEY = 'better-auth-session-cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const sessionCache = {
  get(): CachedSession | null {
    try {
      // Guard: if session cookie is gone, cache is invalid
      if (!document.cookie.includes('pitchey-session')) {
        this.clear();
        return null;
      }

      const cached = localStorage.getItem(SESSION_CACHE_KEY);
      if (!cached) return null;
      
      const session: CachedSession = JSON.parse(cached);
      const now = Date.now();
      
      // Check if cache is still valid
      if (now - session.timestamp > CACHE_DURATION) {
        localStorage.removeItem(SESSION_CACHE_KEY);
        return null;
      }
      
      return session;
    } catch {
      return null;
    }
  },

  set(user: any | null): void {
    try {
      const session: CachedSession = {
        user,
        timestamp: Date.now()
      };
      localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session));
    } catch {
      // Ignore storage errors
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(SESSION_CACHE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
};