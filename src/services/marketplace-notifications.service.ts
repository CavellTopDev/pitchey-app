/**
 * Marketplace Notifications Service
 * Handles all notification workflows for marketplace interactions and pitch matching
 */

import type { DatabaseService } from '../types/worker-types.ts';
import type { NotificationService, NotificationInput } from './notification.service.ts';
import { eq, and, desc, gte, lte, inArray, or, like } from 'drizzle-orm';

export interface InvestorCriteria {
  userId: number;
  genres: string[];
  minBudget: number;
  maxBudget: number;
  formats: string[];
  regions: string[];
  themes: string[];
  riskTolerance: 'low' | 'medium' | 'high';
  investmentHorizon: 'short' | 'medium' | 'long';
  preferredRoles: string[];
  excludeGenres?: string[];
  minExpectedRoi?: number;
  notificationFrequency: 'instant' | 'daily' | 'weekly';
  lastUpdated: Date;
}

export interface PitchMatch {
  pitchId: number;
  pitchTitle: string;
  creatorId: number;
  creatorName: string;
  matchScore: number; // 0-100
  matchReasons: string[];
  budget: number;
  genre: string;
  format: string;
  themes: string[];
  expectedRoi: number;
  riskLevel: 'low' | 'medium' | 'high';
  synopsis: string;
  newlyPosted: boolean;
  trending: boolean;
}

export interface PriceAlert {
  pitchId: number;
  userId: number;
  alertType: 'price_drop' | 'price_increase' | 'investment_opportunity' | 'funding_target_reached';
  previousValue: number;
  currentValue: number;
  threshold: number;
  percentage: number;
}

export interface TrendingPitch {
  pitchId: number;
  title: string;
  creatorName: string;
  genre: string;
  trendingScore: number;
  viewIncrease: number;
  savesIncrease: number;
  sharesIncrease: number;
  timeframe: '24h' | '7d' | '30d';
  reason: string;
}

export interface MarketplaceDigest {
  userId: number;
  digestType: 'daily' | 'weekly' | 'monthly';
  newMatches: PitchMatch[];
  trendingPitches: TrendingPitch[];
  priceAlerts: PriceAlert[];
  portfolioUpdates: any[];
  marketInsights: any[];
  recommendedActions: string[];
}

export class MarketplaceNotificationsService {
  constructor(
    private db: DatabaseService,
    private notificationService: NotificationService
  ) {}

  // ============================================================================
  // PITCH MATCHING NOTIFICATIONS
  // ============================================================================

  /**
   * Notify investors of new pitches matching their criteria
   */
  async notifyNewPitchMatches(pitchId: number): Promise<void> {
    try {
      // Get pitch details
      const pitch = await this.getPitchDetails(pitchId);
      if (!pitch) return;

      // Find investors with matching criteria
      const matchingInvestors = await this.findMatchingInvestors(pitch);

      for (const { investor, matchScore, matchReasons } of matchingInvestors) {
        // Skip if investor has instant notifications disabled
        if (investor.notificationFrequency !== 'instant') continue;

        await this.notificationService.sendNotification({
          userId: investor.userId,
          type: 'investment',
          title: `New Match: ${pitch.title} (${matchScore}% match)`,
          message: `A new pitch "${pitch.title}" by ${pitch.creatorName} matches your investment criteria. Match reasons: ${matchReasons.join(', ')}.`,
          priority: matchScore >= 90 ? 'high' : 'normal',
          relatedPitchId: pitchId,
          relatedUserId: pitch.creatorId,
          actionUrl: `/marketplace/pitch/${pitchId}`,
          metadata: {
            matchScore,
            matchReasons,
            pitchBudget: pitch.budget,
            pitchGenre: pitch.genre,
            pitchFormat: pitch.format,
            expectedRoi: pitch.expectedRoi,
            riskLevel: pitch.riskLevel,
            investorCriteriaId: investor.criteriaId
          },
          emailOptions: {
            templateType: 'new_pitch_match',
            variables: {
              investorName: investor.name,
              pitchTitle: pitch.title,
              creatorName: pitch.creatorName,
              matchScore,
              matchReasons: matchReasons.join(', '),
              budget: `$${pitch.budget.toLocaleString()}`,
              genre: pitch.genre,
              format: pitch.format,
              synopsis: pitch.synopsis.substring(0, 200) + '...'
            }
          }
        });
      }

      // Queue batch notifications for daily/weekly digest users
      await this.queueDigestNotifications(pitchId, matchingInvestors);

    } catch (error) {
      console.error('Error notifying new pitch matches:', error);
      throw error;
    }
  }

  /**
   * Notify users when saved pitches are updated
   */
  async notifySavedPitchUpdate(
    pitchId: number,
    updateType: 'content' | 'budget' | 'status' | 'investment',
    changes: Record<string, any>
  ): Promise<void> {
    try {
      const pitch = await this.getPitchDetails(pitchId);
      if (!pitch) return;

      // Get users who saved this pitch
      const savedByUsers = await this.getUsersWhoSavedPitch(pitchId);

      const updateMessages = {
        content: `The pitch "${pitch.title}" has been updated with new content.`,
        budget: `The budget for "${pitch.title}" has been updated to $${changes.newBudget?.toLocaleString()}.`,
        status: `The status of "${pitch.title}" has changed to ${changes.newStatus}.`,
        investment: `New investment opportunity available for "${pitch.title}".`
      };

      for (const userId of savedByUsers) {
        await this.notificationService.sendNotification({
          userId,
          type: 'pitch_update',
          title: `Update: ${pitch.title}`,
          message: updateMessages[updateType],
          priority: updateType === 'investment' ? 'high' : 'normal',
          relatedPitchId: pitchId,
          actionUrl: `/marketplace/pitch/${pitchId}`,
          metadata: {
            updateType,
            changes,
            pitchTitle: pitch.title,
            creatorName: pitch.creatorName
          },
          emailOptions: {
            templateType: 'saved_pitch_update',
            variables: {
              pitchTitle: pitch.title,
              updateType,
              changes,
              creatorName: pitch.creatorName
            }
          }
        });
      }
    } catch (error) {
      console.error('Error notifying saved pitch update:', error);
      throw error;
    }
  }

  // ============================================================================
  // PRICE AND INVESTMENT ALERTS
  // ============================================================================

  /**
   * Send price change alerts
   */
  async sendPriceAlerts(alerts: PriceAlert[]): Promise<void> {
    try {
      for (const alert of alerts) {
        const pitch = await this.getPitchDetails(alert.pitchId);
        if (!pitch) continue;

        const alertMessages = {
          price_drop: {
            title: `💰 Price Drop Alert: ${pitch.title}`,
            message: `The investment price for "${pitch.title}" has dropped by ${alert.percentage}% (from $${alert.previousValue.toLocaleString()} to $${alert.currentValue.toLocaleString()}).`,
            priority: 'high' as const
          },
          price_increase: {
            title: `📈 Price Alert: ${pitch.title}`,
            message: `The investment price for "${pitch.title}" has increased by ${alert.percentage}% (from $${alert.previousValue.toLocaleString()} to $${alert.currentValue.toLocaleString()}).`,
            priority: 'normal' as const
          },
          investment_opportunity: {
            title: `🚀 Investment Opportunity: ${pitch.title}`,
            message: `A new investment opportunity is available for "${pitch.title}" at $${alert.currentValue.toLocaleString()}.`,
            priority: 'high' as const
          },
          funding_target_reached: {
            title: `🎯 Funding Target Reached: ${pitch.title}`,
            message: `"${pitch.title}" has reached its funding target of $${alert.currentValue.toLocaleString()}!`,
            priority: 'high' as const
          }
        };

        const alertConfig = alertMessages[alert.alertType];

        await this.notificationService.sendNotification({
          userId: alert.userId,
          type: 'investment',
          title: alertConfig.title,
          message: alertConfig.message,
          priority: alertConfig.priority,
          relatedPitchId: alert.pitchId,
          actionUrl: `/marketplace/pitch/${alert.pitchId}`,
          metadata: {
            alertType: alert.alertType,
            previousValue: alert.previousValue,
            currentValue: alert.currentValue,
            percentage: alert.percentage,
            threshold: alert.threshold
          },
          emailOptions: {
            templateType: 'price_alert',
            variables: {
              pitchTitle: pitch.title,
              alertType: alert.alertType,
              previousValue: alert.previousValue.toLocaleString(),
              currentValue: alert.currentValue.toLocaleString(),
              percentage: alert.percentage,
              creatorName: pitch.creatorName
            }
          }
        });
      }
    } catch (error) {
      console.error('Error sending price alerts:', error);
      throw error;
    }
  }

  /**
   * Monitor and alert on investment threshold changes
   */
  async monitorInvestmentThresholds(): Promise<void> {
    try {
      const alerts: PriceAlert[] = [];

      // Get user investment alerts and price thresholds
      const userAlerts = await this.getUserInvestmentAlerts();

      for (const userAlert of userAlerts) {
        const currentPrice = await this.getCurrentInvestmentPrice(userAlert.pitchId);
        
        if (this.shouldTriggerAlert(userAlert, currentPrice)) {
          alerts.push({
            pitchId: userAlert.pitchId,
            userId: userAlert.userId,
            alertType: this.determineAlertType(userAlert, currentPrice),
            previousValue: userAlert.lastKnownPrice,
            currentValue: currentPrice,
            threshold: userAlert.threshold,
            percentage: ((currentPrice - userAlert.lastKnownPrice) / userAlert.lastKnownPrice) * 100
          });

          // Update last known price
          await this.updateLastKnownPrice(userAlert.alertId, currentPrice);
        }
      }

      if (alerts.length > 0) {
        await this.sendPriceAlerts(alerts);
      }

    } catch (error) {
      console.error('Error monitoring investment thresholds:', error);
    }
  }

  // ============================================================================
  // TRENDING AND FEATURED NOTIFICATIONS
  // ============================================================================

  /**
   * Notify about trending pitches
   */
  async notifyTrendingPitches(trendingPitches: TrendingPitch[]): Promise<void> {
    try {
      // Get users interested in trending content
      const trendingSubscribers = await this.getTrendingSubscribers();

      for (const pitch of trendingPitches) {
        // Filter subscribers based on their interests
        const interestedUsers = await this.filterUsersByInterest(trendingSubscribers, pitch);

        for (const userId of interestedUsers) {
          await this.notificationService.sendNotification({
            userId,
            type: 'pitch_update',
            title: `🔥 Trending: ${pitch.title}`,
            message: `"${pitch.title}" by ${pitch.creatorName} is trending! ${pitch.reason}`,
            priority: 'normal',
            relatedPitchId: pitch.pitchId,
            actionUrl: `/marketplace/pitch/${pitch.pitchId}`,
            metadata: {
              trendingScore: pitch.trendingScore,
              timeframe: pitch.timeframe,
              viewIncrease: pitch.viewIncrease,
              savesIncrease: pitch.savesIncrease,
              sharesIncrease: pitch.sharesIncrease,
              reason: pitch.reason
            },
            emailOptions: {
              templateType: 'trending_pitch',
              variables: {
                pitchTitle: pitch.title,
                creatorName: pitch.creatorName,
                trendingReason: pitch.reason,
                timeframe: pitch.timeframe,
                genre: pitch.genre
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Error notifying trending pitches:', error);
      throw error;
    }
  }

  /**
   * Send featured pitch notifications
   */
  async notifyFeaturedPitches(featuredPitchIds: number[]): Promise<void> {
    try {
      const allUsers = await this.getMarketplaceUsers();

      for (const pitchId of featuredPitchIds) {
        const pitch = await this.getPitchDetails(pitchId);
        if (!pitch) continue;

        // Send to users who haven't seen this pitch yet
        const eligibleUsers = await this.filterUsersWhoHaventSeenPitch(allUsers, pitchId);

        for (const userId of eligibleUsers) {
          await this.notificationService.sendNotification({
            userId,
            type: 'marketing',
            title: `⭐ Featured Pitch: ${pitch.title}`,
            message: `Don't miss "${pitch.title}" by ${pitch.creatorName} - now featured on our marketplace!`,
            priority: 'low',
            relatedPitchId: pitchId,
            actionUrl: `/marketplace/pitch/${pitchId}`,
            metadata: {
              isFeatured: true,
              featuredDate: new Date().toISOString(),
              genre: pitch.genre,
              format: pitch.format
            },
            channels: {
              email: false, // Only in-app for featured notifications
              inApp: true,
              push: false,
              sms: false
            }
          });
        }
      }
    } catch (error) {
      console.error('Error notifying featured pitches:', error);
      throw error;
    }
  }

  // ============================================================================
  // DIGEST NOTIFICATIONS
  // ============================================================================

  /**
   * Generate and send daily marketplace digest
   */
  async sendDailyDigest(userId: number): Promise<void> {
    try {
      const digest = await this.generateMarketplaceDigest(userId, 'daily');
      
      if (this.isDigestEmpty(digest)) return; // Don't send empty digests

      await this.notificationService.sendNotification({
        userId,
        type: 'marketing',
        title: `📰 Daily Marketplace Digest - ${digest.newMatches.length} new matches`,
        message: `Your personalized daily digest with ${digest.newMatches.length} new matches, ${digest.trendingPitches.length} trending pitches, and market insights.`,
        priority: 'low',
        actionUrl: '/marketplace?digest=daily',
        metadata: {
          digestType: 'daily',
          matchesCount: digest.newMatches.length,
          trendingCount: digest.trendingPitches.length,
          alertsCount: digest.priceAlerts.length
        },
        emailOptions: {
          templateType: 'marketplace_digest',
          variables: {
            digestType: 'Daily',
            newMatches: digest.newMatches.slice(0, 3), // Top 3 matches
            trendingPitches: digest.trendingPitches.slice(0, 5),
            priceAlerts: digest.priceAlerts,
            portfolioUpdates: digest.portfolioUpdates,
            marketInsights: digest.marketInsights,
            recommendedActions: digest.recommendedActions,
            digestDate: new Date().toLocaleDateString()
          }
        }
      });

    } catch (error) {
      console.error('Error sending daily digest:', error);
      throw error;
    }
  }

  /**
   * Generate and send weekly marketplace digest
   */
  async sendWeeklyDigest(userId: number): Promise<void> {
    try {
      const digest = await this.generateMarketplaceDigest(userId, 'weekly');
      
      if (this.isDigestEmpty(digest)) return;

      await this.notificationService.sendNotification({
        userId,
        type: 'marketing',
        title: `📊 Weekly Marketplace Report - ${digest.newMatches.length} matches this week`,
        message: `Your comprehensive weekly marketplace report with performance insights and investment opportunities.`,
        priority: 'low',
        actionUrl: '/marketplace?digest=weekly',
        metadata: {
          digestType: 'weekly',
          matchesCount: digest.newMatches.length,
          trendingCount: digest.trendingPitches.length,
          alertsCount: digest.priceAlerts.length
        },
        emailOptions: {
          templateType: 'marketplace_digest',
          variables: {
            digestType: 'Weekly',
            newMatches: digest.newMatches,
            trendingPitches: digest.trendingPitches,
            priceAlerts: digest.priceAlerts,
            portfolioUpdates: digest.portfolioUpdates,
            marketInsights: digest.marketInsights,
            recommendedActions: digest.recommendedActions,
            weekStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            weekEndDate: new Date().toLocaleDateString()
          }
        }
      });

    } catch (error) {
      console.error('Error sending weekly digest:', error);
      throw error;
    }
  }

  /**
   * Generate and send monthly marketplace digest
   */
  async sendMonthlyDigest(userId: number): Promise<void> {
    try {
      const digest = await this.generateMarketplaceDigest(userId, 'monthly');
      
      if (this.isDigestEmpty(digest)) return;

      await this.notificationService.sendNotification({
        userId,
        type: 'marketing',
        title: `📈 Monthly Marketplace Analytics - Performance Summary`,
        message: `Your monthly marketplace performance summary with detailed analytics and insights.`,
        priority: 'low',
        actionUrl: '/marketplace?digest=monthly',
        metadata: {
          digestType: 'monthly',
          matchesCount: digest.newMatches.length,
          portfolioPerformance: digest.portfolioUpdates.length
        },
        emailOptions: {
          templateType: 'marketplace_digest',
          variables: {
            digestType: 'Monthly',
            newMatches: digest.newMatches,
            trendingPitches: digest.trendingPitches,
            priceAlerts: digest.priceAlerts,
            portfolioUpdates: digest.portfolioUpdates,
            marketInsights: digest.marketInsights,
            recommendedActions: digest.recommendedActions,
            monthName: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          }
        }
      });

    } catch (error) {
      console.error('Error sending monthly digest:', error);
      throw error;
    }
  }

  // ============================================================================
  // RECOMMENDATION ENGINE NOTIFICATIONS
  // ============================================================================

  /**
   * Send AI-powered pitch recommendations
   */
  async sendRecommendations(userId: number, recommendations: PitchMatch[]): Promise<void> {
    try {
      if (recommendations.length === 0) return;

      const topRecommendation = recommendations[0];

      await this.notificationService.sendNotification({
        userId,
        type: 'investment',
        title: `🤖 AI Recommendation: ${topRecommendation.pitchTitle}`,
        message: `Our AI suggests "${topRecommendation.pitchTitle}" as a strong match for your portfolio. ${topRecommendation.matchScore}% compatibility.`,
        priority: topRecommendation.matchScore >= 95 ? 'high' : 'normal',
        relatedPitchId: topRecommendation.pitchId,
        actionUrl: `/marketplace/pitch/${topRecommendation.pitchId}`,
        metadata: {
          isAiRecommendation: true,
          matchScore: topRecommendation.matchScore,
          matchReasons: topRecommendation.matchReasons,
          recommendationCount: recommendations.length,
          aiModelVersion: '1.0'
        },
        emailOptions: {
          templateType: 'ai_recommendation',
          variables: {
            topPitch: topRecommendation,
            totalRecommendations: recommendations.length,
            otherRecommendations: recommendations.slice(1, 4) // Next 3 recommendations
          }
        }
      });

    } catch (error) {
      console.error('Error sending AI recommendations:', error);
      throw error;
    }
  }

  // ============================================================================
  // BATCH PROCESSING METHODS
  // ============================================================================

  /**
   * Process all pending marketplace notifications
   */
  async processMarketplaceNotifications(): Promise<void> {
    try {
      await Promise.all([
        this.monitorInvestmentThresholds(),
        this.processTrendingAlerts(),
        this.processDigestQueue(),
        this.processRecommendationQueue()
      ]);
    } catch (error) {
      console.error('Error processing marketplace notifications:', error);
    }
  }

  private async processTrendingAlerts(): Promise<void> {
    const trendingPitches = await this.getTrendingPitches();
    if (trendingPitches.length > 0) {
      await this.notifyTrendingPitches(trendingPitches);
    }
  }

  private async processDigestQueue(): Promise<void> {
    // Process daily digests
    const dailyDigestUsers = await this.getUsersForDigest('daily');
    for (const userId of dailyDigestUsers) {
      await this.sendDailyDigest(userId);
    }

    // Process weekly digests (Mondays)
    if (new Date().getDay() === 1) {
      const weeklyDigestUsers = await this.getUsersForDigest('weekly');
      for (const userId of weeklyDigestUsers) {
        await this.sendWeeklyDigest(userId);
      }
    }

    // Process monthly digests (1st of month)
    if (new Date().getDate() === 1) {
      const monthlyDigestUsers = await this.getUsersForDigest('monthly');
      for (const userId of monthlyDigestUsers) {
        await this.sendMonthlyDigest(userId);
      }
    }
  }

  private async processRecommendationQueue(): Promise<void> {
    const usersForRecommendations = await this.getUsersForRecommendations();
    
    for (const userId of usersForRecommendations) {
      const recommendations = await this.generateRecommendations(userId);
      if (recommendations.length > 0) {
        await this.sendRecommendations(userId, recommendations);
      }
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async queueDigestNotifications(pitchId: number, matches: any[]): Promise<void> {
    // Queue matches for users who prefer digest notifications
    for (const match of matches) {
      if (match.investor.notificationFrequency !== 'instant') {
        await this.addToDigestQueue(match.investor.userId, pitchId, match);
      }
    }
  }

  private isDigestEmpty(digest: MarketplaceDigest): boolean {
    return digest.newMatches.length === 0 && 
           digest.trendingPitches.length === 0 && 
           digest.priceAlerts.length === 0 &&
           digest.portfolioUpdates.length === 0;
  }

  // Database helper methods (these would need actual implementation)
  private async getPitchDetails(pitchId: number): Promise<any> {
    // Implementation would fetch pitch details from database
    return null;
  }

  private async findMatchingInvestors(pitch: any): Promise<Array<{
    investor: any;
    matchScore: number;
    matchReasons: string[];
  }>> {
    // Implementation would match pitch against investor criteria
    return [];
  }

  private async getUsersWhoSavedPitch(pitchId: number): Promise<number[]> {
    // Implementation would fetch users who saved the pitch
    return [];
  }

  private async getUserInvestmentAlerts(): Promise<any[]> {
    // Implementation would fetch user investment alerts
    return [];
  }

  private async getCurrentInvestmentPrice(pitchId: number): Promise<number> {
    // Implementation would fetch current investment price
    return 0;
  }

  private shouldTriggerAlert(userAlert: any, currentPrice: number): boolean {
    // Implementation would check if alert should be triggered
    return false;
  }

  private determineAlertType(userAlert: any, currentPrice: number): PriceAlert['alertType'] {
    // Implementation would determine alert type based on price change
    return 'price_drop';
  }

  private async updateLastKnownPrice(alertId: number, price: number): Promise<void> {
    // Implementation would update last known price
  }

  private async getTrendingSubscribers(): Promise<number[]> {
    // Implementation would fetch users subscribed to trending notifications
    return [];
  }

  private async filterUsersByInterest(users: number[], pitch: TrendingPitch): Promise<number[]> {
    // Implementation would filter users based on their interests
    return [];
  }

  private async getMarketplaceUsers(): Promise<number[]> {
    // Implementation would fetch all marketplace users
    return [];
  }

  private async filterUsersWhoHaventSeenPitch(users: number[], pitchId: number): Promise<number[]> {
    // Implementation would filter out users who already saw the pitch
    return [];
  }

  private async generateMarketplaceDigest(userId: number, digestType: 'daily' | 'weekly' | 'monthly'): Promise<MarketplaceDigest> {
    // Implementation would generate personalized digest
    return {
      userId,
      digestType,
      newMatches: [],
      trendingPitches: [],
      priceAlerts: [],
      portfolioUpdates: [],
      marketInsights: [],
      recommendedActions: []
    };
  }

  private async getTrendingPitches(): Promise<TrendingPitch[]> {
    // Implementation would fetch trending pitches
    return [];
  }

  private async getUsersForDigest(frequency: string): Promise<number[]> {
    // Implementation would fetch users who want digest notifications
    return [];
  }

  private async getUsersForRecommendations(): Promise<number[]> {
    // Implementation would fetch users who want recommendation notifications
    return [];
  }

  private async generateRecommendations(userId: number): Promise<PitchMatch[]> {
    // Implementation would generate AI recommendations
    return [];
  }

  private async addToDigestQueue(userId: number, pitchId: number, match: any): Promise<void> {
    // Implementation would add match to digest queue
  }
}

// Export service factory
export function createMarketplaceNotificationsService(
  db: DatabaseService,
  notificationService: NotificationService
): MarketplaceNotificationsService {
  return new MarketplaceNotificationsService(db, notificationService);
}

// Export types
export type {
  InvestorCriteria,
  PitchMatch,
  PriceAlert,
  TrendingPitch,
  MarketplaceDigest
};