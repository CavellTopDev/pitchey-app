/**
 * Workflow Automation Service
 * Handles automated business processes, notifications, and intelligent task management
 */

import { db } from "../db/client.ts";
import { 
  pitches, users, ndaRequests, messages, notifications, analyticsEvents,
  emailQueue, userPreferences, portfolio, workflowRules, workflowExecutions,
  smartNotifications
} from "../db/schema.ts";
import { eq, sql, desc, and, or, gte, inArray, count, sum } from "npm:drizzle-orm@0.35.3";

export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  enabled: boolean;
  priority: number;
  cooldownMinutes?: number;
  maxExecutionsPerDay?: number;
}

export interface WorkflowTrigger {
  type: 'pitch_created' | 'nda_requested' | 'message_received' | 'view_threshold' | 
        'investment_interest' | 'collaboration_request' | 'deadline_approaching' | 'user_inactive';
  eventData?: any;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'exists';
  value: any;
}

export interface WorkflowAction {
  type: 'send_notification' | 'send_email' | 'create_reminder' | 'auto_approve' | 
        'schedule_meeting' | 'update_status' | 'assign_task' | 'generate_report';
  config: any;
  delay?: number; // minutes
}

export interface AutomationResult {
  success: boolean;
  actionsExecuted: number;
  rulesTriggered: string[];
  errors: string[];
  executionTime: number;
}

export interface SmartNotification {
  id: string;
  userId: number;
  type: 'opportunity' | 'deadline' | 'recommendation' | 'alert' | 'milestone';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actionRequired: boolean;
  actionUrl?: string;
  data: any;
  scheduledFor?: Date;
}

export class WorkflowAutomationService {

  private static workflows: WorkflowRule[] = [
    // High-engagement pitch notification
    {
      id: 'high-engagement-alert',
      name: 'High Engagement Alert',
      description: 'Notify creator when pitch receives significant engagement',
      trigger: { type: 'view_threshold' },
      conditions: [
        { field: 'viewCount', operator: 'greater_than', value: 100 },
        { field: 'hoursOld', operator: 'less_than', value: 24 }
      ],
      actions: [
        {
          type: 'send_notification',
          config: {
            title: 'Your pitch is gaining traction!',
            message: 'Your pitch has received significant views in the last 24 hours',
            type: 'milestone'
          }
        },
        {
          type: 'send_email',
          config: {
            subject: 'Pitch Performance Alert',
            template: 'high_engagement'
          }
        }
      ],
      enabled: true,
      priority: 1,
      cooldownMinutes: 720, // 12 hours
      maxExecutionsPerDay: 2
    },
    
    // NDA auto-reminder
    {
      id: 'nda-reminder',
      name: 'NDA Response Reminder',
      description: 'Remind creators about pending NDA requests',
      trigger: { type: 'deadline_approaching' },
      conditions: [
        { field: 'ndaStatus', operator: 'equals', value: 'pending' },
        { field: 'hoursOld', operator: 'greater_than', value: 48 }
      ],
      actions: [
        {
          type: 'send_notification',
          config: {
            title: 'NDA Request Awaiting Response',
            message: 'You have pending NDA requests that need attention',
            type: 'deadline',
            actionRequired: true
          }
        }
      ],
      enabled: true,
      priority: 2,
      cooldownMinutes: 1440, // 24 hours
      maxExecutionsPerDay: 1
    },

    // Investor opportunity matching
    {
      id: 'investor-match',
      name: 'Investment Opportunity Matching',
      description: 'Notify investors about relevant new pitches',
      trigger: { type: 'pitch_created' },
      conditions: [
        { field: 'genre', operator: 'in', value: 'user_preferred_genres' },
        { field: 'budgetRange', operator: 'in', value: 'user_budget_range' }
      ],
      actions: [
        {
          type: 'send_notification',
          config: {
            title: 'New Investment Opportunity',
            message: 'A new pitch matching your criteria has been published',
            type: 'opportunity'
          },
          delay: 15 // Wait 15 minutes for initial traction
        }
      ],
      enabled: true,
      priority: 3,
      cooldownMinutes: 60,
      maxExecutionsPerDay: 10
    },

    // User re-engagement
    {
      id: 'user-reengagement',
      name: 'User Re-engagement',
      description: 'Re-engage inactive users with personalized recommendations',
      trigger: { type: 'user_inactive' },
      conditions: [
        { field: 'lastLoginDays', operator: 'greater_than', value: 7 },
        { field: 'lastLoginDays', operator: 'less_than', value: 30 }
      ],
      actions: [
        {
          type: 'send_email',
          config: {
            subject: 'New content waiting for you!',
            template: 'reengagement',
            includeRecommendations: true
          }
        }
      ],
      enabled: true,
      priority: 4,
      cooldownMinutes: 10080, // 7 days
      maxExecutionsPerDay: 1
    }
  ];

  /**
   * Process all active workflows for a given trigger
   */
  static async processTrigger(
    triggerType: WorkflowTrigger['type'],
    triggerData: any,
    userId?: number
  ): Promise<AutomationResult> {
    const startTime = Date.now();
    const result: AutomationResult = {
      success: true,
      actionsExecuted: 0,
      rulesTriggered: [],
      errors: [],
      executionTime: 0
    };

    try {
      const relevantWorkflows = this.workflows.filter(w => 
        w.enabled && w.trigger.type === triggerType
      ).sort((a, b) => a.priority - b.priority);

      for (const workflow of relevantWorkflows) {
        try {
          // Check if workflow should execute
          const shouldExecute = await this.evaluateWorkflowConditions(workflow, triggerData, userId);
          
          if (shouldExecute) {
            // Check cooldown and execution limits
            const canExecute = await this.checkExecutionLimits(workflow.id, userId);
            
            if (canExecute) {
              await this.executeWorkflowActions(workflow, triggerData, userId);
              result.rulesTriggered.push(workflow.id);
              result.actionsExecuted += workflow.actions.length;
              
              // Log workflow execution
              await this.logWorkflowExecution(workflow.id, userId, triggerData);
            }
          }
        } catch (error) {
          result.errors.push(`Workflow ${workflow.id}: ${error.message}`);
          result.success = false;
        }
      }

    } catch (error) {
      result.errors.push(`General error: ${error.message}`);
      result.success = false;
    }

    result.executionTime = Date.now() - startTime;
    return result;
  }

  /**
   * Generate smart notifications based on user activity and preferences
   */
  static async generateSmartNotifications(userId: number): Promise<SmartNotification[]> {
    const notifications: SmartNotification[] = [];

    // Get user context
    const userContext = await this.getUserContext(userId);

    // Investment opportunities
    if (userContext.userType === 'investor') {
      const opportunities = await this.findInvestmentOpportunities(userId);
      notifications.push(...opportunities);
    }

    // Collaboration suggestions
    if (userContext.userType === 'creator') {
      const collaborations = await this.findCollaborationSuggestions(userId);
      notifications.push(...collaborations);
    }

    // Deadline reminders
    const deadlines = await this.findUpcomingDeadlines(userId);
    notifications.push(...deadlines);

    // Performance milestones
    const milestones = await this.checkPerformanceMilestones(userId);
    notifications.push(...milestones);

    return notifications.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Auto-schedule follow-up actions based on user behavior
   */
  static async scheduleFollowUpActions(
    userId: number,
    actionType: 'pitch_view' | 'nda_request' | 'message_sent' | 'profile_visit',
    targetData: any
  ): Promise<void> {
    
    const followUpRules = {
      pitch_view: [
        { delay: 1440, action: 'remind_to_save' }, // 24 hours
        { delay: 4320, action: 'suggest_similar' } // 3 days
      ],
      nda_request: [
        { delay: 2880, action: 'remind_response' }, // 48 hours
        { delay: 10080, action: 'escalate_reminder' } // 7 days
      ],
      message_sent: [
        { delay: 1440, action: 'follow_up_reminder' } // 24 hours
      ],
      profile_visit: [
        { delay: 720, action: 'suggest_connect' } // 12 hours
      ]
    };

    const rules = followUpRules[actionType] || [];
    
    for (const rule of rules) {
      const scheduledTime = new Date();
      scheduledTime.setMinutes(scheduledTime.getMinutes() + rule.delay);
      
      // In a real system, this would be queued in a job scheduler
      await this.scheduleAction({
        userId,
        actionType: rule.action,
        targetData,
        scheduledFor: scheduledTime
      });
    }
  }

  /**
   * Process automated business rules (approval workflows, status updates, etc.)
   */
  static async processBusinessRules(
    entityType: 'pitch' | 'nda' | 'user' | 'investment',
    entityId: number,
    action: string
  ): Promise<{ approved: boolean; nextSteps: string[]; notifications: any[] }> {
    
    const businessRules = {
      pitch: {
        auto_approve: async (pitchId: number) => {
          // Auto-approve pitches from verified creators with good track record
          const pitch = await this.getPitchWithCreator(pitchId);
          
          if (pitch.creator.verified && pitch.creator.successRate > 0.8) {
            await this.updatePitchStatus(pitchId, 'approved');
            return { approved: true, reason: 'Auto-approved for verified creator' };
          }
          return { approved: false, reason: 'Manual review required' };
        }
      },
      nda: {
        auto_process: async (ndaId: number) => {
          // Auto-process NDAs for certain criteria
          const nda = await this.getNDADetails(ndaId);
          
          if (nda.requestor.trustScore > 0.9 && nda.standardTerms) {
            await this.updateNDAStatus(ndaId, 'auto_approved');
            return { approved: true, reason: 'Auto-approved for trusted user' };
          }
          return { approved: false, reason: 'Manual review required' };
        }
      }
    };

    const processor = businessRules[entityType]?.[action];
    
    if (processor) {
      try {
        const result = await processor(entityId);
        return {
          approved: result.approved,
          nextSteps: result.approved ? ['notify_approval'] : ['queue_manual_review'],
          notifications: [{
            type: result.approved ? 'approval' : 'review_required',
            message: result.reason
          }]
        };
      } catch (error) {
        return {
          approved: false,
          nextSteps: ['log_error', 'queue_manual_review'],
          notifications: [{ type: 'error', message: error.message }]
        };
      }
    }

    return {
      approved: false,
      nextSteps: ['unknown_rule'],
      notifications: [{ type: 'warning', message: 'Unknown business rule' }]
    };
  }

  // Private Helper Methods

  private static async evaluateWorkflowConditions(
    workflow: WorkflowRule,
    triggerData: any,
    userId?: number
  ): Promise<boolean> {
    
    for (const condition of workflow.conditions) {
      const fieldValue = await this.getFieldValue(condition.field, triggerData, userId);
      const conditionMet = this.evaluateCondition(fieldValue, condition.operator, condition.value);
      
      if (!conditionMet) {
        return false;
      }
    }
    
    return true;
  }

  private static async getFieldValue(field: string, triggerData: any, userId?: number): Promise<any> {
    // Handle special field types
    switch (field) {
      case 'user_preferred_genres':
        return userId ? await this.getUserPreferredGenres(userId) : [];
      case 'user_budget_range':
        return userId ? await this.getUserBudgetRange(userId) : null;
      case 'lastLoginDays':
        return userId ? await this.getDaysSinceLastLogin(userId) : 0;
      case 'hoursOld':
        return triggerData.createdAt ? 
          (Date.now() - new Date(triggerData.createdAt).getTime()) / (1000 * 60 * 60) : 0;
      default:
        return triggerData[field];
    }
  }

  private static evaluateCondition(fieldValue: any, operator: string, conditionValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === conditionValue;
      case 'not_equals':
        return fieldValue !== conditionValue;
      case 'greater_than':
        return Number(fieldValue) > Number(conditionValue);
      case 'less_than':
        return Number(fieldValue) < Number(conditionValue);
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
      case 'in':
        return Array.isArray(conditionValue) ? conditionValue.includes(fieldValue) : fieldValue === conditionValue;
      case 'exists':
        return fieldValue !== null && fieldValue !== undefined;
      default:
        return false;
    }
  }

  private static async executeWorkflowActions(
    workflow: WorkflowRule,
    triggerData: any,
    userId?: number
  ): Promise<void> {
    
    for (const action of workflow.actions) {
      if (action.delay) {
        // Schedule delayed action
        await this.scheduleDelayedAction(action, triggerData, userId, action.delay);
      } else {
        // Execute immediately
        await this.executeAction(action, triggerData, userId);
      }
    }
  }

  private static async executeAction(action: WorkflowAction, triggerData: any, userId?: number): Promise<void> {
    switch (action.type) {
      case 'send_notification':
        await this.sendNotification(userId!, action.config, triggerData);
        break;
      case 'send_email':
        await this.sendEmail(userId!, action.config, triggerData);
        break;
      case 'create_reminder':
        await this.createReminder(userId!, action.config, triggerData);
        break;
      case 'update_status':
        await this.updateEntityStatus(action.config, triggerData);
        break;
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  private static async sendNotification(userId: number, config: any, triggerData: any): Promise<void> {
    await db.insert(notifications).values({
      userId,
      type: config.type || 'info',
      title: config.title,
      message: config.message,
      data: JSON.stringify({ triggerData, actionRequired: config.actionRequired }),
      isRead: false
    });
  }

  private static async sendEmail(userId: number, config: any, triggerData: any): Promise<void> {
    // Get user email
    const user = await db.select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (user.length > 0) {
      await db.insert(emailQueue).values({
        toEmail: user[0].email,
        subject: config.subject,
        template: config.template,
        templateData: JSON.stringify({ triggerData, config }),
        priority: 'medium',
        scheduledFor: new Date()
      });
    }
  }

  private static async createReminder(userId: number, config: any, triggerData: any): Promise<void> {
    const reminderTime = new Date();
    reminderTime.setHours(reminderTime.getHours() + (config.hoursFromNow || 24));
    
    await db.insert(notifications).values({
      userId,
      type: 'reminder',
      title: config.title || 'Reminder',
      message: config.message,
      data: JSON.stringify(triggerData),
      isRead: false,
      scheduledFor: reminderTime
    });
  }

  private static async updateEntityStatus(config: any, triggerData: any): Promise<void> {
    // Update status based on entity type
    const { entityType, entityId, newStatus } = config;
    
    switch (entityType) {
      case 'pitch':
        await db.update(pitches)
          .set({ status: newStatus })
          .where(eq(pitches.id, entityId));
        break;
      case 'nda':
        await db.update(ndaRequests)
          .set({ status: newStatus })
          .where(eq(ndaRequests.id, entityId));
        break;
    }
  }

  // Utility methods for getting user context and preferences
  private static async getUserPreferredGenres(userId: number): Promise<string[]> {
    const prefs = await db.select({ preferredGenres: userPreferences.preferredGenres })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);
    
    return prefs[0]?.preferredGenres ? JSON.parse(prefs[0].preferredGenres) : [];
  }

  private static async getUserBudgetRange(userId: number): Promise<string[]> {
    const prefs = await db.select({ preferredBudgetRange: userPreferences.preferredBudgetRange })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);
    
    return prefs[0]?.preferredBudgetRange ? [prefs[0].preferredBudgetRange] : [];
  }

  private static async getDaysSinceLastLogin(userId: number): Promise<number> {
    const user = await db.select({ lastLoginAt: users.lastLoginAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (user[0]?.lastLoginAt) {
      return (Date.now() - new Date(user[0].lastLoginAt).getTime()) / (1000 * 60 * 60 * 24);
    }
    return 0;
  }

  private static async checkExecutionLimits(workflowId: string, userId?: number): Promise<boolean> {
    // Check cooldown and daily limits - simplified implementation
    return true; // In reality, check against audit_log table
  }

  private static async logWorkflowExecution(workflowId: string, userId?: number, triggerData?: any): Promise<void> {
    await db.insert(auditLog).values({
      userId: userId,
      action: `workflow_executed_${workflowId}`,
      details: JSON.stringify({ triggerData }),
      ipAddress: '0.0.0.0',
      userAgent: 'workflow-automation'
    });
  }

  private static async scheduleAction(actionData: any): Promise<void> {
    // In a real system, this would use a job queue like Redis Queue or Celery
    console.log('Scheduled action:', actionData);
  }

  private static async scheduleDelayedAction(action: WorkflowAction, triggerData: any, userId?: number, delayMinutes?: number): Promise<void> {
    // Schedule for future execution
    console.log(`Scheduling action ${action.type} for ${delayMinutes} minutes from now`);
  }

  // Placeholder methods for business logic
  private static async getUserContext(userId: number) {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user[0] || {};
  }

  private static async findInvestmentOpportunities(userId: number): Promise<SmartNotification[]> {
    return []; // Implement based on user preferences and activity
  }

  private static async findCollaborationSuggestions(userId: number): Promise<SmartNotification[]> {
    return []; // Implement based on network analysis
  }

  private static async findUpcomingDeadlines(userId: number): Promise<SmartNotification[]> {
    return []; // Check NDAs, project deadlines, etc.
  }

  private static async checkPerformanceMilestones(userId: number): Promise<SmartNotification[]> {
    return []; // Check view counts, follower milestones, etc.
  }

  private static async getPitchWithCreator(pitchId: number) {
    return { creator: { verified: false, successRate: 0 } }; // Placeholder
  }

  private static async updatePitchStatus(pitchId: number, status: string): Promise<void> {
    // Implementation here
  }

  private static async getNDADetails(ndaId: number) {
    return { requestor: { trustScore: 0 }, standardTerms: false }; // Placeholder
  }

  private static async updateNDAStatus(ndaId: number, status: string): Promise<void> {
    // Implementation here
  }
}