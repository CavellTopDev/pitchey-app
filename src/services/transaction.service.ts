/**
 * Comprehensive Transaction Service with Notification Triggers and Audit Trails
 * Handles all financial transactions, monitoring, ROI calculations, and alerts
 */

import type { DatabaseService } from '../types/worker-types.ts';
import type { NotificationService } from './notification.service.ts';
import type { EmailService } from './email.service.ts';
import { eq, and, or, desc, asc, like, isNull, isNotNull, sql, inArray, gte, lte, between } from 'drizzle-orm';

// Redis integration for real-time monitoring and caching
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
}

// Transaction types and interfaces
export interface TransactionInput {
  userId: number;
  investmentId?: number;
  pitchId?: number;
  type: 'investment' | 'withdrawal' | 'deposit' | 'roi_distribution' | 'fee' | 'refund' | 'transfer';
  amount: number;
  currency: string;
  description?: string;
  reference?: string;
  externalTransactionId?: string;
  paymentMethodId?: number;
  
  // Source and destination for transfers
  sourceAccountId?: number;
  destinationAccountId?: number;
  
  // Processing details
  processingFee?: number;
  exchangeRate?: number;
  
  // Metadata
  metadata?: Record<string, any>;
  scheduledAt?: Date;
  
  // Notification preferences
  sendNotifications?: boolean;
  notificationChannels?: string[];
}

export interface TransactionResult {
  transactionId: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  reference: string;
  amount: number;
  finalAmount: number; // After fees
  processingFee: number;
  confirmationUrl?: string;
  estimatedCompletion?: Date;
  notifications: {
    email?: boolean;
    push?: boolean;
    sms?: boolean;
  };
}

export interface TransactionDetails {
  id: number;
  userId: number;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  reference: string;
  externalTransactionId?: string;
  processingFee?: number;
  finalAmount: number;
  
  // Related entities
  investmentId?: number;
  pitchId?: number;
  paymentMethodId?: number;
  
  // Audit trail
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  
  // Additional details
  metadata?: Record<string, any>;
  failureReason?: string;
  
  // Related data (populated when needed)
  investment?: any;
  pitch?: any;
  user?: any;
  paymentMethod?: any;
}

export interface ROIDistribution {
  id: number;
  investmentId: number;
  amount: number;
  distributionDate: Date;
  period: string; // 'Q1 2024', 'Monthly Dec 2024', etc.
  type: 'profit_share' | 'dividend' | 'royalty' | 'milestone';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transactionId?: number;
  
  // Calculation details
  totalProfit: number;
  investorShare: number; // Percentage
  distributionRate: number;
  
  // Metadata
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionAlert {
  id: number;
  userId: number;
  type: 'suspicious_activity' | 'large_transaction' | 'failed_payment' | 'low_balance' | 'unusual_pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  triggeredBy: string; // Transaction ID or pattern description
  
  // Alert configuration
  threshold?: number;
  pattern?: string;
  timeWindow?: string;
  
  // Status
  status: 'active' | 'reviewed' | 'resolved' | 'false_positive';
  reviewedBy?: number;
  reviewedAt?: Date;
  resolution?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionMetrics {
  totalVolume: number;
  totalTransactions: number;
  successRate: number;
  averageAmount: number;
  averageProcessingTime: number;
  
  byType: Record<string, {
    count: number;
    volume: number;
    averageAmount: number;
  }>;
  
  byStatus: Record<string, {
    count: number;
    percentage: number;
  }>;
  
  trends: {
    daily: Array<{ date: string; volume: number; count: number }>;
    monthly: Array<{ month: string; volume: number; count: number }>;
  };
  
  alerts: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}

export class TransactionService {
  private redis: RedisService;
  private notifications: NotificationService;
  private email: EmailService;

  constructor(
    private db: DatabaseService,
    redis: RedisService,
    notifications: NotificationService,
    email: EmailService
  ) {
    this.redis = redis;
    this.notifications = notifications;
    this.email = email;
    this.startTransactionMonitoring();
  }

  // ============================================================================
  // TRANSACTION PROCESSING
  // ============================================================================

  /**
   * Process a new transaction with comprehensive validation and notification
   */
  async processTransaction(input: TransactionInput): Promise<TransactionResult> {
    try {
      // Generate unique reference
      const reference = await this.generateTransactionReference(input.type);
      
      // Validate transaction
      await this.validateTransaction(input);
      
      // Calculate fees
      const processingFee = await this.calculateProcessingFee(input);
      const finalAmount = input.amount - processingFee;
      
      // Create transaction record
      const [transaction] = await this.db
        .insert('transactions')
        .values({
          userId: input.userId,
          type: input.type,
          amount: input.amount,
          currency: input.currency || 'USD',
          status: 'pending',
          description: input.description,
          reference,
          externalTransactionId: input.externalTransactionId,
          investmentId: input.investmentId,
          pitchId: input.pitchId,
          paymentMethodId: input.paymentMethodId,
          processingFee,
          finalAmount,
          sourceAccountId: input.sourceAccountId,
          destinationAccountId: input.destinationAccountId,
          exchangeRate: input.exchangeRate,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          scheduledAt: input.scheduledAt,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()
        .execute();

      // Create audit trail
      await this.createAuditEntry(transaction.id, 'created', 'Transaction initiated', {
        initiatedBy: input.userId,
        originalInput: input
      });

      // Update account balances
      await this.updateAccountBalances(input.userId, input.type, finalAmount, transaction.id);

      // Check for suspicious activity
      await this.checkSuspiciousActivity(input.userId, transaction);

      // Send initial notifications
      const notificationResults = await this.sendTransactionNotifications(transaction, 'initiated', input);

      // Queue for processing
      await this.queueTransactionProcessing(transaction);

      // Cache transaction for real-time updates
      await this.cacheTransaction(transaction);

      // Update metrics
      await this.updateTransactionMetrics(transaction);

      return {
        transactionId: transaction.id,
        status: 'pending',
        reference,
        amount: input.amount,
        finalAmount,
        processingFee,
        estimatedCompletion: input.type === 'investment' ? 
          new Date(Date.now() + 5 * 60 * 1000) : // 5 minutes for investments
          new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours for withdrawals
        notifications: notificationResults
      };
    } catch (error) {
      console.error('Error processing transaction:', error);
      throw error;
    }
  }

  /**
   * Update transaction status with notifications
   */
  async updateTransactionStatus(
    transactionId: number, 
    status: 'processing' | 'completed' | 'failed' | 'cancelled',
    details?: {
      externalTransactionId?: string;
      failureReason?: string;
      completedAt?: Date;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      // Get current transaction
      const [transaction] = await this.db
        .select()
        .from('transactions')
        .where(eq('id', transactionId))
        .execute();

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Update transaction
      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      if (details?.externalTransactionId) {
        updateData.externalTransactionId = details.externalTransactionId;
      }

      if (details?.failureReason) {
        updateData.failureReason = details.failureReason;
        updateData.failedAt = new Date();
      }

      if (status === 'completed') {
        updateData.completedAt = details?.completedAt || new Date();
        updateData.processedAt = updateData.completedAt;
      }

      if (details?.metadata) {
        updateData.metadata = JSON.stringify({
          ...transaction.metadata,
          ...details.metadata
        });
      }

      await this.db
        .update('transactions')
        .set(updateData)
        .where(eq('id', transactionId))
        .execute();

      // Create audit entry
      await this.createAuditEntry(transactionId, status, `Transaction ${status}`, {
        previousStatus: transaction.status,
        details
      });

      // Handle status-specific logic
      if (status === 'completed') {
        await this.handleCompletedTransaction(transactionId);
      } else if (status === 'failed') {
        await this.handleFailedTransaction(transactionId, details?.failureReason);
      }

      // Send status update notifications
      await this.sendTransactionNotifications(
        { ...transaction, status },
        `status_${status}`,
        { details }
      );

      // Update cached transaction
      await this.updateCachedTransaction(transactionId, { status, ...updateData });

      // Publish real-time update
      await this.redis.publish(`transaction_updates:${transaction.userId}`, JSON.stringify({
        transactionId,
        status,
        timestamp: new Date().toISOString()
      }));

    } catch (error) {
      console.error('Error updating transaction status:', error);
      throw error;
    }
  }

  // ============================================================================
  // ROI DISTRIBUTION
  // ============================================================================

  /**
   * Calculate and distribute ROI to investors
   */
  async distributeROI(data: {
    pitchId: number;
    totalProfit: number;
    period: string;
    type: 'profit_share' | 'dividend' | 'royalty' | 'milestone';
    notes?: string;
  }): Promise<ROIDistribution[]> {
    try {
      // Get all investments for this pitch
      const investments = await this.db
        .select()
        .from('investments')
        .where(and(
          eq('pitch_id', data.pitchId),
          eq('status', 'active')
        ))
        .execute();

      if (!investments.length) {
        throw new Error('No active investments found for this pitch');
      }

      // Calculate total invested amount
      const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
      const distributions: ROIDistribution[] = [];

      // Process each investment
      for (const investment of investments) {
        const investorShare = (investment.amount / totalInvested) * 100;
        const distributionAmount = (data.totalProfit * investorShare) / 100;

        // Create ROI distribution record
        const [distribution] = await this.db
          .insert('roi_distributions')
          .values({
            investmentId: investment.id,
            amount: distributionAmount,
            distributionDate: new Date(),
            period: data.period,
            type: data.type,
            status: 'pending',
            totalProfit: data.totalProfit,
            investorShare,
            distributionRate: investorShare,
            notes: data.notes,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning()
          .execute();

        // Process the actual payment transaction
        const transactionResult = await this.processTransaction({
          userId: investment.userId,
          investmentId: investment.id,
          pitchId: data.pitchId,
          type: 'roi_distribution',
          amount: distributionAmount,
          currency: 'USD',
          description: `ROI Distribution - ${data.period}`,
          metadata: {
            distributionId: distribution.id,
            period: data.period,
            type: data.type,
            investorShare,
            totalProfit: data.totalProfit
          }
        });

        // Update distribution with transaction ID
        await this.db
          .update('roi_distributions')
          .set({
            transactionId: transactionResult.transactionId,
            updatedAt: new Date()
          })
          .where(eq('id', distribution.id))
          .execute();

        distributions.push(distribution);

        // Send ROI distribution notification
        await this.notifications.sendNotification({
          userId: investment.userId,
          type: 'investment',
          title: `ROI Distribution Received - ${data.period}`,
          message: `You've received $${distributionAmount.toLocaleString()} from your investment`,
          priority: 'high',
          relatedInvestmentId: investment.id,
          relatedPitchId: data.pitchId,
          actionUrl: `/investor/portfolio/${investment.id}`,
          emailOptions: {
            templateType: 'roiDistribution',
            variables: {
              amount: distributionAmount,
              period: data.period,
              type: data.type,
              investmentAmount: investment.amount,
              totalProfit: data.totalProfit
            }
          }
        });
      }

      return distributions;
    } catch (error) {
      console.error('Error distributing ROI:', error);
      throw error;
    }
  }

  // ============================================================================
  // FRAUD DETECTION AND MONITORING
  // ============================================================================

  /**
   * Check for suspicious transaction activity
   */
  private async checkSuspiciousActivity(userId: number, transaction: any): Promise<void> {
    try {
      const alerts: Partial<TransactionAlert>[] = [];
      const timeWindow = 24 * 60 * 60 * 1000; // 24 hours
      const now = new Date();
      const yesterday = new Date(now.getTime() - timeWindow);

      // Get recent transactions
      const recentTransactions = await this.db
        .select()
        .from('transactions')
        .where(and(
          eq('user_id', userId),
          gte('created_at', yesterday)
        ))
        .execute();

      // Check for large transaction amounts
      if (transaction.amount > 100000) {
        alerts.push({
          userId,
          type: 'large_transaction',
          severity: transaction.amount > 500000 ? 'critical' : 'high',
          message: `Large transaction detected: $${transaction.amount.toLocaleString()}`,
          triggeredBy: transaction.id.toString(),
          threshold: 100000
        });
      }

      // Check for rapid successive transactions
      const rapidTransactions = recentTransactions.filter(t => 
        t.id !== transaction.id && 
        Math.abs(new Date(t.createdAt).getTime() - transaction.createdAt.getTime()) < 5 * 60 * 1000 // 5 minutes
      );

      if (rapidTransactions.length >= 3) {
        alerts.push({
          userId,
          type: 'unusual_pattern',
          severity: 'medium',
          message: `Multiple rapid transactions detected within 5 minutes`,
          triggeredBy: transaction.id.toString(),
          pattern: 'rapid_succession',
          timeWindow: '5_minutes'
        });
      }

      // Check for unusual transaction amounts
      const avgAmount = recentTransactions.reduce((sum, t) => sum + t.amount, 0) / recentTransactions.length;
      if (transaction.amount > avgAmount * 5) {
        alerts.push({
          userId,
          type: 'unusual_pattern',
          severity: 'medium',
          message: `Transaction amount significantly higher than usual pattern`,
          triggeredBy: transaction.id.toString(),
          pattern: 'amount_anomaly'
        });
      }

      // Create alert records
      for (const alert of alerts) {
        await this.db
          .insert('transaction_alerts')
          .values({
            ...alert,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .execute();

        // Send alert notification to admin/security team
        if (alert.severity === 'critical' || alert.severity === 'high') {
          await this.notifications.sendNotification({
            userId: 1, // Admin user ID - would be configurable
            type: 'system',
            title: `Security Alert: ${alert.type}`,
            message: alert.message || '',
            priority: 'urgent',
            metadata: {
              alertType: alert.type,
              severity: alert.severity,
              affectedUserId: userId,
              transactionId: transaction.id
            }
          });
        }
      }

    } catch (error) {
      console.error('Error checking suspicious activity:', error);
      // Don't throw - this shouldn't block the transaction
    }
  }

  /**
   * Monitor recurring payment failures
   */
  async monitorRecurringPayments(): Promise<void> {
    try {
      // Get all recurring investments with recent failures
      const failedRecurring = await this.db
        .select()
        .from('transactions')
        .where(and(
          eq('status', 'failed'),
          like('description', '%recurring%'),
          gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
        ))
        .execute();

      // Group by user and count failures
      const failuresByUser = failedRecurring.reduce((acc, transaction) => {
        acc[transaction.userId] = (acc[transaction.userId] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      // Send alerts for users with multiple failures
      for (const [userId, failureCount] of Object.entries(failuresByUser)) {
        if (failureCount >= 3) {
          await this.notifications.sendNotification({
            userId: parseInt(userId),
            type: 'investment',
            title: 'Recurring Payment Issues Detected',
            message: `We've detected ${failureCount} failed recurring payments. Please update your payment method.`,
            priority: 'high',
            actionUrl: '/investor/wallet/payment-methods',
            emailOptions: {
              templateType: 'paymentFailure',
              variables: {
                failureCount,
                supportUrl: '/support'
              }
            }
          });
        }
      }

    } catch (error) {
      console.error('Error monitoring recurring payments:', error);
    }
  }

  // ============================================================================
  // TRANSACTION QUERIES AND ANALYTICS
  // ============================================================================

  /**
   * Get detailed transaction history
   */
  async getTransactionHistory(userId: number, options: {
    type?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ transactions: TransactionDetails[]; total: number }> {
    try {
      let whereConditions = [eq('user_id', userId)];

      if (options.type) {
        whereConditions.push(eq('type', options.type));
      }

      if (options.status) {
        whereConditions.push(eq('status', options.status));
      }

      if (options.startDate) {
        whereConditions.push(gte('created_at', options.startDate));
      }

      if (options.endDate) {
        whereConditions.push(lte('created_at', options.endDate));
      }

      const whereClause = and(...whereConditions);

      const transactions = await this.db
        .select()
        .from('transactions')
        .where(whereClause)
        .orderBy(desc('created_at'))
        .limit(options.limit || 50)
        .offset(options.offset || 0)
        .execute();

      const [{ count }] = await this.db
        .select({ count: sql`count(*)` })
        .from('transactions')
        .where(whereClause)
        .execute();

      return {
        transactions: transactions as TransactionDetails[],
        total: Number(count)
      };
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw error;
    }
  }

  /**
   * Get transaction metrics and analytics
   */
  async getTransactionMetrics(userId?: number, period?: string): Promise<TransactionMetrics> {
    try {
      let whereConditions: any[] = [];
      
      if (userId) {
        whereConditions.push(eq('user_id', userId));
      }

      if (period) {
        const now = new Date();
        let startDate: Date;

        switch (period) {
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'quarter':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          case 'year':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        whereConditions.push(gte('created_at', startDate));
      }

      const whereClause = whereConditions.length ? and(...whereConditions) : undefined;

      // Get basic metrics
      const [basicStats] = await this.db
        .select({
          totalTransactions: sql`COUNT(*)`,
          totalVolume: sql`SUM(amount)`,
          averageAmount: sql`AVG(amount)`,
          successRate: sql`(COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*))`,
          avgProcessingTime: sql`AVG(EXTRACT(EPOCH FROM (completed_at - created_at)))`
        })
        .from('transactions')
        .where(whereClause)
        .execute();

      // Get metrics by type
      const typeMetrics = await this.db
        .select({
          type: 'type',
          count: sql`COUNT(*)`,
          volume: sql`SUM(amount)`,
          averageAmount: sql`AVG(amount)`
        })
        .from('transactions')
        .where(whereClause)
        .groupBy('type')
        .execute();

      // Get metrics by status
      const statusMetrics = await this.db
        .select({
          status: 'status',
          count: sql`COUNT(*)`,
          percentage: sql`(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM transactions ${whereClause ? 'WHERE ' + whereClause : ''}))`
        })
        .from('transactions')
        .where(whereClause)
        .groupBy('status')
        .execute();

      return {
        totalVolume: Number(basicStats.totalVolume) || 0,
        totalTransactions: Number(basicStats.totalTransactions) || 0,
        successRate: Number(basicStats.successRate) || 0,
        averageAmount: Number(basicStats.averageAmount) || 0,
        averageProcessingTime: Number(basicStats.avgProcessingTime) || 0,
        byType: typeMetrics.reduce((acc, metric) => {
          acc[metric.type] = {
            count: Number(metric.count),
            volume: Number(metric.volume),
            averageAmount: Number(metric.averageAmount)
          };
          return acc;
        }, {} as Record<string, any>),
        byStatus: statusMetrics.reduce((acc, metric) => {
          acc[metric.status] = {
            count: Number(metric.count),
            percentage: Number(metric.percentage)
          };
          return acc;
        }, {} as Record<string, any>),
        trends: {
          daily: [], // Would implement with time-series queries
          monthly: []
        },
        alerts: {
          total: 0,
          byType: {},
          bySeverity: {}
        }
      };
    } catch (error) {
      console.error('Error fetching transaction metrics:', error);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async generateTransactionReference(type: string): Promise<string> {
    const prefix = type.toUpperCase().substring(0, 3);
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`.toUpperCase();
  }

  private async validateTransaction(input: TransactionInput): Promise<void> {
    // Check user account status
    const [user] = await this.db
      .select()
      .from('users')
      .where(eq('id', input.userId))
      .execute();

    if (!user) {
      throw new Error('User not found');
    }

    // Add validation rules based on transaction type
    if (input.type === 'withdrawal' && input.amount > 50000) {
      throw new Error('Withdrawal amount exceeds daily limit');
    }

    // Validate sufficient balance for certain transaction types
    if (input.type === 'investment' || input.type === 'withdrawal') {
      const balance = await this.getUserBalance(input.userId);
      if (balance < input.amount) {
        throw new Error('Insufficient balance');
      }
    }
  }

  private async calculateProcessingFee(input: TransactionInput): Promise<number> {
    // Basic fee calculation - would be more sophisticated in production
    const baseFee = {
      'investment': 0.005, // 0.5%
      'withdrawal': 0.01,  // 1%
      'deposit': 0,        // No fee
      'roi_distribution': 0, // No fee
      'transfer': 0.002    // 0.2%
    }[input.type] || 0;

    return input.amount * baseFee;
  }

  private async updateAccountBalances(userId: number, type: string, amount: number, transactionId: number): Promise<void> {
    try {
      let balanceChange = 0;

      switch (type) {
        case 'deposit':
        case 'roi_distribution':
          balanceChange = amount; // Positive
          break;
        case 'investment':
        case 'withdrawal':
        case 'fee':
          balanceChange = -amount; // Negative
          break;
        case 'refund':
          balanceChange = amount; // Positive
          break;
      }

      // Update user account balance
      await this.db
        .update('user_accounts')
        .set({
          balance: sql`balance + ${balanceChange}`,
          updatedAt: new Date()
        })
        .where(eq('user_id', userId))
        .execute();

      // Create balance history record
      await this.db
        .insert('account_balance_history')
        .values({
          userId,
          transactionId,
          previousBalance: sql`(SELECT balance FROM user_accounts WHERE user_id = ${userId}) - ${balanceChange}`,
          newBalance: sql`(SELECT balance FROM user_accounts WHERE user_id = ${userId})`,
          change: balanceChange,
          type,
          createdAt: new Date()
        })
        .execute();

    } catch (error) {
      console.error('Error updating account balances:', error);
      throw error;
    }
  }

  private async createAuditEntry(transactionId: number, action: string, description: string, metadata?: any): Promise<void> {
    await this.db
      .insert('transaction_audit_trail')
      .values({
        transactionId,
        action,
        description,
        metadata: metadata ? JSON.stringify(metadata) : null,
        timestamp: new Date()
      })
      .execute();
  }

  private async sendTransactionNotifications(transaction: any, event: string, context?: any): Promise<any> {
    const notificationTypes = {
      initiated: 'Transaction Initiated',
      processing: 'Processing Payment',
      status_completed: 'Transaction Completed',
      status_failed: 'Transaction Failed'
    };

    const title = notificationTypes[event as keyof typeof notificationTypes] || 'Transaction Update';

    return await this.notifications.sendNotification({
      userId: transaction.userId,
      type: 'investment',
      title,
      message: `${title}: ${transaction.description || 'Transaction processed'}`,
      priority: event === 'status_failed' ? 'high' : 'normal',
      relatedInvestmentId: transaction.investmentId,
      actionUrl: `/investor/wallet/transaction/${transaction.id}`,
      emailOptions: {
        templateType: 'transactionAlert',
        variables: {
          transactionType: transaction.type,
          amount: transaction.amount,
          status: transaction.status,
          reference: transaction.reference
        }
      }
    });
  }

  private async getUserBalance(userId: number): Promise<number> {
    const [account] = await this.db
      .select({ balance: 'balance' })
      .from('user_accounts')
      .where(eq('user_id', userId))
      .execute();

    return account?.balance || 0;
  }

  private async queueTransactionProcessing(transaction: any): Promise<void> {
    // Queue for background processing
    await this.redis.rpush(
      `transaction_processing_queue:${transaction.type}`,
      JSON.stringify({
        transactionId: transaction.id,
        priority: transaction.type === 'withdrawal' ? 'high' : 'normal',
        queuedAt: new Date().toISOString()
      })
    );
  }

  private async cacheTransaction(transaction: any): Promise<void> {
    await this.redis.set(
      `transaction:${transaction.id}`,
      JSON.stringify(transaction),
      3600 // 1 hour TTL
    );
  }

  private async updateCachedTransaction(transactionId: number, updates: any): Promise<void> {
    const cached = await this.redis.get(`transaction:${transactionId}`);
    if (cached) {
      const transaction = { ...JSON.parse(cached), ...updates };
      await this.redis.set(`transaction:${transactionId}`, JSON.stringify(transaction), 3600);
    }
  }

  private async updateTransactionMetrics(transaction: any): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    await Promise.all([
      this.redis.hincrby('transaction_metrics:daily', `${today}:count`, 1),
      this.redis.hincrby('transaction_metrics:daily', `${today}:volume`, transaction.amount),
      this.redis.hincrby('transaction_metrics:by_type', transaction.type, 1),
      this.redis.hincrby('transaction_metrics:by_status', transaction.status, 1)
    ]);
  }

  private async handleCompletedTransaction(transactionId: number): Promise<void> {
    // Handle post-completion logic
    // Update investment status if applicable
    // Trigger any dependent processes
    // Send completion notifications
  }

  private async handleFailedTransaction(transactionId: number, reason?: string): Promise<void> {
    // Handle failure recovery
    // Reverse any balance changes if needed
    // Send failure notifications
    // Log for manual review if necessary
  }

  private startTransactionMonitoring(): void {
    // Start periodic monitoring tasks
    setInterval(() => {
      this.monitorRecurringPayments();
    }, 60 * 60 * 1000); // Every hour

    setInterval(() => {
      this.processTransactionQueue();
    }, 30 * 1000); // Every 30 seconds
  }

  private async processTransactionQueue(): Promise<void> {
    // Process queued transactions
    // Implementation would depend on specific payment providers
  }
}

// Export service factory
export function createTransactionService(
  db: DatabaseService,
  redis: RedisService,
  notifications: NotificationService,
  email: EmailService
): TransactionService {
  return new TransactionService(db, redis, notifications, email);
}

// Export types
export type {
  TransactionInput,
  TransactionResult,
  TransactionDetails,
  ROIDistribution,
  TransactionAlert,
  TransactionMetrics
};