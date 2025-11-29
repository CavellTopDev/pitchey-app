/**
 * Notification Rate Limiting Service
 * Prevents notification fatigue and spam
 */

import { redis } from "../lib/redis";

export interface RateLimitConfig {
  windowMs: number;           // Time window in milliseconds
  maxRequests: number;         // Max requests per window
  skipSuccessfulRequests?: boolean; // Only count failed requests
  skipFailedRequests?: boolean;     // Only count successful requests
  keyGenerator?: (userId: string, channel?: string) => string;
  message?: string;            // Custom error message
}

// Default rate limits per channel
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  email: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 10,            // 10 emails per hour
    message: "Email rate limit exceeded. Please wait before sending more emails."
  },
  push: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 20,            // 20 push notifications per hour
    message: "Push notification rate limit exceeded."
  },
  sms: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 5,             // 5 SMS per day
    message: "SMS rate limit exceeded. Maximum 5 messages per day."
  },
  inApp: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 50,            // 50 in-app notifications per hour
    message: "In-app notification rate limit exceeded."
  },
  webhook: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 10,            // 10 webhook calls per minute
    message: "Webhook rate limit exceeded."
  },
  global: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 100,           // 100 total notifications per hour
    message: "Global notification rate limit exceeded."
  }
};

// User-specific rate limits based on subscription tier
const TIER_LIMITS: Record<string, Partial<typeof DEFAULT_LIMITS>> = {
  free: {
    email: { windowMs: 60 * 60 * 1000, maxRequests: 5 },
    push: { windowMs: 60 * 60 * 1000, maxRequests: 10 },
    sms: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 1 },
    global: { windowMs: 60 * 60 * 1000, maxRequests: 20 }
  },
  basic: {
    email: { windowMs: 60 * 60 * 1000, maxRequests: 10 },
    push: { windowMs: 60 * 60 * 1000, maxRequests: 20 },
    sms: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 5 },
    global: { windowMs: 60 * 60 * 1000, maxRequests: 50 }
  },
  premium: {
    email: { windowMs: 60 * 60 * 1000, maxRequests: 25 },
    push: { windowMs: 60 * 60 * 1000, maxRequests: 50 },
    sms: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 10 },
    global: { windowMs: 60 * 60 * 1000, maxRequests: 150 }
  },
  enterprise: {
    email: { windowMs: 60 * 60 * 1000, maxRequests: 100 },
    push: { windowMs: 60 * 60 * 1000, maxRequests: 200 },
    sms: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 50 },
    global: { windowMs: 60 * 60 * 1000, maxRequests: 1000 }
  }
};

// Template-specific rate limits
const TEMPLATE_LIMITS: Record<string, RateLimitConfig> = {
  password_reset: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 3,             // 3 password reset emails per hour
    message: "Too many password reset requests. Please wait before trying again."
  },
  verification_code: {
    windowMs: 5 * 60 * 1000,    // 5 minutes
    maxRequests: 3,             // 3 verification codes per 5 minutes
    message: "Too many verification requests. Please wait 5 minutes."
  },
  marketing: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 1,             // 1 marketing email per day
    message: "Marketing email already sent today."
  }
};

export class NotificationRateLimitService {
  private static instance: NotificationRateLimitService;

  private constructor() {}

  public static getInstance(): NotificationRateLimitService {
    if (!NotificationRateLimitService.instance) {
      NotificationRateLimitService.instance = new NotificationRateLimitService();
    }
    return NotificationRateLimitService.instance;
  }

  /**
   * Check if a notification can be sent based on rate limits
   */
  async checkRateLimit(
    userId: string,
    channel: string,
    template?: string,
    userTier: string = 'basic'
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date; message?: string }> {
    // Get appropriate limits
    const channelLimits = this.getLimits(channel, userTier);
    const globalLimits = this.getLimits('global', userTier);
    const templateLimits = template ? TEMPLATE_LIMITS[template] : null;

    // Check channel-specific limit
    const channelCheck = await this.checkLimit(
      `ratelimit:${channel}:${userId}`,
      channelLimits
    );
    
    if (!channelCheck.allowed) {
      return channelCheck;
    }

    // Check global limit
    const globalCheck = await this.checkLimit(
      `ratelimit:global:${userId}`,
      globalLimits
    );
    
    if (!globalCheck.allowed) {
      return globalCheck;
    }

    // Check template-specific limit if applicable
    if (templateLimits) {
      const templateCheck = await this.checkLimit(
        `ratelimit:template:${template}:${userId}`,
        templateLimits
      );
      
      if (!templateCheck.allowed) {
        return templateCheck;
      }
    }

    // All checks passed, increment counters
    await this.incrementCounter(`ratelimit:${channel}:${userId}`, channelLimits.windowMs);
    await this.incrementCounter(`ratelimit:global:${userId}`, globalLimits.windowMs);
    
    if (templateLimits) {
      await this.incrementCounter(
        `ratelimit:template:${template}:${userId}`,
        templateLimits.windowMs
      );
    }

    return {
      allowed: true,
      remaining: Math.min(channelCheck.remaining - 1, globalCheck.remaining - 1),
      resetAt: new Date(Date.now() + channelLimits.windowMs)
    };
  }

  /**
   * Get rate limit status without incrementing
   */
  async getRateLimitStatus(
    userId: string,
    channel?: string,
    userTier: string = 'basic'
  ): Promise<Record<string, { count: number; limit: number; remaining: number; resetAt: Date }>> {
    const status: Record<string, any> = {};
    
    // Check specific channel if provided
    if (channel) {
      const limits = this.getLimits(channel, userTier);
      const count = await this.getCounter(`ratelimit:${channel}:${userId}`);
      status[channel] = {
        count,
        limit: limits.maxRequests,
        remaining: Math.max(0, limits.maxRequests - count),
        resetAt: new Date(Date.now() + limits.windowMs)
      };
    } else {
      // Check all channels
      for (const ch of ['email', 'push', 'sms', 'inApp', 'webhook']) {
        const limits = this.getLimits(ch, userTier);
        const count = await this.getCounter(`ratelimit:${ch}:${userId}`);
        status[ch] = {
          count,
          limit: limits.maxRequests,
          remaining: Math.max(0, limits.maxRequests - count),
          resetAt: new Date(Date.now() + limits.windowMs)
        };
      }
    }

    // Always include global status
    const globalLimits = this.getLimits('global', userTier);
    const globalCount = await this.getCounter(`ratelimit:global:${userId}`);
    status.global = {
      count: globalCount,
      limit: globalLimits.maxRequests,
      remaining: Math.max(0, globalLimits.maxRequests - globalCount),
      resetAt: new Date(Date.now() + globalLimits.windowMs)
    };

    return status;
  }

  /**
   * Reset rate limits for a user
   */
  async resetRateLimits(userId: string, channel?: string): Promise<void> {
    if (channel) {
      await redis?.del(`ratelimit:${channel}:${userId}`);
    } else {
      // Reset all channels
      const keys = [
        `ratelimit:email:${userId}`,
        `ratelimit:push:${userId}`,
        `ratelimit:sms:${userId}`,
        `ratelimit:inApp:${userId}`,
        `ratelimit:webhook:${userId}`,
        `ratelimit:global:${userId}`
      ];
      
      for (const key of keys) {
        await redis?.del(key);
      }
    }
  }

  /**
   * Apply burst protection for rapid-fire notifications
   */
  async checkBurstProtection(
    userId: string,
    maxBurst: number = 5,
    burstWindowMs: number = 10000 // 10 seconds
  ): Promise<boolean> {
    const key = `burst:${userId}`;
    const count = await this.getCounter(key);
    
    if (count >= maxBurst) {
      return false; // Burst limit exceeded
    }

    await this.incrementCounter(key, burstWindowMs);
    return true;
  }

  /**
   * Track notification patterns for anomaly detection
   */
  async trackNotificationPattern(
    userId: string,
    channel: string,
    template: string
  ): Promise<void> {
    const hourlyKey = `pattern:hourly:${userId}:${new Date().getHours()}`;
    const dailyKey = `pattern:daily:${userId}:${new Date().getDay()}`;
    const channelKey = `pattern:channel:${userId}:${channel}`;
    
    // Increment pattern counters
    await Promise.all([
      this.incrementCounter(hourlyKey, 60 * 60 * 1000), // 1 hour TTL
      this.incrementCounter(dailyKey, 24 * 60 * 60 * 1000), // 24 hour TTL
      this.incrementCounter(channelKey, 7 * 24 * 60 * 60 * 1000) // 7 day TTL
    ]);

    // Store template usage
    await redis?.zadd(
      `templates:${userId}`,
      Date.now(),
      `${template}:${channel}`
    );
  }

  /**
   * Detect anomalous notification patterns
   */
  async detectAnomalies(userId: string): Promise<{
    isAnomalous: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    
    // Check hourly pattern
    const currentHour = new Date().getHours();
    const hourlyCount = await this.getCounter(`pattern:hourly:${userId}:${currentHour}`);
    const avgHourly = await this.getAverageHourlyCount(userId);
    
    if (hourlyCount > avgHourly * 3) {
      reasons.push(`Unusual activity: ${hourlyCount} notifications this hour (avg: ${avgHourly})`);
    }

    // Check burst activity
    const burstCount = await this.getCounter(`burst:${userId}`);
    if (burstCount > 10) {
      reasons.push(`Burst activity detected: ${burstCount} notifications in 10 seconds`);
    }

    // Check template diversity
    const recentTemplates = await redis?.zrange(
      `templates:${userId}`,
      Date.now() - 60 * 60 * 1000,
      Date.now(),
      'BYSCORE'
    );
    
    if (recentTemplates && recentTemplates.length > 0) {
      const templateCounts = recentTemplates.reduce((acc: Record<string, number>, t: string) => {
        const [template] = t.split(':');
        acc[template] = (acc[template] || 0) + 1;
        return acc;
      }, {});
      
      const dominantTemplate = Object.entries(templateCounts)
        .sort(([, a], [, b]) => b - a)[0];
      
      if (dominantTemplate && dominantTemplate[1] > recentTemplates.length * 0.8) {
        reasons.push(`Repetitive pattern: 80% of recent notifications use template "${dominantTemplate[0]}"`);
      }
    }

    return {
      isAnomalous: reasons.length > 0,
      reasons
    };
  }

  // Private helper methods
  private getLimits(channel: string, userTier: string): RateLimitConfig {
    const tierLimits = TIER_LIMITS[userTier] || TIER_LIMITS.basic;
    const channelTierLimits = tierLimits[channel] || {};
    const defaultLimits = DEFAULT_LIMITS[channel] || DEFAULT_LIMITS.global;
    
    return {
      ...defaultLimits,
      ...channelTierLimits
    };
  }

  private async checkLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date; message?: string }> {
    const count = await this.getCounter(key);
    const remaining = Math.max(0, config.maxRequests - count);
    
    return {
      allowed: count < config.maxRequests,
      remaining,
      resetAt: new Date(Date.now() + config.windowMs),
      message: count >= config.maxRequests ? config.message : undefined
    };
  }

  private async getCounter(key: string): Promise<number> {
    const value = await redis?.get(key);
    return value ? parseInt(value as string, 10) : 0;
  }

  private async incrementCounter(key: string, ttlMs: number): Promise<void> {
    const multi = redis?.multi();
    if (!multi) return;
    
    multi.incr(key);
    multi.pexpire(key, ttlMs);
    await multi.exec();
  }

  private async getAverageHourlyCount(userId: string): Promise<number> {
    let total = 0;
    let count = 0;
    
    for (let i = 0; i < 24; i++) {
      const hourlyCount = await this.getCounter(`pattern:hourly:${userId}:${i}`);
      if (hourlyCount > 0) {
        total += hourlyCount;
        count++;
      }
    }
    
    return count > 0 ? Math.floor(total / count) : 5; // Default average of 5
  }
}

export const notificationRateLimitService = NotificationRateLimitService.getInstance();