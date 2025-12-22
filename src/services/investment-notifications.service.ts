/**
 * Comprehensive Investment Notifications Service
 * Handles all investment-related notifications, alerts, and communications
 */

import type { DatabaseService } from '../types/worker-types.ts';
import type { NotificationService } from './notification.service.ts';
import type { EmailService } from './email.service.ts';
import { eq, and, or, desc, asc, like, isNull, isNotNull, sql, inArray, gte, lte } from 'drizzle-orm';

// Redis integration for real-time notifications
interface RedisService {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
  rpush: (key: string, value: string) => Promise<void>;
  sadd: (set: string, member: string) => Promise<void>;
  smembers: (set: string) => Promise<string[]>;
  hget: (hash: string, field: string) => Promise<string | null>;
  hset: (hash: string, field: string, value: string) => Promise<void>;
  publish: (channel: string, message: string) => Promise<void>;
}

// Investment notification types and interfaces
export interface InvestmentNotificationInput {
  type: 'interest_expressed' | 'investment_confirmed' | 'milestone_achieved' | 'roi_distributed' | 
        'opportunity_match' | 'portfolio_update' | 'investment_reminder' | 'market_alert' | 'risk_warning';
  
  // Core notification data
  investorId: number;
  creatorId?: number;
  pitchId?: number;
  investmentId?: number;
  
  // Notification content
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  
  // Investment-specific data
  amount?: number;
  currency?: string;
  
  // Context and metadata
  metadata?: Record<string, any>;
  actionUrl?: string;
  actionLabel?: string;
  
  // Scheduling and delivery
  sendAt?: Date;
  expiresAt?: Date;
  
  // Channel preferences
  channels?: {
    email?: boolean;
    push?: boolean;
    sms?: boolean;
    inApp?: boolean;
  };
  
  // Email template options
  emailTemplate?: string;
  emailVariables?: Record<string, any>;
  
  // Attachments (for contracts, reports, etc.)
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    type?: string;
  }>;
}

export interface InvestmentAlert {
  id: number;
  investorId: number;
  pitchId?: number;
  type: 'price_change' | 'deadline_approaching' | 'status_change' | 'roi_milestone' | 'risk_increase' | 'opportunity_match';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  
  // Alert configuration
  threshold?: number;
  condition?: string;
  monitoringPeriod?: string;
  
  // Status and handling
  status: 'active' | 'triggered' | 'resolved' | 'cancelled';
  triggeredAt?: Date;
  resolvedAt?: Date;
  
  // Notification settings
  notificationSent: boolean;
  notificationId?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioReport {
  investorId: number;
  reportType: 'monthly' | 'quarterly' | 'annual' | 'custom';
  period: string;
  
  // Performance metrics
  totalInvestments: number;
  totalValue: number;
  totalReturns: number;
  roiPercentage: number;
  
  // Diversification data
  byGenre: Record<string, number>;
  byRisk: Record<string, number>;
  byStage: Record<string, number>;
  
  // Top performers
  bestPerforming: Array<{
    pitchId: number;
    title: string;
    roi: number;
    returns: number;
  }>;
  
  // Recommendations
  recommendations: Array<{
    type: 'diversify' | 'increase_exposure' | 'reduce_risk' | 'new_opportunity';
    message: string;
    priority: number;
  }>;
  
  generatedAt: Date;
}

export interface InvestmentReminder {
  id: number;
  investorId: number;
  type: 'review_opportunity' | 'update_profile' | 'check_portfolio' | 'tax_deadline' | 'document_required';
  title: string;
  description: string;
  dueDate: Date;
  
  // Related entities
  pitchId?: number;
  investmentId?: number;
  documentType?: string;
  
  // Status
  status: 'pending' | 'sent' | 'completed' | 'dismissed';
  sentAt?: Date;
  completedAt?: Date;
  
  // Recurrence
  isRecurring: boolean;
  recurrencePattern?: string;
  nextOccurrence?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export class InvestmentNotificationsService {
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
    this.startScheduledTasks();
  }

  // ============================================================================
  // INVESTMENT INTEREST AND CONFIRMATION NOTIFICATIONS
  // ============================================================================

  /**
   * Send notification when investor expresses interest in a pitch
   */
  async notifyInvestmentInterest(data: {
    investorId: number;
    creatorId: number;
    pitchId: number;
    amount: number;
    message?: string;
  }): Promise<void> {
    try {
      // Get pitch and investor details
      const [pitch] = await this.db
        .select()
        .from('pitches')
        .where(eq('id', data.pitchId))
        .execute();

      const [investor] = await this.db
        .select()
        .from('users')
        .where(eq('id', data.investorId))
        .execute();

      if (!pitch || !investor) {
        throw new Error('Pitch or investor not found');
      }

      // Notify creator about interest
      await this.notifications.sendNotification({
        userId: data.creatorId,
        type: 'investment',
        title: `New Investment Interest - ${pitch.title}`,
        message: `${investor.firstName} ${investor.lastName} is interested in investing $${data.amount.toLocaleString()} in your pitch`,
        priority: 'high',
        relatedPitchId: data.pitchId,
        relatedUserId: data.investorId,
        actionUrl: `/creator/pitch/${data.pitchId}/investors`,
        emailOptions: {
          templateType: 'investmentInterest',
          variables: {
            pitchTitle: pitch.title,
            investorName: `${investor.firstName} ${investor.lastName}`,
            investorCompany: investor.company || 'Individual Investor',
            amount: data.amount,
            message: data.message,
            pitchUrl: `/creator/pitch/${data.pitchId}/investors`
          }
        }
      });

      // Send confirmation to investor
      await this.notifications.sendNotification({
        userId: data.investorId,
        type: 'investment',
        title: `Interest Confirmed - ${pitch.title}`,
        message: `Your interest in "${pitch.title}" has been sent to the creator`,
        priority: 'normal',
        relatedPitchId: data.pitchId,
        actionUrl: `/investor/opportunities/${data.pitchId}`,
        emailOptions: {
          templateType: 'interestConfirmation',
          variables: {
            pitchTitle: pitch.title,
            amount: data.amount,
            creatorName: pitch.creatorName,
            nextSteps: 'The creator will review your interest and may contact you directly'
          }
        }
      });

    } catch (error) {
      console.error('Error sending investment interest notification:', error);
      throw error;
    }
  }

  /**
   * Send investment confirmation with contract details
   */
  async notifyInvestmentConfirmation(data: {
    investmentId: number;
    investorId: number;
    creatorId: number;
    pitchId: number;
    amount: number;
    contractUrl?: string;
    transactionId?: string;
  }): Promise<void> {
    try {
      // Get investment details
      const [investment] = await this.db
        .select()
        .from('investments')
        .leftJoin('pitches', eq('pitches.id', 'investments.pitch_id'))
        .leftJoin('users as investor', eq('investor.id', 'investments.user_id'))
        .leftJoin('users as creator', eq('creator.id', 'pitches.user_id'))
        .where(eq('investments.id', data.investmentId))
        .execute();

      if (!investment) {
        throw new Error('Investment not found');
      }

      // Prepare contract attachment if available
      let attachments: any[] = [];
      if (data.contractUrl) {
        // In production, fetch contract content
        attachments.push({
          filename: `Investment_Contract_${data.transactionId}.pdf`,
          content: 'Contract content would be fetched here',
          type: 'application/pdf'
        });
      }

      // Notify investor with confirmation and contract
      await this.notifications.sendNotification({
        userId: data.investorId,
        type: 'investment',
        title: `Investment Confirmed - ${investment.pitches.title}`,
        message: `Your investment of $${data.amount.toLocaleString()} has been confirmed and processed`,
        priority: 'high',
        relatedInvestmentId: data.investmentId,
        relatedPitchId: data.pitchId,
        actionUrl: `/investor/portfolio/${data.investmentId}`,
        emailOptions: {
          templateType: 'investmentConfirmation',
          variables: {
            amount: data.amount,
            pitchTitle: investment.pitches.title,
            creatorName: `${investment.creator.firstName} ${investment.creator.lastName}`,
            transactionId: data.transactionId,
            investmentDate: new Date().toLocaleDateString(),
            contractUrl: data.contractUrl,
            portfolioUrl: `/investor/portfolio/${data.investmentId}`
          },
          attachments
        }
      });

      // Notify creator about confirmed investment
      await this.notifications.sendNotification({
        userId: data.creatorId,
        type: 'investment',
        title: `Investment Received - $${data.amount.toLocaleString()}`,
        message: `${investment.investor.firstName} ${investment.investor.lastName} has invested $${data.amount.toLocaleString()} in your pitch`,
        priority: 'high',
        relatedInvestmentId: data.investmentId,
        relatedPitchId: data.pitchId,
        actionUrl: `/creator/pitch/${data.pitchId}/investments`,
        emailOptions: {
          templateType: 'investmentReceived',
          variables: {
            amount: data.amount,
            pitchTitle: investment.pitches.title,
            investorName: `${investment.investor.firstName} ${investment.investor.lastName}`,
            investorCompany: investment.investor.company || 'Individual Investor',
            transactionId: data.transactionId
          }
        }
      });

    } catch (error) {
      console.error('Error sending investment confirmation notification:', error);
      throw error;
    }
  }

  // ============================================================================
  // MILESTONE AND ROI NOTIFICATIONS
  // ============================================================================

  /**
   * Send milestone achievement notifications
   */
  async notifyMilestoneAchieved(data: {
    pitchId: number;
    milestone: string;
    description: string;
    impactOnROI?: number;
    attachments?: any[];
  }): Promise<void> {
    try {
      // Get all investors for this pitch
      const investors = await this.db
        .select({
          userId: 'investments.user_id',
          amount: 'investments.amount',
          firstName: 'users.first_name',
          lastName: 'users.last_name',
          email: 'users.email'
        })
        .from('investments')
        .leftJoin('users', eq('users.id', 'investments.user_id'))
        .where(and(
          eq('investments.pitch_id', data.pitchId),
          eq('investments.status', 'active')
        ))
        .execute();

      const [pitch] = await this.db
        .select()
        .from('pitches')
        .where(eq('id', data.pitchId))
        .execute();

      if (!pitch) {
        throw new Error('Pitch not found');
      }

      // Send notification to each investor
      const notifications = investors.map(investor => ({
        userId: investor.userId,
        type: 'investment' as const,
        title: `Milestone Achieved - ${pitch.title}`,
        message: `Great news! ${data.milestone} has been achieved. ${data.description}`,
        priority: 'normal' as const,
        relatedPitchId: data.pitchId,
        actionUrl: `/investor/portfolio/pitch/${data.pitchId}`,
        emailOptions: {
          templateType: 'milestoneAchieved',
          variables: {
            milestone: data.milestone,
            description: data.description,
            pitchTitle: pitch.title,
            investmentAmount: investor.amount,
            impactOnROI: data.impactOnROI,
            detailsUrl: `/investor/portfolio/pitch/${data.pitchId}`
          },
          attachments: data.attachments
        }
      }));

      await this.notifications.sendBatchNotifications(notifications);

    } catch (error) {
      console.error('Error sending milestone notification:', error);
      throw error;
    }
  }

  /**
   * Send ROI distribution notifications
   */
  async notifyROIDistribution(data: {
    pitchId: number;
    totalDistribution: number;
    period: string;
    type: 'profit_share' | 'dividend' | 'royalty' | 'milestone';
    distributions: Array<{
      investorId: number;
      amount: number;
      percentage: number;
      transactionId: string;
    }>;
  }): Promise<void> {
    try {
      const [pitch] = await this.db
        .select()
        .from('pitches')
        .where(eq('id', data.pitchId))
        .execute();

      if (!pitch) {
        throw new Error('Pitch not found');
      }

      // Send individual notifications to each investor
      for (const distribution of data.distributions) {
        await this.notifications.sendNotification({
          userId: distribution.investorId,
          type: 'investment',
          title: `ROI Distribution Received - ${data.period}`,
          message: `You've received $${distribution.amount.toLocaleString()} from your investment in "${pitch.title}"`,
          priority: 'high',
          relatedPitchId: data.pitchId,
          actionUrl: `/investor/wallet/transaction/${distribution.transactionId}`,
          emailOptions: {
            templateType: 'roiDistribution',
            variables: {
              amount: distribution.amount,
              percentage: distribution.percentage,
              period: data.period,
              distributionType: data.type,
              pitchTitle: pitch.title,
              totalDistribution: data.totalDistribution,
              transactionId: distribution.transactionId,
              walletUrl: `/investor/wallet`
            }
          }
        });
      }

    } catch (error) {
      console.error('Error sending ROI distribution notification:', error);
      throw error;
    }
  }

  // ============================================================================
  // OPPORTUNITY MATCHING AND RECOMMENDATIONS
  // ============================================================================

  /**
   * Send matched investment opportunity notifications
   */
  async notifyOpportunityMatch(data: {
    investorId: number;
    pitchId: number;
    matchScore: number;
    reasons: string[];
    urgency?: 'low' | 'medium' | 'high';
  }): Promise<void> {
    try {
      const [pitch] = await this.db
        .select()
        .from('pitches')
        .leftJoin('users', eq('users.id', 'pitches.user_id'))
        .where(eq('pitches.id', data.pitchId))
        .execute();

      if (!pitch) {
        throw new Error('Pitch not found');
      }

      const priority = data.urgency === 'high' ? 'high' : 'normal';

      await this.notifications.sendNotification({
        userId: data.investorId,
        type: 'investment',
        title: `New Investment Opportunity - ${data.matchScore}% Match`,
        message: `"${pitch.title}" matches your investment preferences. ${data.reasons.slice(0, 2).join(', ')}`,
        priority,
        relatedPitchId: data.pitchId,
        actionUrl: `/investor/opportunities/${data.pitchId}`,
        metadata: {
          matchScore: data.matchScore,
          reasons: data.reasons,
          urgency: data.urgency
        },
        emailOptions: {
          templateType: 'opportunityMatch',
          variables: {
            pitchTitle: pitch.title,
            creatorName: `${pitch.users.firstName} ${pitch.users.lastName}`,
            matchScore: data.matchScore,
            reasons: data.reasons,
            genre: pitch.genre,
            fundingGoal: pitch.fundingGoal,
            deadline: pitch.deadline,
            opportunityUrl: `/investor/opportunities/${data.pitchId}`
          }
        }
      });

    } catch (error) {
      console.error('Error sending opportunity match notification:', error);
      throw error;
    }
  }

  // ============================================================================
  // PORTFOLIO REPORTS AND ANALYTICS
  // ============================================================================

  /**
   * Generate and send portfolio performance reports
   */
  async sendPortfolioReport(investorId: number, reportType: 'monthly' | 'quarterly' | 'annual'): Promise<void> {
    try {
      // Generate portfolio report
      const report = await this.generatePortfolioReport(investorId, reportType);

      // Get investor details
      const [investor] = await this.db
        .select()
        .from('users')
        .where(eq('id', investorId))
        .execute();

      if (!investor) {
        throw new Error('Investor not found');
      }

      await this.notifications.sendNotification({
        userId: investorId,
        type: 'investment',
        title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Portfolio Report`,
        message: `Your ${reportType} portfolio performance report is ready for review`,
        priority: 'normal',
        actionUrl: `/investor/portfolio/reports/${reportType}`,
        emailOptions: {
          templateType: 'portfolioReport',
          variables: {
            reportType,
            period: report.period,
            totalInvestments: report.totalInvestments,
            totalValue: report.totalValue,
            totalReturns: report.totalReturns,
            roiPercentage: report.roiPercentage,
            bestPerforming: report.bestPerforming,
            recommendations: report.recommendations,
            reportUrl: `/investor/portfolio/reports/${reportType}`
          }
        }
      });

    } catch (error) {
      console.error('Error sending portfolio report:', error);
      throw error;
    }
  }

  // ============================================================================
  // INVESTMENT ALERTS AND MONITORING
  // ============================================================================

  /**
   * Set up investment alerts for specific conditions
   */
  async setupInvestmentAlert(data: {
    investorId: number;
    pitchId?: number;
    type: 'price_change' | 'deadline_approaching' | 'status_change' | 'roi_milestone' | 'risk_increase';
    condition: string;
    threshold?: number;
    monitoringPeriod?: string;
  }): Promise<number> {
    try {
      const [alert] = await this.db
        .insert('investment_alerts')
        .values({
          investorId: data.investorId,
          pitchId: data.pitchId,
          type: data.type,
          severity: 'info',
          message: `Alert set for ${data.type}`,
          condition: data.condition,
          threshold: data.threshold,
          monitoringPeriod: data.monitoringPeriod,
          status: 'active',
          notificationSent: false,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()
        .execute();

      // Cache alert for real-time monitoring
      await this.redis.sadd(`investment_alerts:${data.investorId}`, alert.id.toString());

      return alert.id;
    } catch (error) {
      console.error('Error setting up investment alert:', error);
      throw error;
    }
  }

  /**
   * Check and trigger investment alerts
   */
  async checkInvestmentAlerts(): Promise<void> {
    try {
      // Get all active alerts
      const alerts = await this.db
        .select()
        .from('investment_alerts')
        .where(eq('status', 'active'))
        .execute();

      for (const alert of alerts) {
        let shouldTrigger = false;
        let message = '';

        switch (alert.type) {
          case 'deadline_approaching':
            shouldTrigger = await this.checkDeadlineApproaching(alert);
            message = 'Investment deadline is approaching';
            break;
          case 'price_change':
            shouldTrigger = await this.checkPriceChange(alert);
            message = 'Investment price has changed significantly';
            break;
          case 'status_change':
            shouldTrigger = await this.checkStatusChange(alert);
            message = 'Investment status has been updated';
            break;
          case 'roi_milestone':
            shouldTrigger = await this.checkROIMilestone(alert);
            message = 'ROI milestone has been reached';
            break;
          case 'risk_increase':
            shouldTrigger = await this.checkRiskIncrease(alert);
            message = 'Risk level has increased for your investment';
            break;
        }

        if (shouldTrigger) {
          await this.triggerInvestmentAlert(alert, message);
        }
      }

    } catch (error) {
      console.error('Error checking investment alerts:', error);
    }
  }

  // ============================================================================
  // REMINDER SYSTEM
  // ============================================================================

  /**
   * Schedule investment reminders
   */
  async scheduleReminder(data: {
    investorId: number;
    type: 'review_opportunity' | 'update_profile' | 'check_portfolio' | 'tax_deadline' | 'document_required';
    title: string;
    description: string;
    dueDate: Date;
    pitchId?: number;
    investmentId?: number;
    isRecurring?: boolean;
    recurrencePattern?: string;
  }): Promise<number> {
    try {
      const [reminder] = await this.db
        .insert('investment_reminders')
        .values({
          investorId: data.investorId,
          type: data.type,
          title: data.title,
          description: data.description,
          dueDate: data.dueDate,
          pitchId: data.pitchId,
          investmentId: data.investmentId,
          status: 'pending',
          isRecurring: data.isRecurring || false,
          recurrencePattern: data.recurrencePattern,
          nextOccurrence: data.isRecurring ? data.dueDate : null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()
        .execute();

      // Schedule for processing
      const reminderData = {
        reminderId: reminder.id,
        dueDate: data.dueDate.toISOString()
      };

      await this.redis.rpush(
        'investment_reminders_queue',
        JSON.stringify(reminderData)
      );

      return reminder.id;
    } catch (error) {
      console.error('Error scheduling reminder:', error);
      throw error;
    }
  }

  /**
   * Process due reminders
   */
  async processDueReminders(): Promise<void> {
    try {
      const now = new Date();
      
      const dueReminders = await this.db
        .select()
        .from('investment_reminders')
        .where(and(
          eq('status', 'pending'),
          lte('due_date', now)
        ))
        .execute();

      for (const reminder of dueReminders) {
        await this.sendReminderNotification(reminder);
        
        // Mark as sent and schedule next if recurring
        if (reminder.isRecurring && reminder.recurrencePattern) {
          const nextDate = this.calculateNextOccurrence(reminder.dueDate, reminder.recurrencePattern);
          
          await this.db
            .update('investment_reminders')
            .set({
              status: 'sent',
              sentAt: new Date(),
              nextOccurrence: nextDate,
              updatedAt: new Date()
            })
            .where(eq('id', reminder.id))
            .execute();

          // Create next occurrence
          await this.scheduleReminder({
            ...reminder,
            dueDate: nextDate
          });
        } else {
          await this.db
            .update('investment_reminders')
            .set({
              status: 'sent',
              sentAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq('id', reminder.id))
            .execute();
        }
      }

    } catch (error) {
      console.error('Error processing due reminders:', error);
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async generatePortfolioReport(investorId: number, reportType: string): Promise<PortfolioReport> {
    // Implementation would calculate comprehensive portfolio metrics
    // This is a simplified version
    return {
      investorId,
      reportType: reportType as any,
      period: 'Q4 2024',
      totalInvestments: 5,
      totalValue: 250000,
      totalReturns: 50000,
      roiPercentage: 25,
      byGenre: { Drama: 40, Action: 35, Comedy: 25 },
      byRisk: { Low: 30, Medium: 50, High: 20 },
      byStage: { Development: 40, Production: 35, PostProduction: 25 },
      bestPerforming: [],
      recommendations: [],
      generatedAt: new Date()
    };
  }

  private async checkDeadlineApproaching(alert: InvestmentAlert): Promise<boolean> {
    if (!alert.pitchId) return false;
    
    const [pitch] = await this.db
      .select()
      .from('pitches')
      .where(eq('id', alert.pitchId))
      .execute();

    if (!pitch?.deadline) return false;

    const deadline = new Date(pitch.deadline);
    const now = new Date();
    const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return daysUntilDeadline <= (alert.threshold || 7); // Default 7 days
  }

  private async checkPriceChange(alert: InvestmentAlert): Promise<boolean> {
    // Implementation would check for significant price changes
    return false;
  }

  private async checkStatusChange(alert: InvestmentAlert): Promise<boolean> {
    // Implementation would check for status changes
    return false;
  }

  private async checkROIMilestone(alert: InvestmentAlert): Promise<boolean> {
    // Implementation would check ROI milestones
    return false;
  }

  private async checkRiskIncrease(alert: InvestmentAlert): Promise<boolean> {
    // Implementation would check risk level changes
    return false;
  }

  private async triggerInvestmentAlert(alert: InvestmentAlert, message: string): Promise<void> {
    await this.notifications.sendNotification({
      userId: alert.investorId,
      type: 'investment',
      title: `Investment Alert: ${alert.type.replace('_', ' ')}`,
      message,
      priority: alert.severity === 'critical' ? 'urgent' : 'high',
      relatedPitchId: alert.pitchId,
      actionUrl: alert.pitchId ? `/investor/opportunities/${alert.pitchId}` : '/investor/portfolio'
    });

    // Mark alert as triggered
    await this.db
      .update('investment_alerts')
      .set({
        status: 'triggered',
        triggeredAt: new Date(),
        notificationSent: true,
        updatedAt: new Date()
      })
      .where(eq('id', alert.id))
      .execute();
  }

  private async sendReminderNotification(reminder: InvestmentReminder): Promise<void> {
    await this.notifications.sendNotification({
      userId: reminder.investorId,
      type: 'investment',
      title: reminder.title,
      message: reminder.description,
      priority: 'normal',
      relatedPitchId: reminder.pitchId,
      relatedInvestmentId: reminder.investmentId,
      actionUrl: this.getReminderActionUrl(reminder)
    });
  }

  private getReminderActionUrl(reminder: InvestmentReminder): string {
    switch (reminder.type) {
      case 'review_opportunity':
        return reminder.pitchId ? `/investor/opportunities/${reminder.pitchId}` : '/investor/opportunities';
      case 'update_profile':
        return '/investor/profile';
      case 'check_portfolio':
        return '/investor/portfolio';
      case 'tax_deadline':
        return '/investor/tax-documents';
      case 'document_required':
        return reminder.investmentId ? `/investor/portfolio/${reminder.investmentId}/documents` : '/investor/documents';
      default:
        return '/investor/dashboard';
    }
  }

  private calculateNextOccurrence(currentDate: Date, pattern: string): Date {
    const next = new Date(currentDate);
    
    switch (pattern) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'annually':
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        next.setDate(next.getDate() + 7); // Default to weekly
    }
    
    return next;
  }

  private startScheduledTasks(): void {
    // Check alerts every 5 minutes
    setInterval(() => {
      this.checkInvestmentAlerts();
    }, 5 * 60 * 1000);

    // Process reminders every minute
    setInterval(() => {
      this.processDueReminders();
    }, 60 * 1000);

    // Generate and send portfolio reports weekly (Sundays at 9 AM)
    setInterval(() => {
      const now = new Date();
      if (now.getDay() === 0 && now.getHours() === 9 && now.getMinutes() < 5) {
        this.processScheduledReports();
      }
    }, 5 * 60 * 1000);
  }

  private async processScheduledReports(): Promise<void> {
    try {
      // Get all investors who have opted in for periodic reports
      const investors = await this.db
        .select({ userId: 'user_id' })
        .from('notification_preferences')
        .where(eq('digest_frequency', 'weekly'))
        .execute();

      for (const investor of investors) {
        await this.sendPortfolioReport(investor.userId, 'weekly' as any);
      }
    } catch (error) {
      console.error('Error processing scheduled reports:', error);
    }
  }
}

// Export service factory
export function createInvestmentNotificationsService(
  db: DatabaseService,
  redis: RedisService,
  notifications: NotificationService,
  email: EmailService
): InvestmentNotificationsService {
  return new InvestmentNotificationsService(db, redis, notifications, email);
}

// Export types
export type {
  InvestmentNotificationInput,
  InvestmentAlert,
  PortfolioReport,
  InvestmentReminder
};