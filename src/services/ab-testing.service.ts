// Comprehensive A/B Testing Service
// Provides experiment management, user assignment, event tracking, and statistical analysis

import { db } from '../db/client.ts';
import { CacheService } from './cache.service.ts';
import { WebSocketService } from './websocket.service.ts';

// Types and Interfaces
export interface Experiment {
  id: number;
  name: string;
  description?: string;
  hypothesis?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  primaryMetric: string;
  secondaryMetrics: string[];
  trafficAllocation: number;
  targetingRules: Record<string, any>;
  userSegments: string[];
  minimumSampleSize: number;
  statisticalPower: number;
  significanceLevel: number;
  autoWinnerDetection: boolean;
  winnerVariantId?: string;
  tags: string[];
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  pausedAt?: Date;
  completedAt?: Date;
  archivedAt?: Date;
  pauseReason?: string;
  completionReason?: string;
}

export interface ExperimentVariant {
  id: number;
  experimentId: number;
  variantId: string;
  name: string;
  description?: string;
  config: Record<string, any>;
  trafficAllocation: number;
  isControl: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAssignment {
  id: number;
  experimentId: number;
  variantId: string;
  userId?: number;
  sessionId?: string;
  userType?: string;
  userAgent?: string;
  ipAddress?: string;
  assignedAt: Date;
  firstExposureAt?: Date;
  customProperties: Record<string, any>;
}

export interface ExperimentEvent {
  id: number;
  experimentId: number;
  variantId: string;
  eventType: string;
  eventName?: string;
  eventValue?: number;
  userId?: number;
  sessionId?: string;
  userType?: string;
  userAgent?: string;
  ipAddress?: string;
  url?: string;
  referrer?: string;
  elementId?: string;
  elementText?: string;
  properties: Record<string, any>;
  timestamp: Date;
}

export interface ExperimentResults {
  experimentId: number;
  variants: VariantResults[];
  overallStatistics: {
    totalSampleSize: number;
    totalConversions: number;
    overallConversionRate: number;
    experimentDuration: number;
    isStatisticallySignificant: boolean;
    winnerVariantId?: string;
    confidenceLevel: number;
  };
  calculatedAt: Date;
}

export interface VariantResults {
  variantId: string;
  name: string;
  sampleSize: number;
  conversions: number;
  conversionRate: number;
  confidenceInterval: [number, number];
  pValue: number;
  statisticalSignificance: boolean;
  improvementOverControl?: number;
  totalRevenue?: number;
  isControl: boolean;
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

export interface CreateExperimentRequest {
  name: string;
  description?: string;
  hypothesis?: string;
  variants: CreateVariantRequest[];
  trafficAllocation?: number;
  targetingRules?: Record<string, any>;
  userSegments?: string[];
  primaryMetric: string;
  secondaryMetrics?: string[];
  minimumSampleSize?: number;
  statisticalPower?: number;
  significanceLevel?: number;
  autoWinnerDetection?: boolean;
  tags?: string[];
}

export interface CreateVariantRequest {
  id: string;
  name: string;
  description?: string;
  trafficAllocation: number;
  config: Record<string, any>;
  isControl?: boolean;
}

export interface ListExperimentsOptions {
  status?: string[];
  tags?: string[];
  createdBy?: number;
  limit: number;
  offset: number;
  orderBy: 'created' | 'updated' | 'name';
  orderDirection: 'asc' | 'desc';
}

class ABTestingService {
  private cache: CacheService;
  private websocket: WebSocketService;

  constructor() {
    this.cache = new CacheService();
    this.websocket = new WebSocketService();
  }

  // Experiment Management
  async createExperiment(request: CreateExperimentRequest, createdBy: number): Promise<Experiment> {
    
    try {
      await db.execute('BEGIN');

      // Validate traffic allocations sum to 1.0
      const totalAllocation = request.variants.reduce((sum, v) => sum + v.trafficAllocation, 0);
      if (Math.abs(totalAllocation - 1.0) > 0.001) {
        throw new Error('Variant traffic allocations must sum to 1.0');
      }

      // Ensure exactly one control variant
      const controlCount = request.variants.filter(v => v.isControl).length;
      if (controlCount !== 1) {
        throw new Error('Exactly one variant must be marked as control');
      }

      // Create experiment
      const experimentResult = await db.execute(`
        INSERT INTO experiments (
          name, description, hypothesis, primary_metric, secondary_metrics,
          traffic_allocation, targeting_rules, user_segments, minimum_sample_size,
          statistical_power, significance_level, auto_winner_detection, tags, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        request.name,
        request.description,
        request.hypothesis,
        request.primaryMetric,
        request.secondaryMetrics || [],
        request.trafficAllocation || 1.0,
        JSON.stringify(request.targetingRules || {}),
        request.userSegments || [],
        request.minimumSampleSize || 100,
        request.statisticalPower || 0.8,
        request.significanceLevel || 0.05,
        request.autoWinnerDetection || false,
        request.tags || [],
        createdBy
      ]);

      const experiment = experimentResult.rows[0];

      // Create variants
      const variants = await Promise.all(
        request.variants.map(async (variant) => {
          const result = await db.execute(`
            INSERT INTO experiment_variants (
              experiment_id, variant_id, name, description, config,
              traffic_allocation, is_control
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
          `, [
            experiment.id,
            variant.id,
            variant.name,
            variant.description,
            JSON.stringify(variant.config),
            variant.trafficAllocation,
            variant.isControl || false
          ]);
          return result.rows[0];
        })
      );

      await db.execute('COMMIT');

      // Cache the experiment
      await this.cache.set(`experiment:${experiment.id}`, experiment, 300);

      // Notify real-time updates
      this.websocket.broadcast('experiment-created', {
        experimentId: experiment.id,
        name: experiment.name,
        status: experiment.status
      });

      return this.formatExperiment(experiment);
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    } finally {
      
    }
  }

  async startExperiment(experimentId: number, userId: number): Promise<void> {
    

    try {
      // Validate experiment can be started
      const experiment = await this.getExperiment(experimentId);
      if (!experiment) {
        throw new Error('Experiment not found');
      }

      if (experiment.status !== 'draft') {
        throw new Error('Only draft experiments can be started');
      }

      // Ensure variants exist
      const variants = await this.getExperimentVariants(experimentId);
      if (variants.length < 2) {
        throw new Error('Experiment must have at least 2 variants to start');
      }

      // Start experiment
      await db.execute(`
        UPDATE experiments 
        SET status = 'active', started_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [experimentId]);

      // Clear cache
      await this.cache.delete(`experiment:${experimentId}`);

      // Notify real-time updates
      this.websocket.broadcast('experiment-started', {
        experimentId,
        startedAt: new Date(),
        startedBy: userId
      });

    } finally {
      
    }
  }

  async pauseExperiment(experimentId: number, userId: number, reason?: string): Promise<void> {
    

    try {
      await db.execute(`
        UPDATE experiments 
        SET status = 'paused', paused_at = NOW(), pause_reason = $2, updated_at = NOW()
        WHERE id = $1 AND status = 'active'
      `, [experimentId, reason]);

      // Clear cache
      await this.cache.delete(`experiment:${experimentId}`);

      // Notify real-time updates
      this.websocket.broadcast('experiment-paused', {
        experimentId,
        pausedAt: new Date(),
        pausedBy: userId,
        reason
      });

    } finally {
      
    }
  }

  async completeExperiment(experimentId: number, userId: number): Promise<void> {
    

    try {
      await db.execute('BEGIN');

      // Calculate final results
      const results = await this.calculateExperimentResults(experimentId);

      // Determine winner if auto-detection is enabled
      let winnerVariantId: string | undefined;
      const experiment = await this.getExperiment(experimentId);
      
      if (experiment?.autoWinnerDetection) {
        const significantVariants = results.variants.filter(v => 
          v.statisticalSignificance && !v.isControl
        );
        
        if (significantVariants.length > 0) {
          // Choose variant with highest conversion rate
          winnerVariantId = significantVariants.reduce((best, current) => 
            current.conversionRate > best.conversionRate ? current : best
          ).variantId;
        }
      }

      // Complete experiment
      await db.execute(`
        UPDATE experiments 
        SET status = 'completed', completed_at = NOW(), winner_variant_id = $2, updated_at = NOW()
        WHERE id = $1
      `, [experimentId, winnerVariantId]);

      // Create final snapshot
      await this.createExperimentSnapshot(experimentId, 'final', results);

      await db.execute('COMMIT');

      // Clear cache
      await this.cache.delete(`experiment:${experimentId}`);

      // Notify real-time updates
      this.websocket.broadcast('experiment-completed', {
        experimentId,
        completedAt: new Date(),
        completedBy: userId,
        winnerVariantId,
        results
      });

    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    } finally {
      
    }
  }

  // User Assignment and Bucketing
  async assignUserToExperiment(
    experimentId: number, 
    userContext: UserContext
  ): Promise<UserAssignment | null> {
    

    try {
      // Get experiment details
      const experiment = await this.getExperiment(experimentId);
      if (!experiment || experiment.status !== 'active') {
        return null;
      }

      // Check if user already assigned
      const identifier = userContext.userId || userContext.sessionId;
      if (!identifier) {
        return null;
      }

      const existingResult = await db.execute(`
        SELECT * FROM user_experiment_assignments
        WHERE experiment_id = $1 AND (
          (user_id = $2 AND $2 IS NOT NULL) OR 
          (session_id = $3 AND $3 IS NOT NULL)
        )
      `, [experimentId, userContext.userId, userContext.sessionId]);

      if (existingResult.rows.length > 0) {
        return this.formatUserAssignment(existingResult.rows[0]);
      }

      // Check targeting rules
      if (!await this.checkTargetingRules(experiment.targetingRules, userContext)) {
        return null;
      }

      // Get experiment variants
      const variants = await this.getExperimentVariants(experimentId);
      if (variants.length === 0) {
        return null;
      }

      // Assign to variant using deterministic hash
      const variantId = this.assignToVariant(identifier.toString(), variants);

      // Create assignment
      const assignmentResult = await db.execute(`
        INSERT INTO user_experiment_assignments (
          experiment_id, variant_id, user_id, session_id, user_type,
          user_agent, ip_address, custom_properties
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        experimentId,
        variantId,
        userContext.userId,
        userContext.sessionId,
        userContext.userType,
        userContext.userAgent,
        userContext.ipAddress,
        JSON.stringify(userContext.customProperties || {})
      ]);

      const assignment = this.formatUserAssignment(assignmentResult.rows[0]);

      // Cache assignment
      const cacheKey = `assignment:${experimentId}:${identifier}`;
      await this.cache.set(cacheKey, assignment, 600);

      return assignment;

    } finally {
      
    }
  }

  async getUserExperimentAssignments(
    userId?: number,
    sessionId?: string
  ): Promise<UserAssignment[]> {
    if (!userId && !sessionId) {
      return [];
    }

    

    try {
      const result = await db.execute(`
        SELECT uea.*, e.status as experiment_status
        FROM user_experiment_assignments uea
        JOIN experiments e ON uea.experiment_id = e.id
        WHERE e.status = 'active' AND (
          (uea.user_id = $1 AND $1 IS NOT NULL) OR 
          (uea.session_id = $2 AND $2 IS NOT NULL)
        )
        ORDER BY uea.assigned_at DESC
      `, [userId, sessionId]);

      return result.rows.map(this.formatUserAssignment);
    } finally {
      
    }
  }

  // Event Tracking
  async trackExperimentEvent(
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
    

    try {
      // Validate experiment is active
      const experiment = await this.getExperiment(experimentId);
      if (!experiment || experiment.status !== 'active') {
        return;
      }

      // Update first exposure time if this is the first event
      const identifier = userContext.userId || userContext.sessionId;
      if (identifier) {
        await db.execute(`
          UPDATE user_experiment_assignments
          SET first_exposure_at = COALESCE(first_exposure_at, NOW())
          WHERE experiment_id = $1 AND (
            (user_id = $2 AND $2 IS NOT NULL) OR 
            (session_id = $3 AND $3 IS NOT NULL)
          )
        `, [experimentId, userContext.userId, userContext.sessionId]);
      }

      // Track event
      await db.execute(`
        INSERT INTO experiment_events (
          experiment_id, variant_id, event_type, event_name, event_value,
          user_id, session_id, user_type, user_agent, ip_address,
          url, referrer, element_id, element_text, properties
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        experimentId,
        variantId,
        eventType,
        eventData?.eventName,
        eventData?.eventValue,
        userContext.userId,
        userContext.sessionId,
        userContext.userType,
        userContext.userAgent,
        userContext.ipAddress,
        eventData?.url,
        userContext.referrer,
        eventData?.elementId,
        eventData?.elementText,
        JSON.stringify(eventData?.properties || {})
      ]);

      // Real-time event broadcast for dashboard
      this.websocket.broadcast('experiment-event', {
        experimentId,
        variantId,
        eventType,
        timestamp: new Date(),
        eventData
      });

      // Invalidate cached results if this is a conversion event
      if (eventType === 'conversion') {
        await this.cache.delete(`results:${experimentId}`);
      }

    } finally {
      
    }
  }

  // Statistical Analysis
  async calculateExperimentResults(experimentId: number): Promise<ExperimentResults> {
    // Check cache first
    const cached = await this.cache.get<ExperimentResults>(`results:${experimentId}`);
    if (cached) {
      return cached;
    }

    

    try {
      const experiment = await this.getExperiment(experimentId);
      if (!experiment) {
        throw new Error('Experiment not found');
      }

      const variants = await this.getExperimentVariants(experimentId);
      const variantResults: VariantResults[] = [];
      let controlResults: VariantResults | undefined;

      // Calculate results for each variant
      for (const variant of variants) {
        const stats = await this.calculateVariantStatistics(experimentId, variant.variantId, experiment.primaryMetric);
        
        const result: VariantResults = {
          variantId: variant.variantId,
          name: variant.name,
          sampleSize: stats.sampleSize,
          conversions: stats.conversions,
          conversionRate: stats.conversionRate,
          confidenceInterval: stats.confidenceInterval,
          pValue: 0, // Will be calculated against control
          statisticalSignificance: false,
          totalRevenue: stats.totalRevenue,
          isControl: variant.isControl
        };

        if (variant.isControl) {
          controlResults = result;
        }

        variantResults.push(result);
      }

      // Calculate statistical significance against control
      if (controlResults) {
        for (const result of variantResults) {
          if (!result.isControl) {
            const significance = this.calculateStatisticalSignificance(
              controlResults,
              result,
              experiment.significanceLevel
            );
            result.pValue = significance.pValue;
            result.statisticalSignificance = significance.isSignificant;
            result.improvementOverControl = significance.improvementPercentage;
          }
        }
      }

      const overallStats = this.calculateOverallStatistics(variantResults, experiment);
      
      const results: ExperimentResults = {
        experimentId,
        variants: variantResults,
        overallStatistics: overallStats,
        calculatedAt: new Date()
      };

      // Cache results for 60 seconds
      await this.cache.set(`results:${experimentId}`, results, 60);

      // Update cached results in database
      await this.updateResultsCache(experimentId, variantResults);

      return results;

    } finally {
      
    }
  }

  // Feature Flags
  async getFeatureFlagValue<T = any>(
    flagKey: string,
    userContext: UserContext,
    defaultValue: T
  ): Promise<T> {
    

    try {
      // Check for user-specific override first
      const identifier = userContext.userId || userContext.sessionId;
      if (identifier) {
        const overrideResult = await db.execute(`
          SELECT override_value FROM user_feature_flag_overrides
          WHERE flag_key = $1 AND (
            (user_id = $2 AND $2 IS NOT NULL) OR 
            (session_id = $3 AND $3 IS NOT NULL)
          ) AND (expires_at IS NULL OR expires_at > NOW())
          ORDER BY user_id NULLS LAST
          LIMIT 1
        `, [flagKey, userContext.userId, userContext.sessionId]);

        if (overrideResult.rows.length > 0) {
          return overrideResult.rows[0].override_value;
        }
      }

      // Get feature flag
      const flagResult = await db.execute(`
        SELECT * FROM feature_flags WHERE flag_key = $1 AND enabled = true
      `, [flagKey]);

      if (flagResult.rows.length === 0) {
        return defaultValue;
      }

      const flag = flagResult.rows[0];

      // Check targeting rules
      if (!await this.checkTargetingRules(flag.targeting_rules, userContext)) {
        return defaultValue;
      }

      return flag.default_value;

    } finally {
      
    }
  }

  // Utility Methods
  private assignToVariant(identifier: string, variants: ExperimentVariant[]): string {
    // Use deterministic hash to assign user to variant
    const hash = this.hashString(identifier);
    const normalizedHash = hash / Math.pow(2, 32);
    
    let cumulativeAllocation = 0;
    for (const variant of variants) {
      cumulativeAllocation += variant.trafficAllocation;
      if (normalizedHash <= cumulativeAllocation) {
        return variant.variantId;
      }
    }
    
    // Fallback to first variant
    return variants[0].variantId;
  }

  private hashString(str: string): number {
    let hash = 0;
    const safeStr = str.slice(0, 1024);
    for (let i = 0; i < safeStr.length; i++) {
      const char = safeStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async checkTargetingRules(rules: Record<string, any>, userContext: UserContext): Promise<boolean> {
    // Simple targeting rule evaluation
    // This can be extended with more complex rule engines
    
    if (!rules || Object.keys(rules).length === 0) {
      return true;
    }

    // Example targeting rules
    if (rules.userType && userContext.userType !== rules.userType) {
      return false;
    }

    if (rules.excludeUserTypes && rules.excludeUserTypes.includes(userContext.userType)) {
      return false;
    }

    return true;
  }

  private calculateStatisticalSignificance(
    control: VariantResults,
    variant: VariantResults,
    significanceLevel: number
  ): { pValue: number; isSignificant: boolean; improvementPercentage: number } {
    // Z-test for proportions
    const p1 = control.conversionRate;
    const p2 = variant.conversionRate;
    const n1 = control.sampleSize;
    const n2 = variant.sampleSize;

    if (n1 === 0 || n2 === 0) {
      return { pValue: 1, isSignificant: false, improvementPercentage: 0 };
    }

    const pooledProportion = (control.conversions + variant.conversions) / (n1 + n2);
    const standardError = Math.sqrt(pooledProportion * (1 - pooledProportion) * (1/n1 + 1/n2));
    
    if (standardError === 0) {
      return { pValue: 1, isSignificant: false, improvementPercentage: 0 };
    }

    const zScore = (p2 - p1) / standardError;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
    const isSignificant = pValue < significanceLevel;
    const improvementPercentage = p1 === 0 ? 0 : ((p2 - p1) / p1) * 100;

    return { pValue, isSignificant, improvementPercentage };
  }

  private normalCDF(x: number): number {
    // Approximation of the cumulative distribution function for standard normal distribution
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1 + sign * y);
  }

  // Helper methods for data formatting and persistence
  private formatExperiment(row: any): Experiment {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      hypothesis: row.hypothesis,
      status: row.status,
      primaryMetric: row.primary_metric,
      secondaryMetrics: row.secondary_metrics,
      trafficAllocation: parseFloat(row.traffic_allocation),
      targetingRules: typeof row.targeting_rules === 'string' 
        ? JSON.parse(row.targeting_rules) 
        : row.targeting_rules,
      userSegments: row.user_segments,
      minimumSampleSize: row.minimum_sample_size,
      statisticalPower: parseFloat(row.statistical_power),
      significanceLevel: parseFloat(row.significance_level),
      autoWinnerDetection: row.auto_winner_detection,
      winnerVariantId: row.winner_variant_id,
      tags: row.tags,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      pausedAt: row.paused_at ? new Date(row.paused_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
      pauseReason: row.pause_reason,
      completionReason: row.completion_reason
    };
  }

  private formatUserAssignment(row: any): UserAssignment {
    return {
      id: row.id,
      experimentId: row.experiment_id,
      variantId: row.variant_id,
      userId: row.user_id,
      sessionId: row.session_id,
      userType: row.user_type,
      userAgent: row.user_agent,
      ipAddress: row.ip_address,
      assignedAt: new Date(row.assigned_at),
      firstExposureAt: row.first_exposure_at ? new Date(row.first_exposure_at) : undefined,
      customProperties: typeof row.custom_properties === 'string'
        ? JSON.parse(row.custom_properties)
        : row.custom_properties
    };
  }

  // Additional helper methods would be implemented here...
  private async getExperiment(id: number): Promise<Experiment | null> {
    const cached = await this.cache.get<Experiment>(`experiment:${id}`);
    if (cached) return cached;

    
    try {
      const result = await db.execute('SELECT * FROM experiments WHERE id = $1', [id]);
      if (result.rows.length === 0) return null;
      
      const experiment = this.formatExperiment(result.rows[0]);
      await this.cache.set(`experiment:${id}`, experiment, 300);
      return experiment;
    } finally {
      
    }
  }

  private async getExperimentVariants(experimentId: number): Promise<ExperimentVariant[]> {
    
    try {
      const result = await db.execute(
        'SELECT * FROM experiment_variants WHERE experiment_id = $1 ORDER BY traffic_allocation DESC',
        [experimentId]
      );
      return result.rows.map(row => ({
        id: row.id,
        experimentId: row.experiment_id,
        variantId: row.variant_id,
        name: row.name,
        description: row.description,
        config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
        trafficAllocation: parseFloat(row.traffic_allocation),
        isControl: row.is_control,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } finally {
      
    }
  }

  private async calculateVariantStatistics(experimentId: number, variantId: string, metric: string) {
    
    try {
      const result = await db.execute(`
        SELECT 
          COUNT(DISTINCT COALESCE(user_id::text, session_id)) as sample_size,
          COUNT(*) FILTER (WHERE event_type = 'conversion') as conversions,
          COALESCE(SUM(event_value) FILTER (WHERE event_type = 'conversion'), 0) as total_revenue
        FROM experiment_events
        WHERE experiment_id = $1 AND variant_id = $2
      `, [experimentId, variantId]);

      const stats = result.rows[0];
      const sampleSize = parseInt(stats.sample_size) || 0;
      const conversions = parseInt(stats.conversions) || 0;
      const conversionRate = sampleSize > 0 ? conversions / sampleSize : 0;
      
      // Calculate confidence interval using Wilson score interval
      const confidence = this.calculateConfidenceInterval(conversions, sampleSize, 0.95);

      return {
        sampleSize,
        conversions,
        conversionRate,
        confidenceInterval: confidence,
        totalRevenue: parseFloat(stats.total_revenue) || 0
      };
    } finally {
      
    }
  }

  private calculateConfidenceInterval(successes: number, trials: number, confidence: number): [number, number] {
    if (trials === 0) return [0, 0];

    const z = 1.96; // 95% confidence
    const p = successes / trials;
    const margin = z * Math.sqrt((p * (1 - p)) / trials);
    
    return [Math.max(0, p - margin), Math.min(1, p + margin)];
  }

  private calculateOverallStatistics(variants: VariantResults[], experiment: Experiment) {
    const totalSampleSize = variants.reduce((sum, v) => sum + v.sampleSize, 0);
    const totalConversions = variants.reduce((sum, v) => sum + v.conversions, 0);
    const overallConversionRate = totalSampleSize > 0 ? totalConversions / totalSampleSize : 0;

    const significantVariants = variants.filter(v => v.statisticalSignificance);
    const hasSignificantResults = significantVariants.length > 0;
    
    let winnerVariantId: string | undefined;
    if (hasSignificantResults) {
      winnerVariantId = significantVariants.reduce((best, current) =>
        current.conversionRate > best.conversionRate ? current : best
      ).variantId;
    }

    const startedAt = experiment.startedAt;
    const experimentDuration = startedAt 
      ? Math.floor((Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      totalSampleSize,
      totalConversions,
      overallConversionRate,
      experimentDuration,
      isStatisticallySignificant: hasSignificantResults,
      winnerVariantId,
      confidenceLevel: experiment.significanceLevel
    };
  }

  private async updateResultsCache(experimentId: number, variants: VariantResults[]): Promise<void> {
    
    try {
      for (const variant of variants) {
        await db.execute(`
          INSERT INTO experiment_results_cache (
            experiment_id, variant_id, metric, sample_size, conversion_rate,
            confidence_interval_lower, confidence_interval_upper, p_value,
            statistical_significance, improvement_over_control, total_conversions, total_revenue
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (experiment_id, variant_id, metric)
          DO UPDATE SET
            sample_size = EXCLUDED.sample_size,
            conversion_rate = EXCLUDED.conversion_rate,
            confidence_interval_lower = EXCLUDED.confidence_interval_lower,
            confidence_interval_upper = EXCLUDED.confidence_interval_upper,
            p_value = EXCLUDED.p_value,
            statistical_significance = EXCLUDED.statistical_significance,
            improvement_over_control = EXCLUDED.improvement_over_control,
            total_conversions = EXCLUDED.total_conversions,
            total_revenue = EXCLUDED.total_revenue,
            calculated_at = NOW()
        `, [
          experimentId,
          variant.variantId,
          'conversion', // Primary metric
          variant.sampleSize,
          variant.conversionRate,
          variant.confidenceInterval[0],
          variant.confidenceInterval[1],
          variant.pValue,
          variant.statisticalSignificance,
          variant.improvementOverControl,
          variant.conversions,
          variant.totalRevenue
        ]);
      }
    } finally {
      
    }
  }

  private async createExperimentSnapshot(experimentId: number, type: string, data: any): Promise<void> {
    
    try {
      await db.execute(`
        INSERT INTO experiment_snapshots (experiment_id, snapshot_type, snapshot_date, data)
        VALUES ($1, $2, CURRENT_DATE, $3)
        ON CONFLICT (experiment_id, snapshot_type, snapshot_date)
        DO UPDATE SET data = EXCLUDED.data, created_at = NOW()
      `, [experimentId, type, JSON.stringify(data)]);
    } finally {
      
    }
  }

  async listExperiments(options: ListExperimentsOptions): Promise<{ experiments: Experiment[]; total: number }> {
    
    
    try {
      // Build WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (options.status && options.status.length > 0) {
        conditions.push(`status = ANY($${paramIndex})`);
        params.push(options.status);
        paramIndex++;
      }

      if (options.tags && options.tags.length > 0) {
        conditions.push(`tags && $${paramIndex}`);
        params.push(options.tags);
        paramIndex++;
      }

      if (options.createdBy) {
        conditions.push(`created_by = $${paramIndex}`);
        params.push(options.createdBy);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await db.execute(`
        SELECT COUNT(*) FROM experiments ${whereClause}
      `, params);
      const total = parseInt(countResult.rows[0].count);

      // Get experiments with pagination
      const orderDirection = options.orderDirection.toUpperCase();
      const orderColumn = options.orderBy === 'created' ? 'created_at' 
        : options.orderBy === 'updated' ? 'updated_at' 
        : 'name';

      const experimentsResult = await db.execute(`
        SELECT * FROM experiments ${whereClause}
        ORDER BY ${orderColumn} ${orderDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, options.limit, options.offset]);

      const experiments = experimentsResult.rows.map(this.formatExperiment);

      return { experiments, total };
    } finally {
      
    }
  }

  async getExperimentResults(experimentId: number): Promise<ExperimentResults | null> {
    return this.calculateExperimentResults(experimentId);
  }
}

export default new ABTestingService();