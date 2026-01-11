/**
 * TypeScript definitions for Crawl4AI Intelligence Layer
 * Comprehensive typing for industry enrichment, market intelligence, and competitive analysis
 */

// ============================================
// CORE INTELLIGENCE TYPES
// ============================================

export interface ComparableMovie {
  title: string;
  year: number;
  genre: string;
  rating: number;
  votes: number;
  budget: number;
  domesticGross: number;
  internationalGross: number;
  totalGross: number;
  profitMargin: number;
  director: string;
  cast: string[];
  similarityScore: number;
  comparisonPoints: string[];
  imdbId?: string;
  imdbUrl?: string;
}

export interface MarketAnalysis {
  genrePerformance: {
    averageGross: number;
    roiRange: {
      min: number;
      max: number;
    };
    successRate: number;
    marketShare: number;
  };
  seasonalTrends: {
    favorability: number;
    bestReleaseMonths: string[];
    competitionLevel: 'low' | 'medium' | 'high';
  };
  audienceDemographics: {
    primaryAge: string;
    genderSplit: {
      male: number;
      female: number;
    };
    geographicAppeal: string[];
  };
  competitiveLandscape: {
    upcomingReleases: number;
    marketSaturation: number;
    keyCompetitors: string[];
  };
}

export interface SuccessPrediction {
  successScore: number;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  projectedGross: {
    min: number;
    max: number;
    mostLikely: number;
  };
  breakevenProbability: number;
  factors: {
    genreScore: number;
    timingScore: number;
    competitionScore: number;
    comparablePerformance: number;
    castStrength: number;
    directorTrackRecord: number;
  };
  recommendations: string[];
  keyRisks: string[];
  successFactors: string[];
}

export interface PitchEnrichment {
  id: string;
  pitchId: string;
  enrichmentType: 'industry_data' | 'market_analysis' | 'competitive_analysis';
  comparableMovies?: ComparableMovie[];
  marketAnalysis?: MarketAnalysis;
  successPrediction?: SuccessPrediction;
  competitiveLandscape?: CompetitiveProject[];
  dataSource: string;
  confidenceScore: number;
  lastUpdated: string;
  expiresAt: string;
  cacheKey: string;
  cacheTtl: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// MARKET INTELLIGENCE TYPES
// ============================================

export interface MarketIntelligence {
  id: string;
  intelligenceType: 'news' | 'box_office' | 'trends' | 'opportunities' | 'alerts';
  title: string;
  content?: string;
  summary?: string;
  sourceUrl?: string;
  sourceName: string;
  category: 'investment' | 'production' | 'distribution' | 'technology' | 'talent' | 'platform' | 'regulation';
  tags: string[];
  genreRelevance: string[];
  relevanceScore: number;
  impactScore: number; // 1-10
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  publishedDate?: string;
  extractedAt: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface BoxOfficeTrend {
  weekendTotal: number;
  topPerformers: {
    title: string;
    gross: number;
    weeks: number;
    changeFromLastWeek: number;
  }[];
  surprises: {
    title: string;
    expectedGross: number;
    actualGross: number;
    surpriseFactor: number;
  }[];
  disappointments: {
    title: string;
    expectedGross: number;
    actualGross: number;
    disappointmentFactor: number;
  }[];
}

export interface TrendAnalysis {
  id: string;
  trendType: 'genre' | 'format' | 'budget_range' | 'platform' | 'audience' | 'technology';
  trendName: string;
  trendDirection: 'rising' | 'stable' | 'falling' | 'volatile';
  trendStrength: number; // 0-100
  momentumScore: number; // 0-100
  recentSuccesses: number;
  recentFailures: number;
  averagePerformance: number;
  marketShare: number;
  projectedDirection: 'rising' | 'stable' | 'falling' | 'volatile';
  confidenceInterval: number;
  factorsDrivingTrend: string[];
  historicalData: {
    month: string;
    performance: number;
    volume: number;
  }[];
  analysisPeriodStart: string;
  analysisPeriodEnd: string;
  dataSources: string[];
  methodology: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// CONTENT DISCOVERY TYPES
// ============================================

export interface SimilarProject {
  id: string;
  pitchId: string;
  similarTitle: string;
  similarYear: number;
  similarGenre: string;
  similarityScore: number;
  budget?: number;
  domesticGross?: number;
  internationalGross?: number;
  totalGross?: number;
  profitMargin?: number;
  rating?: number;
  voteCount?: number;
  runtimeMinutes?: number;
  sharedThemes: string[];
  sharedGenres: string[];
  comparisonNotes?: string;
  dataSource: string;
  sourceUrl?: string;
  imdbId?: string;
  createdAt: string;
}

export interface TalentVerification {
  id: string;
  talentName: string;
  talentRole: 'actor' | 'director' | 'writer' | 'producer' | 'cinematographer' | 'composer' | 'other';
  verified: boolean;
  verificationConfidence: number;
  verificationSource: string;
  imdbId?: string;
  imdbUrl?: string;
  filmography: {
    title: string;
    year: number;
    role: string;
    budget?: number;
    gross?: number;
  }[];
  awards: {
    award: string;
    category: string;
    year: number;
    result: 'won' | 'nominated';
  }[];
  agency?: string;
  agent?: string;
  manager?: string;
  estimatedQuoteMin?: number;
  estimatedQuoteMax?: number;
  marketTier: 'A-list' | 'B-list' | 'emerging' | 'unknown';
  recentActivityScore: number;
  lastVerified: string;
  verificationExpires?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyVerification {
  id: string;
  companyName: string;
  exists: boolean;
  verified: boolean;
  verificationConfidence?: number;
  foundedYear?: number;
  headquarters?: string;
  website?: string;
  companySize?: string;
  totalProductions: number;
  successfulProductions: number;
  averageBudget?: number;
  totalGross?: number;
  successRate?: number;
  recentProjects: {
    title: string;
    year: number;
    budget?: number;
    gross?: number;
    role: string;
  }[];
  keyPersonnel: {
    name: string;
    role: string;
    experience: string;
  }[];
  guildMember: boolean;
  guildAffiliations: string[];
  industryReputationScore?: number; // 1-10
  financialStability: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  creditRating?: string;
  verificationSources: string[];
  lastVerified: string;
  verificationExpires?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// COMPETITIVE ANALYSIS TYPES
// ============================================

export interface CompetitiveAnalysis {
  id: string;
  analysisType: 'feature_comparison' | 'pricing_analysis' | 'market_positioning' | 'swot_analysis';
  competitorName: string;
  competitorUrl?: string;
  competitorFocus: string;
  features: string[];
  pricingModel: {
    plans: {
      name: string;
      price: number;
      features: string[];
    }[];
    model: 'subscription' | 'freemium' | 'one_time' | 'usage_based' | 'commission';
    hasFreeTier: boolean;
  };
  marketPosition: {
    alexaRank?: number;
    marketShare?: number;
    userBase?: string;
    socialPresence: {
      followers: number;
      engagement: number;
    };
    contentFreshness: number; // 0-1
    userEngagement: number; // 0-1
  };
  swotAnalysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  featureCoverageScore: number; // 0-100
  pricingCompetitiveness: number; // 0-100
  marketStrength: number; // 0-100
  recommendations: string[];
  opportunities: string[];
  threats: string[];
  analysisDate: string;
  nextAnalysisDate?: string;
  analysisVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompetitiveProject {
  title: string;
  stage: 'development' | 'pre_production' | 'production' | 'post_production' | 'completed';
  genre: string;
  budget?: number;
  company: string;
  releaseDate?: string;
  competitionLevel: number; // 0-100
  threatLevel: 'low' | 'medium' | 'high';
  differentiators: string[];
}

// ============================================
// INVESTMENT OPPORTUNITIES TYPES
// ============================================

export interface InvestmentOpportunity {
  id: string;
  opportunityType: 'new_production' | 'genre_opportunity' | 'talent_availability' | 'market_gap' | 'acquisition_target';
  title: string;
  description?: string;
  opportunitySource: string;
  sourceUrl?: string;
  opportunityScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  timeSensitivity: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  estimatedInvestmentMin?: number;
  estimatedInvestmentMax?: number;
  estimatedRoiMin?: number;
  estimatedRoiMax?: number;
  paybackPeriodMonths?: number;
  recommendedAction?: string;
  nextSteps: string[];
  keyContacts: {
    name: string;
    role: string;
    contact: string;
  }[];
  status: 'new' | 'investigating' | 'evaluating' | 'pursuing' | 'passed' | 'completed';
  assignedTo?: string;
  alertLevel: 'info' | 'low' | 'medium' | 'high' | 'urgent';
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// CRAWLING AND MONITORING TYPES
// ============================================

export interface CrawlJob {
  id: string;
  jobType: 'industry_enrichment' | 'market_intelligence' | 'competitive_analysis' | 'content_discovery' | 'trend_analysis';
  jobStatus: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  targetUrl?: string;
  jobParameters: Record<string, any>;
  priority: number; // 1-10
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
  retryCount: number;
  maxRetries: number;
  resultsCount?: number;
  successRate?: number;
  errorMessage?: string;
  outputData?: Record<string, any>;
  memoryUsedMb?: number;
  cpuTimeMs?: number;
  networkRequests?: number;
  cacheHits?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CacheMetrics {
  id: string;
  cacheType: 'redis' | 'kv_storage' | 'browser_cache' | 'database_query';
  cacheKey: string;
  hitCount: number;
  missCount: number;
  hitRate: number; // Calculated field
  avgSizeBytes?: number;
  avgRetrievalTimeMs?: number;
  totalDataTransferredMb?: number;
  firstAccess?: string;
  lastAccess: string;
  expiryTime?: string;
  associatedPitchId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface EnrichmentRequest {
  pitchId: string;
  pitchData: {
    title: string;
    genre: string;
    logline: string;
    budget?: number;
    format: string;
    themes?: string[];
    targetAudience?: string;
    cast?: string[];
    director?: string;
    keywords?: string[];
  };
  refreshCache?: boolean;
  includeComparables?: boolean;
  includeMarketAnalysis?: boolean;
  includeSuccessPrediction?: boolean;
}

export interface EnrichmentResponse {
  success: boolean;
  data: PitchEnrichment;
  cached: boolean;
  processingTimeMs: number;
  dataFreshness: 'fresh' | 'stale' | 'expired';
  error?: string;
}

export interface MarketIntelligenceRequest {
  types?: Array<'news' | 'box_office' | 'trends' | 'opportunities' | 'alerts'>;
  genres?: string[];
  categories?: string[];
  timeRange?: {
    start: string;
    end: string;
  };
  limit?: number;
  minRelevanceScore?: number;
}

export interface MarketIntelligenceResponse {
  success: boolean;
  data: {
    intelligence: MarketIntelligence[];
    trends: TrendAnalysis[];
    opportunities: InvestmentOpportunity[];
    boxOfficeTrends: BoxOfficeTrend;
  };
  totalCount: number;
  cached: boolean;
  lastUpdated: string;
  error?: string;
}

export interface ContentDiscoveryRequest {
  action: 'find_similar' | 'verify_talent' | 'validate_company';
  pitchData?: {
    title: string;
    genre: string;
    logline: string;
    themes?: string[];
    targetAudience?: string;
  };
  talentName?: string;
  talentRole?: string;
  companyName?: string;
  includeVerification?: boolean;
}

export interface ContentDiscoveryResponse {
  success: boolean;
  data: {
    similarProjects?: SimilarProject[];
    talentVerification?: TalentVerification;
    companyVerification?: CompanyVerification;
  };
  processingTimeMs: number;
  cached: boolean;
  error?: string;
}

export interface CompetitiveAnalysisRequest {
  includeFeatures?: boolean;
  includePricing?: boolean;
  includeMarketPosition?: boolean;
  includeSWOT?: boolean;
  refreshData?: boolean;
}

export interface CompetitiveAnalysisResponse {
  success: boolean;
  data: {
    competitors: CompetitiveAnalysis[];
    featureComparison: Record<string, Record<string, boolean>>;
    pricingComparison: Record<string, {
      lowestPrice: number;
      hasFreeTier: boolean;
      pricingModel: string;
    }>;
    marketPositioning: Record<string, number>;
    recommendations: string[];
  };
  lastAnalyzed: string;
  nextUpdate: string;
  cached: boolean;
  error?: string;
}

export interface TrendAnalysisRequest {
  trendTypes?: Array<'genre' | 'format' | 'budget_range' | 'platform' | 'audience' | 'technology'>;
  timeRange?: {
    start: string;
    end: string;
  };
  includeProjections?: boolean;
  minTrendStrength?: number;
}

export interface TrendAnalysisResponse {
  success: boolean;
  data: {
    trends: TrendAnalysis[];
    projections: {
      genre: Record<string, number>;
      format: Record<string, number>;
      budgetRange: Record<string, number>;
    };
    recommendations: string[];
  };
  analysisDate: string;
  projectionConfidence: number;
  error?: string;
}

// ============================================
// DASHBOARD AND UI TYPES
// ============================================

export interface IntelligenceDashboard {
  marketNews: {
    count: number;
    avgRelevance: number;
    latestUpdate: string;
    topStories: MarketIntelligence[];
  };
  opportunities: {
    count: number;
    avgScore: number;
    latestUpdate: string;
    highPriority: InvestmentOpportunity[];
  };
  trends: {
    count: number;
    avgStrength: number;
    latestUpdate: string;
    rising: TrendAnalysis[];
    falling: TrendAnalysis[];
  };
  competitive: {
    analysisDate: string;
    competitorCount: number;
    recommendations: string[];
    marketGaps: string[];
  };
}

export interface EnrichedPitch {
  // Base pitch data
  id: string;
  title: string;
  logline: string;
  genre: string;
  format: string;
  budgetRange?: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  creatorId: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
  
  // Enrichment data
  comparableMovies?: ComparableMovie[];
  marketAnalysis?: MarketAnalysis;
  successPrediction?: SuccessPrediction;
  enrichmentConfidence?: number;
  enrichmentUpdated?: string;
  isFresh: boolean;
  competitiveScore: number;
  
  // Similar projects
  similarProjects?: SimilarProject[];
  
  // Risk assessment
  riskFactors: string[];
  opportunityFactors: string[];
}

// ============================================
// WEBSOCKET MESSAGE TYPES
// ============================================

export interface IntelligenceWebSocketMessage {
  type: 'market_intelligence' | 'opportunity_alert' | 'trend_update' | 'enrichment_complete' | 'crawl_status';
  data: MarketIntelligence | InvestmentOpportunity | TrendAnalysis | PitchEnrichment | CrawlJob;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface OpportunityAlert {
  type: 'opportunity_alert';
  opportunity: InvestmentOpportunity;
  reason: string;
  actionRequired: boolean;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: string;
}

export interface TrendAlert {
  type: 'trend_alert';
  trend: TrendAnalysis;
  changeType: 'direction_change' | 'strength_increase' | 'strength_decrease' | 'momentum_shift';
  impactAssessment: string;
  recommendedActions: string[];
  timestamp: string;
}

// ============================================
// UTILITY TYPES
// ============================================

export type IntelligenceDataType = 'industry_data' | 'market_intelligence' | 'competitive_analysis' | 'content_discovery' | 'trend_analysis';

export type CacheStatus = 'fresh' | 'stale' | 'expired' | 'missing';

export type AnalysisStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cached';

export type RiskLevel = 'low' | 'medium' | 'high' | 'very_high';

export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very_high';

export type MarketTiming = 'excellent' | 'good' | 'fair' | 'poor';

export interface AnalysisMetadata {
  version: string;
  algorithm: string;
  dataPoints: number;
  confidence: ConfidenceLevel;
  lastUpdated: string;
  expiresAt: string;
  sources: string[];
}

// Helper type for filtering and sorting
export interface IntelligenceFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  genres?: string[];
  categories?: string[];
  minScore?: number;
  maxRisk?: RiskLevel;
  sources?: string[];
  status?: string[];
  urgency?: Array<'low' | 'medium' | 'high' | 'urgent'>;
}

export interface IntelligenceSortOptions {
  field: 'score' | 'date' | 'relevance' | 'impact' | 'confidence';
  direction: 'asc' | 'desc';
}