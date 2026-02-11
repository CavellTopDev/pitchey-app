/**
 * Session Manager - Prevents excessive session checks and rate limiting
 */

interface SessionCheckResult {
  success: boolean;
  user?: any;
  timestamp: number;
}

class SessionManager {
  private lastCheck: SessionCheckResult | null = null;
  private checkInProgress: Promise<SessionCheckResult> | null = null;
  private readonly MIN_CHECK_INTERVAL = 30000; // 30 seconds minimum between checks
  private readonly CACHE_DURATION = 60000; // Cache for 1 minute
  
  /**
   * Check if we should perform a new session check
   */
  private shouldCheckSession(): boolean {
    if (!this.lastCheck) return true;
    
    const now = Date.now();
    const timeSinceLastCheck = now - this.lastCheck.timestamp;
    
    // Don't check if we checked recently
    if (timeSinceLastCheck < this.MIN_CHECK_INTERVAL) {
      return false;
    }
    
    // Use cached result if it's still fresh
    if (timeSinceLastCheck < this.CACHE_DURATION && this.lastCheck.success) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get cached session if available and fresh
   */
  getCachedSession(): SessionCheckResult | null {
    if (!this.lastCheck) return null;
    
    const now = Date.now();
    const age = now - this.lastCheck.timestamp;
    
    if (age < this.CACHE_DURATION) {
      return this.lastCheck;
    }
    
    return null;
  }
  
  /**
   * Perform session check with rate limiting
   */
  async checkSession(checkFn: () => Promise<any>): Promise<SessionCheckResult> {
    // Return cached result if fresh
    const cached = this.getCachedSession();
    if (cached) {
      return cached;
    }
    
    // Return in-progress check if one exists
    if (this.checkInProgress) {
      return this.checkInProgress;
    }
    
    // Check if we should perform a new check
    if (!this.shouldCheckSession()) {
      if (this.lastCheck) {
        return this.lastCheck;
      }
      // No last check and can't check now - return failure
      return { success: false, timestamp: Date.now() };
    }
    
    // Perform new check
    this.checkInProgress = this.performCheck(checkFn);
    
    try {
      const result = await this.checkInProgress;
      this.lastCheck = result;
      return result;
    } finally {
      this.checkInProgress = null;
    }
  }
  
  private async performCheck(checkFn: () => Promise<any>): Promise<SessionCheckResult> {
    try {
      const user = await checkFn();
      return {
        success: true,
        user,
        timestamp: Date.now()
      };
    } catch (error: any) {
      console.error('[SessionManager] Session check failed:', error.message);
      
      // If it's a rate limit error, use the last known state
      if (error.status === 429 && this.lastCheck) {
        return this.lastCheck;
      }
      
      return {
        success: false,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Clear cached session
   */
  clearCache() {
    this.lastCheck = null;
    this.checkInProgress = null;
  }

  /**
   * Reset for new page load — ensures the first checkSession() hits the backend
   * instead of returning a stale in-memory cache from a previous page
   */
  resetForNewPageLoad() {
    this.lastCheck = null;
  }
  
  /**
   * Update cached session without making a request
   */
  updateCache(user: any) {
    this.lastCheck = {
      success: true,
      user,
      timestamp: Date.now()
    };
  }
}

export const sessionManager = new SessionManager();