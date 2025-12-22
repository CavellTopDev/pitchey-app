/**
 * Email Type Definitions for Pitchey Platform
 * Comprehensive types for email service, templates, and tracking
 */

// Core Email Types
export type EmailProvider = 'sendgrid' | 'awsSes';
export type EmailStatus = 'pending' | 'processing' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed' | 'bounced' | 'complained';
export type EmailPriority = 'high' | 'normal' | 'low';
export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Email Attachment
export interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded content
  type: string; // MIME type
  size?: number;
  disposition?: 'attachment' | 'inline';
  contentId?: string; // For inline attachments
}

// Core Email Data Structure
export interface EmailData {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  templateType?: keyof EmailTemplate;
  variables?: Record<string, any>;
  tags?: string[];
  metadata?: Record<string, any>;
  replyTo?: string;
  headers?: Record<string, string>;
}

// Email Result from sending
export interface EmailResult {
  success: boolean;
  messageId: string | null;
  provider: EmailProvider;
  error?: string;
  timestamp: string;
  trackingId?: string;
  deliveryInfo?: {
    estimatedDelivery?: string;
    retryCount?: number;
  };
}

// Email Queue Item
export interface EmailQueue {
  id: string;
  data: EmailData;
  priority: EmailPriority;
  sendAt: Date;
  attempts: number;
  maxAttempts?: number;
  createdAt: Date;
  updatedAt?: Date;
  status: QueueStatus;
  error?: string;
  nextRetry?: Date;
  userId?: string;
  campaignId?: string;
}

// Email Log for tracking
export interface EmailLog {
  id: string;
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  provider: EmailProvider;
  messageId: string | null;
  status: EmailStatus;
  error?: string;
  templateType?: keyof EmailTemplate;
  variables?: Record<string, any>;
  sentAt: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  bouncedAt?: Date;
  complainedAt?: Date;
  userId?: string;
  campaignId?: string;
  trackingEvents?: EmailTrackingEvent[];
  metadata?: Record<string, any>;
}

// Email Tracking Events
export interface EmailTrackingEvent {
  id: string;
  emailLogId: string;
  type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed';
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  clickUrl?: string; // For click events
  reason?: string; // For bounce/complaint events
  metadata?: Record<string, any>;
}

// Email Template Structure
export interface EmailTemplateContent {
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  variables?: string[]; // List of required variables
  previewText?: string;
  tags?: string[];
}

// All available email templates
export interface EmailTemplate {
  welcome: EmailTemplateContent;
  passwordReset: EmailTemplateContent;
  emailVerification: EmailTemplateContent;
  ndaRequest: EmailTemplateContent;
  ndaApproval: EmailTemplateContent;
  ndaRejection: EmailTemplateContent;
  investmentConfirmation: EmailTemplateContent;
  investmentUpdate: EmailTemplateContent;
  newMessage: EmailTemplateContent;
  messageReply: EmailTemplateContent;
  pitchViewed: EmailTemplateContent;
  pitchLiked: EmailTemplateContent;
  pitchShared: EmailTemplateContent;
  transactionAlert: EmailTemplateContent;
  paymentSuccess: EmailTemplateContent;
  paymentFailed: EmailTemplateContent;
  subscriptionUpdate: EmailTemplateContent;
  weeklyDigest: EmailTemplateContent;
  monthlyReport: EmailTemplateContent;
  securityAlert: EmailTemplateContent;
  accountSuspension: EmailTemplateContent;
  accountReactivation: EmailTemplateContent;
  pitchApproved: EmailTemplateContent;
  pitchRejected: EmailTemplateContent;
  collaborationInvite: EmailTemplateContent;
  collaborationAccepted: EmailTemplateContent;
  teamInvitation: EmailTemplateContent;
  productionUpdate: EmailTemplateContent;
  releaseAnnouncement: EmailTemplateContent;
  maintenanceNotification: EmailTemplateContent;
  feedbackRequest: EmailTemplateContent;
  surveyInvitation: EmailTemplateContent;
}

// Email Preferences for users
export interface EmailPreferences {
  id: string;
  userId: string;
  emailAddress: string;
  preferences: {
    // Communication preferences
    marketingEmails: boolean;
    transactionalEmails: boolean;
    notificationEmails: boolean;
    weeklyDigest: boolean;
    monthlyReport: boolean;
    
    // Pitch-related notifications
    pitchViews: boolean;
    pitchLikes: boolean;
    pitchComments: boolean;
    ndaRequests: boolean;
    ndaResponses: boolean;
    
    // Investment notifications
    investmentUpdates: boolean;
    paymentNotifications: boolean;
    portfolioUpdates: boolean;
    
    // Messaging notifications
    newMessages: boolean;
    messageReplies: boolean;
    collaborationInvites: boolean;
    
    // Security notifications
    securityAlerts: boolean;
    loginNotifications: boolean;
    
    // System notifications
    maintenanceAlerts: boolean;
    productUpdates: boolean;
    
    // Frequency preferences
    frequency: 'immediate' | 'daily' | 'weekly' | 'never';
    digestDay?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
    digestTime?: string; // HH:MM format
    timezone?: string;
  };
  unsubscribeToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Email Campaign for bulk emails
export interface EmailCampaign {
  id: string;
  name: string;
  description?: string;
  templateType: keyof EmailTemplate;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';
  scheduledAt?: Date;
  sentAt?: Date;
  completedAt?: Date;
  recipients: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
  };
  targeting: {
    userTypes?: ('creator' | 'investor' | 'production')[];
    tags?: string[];
    customQuery?: string;
    excludeUnsubscribed?: boolean;
  };
  variables?: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

// Email Template Database Structure
export interface EmailTemplateDB {
  id: string;
  name: string;
  type: keyof EmailTemplate;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[]; // JSON array of required variables
  isActive: boolean;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

// Email Analytics
export interface EmailAnalytics {
  campaignId?: string;
  templateType?: keyof EmailTemplate;
  dateRange: {
    start: Date;
    end: Date;
  };
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
    unsubscribed: number;
    
    // Rates
    deliveryRate: number; // delivered / sent
    openRate: number; // opened / delivered
    clickRate: number; // clicked / delivered
    clickToOpenRate: number; // clicked / opened
    bounceRate: number; // bounced / sent
    complaintRate: number; // complained / delivered
    unsubscribeRate: number; // unsubscribed / delivered
  };
  topClicks?: Array<{
    url: string;
    clicks: number;
  }>;
  deviceStats?: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  locationStats?: Array<{
    country: string;
    opens: number;
    clicks: number;
  }>;
}

// Email Service Configuration Types
export interface EmailServiceConfig {
  providers: {
    sendgrid?: {
      apiKey: string;
      fromEmail: string;
      fromName: string;
      replyTo?: string;
      templateIds?: Record<string, string>;
    };
    awsSes?: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
      fromEmail: string;
      fromName: string;
      replyTo?: string;
      configurationSet?: string;
    };
  };
  defaultProvider: EmailProvider;
  fallbackEnabled: boolean;
  rateLimiting: {
    enabled: boolean;
    limits: {
      perMinute: number;
      perHour: number;
      perDay: number;
    };
  };
  retryPolicy: {
    enabled: boolean;
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  queueConfig: {
    enabled: boolean;
    maxConcurrent: number;
    processingInterval: number;
    batchSize: number;
  };
  tracking: {
    enabled: boolean;
    openTracking: boolean;
    clickTracking: boolean;
    unsubscribeTracking: boolean;
    webhookUrl?: string;
  };
  security: {
    encryptionEnabled: boolean;
    signatureValidation: boolean;
    allowedDomains?: string[];
    blockedDomains?: string[];
  };
}

// Webhook Event Types
export interface EmailWebhookEvent {
  id: string;
  type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed';
  messageId: string;
  email: string;
  timestamp: Date;
  provider: EmailProvider;
  eventData: Record<string, any>;
  processed: boolean;
  processedAt?: Date;
  error?: string;
}

// Email Validation Types
export interface EmailValidation {
  email: string;
  isValid: boolean;
  reason?: string;
  suggestions?: string[];
  score?: number; // 0-100, higher is better
  checks: {
    syntax: boolean;
    domain: boolean;
    mailbox?: boolean;
    disposable?: boolean;
    roleAccount?: boolean;
    gibberish?: boolean;
  };
  metadata?: {
    provider?: string;
    isPersonal?: boolean;
    isCorporate?: boolean;
  };
}

// Unsubscribe Management
export interface UnsubscribeRequest {
  id: string;
  email: string;
  userId?: string;
  reason?: string;
  categories?: Array<keyof EmailTemplate>;
  requestedAt: Date;
  processedAt?: Date;
  source: 'link' | 'reply' | 'manual' | 'bounce' | 'complaint';
  metadata?: Record<string, any>;
}

// Email List Management
export interface EmailList {
  id: string;
  name: string;
  description?: string;
  type: 'static' | 'dynamic';
  criteria?: {
    userTypes?: ('creator' | 'investor' | 'production')[];
    tags?: string[];
    lastActiveDate?: Date;
    signupDateRange?: { start: Date; end: Date };
    customQuery?: string;
  };
  subscribers: {
    total: number;
    active: number;
    unsubscribed: number;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

// Email Suppression List
export interface EmailSuppression {
  email: string;
  type: 'bounce' | 'complaint' | 'unsubscribe' | 'manual';
  reason?: string;
  addedAt: Date;
  addedBy?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

// A/B Testing for emails
export interface EmailABTest {
  id: string;
  campaignId: string;
  name: string;
  status: 'draft' | 'running' | 'completed' | 'cancelled';
  variants: Array<{
    id: string;
    name: string;
    subject?: string;
    htmlContent?: string;
    textContent?: string;
    trafficPercentage: number;
    metrics: {
      sent: number;
      opened: number;
      clicked: number;
      converted: number;
    };
  }>;
  winningVariant?: string;
  testDuration: number; // hours
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

// Email Health Monitoring
export interface EmailHealthMetrics {
  provider: EmailProvider;
  timestamp: Date;
  metrics: {
    deliveryRate: number;
    bounceRate: number;
    complaintRate: number;
    responseTime: number; // milliseconds
    errorRate: number;
    queueSize: number;
  };
  status: 'healthy' | 'warning' | 'critical' | 'down';
  alerts?: string[];
}

// Email Notification Settings
export interface NotificationSettings {
  userId: string;
  channels: {
    email: boolean;
    sms: boolean;
    push: boolean;
    inApp: boolean;
  };
  types: Record<keyof EmailTemplate, {
    enabled: boolean;
    channels: ('email' | 'sms' | 'push' | 'inApp')[];
    frequency: 'immediate' | 'digest' | 'never';
  }>;
  digestSettings: {
    frequency: 'daily' | 'weekly' | 'monthly';
    day?: string; // For weekly/monthly
    time: string; // HH:MM
    timezone: string;
  };
  doNotDisturb: {
    enabled: boolean;
    startTime: string; // HH:MM
    endTime: string; // HH:MM
    days: string[]; // ['monday', 'tuesday', ...]
  };
  updatedAt: Date;
}

// Email Template Variables (for dynamic content)
export interface TemplateVariables {
  // User variables
  user?: {
    name?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    userType?: 'creator' | 'investor' | 'production';
    company?: string;
    timezone?: string;
  };
  
  // Pitch variables
  pitch?: {
    id?: string;
    title?: string;
    description?: string;
    genre?: string[];
    creator?: string;
    status?: string;
    url?: string;
    thumbnailUrl?: string;
  };
  
  // NDA variables
  nda?: {
    id?: string;
    status?: 'pending' | 'approved' | 'rejected';
    signedDate?: string;
    expirationDate?: string;
    documentUrl?: string;
  };
  
  // Investment variables
  investment?: {
    id?: string;
    amount?: string;
    type?: string;
    date?: string;
    status?: string;
    transactionId?: string;
    portfolioUrl?: string;
  };
  
  // Message variables
  message?: {
    id?: string;
    senderName?: string;
    subject?: string;
    preview?: string;
    url?: string;
    receivedDate?: string;
    projectTitle?: string;
  };
  
  // Transaction variables
  transaction?: {
    id?: string;
    type?: string;
    amount?: string;
    status?: string;
    date?: string;
    description?: string;
    url?: string;
  };
  
  // Platform variables
  platform?: {
    name?: string;
    url?: string;
    supportEmail?: string;
    dashboardUrl?: string;
    preferencesUrl?: string;
    unsubscribeUrl?: string;
  };
  
  // Custom variables
  custom?: Record<string, any>;
}

// Utility types for email operations
export type EmailOperationResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
};

export type BulkEmailOperation = {
  emails: EmailData[];
  options: {
    batchSize?: number;
    delayBetweenBatches?: number;
    priority?: EmailPriority;
    validateEmails?: boolean;
    skipDuplicates?: boolean;
  };
};

export type EmailSearchFilters = {
  status?: EmailStatus[];
  provider?: EmailProvider[];
  templateType?: (keyof EmailTemplate)[];
  dateRange?: {
    start: Date;
    end: Date;
    field?: 'sentAt' | 'deliveredAt' | 'openedAt' | 'clickedAt';
  };
  recipient?: string;
  subject?: string;
  campaignId?: string;
  userId?: string;
};

// Export utility functions type definitions
export type EmailValidator = (email: string) => Promise<EmailValidation>;
export type EmailRenderer = (template: string, variables: TemplateVariables) => string;
export type EmailTracker = (event: EmailTrackingEvent) => Promise<void>;
export type EmailLogger = (log: Partial<EmailLog>) => Promise<void>;

// Service interfaces
export interface IEmailService {
  sendEmail(data: EmailData): Promise<EmailResult>;
  sendBulkEmails(emails: EmailData[], options?: any): Promise<any>;
  sendTemplateEmail(templateType: keyof EmailTemplate, to: string, variables: TemplateVariables): Promise<EmailResult>;
  queueEmail(data: EmailData, priority?: EmailPriority, sendAt?: Date): Promise<string>;
  getEmailStatus(messageId: string): Promise<any>;
  validateConfiguration(): Promise<{ [provider: string]: boolean }>;
  getMetrics(): any;
}

export interface IEmailTemplate {
  render(templateType: keyof EmailTemplate, variables: TemplateVariables): Promise<{ subject: string; html: string; text?: string; }>;
  validate(templateType: keyof EmailTemplate, variables: TemplateVariables): Promise<{ valid: boolean; errors?: string[]; }>;
  preview(templateType: keyof EmailTemplate, variables: TemplateVariables): Promise<string>;
}

export interface IEmailAnalytics {
  trackEvent(event: EmailTrackingEvent): Promise<void>;
  getAnalytics(filters: EmailSearchFilters): Promise<EmailAnalytics>;
  getCampaignAnalytics(campaignId: string): Promise<EmailAnalytics>;
  getTemplateAnalytics(templateType: keyof EmailTemplate): Promise<EmailAnalytics>;
}