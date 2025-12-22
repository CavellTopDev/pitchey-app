/**
 * Marketplace Monitor Worker
 * Background worker for monitoring marketplace activities and generating notifications
 */

import type { DatabaseService } from '../types/worker-types.ts';
import type { MarketplaceNotificationsService, InvestorCriteria, PitchMatch, PriceAlert, TrendingPitch } from '../services/marketplace-notifications.service.ts';
import { eq, and, desc, gte, lte, inArray, or, like, count, sql } from 'drizzle-orm';

export interface MonitoringConfig {
  pitchMatchingInterval: number; // minutes
  priceMonitoringInterval: number; // minutes
  trendingAnalysisInterval: number; // minutes
  recommendationInterval: number; // hours
  maxMatchesPerUser: number;
  trendingThresholds: {
    viewIncrease: number; // percentage
    savesIncrease: number; // percentage
    sharesIncrease: number; // percentage
    minimumViews: number;
  };
  priceChangeThreshold: number; // percentage
}

export interface MarketInsight {
  type: 'genre_trend' | 'budget_trend' | 'regional_trend' | 'format_trend' | 'investment_pattern';
  title: string;
  description: string;
  data: Record<string, any>;
  timeframe: '24h' | '7d' | '30d' | '90d';
  confidence: number; // 0-100
  actionable: boolean;
  recommendations: string[];
}

export interface RecommendationContext {
  userId: number;
  viewHistory: number[];
  investmentHistory: number[];
  savedPitches: number[];
  followedCreators: number[];
  searchQueries: string[];
  interactionPatterns: Record<string, number>;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  portfolioBalance: Record<string, number>;
}

export class MarketplaceMonitorWorker {
  private isRunning = false;
  private intervals: NodeJS.Timeout[] = [];
  private config: MonitoringConfig;

  constructor(
    private db: DatabaseService,
    private marketplaceNotifications: MarketplaceNotificationsService,
    config?: Partial<MonitoringConfig>
  ) {
    this.config = {
      pitchMatchingInterval: 15, // 15 minutes
      priceMonitoringInterval: 5, // 5 minutes
      trendingAnalysisInterval: 30, // 30 minutes
      recommendationInterval: 24, // 24 hours
      maxMatchesPerUser: 50,
      trendingThresholds: {
        viewIncrease: 20, // 20% increase
        savesIncrease: 15, // 15% increase
        sharesIncrease: 10, // 10% increase
        minimumViews: 100
      },
      priceChangeThreshold: 5, // 5% change
      ...config
    };
  }

  // ============================================================================
  // WORKER LIFECYCLE
  // ============================================================================

  /**
   * Start all monitoring tasks
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Marketplace monitor worker is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting marketplace monitor worker...');

    try {
      // Start all monitoring intervals
      this.intervals.push(
        setInterval(
          () => this.monitorNewPitchMatches(),
          this.config.pitchMatchingInterval * 60 * 1000
        ),
        setInterval(
          () => this.monitorPriceChanges(),
          this.config.priceMonitoringInterval * 60 * 1000
        ),
        setInterval(
          () => this.analyzeTasking(),
          this.config.trendingAnalysisInterval * 60 * 1000
        ),
        setInterval(
          () => this.generateRecommendations(),
          this.config.recommendationInterval * 60 * 60 * 1000
        )
      );

      // Run initial scans
      await Promise.all([
        this.monitorNewPitchMatches(),
        this.monitorPriceChanges(),
        this.analyzeTasking(),
        this.generateMarketInsights()
      ]);

      console.log('Marketplace monitor worker started successfully');
    } catch (error) {
      console.error('Error starting marketplace monitor worker:', error);
      await this.stop();
      throw error;
    }
  }

  /**
   * Stop all monitoring tasks
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('Stopping marketplace monitor worker...');
    
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    
    this.isRunning = false;
    console.log('Marketplace monitor worker stopped');
  }

  // ============================================================================
  // PITCH MATCHING MONITORING
  // ============================================================================

  /**
   * Monitor for new pitches and match with investor criteria
   */
  private async monitorNewPitchMatches(): Promise<void> {
    try {
      console.log('Monitoring new pitch matches...');

      // Get recently posted pitches (last 15 minutes)
      const recentPitches = await this.getRecentPitches(
        new Date(Date.now() - this.config.pitchMatchingInterval * 60 * 1000)
      );

      if (recentPitches.length === 0) {
        console.log('No new pitches to process');
        return;
      }

      console.log(`Processing ${recentPitches.length} new pitches`);

      // Get all active investor criteria
      const investorCriteria = await this.getActiveInvestorCriteria();

      for (const pitch of recentPitches) {
        try {
          // Find matching investors for this pitch
          const matches = await this.findMatchingInvestors(pitch, investorCriteria);
          
          if (matches.length > 0) {
            console.log(`Found ${matches.length} matches for pitch: ${pitch.title}`);
            
            // Trigger notifications for instant notification users
            await this.marketplaceNotifications.notifyNewPitchMatches(pitch.id);
          }

          // Update pitch processing status
          await this.markPitchAsProcessed(pitch.id);

        } catch (error) {
          console.error(`Error processing pitch ${pitch.id}:`, error);
        }
      }

    } catch (error) {
      console.error('Error monitoring new pitch matches:', error);
    }
  }

  /**
   * Find investors matching a specific pitch
   */
  private async findMatchingInvestors(
    pitch: any,
    allCriteria: InvestorCriteria[]
  ): Promise<Array<{ userId: number; matchScore: number; matchReasons: string[] }>> {
    const matches: Array<{ userId: number; matchScore: number; matchReasons: string[] }> = [];

    for (const criteria of allCriteria) {
      const matchResult = await this.calculateMatchScore(pitch, criteria);
      
      if (matchResult.score >= 60) { // Minimum 60% match required
        matches.push({
          userId: criteria.userId,
          matchScore: matchResult.score,
          matchReasons: matchResult.reasons
        });
      }
    }

    // Sort by match score (highest first)
    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Calculate match score between pitch and investor criteria
   */
  private async calculateMatchScore(
    pitch: any,
    criteria: InvestorCriteria
  ): Promise<{ score: number; reasons: string[] }> {
    const matchFactors: Array<{ factor: string; weight: number; score: number }> = [];
    const reasons: string[] = [];

    // Genre matching (25% weight)
    const genreMatch = this.calculateGenreMatch(pitch.genres, criteria.genres, criteria.excludeGenres);
    matchFactors.push({ factor: 'genre', weight: 25, score: genreMatch.score });
    if (genreMatch.score > 70) reasons.push(`Genre match: ${genreMatch.reason}`);

    // Budget matching (20% weight)
    const budgetMatch = this.calculateBudgetMatch(pitch.budget, criteria.minBudget, criteria.maxBudget);
    matchFactors.push({ factor: 'budget', weight: 20, score: budgetMatch.score });
    if (budgetMatch.score > 70) reasons.push(`Budget fit: ${budgetMatch.reason}`);

    // Format matching (15% weight)
    const formatMatch = this.calculateFormatMatch(pitch.format, criteria.formats);
    matchFactors.push({ factor: 'format', weight: 15, score: formatMatch.score });
    if (formatMatch.score > 70) reasons.push(`Format match: ${formatMatch.reason}`);

    // Risk tolerance matching (15% weight)
    const riskMatch = this.calculateRiskMatch(pitch.riskLevel, criteria.riskTolerance);
    matchFactors.push({ factor: 'risk', weight: 15, score: riskMatch.score });
    if (riskMatch.score > 70) reasons.push(`Risk alignment: ${riskMatch.reason}`);

    // ROI expectations (10% weight)
    if (criteria.minExpectedRoi && pitch.expectedRoi) {
      const roiMatch = this.calculateRoiMatch(pitch.expectedRoi, criteria.minExpectedRoi);
      matchFactors.push({ factor: 'roi', weight: 10, score: roiMatch.score });
      if (roiMatch.score > 70) reasons.push(`ROI potential: ${roiMatch.reason}`);
    }

    // Theme matching (10% weight)
    const themeMatch = this.calculateThemeMatch(pitch.themes, criteria.themes);
    matchFactors.push({ factor: 'theme', weight: 10, score: themeMatch.score });
    if (themeMatch.score > 70) reasons.push(`Theme alignment: ${themeMatch.reason}`);

    // Regional preference (5% weight)
    const regionMatch = this.calculateRegionMatch(pitch.region, criteria.regions);
    matchFactors.push({ factor: 'region', weight: 5, score: regionMatch.score });

    // Calculate weighted average score
    const totalWeight = matchFactors.reduce((sum, factor) => sum + factor.weight, 0);
    const weightedScore = matchFactors.reduce(
      (sum, factor) => sum + (factor.score * factor.weight), 0
    ) / totalWeight;

    return {
      score: Math.round(weightedScore),
      reasons: reasons.length > 0 ? reasons : ['Multiple criteria match']
    };
  }

  // ============================================================================
  // PRICE MONITORING
  // ============================================================================

  /**
   * Monitor price changes on watched pitches
   */
  private async monitorPriceChanges(): Promise<void> {
    try {
      console.log('Monitoring price changes...');

      // Get all price alerts
      const priceAlerts = await this.getActivePriceAlerts();

      if (priceAlerts.length === 0) {
        console.log('No active price alerts to monitor');
        return;
      }

      const triggeredAlerts: PriceAlert[] = [];

      for (const alert of priceAlerts) {
        try {
          const currentPrice = await this.getCurrentPrice(alert.pitchId, alert.investmentType);
          const priceChange = this.calculatePriceChange(alert.lastKnownPrice, currentPrice);

          if (this.shouldTriggerPriceAlert(alert, priceChange)) {
            triggeredAlerts.push({
              pitchId: alert.pitchId,
              userId: alert.userId,
              alertType: this.determinePriceAlertType(alert, priceChange),
              previousValue: alert.lastKnownPrice,
              currentValue: currentPrice,
              threshold: alert.threshold,
              percentage: priceChange.percentage
            });

            // Update last known price
            await this.updateLastKnownPrice(alert.id, currentPrice);
          }

        } catch (error) {
          console.error(`Error monitoring price for alert ${alert.id}:`, error);
        }
      }

      if (triggeredAlerts.length > 0) {
        console.log(`Triggering ${triggeredAlerts.length} price alerts`);
        await this.marketplaceNotifications.sendPriceAlerts(triggeredAlerts);
      }

    } catch (error) {
      console.error('Error monitoring price changes:', error);
    }
  }

  // ============================================================================
  // TRENDING ANALYSIS
  // ============================================================================

  /**
   * Analyze trending pitches and generate notifications
   */
  private async analyzeTasking(): Promise<void> {
    try {
      console.log('Analyzing trending pitches...');

      const trendingPitches = await this.identifyTrendingPitches();

      if (trendingPitches.length === 0) {
        console.log('No trending pitches identified');
        return;
      }

      console.log(`Found ${trendingPitches.length} trending pitches`);
      await this.marketplaceNotifications.notifyTrendingPitches(trendingPitches);

      // Update trending status in database
      await this.updateTrendingStatus(trendingPitches.map(p => p.pitchId));

    } catch (error) {
      console.error('Error analyzing trending pitches:', error);
    }
  }

  /**
   * Identify trending pitches based on activity metrics
   */
  private async identifyTrendingPitches(): Promise<TrendingPitch[]> {
    try {
      // Get pitch metrics for the last 24 hours and compare with previous period
      const currentMetrics = await this.getPitchMetrics('24h');
      const previousMetrics = await this.getPitchMetrics('24h', new Date(Date.now() - 24 * 60 * 60 * 1000));

      const trendingPitches: TrendingPitch[] = [];

      for (const current of currentMetrics) {
        const previous = previousMetrics.find(p => p.pitchId === current.pitchId);
        
        if (!previous || current.views < this.config.trendingThresholds.minimumViews) {
          continue;
        }

        const viewIncrease = this.calculatePercentageIncrease(previous.views, current.views);
        const savesIncrease = this.calculatePercentageIncrease(previous.saves, current.saves);
        const sharesIncrease = this.calculatePercentageIncrease(previous.shares, current.shares);

        // Check if any metric exceeds trending thresholds
        const isTrendingByViews = viewIncrease >= this.config.trendingThresholds.viewIncrease;
        const isTrendingBySaves = savesIncrease >= this.config.trendingThresholds.savesIncrease;
        const isTrendingByShares = sharesIncrease >= this.config.trendingThresholds.sharesIncrease;

        if (isTrendingByViews || isTrendingBySaves || isTrendingByShares) {
          const trendingScore = this.calculateTrendingScore(viewIncrease, savesIncrease, sharesIncrease);
          const reason = this.generateTrendingReason(viewIncrease, savesIncrease, sharesIncrease);

          trendingPitches.push({
            pitchId: current.pitchId,
            title: current.title,
            creatorName: current.creatorName,
            genre: current.genre,
            trendingScore,
            viewIncrease,
            savesIncrease,
            sharesIncrease,
            timeframe: '24h',
            reason
          });
        }
      }

      // Sort by trending score (highest first) and limit results
      return trendingPitches
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, 10); // Top 10 trending pitches

    } catch (error) {
      console.error('Error identifying trending pitches:', error);
      return [];
    }
  }

  // ============================================================================
  // RECOMMENDATION ENGINE
  // ============================================================================

  /**
   * Generate AI-powered recommendations for users
   */
  private async generateRecommendations(): Promise<void> {
    try {
      console.log('Generating personalized recommendations...');

      // Get users who want recommendation notifications
      const users = await this.getUsersForRecommendations();

      for (const userId of users) {
        try {
          const recommendations = await this.generateUserRecommendations(userId);
          
          if (recommendations.length > 0) {
            await this.marketplaceNotifications.sendRecommendations(userId, recommendations);
          }

        } catch (error) {
          console.error(`Error generating recommendations for user ${userId}:`, error);
        }
      }

    } catch (error) {
      console.error('Error generating recommendations:', error);
    }
  }

  /**
   * Generate personalized recommendations for a specific user
   */
  private async generateUserRecommendations(userId: number): Promise<PitchMatch[]> {
    try {
      // Get user context
      const context = await this.getUserRecommendationContext(userId);
      
      // Get available pitches (exclude already seen/invested)
      const availablePitches = await this.getAvailablePitchesForUser(userId);

      if (availablePitches.length === 0) {
        return [];
      }

      // Score each pitch based on user preferences and behavior
      const scoredPitches = await Promise.all(
        availablePitches.map(async (pitch) => {
          const score = await this.calculateRecommendationScore(pitch, context);
          return { ...pitch, score };
        })
      );

      // Filter and sort recommendations
      const recommendations = scoredPitches
        .filter(pitch => pitch.score >= 70) // Minimum 70% recommendation score
        .sort((a, b) => b.score - a.score)
        .slice(0, 5) // Top 5 recommendations
        .map(pitch => ({
          pitchId: pitch.id,
          pitchTitle: pitch.title,
          creatorId: pitch.creatorId,
          creatorName: pitch.creatorName,
          matchScore: pitch.score,
          matchReasons: pitch.matchReasons || [],
          budget: pitch.budget,
          genre: pitch.genre,
          format: pitch.format,
          themes: pitch.themes || [],
          expectedRoi: pitch.expectedRoi,
          riskLevel: pitch.riskLevel,
          synopsis: pitch.synopsis,
          newlyPosted: this.isNewlyPosted(pitch.createdAt),
          trending: pitch.isTrending || false
        }));

      return recommendations;

    } catch (error) {
      console.error(`Error generating recommendations for user ${userId}:`, error);
      return [];
    }
  }

  // ============================================================================
  // MARKET INSIGHTS GENERATION
  // ============================================================================

  /**
   * Generate market insights and trends
   */
  private async generateMarketInsights(): Promise<MarketInsight[]> {
    try {
      console.log('Generating market insights...');

      const insights: MarketInsight[] = [];

      // Analyze genre trends
      const genreTrends = await this.analyzeGenreTrends();
      if (genreTrends) insights.push(genreTrends);

      // Analyze budget trends
      const budgetTrends = await this.analyzeBudgetTrends();
      if (budgetTrends) insights.push(budgetTrends);

      // Analyze investment patterns
      const investmentPatterns = await this.analyzeInvestmentPatterns();
      if (investmentPatterns) insights.push(investmentPatterns);

      // Store insights for use in digests
      await this.storeMarketInsights(insights);

      return insights;

    } catch (error) {
      console.error('Error generating market insights:', error);
      return [];
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private calculatePercentageIncrease(oldValue: number, newValue: number): number {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  private calculateTrendingScore(viewIncrease: number, savesIncrease: number, sharesIncrease: number): number {
    // Weighted trending score
    return Math.round(
      (viewIncrease * 0.5) + (savesIncrease * 0.3) + (sharesIncrease * 0.2)
    );
  }

  private generateTrendingReason(viewIncrease: number, savesIncrease: number, sharesIncrease: number): string {
    const reasons = [];
    
    if (viewIncrease >= 50) reasons.push(`${Math.round(viewIncrease)}% more views`);
    else if (viewIncrease >= 20) reasons.push('increased views');
    
    if (savesIncrease >= 30) reasons.push(`${Math.round(savesIncrease)}% more saves`);
    else if (savesIncrease >= 15) reasons.push('more saves');
    
    if (sharesIncrease >= 20) reasons.push(`${Math.round(sharesIncrease)}% more shares`);
    else if (sharesIncrease >= 10) reasons.push('more shares');

    return reasons.length > 0 ? reasons.join(', ') : 'increased engagement';
  }

  private isNewlyPosted(createdAt: Date): boolean {
    const hoursSincePosted = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursSincePosted <= 24; // Posted within last 24 hours
  }

  // Database helper methods (would need actual implementation)
  private async getRecentPitches(since: Date): Promise<any[]> {
    // Implementation would fetch recently posted pitches
    return [];
  }

  private async getActiveInvestorCriteria(): Promise<InvestorCriteria[]> {
    // Implementation would fetch active investor criteria
    return [];
  }

  private async markPitchAsProcessed(pitchId: number): Promise<void> {
    // Implementation would mark pitch as processed for matching
  }

  private async getActivePriceAlerts(): Promise<any[]> {
    // Implementation would fetch active price alerts
    return [];
  }

  private async getCurrentPrice(pitchId: number, investmentType: string): Promise<number> {
    // Implementation would fetch current price
    return 0;
  }

  private calculatePriceChange(oldPrice: number, newPrice: number): { percentage: number; absolute: number } {
    return {
      percentage: ((newPrice - oldPrice) / oldPrice) * 100,
      absolute: newPrice - oldPrice
    };
  }

  private shouldTriggerPriceAlert(alert: any, priceChange: any): boolean {
    // Implementation would check if alert should be triggered
    return Math.abs(priceChange.percentage) >= alert.threshold;
  }

  private determinePriceAlertType(alert: any, priceChange: any): PriceAlert['alertType'] {
    if (priceChange.percentage > 0) return 'price_increase';
    return 'price_drop';
  }

  private async updateLastKnownPrice(alertId: number, price: number): Promise<void> {
    // Implementation would update last known price
  }

  private async getPitchMetrics(timeframe: string, fromDate?: Date): Promise<any[]> {
    // Implementation would fetch pitch metrics
    return [];
  }

  private async updateTrendingStatus(pitchIds: number[]): Promise<void> {
    // Implementation would update trending status
  }

  private async getUsersForRecommendations(): Promise<number[]> {
    // Implementation would fetch users who want recommendations
    return [];
  }

  private async getUserRecommendationContext(userId: number): Promise<RecommendationContext> {
    // Implementation would build user context for recommendations
    return {
      userId,
      viewHistory: [],
      investmentHistory: [],
      savedPitches: [],
      followedCreators: [],
      searchQueries: [],
      interactionPatterns: {},
      riskProfile: 'moderate',
      portfolioBalance: {}
    };
  }

  private async getAvailablePitchesForUser(userId: number): Promise<any[]> {
    // Implementation would fetch available pitches for user
    return [];
  }

  private async calculateRecommendationScore(pitch: any, context: RecommendationContext): Promise<number> {
    // Implementation would calculate recommendation score
    return 0;
  }

  private async analyzeGenreTrends(): Promise<MarketInsight | null> {
    // Implementation would analyze genre trends
    return null;
  }

  private async analyzeBudgetTrends(): Promise<MarketInsight | null> {
    // Implementation would analyze budget trends
    return null;
  }

  private async analyzeInvestmentPatterns(): Promise<MarketInsight | null> {
    // Implementation would analyze investment patterns
    return null;
  }

  private async storeMarketInsights(insights: MarketInsight[]): Promise<void> {
    // Implementation would store insights in database
  }

  // Match calculation helper methods
  private calculateGenreMatch(pitchGenres: string[], criteriaGenres: string[], excludeGenres?: string[]): { score: number; reason: string } {
    // Implementation would calculate genre match
    return { score: 0, reason: '' };
  }

  private calculateBudgetMatch(pitchBudget: number, minBudget: number, maxBudget: number): { score: number; reason: string } {
    // Implementation would calculate budget match
    return { score: 0, reason: '' };
  }

  private calculateFormatMatch(pitchFormat: string, criteriaFormats: string[]): { score: number; reason: string } {
    // Implementation would calculate format match
    return { score: 0, reason: '' };
  }

  private calculateRiskMatch(pitchRisk: string, criteriaRisk: string): { score: number; reason: string } {
    // Implementation would calculate risk match
    return { score: 0, reason: '' };
  }

  private calculateRoiMatch(pitchRoi: number, minRoi: number): { score: number; reason: string } {
    // Implementation would calculate ROI match
    return { score: 0, reason: '' };
  }

  private calculateThemeMatch(pitchThemes: string[], criteriaThemes: string[]): { score: number; reason: string } {
    // Implementation would calculate theme match
    return { score: 0, reason: '' };
  }

  private calculateRegionMatch(pitchRegion: string, criteriaRegions: string[]): { score: number; reason: string } {
    // Implementation would calculate region match
    return { score: 0, reason: '' };
  }
}

// Export service factory
export function createMarketplaceMonitorWorker(
  db: DatabaseService,
  marketplaceNotifications: MarketplaceNotificationsService,
  config?: Partial<MonitoringConfig>
): MarketplaceMonitorWorker {
  return new MarketplaceMonitorWorker(db, marketplaceNotifications, config);
}

// Export types
export type {
  MonitoringConfig,
  MarketInsight,
  RecommendationContext
};