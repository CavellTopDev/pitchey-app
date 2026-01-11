/**
 * Comprehensive types for the Pitch Validation and Scoring system
 * AI-powered analysis with market viability and success prediction
 */

// Core validation score structure
export interface ValidationScore {
  id: string;
  pitchId: string;
  overallScore: number; // 0-100
  lastAnalyzed: string;
  version: number;
  categories: ValidationCategories;
  recommendations: ValidationRecommendation[];
  benchmarks: BenchmarkData[];
  riskAssessment: RiskAssessment;
  marketTiming: MarketTimingAnalysis;
  comparables: ComparableProject[];
  aiInsights: AIAnalysisInsights;
  confidence: number; // 0-100, confidence in the scoring
}

// Detailed category breakdown
export interface ValidationCategories {
  story: CategoryScore; // 25% weight
  market: CategoryScore; // 20% weight  
  finance: CategoryScore; // 20% weight
  team: CategoryScore; // 20% weight
  production: CategoryScore; // 15% weight
}

export interface CategoryScore {
  score: number; // 0-100
  weight: number; // percentage weight in overall score
  confidence: number; // 0-100
  factors: ScoreFactor[];
  improvements: string[];
  strengths: string[];
  weaknesses: string[];
}

export interface ScoreFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
  impact: 'high' | 'medium' | 'low';
  dataSource: string;
}

// Story/Script analysis
export interface StoryAnalysis {
  titleQuality: number;
  loglineStrength: number;
  synopsisClarity: number;
  characterDevelopment: number;
  plotStructure: number;
  dialogue: number;
  originality: number;
  genreConsistency: number;
  themes: string[];
  tone: string;
  target_audience: string[];
  uniqueSellingPoints: string[];
  potentialIssues: string[];
}

// Market viability analysis
export interface MarketAnalysis {
  genreTrends: GenreTrend;
  audienceDemand: AudienceDemand;
  seasonalTiming: SeasonalAnalysis;
  competitiveLandscape: CompetitiveAnalysis;
  distributionPotential: DistributionAnalysis;
  internationalAppeal: InternationalMarketData;
  monetizationPotential: MonetizationAnalysis;
}

export interface GenreTrend {
  genre: string;
  trendScore: number; // 0-100
  yearOverYearGrowth: number;
  marketSaturation: number;
  successRate: number;
  averageROI: number;
  topPerformers: string[];
  emergingSubgenres: string[];
}

export interface AudienceDemand {
  primaryDemographic: string;
  secondaryDemographics: string[];
  demandScore: number;
  engagementMetrics: {
    socialMediaBuzz: number;
    searchTrends: number;
    streamingDemand: number;
    boxOfficePotential: number;
  };
  psychographics: string[];
}

export interface SeasonalAnalysis {
  optimalReleaseWindow: string[];
  seasonalityScore: number;
  competingReleases: number;
  holidayAlignment: boolean;
  weatherFactors: string[];
  culturalEvents: string[];
}

// Financial analysis
export interface FinancialAnalysis {
  budgetReasonableness: number;
  roiPotential: number;
  paybackPeriod: number;
  breakEvenAnalysis: BreakEvenData;
  revenueForecast: RevenueForecast;
  costStructure: CostBreakdown;
  financingViability: FinancingAssessment;
  taxIncentives: TaxIncentiveData[];
}

export interface BreakEvenData {
  theatricalBreakEven: number;
  streamingBreakEven: number;
  totalBreakEven: number;
  timeToBreakEven: number; // months
  sensitivityAnalysis: SensitivityData;
}

export interface RevenueForecast {
  theatrical: RevenueStream;
  streaming: RevenueStream;
  international: RevenueStream;
  ancillary: RevenueStream;
  total: RevenueProjection;
  confidence: number;
}

export interface RevenueStream {
  conservative: number;
  expected: number;
  optimistic: number;
  timeframe: string;
  assumptions: string[];
}

export interface RevenueProjection {
  year1: number;
  year2: number;
  year3: number;
  lifetime: number;
}

// Team strength analysis
export interface TeamAnalysis {
  directorTrackRecord: TrackRecord;
  producerExperience: TrackRecord;
  castAttachments: CastAnalysis;
  crewQuality: CrewAnalysis;
  teamSynergy: number;
  industryConnections: number;
  pastCollaborations: CollaborationHistory[];
}

export interface TrackRecord {
  name: string;
  experience: number; // years
  previousProjects: ProjectHistory[];
  averageROI: number;
  genreExpertise: string[];
  awards: string[];
  boxOfficeTotal: number;
  criticalRating: number;
  reputation: number; // 0-100
}

export interface CastAnalysis {
  starPower: number;
  fanBase: number;
  demographicAppeal: string[];
  internationalRecognition: number;
  socialMediaReach: number;
  pastPerformance: number;
  chemistryPotential: number;
}

// Production readiness
export interface ProductionAnalysis {
  locationAvailability: LocationData[];
  permitStatus: PermitStatus;
  crewAvailability: CrewAvailability;
  equipmentAccess: EquipmentAnalysis;
  scheduleFeasibility: ScheduleAnalysis;
  riskMitigation: ProductionRisk[];
  contingencyPlanning: number;
}

export interface LocationData {
  location: string;
  availability: boolean;
  cost: number;
  permits_required: string[];
  weather_risks: string[];
  accessibility: number;
  visual_appeal: number;
}

export interface PermitStatus {
  required_permits: string[];
  obtained_permits: string[];
  pending_permits: string[];
  estimated_timeline: number; // days
  complexity: 'low' | 'medium' | 'high';
}

// Risk assessment
export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  riskScore: number; // 0-100 (higher = riskier)
  riskFactors: RiskFactor[];
  mitigationStrategies: MitigationStrategy[];
  insuranceRecommendations: InsuranceRecommendation[];
  contingencyBudget: number; // percentage of total budget
}

export interface RiskFactor {
  type: 'financial' | 'creative' | 'production' | 'market' | 'legal' | 'technical';
  description: string;
  impact: 'low' | 'medium' | 'high';
  probability: number; // 0-100
  mitigation: string;
  cost_to_mitigate: number;
}

export interface MitigationStrategy {
  risk_id: string;
  strategy: string;
  cost: number;
  effectiveness: number; // 0-100
  timeline: string;
  responsible_party: string;
}

// Market timing and trends
export interface MarketTimingAnalysis {
  currentTrends: MarketTrend[];
  emergingThemes: string[];
  cyclicalPatterns: CyclicalData;
  competitorActivity: CompetitorActivity[];
  optimalTimingScore: number;
  releaseWindowRecommendations: ReleaseWindow[];
}

export interface MarketTrend {
  trend: string;
  strength: number; // 0-100
  duration: string;
  relevance_to_pitch: number;
  supporting_data: string[];
}

export interface ReleaseWindow {
  start_date: string;
  end_date: string;
  score: number;
  reasoning: string;
  competing_releases: number;
  market_conditions: string[];
}

// Comparable projects analysis
export interface ComparableProject {
  title: string;
  genre: string;
  budget: number;
  boxOffice: number;
  roi: number;
  year: number;
  similarities: ProjectSimilarity[];
  lessons_learned: string[];
  success_factors: string[];
  relevance_score: number;
}

export interface ProjectSimilarity {
  factor: string;
  similarity: number; // 0-100
  importance: 'high' | 'medium' | 'low';
  description: string;
}

// AI-powered insights
export interface AIAnalysisInsights {
  successPrediction: SuccessPrediction;
  marketPositioning: MarketPositioning;
  audienceInsights: AudienceInsights;
  optimizationSuggestions: OptimizationSuggestion[];
  trendAlignment: TrendAlignment;
  innovationScore: number;
  viralPotential: number;
}

export interface SuccessPrediction {
  probability: number; // 0-100
  confidence: number; // 0-100
  keyFactors: string[];
  scenarios: PredictionScenario[];
  timeHorizon: string;
  dataQuality: number;
}

export interface PredictionScenario {
  scenario: 'pessimistic' | 'realistic' | 'optimistic';
  probability: number;
  roi_range: [number, number];
  key_assumptions: string[];
  risk_factors: string[];
}

// Recommendations and improvements
export interface ValidationRecommendation {
  id: string;
  category: keyof ValidationCategories;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems: ActionItem[];
  estimatedImpact: number; // score improvement potential
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  cost: number;
  resources: string[];
}

export interface ActionItem {
  task: string;
  responsible: string;
  deadline: string;
  dependencies: string[];
  success_criteria: string[];
}

// Benchmarking data
export interface BenchmarkData {
  category: string;
  industry_average: number;
  top_quartile: number;
  your_score: number;
  percentile: number;
  comparison_pool: string;
  data_freshness: string;
}

// API request/response types
export interface ValidationRequest {
  pitchId: string;
  forceReanalysis?: boolean;
  includeComparables?: boolean;
  includeBenchmarks?: boolean;
  analysisDepth?: 'basic' | 'standard' | 'comprehensive';
}

export interface ValidationResponse {
  success: boolean;
  data?: ValidationScore;
  error?: string;
  analysisTime: number;
  dataFreshness: string;
  recommendationsCount: number;
}

export interface ValidationAnalysisRequest {
  pitchData: {
    title: string;
    logline: string;
    synopsis: string;
    genre: string;
    budget: number;
    director?: string;
    producer?: string;
    cast?: string[];
    script_pages?: number;
    target_audience?: string;
    release_strategy?: string;
  };
  options: {
    depth: 'basic' | 'standard' | 'comprehensive';
    include_market_data: boolean;
    include_comparables: boolean;
    include_predictions: boolean;
  };
}

export interface RecommendationsRequest {
  pitchId: string;
  category?: keyof ValidationCategories;
  priority?: 'high' | 'medium' | 'low';
  limit?: number;
}

export interface ComparablesRequest {
  pitchId: string;
  genre?: string;
  budget_range?: [number, number];
  year_range?: [number, number];
  limit?: number;
  min_similarity?: number;
}

export interface BenchmarkRequest {
  pitchId: string;
  categories: (keyof ValidationCategories)[];
  comparison_pool: 'all' | 'genre' | 'budget_range' | 'similar_projects';
}

// Real-time validation types
export interface RealTimeValidation {
  pitchId: string;
  field: string;
  content: string;
  quickScore: number;
  suggestions: string[];
  warnings: string[];
  timestamp: string;
}

export interface ValidationProgress {
  pitchId: string;
  completeness: number; // 0-100
  missingFields: string[];
  recommendedFields: string[];
  scoreTrend: ScoreTrend[];
}

export interface ScoreTrend {
  date: string;
  overall_score: number;
  category_scores: Partial<ValidationCategories>;
}

// Validation dashboard types
export interface ValidationDashboard {
  pitch: {
    id: string;
    title: string;
    creator: string;
  };
  currentScore: ValidationScore;
  trends: ScoreTrend[];
  activeRecommendations: ValidationRecommendation[];
  competitivePosition: CompetitivePosition;
  nextMilestones: ValidationMilestone[];
}

export interface CompetitivePosition {
  ranking: number; // 1-based ranking among similar pitches
  total_in_category: number;
  percentile: number;
  strengths_vs_competition: string[];
  weaknesses_vs_competition: string[];
}

export interface ValidationMilestone {
  title: string;
  description: string;
  target_score: number;
  current_progress: number;
  estimated_timeline: string;
  priority: 'high' | 'medium' | 'low';
}

// Validation workflow types
export interface ValidationWorkflow {
  id: string;
  pitchId: string;
  stage: 'initial' | 'in_progress' | 'review' | 'complete';
  steps: ValidationStep[];
  currentStep: number;
  estimatedCompletion: string;
}

export interface ValidationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'complete' | 'skipped';
  requirements: string[];
  deliverables: string[];
  estimated_time: string;
}

// Integration types
export interface CrawlAIIntegration {
  marketData: boolean;
  competitorAnalysis: boolean;
  trendAnalysis: boolean;
  audienceResearch: boolean;
}

export interface LegalIntegration {
  contractReadiness: number;
  ipClearance: string[];
  regulatoryCompliance: string[];
  riskFactors: string[];
}

// Export all types for use across the application
export type {
  // Core types
  ValidationScore,
  ValidationCategories,
  CategoryScore,
  ScoreFactor,
  
  // Analysis types
  StoryAnalysis,
  MarketAnalysis,
  FinancialAnalysis,
  TeamAnalysis,
  ProductionAnalysis,
  
  // Specialized analysis
  GenreTrend,
  AudienceDemand,
  SeasonalAnalysis,
  CompetitiveAnalysis,
  DistributionAnalysis,
  
  // Risk and prediction
  RiskAssessment,
  RiskFactor,
  MitigationStrategy,
  SuccessPrediction,
  PredictionScenario,
  
  // Recommendations
  ValidationRecommendation,
  ActionItem,
  BenchmarkData,
  
  // API types
  ValidationRequest,
  ValidationResponse,
  ValidationAnalysisRequest,
  RecommendationsRequest,
  ComparablesRequest,
  BenchmarkRequest,
  
  // Real-time and dashboard
  RealTimeValidation,
  ValidationProgress,
  ValidationDashboard,
  CompetitivePosition,
  ValidationMilestone,
  
  // Workflow
  ValidationWorkflow,
  ValidationStep,
  
  // Integration
  CrawlAIIntegration,
  LegalIntegration
};

// Helper types for complex data structures
export interface SensitivityData {
  variable: string;
  impact_on_breakeven: number;
  scenarios: {
    pessimistic: number;
    base_case: number;
    optimistic: number;
  };
}

export interface CostBreakdown {
  above_the_line: number;
  below_the_line: number;
  post_production: number;
  marketing: number;
  distribution: number;
  contingency: number;
  overhead: number;
}

export interface FinancingAssessment {
  debt_capacity: number;
  equity_requirements: number;
  grant_opportunities: string[];
  tax_credit_value: number;
  investor_attractiveness: number;
  funding_timeline: string;
}

export interface TaxIncentiveData {
  jurisdiction: string;
  incentive_type: string;
  value: number;
  requirements: string[];
  application_deadline: string;
  competitive_advantage: number;
}

export interface ProjectHistory {
  title: string;
  year: number;
  role: string;
  budget: number;
  box_office: number;
  critical_score: number;
  awards: string[];
}

export interface CollaborationHistory {
  collaborator: string;
  projects: number;
  success_rate: number;
  average_roi: number;
  relationship_quality: number;
}

export interface CrewAnalysis {
  department_heads: DepartmentHead[];
  overall_experience: number;
  budget_efficiency: number;
  schedule_reliability: number;
  creative_quality: number;
}

export interface DepartmentHead {
  department: string;
  name: string;
  experience: number;
  portfolio_strength: number;
  availability: boolean;
  rate: number;
}

export interface CrewAvailability {
  key_positions_filled: number;
  hard_to_fill_roles: string[];
  local_crew_pool: number;
  union_considerations: string[];
  backup_options: number;
}

export interface EquipmentAnalysis {
  camera_package: EquipmentItem;
  lighting_package: EquipmentItem;
  sound_package: EquipmentItem;
  specialty_equipment: EquipmentItem[];
  total_cost: number;
  availability_score: number;
}

export interface EquipmentItem {
  type: string;
  cost: number;
  availability: boolean;
  quality: number;
  alternatives: string[];
}

export interface ScheduleAnalysis {
  prep_days: number;
  shoot_days: number;
  post_days: number;
  total_timeline: number;
  critical_path_risks: string[];
  schedule_confidence: number;
  contingency_days: number;
}

export interface ProductionRisk {
  type: string;
  probability: number;
  impact: number;
  mitigation_cost: number;
  insurance_coverage: boolean;
  contingency_plan: string;
}

export interface InsuranceRecommendation {
  type: string;
  coverage_amount: number;
  estimated_premium: number;
  provider_recommendations: string[];
  coverage_gaps: string[];
}

export interface CyclicalData {
  seasonal_patterns: SeasonalPattern[];
  multi_year_cycles: MultiYearCycle[];
  economic_correlations: EconomicCorrelation[];
}

export interface SeasonalPattern {
  season: string;
  performance_multiplier: number;
  genre_preferences: string[];
  audience_behavior: string[];
}

export interface MultiYearCycle {
  cycle_name: string;
  duration: number;
  current_phase: string;
  impact_on_genre: number;
  historical_data: string[];
}

export interface EconomicCorrelation {
  economic_indicator: string;
  correlation_strength: number;
  lag_time: number;
  impact_description: string;
}

export interface CompetitorActivity {
  competitor: string;
  upcoming_releases: CompetitorRelease[];
  market_share: number;
  strategic_focus: string[];
  competitive_threat: number;
}

export interface CompetitorRelease {
  title: string;
  release_date: string;
  budget: number;
  genre: string;
  conflict_potential: number;
}

export interface MarketPositioning {
  recommended_position: string;
  differentiation_strategy: string;
  target_market_segments: string[];
  positioning_score: number;
  competitive_advantages: string[];
}

export interface AudienceInsights {
  primary_personas: AudiencePersona[];
  engagement_strategies: string[];
  content_preferences: ContentPreference[];
  distribution_channels: DistributionChannel[];
  monetization_opportunities: string[];
}

export interface AudiencePersona {
  name: string;
  demographics: {
    age_range: string;
    gender: string;
    income: string;
    education: string;
    location: string;
  };
  psychographics: {
    interests: string[];
    values: string[];
    lifestyle: string[];
    media_consumption: string[];
  };
  size: number;
  engagement_potential: number;
  monetization_value: number;
}

export interface ContentPreference {
  content_type: string;
  preference_score: number;
  consumption_patterns: string[];
  platform_preferences: string[];
}

export interface DistributionChannel {
  channel: string;
  reach: number;
  cost: number;
  effectiveness: number;
  audience_alignment: number;
}

export interface OptimizationSuggestion {
  category: string;
  suggestion: string;
  impact: number;
  effort: string;
  timeline: string;
  success_probability: number;
  resources_required: string[];
}

export interface TrendAlignment {
  current_trends: TrendMatch[];
  emerging_trends: TrendMatch[];
  contrarian_opportunities: string[];
  timing_score: number;
}

export interface TrendMatch {
  trend: string;
  alignment_score: number;
  opportunity_window: string;
  competitive_intensity: number;
  monetization_potential: number;
}

export interface CompetitiveAnalysis {
  direct_competitors: CompetitorProfile[];
  indirect_competitors: CompetitorProfile[];
  market_gaps: MarketGap[];
  competitive_intensity: number;
  differentiation_opportunities: string[];
}

export interface CompetitorProfile {
  name: string;
  market_share: number;
  strengths: string[];
  weaknesses: string[];
  recent_performance: number;
  strategic_direction: string[];
}

export interface MarketGap {
  description: string;
  size: number;
  accessibility: number;
  competition_level: number;
  growth_potential: number;
}

export interface DistributionAnalysis {
  theatrical_potential: number;
  streaming_fit: number;
  international_appeal: number;
  ancillary_opportunities: string[];
  distribution_strategy: string;
  revenue_optimization: string[];
}

export interface InternationalMarketData {
  key_markets: InternationalMarket[];
  cultural_adaptation_needs: string[];
  regulatory_considerations: string[];
  distribution_partnerships: string[];
  revenue_potential: number;
}

export interface InternationalMarket {
  country: string;
  market_size: number;
  genre_preference: number;
  cultural_fit: number;
  regulatory_barriers: string[];
  distribution_channels: string[];
  revenue_potential: number;
}

export interface MonetizationAnalysis {
  primary_revenue_streams: RevenueStream[];
  secondary_opportunities: string[];
  pricing_strategy: PricingStrategy;
  lifetime_value: number;
  monetization_timeline: MonetizationMilestone[];
}

export interface PricingStrategy {
  strategy_type: string;
  price_points: PricePoint[];
  elasticity_analysis: ElasticityData;
  competitive_positioning: string;
  optimization_recommendations: string[];
}

export interface PricePoint {
  tier: string;
  price: number;
  features: string[];
  target_segment: string;
  conversion_rate: number;
}

export interface ElasticityData {
  price_sensitivity: number;
  demand_curve: DemandPoint[];
  optimal_price_range: [number, number];
  revenue_maximizing_price: number;
}

export interface DemandPoint {
  price: number;
  quantity: number;
  revenue: number;
}

export interface MonetizationMilestone {
  milestone: string;
  timeline: string;
  revenue_target: number;
  requirements: string[];
  risk_factors: string[];
}