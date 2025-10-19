// Email service interfaces and types for Pitchey platform
// This provides a clean abstraction layer for swapping email providers

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  cid?: string; // Content-ID for inline images
}

export interface EmailData {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  trackingId?: string;
  unsubscribeUrl?: string;
  listUnsubscribe?: string;
  templateName?: string; // For debugging/logging
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerId?: string;
  timestamp?: string;
}

export interface EmailProvider {
  name: string;
  sendEmail(data: EmailData): Promise<EmailResult>;
  verifyConfiguration(): Promise<boolean>;
  getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    details?: string;
  }>;
}

export interface EmailConfig {
  EMAIL_PROVIDER: 'console' | 'sendgrid' | 'postmark' | 'ses';
  EMAIL_FROM: string;
  EMAIL_FROM_NAME: string;
  EMAIL_REPLY_TO?: string;
  
  // SendGrid
  SENDGRID_API_KEY?: string;
  
  // Postmark
  POSTMARK_API_KEY?: string;
  
  // AWS SES
  AWS_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
}

// Template data interfaces
export interface WelcomeEmailData {
  firstName: string;
  userType: "creator" | "investor" | "production" | "viewer";
  dashboardUrl: string;
  profileSetupUrl: string;
  unsubscribeUrl: string;
}

export interface NDARequestEmailData {
  recipientName: string;
  senderName: string;
  pitchTitle: string;
  requestMessage?: string;
  actionUrl: string;
  unsubscribeUrl: string;
}

export interface NDAResponseEmailData {
  recipientName: string;
  senderName: string;
  pitchTitle: string;
  approved: boolean;
  reason?: string;
  actionUrl: string;
  unsubscribeUrl: string;
}

export interface MessageEmailData {
  recipientName: string;
  senderName: string;
  messageContent: string;
  pitchTitle?: string;
  conversationUrl: string;
  unsubscribeUrl: string;
}

export interface PasswordResetEmailData {
  firstName: string;
  resetUrl: string;
  expiresIn: string;
  unsubscribeUrl: string;
}

export interface PaymentConfirmationEmailData {
  firstName: string;
  paymentType: "subscription" | "credits" | "success_fee";
  amount: string;
  currency: string;
  description: string;
  invoiceUrl?: string;
  receiptUrl?: string;
  unsubscribeUrl: string;
}

export interface WeeklyDigestEmailData {
  firstName: string;
  weekRange: string;
  stats: {
    newPitches: number;
    newFollowers: number;
    messages: number;
    views: number;
  };
  topPitches: Array<{
    title: string;
    views: number;
    url: string;
  }>;
  recommendations: Array<{
    title: string;
    creator: string;
    url: string;
    imageUrl?: string;
  }>;
  unsubscribeUrl: string;
}

export interface PitchViewEmailData {
  creatorName: string;
  pitchTitle: string;
  viewerName: string;
  viewerType: string;
  pitchUrl: string;
  viewTime: string;
  unsubscribeUrl: string;
}

export interface InvestorInviteEmailData {
  recipientName: string;
  inviterName: string;
  projectTitle: string;
  inviteMessage?: string;
  actionUrl: string;
  unsubscribeUrl: string;
}

export interface ProjectUpdateEmailData {
  investorName: string;
  projectTitle: string;
  updateType: 'milestone' | 'funding' | 'production' | 'release';
  updateMessage: string;
  projectUrl: string;
  unsubscribeUrl: string;
}

// Template name constants for type safety
export const EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  NDA_REQUEST: 'nda-request',
  NDA_RESPONSE: 'nda-response',
  MESSAGE: 'message',
  PASSWORD_RESET: 'password-reset',
  PAYMENT_CONFIRMATION: 'payment-confirmation',
  WEEKLY_DIGEST: 'weekly-digest',
  PITCH_VIEW: 'pitch-view',
  INVESTOR_INVITE: 'investor-invite',
  PROJECT_UPDATE: 'project-update',
} as const;

export type EmailTemplateName = typeof EMAIL_TEMPLATES[keyof typeof EMAIL_TEMPLATES];

// Email service factory interface
export interface EmailServiceFactory {
  createProvider(config: EmailConfig): EmailProvider;
  getProviderNames(): string[];
}