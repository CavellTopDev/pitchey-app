/**
 * Notification A/B Testing Service
 * Manages experiments and variant testing for notifications
 */

import { db } from "../db/db";
import { notifications } from "../db/schema-notifications";
import { sql } from "drizzle-orm";
import { redis } from "../lib/redis";
import { notificationService } from "./notification.service";

interface ABTestVariant {
  id: string;
  name: string;
  titleTemplate?: string;
  bodyTemplate?: string;
  channel?: string;
  priority?: string;
  timing?: string; // immediate, delayed, scheduled
  delayMinutes?: number;
  weight: number; // Distribution weight (0-100)
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
  };
}

interface ABTestExperiment {
  id: string;
  name: string;
  description: string;
  notificationType: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate: Date;
  endDate?: Date;
  targetAudience: {
    userType?: string;
    segments?: string[];
    percentage?: number; // What percentage of users to include
  };
  variants: ABTestVariant[];
  control: ABTestVariant;
  winningVariant?: string;
  confidenceLevel: number;
  minimumSampleSize: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ExperimentResults {
  experimentId: string;
  control: VariantResults;
  variants: Record<string, VariantResults>;
  winner?: {
    variantId: string;
    confidence: number;
    improvement: number;
  };
  insights: string[];
}

interface VariantResults {
  variantId: string;
  sampleSize: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  averageTimeToOpen: number;
  averageTimeToClick: number;
  confidence: number;
  significantDifference: boolean;
}

export class NotificationABTestingService {
  private static instance: NotificationABTestingService;
  private experiments: Map<string, ABTestExperiment> = new Map();
  
  private constructor() {
    this.loadExperiments();
  }
  
  static getInstance(): NotificationABTestingService {
    if (!NotificationABTestingService.instance) {
      NotificationABTestingService.instance = new NotificationABTestingService();
    }
    return NotificationABTestingService.instance;
  }
  
  /**
   * Create a new A/B test experiment
   */
  async createExperiment(
    experiment: Omit<ABTestExperiment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ABTestExperiment> {
    const newExperiment: ABTestExperiment = {
      ...experiment,
      id: this.generateExperimentId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Validate variants
    this.validateExperiment(newExperiment);
    
    // Store experiment
    this.experiments.set(newExperiment.id, newExperiment);
    await this.saveExperiment(newExperiment);
    
    console.log(`Created A/B test experiment: ${newExperiment.name}`);
    
    return newExperiment;
  }
  
  /**
   * Send notification with A/B testing
   */
  async sendWithABTest(
    userId: number,
    notificationType: string,
    baseData: any
  ): Promise<{ 
    sent: boolean; 
    experimentId?: string; 
    variantId?: string;
  }> {
    try {
      // Find active experiment for this notification type
      const experiment = this.getActiveExperiment(notificationType);
      
      if (!experiment) {
        // No experiment, send normal notification
        await notificationService.createNotification({
          userId,
          type: notificationType,
          ...baseData
        });
        
        return { sent: true };
      }
      
      // Check if user should be in experiment
      if (!await this.shouldIncludeUser(userId, experiment)) {
        // User not in experiment, send control
        await this.sendVariant(userId, experiment.control, baseData);
        return { 
          sent: true, 
          experimentId: experiment.id, 
          variantId: 'control' 
        };
      }
      
      // Select variant for user
      const variant = await this.selectVariant(userId, experiment);
      
      // Send variant
      await this.sendVariant(userId, variant, baseData);
      
      // Track metrics
      await this.trackSend(experiment.id, variant.id, userId);
      
      return {
        sent: true,
        experimentId: experiment.id,
        variantId: variant.id
      };
    } catch (error) {
      console.error('Error in A/B test notification:', error);
      return { sent: false };
    }
  }
  
  /**
   * Select variant for user
   */
  private async selectVariant(
    userId: number,
    experiment: ABTestExperiment
  ): Promise<ABTestVariant> {
    // Check if user already assigned to variant
    const cacheKey = `ab:assignment:${experiment.id}:${userId}`;
    const cached = await redis?.get(cacheKey);
    
    if (cached) {
      const variantId = cached;
      const variant = experiment.variants.find(v => v.id === variantId);
      if (variant) return variant;
    }
    
    // Assign user to variant based on weights
    const selected = this.weightedRandomSelection(
      [experiment.control, ...experiment.variants]
    );
    
    // Cache assignment
    if (redis) {
      await redis.setex(cacheKey, 86400 * 30, selected.id); // 30 days
    }
    
    return selected;
  }
  
  /**
   * Weighted random selection
   */
  private weightedRandomSelection(variants: ABTestVariant[]): ABTestVariant {
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    const random = Math.random() * totalWeight;
    
    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (random < cumulative) {
        return variant;
      }
    }
    
    return variants[0]; // Fallback
  }
  
  /**
   * Send specific variant
   */
  private async sendVariant(
    userId: number,
    variant: ABTestVariant,
    baseData: any
  ): Promise<void> {
    const notificationData = {
      userId,
      type: baseData.type,
      title: variant.titleTemplate || baseData.title,
      message: variant.bodyTemplate || baseData.message,
      priority: variant.priority || baseData.priority,
      ...baseData,
      metadata: {
        ...baseData.metadata,
        abTestVariant: variant.id
      }
    };
    
    if (variant.timing === 'delayed' && variant.delayMinutes) {
      // Schedule for later
      setTimeout(async () => {
        await notificationService.createNotification(notificationData);
      }, variant.delayMinutes * 60 * 1000);
    } else {
      // Send immediately
      await notificationService.createNotification(notificationData);
    }
  }
  
  /**
   * Track notification send
   */
  private async trackSend(
    experimentId: string,
    variantId: string,
    userId: number
  ): Promise<void> {
    const key = `ab:metrics:${experimentId}:${variantId}`;
    
    if (redis) {
      await redis.hincrby(key, 'sent', 1);
      await redis.sadd(`ab:users:${experimentId}:${variantId}`, userId);
    }
    
    // Update experiment metrics
    const experiment = this.experiments.get(experimentId);
    if (experiment) {
      const variant = experiment.variants.find(v => v.id === variantId) || experiment.control;
      variant.metrics.sent++;
      await this.saveExperiment(experiment);
    }
  }
  
  /**
   * Track notification interaction
   */
  async trackInteraction(
    notificationId: number,
    action: 'delivered' | 'opened' | 'clicked' | 'converted'
  ): Promise<void> {
    try {
      // Get notification metadata
      const [notification] = await db
        .select()
        .from(notifications)
        .where(sql`id = ${notificationId}`)
        .limit(1);
      
      if (!notification || !notification.metadata?.abTestVariant) {
        return;
      }
      
      const variantId = notification.metadata.abTestVariant;
      const experimentId = await this.getExperimentIdForVariant(variantId);
      
      if (!experimentId) return;
      
      // Update metrics
      const key = `ab:metrics:${experimentId}:${variantId}`;
      
      if (redis) {
        await redis.hincrby(key, action, 1);
        
        if (action === 'opened') {
          // Track time to open
          const createdAt = new Date(notification.createdAt).getTime();
          const openedAt = Date.now();
          const timeToOpen = openedAt - createdAt;
          await redis.lpush(
            `ab:times:${experimentId}:${variantId}:open`,
            timeToOpen
          );
        }
      }
      
      // Update experiment
      const experiment = this.experiments.get(experimentId);
      if (experiment) {
        const variant = experiment.variants.find(v => v.id === variantId) || experiment.control;
        variant.metrics[action]++;
        
        // Check if we have enough data to determine winner
        if (await this.shouldCheckForWinner(experiment)) {
          await this.determineWinner(experiment);
        }
        
        await this.saveExperiment(experiment);
      }
    } catch (error) {
      console.error('Error tracking A/B test interaction:', error);
    }
  }
  
  /**
   * Get experiment results
   */
  async getResults(experimentId: string): Promise<ExperimentResults> {
    const experiment = this.experiments.get(experimentId);
    
    if (!experiment) {
      throw new Error('Experiment not found');
    }
    
    const results: ExperimentResults = {
      experimentId,
      control: await this.getVariantResults(experiment, experiment.control),
      variants: {},
      insights: []
    };
    
    // Get results for each variant
    for (const variant of experiment.variants) {
      results.variants[variant.id] = await this.getVariantResults(experiment, variant);
    }
    
    // Statistical analysis
    const winner = await this.performStatisticalAnalysis(results);
    if (winner) {
      results.winner = winner;
    }
    
    // Generate insights
    results.insights = this.generateInsights(results);
    
    return results;
  }
  
  /**
   * Get variant results
   */
  private async getVariantResults(
    experiment: ABTestExperiment,
    variant: ABTestVariant
  ): Promise<VariantResults> {
    const metrics = variant.metrics;
    
    const results: VariantResults = {
      variantId: variant.id,
      sampleSize: metrics.sent,
      deliveryRate: metrics.sent > 0 ? metrics.delivered / metrics.sent : 0,
      openRate: metrics.delivered > 0 ? metrics.opened / metrics.delivered : 0,
      clickRate: metrics.opened > 0 ? metrics.clicked / metrics.opened : 0,
      conversionRate: metrics.sent > 0 ? metrics.converted / metrics.sent : 0,
      averageTimeToOpen: await this.getAverageTime(experiment.id, variant.id, 'open'),
      averageTimeToClick: await this.getAverageTime(experiment.id, variant.id, 'click'),
      confidence: 0,
      significantDifference: false
    };
    
    return results;
  }
  
  /**
   * Get average time for action
   */
  private async getAverageTime(
    experimentId: string,
    variantId: string,
    action: 'open' | 'click'
  ): Promise<number> {
    if (!redis) return 0;
    
    const times = await redis.lrange(
      `ab:times:${experimentId}:${variantId}:${action}`,
      0,
      -1
    );
    
    if (times.length === 0) return 0;
    
    const sum = times.reduce((acc, time) => acc + parseInt(time), 0);
    return sum / times.length / 1000; // Convert to seconds
  }
  
  /**
   * Perform statistical analysis
   */
  private async performStatisticalAnalysis(
    results: ExperimentResults
  ): Promise<{ variantId: string; confidence: number; improvement: number } | null> {
    const control = results.control;
    let bestVariant: any = null;
    let highestConfidence = 0;
    
    for (const [variantId, variant] of Object.entries(results.variants)) {
      // Calculate confidence using Z-test for proportions
      const confidence = this.calculateConfidence(
        control.conversionRate,
        control.sampleSize,
        variant.conversionRate,
        variant.sampleSize
      );
      
      variant.confidence = confidence;
      variant.significantDifference = confidence >= 0.95;
      
      if (confidence > highestConfidence && variant.conversionRate > control.conversionRate) {
        highestConfidence = confidence;
        bestVariant = {
          variantId,
          confidence,
          improvement: ((variant.conversionRate - control.conversionRate) / control.conversionRate) * 100
        };
      }
    }
    
    return highestConfidence >= 0.95 ? bestVariant : null;
  }
  
  /**
   * Calculate statistical confidence
   */
  private calculateConfidence(
    p1: number,
    n1: number,
    p2: number,
    n2: number
  ): number {
    if (n1 === 0 || n2 === 0) return 0;
    
    // Pooled proportion
    const p = (p1 * n1 + p2 * n2) / (n1 + n2);
    
    // Standard error
    const se = Math.sqrt(p * (1 - p) * (1/n1 + 1/n2));
    
    if (se === 0) return 0;
    
    // Z-score
    const z = Math.abs(p1 - p2) / se;
    
    // Convert to confidence level (simplified)
    // For proper implementation, use a Z-table or statistical library
    if (z >= 2.58) return 0.99; // 99% confidence
    if (z >= 1.96) return 0.95; // 95% confidence
    if (z >= 1.645) return 0.90; // 90% confidence
    
    return z / 2.58; // Approximate confidence
  }
  
  /**
   * Generate insights
   */
  private generateInsights(results: ExperimentResults): string[] {
    const insights: string[] = [];
    
    // Sample size insight
    if (results.control.sampleSize < 100) {
      insights.push('⚠️ Sample size is still small. Results may not be statistically significant.');
    }
    
    // Performance insights
    for (const [variantId, variant] of Object.entries(results.variants)) {
      if (variant.openRate > results.control.openRate * 1.2) {
        insights.push(`✅ Variant ${variantId} has 20%+ higher open rate`);
      }
      
      if (variant.clickRate > results.control.clickRate * 1.5) {
        insights.push(`🎯 Variant ${variantId} has 50%+ higher click rate`);
      }
      
      if (variant.averageTimeToOpen < results.control.averageTimeToOpen * 0.8) {
        insights.push(`⚡ Variant ${variantId} is opened 20% faster`);
      }
    }
    
    // Winner insight
    if (results.winner) {
      insights.push(
        `🏆 Variant ${results.winner.variantId} is winning with ${
          results.winner.improvement.toFixed(1)
        }% improvement and ${
          (results.winner.confidence * 100).toFixed(0)
        }% confidence`
      );
    }
    
    return insights;
  }
  
  /**
   * Determine if we should check for a winner
   */
  private async shouldCheckForWinner(experiment: ABTestExperiment): Promise<boolean> {
    const totalSent = experiment.control.metrics.sent + 
      experiment.variants.reduce((sum, v) => sum + v.metrics.sent, 0);
    
    return totalSent >= experiment.minimumSampleSize;
  }
  
  /**
   * Determine winner and optionally end experiment
   */
  private async determineWinner(experiment: ABTestExperiment): Promise<void> {
    const results = await this.getResults(experiment.id);
    
    if (results.winner && results.winner.confidence >= experiment.confidenceLevel) {
      experiment.winningVariant = results.winner.variantId;
      experiment.status = 'completed';
      experiment.endDate = new Date();
      
      console.log(
        `Experiment ${experiment.name} completed. Winner: ${
          results.winner.variantId
        } with ${results.winner.improvement.toFixed(1)}% improvement`
      );
      
      // Optionally auto-apply winning variant
      if (experiment.winningVariant !== 'control') {
        await this.applyWinningVariant(experiment);
      }
    }
  }
  
  /**
   * Apply winning variant as default
   */
  private async applyWinningVariant(experiment: ABTestExperiment): Promise<void> {
    // This would update the default notification templates
    console.log(`Applying winning variant ${experiment.winningVariant} as default`);
    
    // Implementation would depend on your template system
  }
  
  /**
   * Get active experiment for notification type
   */
  private getActiveExperiment(notificationType: string): ABTestExperiment | null {
    for (const experiment of this.experiments.values()) {
      if (
        experiment.status === 'running' &&
        experiment.notificationType === notificationType &&
        (!experiment.endDate || experiment.endDate > new Date())
      ) {
        return experiment;
      }
    }
    return null;
  }
  
  /**
   * Check if user should be included in experiment
   */
  private async shouldIncludeUser(
    userId: number,
    experiment: ABTestExperiment
  ): Promise<boolean> {
    // Check if user matches target audience
    // This is simplified - real implementation would check user segments
    
    if (experiment.targetAudience.percentage) {
      // Use consistent hashing to ensure user always gets same assignment
      const hash = this.hashUserId(userId, experiment.id);
      return hash < experiment.targetAudience.percentage;
    }
    
    return true;
  }
  
  /**
   * Hash user ID for consistent assignment
   */
  private hashUserId(userId: number, experimentId: string): number {
    const str = `${userId}:${experimentId}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }
  
  /**
   * Validate experiment configuration
   */
  private validateExperiment(experiment: ABTestExperiment): void {
    const totalWeight = experiment.control.weight + 
      experiment.variants.reduce((sum, v) => sum + v.weight, 0);
    
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error('Variant weights must sum to 100');
    }
    
    if (experiment.variants.length === 0) {
      throw new Error('At least one variant is required');
    }
    
    if (experiment.minimumSampleSize < 100) {
      throw new Error('Minimum sample size must be at least 100');
    }
  }
  
  /**
   * Generate experiment ID
   */
  private generateExperimentId(): string {
    return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get experiment ID for variant
   */
  private async getExperimentIdForVariant(variantId: string): Promise<string | null> {
    for (const experiment of this.experiments.values()) {
      if (
        experiment.control.id === variantId ||
        experiment.variants.some(v => v.id === variantId)
      ) {
        return experiment.id;
      }
    }
    return null;
  }
  
  /**
   * Load experiments from storage
   */
  private async loadExperiments(): Promise<void> {
    // Load from database or Redis
    // This is simplified - real implementation would persist to database
    if (redis) {
      const keys = await redis.keys('ab:experiment:*');
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const experiment = JSON.parse(data);
          this.experiments.set(experiment.id, experiment);
        }
      }
    }
  }
  
  /**
   * Save experiment to storage
   */
  private async saveExperiment(experiment: ABTestExperiment): Promise<void> {
    experiment.updatedAt = new Date();
    
    if (redis) {
      await redis.setex(
        `ab:experiment:${experiment.id}`,
        86400 * 30, // 30 days
        JSON.stringify(experiment)
      );
    }
    
    // Also save to database for persistence
  }
  
  /**
   * List all experiments
   */
  async listExperiments(
    status?: 'draft' | 'running' | 'paused' | 'completed'
  ): Promise<ABTestExperiment[]> {
    const experiments = Array.from(this.experiments.values());
    
    if (status) {
      return experiments.filter(e => e.status === status);
    }
    
    return experiments;
  }
  
  /**
   * Pause experiment
   */
  async pauseExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (experiment) {
      experiment.status = 'paused';
      await this.saveExperiment(experiment);
    }
  }
  
  /**
   * Resume experiment
   */
  async resumeExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (experiment) {
      experiment.status = 'running';
      await this.saveExperiment(experiment);
    }
  }
}

// Export singleton instance
export const notificationABTesting = NotificationABTestingService.getInstance();