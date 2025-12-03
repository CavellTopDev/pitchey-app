// A/B Testing Service - Core experiment management and bucketing logic
import { createHash } from 'crypto';
import { db } from '../db/connection.js';
import { 
  experiments, 
  userExperimentAssignments, 
  experimentEvents, 
  experimentResults,
  experimentAuditLog,
  abFeatureFlags,
  users
} from '../db/schema.js';
import { eq, and, sql, desc, asc, gte, lte, inArray, or } from 'drizzle-orm';
import type { 
  Experiment, 
  UserExperimentAssignment, 
  ExperimentEvent,
  ExperimentResult,
  ABFeatureFlag
} from '../db/schema.js';

// Types for A/B testing
export interface ExperimentVariant {
  id: string;
  name: string;
  description?: string;
  trafficAllocation: number; // 0-1
  config: Record<string, any>;
}

export interface ExperimentConfig {
  name: string;
  description?: string;
  hypothesis?: string;
  variants: ExperimentVariant[];
  trafficAllocation: number;
  targetingRules: Record<string, any>;
  userSegments: string[];
  primaryMetric: string;
  secondaryMetrics: string[];
  minimumSampleSize: number;
  statisticalPower: number;
  significanceLevel: number;
  tags?: string[];
}

export interface UserContext {
  userId?: number;
  sessionId?: string;
  userType?: string;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  customProperties?: Record<string, any>;
}

export interface ExperimentAssignment {
  experimentId: number;
  experimentName: string;
  variantId: string;
  variantConfig: Record<string, any>;
  isActive: boolean;
}

export class ABTestingService {
  
  // Create a new experiment
  static async createExperiment(config: ExperimentConfig, createdBy: number): Promise<Experiment> {
    // Validate configuration
    this.validateExperimentConfig(config);
    
    // Calculate variant allocations
    const variants = this.normalizeVariantAllocations(config.variants);
    
    const experiment = await db.insert(experiments).values({
      name: config.name,
      description: config.description,
      hypothesis: config.hypothesis,
      status: 'draft',
      trafficAllocation: config.trafficAllocation.toString(),
      variants: JSON.stringify(variants),
      targetingRules: config.targetingRules,
      userSegments: config.userSegments,
      primaryMetric: config.primaryMetric,
      secondaryMetrics: config.secondaryMetrics,
      minimumSampleSize: config.minimumSampleSize,
      statisticalPower: config.statisticalPower.toString(),
      significanceLevel: config.significanceLevel.toString(),
      tags: config.tags || [],
      createdBy,
      updatedBy: createdBy,
    }).returning();

    // Log creation
    await this.logExperimentAction(experiment[0].id, 'created', {}, experiment[0], createdBy);
    
    return experiment[0];
  }

  // Start an experiment
  static async startExperiment(experimentId: number, userId: number): Promise<void> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error('Experiment not found');
    }

    if (experiment.status !== 'draft' && experiment.status !== 'paused') {
      throw new Error(`Cannot start experiment in status: ${experiment.status}`);
    }

    const previousValues = { status: experiment.status };
    const now = new Date();

    await db.update(experiments)
      .set({ 
        status: 'active',
        startDate: now,
        updatedAt: now,
        updatedBy: userId
      })
      .where(eq(experiments.id, experimentId));

    // Log action
    await this.logExperimentAction(
      experimentId, 
      'started', 
      previousValues, 
      { status: 'active', startDate: now },
      userId
    );
  }

  // Pause an experiment
  static async pauseExperiment(experimentId: number, userId: number, reason?: string): Promise<void> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error('Experiment not found');
    }

    if (experiment.status !== 'active') {
      throw new Error(`Cannot pause experiment in status: ${experiment.status}`);
    }

    const previousValues = { status: experiment.status };
    const now = new Date();

    await db.update(experiments)
      .set({ 
        status: 'paused',
        updatedAt: now,
        updatedBy: userId
      })
      .where(eq(experiments.id, experimentId));

    // Log action
    await this.logExperimentAction(
      experimentId, 
      'paused', 
      previousValues, 
      { status: 'paused' },
      userId,
      reason
    );
  }

  // Complete an experiment
  static async completeExperiment(experimentId: number, userId: number): Promise<void> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error('Experiment not found');
    }

    if (experiment.status !== 'active' && experiment.status !== 'paused') {
      throw new Error(`Cannot complete experiment in status: ${experiment.status}`);
    }

    const previousValues = { status: experiment.status };
    const now = new Date();

    await db.update(experiments)
      .set({ 
        status: 'completed',
        endDate: now,
        updatedAt: now,
        updatedBy: userId
      })
      .where(eq(experiments.id, experimentId));

    // Calculate final results
    await this.calculateExperimentResults(experimentId);

    // Log action
    await this.logExperimentAction(
      experimentId, 
      'completed', 
      previousValues, 
      { status: 'completed', endDate: now },
      userId
    );
  }

  // Get user's experiment assignments
  static async getUserExperimentAssignments(
    userId?: number, 
    sessionId?: string
  ): Promise<ExperimentAssignment[]> {
    if (!userId && !sessionId) {
      return [];
    }

    const whereClause = userId 
      ? eq(userExperimentAssignments.userId, userId)
      : eq(userExperimentAssignments.sessionId, sessionId!);

    const assignments = await db
      .select({
        assignment: userExperimentAssignments,
        experiment: experiments
      })
      .from(userExperimentAssignments)
      .innerJoin(experiments, eq(userExperimentAssignments.experimentId, experiments.id))
      .where(and(
        whereClause,
        eq(experiments.status, 'active'),
        or(
          sql`${experiments.endDate} IS NULL`,
          gte(experiments.endDate, new Date())
        )
      ));

    return assignments.map(({ assignment, experiment }) => {
      const variants = JSON.parse(experiment.variants as string) as ExperimentVariant[];
      const variant = variants.find(v => v.id === assignment.variantId);
      
      return {
        experimentId: experiment.id,
        experimentName: experiment.name,
        variantId: assignment.variantId,
        variantConfig: variant?.config || {},
        isActive: true
      };
    });
  }

  // Assign user to experiment variant (bucketing algorithm)
  static async assignUserToExperiment(
    experimentId: number,
    userContext: UserContext
  ): Promise<ExperimentAssignment | null> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment || experiment.status !== 'active') {
      return null;
    }

    // Check if user is already assigned
    const existingAssignment = await this.getExistingAssignment(experimentId, userContext);
    if (existingAssignment) {
      return this.formatAssignment(experiment, existingAssignment.variantId);
    }

    // Check targeting rules
    if (!this.matchesTargetingRules(experiment, userContext)) {
      return null;
    }

    // Check traffic allocation
    if (!this.isInTrafficAllocation(experiment, userContext)) {
      return null;
    }

    // Assign to variant using deterministic hashing
    const variantId = this.assignToVariant(experiment, userContext);
    
    // Store assignment
    await this.storeAssignment(experimentId, variantId, userContext);

    return this.formatAssignment(experiment, variantId);
  }

  // Track experiment event
  static async trackExperimentEvent(
    experimentId: number,
    variantId: string,
    eventType: string,
    userContext: UserContext,
    eventData?: {
      eventName?: string;
      eventValue?: number;
      properties?: Record<string, any>;
      url?: string;
      elementId?: string;
      elementText?: string;
    }
  ): Promise<void> {
    await db.insert(experimentEvents).values({
      userId: userContext.userId,
      sessionId: userContext.sessionId,
      experimentId,
      variantId,
      eventType,
      eventName: eventData?.eventName,
      eventValue: eventData?.eventValue?.toString(),
      properties: eventData?.properties || {},
      url: eventData?.url,
      elementId: eventData?.elementId,
      elementText: eventData?.elementText,
      userAgent: userContext.userAgent,
      ipAddress: userContext.ipAddress,
    });
  }

  // Get experiment results
  static async getExperimentResults(experimentId: number): Promise<ExperimentResult | null> {
    const results = await db
      .select()
      .from(experimentResults)
      .where(eq(experimentResults.experimentId, experimentId))
      .limit(1);

    return results[0] || null;
  }

  // Calculate experiment results with statistical analysis
  static async calculateExperimentResults(experimentId: number): Promise<ExperimentResult> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error('Experiment not found');
    }

    // Get all events for this experiment
    const events = await db
      .select()
      .from(experimentEvents)
      .where(eq(experimentEvents.experimentId, experimentId));

    // Get unique participants per variant
    const participantsByVariant = await db
      .select({
        variantId: experimentEvents.variantId,
        participants: sql<number>`COUNT(DISTINCT COALESCE(${experimentEvents.userId}, ${experimentEvents.sessionId}))`
      })
      .from(experimentEvents)
      .where(eq(experimentEvents.experimentId, experimentId))
      .groupBy(experimentEvents.variantId);

    // Get conversion events (based on primary metric)
    const conversionEvents = events.filter(event => 
      event.eventType === experiment.primaryMetric || 
      event.eventType === 'conversion'
    );

    // Calculate conversion rates by variant
    const conversionsByVariant = conversionEvents.reduce((acc, event) => {
      if (!acc[event.variantId]) {
        acc[event.variantId] = 0;
      }
      acc[event.variantId]++;
      return acc;
    }, {} as Record<string, number>);

    // Calculate statistics
    const variantSampleSizes: Record<string, number> = {};
    const conversionRates: Record<string, number> = {};
    
    for (const { variantId, participants } of participantsByVariant) {
      variantSampleSizes[variantId] = participants;
      const conversions = conversionsByVariant[variantId] || 0;
      conversionRates[variantId] = participants > 0 ? conversions / participants : 0;
    }

    // Statistical significance calculation (simplified Z-test)
    const { pValue, isSignificant, winningVariant, liftPercentage } = 
      this.calculateStatisticalSignificance(conversionRates, variantSampleSizes, experiment);

    // Calculate confidence intervals
    const confidenceIntervals = this.calculateConfidenceIntervals(
      conversionRates, 
      variantSampleSizes, 
      0.95
    );

    // Prepare result data
    const resultData = {
      experimentId,
      status: isSignificant ? 'significant' : 'calculating',
      totalParticipants: Object.values(variantSampleSizes).reduce((sum, size) => sum + size, 0),
      variantSampleSizes,
      primaryMetricResults: {
        metric: experiment.primaryMetric,
        conversionRates,
        totalConversions: conversionsByVariant
      },
      conversionRates,
      pValue: pValue?.toString(),
      confidenceLevel: '0.95',
      isStatisticallySignificant: isSignificant,
      winningVariant,
      liftPercentage: liftPercentage?.toString(),
      confidenceIntervals,
      secondaryMetricResults: {},
      segments: {},
      timeSeriesData: {},
      recommendation: this.generateRecommendation(isSignificant, winningVariant, liftPercentage),
      confidence: isSignificant ? 'high' : 'medium',
      nextCalculationAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    };

    // Upsert results
    const existingResults = await this.getExperimentResults(experimentId);
    
    if (existingResults) {
      await db.update(experimentResults)
        .set({
          ...resultData,
          calculatedAt: new Date()
        })
        .where(eq(experimentResults.experimentId, experimentId));
    } else {
      await db.insert(experimentResults).values({
        ...resultData,
        calculatedAt: new Date()
      });
    }

    return await this.getExperimentResults(experimentId) as ExperimentResult;
  }

  // Feature flag integration
  static async getFeatureFlagValue<T = any>(
    flagKey: string,
    userContext: UserContext,
    defaultValue: T
  ): Promise<T> {
    const flag = await db
      .select()
      .from(abFeatureFlags)
      .where(and(
        eq(abFeatureFlags.key, flagKey),
        eq(abFeatureFlags.enabled, true)
      ))
      .limit(1);

    if (!flag[0]) {
      return defaultValue;
    }

    const featureFlag = flag[0];

    // If associated with an experiment, use experiment bucketing
    if (featureFlag.experimentId) {
      const assignment = await this.assignUserToExperiment(featureFlag.experimentId, userContext);
      if (assignment && featureFlag.variantValues) {
        const variantValues = featureFlag.variantValues as Record<string, any>;
        return variantValues[assignment.variantId] ?? defaultValue;
      }
    }

    // Use rollout percentage for gradual rollout
    if (featureFlag.rolloutPercentage && featureFlag.rolloutPercentage > 0) {
      const hash = this.hashUser(userContext);
      const bucket = hash % 100;
      if (bucket < featureFlag.rolloutPercentage) {
        return featureFlag.defaultValue as T;
      }
    }

    return defaultValue;
  }

  // Private helper methods

  private static async getExperiment(experimentId: number): Promise<Experiment | null> {
    const result = await db
      .select()
      .from(experiments)
      .where(eq(experiments.id, experimentId))
      .limit(1);

    return result[0] || null;
  }

  private static async getExistingAssignment(
    experimentId: number,
    userContext: UserContext
  ): Promise<UserExperimentAssignment | null> {
    const whereClause = userContext.userId 
      ? and(
          eq(userExperimentAssignments.experimentId, experimentId),
          eq(userExperimentAssignments.userId, userContext.userId)
        )
      : and(
          eq(userExperimentAssignments.experimentId, experimentId),
          eq(userExperimentAssignments.sessionId, userContext.sessionId!)
        );

    const result = await db
      .select()
      .from(userExperimentAssignments)
      .where(whereClause)
      .limit(1);

    return result[0] || null;
  }

  private static matchesTargetingRules(experiment: Experiment, userContext: UserContext): boolean {
    const rules = experiment.targetingRules as Record<string, any>;
    
    // Check user segments
    if (experiment.userSegments && experiment.userSegments.length > 0) {
      const userType = userContext.userType || 'anonymous';
      if (!experiment.userSegments.includes(userType)) {
        return false;
      }
    }

    // Additional targeting rules can be added here
    // e.g., geography, device type, browser, etc.

    return true;
  }

  private static isInTrafficAllocation(experiment: Experiment, userContext: UserContext): boolean {
    const allocation = parseFloat(experiment.trafficAllocation);
    if (allocation >= 1.0) return true;

    const hash = this.hashUser(userContext);
    const bucket = (hash % 10000) / 10000; // 0-1 range with 4 decimal precision
    
    return bucket < allocation;
  }

  private static assignToVariant(experiment: Experiment, userContext: UserContext): string {
    const variants = JSON.parse(experiment.variants as string) as ExperimentVariant[];
    const hash = this.hashUser(userContext);
    
    // Normalize variant allocations to sum to 1.0
    const normalizedVariants = this.normalizeVariantAllocations(variants);
    
    // Use hash to determine bucket
    const bucket = (hash % 10000) / 10000; // 0-1 range
    
    let cumulativeAllocation = 0;
    for (const variant of normalizedVariants) {
      cumulativeAllocation += variant.trafficAllocation;
      if (bucket < cumulativeAllocation) {
        return variant.id;
      }
    }

    // Fallback to control (first variant)
    return normalizedVariants[0].id;
  }

  private static hashUser(userContext: UserContext): number {
    const identifier = userContext.userId?.toString() || userContext.sessionId || 'anonymous';
    const hash = createHash('md5').update(identifier).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }

  private static normalizeVariantAllocations(variants: ExperimentVariant[]): ExperimentVariant[] {
    const totalAllocation = variants.reduce((sum, variant) => sum + variant.trafficAllocation, 0);
    
    if (totalAllocation === 0) {
      // Equal allocation if no allocations specified
      const equalAllocation = 1 / variants.length;
      return variants.map(variant => ({
        ...variant,
        trafficAllocation: equalAllocation
      }));
    }

    // Normalize to sum to 1.0
    return variants.map(variant => ({
      ...variant,
      trafficAllocation: variant.trafficAllocation / totalAllocation
    }));
  }

  private static async storeAssignment(
    experimentId: number,
    variantId: string,
    userContext: UserContext
  ): Promise<void> {
    await db.insert(userExperimentAssignments).values({
      userId: userContext.userId,
      sessionId: userContext.sessionId,
      experimentId,
      variantId,
      assignedAt: new Date(),
      assignmentMethod: 'hash',
      bucketing: {
        algorithm: 'md5_hash',
        timestamp: new Date().toISOString()
      },
      userAgent: userContext.userAgent,
      ipAddress: userContext.ipAddress,
      isOverride: false,
      excludedFromAnalysis: false
    });
  }

  private static formatAssignment(experiment: Experiment, variantId: string): ExperimentAssignment {
    const variants = JSON.parse(experiment.variants as string) as ExperimentVariant[];
    const variant = variants.find(v => v.id === variantId);
    
    return {
      experimentId: experiment.id,
      experimentName: experiment.name,
      variantId,
      variantConfig: variant?.config || {},
      isActive: true
    };
  }

  private static calculateStatisticalSignificance(
    conversionRates: Record<string, number>,
    sampleSizes: Record<string, number>,
    experiment: Experiment
  ) {
    const variants = Object.keys(conversionRates);
    if (variants.length < 2) {
      return { pValue: null, isSignificant: false, winningVariant: null, liftPercentage: null };
    }

    // Assume first variant is control
    const controlVariant = variants[0];
    const controlRate = conversionRates[controlVariant];
    const controlSize = sampleSizes[controlVariant];

    let bestVariant = controlVariant;
    let bestRate = controlRate;
    let bestPValue = 1;
    let bestLift = 0;

    // Compare each variant to control
    for (let i = 1; i < variants.length; i++) {
      const variantId = variants[i];
      const variantRate = conversionRates[variantId];
      const variantSize = sampleSizes[variantId];

      // Simple Z-test for proportions (simplified implementation)
      const pHat = (controlRate * controlSize + variantRate * variantSize) / (controlSize + variantSize);
      const standardError = Math.sqrt(pHat * (1 - pHat) * (1 / controlSize + 1 / variantSize));
      
      if (standardError > 0) {
        const zScore = (variantRate - controlRate) / standardError;
        const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
        
        if (variantRate > bestRate && pValue < bestPValue) {
          bestVariant = variantId;
          bestRate = variantRate;
          bestPValue = pValue;
          bestLift = ((variantRate - controlRate) / controlRate) * 100;
        }
      }
    }

    const significanceLevel = parseFloat(experiment.significanceLevel) || 0.05;
    const isSignificant = bestPValue < significanceLevel;

    return {
      pValue: bestPValue,
      isSignificant,
      winningVariant: isSignificant ? bestVariant : null,
      liftPercentage: isSignificant ? bestLift : null
    };
  }

  private static calculateConfidenceIntervals(
    conversionRates: Record<string, number>,
    sampleSizes: Record<string, number>,
    confidence: number
  ): Record<string, { lower: number; upper: number }> {
    const zScore = 1.96; // 95% confidence
    const intervals: Record<string, { lower: number; upper: number }> = {};

    for (const [variantId, rate] of Object.entries(conversionRates)) {
      const n = sampleSizes[variantId];
      const margin = zScore * Math.sqrt((rate * (1 - rate)) / n);
      
      intervals[variantId] = {
        lower: Math.max(0, rate - margin),
        upper: Math.min(1, rate + margin)
      };
    }

    return intervals;
  }

  private static generateRecommendation(
    isSignificant: boolean,
    winningVariant: string | null,
    liftPercentage: number | null
  ): string {
    if (!isSignificant) {
      return 'Continue running the experiment to gather more data for statistical significance.';
    }

    if (!winningVariant) {
      return 'No significant winner detected. Consider running the experiment longer or reviewing the setup.';
    }

    if (liftPercentage && liftPercentage > 0) {
      return `Variant ${winningVariant} shows a significant improvement of ${liftPercentage.toFixed(2)}%. Consider rolling out this variant.`;
    }

    return `Variant ${winningVariant} is the statistical winner. Evaluate business impact before rolling out.`;
  }

  private static normalCDF(x: number): number {
    // Approximation of normal cumulative distribution function
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private static erf(x: number): number {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private static async logExperimentAction(
    experimentId: number,
    action: string,
    previousValues: Record<string, any>,
    newValues: Record<string, any>,
    userId: number,
    reason?: string
  ): Promise<void> {
    const changedFields = Object.keys(newValues);
    
    await db.insert(experimentAuditLog).values({
      experimentId,
      action,
      previousValues,
      newValues,
      changedFields,
      reason,
      automaticChange: false,
      userId,
      timestamp: new Date()
    });
  }

  private static validateExperimentConfig(config: ExperimentConfig): void {
    if (!config.name || config.name.trim().length === 0) {
      throw new Error('Experiment name is required');
    }

    if (!config.variants || config.variants.length < 2) {
      throw new Error('Experiment must have at least 2 variants');
    }

    if (config.trafficAllocation < 0 || config.trafficAllocation > 1) {
      throw new Error('Traffic allocation must be between 0 and 1');
    }

    if (!config.primaryMetric || config.primaryMetric.trim().length === 0) {
      throw new Error('Primary metric is required');
    }

    // Validate variant IDs are unique
    const variantIds = config.variants.map(v => v.id);
    const uniqueIds = new Set(variantIds);
    if (variantIds.length !== uniqueIds.size) {
      throw new Error('Variant IDs must be unique');
    }
  }

  // List experiments with filters
  static async listExperiments(options: {
    status?: string[];
    tags?: string[];
    createdBy?: number;
    limit?: number;
    offset?: number;
    orderBy?: 'created' | 'updated' | 'name';
    orderDirection?: 'asc' | 'desc';
  } = {}): Promise<{ experiments: Experiment[]; total: number }> {
    let query = db.select().from(experiments);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(experiments);

    const conditions = [];

    if (options.status && options.status.length > 0) {
      conditions.push(inArray(experiments.status, options.status));
    }

    if (options.createdBy) {
      conditions.push(eq(experiments.createdBy, options.createdBy));
    }

    if (conditions.length > 0) {
      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
      query = query.where(whereClause);
      countQuery = countQuery.where(whereClause);
    }

    // Order by
    const orderDirection = options.orderDirection === 'desc' ? desc : asc;
    switch (options.orderBy) {
      case 'updated':
        query = query.orderBy(orderDirection(experiments.updatedAt));
        break;
      case 'name':
        query = query.orderBy(orderDirection(experiments.name));
        break;
      default:
        query = query.orderBy(orderDirection(experiments.createdAt));
    }

    // Pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    const [experimentList, totalCount] = await Promise.all([
      query,
      countQuery
    ]);

    return {
      experiments: experimentList,
      total: totalCount[0].count
    };
  }
}

export default ABTestingService;