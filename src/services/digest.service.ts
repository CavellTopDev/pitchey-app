/**
 * Digest Service
 * Generates personalized daily/weekly/monthly digest content and insights
 */

import type { DatabaseService } from '../types/worker-types.ts';
import type { NotificationService } from './notification.service.ts';
import type { MarketplaceNotificationsService } from './marketplace-notifications.service.ts';
import type { ProductionNotificationsService } from './production-notifications.service.ts';
import { eq, and, desc, gte, lte, inArray, or, like, count, sql } from 'drizzle-orm';

export interface DigestContent {
  userId: number;
  digestType: 'daily' | 'weekly' | 'monthly';
  generatedAt: Date;
  personalizedSummary: string;
  
  // Core content sections
  highlights: DigestHighlight[];
  activitySummary: ActivitySummary;
  recommendations: DigestRecommendation[];
  marketInsights: MarketInsight[];
  performanceMetrics: PerformanceMetrics;
  upcomingEvents: UpcomingEvent[];
  actionItems: ActionItem[];
  
  // Engagement data
  totalNotifications: number;
  unreadCount: number;
  engagementScore: number;
  trendingTopics: string[];
}

export interface DigestHighlight {
  type: 'achievement' | 'milestone' | 'opportunity' | 'alert' | 'success';
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  actionUrl?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface ActivitySummary {
  timeframe: string;
  
  // General activity
  pitchesViewed: number;
  pitchesCreated: number;
  pitchesUpdated: number;
  
  // Investment activity
  investmentsMade: number;
  totalInvestmentAmount: number;
  newOpportunities: number;
  portfolioChange: number; // percentage
  
  // Production activity
  submissionsReceived: number;
  submissionsProcessed: number;
  meetingsScheduled: number;
  contractsSigned: number;
  
  // Social activity
  messagesReceived: number;
  messagesSent: number;
  collaborationRequests: number;
  networkGrowth: number;
  
  // Engagement metrics
  timeSpentOnPlatform: number; // minutes
  featuresUsed: string[];
  mostActiveDay: string;
  topInterests: string[];
}

export interface DigestRecommendation {
  type: 'pitch' | 'investor' | 'production_company' | 'content' | 'feature';
  title: string;
  description: string;
  reason: string;
  confidence: number; // 0-100
  actionUrl: string;
  metadata: Record<string, any>;
  priority: 'high' | 'medium' | 'low';
}

export interface MarketInsight {
  category: 'genre_trend' | 'budget_analysis' | 'investment_pattern' | 'geographic_trend' | 'seasonal_trend';
  title: string;
  summary: string;
  keyPoints: string[];
  dataVisualization?: {
    type: 'chart' | 'graph' | 'heatmap';
    data: any;
  };
  implications: string[];
  recommendations: string[];
  confidence: number;
  sources: string[];
}

export interface PerformanceMetrics {
  // Portfolio performance (for investors)
  portfolioValue?: number;
  portfolioChange?: number;
  portfolioRoi?: number;
  topPerformingInvestments?: Array<{
    pitchTitle: string;
    roi: number;
    value: number;
  }>;
  
  // Pitch performance (for creators)
  pitchViews?: number;
  pitchSaves?: number;
  pitchShares?: number;
  submissionAcceptanceRate?: number;
  averageRating?: number;
  
  // Production metrics (for production companies)
  submissionsReceived?: number;
  projectsInDevelopment?: number;
  averageReviewTime?: number;
  successRate?: number;
  
  // Engagement metrics
  profileViews: number;
  networkConnections: number;
  messageResponseRate: number;
  platformEngagement: number;
}

export interface UpcomingEvent {
  type: 'meeting' | 'deadline' | 'milestone' | 'launch' | 'review';
  title: string;
  description: string;
  date: Date;
  priority: 'high' | 'medium' | 'low';
  actionRequired: boolean;
  actionUrl?: string;
  relatedEntityId?: number;
}

export interface ActionItem {
  type: 'review_required' | 'response_needed' | 'update_available' | 'opportunity' | 'urgent';
  title: string;
  description: string;
  dueDate?: Date;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  estimatedTime: number; // minutes
  actionUrl: string;
  completed: boolean;
  category: string;
}

export interface UserDigestProfile {
  userId: number;
  userRole: 'creator' | 'investor' | 'production_company';
  preferences: {
    digestFrequency: 'daily' | 'weekly' | 'monthly';
    preferredSections: string[];
    detailLevel: 'summary' | 'detailed' | 'comprehensive';
    includeMarketInsights: boolean;
    includeRecommendations: boolean;
    includePerformanceMetrics: boolean;
    maxRecommendations: number;
  };
  interests: string[];
  activityPattern: {
    mostActiveHours: number[];
    preferredContentTypes: string[];
    engagementHistory: Array<{
      date: Date;
      engagementScore: number;
    }>;
  };
  lastDigestSent: Date;
}

export class DigestService {
  constructor(
    private db: DatabaseService,
    private notificationService: NotificationService,
    private marketplaceNotifications: MarketplaceNotificationsService,
    private productionNotifications: ProductionNotificationsService
  ) {}

  // ============================================================================
  // DIGEST GENERATION
  // ============================================================================

  /**
   * Generate personalized digest for a user
   */
  async generateDigest(userId: number, digestType: 'daily' | 'weekly' | 'monthly'): Promise<DigestContent> {
    try {
      const userProfile = await this.getUserDigestProfile(userId);
      const timeframe = this.getTimeframe(digestType);
      
      // Generate all digest sections in parallel for performance
      const [
        highlights,
        activitySummary,
        recommendations,
        marketInsights,
        performanceMetrics,
        upcomingEvents,
        actionItems
      ] = await Promise.all([
        this.generateHighlights(userId, timeframe, userProfile),
        this.generateActivitySummary(userId, timeframe, userProfile),
        this.generateRecommendations(userId, userProfile),
        this.generateMarketInsights(userId, timeframe, userProfile),
        this.generatePerformanceMetrics(userId, timeframe, userProfile),
        this.generateUpcomingEvents(userId),
        this.generateActionItems(userId)
      ]);

      // Generate personalized summary
      const personalizedSummary = await this.generatePersonalizedSummary(
        userProfile,
        activitySummary,
        highlights,
        digestType
      );

      // Calculate engagement metrics
      const totalNotifications = await this.getTotalNotificationsCount(userId, timeframe);
      const unreadCount = await this.getUnreadNotificationsCount(userId);
      const engagementScore = this.calculateEngagementScore(activitySummary, highlights);
      const trendingTopics = await this.getTrendingTopics(userId, timeframe);

      const digest: DigestContent = {
        userId,
        digestType,
        generatedAt: new Date(),
        personalizedSummary,
        highlights,
        activitySummary,
        recommendations,
        marketInsights,
        performanceMetrics,
        upcomingEvents,
        actionItems,
        totalNotifications,
        unreadCount,
        engagementScore,
        trendingTopics
      };

      // Store digest for future reference
      await this.storeDigest(digest);

      return digest;
    } catch (error) {
      console.error(`Error generating ${digestType} digest for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Send digest notification to user
   */
  async sendDigestNotification(userId: number, digest: DigestContent): Promise<void> {
    try {
      const digestTitles = {
        daily: `📰 Daily Digest - ${digest.highlights.length} highlights`,
        weekly: `📊 Weekly Report - ${digest.activitySummary.pitchesViewed} pitches explored`,
        monthly: `📈 Monthly Analytics - Performance & Insights`
      };

      const digestMessages = {
        daily: `Your personalized daily digest with activity summary and new opportunities.`,
        weekly: `Your comprehensive weekly report with performance insights and market trends.`,
        monthly: `Your detailed monthly analytics with portfolio performance and strategic insights.`
      };

      await this.notificationService.sendNotification({
        userId,
        type: 'marketing',
        title: digestTitles[digest.digestType],
        message: digestMessages[digest.digestType],
        priority: 'low',
        actionUrl: `/digest/${digest.digestType}?date=${digest.generatedAt.toISOString().split('T')[0]}`,
        metadata: {
          digestId: `${userId}_${digest.digestType}_${digest.generatedAt.toISOString()}`,
          highlightsCount: digest.highlights.length,
          recommendationsCount: digest.recommendations.length,
          engagementScore: digest.engagementScore,
          unreadCount: digest.unreadCount
        },
        emailOptions: {
          templateType: 'digest_notification',
          variables: {
            digestType: digest.digestType,
            personalizedSummary: digest.personalizedSummary,
            highlights: digest.highlights.slice(0, 5), // Top 5 highlights
            activitySummary: digest.activitySummary,
            recommendations: digest.recommendations.slice(0, 3), // Top 3 recommendations
            upcomingEvents: digest.upcomingEvents.slice(0, 3),
            actionItems: digest.actionItems.filter(item => !item.completed).slice(0, 5),
            engagementScore: digest.engagementScore,
            generatedDate: digest.generatedAt.toLocaleDateString()
          }
        }
      });

      // Update last digest sent timestamp
      await this.updateLastDigestSent(userId, digest.digestType);

    } catch (error) {
      console.error(`Error sending digest notification to user ${userId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // DIGEST SECTION GENERATORS
  // ============================================================================

  /**
   * Generate highlights for the digest
   */
  private async generateHighlights(
    userId: number,
    timeframe: { start: Date; end: Date },
    userProfile: UserDigestProfile
  ): Promise<DigestHighlight[]> {
    const highlights: DigestHighlight[] = [];

    try {
      // Get user activities and achievements
      const [
        recentAchievements,
        importantUpdates,
        newOpportunities,
        milestoneEvents,
        alerts
      ] = await Promise.all([
        this.getRecentAchievements(userId, timeframe),
        this.getImportantUpdates(userId, timeframe),
        this.getNewOpportunities(userId, timeframe),
        this.getMilestoneEvents(userId, timeframe),
        this.getImportantAlerts(userId, timeframe)
      ]);

      // Convert to highlight format
      recentAchievements.forEach(achievement => {
        highlights.push({
          type: 'achievement',
          title: achievement.title,
          description: achievement.description,
          importance: 'high',
          timestamp: achievement.createdAt,
          metadata: achievement.metadata
        });
      });

      newOpportunities.forEach(opportunity => {
        highlights.push({
          type: 'opportunity',
          title: opportunity.title,
          description: opportunity.description,
          importance: 'medium',
          actionUrl: opportunity.actionUrl,
          timestamp: opportunity.createdAt,
          metadata: opportunity.metadata
        });
      });

      milestoneEvents.forEach(milestone => {
        highlights.push({
          type: 'milestone',
          title: milestone.title,
          description: milestone.description,
          importance: 'high',
          timestamp: milestone.completedAt,
          metadata: milestone.metadata
        });
      });

      alerts.forEach(alert => {
        highlights.push({
          type: 'alert',
          title: alert.title,
          description: alert.description,
          importance: alert.severity === 'urgent' ? 'high' : 'medium',
          actionUrl: alert.actionUrl,
          timestamp: alert.createdAt,
          metadata: alert.metadata
        });
      });

      // Sort by importance and timestamp
      return highlights
        .sort((a, b) => {
          const importanceOrder = { high: 3, medium: 2, low: 1 };
          const importanceDiff = importanceOrder[b.importance] - importanceOrder[a.importance];
          if (importanceDiff !== 0) return importanceDiff;
          return b.timestamp.getTime() - a.timestamp.getTime();
        })
        .slice(0, 10); // Top 10 highlights

    } catch (error) {
      console.error('Error generating highlights:', error);
      return [];
    }
  }

  /**
   * Generate activity summary
   */
  private async generateActivitySummary(
    userId: number,
    timeframe: { start: Date; end: Date },
    userProfile: UserDigestProfile
  ): Promise<ActivitySummary> {
    try {
      const timeframeName = this.getTimeframeName(timeframe);

      // Get activity metrics based on user role
      const baseMetrics = await this.getBaseActivityMetrics(userId, timeframe);
      const roleSpecificMetrics = await this.getRoleSpecificMetrics(userId, timeframe, userProfile.userRole);
      const engagementMetrics = await this.getEngagementMetrics(userId, timeframe);

      return {
        timeframe: timeframeName,
        ...baseMetrics,
        ...roleSpecificMetrics,
        ...engagementMetrics
      };

    } catch (error) {
      console.error('Error generating activity summary:', error);
      return this.getEmptyActivitySummary();
    }
  }

  /**
   * Generate personalized recommendations
   */
  private async generateRecommendations(
    userId: number,
    userProfile: UserDigestProfile
  ): Promise<DigestRecommendation[]> {
    try {
      const recommendations: DigestRecommendation[] = [];
      const maxRecommendations = userProfile.preferences.maxRecommendations || 5;

      // Get AI-powered recommendations based on user behavior
      const aiRecommendations = await this.getAIRecommendations(userId, userProfile);
      
      // Get trending content recommendations
      const trendingRecommendations = await this.getTrendingRecommendations(userId, userProfile);
      
      // Get personalized feature recommendations
      const featureRecommendations = await this.getFeatureRecommendations(userId, userProfile);

      // Combine and prioritize recommendations
      const allRecommendations = [
        ...aiRecommendations,
        ...trendingRecommendations,
        ...featureRecommendations
      ];

      // Score and sort recommendations
      const scoredRecommendations = allRecommendations
        .map(rec => ({
          ...rec,
          score: this.calculateRecommendationScore(rec, userProfile)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxRecommendations);

      return scoredRecommendations;

    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [];
    }
  }

  /**
   * Generate market insights
   */
  private async generateMarketInsights(
    userId: number,
    timeframe: { start: Date; end: Date },
    userProfile: UserDigestProfile
  ): Promise<MarketInsight[]> {
    if (!userProfile.preferences.includeMarketInsights) {
      return [];
    }

    try {
      const insights: MarketInsight[] = [];

      // Generate insights based on user interests and role
      const userInterests = userProfile.interests;
      const userRole = userProfile.userRole;

      // Genre trend analysis
      if (userInterests.includes('market_trends')) {
        const genreTrends = await this.analyzeGenreTrends(timeframe, userInterests);
        if (genreTrends) insights.push(genreTrends);
      }

      // Investment pattern analysis (for investors)
      if (userRole === 'investor') {
        const investmentPatterns = await this.analyzeInvestmentPatterns(timeframe);
        if (investmentPatterns) insights.push(investmentPatterns);
      }

      // Budget analysis (for creators and production companies)
      if (userRole === 'creator' || userRole === 'production_company') {
        const budgetAnalysis = await this.analyzeBudgetTrends(timeframe, userInterests);
        if (budgetAnalysis) insights.push(budgetAnalysis);
      }

      // Geographic trends
      const geographicTrends = await this.analyzeGeographicTrends(timeframe);
      if (geographicTrends) insights.push(geographicTrends);

      return insights.slice(0, 3); // Top 3 insights

    } catch (error) {
      console.error('Error generating market insights:', error);
      return [];
    }
  }

  /**
   * Generate performance metrics
   */
  private async generatePerformanceMetrics(
    userId: number,
    timeframe: { start: Date; end: Date },
    userProfile: UserDigestProfile
  ): Promise<PerformanceMetrics> {
    if (!userProfile.preferences.includePerformanceMetrics) {
      return { profileViews: 0, networkConnections: 0, messageResponseRate: 0, platformEngagement: 0 };
    }

    try {
      const baseMetrics = await this.getBasePerformanceMetrics(userId, timeframe);
      const roleSpecificMetrics = await this.getRoleSpecificPerformanceMetrics(
        userId, 
        timeframe, 
        userProfile.userRole
      );

      return {
        ...baseMetrics,
        ...roleSpecificMetrics
      };

    } catch (error) {
      console.error('Error generating performance metrics:', error);
      return { profileViews: 0, networkConnections: 0, messageResponseRate: 0, platformEngagement: 0 };
    }
  }

  /**
   * Generate upcoming events
   */
  private async generateUpcomingEvents(userId: number): Promise<UpcomingEvent[]> {
    try {
      const events: UpcomingEvent[] = [];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Get upcoming meetings
      const upcomingMeetings = await this.getUpcomingMeetings(userId, nextWeek);
      events.push(...upcomingMeetings.map(meeting => ({
        type: 'meeting' as const,
        title: meeting.title,
        description: meeting.description,
        date: meeting.scheduledAt,
        priority: meeting.priority || 'medium',
        actionRequired: meeting.requiresPreparation,
        actionUrl: `/meetings/${meeting.id}`,
        relatedEntityId: meeting.id
      })));

      // Get upcoming deadlines
      const upcomingDeadlines = await this.getUpcomingDeadlines(userId, nextWeek);
      events.push(...upcomingDeadlines.map(deadline => ({
        type: 'deadline' as const,
        title: deadline.title,
        description: deadline.description,
        date: deadline.dueDate,
        priority: deadline.priority || 'high',
        actionRequired: true,
        actionUrl: deadline.actionUrl,
        relatedEntityId: deadline.relatedId
      })));

      // Get upcoming milestones
      const upcomingMilestones = await this.getUpcomingMilestones(userId, nextWeek);
      events.push(...upcomingMilestones.map(milestone => ({
        type: 'milestone' as const,
        title: milestone.title,
        description: milestone.description,
        date: milestone.dueDate,
        priority: milestone.priority || 'medium',
        actionRequired: milestone.requiresAction,
        actionUrl: milestone.actionUrl,
        relatedEntityId: milestone.id
      })));

      // Sort by date and priority
      return events
        .sort((a, b) => {
          const dateDiff = a.date.getTime() - b.date.getTime();
          if (dateDiff !== 0) return dateDiff;
          
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        })
        .slice(0, 8); // Next 8 events

    } catch (error) {
      console.error('Error generating upcoming events:', error);
      return [];
    }
  }

  /**
   * Generate action items
   */
  private async generateActionItems(userId: number): Promise<ActionItem[]> {
    try {
      const actionItems: ActionItem[] = [];

      // Get pending reviews
      const pendingReviews = await this.getPendingReviews(userId);
      actionItems.push(...pendingReviews.map(review => ({
        type: 'review_required' as const,
        title: review.title,
        description: review.description,
        dueDate: review.dueDate,
        priority: review.priority || 'medium',
        estimatedTime: review.estimatedTime || 15,
        actionUrl: review.actionUrl,
        completed: false,
        category: 'Reviews'
      })));

      // Get responses needed
      const responsesNeeded = await this.getResponsesNeeded(userId);
      actionItems.push(...responsesNeeded.map(response => ({
        type: 'response_needed' as const,
        title: response.title,
        description: response.description,
        dueDate: response.dueDate,
        priority: response.priority || 'high',
        estimatedTime: response.estimatedTime || 10,
        actionUrl: response.actionUrl,
        completed: false,
        category: 'Communications'
      })));

      // Get available updates
      const availableUpdates = await this.getAvailableUpdates(userId);
      actionItems.push(...availableUpdates.map(update => ({
        type: 'update_available' as const,
        title: update.title,
        description: update.description,
        priority: 'low' as const,
        estimatedTime: update.estimatedTime || 5,
        actionUrl: update.actionUrl,
        completed: false,
        category: 'Updates'
      })));

      // Get new opportunities that require action
      const actionableOpportunities = await this.getActionableOpportunities(userId);
      actionItems.push(...actionableOpportunities.map(opportunity => ({
        type: 'opportunity' as const,
        title: opportunity.title,
        description: opportunity.description,
        dueDate: opportunity.expiresAt,
        priority: opportunity.priority || 'medium',
        estimatedTime: opportunity.estimatedTime || 20,
        actionUrl: opportunity.actionUrl,
        completed: false,
        category: 'Opportunities'
      })));

      // Sort by priority and due date
      return actionItems
        .sort((a, b) => {
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
          if (priorityDiff !== 0) return priorityDiff;
          
          if (a.dueDate && b.dueDate) {
            return a.dueDate.getTime() - b.dueDate.getTime();
          }
          return a.dueDate ? -1 : 1;
        })
        .slice(0, 10); // Top 10 action items

    } catch (error) {
      console.error('Error generating action items:', error);
      return [];
    }
  }

  // ============================================================================
  // BATCH PROCESSING
  // ============================================================================

  /**
   * Process daily digests for all users
   */
  async processDailyDigests(): Promise<void> {
    try {
      const usersForDailyDigest = await this.getUsersForDigest('daily');
      console.log(`Processing daily digests for ${usersForDailyDigest.length} users`);

      for (const userId of usersForDailyDigest) {
        try {
          const digest = await this.generateDigest(userId, 'daily');
          await this.sendDigestNotification(userId, digest);
          
          // Small delay to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error processing daily digest for user ${userId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing daily digests:', error);
    }
  }

  /**
   * Process weekly digests for all users
   */
  async processWeeklyDigests(): Promise<void> {
    try {
      const usersForWeeklyDigest = await this.getUsersForDigest('weekly');
      console.log(`Processing weekly digests for ${usersForWeeklyDigest.length} users`);

      for (const userId of usersForWeeklyDigest) {
        try {
          const digest = await this.generateDigest(userId, 'weekly');
          await this.sendDigestNotification(userId, digest);
          
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Error processing weekly digest for user ${userId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing weekly digests:', error);
    }
  }

  /**
   * Process monthly digests for all users
   */
  async processMonthlyDigests(): Promise<void> {
    try {
      const usersForMonthlyDigest = await this.getUsersForDigest('monthly');
      console.log(`Processing monthly digests for ${usersForMonthlyDigest.length} users`);

      for (const userId of usersForMonthlyDigest) {
        try {
          const digest = await this.generateDigest(userId, 'monthly');
          await this.sendDigestNotification(userId, digest);
          
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`Error processing monthly digest for user ${userId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing monthly digests:', error);
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getTimeframe(digestType: 'daily' | 'weekly' | 'monthly'): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (digestType) {
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
    }

    return { start, end };
  }

  private getTimeframeName(timeframe: { start: Date; end: Date }): string {
    const days = Math.ceil((timeframe.end.getTime() - timeframe.start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (days <= 1) return 'last 24 hours';
    if (days <= 7) return 'last week';
    if (days <= 30) return 'last month';
    return `last ${days} days`;
  }

  private calculateEngagementScore(activitySummary: ActivitySummary, highlights: DigestHighlight[]): number {
    // Simple engagement scoring algorithm
    let score = 0;

    // Activity-based scoring
    score += Math.min(activitySummary.pitchesViewed * 2, 30);
    score += Math.min(activitySummary.timeSpentOnPlatform / 10, 20);
    score += Math.min(activitySummary.messagesReceived + activitySummary.messagesSent, 15);
    score += Math.min(activitySummary.investmentsMade * 10, 20);

    // Highlight-based scoring
    score += highlights.filter(h => h.importance === 'high').length * 5;
    score += highlights.filter(h => h.importance === 'medium').length * 3;

    // Feature usage scoring
    score += Math.min(activitySummary.featuresUsed.length * 2, 15);

    return Math.min(Math.round(score), 100);
  }

  private calculateRecommendationScore(
    recommendation: DigestRecommendation, 
    userProfile: UserDigestProfile
  ): number {
    let score = recommendation.confidence;

    // Boost score based on user interests
    if (userProfile.interests.some(interest => 
      recommendation.description.toLowerCase().includes(interest.toLowerCase())
    )) {
      score += 20;
    }

    // Boost score based on engagement history
    const avgEngagement = userProfile.activityPattern.engagementHistory
      .reduce((sum, h) => sum + h.engagementScore, 0) / 
      userProfile.activityPattern.engagementHistory.length;
    
    if (avgEngagement > 70) score += 10;

    return Math.min(score, 100);
  }

  private async generatePersonalizedSummary(
    userProfile: UserDigestProfile,
    activitySummary: ActivitySummary,
    highlights: DigestHighlight[],
    digestType: string
  ): Promise<string> {
    // Generate a personalized summary based on user data
    const topHighlight = highlights[0];
    const timeframe = digestType === 'daily' ? 'yesterday' : `this ${digestType.replace('ly', '')}`;
    
    let summary = `Here's what happened ${timeframe}: `;
    
    if (activitySummary.pitchesViewed > 0) {
      summary += `You explored ${activitySummary.pitchesViewed} pitches`;
      if (activitySummary.investmentsMade > 0) {
        summary += ` and made ${activitySummary.investmentsMade} investment${activitySummary.investmentsMade > 1 ? 's' : ''}`;
      }
      summary += '. ';
    }
    
    if (topHighlight) {
      summary += `${topHighlight.description} `;
    }
    
    if (activitySummary.timeSpentOnPlatform > 60) {
      summary += `You spent ${Math.round(activitySummary.timeSpentOnPlatform / 60)} hours engaged with the platform. `;
    }
    
    return summary;
  }

  private getEmptyActivitySummary(): ActivitySummary {
    return {
      timeframe: '',
      pitchesViewed: 0,
      pitchesCreated: 0,
      pitchesUpdated: 0,
      investmentsMade: 0,
      totalInvestmentAmount: 0,
      newOpportunities: 0,
      portfolioChange: 0,
      submissionsReceived: 0,
      submissionsProcessed: 0,
      meetingsScheduled: 0,
      contractsSigned: 0,
      messagesReceived: 0,
      messagesSent: 0,
      collaborationRequests: 0,
      networkGrowth: 0,
      timeSpentOnPlatform: 0,
      featuresUsed: [],
      mostActiveDay: '',
      topInterests: []
    };
  }

  // Database helper methods (would need actual implementation)
  private async getUserDigestProfile(userId: number): Promise<UserDigestProfile> {
    // Implementation would fetch user digest profile
    return {
      userId,
      userRole: 'creator',
      preferences: {
        digestFrequency: 'daily',
        preferredSections: [],
        detailLevel: 'detailed',
        includeMarketInsights: true,
        includeRecommendations: true,
        includePerformanceMetrics: true,
        maxRecommendations: 5
      },
      interests: [],
      activityPattern: {
        mostActiveHours: [],
        preferredContentTypes: [],
        engagementHistory: []
      },
      lastDigestSent: new Date()
    };
  }

  private async storeDigest(digest: DigestContent): Promise<void> {
    // Implementation would store digest in database
  }

  private async updateLastDigestSent(userId: number, digestType: string): Promise<void> {
    // Implementation would update last digest sent timestamp
  }

  private async getUsersForDigest(digestType: string): Promise<number[]> {
    // Implementation would fetch users who want this digest type
    return [];
  }

  // Activity and metrics helper methods
  private async getRecentAchievements(userId: number, timeframe: any): Promise<any[]> {
    return [];
  }

  private async getImportantUpdates(userId: number, timeframe: any): Promise<any[]> {
    return [];
  }

  private async getNewOpportunities(userId: number, timeframe: any): Promise<any[]> {
    return [];
  }

  private async getMilestoneEvents(userId: number, timeframe: any): Promise<any[]> {
    return [];
  }

  private async getImportantAlerts(userId: number, timeframe: any): Promise<any[]> {
    return [];
  }

  private async getBaseActivityMetrics(userId: number, timeframe: any): Promise<Partial<ActivitySummary>> {
    return {};
  }

  private async getRoleSpecificMetrics(userId: number, timeframe: any, role: string): Promise<Partial<ActivitySummary>> {
    return {};
  }

  private async getEngagementMetrics(userId: number, timeframe: any): Promise<Partial<ActivitySummary>> {
    return {};
  }

  private async getAIRecommendations(userId: number, userProfile: UserDigestProfile): Promise<DigestRecommendation[]> {
    return [];
  }

  private async getTrendingRecommendations(userId: number, userProfile: UserDigestProfile): Promise<DigestRecommendation[]> {
    return [];
  }

  private async getFeatureRecommendations(userId: number, userProfile: UserDigestProfile): Promise<DigestRecommendation[]> {
    return [];
  }

  private async analyzeGenreTrends(timeframe: any, interests: string[]): Promise<MarketInsight | null> {
    return null;
  }

  private async analyzeInvestmentPatterns(timeframe: any): Promise<MarketInsight | null> {
    return null;
  }

  private async analyzeBudgetTrends(timeframe: any, interests: string[]): Promise<MarketInsight | null> {
    return null;
  }

  private async analyzeGeographicTrends(timeframe: any): Promise<MarketInsight | null> {
    return null;
  }

  private async getBasePerformanceMetrics(userId: number, timeframe: any): Promise<Partial<PerformanceMetrics>> {
    return {};
  }

  private async getRoleSpecificPerformanceMetrics(userId: number, timeframe: any, role: string): Promise<Partial<PerformanceMetrics>> {
    return {};
  }

  private async getUpcomingMeetings(userId: number, until: Date): Promise<any[]> {
    return [];
  }

  private async getUpcomingDeadlines(userId: number, until: Date): Promise<any[]> {
    return [];
  }

  private async getUpcomingMilestones(userId: number, until: Date): Promise<any[]> {
    return [];
  }

  private async getPendingReviews(userId: number): Promise<any[]> {
    return [];
  }

  private async getResponsesNeeded(userId: number): Promise<any[]> {
    return [];
  }

  private async getAvailableUpdates(userId: number): Promise<any[]> {
    return [];
  }

  private async getActionableOpportunities(userId: number): Promise<any[]> {
    return [];
  }

  private async getTotalNotificationsCount(userId: number, timeframe: any): Promise<number> {
    return 0;
  }

  private async getUnreadNotificationsCount(userId: number): Promise<number> {
    return 0;
  }

  private async getTrendingTopics(userId: number, timeframe: any): Promise<string[]> {
    return [];
  }
}

// Export service factory
export function createDigestService(
  db: DatabaseService,
  notificationService: NotificationService,
  marketplaceNotifications: MarketplaceNotificationsService,
  productionNotifications: ProductionNotificationsService
): DigestService {
  return new DigestService(db, notificationService, marketplaceNotifications, productionNotifications);
}

// Export types
export type {
  DigestContent,
  DigestHighlight,
  ActivitySummary,
  DigestRecommendation,
  MarketInsight,
  PerformanceMetrics,
  UpcomingEvent,
  ActionItem,
  UserDigestProfile
};