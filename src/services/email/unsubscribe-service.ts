// Email Unsubscribe Management Service
// Handles email preferences, unsubscribe requests, and compliance

import { getRedisConnection } from '../cache.service.ts';

export interface EmailPreferences {
  userId: string;
  email: string;
  subscriptions: {
    welcome: boolean;
    nda_requests: boolean;
    nda_responses: boolean;
    messages: boolean;
    password_reset: boolean; // Always true - security emails
    payment_confirmations: boolean; // Always true - transaction emails
    weekly_digest: boolean;
    pitch_views: boolean;
    investor_invites: boolean;
    project_updates: boolean;
    marketing: boolean;
    product_announcements: boolean;
  };
  frequency: 'immediate' | 'daily' | 'weekly';
  timezone: string;
  language: string;
  lastUpdated: string;
  unsubscribeToken: string;
}

export interface UnsubscribeRequest {
  email: string;
  token: string;
  reason?: string;
  category?: string;
  timestamp: string;
  userAgent?: string;
  ipAddress?: string;
}

export class EmailUnsubscribeService {
  private readonly PREFERENCES_KEY = 'email_preferences';
  private readonly UNSUBSCRIBE_LOG_KEY = 'email_unsubscribe_log';
  private readonly BLOCKED_EMAILS_KEY = 'email_blocked';

  /**
   * Get email preferences for a user
   */
  async getPreferences(userId: string): Promise<EmailPreferences | null> {
    try {
      const redis = await getRedisConnection();
      if (!redis) return null;

      const prefsData = await redis.hget(this.PREFERENCES_KEY, userId);
      if (!prefsData) return null;

      return JSON.parse(prefsData);
    } catch (error) {
      console.error('Error getting email preferences:', error);
      return null;
    }
  }

  /**
   * Create default email preferences for new user
   */
  async createDefaultPreferences(
    userId: string, 
    email: string, 
    userType: 'creator' | 'investor' | 'production' | 'viewer'
  ): Promise<EmailPreferences> {
    const preferences: EmailPreferences = {
      userId,
      email,
      subscriptions: {
        welcome: true,
        nda_requests: true,
        nda_responses: true,
        messages: true,
        password_reset: true, // Always enabled for security
        payment_confirmations: true, // Always enabled for transactions
        weekly_digest: userType !== 'viewer', // Disabled for viewers by default
        pitch_views: userType === 'creator',
        investor_invites: userType === 'investor',
        project_updates: userType === 'investor',
        marketing: true,
        product_announcements: true,
      },
      frequency: 'immediate',
      timezone: 'UTC',
      language: 'en',
      lastUpdated: new Date().toISOString(),
      unsubscribeToken: this.generateUnsubscribeToken(userId, email),
    };

    await this.updatePreferences(preferences);
    return preferences;
  }

  /**
   * Update email preferences
   */
  async updatePreferences(preferences: EmailPreferences): Promise<void> {
    try {
      const redis = await getRedisConnection();
      if (!redis) throw new Error('Redis connection unavailable');

      preferences.lastUpdated = new Date().toISOString();
      await redis.hset(this.PREFERENCES_KEY, preferences.userId, JSON.stringify(preferences));
      
      console.log(`✅ Email preferences updated for user: ${preferences.userId}`);
    } catch (error) {
      console.error('Error updating email preferences:', error);
      throw error;
    }
  }

  /**
   * Check if user is subscribed to a specific email type
   */
  async isSubscribed(userId: string, emailType: keyof EmailPreferences['subscriptions']): Promise<boolean> {
    try {
      const preferences = await this.getPreferences(userId);
      if (!preferences) return true; // Default to subscribed if no preferences

      // Security and transaction emails are always enabled
      if (emailType === 'password_reset' || emailType === 'payment_confirmations') {
        return true;
      }

      return preferences.subscriptions[emailType] ?? true;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return true; // Default to subscribed on error
    }
  }

  /**
   * Process unsubscribe request
   */
  async processUnsubscribe(
    token: string, 
    category?: string,
    reason?: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ success: boolean; message: string; preferences?: EmailPreferences }> {
    try {
      const { userId, email } = this.verifyUnsubscribeToken(token);
      if (!userId || !email) {
        return { success: false, message: 'Invalid unsubscribe token' };
      }

      const preferences = await this.getPreferences(userId);
      if (!preferences) {
        return { success: false, message: 'User preferences not found' };
      }

      // Log the unsubscribe request
      const unsubscribeRequest: UnsubscribeRequest = {
        email,
        token,
        reason,
        category,
        timestamp: new Date().toISOString(),
        userAgent,
        ipAddress,
      };

      await this.logUnsubscribe(unsubscribeRequest);

      if (category && category in preferences.subscriptions) {
        // Unsubscribe from specific category
        const categoryKey = category as keyof EmailPreferences['subscriptions'];
        
        // Prevent unsubscribing from security/transaction emails
        if (categoryKey === 'password_reset' || categoryKey === 'payment_confirmations') {
          return { 
            success: false, 
            message: 'Cannot unsubscribe from security or transaction emails',
            preferences 
          };
        }

        preferences.subscriptions[categoryKey] = false;
        await this.updatePreferences(preferences);

        return { 
          success: true, 
          message: `Successfully unsubscribed from ${category} emails`,
          preferences 
        };
      } else {
        // Unsubscribe from all non-essential emails
        const updatedSubscriptions = { ...preferences.subscriptions };
        
        // Keep security and transaction emails enabled
        for (const [key, _] of Object.entries(updatedSubscriptions)) {
          if (key !== 'password_reset' && key !== 'payment_confirmations') {
            updatedSubscriptions[key as keyof EmailPreferences['subscriptions']] = false;
          }
        }

        preferences.subscriptions = updatedSubscriptions;
        await this.updatePreferences(preferences);

        return { 
          success: true, 
          message: 'Successfully unsubscribed from all marketing emails',
          preferences 
        };
      }
    } catch (error) {
      console.error('Error processing unsubscribe:', error);
      return { success: false, message: 'Failed to process unsubscribe request' };
    }
  }

  /**
   * Generate unsubscribe URL for emails
   */
  generateUnsubscribeUrl(userId: string, email: string, category?: string): string {
    const token = this.generateUnsubscribeToken(userId, email);
    const baseUrl = Deno.env.get('FRONTEND_URL') || 'https://pitchey.pages.dev';
    const params = new URLSearchParams({ token });
    
    if (category) {
      params.set('category', category);
    }

    return `${baseUrl}/unsubscribe?${params.toString()}`;
  }

  /**
   * Generate secure unsubscribe token
   */
  private generateUnsubscribeToken(userId: string, email: string): string {
    const secret = Deno.env.get('EMAIL_UNSUBSCRIBE_SECRET') || 'pitchey-email-secret';
    const payload = `${userId}:${email}:${Date.now()}`;
    
    // Simple token generation - in production, use proper JWT or crypto
    const encoder = new TextEncoder();
    const data = encoder.encode(payload + secret);
    
    return btoa(payload).replace(/[+/=]/g, (match) => {
      switch (match) {
        case '+': return '-';
        case '/': return '_';
        case '=': return '';
        default: return match;
      }
    });
  }

  /**
   * Verify and decode unsubscribe token
   */
  private verifyUnsubscribeToken(token: string): { userId?: string; email?: string } {
    try {
      // Reverse the encoding
      const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
      const padding = 4 - (base64.length % 4);
      const paddedBase64 = padding < 4 ? base64 + '='.repeat(padding) : base64;
      
      const payload = atob(paddedBase64);
      const [userId, email] = payload.split(':');
      
      return { userId, email };
    } catch (error) {
      console.error('Invalid unsubscribe token:', error);
      return {};
    }
  }

  /**
   * Log unsubscribe request for compliance and analysis
   */
  private async logUnsubscribe(request: UnsubscribeRequest): Promise<void> {
    try {
      const redis = await getRedisConnection();
      if (!redis) return;

      const logEntry = `${Date.now()}:${JSON.stringify(request)}`;
      await redis.lpush(this.UNSUBSCRIBE_LOG_KEY, logEntry);
      
      // Keep only last 10,000 unsubscribe logs
      await redis.ltrim(this.UNSUBSCRIBE_LOG_KEY, 0, 9999);
    } catch (error) {
      console.error('Error logging unsubscribe:', error);
    }
  }

  /**
   * Get unsubscribe statistics
   */
  async getUnsubscribeStats(days: number = 30): Promise<{
    totalUnsubscribes: number;
    byCategory: Record<string, number>;
    byReason: Record<string, number>;
    recentUnsubscribes: UnsubscribeRequest[];
  }> {
    try {
      const redis = await getRedisConnection();
      if (!redis) {
        return { totalUnsubscribes: 0, byCategory: {}, byReason: {}, recentUnsubscribes: [] };
      }

      const logs = await redis.lrange(this.UNSUBSCRIBE_LOG_KEY, 0, -1);
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      
      const recentLogs = logs
        .map(log => {
          const [timestamp, data] = log.split(':', 2);
          return { timestamp: parseInt(timestamp), data: JSON.parse(data) };
        })
        .filter(log => log.timestamp >= cutoffTime);

      const byCategory: Record<string, number> = {};
      const byReason: Record<string, number> = {};
      
      for (const log of recentLogs) {
        if (log.data.category) {
          byCategory[log.data.category] = (byCategory[log.data.category] || 0) + 1;
        }
        if (log.data.reason) {
          byReason[log.data.reason] = (byReason[log.data.reason] || 0) + 1;
        }
      }

      return {
        totalUnsubscribes: recentLogs.length,
        byCategory,
        byReason,
        recentUnsubscribes: recentLogs.slice(0, 50).map(log => log.data),
      };
    } catch (error) {
      console.error('Error getting unsubscribe stats:', error);
      return { totalUnsubscribes: 0, byCategory: {}, byReason: {}, recentUnsubscribes: [] };
    }
  }

  /**
   * Check if email is globally blocked
   */
  async isEmailBlocked(email: string): Promise<boolean> {
    try {
      const redis = await getRedisConnection();
      if (!redis) return false;

      const blocked = await redis.sismember(this.BLOCKED_EMAILS_KEY, email);
      return blocked === 1;
    } catch (error) {
      console.error('Error checking blocked email:', error);
      return false;
    }
  }

  /**
   * Block an email address globally
   */
  async blockEmail(email: string, reason: string): Promise<void> {
    try {
      const redis = await getRedisConnection();
      if (!redis) return;

      await redis.sadd(this.BLOCKED_EMAILS_KEY, email);
      
      // Log the block
      await this.logUnsubscribe({
        email,
        token: 'GLOBAL_BLOCK',
        reason,
        category: 'global_block',
        timestamp: new Date().toISOString(),
      });

      console.log(`🚫 Email blocked: ${email} - ${reason}`);
    } catch (error) {
      console.error('Error blocking email:', error);
      throw error;
    }
  }
}

// Singleton instance
let unsubscribeServiceInstance: EmailUnsubscribeService | null = null;

export function getEmailUnsubscribeService(): EmailUnsubscribeService {
  if (!unsubscribeServiceInstance) {
    unsubscribeServiceInstance = new EmailUnsubscribeService();
  }
  return unsubscribeServiceInstance;
}

// High-level helper functions
export async function shouldSendEmail(userId: string, emailType: keyof EmailPreferences['subscriptions']): Promise<boolean> {
  const service = getEmailUnsubscribeService();
  return service.isSubscribed(userId, emailType);
}

export async function createUserEmailPreferences(
  userId: string, 
  email: string, 
  userType: 'creator' | 'investor' | 'production' | 'viewer'
): Promise<EmailPreferences> {
  const service = getEmailUnsubscribeService();
  return service.createDefaultPreferences(userId, email, userType);
}

export async function getUnsubscribeUrl(userId: string, email: string, category?: string): Promise<string> {
  const service = getEmailUnsubscribeService();
  return service.generateUnsubscribeUrl(userId, email, category);
}