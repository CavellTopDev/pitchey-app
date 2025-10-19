// Comprehensive Email Service - Production Ready
// This file exports the main EmailService and template functions
// Replace all console.log email calls with these service calls

export * from './interface.ts';
export * from './console-provider.ts';
export * from './sendgrid-provider.ts';
export * from './postmark-provider.ts';
export * from './factory.ts';
export * from './template-engine.ts';

import { getEmailService } from './factory.ts';
import { getEmailTemplateEngine } from './template-engine.ts';
import {
  WelcomeEmailData,
  NDARequestEmailData,
  NDAResponseEmailData,
  MessageEmailData,
  PasswordResetEmailData,
  PaymentConfirmationEmailData,
  EmailData,
  EmailResult
} from './interface.ts';

// High-level email functions that replace console.log calls
// These functions handle template rendering and email sending

/**
 * Send welcome email to new users
 * Replaces: console.log("Sending welcome email to:", email)
 */
export async function sendWelcomeEmail(
  email: string, 
  data: WelcomeEmailData
): Promise<EmailResult> {
  try {
    const templateEngine = getEmailTemplateEngine();
    const emailService = getEmailService();
    
    const emailData = await templateEngine.buildWelcomeEmail(data);
    emailData.to = email; // Override with actual email
    emailData.trackingId = `welcome-${Date.now()}-${email}`;
    
    return await emailService.sendEmail(emailData);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Send NDA request notification
 * Replaces: console.log("Sending NDA request notification to:", email)
 */
export async function sendNDARequestEmail(
  email: string,
  data: NDARequestEmailData
): Promise<EmailResult> {
  try {
    const templateEngine = getEmailTemplateEngine();
    const emailService = getEmailService();
    
    const emailData = await templateEngine.buildNDARequestEmail(data);
    emailData.to = email;
    emailData.trackingId = `nda-request-${Date.now()}-${email}`;
    
    return await emailService.sendEmail(emailData);
  } catch (error) {
    console.error('Failed to send NDA request email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Send NDA response notification
 * Replaces: console.log("Sending NDA response notification to:", email)
 */
export async function sendNDAResponseEmail(
  email: string,
  data: NDAResponseEmailData
): Promise<EmailResult> {
  try {
    const templateEngine = getEmailTemplateEngine();
    const emailService = getEmailService();
    
    const emailData = await templateEngine.buildNDAResponseEmail(data);
    emailData.to = email;
    emailData.trackingId = `nda-response-${Date.now()}-${email}`;
    
    return await emailService.sendEmail(emailData);
  } catch (error) {
    console.error('Failed to send NDA response email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Send message notification
 * Replaces: console.log("Sending message notification to:", email)
 */
export async function sendMessageNotificationEmail(
  email: string,
  data: MessageEmailData
): Promise<EmailResult> {
  try {
    const templateEngine = getEmailTemplateEngine();
    const emailService = getEmailService();
    
    const emailData = await templateEngine.buildMessageEmail(data);
    emailData.to = email;
    emailData.trackingId = `message-${Date.now()}-${email}`;
    
    return await emailService.sendEmail(emailData);
  } catch (error) {
    console.error('Failed to send message notification email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Send password reset email
 * Replaces: console.log("Sending password reset email to:", email)
 */
export async function sendPasswordResetEmail(
  email: string,
  data: PasswordResetEmailData
): Promise<EmailResult> {
  try {
    const templateEngine = getEmailTemplateEngine();
    const emailService = getEmailService();
    
    const emailData = await templateEngine.buildPasswordResetEmail(data);
    emailData.to = email;
    emailData.trackingId = `password-reset-${Date.now()}-${email}`;
    
    return await emailService.sendEmail(emailData);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Send payment confirmation email
 * Replaces: console.log("Sending payment confirmation to:", email)
 */
export async function sendPaymentConfirmationEmail(
  email: string,
  data: PaymentConfirmationEmailData
): Promise<EmailResult> {
  try {
    const templateEngine = getEmailTemplateEngine();
    const emailService = getEmailService();
    
    const emailData = await templateEngine.buildPaymentConfirmationEmail(data);
    emailData.to = email;
    emailData.trackingId = `payment-${Date.now()}-${email}`;
    
    return await emailService.sendEmail(emailData);
  } catch (error) {
    console.error('Failed to send payment confirmation email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Send custom email with raw EmailData
 * Replaces: console.log("Sending email to:", email, "Subject:", subject)
 */
export async function sendEmail(emailData: EmailData): Promise<EmailResult> {
  try {
    const emailService = getEmailService();
    
    if (!emailData.trackingId) {
      emailData.trackingId = `custom-${Date.now()}-${emailData.to}`;
    }
    
    return await emailService.sendEmail(emailData);
  } catch (error) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get email service health status
 * Useful for monitoring and health checks
 */
export async function getEmailServiceHealth(): Promise<{
  provider: string;
  healthy: boolean;
  configValid: boolean;
  status: any;
}> {
  try {
    const emailService = getEmailService();
    const configValid = await emailService.verifyConfiguration();
    const status = await emailService.getHealthStatus();
    
    return {
      provider: emailService.getProviderName(),
      healthy: status.status === 'healthy',
      configValid,
      status,
    };
  } catch (error) {
    return {
      provider: 'unknown',
      healthy: false,
      configValid: false,
      status: { status: 'error', details: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Get email service information
 * Useful for debugging and configuration checking
 */
export function getEmailServiceInfo(): any {
  try {
    const emailService = getEmailService();
    return emailService.getProviderInfo();
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Legacy compatibility - for existing code that imports the old service
export { getEmailService as EmailService } from './factory.ts';