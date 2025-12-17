/**
 * Feature Flag Service
 * Provides dynamic feature toggling without redeployment
 * Supports multiple strategies: percentage rollout, user targeting, A/B testing
 */

import { Redis } from '@upstash/redis/cloudflare';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  strategy: 'boolean' | 'percentage' | 'user_list' | 'ab_test' | 'gradual_rollout';
  value?: any;
  percentage?: number;
  userIds?: string[];
  segments?: string[];
  conditions?: FlagCondition[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface FlagCondition {
  attribute: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
}

export interface FlagEvaluation {
  enabled: boolean;
  variant?: string;
  reason: string;
  metadata?: Record<string, any>;
}

export interface UserContext {
  userId: string;
  email?: string;
  role?: string;
  subscription?: string;
  attributes?: Record<string, any>;
  segment?: string;
}

export class FeatureFlagService {
  private redis?: Redis;
  private cache: Map<string, { flag: FeatureFlag; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute cache
  private readonly FLAG_PREFIX = 'feature_flag:';
  private readonly USER_FLAGS_PREFIX = 'user_flags:';
  
  constructor(redis?: Redis) {
    this.redis = redis;
  }

  /**
   * Initialize default feature flags
   */
  async initialize(): Promise<void> {
    const defaultFlags: FeatureFlag[] = [
      {
        key: 'new_dashboard_ui',
        enabled: false,
        description: 'New dashboard UI with enhanced analytics',
        strategy: 'gradual_rollout',
        percentage: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      },
      {
        key: 'ai_pitch_analysis',
        enabled: true,
        description: 'AI-powered pitch analysis and recommendations',
        strategy: 'user_list',
        userIds: ['premium_users'],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      },
      {
        key: 'advanced_search',
        enabled: true,
        description: 'Advanced search with filters and ML ranking',
        strategy: 'percentage',
        percentage: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      },
      {
        key: 'websocket_notifications',
        enabled: true,
        description: 'Real-time WebSocket notifications',
        strategy: 'boolean',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      },
      {
        key: 'export_analytics',
        enabled: false,
        description: 'Export analytics and reports feature',
        strategy: 'ab_test',
        segments: ['group_a'],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      },
      {
        key: 'maintenance_mode',
        enabled: false,
        description: 'System maintenance mode',
        strategy: 'boolean',
        metadata: {
          message: 'System is under maintenance. Please try again later.',
          estimatedTime: '30 minutes'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      }
    ];

    // Store default flags if they don't exist
    for (const flag of defaultFlags) {
      const exists = await this.getFlag(flag.key);
      if (!exists) {
        await this.createFlag(flag);
      }
    }
  }

  /**
   * Evaluate if a feature is enabled for a user
   */
  async isEnabled(
    flagKey: string,
    userContext?: UserContext
  ): Promise<boolean> {
    const evaluation = await this.evaluate(flagKey, userContext);
    return evaluation.enabled;
  }

  /**
   * Comprehensive feature flag evaluation
   */
  async evaluate(
    flagKey: string,
    userContext?: UserContext
  ): Promise<FlagEvaluation> {
    const flag = await this.getFlag(flagKey);
    
    if (!flag) {
      return {
        enabled: false,
        reason: 'Flag not found'
      };
    }

    if (!flag.enabled) {
      return {
        enabled: false,
        reason: 'Flag disabled'
      };
    }

    switch (flag.strategy) {
      case 'boolean':
        return {
          enabled: flag.enabled,
          reason: 'Boolean flag'
        };

      case 'percentage':
        if (!userContext?.userId) {
          return {
            enabled: false,
            reason: 'No user context for percentage evaluation'
          };
        }
        const enabled = this.evaluatePercentage(userContext.userId, flag.percentage || 0);
        return {
          enabled,
          reason: `Percentage rollout (${flag.percentage}%)`
        };

      case 'user_list':
        if (!userContext?.userId) {
          return {
            enabled: false,
            reason: 'No user context for user list evaluation'
          };
        }
        const inList = flag.userIds?.includes(userContext.userId) || false;
        return {
          enabled: inList,
          reason: inList ? 'User in target list' : 'User not in target list'
        };

      case 'ab_test':
        if (!userContext) {
          return {
            enabled: false,
            reason: 'No user context for A/B test'
          };
        }
        const variant = this.getABTestVariant(userContext.userId, flag.segments || []);
        return {
          enabled: variant !== null,
          variant,
          reason: `A/B test variant: ${variant || 'none'}`
        };

      case 'gradual_rollout':
        if (!userContext?.userId) {
          return {
            enabled: false,
            reason: 'No user context for gradual rollout'
          };
        }
        const rolloutEnabled = await this.evaluateGradualRollout(
          flagKey,
          userContext.userId,
          flag.percentage || 0
        );
        return {
          enabled: rolloutEnabled,
          reason: `Gradual rollout (${flag.percentage}%)`
        };

      default:
        return {
          enabled: false,
          reason: 'Unknown strategy'
        };
    }
  }

  /**
   * Evaluate percentage-based rollout
   */
  private evaluatePercentage(userId: string, percentage: number): boolean {
    // Use consistent hashing for deterministic results
    const hash = this.hashUserId(userId);
    const bucket = hash % 100;
    return bucket < percentage;
  }

  /**
   * Get A/B test variant for user
   */
  private getABTestVariant(userId: string, variants: string[]): string | null {
    if (variants.length === 0) return null;
    
    const hash = this.hashUserId(userId);
    const index = hash % variants.length;
    return variants[index];
  }

  /**
   * Evaluate gradual rollout with persistence
   */
  private async evaluateGradualRollout(
    flagKey: string,
    userId: string,
    percentage: number
  ): Promise<boolean> {
    // Check if user was already included in rollout
    const userFlagKey = `${this.USER_FLAGS_PREFIX}${userId}:${flagKey}`;
    
    if (this.redis) {
      const existing = await this.redis.get(userFlagKey);
      if (existing !== null) {
        return existing === 'true';
      }
    }

    // Evaluate for new user
    const enabled = this.evaluatePercentage(userId, percentage);
    
    // Persist decision
    if (this.redis && enabled) {
      await this.redis.setex(userFlagKey, 86400 * 30, 'true'); // 30 days
    }

    return enabled;
  }

  /**
   * Hash user ID for consistent distribution
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get a feature flag
   */
  async getFlag(key: string): Promise<FeatureFlag | null> {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.flag;
    }

    if (!this.redis) {
      return null;
    }

    try {
      const data = await this.redis.get(`${this.FLAG_PREFIX}${key}`);
      if (!data) return null;

      const flag = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Update cache
      this.cache.set(key, { flag, timestamp: Date.now() });
      
      return flag;
    } catch (error) {
      console.error('Error getting feature flag:', error);
      return null;
    }
  }

  /**
   * Create or update a feature flag
   */
  async createFlag(flag: FeatureFlag): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.set(
        `${this.FLAG_PREFIX}${flag.key}`,
        JSON.stringify(flag)
      );

      // Invalidate cache
      this.cache.delete(flag.key);

      // Broadcast flag update via WebSocket
      await this.broadcastFlagUpdate(flag);
    } catch (error) {
      console.error('Error creating feature flag:', error);
    }
  }

  /**
   * Update a feature flag
   */
  async updateFlag(
    key: string,
    updates: Partial<FeatureFlag>
  ): Promise<void> {
    const existingFlag = await this.getFlag(key);
    if (!existingFlag) {
      throw new Error(`Flag ${key} not found`);
    }

    const updatedFlag: FeatureFlag = {
      ...existingFlag,
      ...updates,
      key, // Ensure key doesn't change
      updatedAt: new Date()
    };

    await this.createFlag(updatedFlag);
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(key: string): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.del(`${this.FLAG_PREFIX}${key}`);
      this.cache.delete(key);
      
      // Clean up user-specific flags
      const pattern = `${this.USER_FLAGS_PREFIX}*:${key}`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Error deleting feature flag:', error);
    }
  }

  /**
   * List all feature flags
   */
  async listFlags(): Promise<FeatureFlag[]> {
    if (!this.redis) return [];

    try {
      const keys = await this.redis.keys(`${this.FLAG_PREFIX}*`);
      const flags: FeatureFlag[] = [];

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const flag = typeof data === 'string' ? JSON.parse(data) : data;
          flags.push(flag);
        }
      }

      return flags;
    } catch (error) {
      console.error('Error listing feature flags:', error);
      return [];
    }
  }

  /**
   * Get flags for a specific user
   */
  async getUserFlags(userContext: UserContext): Promise<Record<string, FlagEvaluation>> {
    const flags = await this.listFlags();
    const evaluations: Record<string, FlagEvaluation> = {};

    for (const flag of flags) {
      evaluations[flag.key] = await this.evaluate(flag.key, userContext);
    }

    return evaluations;
  }

  /**
   * Broadcast flag update via WebSocket
   */
  private async broadcastFlagUpdate(flag: FeatureFlag): Promise<void> {
    // This would integrate with your WebSocket service
    // For now, just log the update
    console.log('Broadcasting flag update:', flag.key);
  }

  /**
   * Export flag configuration
   */
  async exportFlags(): Promise<string> {
    const flags = await this.listFlags();
    return JSON.stringify(flags, null, 2);
  }

  /**
   * Import flag configuration
   */
  async importFlags(jsonData: string): Promise<void> {
    const flags: FeatureFlag[] = JSON.parse(jsonData);
    
    for (const flag of flags) {
      await this.createFlag(flag);
    }
  }

  /**
   * Get flag usage analytics
   */
  async getFlagAnalytics(flagKey: string): Promise<any> {
    if (!this.redis) return null;

    const analyticsKey = `flag_analytics:${flagKey}`;
    const data = await this.redis.get(analyticsKey);
    
    return data ? JSON.parse(data as string) : null;
  }

  /**
   * Track flag evaluation for analytics
   */
  async trackEvaluation(
    flagKey: string,
    userContext: UserContext,
    result: FlagEvaluation
  ): Promise<void> {
    if (!this.redis) return;

    const analyticsKey = `flag_analytics:${flagKey}:${new Date().toISOString().split('T')[0]}`;
    
    await this.redis.hincrby(
      analyticsKey,
      result.enabled ? 'enabled' : 'disabled',
      1
    );
    
    // Set expiry for 30 days
    await this.redis.expire(analyticsKey, 86400 * 30);
  }
}

// Singleton instance
let featureFlagService: FeatureFlagService | null = null;

export function getFeatureFlagService(redis?: Redis): FeatureFlagService {
  if (!featureFlagService) {
    featureFlagService = new FeatureFlagService(redis);
  }
  return featureFlagService;
}