/**
 * WebSocket Rate Limiter
 * Implements sophisticated rate limiting for WebSocket connections
 * Supports per-user, per-connection, and per-message-type limits
 */

import { WSSession, WSMessageType } from "../services/websocket.service.ts";
import { redisService } from "../services/redis.service.ts";
import { captureException } from "../services/logging.service.ts";

// Rate limit configuration per message type
interface RateLimitRule {
  maxMessages: number;
  windowMs: number;
  burstLimit?: number; // Allow burst of messages
  cooldownMs?: number; // Cooldown period after burst
}

// Rate limit state for a session
interface RateLimitState {
  tokens: number;
  lastRefill: number;
  messageCount: number;
  windowStart: number;
  burstUsed: number;
  cooldownUntil?: number;
  violations: number;
  blocked: boolean;
  blockUntil?: number;
}

// Default rate limit rules
const DEFAULT_RATE_LIMITS: Record<WSMessageType, RateLimitRule> = {
  // High frequency messages
  [WSMessageType.PING]: { maxMessages: 60, windowMs: 60000 }, // 1 per second
  [WSMessageType.TYPING_START]: { maxMessages: 10, windowMs: 60000 }, // 10 per minute
  [WSMessageType.TYPING_STOP]: { maxMessages: 10, windowMs: 60000 }, // 10 per minute
  [WSMessageType.PRESENCE_UPDATE]: { maxMessages: 5, windowMs: 60000 }, // 5 per minute
  
  // Medium frequency messages
  [WSMessageType.SEND_MESSAGE]: { 
    maxMessages: 30, 
    windowMs: 60000, 
    burstLimit: 5, 
    cooldownMs: 10000 
  }, // 30 per minute with burst of 5
  [WSMessageType.MESSAGE_READ]: { maxMessages: 60, windowMs: 60000 }, // 1 per second
  [WSMessageType.NOTIFICATION_READ]: { maxMessages: 30, windowMs: 60000 }, // 30 per minute
  
  // Low frequency messages
  [WSMessageType.DRAFT_SYNC]: { 
    maxMessages: 10, 
    windowMs: 60000, 
    burstLimit: 3, 
    cooldownMs: 5000 
  }, // 10 per minute with burst of 3
  
  // System messages (no limits for server-sent)
  [WSMessageType.PONG]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.CONNECTED]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.DISCONNECTED]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.ERROR]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.NOTIFICATION]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.DASHBOARD_UPDATE]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.METRICS_UPDATE]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.DRAFT_UPDATE]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.USER_ONLINE]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.USER_OFFLINE]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.USER_AWAY]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.UPLOAD_PROGRESS]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.UPLOAD_COMPLETE]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.UPLOAD_ERROR]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.PITCH_VIEW_UPDATE]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.PITCH_STATS_UPDATE]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.USER_TYPING]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.ACTIVITY_UPDATE]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.NEW_MESSAGE]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.SYSTEM_ANNOUNCEMENT]: { maxMessages: Infinity, windowMs: 0 },
  [WSMessageType.MAINTENANCE_MODE]: { maxMessages: Infinity, windowMs: 0 }
};

// Violation thresholds and penalties
const VIOLATION_THRESHOLDS = {
  WARNING: 3,
  TEMPORARY_BLOCK: 5,
  EXTENDED_BLOCK: 10
};

const BLOCK_DURATIONS = {
  TEMPORARY: 5 * 60 * 1000, // 5 minutes
  EXTENDED: 30 * 60 * 1000, // 30 minutes
  PERMANENT: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * WebSocket Rate Limiter Class
 */
export class WebSocketRateLimiter {
  private sessionStates = new Map<string, Map<WSMessageType, RateLimitState>>();
  private globalRateLimits: Record<WSMessageType, RateLimitRule>;
  private cleanupInterval: number;

  constructor(customRateLimits?: Partial<Record<WSMessageType, RateLimitRule>>) {
    this.globalRateLimits = { ...DEFAULT_RATE_LIMITS, ...customRateLimits };
    
    // Cleanup expired state every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredStates();
    }, 5 * 60 * 1000);
    
    console.log("[WebSocket Rate Limiter] Initialized with", Object.keys(this.globalRateLimits).length, "rules");
  }

  /**
   * Check if message should be rate limited
   */
  async checkRateLimit(session: WSSession, messageType: WSMessageType): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
    remainingTokens?: number;
  }> {
    try {
      // Get rate limit rule for message type
      const rule = this.globalRateLimits[messageType];
      if (!rule || rule.maxMessages === Infinity) {
        return { allowed: true };
      }

      // Get or create rate limit state for this session and message type
      let sessionStates = this.sessionStates.get(session.id);
      if (!sessionStates) {
        sessionStates = new Map();
        this.sessionStates.set(session.id, sessionStates);
      }

      let state = sessionStates.get(messageType);
      if (!state) {
        state = this.createInitialState(rule);
        sessionStates.set(messageType, state);
      }

      // Check if session is blocked
      if (state.blocked && state.blockUntil && Date.now() < state.blockUntil) {
        const retryAfter = Math.ceil((state.blockUntil - Date.now()) / 1000);
        return {
          allowed: false,
          reason: "Session temporarily blocked due to rate limit violations",
          retryAfter
        };
      }

      // Check cooldown period
      if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
        const retryAfter = Math.ceil((state.cooldownUntil - Date.now()) / 1000);
        return {
          allowed: false,
          reason: "In cooldown period after burst usage",
          retryAfter
        };
      }

      const now = Date.now();
      
      // Reset window if expired
      if (now - state.windowStart >= rule.windowMs) {
        state.messageCount = 0;
        state.windowStart = now;
        state.burstUsed = 0;
      }

      // Refill tokens (token bucket algorithm)
      await this.refillTokens(state, rule, now);

      // Check token bucket
      if (state.tokens <= 0) {
        // Check if burst is available
        if (rule.burstLimit && state.burstUsed < rule.burstLimit) {
          state.burstUsed++;
          state.tokens = 1; // Allow this message
          
          // Set cooldown after burst usage
          if (rule.cooldownMs && state.burstUsed >= rule.burstLimit) {
            state.cooldownUntil = now + rule.cooldownMs;
          }
        } else {
          // Rate limit exceeded
          await this.handleViolation(session, messageType, state, rule);
          return {
            allowed: false,
            reason: "Rate limit exceeded",
            retryAfter: Math.ceil((state.windowStart + rule.windowMs - now) / 1000)
          };
        }
      }

      // Consume token
      state.tokens--;
      state.messageCount++;
      
      // Store state in Redis for distributed rate limiting
      await this.persistState(session.id, messageType, state);

      return {
        allowed: true,
        remainingTokens: state.tokens
      };

    } catch (error) {
      console.error("[WebSocket Rate Limiter] Error checking rate limit:", error);
      captureException(error, { service: 'WebSocketRateLimiter' });
      // Allow message in case of error to avoid blocking legitimate users
      return { allowed: true };
    }
  }

  /**
   * Create initial rate limit state
   */
  private createInitialState(rule: RateLimitRule): RateLimitState {
    const now = Date.now();
    return {
      tokens: rule.maxMessages,
      lastRefill: now,
      messageCount: 0,
      windowStart: now,
      burstUsed: 0,
      violations: 0,
      blocked: false
    };
  }

  /**
   * Refill tokens based on elapsed time
   */
  private async refillTokens(state: RateLimitState, rule: RateLimitRule, now: number): Promise<void> {
    const timeSinceLastRefill = now - state.lastRefill;
    
    if (timeSinceLastRefill >= 1000) { // Refill every second
      const refillRate = rule.maxMessages / (rule.windowMs / 1000);
      const tokensToAdd = Math.floor(timeSinceLastRefill / 1000) * refillRate;
      
      state.tokens = Math.min(rule.maxMessages, state.tokens + tokensToAdd);
      state.lastRefill = now;
    }
  }

  /**
   * Handle rate limit violation
   */
  private async handleViolation(
    session: WSSession, 
    messageType: WSMessageType, 
    state: RateLimitState, 
    rule: RateLimitRule
  ): Promise<void> {
    state.violations++;
    
    console.warn(
      `[WebSocket Rate Limiter] Violation for user ${session.userId}, ` +
      `session ${session.id}, message type ${messageType} (violation #${state.violations})`
    );

    // Determine penalty based on violation count
    if (state.violations >= VIOLATION_THRESHOLDS.EXTENDED_BLOCK) {
      state.blocked = true;
      state.blockUntil = Date.now() + BLOCK_DURATIONS.EXTENDED;
      
      console.error(
        `[WebSocket Rate Limiter] Extended block applied to user ${session.userId} ` +
        `for ${BLOCK_DURATIONS.EXTENDED / 1000} seconds`
      );
      
    } else if (state.violations >= VIOLATION_THRESHOLDS.TEMPORARY_BLOCK) {
      state.blocked = true;
      state.blockUntil = Date.now() + BLOCK_DURATIONS.TEMPORARY;
      
      console.warn(
        `[WebSocket Rate Limiter] Temporary block applied to user ${session.userId} ` +
        `for ${BLOCK_DURATIONS.TEMPORARY / 1000} seconds`
      );
    }

    // Track violation in analytics
    await this.trackViolation(session, messageType, state.violations);
  }

  /**
   * Track rate limit violation for analytics
   */
  private async trackViolation(session: WSSession, messageType: WSMessageType, violationCount: number): Promise<void> {
    try {
      // Store violation in Redis for monitoring
      const violationKey = `pitchey:rate_limit_violations:${session.userId}`;
      const violationData = {
        userId: session.userId,
        sessionId: session.id,
        messageType,
        violationCount,
        timestamp: Date.now(),
        userType: session.userType,
        clientInfo: session.clientInfo
      };

      await redisService.set(violationKey, violationData, 3600); // 1 hour TTL

      // Log to Sentry for monitoring
      sentryService.addBreadcrumb({
        category: "websocket.rate_limit",
        message: `Rate limit violation`,
        level: "warning",
        data: {
          userId: session.userId,
          messageType,
          violationCount
        }
      });

    } catch (error) {
      console.error("[WebSocket Rate Limiter] Failed to track violation:", error);
    }
  }

  /**
   * Persist rate limit state to Redis for distributed limiting
   */
  private async persistState(sessionId: string, messageType: WSMessageType, state: RateLimitState): Promise<void> {
    if (!redisService.isEnabled()) return;

    try {
      const stateKey = `pitchey:rate_limit:${sessionId}:${messageType}`;
      await redisService.set(stateKey, state, 300); // 5 minutes TTL
    } catch (error) {
      console.error("[WebSocket Rate Limiter] Failed to persist state:", error);
    }
  }

  /**
   * Load rate limit state from Redis
   */
  private async loadState(sessionId: string, messageType: WSMessageType): Promise<RateLimitState | null> {
    if (!redisService.isEnabled()) return null;

    try {
      const stateKey = `pitchey:rate_limit:${sessionId}:${messageType}`;
      return await redisService.get(stateKey);
    } catch (error) {
      console.error("[WebSocket Rate Limiter] Failed to load state:", error);
      return null;
    }
  }

  /**
   * Reset rate limits for a session
   */
  async resetSessionLimits(sessionId: string): Promise<void> {
    this.sessionStates.delete(sessionId);
    
    if (redisService.isEnabled()) {
      try {
        await redisService.delPattern(`pitchey:rate_limit:${sessionId}:*`);
      } catch (error) {
        console.error("[WebSocket Rate Limiter] Failed to reset session limits:", error);
      }
    }
  }

  /**
   * Get rate limit status for a session
   */
  getRateLimitStatus(sessionId: string): Record<WSMessageType, Partial<RateLimitState>> {
    const sessionStates = this.sessionStates.get(sessionId);
    if (!sessionStates) return {};

    const status: Record<string, any> = {};
    for (const [messageType, state] of sessionStates.entries()) {
      status[messageType] = {
        tokens: state.tokens,
        messageCount: state.messageCount,
        violations: state.violations,
        blocked: state.blocked,
        cooldownUntil: state.cooldownUntil,
        blockUntil: state.blockUntil
      };
    }

    return status as Record<WSMessageType, Partial<RateLimitState>>;
  }

  /**
   * Update rate limit rules
   */
  updateRateLimitRules(updates: Partial<Record<WSMessageType, RateLimitRule>>): void {
    this.globalRateLimits = { ...this.globalRateLimits, ...updates };
    console.log("[WebSocket Rate Limiter] Updated rate limit rules");
  }

  /**
   * Clean up expired states
   */
  private cleanupExpiredStates(): void {
    const now = Date.now();
    let cleanedSessions = 0;
    let cleanedStates = 0;

    for (const [sessionId, sessionStates] of this.sessionStates.entries()) {
      const statesToDelete: WSMessageType[] = [];

      for (const [messageType, state] of sessionStates.entries()) {
        // Remove states that haven't been used for 30 minutes
        if (now - state.lastRefill > 30 * 60 * 1000) {
          statesToDelete.push(messageType);
        }
      }

      // Remove expired states
      for (const messageType of statesToDelete) {
        sessionStates.delete(messageType);
        cleanedStates++;
      }

      // Remove empty session maps
      if (sessionStates.size === 0) {
        this.sessionStates.delete(sessionId);
        cleanedSessions++;
      }
    }

    if (cleanedSessions > 0 || cleanedStates > 0) {
      console.log(
        `[WebSocket Rate Limiter] Cleaned up ${cleanedStates} expired states ` +
        `and ${cleanedSessions} empty sessions`
      );
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSessions: number;
    totalStates: number;
    blockedSessions: number;
    violationsTotal: number;
  } {
    let totalStates = 0;
    let blockedSessions = 0;
    let violationsTotal = 0;

    for (const sessionStates of this.sessionStates.values()) {
      let sessionBlocked = false;
      
      for (const state of sessionStates.values()) {
        totalStates++;
        violationsTotal += state.violations;
        
        if (state.blocked) {
          sessionBlocked = true;
        }
      }
      
      if (sessionBlocked) {
        blockedSessions++;
      }
    }

    return {
      totalSessions: this.sessionStates.size,
      totalStates,
      blockedSessions,
      violationsTotal
    };
  }

  /**
   * Shutdown rate limiter
   */
  shutdown(): void {
    clearInterval(this.cleanupInterval);
    this.sessionStates.clear();
    console.log("[WebSocket Rate Limiter] Shutdown complete");
  }
}

// Export singleton instance
export const webSocketRateLimiter = new WebSocketRateLimiter();
export default webSocketRateLimiter;