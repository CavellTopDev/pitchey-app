/**
 * Transaction Monitor Worker - Background monitoring for suspicious activity and automated reports
 * Runs as a background service to continuously monitor transactions and generate alerts
 */

import type { DatabaseService } from '../types/worker-types.ts';
import type { TransactionService } from '../services/transaction.service.ts';
import type { InvestmentNotificationsService } from '../services/investment-notifications.service.ts';
import type { EmailService } from '../services/email.service.ts';
import { eq, and, or, desc, asc, like, isNull, isNotNull, sql, inArray, gte, lte, between } from 'drizzle-orm';

// Redis integration for worker coordination
interface RedisService {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
  rpush: (key: string, value: string) => Promise<void>;
  lpop: (key: string) => Promise<string | null>;
  sadd: (set: string, member: string) => Promise<void>;
  smembers: (set: string) => Promise<string[]>;
  hget: (hash: string, field: string) => Promise<string | null>;
  hset: (hash: string, field: string, value: string) => Promise<void>;
  hincrby: (hash: string, field: string, increment: number) => Promise<number>;
  publish: (channel: string, message: string) => Promise<void>;
  setex: (key: string, seconds: number, value: string) => Promise<void>;
  setnx: (key: string, value: string) => Promise<boolean>;
}

// Worker monitoring interfaces
export interface MonitoringRule {
  id: string;
  name: string;
  type: 'fraud_detection' | 'volume_spike' | 'failed_transactions' | 'unusual_patterns' | 'recurring_failures';
  enabled: boolean;
  
  // Conditions
  conditions: {
    timeWindow: string; // '1m', '5m', '1h', '1d'
    threshold: number;
    comparison: 'greater_than' | 'less_than' | 'equals' | 'percentage_change';
    field: string; // 'amount', 'count', 'failure_rate'
  };
  
  // Actions when triggered
  actions: {
    sendAlert: boolean;
    notifyUsers: boolean;
    escalateToAdmin: boolean;
    pauseTransactions: boolean;
    generateReport: boolean;
  };
  
  // Metadata
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

export interface MonitoringMetrics {
  timestamp: Date;
  
  // Transaction volume metrics
  totalTransactions: number;
  totalVolume: number;
  averageAmount: number;
  
  // Status metrics
  successfulTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  successRate: number;
  
  // Type breakdown
  byType: Record<string, {
    count: number;
    volume: number;
  }>;
  
  // User activity
  activeUsers: number;
  newUsers: number;
  suspiciousUsers: string[];
  
  // Alerts generated
  alertsGenerated: number;
  criticalAlerts: number;
  
  // Performance metrics
  averageProcessingTime: number;
  systemLoad: number;
}

export interface SuspiciousActivityReport {
  id: string;
  userId: number;
  activityType: 'rapid_transactions' | 'large_amounts' | 'unusual_times' | 'geographic_anomaly' | 'pattern_break';
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  // Activity details
  description: string;
  evidencePoints: string[];
  riskScore: number;
  
  // Related transactions
  transactionIds: number[];
  totalAmount: number;
  timespan: string;
  
  // Investigation status
  status: 'pending' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: number;
  
  // Timestamps
  detectedAt: Date;
  resolvedAt?: Date;
  
  // Actions taken
  actionsTaken: string[];
  notes?: string;
}

export interface PeriodicReport {
  id: string;
  type: 'hourly' | 'daily' | 'weekly' | 'monthly';
  period: string;
  generatedAt: Date;
  
  // Summary statistics
  metrics: MonitoringMetrics;
  
  // Key findings
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  
  // Trend analysis
  trends: {
    volumeChange: number;
    successRateChange: number;
    newAlertsCount: number;
    resolvedIssuesCount: number;
  };
  
  // Recipients
  recipients: string[];
  emailSent: boolean;
  
  // Report data
  attachments?: string[];
  reportUrl?: string;
}

export class TransactionMonitorWorker {
  private isRunning = false;
  private monitoringRules: MonitoringRule[] = [];
  private metrics: MonitoringMetrics[] = [];
  private intervalIds: NodeJS.Timeout[] = [];

  constructor(
    private db: DatabaseService,
    private redis: RedisService,
    private transactionService: TransactionService,
    private notificationService: InvestmentNotificationsService,
    private email: EmailService
  ) {
    this.loadMonitoringRules();
  }

  // ============================================================================
  // WORKER LIFECYCLE
  // ============================================================================

  /**
   * Start the transaction monitoring worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Transaction monitor worker is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting transaction monitor worker...');

    try {
      // Ensure only one instance runs (distributed lock)
      const lockKey = 'transaction_monitor_worker_lock';
      const lockAcquired = await this.redis.setnx(lockKey, Date.now().toString());
      
      if (!lockAcquired) {
        console.log('Another instance of transaction monitor is already running');
        this.isRunning = false;
        return;
      }

      // Set lock expiration (1 hour)
      await this.redis.setex(lockKey, 3600, Date.now().toString());

      // Start monitoring tasks
      await this.startMonitoringTasks();
      
      console.log('Transaction monitor worker started successfully');
    } catch (error) {
      console.error('Failed to start transaction monitor worker:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the transaction monitoring worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping transaction monitor worker...');
    this.isRunning = false;

    // Clear all intervals
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds = [];

    // Release distributed lock
    await this.redis.del('transaction_monitor_worker_lock');

    console.log('Transaction monitor worker stopped');
  }

  // ============================================================================
  // MONITORING TASKS
  // ============================================================================

  private async startMonitoringTasks(): Promise<void> {
    // Real-time fraud detection (every 30 seconds)
    this.intervalIds.push(setInterval(() => {
      if (this.isRunning) this.runFraudDetection();
    }, 30 * 1000));

    // Transaction volume monitoring (every 1 minute)
    this.intervalIds.push(setInterval(() => {
      if (this.isRunning) this.monitorTransactionVolume();
    }, 60 * 1000));

    // Pattern analysis (every 5 minutes)
    this.intervalIds.push(setInterval(() => {
      if (this.isRunning) this.analyzeTransactionPatterns();
    }, 5 * 60 * 1000));

    // System health check (every 10 minutes)
    this.intervalIds.push(setInterval(() => {
      if (this.isRunning) this.checkSystemHealth();
    }, 10 * 60 * 1000));

    // Generate hourly reports (every hour)
    this.intervalIds.push(setInterval(() => {
      if (this.isRunning) this.generateHourlyReport();
    }, 60 * 60 * 1000));

    // Daily summary report (every day at 6 AM)
    this.intervalIds.push(setInterval(() => {
      const now = new Date();
      if (this.isRunning && now.getHours() === 6 && now.getMinutes() < 5) {
        this.generateDailySummaryReport();
      }
    }, 5 * 60 * 1000));

    // Cleanup old data (every 4 hours)
    this.intervalIds.push(setInterval(() => {
      if (this.isRunning) this.cleanupOldData();
    }, 4 * 60 * 60 * 1000));

    console.log('All monitoring tasks started');
  }

  // ============================================================================
  // FRAUD DETECTION
  // ============================================================================

  private async runFraudDetection(): Promise<void> {
    try {
      const now = new Date();
      const lookbackMinutes = 30;
      const lookbackTime = new Date(now.getTime() - lookbackMinutes * 60 * 1000);

      // Get recent transactions for analysis
      const recentTransactions = await this.db
        .select()
        .from('transactions')
        .where(gte('created_at', lookbackTime))
        .orderBy(desc('created_at'))
        .limit(1000)
        .execute();

      // Run fraud detection rules
      await this.detectRapidTransactions(recentTransactions);
      await this.detectUnusualAmounts(recentTransactions);
      await this.detectSuspiciousPatterns(recentTransactions);
      await this.detectGeographicAnomalies(recentTransactions);

    } catch (error) {
      console.error('Error in fraud detection:', error);
    }
  }

  private async detectRapidTransactions(transactions: any[]): Promise<void> {
    const userTransactionCounts = new Map();
    const rapidThreshold = 5; // 5 transactions in 5 minutes
    const timeWindow = 5 * 60 * 1000; // 5 minutes

    // Group transactions by user and check for rapid succession
    for (const transaction of transactions) {
      const userId = transaction.userId;
      const transactionTime = new Date(transaction.createdAt).getTime();
      
      if (!userTransactionCounts.has(userId)) {
        userTransactionCounts.set(userId, []);
      }
      
      const userTransactions = userTransactionCounts.get(userId);
      
      // Remove transactions older than time window
      const recentTransactions = userTransactions.filter(
        (t: any) => transactionTime - t.time < timeWindow
      );
      
      recentTransactions.push({
        id: transaction.id,
        time: transactionTime,
        amount: transaction.amount
      });
      
      userTransactionCounts.set(userId, recentTransactions);
      
      // Check if user exceeded rapid transaction threshold
      if (recentTransactions.length >= rapidThreshold) {
        await this.flagSuspiciousActivity({
          userId,
          activityType: 'rapid_transactions',
          severity: 'high',
          description: `${recentTransactions.length} transactions in ${timeWindow / 60000} minutes`,
          evidencePoints: [
            `${recentTransactions.length} transactions detected`,
            `Time window: ${timeWindow / 60000} minutes`,
            `Total amount: $${recentTransactions.reduce((sum: number, t: any) => sum + t.amount, 0).toLocaleString()}`
          ],
          riskScore: Math.min(95, 50 + recentTransactions.length * 5),
          transactionIds: recentTransactions.map((t: any) => t.id),
          totalAmount: recentTransactions.reduce((sum: number, t: any) => sum + t.amount, 0),
          timespan: `${timeWindow / 60000} minutes`
        });
      }
    }
  }

  private async detectUnusualAmounts(transactions: any[]): Promise<void> {
    const largeAmountThreshold = 100000; // $100k
    const userAverages = new Map();

    // Calculate user spending averages over the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    for (const transaction of transactions) {
      if (transaction.amount > largeAmountThreshold) {
        // Check user's historical average
        const userAverage = await this.getUserAverageTransactionAmount(transaction.userId, thirtyDaysAgo);
        
        if (transaction.amount > userAverage * 10) { // 10x larger than average
          await this.flagSuspiciousActivity({
            userId: transaction.userId,
            activityType: 'large_amounts',
            severity: transaction.amount > 500000 ? 'critical' : 'high',
            description: `Transaction amount ${(transaction.amount / userAverage).toFixed(1)}x larger than user average`,
            evidencePoints: [
              `Transaction amount: $${transaction.amount.toLocaleString()}`,
              `User 30-day average: $${userAverage.toLocaleString()}`,
              `Deviation: ${((transaction.amount / userAverage - 1) * 100).toFixed(1)}%`
            ],
            riskScore: Math.min(95, 60 + Math.log10(transaction.amount / userAverage) * 20),
            transactionIds: [transaction.id],
            totalAmount: transaction.amount,
            timespan: 'Single transaction'
          });
        }
      }
    }
  }

  private async detectSuspiciousPatterns(transactions: any[]): Promise<void> {
    // Detect transactions at unusual times (2-6 AM)
    const suspiciousHours = [2, 3, 4, 5, 6];
    
    const nightTimeTransactions = transactions.filter(t => {
      const hour = new Date(t.createdAt).getHours();
      return suspiciousHours.includes(hour) && t.amount > 10000;
    });

    if (nightTimeTransactions.length > 0) {
      const userGroups = nightTimeTransactions.reduce((groups, transaction) => {
        const userId = transaction.userId;
        if (!groups[userId]) groups[userId] = [];
        groups[userId].push(transaction);
        return groups;
      }, {});

      for (const [userId, userTransactions] of Object.entries(userGroups) as [string, any[]][]) {
        if (userTransactions.length >= 2) { // Multiple night transactions
          await this.flagSuspiciousActivity({
            userId: parseInt(userId),
            activityType: 'unusual_times',
            severity: 'medium',
            description: `${userTransactions.length} transactions during unusual hours (2-6 AM)`,
            evidencePoints: [
              `${userTransactions.length} transactions between 2-6 AM`,
              `Total amount: $${userTransactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}`,
              `Times: ${userTransactions.map(t => new Date(t.createdAt).toLocaleTimeString()).join(', ')}`
            ],
            riskScore: 40 + userTransactions.length * 10,
            transactionIds: userTransactions.map(t => t.id),
            totalAmount: userTransactions.reduce((sum, t) => sum + t.amount, 0),
            timespan: 'Night hours (2-6 AM)'
          });
        }
      }
    }
  }

  private async detectGeographicAnomalies(transactions: any[]): Promise<void> {
    // This would integrate with IP geolocation or payment method location data
    // For now, placeholder implementation
    console.log('Geographic anomaly detection would be implemented here');
  }

  // ============================================================================
  // TRANSACTION MONITORING
  // ============================================================================

  private async monitorTransactionVolume(): Promise<void> {
    try {
      const now = new Date();
      const lastMinute = new Date(now.getTime() - 60 * 1000);
      
      // Get transactions from the last minute
      const [volumeData] = await this.db
        .select({
          count: sql`COUNT(*)`,
          volume: sql`SUM(amount)`,
          successRate: sql`(COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*))`
        })
        .from('transactions')
        .where(gte('created_at', lastMinute))
        .execute();

      const currentMetrics: MonitoringMetrics = {
        timestamp: now,
        totalTransactions: Number(volumeData.count),
        totalVolume: Number(volumeData.volume) || 0,
        averageAmount: Number(volumeData.volume) / Number(volumeData.count) || 0,
        successfulTransactions: 0, // Would calculate separately
        failedTransactions: 0,
        pendingTransactions: 0,
        successRate: Number(volumeData.successRate) || 0,
        byType: {},
        activeUsers: 0,
        newUsers: 0,
        suspiciousUsers: [],
        alertsGenerated: 0,
        criticalAlerts: 0,
        averageProcessingTime: 0,
        systemLoad: 0
      };

      // Store metrics
      this.metrics.push(currentMetrics);
      
      // Keep only last hour of metrics
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);

      // Cache metrics in Redis
      await this.redis.hset('transaction_metrics', 'current', JSON.stringify(currentMetrics));

      // Check monitoring rules
      await this.checkMonitoringRules(currentMetrics);

    } catch (error) {
      console.error('Error monitoring transaction volume:', error);
    }
  }

  private async checkMonitoringRules(metrics: MonitoringMetrics): Promise<void> {
    for (const rule of this.monitoringRules) {
      if (!rule.enabled) continue;

      try {
        const triggered = await this.evaluateRule(rule, metrics);
        if (triggered) {
          await this.executeRuleActions(rule, metrics);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.name}:`, error);
      }
    }
  }

  private async evaluateRule(rule: MonitoringRule, metrics: MonitoringMetrics): Promise<boolean> {
    const { conditions } = rule;
    let value: number;

    // Extract the value to compare based on field
    switch (conditions.field) {
      case 'count':
        value = metrics.totalTransactions;
        break;
      case 'volume':
        value = metrics.totalVolume;
        break;
      case 'failure_rate':
        value = 100 - metrics.successRate;
        break;
      case 'avg_amount':
        value = metrics.averageAmount;
        break;
      default:
        return false;
    }

    // Compare against threshold
    switch (conditions.comparison) {
      case 'greater_than':
        return value > conditions.threshold;
      case 'less_than':
        return value < conditions.threshold;
      case 'equals':
        return Math.abs(value - conditions.threshold) < 0.01;
      case 'percentage_change':
        // Compare with historical average
        const historical = await this.getHistoricalAverage(conditions.field, conditions.timeWindow);
        const change = ((value - historical) / historical) * 100;
        return Math.abs(change) > conditions.threshold;
      default:
        return false;
    }
  }

  private async executeRuleActions(rule: MonitoringRule, metrics: MonitoringMetrics): Promise<void> {
    const { actions } = rule;

    // Update rule trigger information
    rule.lastTriggered = new Date();
    rule.triggerCount++;

    if (actions.sendAlert) {
      await this.sendSystemAlert(rule, metrics);
    }

    if (actions.notifyUsers) {
      await this.notifyAffectedUsers(rule, metrics);
    }

    if (actions.escalateToAdmin) {
      await this.escalateToAdmin(rule, metrics);
    }

    if (actions.pauseTransactions && rule.priority === 'critical') {
      await this.emergencyPauseTransactions(rule);
    }

    if (actions.generateReport) {
      await this.generateIncidentReport(rule, metrics);
    }
  }

  // ============================================================================
  // PATTERN ANALYSIS
  // ============================================================================

  private async analyzeTransactionPatterns(): Promise<void> {
    try {
      const now = new Date();
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
      
      // Get transactions for analysis
      const transactions = await this.db
        .select()
        .from('transactions')
        .where(gte('created_at', lastHour))
        .execute();

      // Analyze for various patterns
      await this.analyzeTrendPatterns(transactions);
      await this.analyzeUserBehaviorPatterns(transactions);
      await this.analyzeFailurePatterns(transactions);

    } catch (error) {
      console.error('Error in pattern analysis:', error);
    }
  }

  private async analyzeTrendPatterns(transactions: any[]): Promise<void> {
    // Analyze transaction volume trends, seasonal patterns, etc.
    const hourlyVolume = transactions.reduce((acc, t) => {
      const hour = new Date(t.createdAt).getHours();
      acc[hour] = (acc[hour] || 0) + t.amount;
      return acc;
    }, {} as Record<number, number>);

    // Detect unusual spikes
    const averageHourlyVolume = Object.values(hourlyVolume).reduce((a, b) => a + b, 0) / 24;
    
    for (const [hour, volume] of Object.entries(hourlyVolume)) {
      if (volume > averageHourlyVolume * 3) { // 3x spike
        await this.redis.hset('transaction_alerts', `volume_spike_${hour}`, JSON.stringify({
          hour,
          volume,
          average: averageHourlyVolume,
          spike: volume / averageHourlyVolume,
          timestamp: new Date()
        }));
      }
    }
  }

  private async analyzeUserBehaviorPatterns(transactions: any[]): Promise<void> {
    const userBehavior = transactions.reduce((acc, t) => {
      const userId = t.userId;
      if (!acc[userId]) {
        acc[userId] = {
          count: 0,
          totalAmount: 0,
          types: new Set(),
          timeSpread: { min: Infinity, max: -Infinity }
        };
      }
      
      const user = acc[userId];
      user.count++;
      user.totalAmount += t.amount;
      user.types.add(t.type);
      
      const time = new Date(t.createdAt).getTime();
      user.timeSpread.min = Math.min(user.timeSpread.min, time);
      user.timeSpread.max = Math.max(user.timeSpread.max, time);
      
      return acc;
    }, {} as Record<string, any>);

    // Identify users with unusual behavior
    for (const [userId, behavior] of Object.entries(userBehavior)) {
      const timeSpan = behavior.timeSpread.max - behavior.timeSpread.min;
      const isRapidActivity = behavior.count > 10 && timeSpan < 10 * 60 * 1000; // 10+ transactions in 10 minutes
      
      if (isRapidActivity) {
        await this.flagSuspiciousActivity({
          userId: parseInt(userId),
          activityType: 'pattern_break',
          severity: 'medium',
          description: `Rapid transaction pattern detected`,
          evidencePoints: [
            `${behavior.count} transactions in ${Math.round(timeSpan / 60000)} minutes`,
            `Total amount: $${behavior.totalAmount.toLocaleString()}`,
            `Transaction types: ${Array.from(behavior.types).join(', ')}`
          ],
          riskScore: 50 + Math.min(40, behavior.count * 2),
          transactionIds: [], // Would collect from original data
          totalAmount: behavior.totalAmount,
          timespan: `${Math.round(timeSpan / 60000)} minutes`
        });
      }
    }
  }

  private async analyzeFailurePatterns(transactions: any[]): Promise<void> {
    const failedTransactions = transactions.filter(t => t.status === 'failed');
    
    if (failedTransactions.length > 0) {
      // Group by failure reason if available
      const failureReasons = failedTransactions.reduce((acc, t) => {
        const reason = t.failureReason || 'Unknown';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Check for concerning patterns
      const totalFailures = failedTransactions.length;
      const totalTransactions = transactions.length;
      const failureRate = (totalFailures / totalTransactions) * 100;

      if (failureRate > 10) { // More than 10% failure rate
        await this.sendSystemAlert({
          id: 'high_failure_rate',
          name: 'High Transaction Failure Rate',
          type: 'failed_transactions',
          enabled: true,
          conditions: { timeWindow: '1h', threshold: 10, comparison: 'greater_than', field: 'failure_rate' },
          actions: { sendAlert: true, notifyUsers: false, escalateToAdmin: true, pauseTransactions: false, generateReport: true },
          priority: 'high',
          description: `Transaction failure rate is ${failureRate.toFixed(1)}%`,
          createdAt: new Date(),
          triggerCount: 1
        }, {
          timestamp: new Date(),
          totalTransactions: totalTransactions,
          successRate: 100 - failureRate,
          failedTransactions: totalFailures
        } as MonitoringMetrics);
      }
    }
  }

  // ============================================================================
  // REPORTING
  // ============================================================================

  private async generateHourlyReport(): Promise<void> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      // Calculate hourly metrics
      const hourlyMetrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
      
      if (hourlyMetrics.length === 0) return;

      const report: PeriodicReport = {
        id: `hourly_${now.getTime()}`,
        type: 'hourly',
        period: `${oneHourAgo.toISOString()} - ${now.toISOString()}`,
        generatedAt: now,
        metrics: hourlyMetrics[hourlyMetrics.length - 1], // Latest metrics
        highlights: [],
        concerns: [],
        recommendations: [],
        trends: {
          volumeChange: 0,
          successRateChange: 0,
          newAlertsCount: 0,
          resolvedIssuesCount: 0
        },
        recipients: ['admin@pitchey.com'],
        emailSent: false
      };

      // Store report
      await this.redis.hset('hourly_reports', now.getHours().toString(), JSON.stringify(report));
      
    } catch (error) {
      console.error('Error generating hourly report:', error);
    }
  }

  private async generateDailySummaryReport(): Promise<void> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Get daily transaction summary
      const [dailyStats] = await this.db
        .select({
          totalCount: sql`COUNT(*)`,
          totalVolume: sql`SUM(amount)`,
          successCount: sql`COUNT(CASE WHEN status = 'completed' THEN 1 END)`,
          failureCount: sql`COUNT(CASE WHEN status = 'failed' THEN 1 END)`,
          avgAmount: sql`AVG(amount)`
        })
        .from('transactions')
        .where(and(
          gte('created_at', yesterday),
          lte('created_at', now)
        ))
        .execute();

      const report: PeriodicReport = {
        id: `daily_${now.toDateString()}`,
        type: 'daily',
        period: now.toDateString(),
        generatedAt: now,
        metrics: {
          timestamp: now,
          totalTransactions: Number(dailyStats.totalCount),
          totalVolume: Number(dailyStats.totalVolume) || 0,
          averageAmount: Number(dailyStats.avgAmount) || 0,
          successfulTransactions: Number(dailyStats.successCount),
          failedTransactions: Number(dailyStats.failureCount),
          pendingTransactions: 0,
          successRate: Number(dailyStats.successCount) / Number(dailyStats.totalCount) * 100,
          byType: {},
          activeUsers: 0,
          newUsers: 0,
          suspiciousUsers: [],
          alertsGenerated: 0,
          criticalAlerts: 0,
          averageProcessingTime: 0,
          systemLoad: 0
        },
        highlights: [
          `${dailyStats.totalCount} transactions processed`,
          `$${Number(dailyStats.totalVolume).toLocaleString()} total volume`,
          `${((Number(dailyStats.successCount) / Number(dailyStats.totalCount)) * 100).toFixed(1)}% success rate`
        ],
        concerns: [],
        recommendations: [],
        trends: {
          volumeChange: 0,
          successRateChange: 0,
          newAlertsCount: 0,
          resolvedIssuesCount: 0
        },
        recipients: ['admin@pitchey.com', 'finance@pitchey.com'],
        emailSent: false
      };

      // Send daily summary email
      await this.sendDailySummaryEmail(report);
      
    } catch (error) {
      console.error('Error generating daily summary report:', error);
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async loadMonitoringRules(): Promise<void> {
    // Load rules from database or use defaults
    this.monitoringRules = [
      {
        id: 'high_volume_spike',
        name: 'High Volume Spike',
        type: 'volume_spike',
        enabled: true,
        conditions: {
          timeWindow: '5m',
          threshold: 200,
          comparison: 'percentage_change',
          field: 'volume'
        },
        actions: {
          sendAlert: true,
          notifyUsers: false,
          escalateToAdmin: false,
          pauseTransactions: false,
          generateReport: true
        },
        priority: 'medium',
        description: 'Detects sudden spikes in transaction volume',
        createdAt: new Date(),
        triggerCount: 0
      },
      {
        id: 'critical_failure_rate',
        name: 'Critical Failure Rate',
        type: 'failed_transactions',
        enabled: true,
        conditions: {
          timeWindow: '10m',
          threshold: 20,
          comparison: 'greater_than',
          field: 'failure_rate'
        },
        actions: {
          sendAlert: true,
          notifyUsers: true,
          escalateToAdmin: true,
          pauseTransactions: true,
          generateReport: true
        },
        priority: 'critical',
        description: 'Detects when transaction failure rate exceeds 20%',
        createdAt: new Date(),
        triggerCount: 0
      }
    ];
  }

  private async flagSuspiciousActivity(activity: Omit<SuspiciousActivityReport, 'id' | 'detectedAt' | 'status' | 'actionsTaken'>): Promise<void> {
    const report: SuspiciousActivityReport = {
      ...activity,
      id: `suspicious_${Date.now()}_${activity.userId}`,
      detectedAt: new Date(),
      status: 'pending',
      actionsTaken: []
    };

    // Store in database (would implement table structure)
    await this.redis.hset('suspicious_activity', report.id, JSON.stringify(report));

    // Send immediate alert for high severity
    if (activity.severity === 'high' || activity.severity === 'critical') {
      await this.sendSecurityAlert(report);
    }

    console.log(`Suspicious activity flagged: ${report.id} - ${activity.description}`);
  }

  private async sendSystemAlert(rule: MonitoringRule, metrics: MonitoringMetrics): Promise<void> {
    console.log(`System alert triggered: ${rule.name}`);
    // Implementation would send alert via notification service
  }

  private async sendSecurityAlert(report: SuspiciousActivityReport): Promise<void> {
    console.log(`Security alert: ${report.description} for user ${report.userId}`);
    // Implementation would send security alert
  }

  private async getUserAverageTransactionAmount(userId: number, since: Date): Promise<number> {
    const [result] = await this.db
      .select({
        avg: sql`AVG(amount)`
      })
      .from('transactions')
      .where(and(
        eq('user_id', userId),
        gte('created_at', since),
        eq('status', 'completed')
      ))
      .execute();

    return Number(result.avg) || 1000; // Default fallback
  }

  private async getHistoricalAverage(field: string, timeWindow: string): Promise<number> {
    // Implementation would calculate historical averages
    return 1000; // Placeholder
  }

  private async notifyAffectedUsers(rule: MonitoringRule, metrics: MonitoringMetrics): Promise<void> {
    // Implementation would notify users of system issues
  }

  private async escalateToAdmin(rule: MonitoringRule, metrics: MonitoringMetrics): Promise<void> {
    // Implementation would escalate to admin team
  }

  private async emergencyPauseTransactions(rule: MonitoringRule): Promise<void> {
    console.log(`EMERGENCY: Pausing transactions due to rule: ${rule.name}`);
    // Implementation would temporarily pause transaction processing
  }

  private async generateIncidentReport(rule: MonitoringRule, metrics: MonitoringMetrics): Promise<void> {
    // Implementation would generate detailed incident report
  }

  private async sendDailySummaryEmail(report: PeriodicReport): Promise<void> {
    // Implementation would send formatted email report
    report.emailSent = true;
  }

  private async checkSystemHealth(): Promise<void> {
    // Implementation would check system health metrics
  }

  private async cleanupOldData(): Promise<void> {
    try {
      // Clean up old metrics
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      this.metrics = this.metrics.filter(m => m.timestamp > sevenDaysAgo);

      // Clean up old Redis data
      // Implementation would clean old cached data
      
    } catch (error) {
      console.error('Error cleaning up old data:', error);
    }
  }
}

// Export service factory
export function createTransactionMonitorWorker(
  db: DatabaseService,
  redis: RedisService,
  transactionService: TransactionService,
  notificationService: InvestmentNotificationsService,
  email: EmailService
): TransactionMonitorWorker {
  return new TransactionMonitorWorker(db, redis, transactionService, notificationService, email);
}

// Export types
export type {
  MonitoringRule,
  MonitoringMetrics,
  SuspiciousActivityReport,
  PeriodicReport
};