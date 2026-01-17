/**
 * Intelligent Notification Engine with Priority Routing and Smart Batching
 * Handles advanced notification logic, frequency controls, and user behavior analysis
 */

import type { DatabaseService } from '../types/worker-types.ts';
import type { NotificationService, NotificationData } from './notification.service.ts';

export interface NotificationRule {
  id: string;
  name: string;
  condition: NotificationCondition;
  action: NotificationAction;
  priority: number;
  isActive: boolean;
}

export interface NotificationCondition {
  type: 'user_behavior' | 'time_based' | 'frequency' | 'content' | 'engagement';
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';
  field: string;
  value: any;
  timeWindow?: number; // minutes
}

export interface NotificationAction {
  type: 'send' | 'delay' | 'batch' | 'upgrade_priority' | 'suppress';
  delayMinutes?: number;
  batchSize?: number;
  newPriority?: 'low' | 'normal' | 'high' | 'urgent'; // Match NotificationInput priority type
  suppressDuration?: number; // minutes
}

export interface UserNotificationProfile {
  userId: string;
  preferredTimes: string[]; // ['09:00', '14:00', '18:00']
  engagementScore: number; // 0-100
  lastActiveAt: Date;
  averageResponseTime: number; // minutes
  frequencyPreference: 'immediate' | 'batched' | 'digest';
  channelPreference: 'email' | 'push' | 'in_app' | 'sms';
  categories: Record<string, {
    engagement: number;
    frequency: number;
    lastSent: Date;
  }>;
}

export interface SmartBatch {
  id: string;
  userId: string;
  category: string;
  notifications: NotificationData[];
  scheduledTime: Date;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  estimatedEngagement: number;
}

export interface NotificationTiming {
  sendTime: Date;
  confidence: number; // 0-1
  reasoning: string;
  estimatedEngagement: number;
}

export class IntelligentNotificationService {
  private rules: NotificationRule[] = [];
  private userProfiles: Map<string, UserNotificationProfile> = new Map();

  constructor(
    private db: DatabaseService,
    private notificationService: NotificationService,
    private redis?: any
  ) {
    this.initializeDefaultRules();
    this.loadUserProfiles();
  }

  /**
   * Process notification with intelligent routing
   */
  async processNotification(data: NotificationData): Promise<{
    action: 'send_immediately' | 'delay' | 'batch' | 'suppress';
    timing?: NotificationTiming;
    batchId?: string;
    reason: string;
  }> {
    try {
      // Get or create user profile (convert userId number to string for profile lookup)
      const userProfile = await this.getUserProfile(String(data.userId));
      
      // Apply notification rules
      const ruleResult = await this.applyRules(data, userProfile);
      if (ruleResult.action !== 'send') {
        return {
          action: ruleResult.action as any,
          reason: ruleResult.reason,
        };
      }

      // Check frequency limits
      const frequencyCheck = await this.checkFrequencyLimits(data, userProfile);
      if (!frequencyCheck.allowed) {
        return {
          action: 'delay',
          timing: frequencyCheck.nextAllowedTime,
          reason: frequencyCheck.reason,
        };
      }

      // Determine optimal timing
      const optimalTiming = await this.calculateOptimalTiming(data, userProfile);
      
      // Check if should batch
      const batchDecision = await this.shouldBatch(data, userProfile, optimalTiming);
      if (batchDecision.shouldBatch) {
        return {
          action: 'batch',
          batchId: batchDecision.batchId,
          timing: optimalTiming,
          reason: batchDecision.reason,
        };
      }

      // Check if should delay for better timing
      const now = new Date();
      if (optimalTiming.sendTime > now && optimalTiming.confidence > 0.7) {
        return {
          action: 'delay',
          timing: optimalTiming,
          reason: `Delaying for optimal engagement time (${optimalTiming.reasoning})`,
        };
      }

      return {
        action: 'send_immediately',
        timing: optimalTiming,
        reason: 'Immediate send - optimal conditions met',
      };
    } catch (error) {
      console.error('Error in intelligent notification processing:', error);
      return {
        action: 'send_immediately',
        reason: 'Fallback to immediate send due to processing error',
      };
    }
  }

  /**
   * Calculate optimal notification timing based on user behavior
   */
  async calculateOptimalTiming(
    data: NotificationData,
    userProfile: UserNotificationProfile
  ): Promise<NotificationTiming> {
    const now = new Date();
    
    // For urgent notifications, send immediately
    if (data.priority === 'urgent') {
      return {
        sendTime: now,
        confidence: 1.0,
        reasoning: 'Urgent priority - immediate delivery required',
        estimatedEngagement: 0.9,
      };
    }

    // Check user's preferred times
    const currentHour = now.getHours();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:00`;
    
    let optimalTime = now;
    let confidence = 0.5;
    let reasoning = 'Default timing';
    let estimatedEngagement = userProfile.engagementScore / 100;

    // Check if current time is in user's preferred times
    if (userProfile.preferredTimes.includes(currentTime)) {
      confidence = 0.8;
      reasoning = 'User preferred time';
      estimatedEngagement *= 1.2;
    } else {
      // Find next preferred time
      const nextPreferredTime = this.getNextPreferredTime(userProfile.preferredTimes, now);
      if (nextPreferredTime && this.isWithinReasonableDelay(nextPreferredTime, now, data.priority)) {
        optimalTime = nextPreferredTime;
        confidence = 0.9;
        reasoning = 'Next user preferred time';
        estimatedEngagement *= 1.3;
      }
    }

    // Adjust based on user activity patterns
    const activityAdjustment = await this.getActivityBasedTiming(userProfile, now);
    if (activityAdjustment.confidence > confidence) {
      optimalTime = activityAdjustment.suggestedTime;
      confidence = activityAdjustment.confidence;
      reasoning = activityAdjustment.reasoning;
      estimatedEngagement = activityAdjustment.estimatedEngagement;
    }

    // Ensure we don't delay too long
    const maxDelay = this.getMaxDelayForPriority(data.priority);
    if (optimalTime.getTime() - now.getTime() > maxDelay) {
      optimalTime = new Date(now.getTime() + maxDelay);
      confidence = 0.6;
      reasoning = 'Delayed to maximum allowed time for priority level';
    }

    return {
      sendTime: optimalTime,
      confidence: Math.min(confidence, 1.0),
      reasoning,
      estimatedEngagement: Math.min(estimatedEngagement, 1.0),
    };
  }

  /**
   * Determine if notifications should be batched
   */
  async shouldBatch(
    data: NotificationData,
    userProfile: UserNotificationProfile,
    timing: NotificationTiming
  ): Promise<{
    shouldBatch: boolean;
    batchId?: string;
    reason: string;
  }> {
    // Never batch urgent or high priority notifications
    if (data.priority === 'urgent' || data.priority === 'high') {
      return {
        shouldBatch: false,
        reason: 'High priority notifications are not batched',
      };
    }

    // Check user's frequency preference
    if (userProfile.frequencyPreference === 'immediate') {
      return {
        shouldBatch: false,
        reason: 'User prefers immediate notifications',
      };
    }

    // Check for existing batch (use default category if not specified)
    const category = data.category || 'system';
    const userIdStr = String(data.userId);
    const existingBatch = await this.findExistingBatch(
      userIdStr,
      category,
      timing.sendTime
    );

    if (existingBatch) {
      return {
        shouldBatch: true,
        batchId: existingBatch.id,
        reason: 'Added to existing batch for better user experience',
      };
    }

    // Check if user has recent notifications in this category
    const recentNotifications = await this.getRecentNotifications(
      userIdStr,
      category,
      60 // last 60 minutes
    );

    if (recentNotifications.length >= 2) {
      // Create new batch
      const batchId = await this.createBatch(userIdStr, category, timing.sendTime);
      return {
        shouldBatch: true,
        batchId,
        reason: 'Batching to reduce notification fatigue',
      };
    }

    return {
      shouldBatch: false,
      reason: 'No batching needed',
    };
  }

  /**
   * Check frequency limits for user and category
   */
  async checkFrequencyLimits(
    data: NotificationData,
    userProfile: UserNotificationProfile
  ): Promise<{
    allowed: boolean;
    reason: string;
    nextAllowedTime?: NotificationTiming;
  }> {
    const category = data.category || 'system';
    const categoryData = userProfile.categories[category];

    if (!categoryData) {
      return { allowed: true, reason: 'No previous notifications in this category' };
    }

    const timeSinceLastSent = Date.now() - categoryData.lastSent.getTime();
    const minInterval = this.getMinIntervalForCategory(category, data.priority);

    if (timeSinceLastSent < minInterval) {
      const nextAllowedTime = new Date(categoryData.lastSent.getTime() + minInterval);
      return {
        allowed: false,
        reason: `Frequency limit exceeded for ${category} category`,
        nextAllowedTime: {
          sendTime: nextAllowedTime,
          confidence: 0.8,
          reasoning: 'Respecting frequency limits',
          estimatedEngagement: userProfile.engagementScore / 100,
        },
      };
    }

    return { allowed: true, reason: 'Frequency limits satisfied' };
  }

  /**
   * Apply intelligent rules to notification
   */
  private async applyRules(
    data: NotificationData,
    userProfile: UserNotificationProfile
  ): Promise<{ action: string; reason: string; newPriority?: string }> {
    for (const rule of this.rules) {
      if (!rule.isActive) continue;

      const conditionMet = await this.evaluateCondition(rule.condition, data, userProfile);
      
      if (conditionMet) {
        switch (rule.action.type) {
          case 'suppress':
            return {
              action: 'suppress',
              reason: `Suppressed by rule: ${rule.name}`,
            };
          case 'upgrade_priority':
            data.priority = rule.action.newPriority!;
            return {
              action: 'send',
              reason: `Priority upgraded by rule: ${rule.name}`,
              newPriority: rule.action.newPriority,
            };
          case 'delay':
            return {
              action: 'delay',
              reason: `Delayed by rule: ${rule.name}`,
            };
        }
      }
    }

    return { action: 'send', reason: 'No rules applied' };
  }

  /**
   * Get or create user notification profile
   */
  private async getUserProfile(userId: string): Promise<UserNotificationProfile> {
    // Check cache first
    if (this.userProfiles.has(userId)) {
      return this.userProfiles.get(userId)!;
    }

    try {
      // Load from database
      const result = await this.db.query(
        `SELECT 
           engagement_score,
           last_active_at,
           average_response_time,
           frequency_preference,
           channel_preference,
           preferred_times,
           category_data
         FROM user_notification_profiles 
         WHERE user_id = $1`,
        [userId]
      );

      let profile: UserNotificationProfile;
      // Raw SQL query returns array directly, not { rows: [...] }
      const rows = Array.isArray(result) ? result : [];

      if (rows.length > 0) {
        const row = rows[0] as any;
        profile = {
          userId,
          preferredTimes: row.preferred_times || ['09:00', '14:00', '18:00'],
          engagementScore: row.engagement_score || 50,
          lastActiveAt: row.last_active_at || new Date(),
          averageResponseTime: row.average_response_time || 120,
          frequencyPreference: row.frequency_preference || 'batched',
          channelPreference: row.channel_preference || 'in_app',
          categories: row.category_data || {},
        };
      } else {
        // Create default profile
        profile = await this.createDefaultProfile(userId);
      }

      // Cache profile
      this.userProfiles.set(userId, profile);
      return profile;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return await this.createDefaultProfile(userId);
    }
  }

  /**
   * Update user engagement based on notification interaction
   */
  async updateEngagement(
    userId: string,
    notificationId: string,
    action: 'opened' | 'clicked' | 'dismissed' | 'ignored'
  ): Promise<void> {
    try {
      const profile = await this.getUserProfile(userId);
      
      // Calculate engagement adjustment
      let adjustment = 0;
      switch (action) {
        case 'clicked':
          adjustment = 5;
          break;
        case 'opened':
          adjustment = 2;
          break;
        case 'dismissed':
          adjustment = -1;
          break;
        case 'ignored':
          adjustment = -3;
          break;
      }

      // Update engagement score (with decay to prevent extreme values)
      profile.engagementScore = Math.max(0, Math.min(100, 
        profile.engagementScore * 0.95 + adjustment
      ));

      // Update profile in database
      await this.saveUserProfile(profile);
      
      // Update cache
      this.userProfiles.set(userId, profile);
    } catch (error) {
      console.error('Error updating engagement:', error);
    }
  }

  /**
   * Process batched notifications
   */
  async processBatches(): Promise<void> {
    try {
      const now = new Date();
      
      // Get batches ready to send
      const readyBatches = await this.getReadyBatches(now);
      
      for (const batch of readyBatches) {
        try {
          await this.sendBatch(batch);
          await this.markBatchAsSent(batch.id);
        } catch (error) {
          console.error(`Error sending batch ${batch.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing batches:', error);
    }
  }

  // Private helper methods

  private initializeDefaultRules(): void {
    this.rules = [
      {
        id: 'suppress_night_time',
        name: 'Suppress non-critical notifications during night hours',
        condition: {
          type: 'time_based',
          operator: 'between',
          field: 'hour',
          value: [22, 7], // 10 PM to 7 AM
        },
        action: {
          type: 'delay',
          delayMinutes: 480, // 8 hours
        },
        priority: 1,
        isActive: true,
      },
      {
        id: 'upgrade_investment_alerts',
        name: 'Upgrade investment alerts for active investors',
        condition: {
          type: 'user_behavior',
          operator: 'equals',
          field: 'user_type',
          value: 'investor',
        },
        action: {
          type: 'upgrade_priority',
          newPriority: 'high',
        },
        priority: 2,
        isActive: true,
      },
      {
        id: 'batch_low_engagement_users',
        name: 'Batch notifications for low engagement users',
        condition: {
          type: 'engagement',
          operator: 'less_than',
          field: 'engagement_score',
          value: 30,
        },
        action: {
          type: 'batch',
          batchSize: 5,
        },
        priority: 3,
        isActive: true,
      },
    ];
  }

  private async evaluateCondition(
    condition: NotificationCondition,
    data: NotificationData,
    userProfile: UserNotificationProfile
  ): Promise<boolean> {
    switch (condition.type) {
      case 'time_based':
        return this.evaluateTimeCondition(condition);
      case 'engagement':
        return this.evaluateEngagementCondition(condition, userProfile);
      case 'frequency':
        return await this.evaluateFrequencyCondition(condition, data, userProfile);
      default:
        return false;
    }
  }

  private evaluateTimeCondition(condition: NotificationCondition): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    
    if (condition.field === 'hour' && condition.operator === 'between') {
      const [start, end] = condition.value;
      if (start > end) {
        // Overnight range (e.g., 22 to 7)
        return currentHour >= start || currentHour <= end;
      } else {
        return currentHour >= start && currentHour <= end;
      }
    }
    
    return false;
  }

  private evaluateEngagementCondition(
    condition: NotificationCondition,
    userProfile: UserNotificationProfile
  ): boolean {
    if (condition.field === 'engagement_score') {
      switch (condition.operator) {
        case 'less_than':
          return userProfile.engagementScore < condition.value;
        case 'greater_than':
          return userProfile.engagementScore > condition.value;
        default:
          return false;
      }
    }
    return false;
  }

  private async evaluateFrequencyCondition(
    condition: NotificationCondition,
    data: NotificationData,
    userProfile: UserNotificationProfile
  ): Promise<boolean> {
    // Implementation would check notification frequency
    return false;
  }

  private getNextPreferredTime(preferredTimes: string[], now: Date): Date | null {
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    for (const timeStr of preferredTimes) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const preferredTime = hours * 60 + minutes;
      
      if (preferredTime > currentTime) {
        const nextTime = new Date(now);
        nextTime.setHours(hours, minutes, 0, 0);
        return nextTime;
      }
    }
    
    // If no preferred time today, get first one tomorrow
    if (preferredTimes.length > 0) {
      const [hours, minutes] = preferredTimes[0].split(':').map(Number);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(hours, minutes, 0, 0);
      return tomorrow;
    }
    
    return null;
  }

  private isWithinReasonableDelay(targetTime: Date, now: Date, priority: string): boolean {
    const delay = targetTime.getTime() - now.getTime();
    const maxDelay = this.getMaxDelayForPriority(priority);
    return delay <= maxDelay;
  }

  private getMaxDelayForPriority(priority: string): number {
    switch (priority) {
      case 'critical': return 0; // No delay
      case 'high': return 30 * 60 * 1000; // 30 minutes
      case 'medium': return 4 * 60 * 60 * 1000; // 4 hours
      case 'low': return 24 * 60 * 60 * 1000; // 24 hours
      default: return 4 * 60 * 60 * 1000;
    }
  }

  private async getActivityBasedTiming(
    userProfile: UserNotificationProfile,
    now: Date
  ): Promise<{
    suggestedTime: Date;
    confidence: number;
    reasoning: string;
    estimatedEngagement: number;
  }> {
    // This would analyze user's activity patterns
    // For now, return current time with medium confidence
    return {
      suggestedTime: now,
      confidence: 0.5,
      reasoning: 'Default activity-based timing',
      estimatedEngagement: userProfile.engagementScore / 100,
    };
  }

  private getMinIntervalForCategory(category: string, priority: string): number {
    const baseIntervals: Record<string, number> = {
      investment: 30 * 60 * 1000, // 30 minutes
      project: 60 * 60 * 1000, // 1 hour
      system: 4 * 60 * 60 * 1000, // 4 hours
      analytics: 24 * 60 * 60 * 1000, // 24 hours
      market: 12 * 60 * 60 * 1000, // 12 hours
    };

    const priorityMultipliers: Record<string, number> = {
      urgent: 0.1,
      high: 0.5,
      normal: 1.0,
      low: 2.0,
    };

    const baseInterval = baseIntervals[category] || 60 * 60 * 1000;
    const multiplier = priorityMultipliers[priority] || 1.0;

    return baseInterval * multiplier;
  }

  private async createDefaultProfile(userId: string): Promise<UserNotificationProfile> {
    const profile: UserNotificationProfile = {
      userId,
      preferredTimes: ['09:00', '14:00', '18:00'],
      engagementScore: 50,
      lastActiveAt: new Date(),
      averageResponseTime: 120,
      frequencyPreference: 'batched',
      channelPreference: 'in_app',
      categories: {},
    };

    await this.saveUserProfile(profile);
    return profile;
  }

  private async saveUserProfile(profile: UserNotificationProfile): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO user_notification_profiles (
           user_id, engagement_score, last_active_at, average_response_time,
           frequency_preference, channel_preference, preferred_times, category_data
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id) DO UPDATE SET
           engagement_score = EXCLUDED.engagement_score,
           last_active_at = EXCLUDED.last_active_at,
           average_response_time = EXCLUDED.average_response_time,
           frequency_preference = EXCLUDED.frequency_preference,
           channel_preference = EXCLUDED.channel_preference,
           preferred_times = EXCLUDED.preferred_times,
           category_data = EXCLUDED.category_data,
           updated_at = CURRENT_TIMESTAMP`,
        [
          profile.userId,
          profile.engagementScore,
          profile.lastActiveAt,
          profile.averageResponseTime,
          profile.frequencyPreference,
          profile.channelPreference,
          JSON.stringify(profile.preferredTimes),
          JSON.stringify(profile.categories),
        ]
      );
    } catch (error) {
      console.error('Error saving user profile:', error);
    }
  }

  private async loadUserProfiles(): Promise<void> {
    // Load frequently accessed user profiles into memory
    // Implementation would load active users' profiles
  }

  private async findExistingBatch(
    userId: string,
    category: string,
    scheduledTime: Date
  ): Promise<SmartBatch | null> {
    // Implementation would find existing batch within time window
    return null;
  }

  private async createBatch(
    userId: string,
    category: string,
    scheduledTime: Date
  ): Promise<string> {
    // Implementation would create new batch
    return crypto.randomUUID();
  }

  private async getRecentNotifications(
    userId: string,
    category: string,
    minutesBack: number
  ): Promise<any[]> {
    try {
      const result = await this.db.query(
        `SELECT id FROM notifications
         WHERE user_id = $1 AND category = $2
         AND created_at > $3`,
        [userId, category, new Date(Date.now() - minutesBack * 60 * 1000)]
      );
      // Raw SQL returns array directly
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error getting recent notifications:', error);
      return [];
    }
  }

  private async getReadyBatches(now: Date): Promise<SmartBatch[]> {
    // Implementation would get batches ready to send
    return [];
  }

  private async sendBatch(batch: SmartBatch): Promise<void> {
    // Implementation would send all notifications in batch
    console.log(`Sending batch ${batch.id} with ${batch.notifications.length} notifications`);
  }

  private async markBatchAsSent(batchId: string): Promise<void> {
    // Implementation would mark batch as sent
  }
}

export function createIntelligentNotificationService(
  db: DatabaseService,
  notificationService: NotificationService,
  redis?: any
): IntelligentNotificationService {
  return new IntelligentNotificationService(db, notificationService, redis);
}