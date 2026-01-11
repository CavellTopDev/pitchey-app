/**
 * Industry Data Enrichment Service
 * Uses Crawl4AI-style analysis with TypeScript implementation for edge deployment
 * Enriches pitch data with industry comparables, market analysis, and success predictions
 */

import { 
  ComparableMovie, 
  MarketAnalysis, 
  SuccessPrediction, 
  PitchEnrichment,
  EnrichmentRequest,
  EnrichmentResponse,
  AnalysisMetadata
} from '../types/intelligence.types';
import { createDatabase } from '../db/raw-sql-connection';
import { getCacheService } from './intelligence-cache.service';
import { Env } from '../types/worker-types';

export class IndustryEnrichmentService {
  private db: any;
  private cache: any;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.db = createDatabase(env);
    this.cache = getCacheService(env);
  }

  /**
   * Enrich a pitch with industry data, market analysis, and success predictions
   */
  async enrichPitch(request: EnrichmentRequest): Promise<EnrichmentResponse> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request.pitchData);
      
      if (!request.refreshCache) {
        const cached = await this.cache.get(`enrichment:${cacheKey}`);
        if (cached) {
          return {
            success: true,
            data: cached,
            cached: true,
            processingTimeMs: Date.now() - startTime,
            dataFreshness: this.assessFreshness(cached.lastUpdated)
          };
        }
      }

      // Perform enrichment analysis
      const enrichment = await this.performEnrichmentAnalysis(request);
      
      // Store results in database
      await this.storeEnrichment(enrichment);
      
      // Cache results
      await this.cache.set(`enrichment:${cacheKey}`, enrichment, 3600); // 1 hour TTL

      return {
        success: true,
        data: enrichment,
        cached: false,
        processingTimeMs: Date.now() - startTime,
        dataFreshness: 'fresh'
      };

    } catch (error) {
      console.error('Enrichment failed:', error);
      return {
        success: false,
        data: null as any,
        cached: false,
        processingTimeMs: Date.now() - startTime,
        dataFreshness: 'expired',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Perform comprehensive pitch enrichment analysis
   */
  private async performEnrichmentAnalysis(request: EnrichmentRequest): Promise<PitchEnrichment> {
    const { pitchData } = request;
    
    // Find comparable movies
    const comparableMovies = request.includeComparables !== false 
      ? await this.findComparableMovies(pitchData)
      : undefined;

    // Perform market analysis
    const marketAnalysis = request.includeMarketAnalysis !== false
      ? await this.analyzeMarket(pitchData, comparableMovies || [])
      : undefined;

    // Generate success prediction
    const successPrediction = request.includeSuccessPrediction !== false
      ? await this.predictSuccess(pitchData, comparableMovies || [], marketAnalysis)
      : undefined;

    // Calculate confidence score
    const confidenceScore = this.calculateConfidenceScore(
      comparableMovies?.length || 0,
      marketAnalysis,
      successPrediction
    );

    const now = new Date().toISOString();
    
    return {
      id: crypto.randomUUID(),
      pitchId: request.pitchId,
      enrichmentType: 'industry_data',
      comparableMovies,
      marketAnalysis,
      successPrediction,
      dataSource: 'pitchey_intelligence',
      confidenceScore,
      lastUpdated: now,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      cacheKey: this.generateCacheKey(pitchData),
      cacheTtl: 3600,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Find comparable movies based on genre, budget, and themes
   */
  private async findComparableMovies(pitchData: any): Promise<ComparableMovie[]> {
    // This would use external APIs in production (IMDb, BoxOfficeMojo)
    // For now, we'll use mock data based on realistic industry patterns
    
    const comparables: ComparableMovie[] = [];
    const genre = pitchData.genre?.toLowerCase() || 'drama';
    const budget = this.parseBudget(pitchData.budget);

    // Define genre-specific comparable templates
    const genreComparables = this.getGenreComparables(genre, budget);
    
    for (const template of genreComparables) {
      const comparable: ComparableMovie = {
        ...template,
        similarityScore: this.calculateSimilarityScore(pitchData, template),
        comparisonPoints: this.getComparisonPoints(pitchData, template)
      };
      
      if (comparable.similarityScore > 0.6) {
        comparables.push(comparable);
      }
    }

    // Sort by similarity score and return top 5
    return comparables
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 5);
  }

  /**
   * Analyze market conditions for the pitch
   */
  private async analyzeMarket(pitchData: any, comparables: ComparableMovie[]): Promise<MarketAnalysis> {
    const genre = pitchData.genre?.toLowerCase() || 'drama';
    
    // Calculate genre performance metrics
    const genrePerformance = this.analyzeGenrePerformance(genre, comparables);
    
    // Analyze seasonal trends
    const seasonalTrends = this.analyzeSeasonalTrends(genre);
    
    // Estimate audience demographics
    const audienceDemographics = this.estimateAudience(genre, pitchData);
    
    // Assess competitive landscape
    const competitiveLandscape = this.assessCompetition(genre, pitchData.budget);

    return {
      genrePerformance,
      seasonalTrends,
      audienceDemographics,
      competitiveLandscape
    };
  }

  /**
   * Predict success based on pitch data and market analysis
   */
  private async predictSuccess(
    pitchData: any, 
    comparables: ComparableMovie[], 
    marketAnalysis?: MarketAnalysis
  ): Promise<SuccessPrediction> {
    // Extract features for prediction
    const features = this.extractPredictionFeatures(pitchData, comparables, marketAnalysis);
    
    // Calculate weighted success score
    const successScore = this.calculateSuccessScore(features);
    
    // Assess confidence based on data quality
    const confidence = this.calculatePredictionConfidence(comparables.length, marketAnalysis);
    
    // Determine risk level
    const riskLevel = this.assessRiskLevel(successScore, features);
    
    // Project gross revenue range
    const projectedGross = this.projectGrossRevenue(successScore, comparables, pitchData.budget);
    
    // Calculate breakeven probability
    const breakevenProbability = this.calculateBreakevenProbability(successScore, projectedGross, pitchData.budget);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(features, successScore, riskLevel);
    
    return {
      successScore: Math.round(successScore),
      confidence: Math.round(confidence),
      riskLevel,
      projectedGross,
      breakevenProbability: Math.round(breakevenProbability),
      factors: features,
      recommendations,
      keyRisks: this.identifyKeyRisks(features, marketAnalysis),
      successFactors: this.identifySuccessFactors(features, comparables)
    };
  }

  /**
   * Get genre-specific comparable movies
   */
  private getGenreComparables(genre: string, budget: number): Partial<ComparableMovie>[] {
    const budgetTier = this.getBudgetTier(budget);
    
    // Industry data based on real box office performance patterns
    const genreData: Record<string, Partial<ComparableMovie>[]> = {
      horror: [
        {
          title: 'The Conjuring',
          year: 2013,
          genre: 'horror',
          rating: 7.5,
          votes: 500000,
          budget: 20000000,
          domesticGross: 137400000,
          internationalGross: 182100000,
          totalGross: 319500000,
          profitMargin: 1497.5,
          director: 'James Wan',
          cast: ['Vera Farmiga', 'Patrick Wilson']
        },
        {
          title: 'Get Out',
          year: 2017,
          genre: 'horror',
          rating: 7.7,
          votes: 600000,
          budget: 4500000,
          domesticGross: 176000000,
          internationalGross: 79000000,
          totalGross: 255000000,
          profitMargin: 5566.7,
          director: 'Jordan Peele',
          cast: ['Daniel Kaluuya', 'Allison Williams']
        }
      ],
      action: [
        {
          title: 'John Wick',
          year: 2014,
          genre: 'action',
          rating: 7.4,
          votes: 650000,
          budget: 20000000,
          domesticGross: 43000000,
          internationalGross: 86000000,
          totalGross: 129000000,
          profitMargin: 545.0,
          director: 'Chad Stahelski',
          cast: ['Keanu Reeves', 'Michael Nyqvist']
        },
        {
          title: 'Mad Max: Fury Road',
          year: 2015,
          genre: 'action',
          rating: 8.1,
          votes: 900000,
          budget: 150000000,
          domesticGross: 154000000,
          internationalGross: 221000000,
          totalGross: 375000000,
          profitMargin: 150.0,
          director: 'George Miller',
          cast: ['Tom Hardy', 'Charlize Theron']
        }
      ],
      comedy: [
        {
          title: 'Superbad',
          year: 2007,
          genre: 'comedy',
          rating: 7.6,
          votes: 550000,
          budget: 20000000,
          domesticGross: 121000000,
          internationalGross: 49000000,
          totalGross: 170000000,
          profitMargin: 750.0,
          director: 'Greg Mottola',
          cast: ['Jonah Hill', 'Michael Cera']
        },
        {
          title: 'The Hangover',
          year: 2009,
          genre: 'comedy',
          rating: 7.7,
          votes: 750000,
          budget: 35000000,
          domesticGross: 277000000,
          internationalGross: 190000000,
          totalGross: 467000000,
          profitMargin: 1234.3,
          director: 'Todd Phillips',
          cast: ['Bradley Cooper', 'Ed Helms']
        }
      ],
      drama: [
        {
          title: 'Moonlight',
          year: 2016,
          genre: 'drama',
          rating: 7.4,
          votes: 300000,
          budget: 1500000,
          domesticGross: 27900000,
          internationalGross: 37900000,
          totalGross: 65800000,
          profitMargin: 4286.7,
          director: 'Barry Jenkins',
          cast: ['Mahershala Ali', 'Naomie Harris']
        },
        {
          title: 'Lady Bird',
          year: 2017,
          genre: 'drama',
          rating: 7.4,
          votes: 280000,
          budget: 10000000,
          domesticGross: 49000000,
          internationalGross: 30000000,
          totalGross: 79000000,
          profitMargin: 690.0,
          director: 'Greta Gerwig',
          cast: ['Saoirse Ronan', 'Laurie Metcalf']
        }
      ]
    };

    return genreData[genre] || genreData.drama;
  }

  /**
   * Calculate similarity score between pitch and comparable
   */
  private calculateSimilarityScore(pitch: any, comparable: Partial<ComparableMovie>): number {
    let score = 0;
    
    // Genre match (40%)
    if (pitch.genre?.toLowerCase() === comparable.genre?.toLowerCase()) {
      score += 0.4;
    }
    
    // Budget similarity (30%)
    const pitchBudget = this.parseBudget(pitch.budget);
    const comparableBudget = comparable.budget || 0;
    if (pitchBudget > 0 && comparableBudget > 0) {
      const ratio = Math.min(pitchBudget, comparableBudget) / Math.max(pitchBudget, comparableBudget);
      score += 0.3 * ratio;
    }
    
    // Theme/keyword similarity (30%)
    const pitchKeywords = new Set(pitch.keywords || []);
    const comparableKeywords = new Set([comparable.genre || '']);
    const intersection = new Set([...pitchKeywords].filter(x => comparableKeywords.has(x)));
    const union = new Set([...pitchKeywords, ...comparableKeywords]);
    
    if (union.size > 0) {
      score += 0.3 * (intersection.size / union.size);
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Get comparison points between pitch and comparable
   */
  private getComparisonPoints(pitch: any, comparable: Partial<ComparableMovie>): string[] {
    const points: string[] = [];
    
    if (pitch.genre?.toLowerCase() === comparable.genre?.toLowerCase()) {
      points.push(`Same genre: ${comparable.genre}`);
    }
    
    const pitchBudget = this.parseBudget(pitch.budget);
    const comparableBudget = comparable.budget || 0;
    if (pitchBudget > 0 && comparableBudget > 0) {
      const ratio = pitchBudget / comparableBudget;
      if (ratio >= 0.5 && ratio <= 2.0) {
        points.push(`Similar budget range ($${(comparableBudget / 1000000).toFixed(1)}M vs $${(pitchBudget / 1000000).toFixed(1)}M)`);
      }
    }
    
    if (comparable.profitMargin && comparable.profitMargin > 200) {
      points.push(`High ROI potential (${comparable.profitMargin.toFixed(0)}% return)`);
    }
    
    if (comparable.rating && comparable.rating >= 7.0) {
      points.push(`Strong critical reception (${comparable.rating}/10)`);
    }
    
    return points;
  }

  /**
   * Analyze genre performance metrics
   */
  private analyzeGenrePerformance(genre: string, comparables: ComparableMovie[]): MarketAnalysis['genrePerformance'] {
    if (comparables.length === 0) {
      return this.getDefaultGenrePerformance(genre);
    }
    
    const totalGrosses = comparables.map(c => c.totalGross);
    const averageGross = totalGrosses.reduce((sum, gross) => sum + gross, 0) / totalGrosses.length;
    
    const rois = comparables.map(c => c.profitMargin);
    const roiRange = {
      min: Math.min(...rois),
      max: Math.max(...rois)
    };
    
    // Success rate based on profitability
    const successfulCount = comparables.filter(c => c.profitMargin > 100).length;
    const successRate = (successfulCount / comparables.length) * 100;
    
    const marketShare = this.getGenreMarketShare(genre);
    
    return {
      averageGross,
      roiRange,
      successRate,
      marketShare
    };
  }

  /**
   * Analyze seasonal trends for genre
   */
  private analyzeSeasonalTrends(genre: string): MarketAnalysis['seasonalTrends'] {
    // Industry data on seasonal performance by genre
    const seasonalData: Record<string, any> = {
      horror: {
        favorability: 0.85,
        bestReleaseMonths: ['October', 'February', 'January'],
        competitionLevel: 'medium'
      },
      action: {
        favorability: 0.75,
        bestReleaseMonths: ['May', 'June', 'July', 'November'],
        competitionLevel: 'high'
      },
      comedy: {
        favorability: 0.70,
        bestReleaseMonths: ['March', 'April', 'August', 'December'],
        competitionLevel: 'medium'
      },
      drama: {
        favorability: 0.65,
        bestReleaseMonths: ['September', 'October', 'November', 'December'],
        competitionLevel: 'low'
      }
    };
    
    return seasonalData[genre] || seasonalData.drama;
  }

  /**
   * Estimate audience demographics
   */
  private estimateAudience(genre: string, pitchData: any): MarketAnalysis['audienceDemographics'] {
    // Industry demographic data by genre
    const demographics: Record<string, any> = {
      horror: {
        primaryAge: '18-34',
        genderSplit: { male: 55, female: 45 },
        geographicAppeal: ['North America', 'Europe', 'Latin America']
      },
      action: {
        primaryAge: '18-49',
        genderSplit: { male: 65, female: 35 },
        geographicAppeal: ['Global', 'Asia-Pacific', 'North America', 'Europe']
      },
      comedy: {
        primaryAge: '25-54',
        genderSplit: { male: 50, female: 50 },
        geographicAppeal: ['North America', 'English-speaking markets']
      },
      drama: {
        primaryAge: '35-64',
        genderSplit: { male: 40, female: 60 },
        geographicAppeal: ['North America', 'Europe', 'Festival circuit']
      }
    };
    
    return demographics[genre] || demographics.drama;
  }

  /**
   * Assess competitive landscape
   */
  private assessCompetition(genre: string, budget: number): MarketAnalysis['competitiveLandscape'] {
    // Simulated competitive analysis
    const competitionData: Record<string, any> = {
      horror: { upcomingReleases: 15, marketSaturation: 0.4, keyCompetitors: ['Blumhouse', 'A24', 'Lionsgate'] },
      action: { upcomingReleases: 25, marketSaturation: 0.8, keyCompetitors: ['Marvel Studios', 'Universal', 'Warner Bros'] },
      comedy: { upcomingReleases: 12, marketSaturation: 0.5, keyCompetitors: ['Sony Pictures', 'Universal', 'Netflix'] },
      drama: { upcomingReleases: 20, marketSaturation: 0.3, keyCompetitors: ['A24', 'Focus Features', 'Sony Pictures Classics'] }
    };
    
    return competitionData[genre] || competitionData.drama;
  }

  /**
   * Extract features for success prediction
   */
  private extractPredictionFeatures(pitchData: any, comparables: ComparableMovie[], marketAnalysis?: MarketAnalysis) {
    return {
      genreScore: marketAnalysis?.genrePerformance?.successRate || 50,
      timingScore: marketAnalysis?.seasonalTrends?.favorability || 0.5,
      competitionScore: 1 - (marketAnalysis?.competitiveLandscape?.marketSaturation || 0.5),
      comparablePerformance: this.normalizeGross(this.averageGross(comparables)),
      castStrength: this.assessCastStrength(pitchData.cast),
      directorTrackRecord: this.assessDirectorTrackRecord(pitchData.director)
    };
  }

  /**
   * Calculate weighted success score
   */
  private calculateSuccessScore(features: any): number {
    const weights = {
      genreScore: 0.25,
      timingScore: 0.15,
      competitionScore: 0.15,
      comparablePerformance: 0.25,
      castStrength: 0.15,
      directorTrackRecord: 0.05
    };
    
    let score = 0;
    for (const [key, weight] of Object.entries(weights)) {
      score += (features[key] || 0) * weight;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate prediction confidence
   */
  private calculatePredictionConfidence(comparablesCount: number, marketAnalysis?: MarketAnalysis): number {
    let confidence = 50; // Base confidence
    
    // More comparables = higher confidence
    confidence += Math.min(25, comparablesCount * 5);
    
    // Market analysis availability
    if (marketAnalysis) {
      confidence += 15;
    }
    
    // Cap at 90% confidence
    return Math.min(90, confidence);
  }

  /**
   * Assess risk level based on success score and features
   */
  private assessRiskLevel(successScore: number, features: any): 'low' | 'medium' | 'high' | 'very_high' {
    if (successScore >= 80 && features.competitionScore > 0.6) return 'low';
    if (successScore >= 65 && features.genreScore > 60) return 'medium';
    if (successScore >= 45) return 'high';
    return 'very_high';
  }

  /**
   * Project gross revenue based on success score and comparables
   */
  private projectGrossRevenue(successScore: number, comparables: ComparableMovie[], budget: number) {
    const baseMultiplier = successScore / 100;
    const averageGross = this.averageGross(comparables);
    
    const mostLikely = averageGross * baseMultiplier;
    const min = mostLikely * 0.6;
    const max = mostLikely * 1.8;
    
    return {
      min: Math.round(min),
      max: Math.round(max),
      mostLikely: Math.round(mostLikely)
    };
  }

  /**
   * Calculate breakeven probability
   */
  private calculateBreakevenProbability(successScore: number, projectedGross: any, budget: number): number {
    const breakevenPoint = budget * 2.5; // Industry rule: 2.5x budget for breakeven
    const probabilityAtMostLikely = projectedGross.mostLikely > breakevenPoint ? 70 : 30;
    
    // Adjust based on success score
    const adjustment = (successScore - 50) * 0.4;
    
    return Math.max(5, Math.min(95, probabilityAtMostLikely + adjustment));
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(features: any, successScore: number, riskLevel: string): string[] {
    const recommendations: string[] = [];
    
    if (successScore >= 80) {
      recommendations.push('Strong investment opportunity with high success potential');
    } else if (successScore >= 65) {
      recommendations.push('Moderate investment opportunity requiring careful execution');
    } else {
      recommendations.push('High-risk investment requiring significant strategy adjustments');
    }
    
    if (features.competitionScore < 0.4) {
      recommendations.push('Consider adjusting release timing to avoid heavy competition');
    }
    
    if (features.castStrength < 0.5) {
      recommendations.push('Strengthen cast with recognizable talent to improve marketability');
    }
    
    if (features.genreScore < 50) {
      recommendations.push('Genre showing weakness - consider alternative positioning or themes');
    }
    
    if (riskLevel === 'very_high') {
      recommendations.push('Consider reducing budget or seeking pre-sales to mitigate risk');
    }
    
    return recommendations;
  }

  /**
   * Identify key risk factors
   */
  private identifyKeyRisks(features: any, marketAnalysis?: MarketAnalysis): string[] {
    const risks: string[] = [];
    
    if (features.competitionScore < 0.3) {
      risks.push('High market saturation with strong competition');
    }
    
    if (features.genreScore < 40) {
      risks.push('Genre showing declining market performance');
    }
    
    if (features.castStrength < 0.3) {
      risks.push('Weak cast may limit audience appeal and distribution options');
    }
    
    if (marketAnalysis?.competitiveLandscape?.marketSaturation > 0.7) {
      risks.push('Oversaturated market with numerous similar projects');
    }
    
    return risks;
  }

  /**
   * Identify success factors
   */
  private identifySuccessFactors(features: any, comparables: ComparableMovie[]): string[] {
    const factors: string[] = [];
    
    if (features.genreScore > 70) {
      factors.push('Strong genre performance trend');
    }
    
    if (features.castStrength > 0.7) {
      factors.push('Strong cast with proven box office appeal');
    }
    
    if (comparables.some(c => c.profitMargin > 500)) {
      factors.push('Genre has proven high-ROI potential');
    }
    
    if (features.timingScore > 0.7) {
      factors.push('Optimal seasonal timing for release');
    }
    
    return factors;
  }

  // Utility methods
  private parseBudget(budget: any): number {
    if (typeof budget === 'number') return budget;
    if (typeof budget === 'string') {
      const match = budget.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) * 1000000 : 0;
    }
    return 0;
  }

  private getBudgetTier(budget: number): string {
    if (budget < 1000000) return 'micro';
    if (budget < 5000000) return 'low';
    if (budget < 20000000) return 'medium';
    if (budget < 100000000) return 'high';
    return 'blockbuster';
  }

  private assessCastStrength(cast: string[] = []): number {
    // Simplified cast strength assessment
    // In production, this would use actual box office data
    if (cast.length === 0) return 0.2;
    if (cast.length >= 3) return 0.8;
    return 0.5;
  }

  private assessDirectorTrackRecord(director?: string): number {
    // Simplified director assessment
    if (!director) return 0.3;
    return 0.6; // Default moderate score
  }

  private averageGross(comparables: ComparableMovie[]): number {
    if (comparables.length === 0) return 50000000; // Default
    return comparables.reduce((sum, c) => sum + c.totalGross, 0) / comparables.length;
  }

  private normalizeGross(gross: number): number {
    // Normalize to 0-100 scale (100M = 1.0)
    return Math.min(1.0, gross / 100000000);
  }

  private getGenreMarketShare(genre: string): number {
    const shares: Record<string, number> = {
      action: 22.5,
      comedy: 16.8,
      drama: 14.2,
      horror: 8.3,
      thriller: 7.1,
      romance: 6.4
    };
    return shares[genre] || 5.0;
  }

  private getDefaultGenrePerformance(genre: string): MarketAnalysis['genrePerformance'] {
    const defaults: Record<string, any> = {
      horror: { averageGross: 45000000, roiRange: { min: 200, max: 2000 }, successRate: 75, marketShare: 8.3 },
      action: { averageGross: 180000000, roiRange: { min: 150, max: 800 }, successRate: 65, marketShare: 22.5 },
      comedy: { averageGross: 85000000, roiRange: { min: 180, max: 1200 }, successRate: 70, marketShare: 16.8 },
      drama: { averageGross: 35000000, roiRange: { min: 120, max: 600 }, successRate: 60, marketShare: 14.2 }
    };
    
    return defaults[genre] || defaults.drama;
  }

  private generateCacheKey(pitchData: any): string {
    const keyString = JSON.stringify({
      genre: pitchData.genre,
      budget: pitchData.budget,
      themes: pitchData.themes?.sort(),
      format: pitchData.format
    });
    
    return btoa(keyString).replace(/[+/=]/g, '').substring(0, 16);
  }

  private assessFreshness(lastUpdated: string): 'fresh' | 'stale' | 'expired' {
    const age = Date.now() - new Date(lastUpdated).getTime();
    const hours = age / (1000 * 60 * 60);
    
    if (hours < 4) return 'fresh';
    if (hours < 24) return 'stale';
    return 'expired';
  }

  private calculateConfidenceScore(
    comparablesCount: number, 
    marketAnalysis?: MarketAnalysis, 
    successPrediction?: SuccessPrediction
  ): number {
    let score = 0.3; // Base confidence
    
    // Data availability factors
    if (comparablesCount > 0) score += 0.2;
    if (comparablesCount >= 3) score += 0.1;
    if (comparablesCount >= 5) score += 0.1;
    
    if (marketAnalysis) score += 0.2;
    if (successPrediction) score += 0.1;
    
    return Math.min(1.0, score);
  }

  private async storeEnrichment(enrichment: PitchEnrichment): Promise<void> {
    try {
      await this.db.execute(`
        INSERT INTO pitch_enrichments (
          id, pitch_id, enrichment_type, comparable_movies, 
          market_analysis, success_prediction, data_source, 
          confidence_score, last_updated, expires_at, cache_key, cache_ttl
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (pitch_id, enrichment_type) 
        DO UPDATE SET 
          comparable_movies = $4,
          market_analysis = $5,
          success_prediction = $6,
          confidence_score = $8,
          last_updated = $9,
          updated_at = NOW()
      `, [
        enrichment.id,
        enrichment.pitchId,
        enrichment.enrichmentType,
        JSON.stringify(enrichment.comparableMovies),
        JSON.stringify(enrichment.marketAnalysis),
        JSON.stringify(enrichment.successPrediction),
        enrichment.dataSource,
        enrichment.confidenceScore,
        enrichment.lastUpdated,
        enrichment.expiresAt,
        enrichment.cacheKey,
        enrichment.cacheTtl
      ]);
    } catch (error) {
      console.error('Failed to store enrichment:', error);
      // Non-blocking - continue even if storage fails
    }
  }

  /**
   * Get enrichment status for multiple pitches
   */
  async getEnrichmentStatus(pitchIds: string[]): Promise<Record<string, boolean>> {
    try {
      const result = await this.db.execute(`
        SELECT pitch_id, 
               (last_updated > NOW() - INTERVAL '24 hours') as is_fresh
        FROM pitch_enrichments 
        WHERE pitch_id = ANY($1) 
        AND enrichment_type = 'industry_data'
      `, [pitchIds]);

      const status: Record<string, boolean> = {};
      result.forEach((row: any) => {
        status[row.pitch_id] = row.is_fresh;
      });

      return status;
    } catch (error) {
      console.error('Failed to get enrichment status:', error);
      return {};
    }
  }

  /**
   * Get cached enrichment for a pitch
   */
  async getCachedEnrichment(pitchId: string): Promise<PitchEnrichment | null> {
    try {
      const result = await this.db.execute(`
        SELECT * FROM pitch_enrichments 
        WHERE pitch_id = $1 AND enrichment_type = 'industry_data'
        AND last_updated > NOW() - INTERVAL '24 hours'
        ORDER BY last_updated DESC
        LIMIT 1
      `, [pitchId]);

      if (result.length === 0) return null;

      const row = result[0];
      return {
        id: row.id,
        pitchId: row.pitch_id,
        enrichmentType: row.enrichment_type,
        comparableMovies: row.comparable_movies,
        marketAnalysis: row.market_analysis,
        successPrediction: row.success_prediction,
        dataSource: row.data_source,
        confidenceScore: row.confidence_score,
        lastUpdated: row.last_updated,
        expiresAt: row.expires_at,
        cacheKey: row.cache_key,
        cacheTtl: row.cache_ttl,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('Failed to get cached enrichment:', error);
      return null;
    }
  }
}