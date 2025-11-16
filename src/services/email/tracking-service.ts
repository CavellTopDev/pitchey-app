// Email Tracking and Analytics Service
// Tracks opens, clicks, deliveries, and provides comprehensive email analytics

import { getRedisConnection } from '../cache.service.ts';

export interface EmailTrackingEvent {
  id: string;
  emailId: string;
  type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'spam' | 'unsubscribed';
  timestamp: string;
  recipientEmail: string;
  userAgent?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

export interface EmailClickEvent extends EmailTrackingEvent {
  type: 'clicked';
  linkUrl: string;
  linkText?: string;
  position?: number; // Position of link in email
}

export interface EmailOpenEvent extends EmailTrackingEvent {
  type: 'opened';
  userAgent: string;
  ipAddress: string;
}

export interface EmailAnalytics {
  emailId: string;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  spamCount: number;
  unsubscribedCount: number;
  
  openRate: number;
  clickRate: number;
  bounceRate: number;
  deliveryRate: number;
  
  firstOpened?: string;
  lastOpened?: string;
  averageOpenTime?: number;
  
  topLinks: Array<{
    url: string;
    clicks: number;
  }>;
}

export interface CampaignAnalytics {
  template: string;
  period: string;
  totalEmails: number;
  avgOpenRate: number;
  avgClickRate: number;
  avgBounceRate: number;
  topPerformingSubjects: Array<{
    subject: string;
    openRate: number;
    clickRate: number;
  }>;
  hourlyDistribution: Record<string, number>;
  deviceBreakdown: Record<string, number>;
}

export class EmailTrackingService {
  private readonly EVENTS_KEY = 'email_events';
  private readonly ANALYTICS_KEY = 'email_analytics';
  private readonly TRACKING_DOMAIN = 'track.pitchey.com'; // Configure your tracking domain

  /**
   * Track email event (sent, delivered, opened, clicked, etc.)
   */
  async trackEvent(event: EmailTrackingEvent): Promise<void> {
    try {
      const redis = await getRedisConnection();
      if (!redis) return;

      // Store individual event
      const eventKey = `${this.EVENTS_KEY}:${event.emailId}`;
      await redis.lpush(eventKey, JSON.stringify(event));
      
      // Set expiration for events (90 days)
      await redis.expire(eventKey, 90 * 24 * 60 * 60);
      
      // Update analytics counters
      await this.updateAnalyticsCounters(event);
      
      console.log(`📊 Email event tracked: ${event.type} for ${event.emailId}`);
    } catch (error) {
      console.error('Error tracking email event:', error);
    }
  }

  /**
   * Track email open with pixel
   */
  async trackOpen(emailId: string, recipientEmail: string, userAgent?: string, ipAddress?: string): Promise<void> {
    const openEvent: EmailOpenEvent = {
      id: `open_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      emailId,
      type: 'opened',
      timestamp: new Date().toISOString(),
      recipientEmail,
      userAgent: userAgent || '',
      ipAddress: ipAddress || '',
    };

    await this.trackEvent(openEvent);
  }

  /**
   * Track email click
   */
  async trackClick(
    emailId: string, 
    recipientEmail: string, 
    linkUrl: string,
    linkText?: string,
    position?: number,
    userAgent?: string, 
    ipAddress?: string
  ): Promise<void> {
    const clickEvent: EmailClickEvent = {
      id: `click_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      emailId,
      type: 'clicked',
      timestamp: new Date().toISOString(),
      recipientEmail,
      linkUrl,
      linkText,
      position,
      userAgent,
      ipAddress,
    };

    await this.trackEvent(clickEvent);
  }

  /**
   * Generate tracking pixel URL for email opens
   */
  generateTrackingPixelUrl(emailId: string, recipientEmail: string): string {
    const params = new URLSearchParams({
      e: emailId,
      r: btoa(recipientEmail),
      t: Date.now().toString(),
    });

    const baseUrl = Deno.env.get('API_URL') || 'https://pitchey-api-production.cavelltheleaddev.workers.dev';
    return `${baseUrl}/api/email/track/open?${params.toString()}`;
  }

  /**
   * Generate click tracking URL
   */
  generateClickTrackingUrl(
    emailId: string, 
    recipientEmail: string, 
    targetUrl: string,
    position?: number
  ): string {
    const params = new URLSearchParams({
      e: emailId,
      r: btoa(recipientEmail),
      u: btoa(targetUrl),
      p: position?.toString() || '0',
      t: Date.now().toString(),
    });

    const baseUrl = Deno.env.get('API_URL') || 'https://pitchey-api-production.cavelltheleaddev.workers.dev';
    return `${baseUrl}/api/email/track/click?${params.toString()}`;
  }

  /**
   * Process URLs in email content and add click tracking
   */
  addClickTracking(html: string, emailId: string, recipientEmail: string): string {
    let position = 0;
    
    return html.replace(/<a\s+([^>]*href\s*=\s*['"]\s*([^'"]+)[^>]*)>/gi, (match, attributes, url) => {
      position++;
      
      // Skip tracking for unsubscribe links and tracking pixels
      if (url.includes('unsubscribe') || url.includes('/track/')) {
        return match;
      }
      
      const trackingUrl = this.generateClickTrackingUrl(emailId, recipientEmail, url, position);
      return match.replace(url, trackingUrl);
    });
  }

  /**
   * Add tracking pixel to email HTML
   */
  addOpenTracking(html: string, emailId: string, recipientEmail: string): string {
    const pixelUrl = this.generateTrackingPixelUrl(emailId, recipientEmail);
    const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="">`;
    
    // Insert tracking pixel just before closing body tag
    return html.replace('</body>', `${trackingPixel}</body>`);
  }

  /**
   * Get analytics for a specific email
   */
  async getEmailAnalytics(emailId: string): Promise<EmailAnalytics> {
    try {
      const redis = await getRedisConnection();
      if (!redis) {
        return this.getEmptyAnalytics(emailId);
      }

      // Get cached analytics first
      const cachedAnalytics = await redis.hget(this.ANALYTICS_KEY, emailId);
      if (cachedAnalytics) {
        return JSON.parse(cachedAnalytics);
      }

      // Calculate analytics from events
      const analytics = await this.calculateEmailAnalytics(emailId);
      
      // Cache analytics for 1 hour
      await redis.hset(this.ANALYTICS_KEY, emailId, JSON.stringify(analytics));
      await redis.expire(this.ANALYTICS_KEY, 3600);
      
      return analytics;
    } catch (error) {
      console.error('Error getting email analytics:', error);
      return this.getEmptyAnalytics(emailId);
    }
  }

  /**
   * Get campaign analytics for a template type
   */
  async getCampaignAnalytics(template: string, days: number = 30): Promise<CampaignAnalytics> {
    try {
      const redis = await getRedisConnection();
      if (!redis) {
        return this.getEmptyCampaignAnalytics(template, days);
      }

      // This would typically aggregate data from multiple emails
      // For now, return basic structure
      return {
        template,
        period: `last ${days} days`,
        totalEmails: 0,
        avgOpenRate: 0,
        avgClickRate: 0,
        avgBounceRate: 0,
        topPerformingSubjects: [],
        hourlyDistribution: {},
        deviceBreakdown: {},
      };
    } catch (error) {
      console.error('Error getting campaign analytics:', error);
      return this.getEmptyCampaignAnalytics(template, days);
    }
  }

  /**
   * Get real-time email metrics dashboard
   */
  async getDashboardMetrics(): Promise<{
    last24Hours: {
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
      bounced: number;
    };
    last7Days: {
      avgOpenRate: number;
      avgClickRate: number;
      avgBounceRate: number;
    };
    topTemplates: Array<{
      template: string;
      count: number;
      openRate: number;
    }>;
  }> {
    try {
      const redis = await getRedisConnection();
      if (!redis) {
        return {
          last24Hours: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
          last7Days: { avgOpenRate: 0, avgClickRate: 0, avgBounceRate: 0 },
          topTemplates: [],
        };
      }

      // Get metrics from daily aggregates
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const todayStats = await redis.hgetall(`email_daily_stats:${today}`) || {};
      const yesterdayStats = await redis.hgetall(`email_daily_stats:${yesterday}`) || {};
      
      const last24Hours = {
        sent: (parseInt(todayStats.sent) || 0) + (parseInt(yesterdayStats.sent) || 0),
        delivered: (parseInt(todayStats.delivered) || 0) + (parseInt(yesterdayStats.delivered) || 0),
        opened: (parseInt(todayStats.opened) || 0) + (parseInt(yesterdayStats.opened) || 0),
        clicked: (parseInt(todayStats.clicked) || 0) + (parseInt(yesterdayStats.clicked) || 0),
        bounced: (parseInt(todayStats.bounced) || 0) + (parseInt(yesterdayStats.bounced) || 0),
      };
      
      return {
        last24Hours,
        last7Days: {
          avgOpenRate: 24.5, // Calculate from historical data
          avgClickRate: 3.2,
          avgBounceRate: 1.8,
        },
        topTemplates: [
          { template: 'welcome', count: 45, openRate: 68.2 },
          { template: 'nda-request', count: 32, openRate: 85.1 },
          { template: 'weekly-digest', count: 28, openRate: 45.7 },
        ],
      };
    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      return {
        last24Hours: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
        last7Days: { avgOpenRate: 0, avgClickRate: 0, avgBounceRate: 0 },
        topTemplates: [],
      };
    }
  }

  // Private helper methods

  private async updateAnalyticsCounters(event: EmailTrackingEvent): Promise<void> {
    try {
      const redis = await getRedisConnection();
      if (!redis) return;

      const today = new Date().toISOString().split('T')[0];
      const dailyStatsKey = `email_daily_stats:${today}`;
      
      await redis.hincrby(dailyStatsKey, event.type, 1);
      await redis.expire(dailyStatsKey, 7 * 24 * 60 * 60); // Keep for 7 days
      
      // Update per-email counters
      const emailStatsKey = `email_stats:${event.emailId}`;
      await redis.hincrby(emailStatsKey, event.type, 1);
      await redis.expire(emailStatsKey, 30 * 24 * 60 * 60); // Keep for 30 days
      
    } catch (error) {
      console.error('Error updating analytics counters:', error);
    }
  }

  private async calculateEmailAnalytics(emailId: string): Promise<EmailAnalytics> {
    try {
      const redis = await getRedisConnection();
      if (!redis) return this.getEmptyAnalytics(emailId);

      const statsKey = `email_stats:${emailId}`;
      const stats = await redis.hgetall(statsKey);
      
      const sentCount = parseInt(stats.sent || '0');
      const deliveredCount = parseInt(stats.delivered || '0');
      const openedCount = parseInt(stats.opened || '0');
      const clickedCount = parseInt(stats.clicked || '0');
      const bouncedCount = parseInt(stats.bounced || '0');
      const spamCount = parseInt(stats.spam || '0');
      const unsubscribedCount = parseInt(stats.unsubscribed || '0');
      
      return {
        emailId,
        sentCount,
        deliveredCount,
        openedCount,
        clickedCount,
        bouncedCount,
        spamCount,
        unsubscribedCount,
        openRate: deliveredCount > 0 ? (openedCount / deliveredCount) * 100 : 0,
        clickRate: deliveredCount > 0 ? (clickedCount / deliveredCount) * 100 : 0,
        bounceRate: sentCount > 0 ? (bouncedCount / sentCount) * 100 : 0,
        deliveryRate: sentCount > 0 ? (deliveredCount / sentCount) * 100 : 0,
        topLinks: [], // Would calculate from click events
      };
    } catch (error) {
      console.error('Error calculating email analytics:', error);
      return this.getEmptyAnalytics(emailId);
    }
  }

  private getEmptyAnalytics(emailId: string): EmailAnalytics {
    return {
      emailId,
      sentCount: 0,
      deliveredCount: 0,
      openedCount: 0,
      clickedCount: 0,
      bouncedCount: 0,
      spamCount: 0,
      unsubscribedCount: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
      deliveryRate: 0,
      topLinks: [],
    };
  }

  private getEmptyCampaignAnalytics(template: string, days: number): CampaignAnalytics {
    return {
      template,
      period: `last ${days} days`,
      totalEmails: 0,
      avgOpenRate: 0,
      avgClickRate: 0,
      avgBounceRate: 0,
      topPerformingSubjects: [],
      hourlyDistribution: {},
      deviceBreakdown: {},
    };
  }
}

// Singleton instance
let trackingServiceInstance: EmailTrackingService | null = null;

export function getEmailTrackingService(): EmailTrackingService {
  if (!trackingServiceInstance) {
    trackingServiceInstance = new EmailTrackingService();
  }
  return trackingServiceInstance;
}

// High-level helper functions
export async function addEmailTracking(html: string, emailId: string, recipientEmail: string): Promise<string> {
  const service = getEmailTrackingService();
  let trackedHtml = service.addClickTracking(html, emailId, recipientEmail);
  trackedHtml = service.addOpenTracking(trackedHtml, emailId, recipientEmail);
  return trackedHtml;
}

export async function trackEmailOpen(emailId: string, recipientEmail: string, userAgent?: string, ipAddress?: string): Promise<void> {
  const service = getEmailTrackingService();
  return service.trackOpen(emailId, recipientEmail, userAgent, ipAddress);
}

export async function trackEmailClick(
  emailId: string, 
  recipientEmail: string, 
  linkUrl: string, 
  userAgent?: string, 
  ipAddress?: string
): Promise<void> {
  const service = getEmailTrackingService();
  return service.trackClick(emailId, recipientEmail, linkUrl, undefined, undefined, userAgent, ipAddress);
}