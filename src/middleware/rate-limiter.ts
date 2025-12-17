/**
 * Advanced Rate Limiting System for Cloudflare Workers
 * Implements multiple strategies: sliding window, token bucket, and adaptive limits
 */

import { Context } from 'hono';
import { Redis } from '@upstash/redis/cloudflare';

// Rate limit configurations by endpoint category
export const RATE_LIMIT_CONFIGS = {
  // Authentication endpoints - strict limits
  auth: {
    login: { requests: 5, window: 900, blockDuration: 3600 }, // 5 attempts per 15 min
    register: { requests: 3, window: 3600, blockDuration: 7200 }, // 3 per hour
    passwordReset: { requests: 3, window: 3600, blockDuration: 3600 }, // 3 per hour
  },
  
  // API endpoints - standard limits
  api: {
    default: { requests: 100, window: 60 }, // 100 per minute
    search: { requests: 30, window: 60 }, // 30 searches per minute
    heavy: { requests: 10, window: 60 }, // 10 heavy operations per minute
  },
  
  // Public endpoints - relaxed limits
  public: {
    default: { requests: 300, window: 60 }, // 300 per minute
    assets: { requests: 1000, window: 60 }, // 1000 per minute for assets
  },
  
  // WebSocket connections
  websocket: {
    connections: { requests: 5, window: 60 }, // 5 new connections per minute
    messages: { requests: 100, window: 60 }, // 100 messages per minute
  }
};

// Rate limiter strategies
export enum RateLimitStrategy {
  SLIDING_WINDOW = 'sliding_window',
  TOKEN_BUCKET = 'token_bucket',
  ADAPTIVE = 'adaptive',
  FIXED_WINDOW = 'fixed_window'
}

export class RateLimiter {
  private redis: Redis;
  private strategy: RateLimitStrategy;
  
  constructor(redis: Redis, strategy: RateLimitStrategy = RateLimitStrategy.SLIDING_WINDOW) {
    this.redis = redis;
    this.strategy = strategy;
  }
}

// Export middleware presets
export const rateLimitPresets = {
  strict: { requests: 10, window: 60, blockDuration: 3600 },
  standard: { requests: 100, window: 60, blockDuration: 600 },
  relaxed: { requests: 1000, window: 60 },
  auth: { requests: 5, window: 900, blockDuration: 3600 },
  api: { requests: 100, window: 60 },
  search: { requests: 30, window: 60 },
  export: { requests: 5, window: 3600, blockDuration: 7200 }
};
