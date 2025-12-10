/**
 * Email Service
 * Handles sending transactional emails using React Email templates
 */

import { render } from '@react-email/render';

// Email provider interface (can be implemented with SendGrid, Resend, etc.)
interface EmailProvider {
  send(options: {
    to: string;
    from: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void>;
}

export interface EmailOptions {
  to: string;
  subject?: string;
  [key: string]: any;
}

export class EmailService {
  private provider: EmailProvider;
  private fromEmail: string = 'notifications@pitchey.com';
  private fromName: string = 'Pitchey';

  constructor(provider: EmailProvider) {
    this.provider = provider;
  }

  /**
   * Send NDA request notification email
   */
  async sendNDARequestEmail(options: {
    to: string;
    creatorName: string;
    requesterName: string;
    requesterType: string;
    pitchTitle: string;
    message: string;
    requestId: number;
  }): Promise<void> {
    try {
      const html = this.renderNDARequestTemplate(options);
      
      await this.provider.send({
        to: options.to,
        from: `${this.fromName} <${this.fromEmail}>`,
        subject: `New NDA Request for "${options.pitchTitle}"`,
        html,
        text: this.getPlainText(html)
      });
    } catch (error) {
      console.error('Send NDA request email error:', error);
      throw error;
    }
  }

  /**
   * Send NDA approval notification email
   */
  async sendNDAApprovalEmail(options: {
    to: string;
    requesterName: string;
    pitchTitle: string;
    expiresAt: Date;
    documentUrl?: string;
    customTerms?: string;
    message?: string;
  }): Promise<void> {
    try {
      const html = this.renderNDAApprovalTemplate(options);
      
      await this.provider.send({
        to: options.to,
        from: `${this.fromName} <${this.fromEmail}>`,
        subject: `NDA Approved - Access Granted to "${options.pitchTitle}"`,
        html,
        text: this.getPlainText(html)
      });
    } catch (error) {
      console.error('Send NDA approval email error:', error);
      throw error;
    }
  }

  /**
   * Send NDA rejection notification email
   */
  async sendNDARejectionEmail(options: {
    to: string;
    requesterName: string;
    pitchTitle: string;
    message?: string;
  }): Promise<void> {
    try {
      const html = this.renderNDARejectionTemplate(options);
      
      await this.provider.send({
        to: options.to,
        from: `${this.fromName} <${this.fromEmail}>`,
        subject: `NDA Request Update for "${options.pitchTitle}"`,
        html,
        text: this.getPlainText(html)
      });
    } catch (error) {
      console.error('Send NDA rejection email error:', error);
      throw error;
    }
  }

  /**
   * Send NDA expiry reminder email
   */
  async sendNDAExpiryReminder(options: {
    to: string;
    requesterName: string;
    pitchTitle: string;
    expiresAt: Date;
    pitchId: number;
  }): Promise<void> {
    try {
      const html = this.renderNDAExpiryTemplate(options);
      
      await this.provider.send({
        to: options.to,
        from: `${this.fromName} <${this.fromEmail}>`,
        subject: `NDA Expiring Soon - "${options.pitchTitle}"`,
        html,
        text: this.getPlainText(html)
      });
    } catch (error) {
      console.error('Send NDA expiry reminder error:', error);
      throw error;
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(options: {
    to: string;
    name: string;
    userType: string;
  }): Promise<void> {
    try {
      const html = this.renderWelcomeTemplate(options);
      
      await this.provider.send({
        to: options.to,
        from: `${this.fromName} <${this.fromEmail}>`,
        subject: 'Welcome to Pitchey!',
        html,
        text: this.getPlainText(html)
      });
    } catch (error) {
      console.error('Send welcome email error:', error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(options: {
    to: string;
    name: string;
    resetToken: string;
  }): Promise<void> {
    try {
      const html = this.renderPasswordResetTemplate(options);
      
      await this.provider.send({
        to: options.to,
        from: `${this.fromName} <${this.fromEmail}>`,
        subject: 'Reset Your Pitchey Password',
        html,
        text: this.getPlainText(html)
      });
    } catch (error) {
      console.error('Send password reset email error:', error);
      throw error;
    }
  }

  /**
   * Render NDA request email template
   */
  private renderNDARequestTemplate(data: any): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .info-box { background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New NDA Request</h1>
          </div>
          <div class="content">
            <p>Hi ${data.creatorName},</p>
            
            <p>You have received a new NDA request for your pitch "<strong>${data.pitchTitle}</strong>".</p>
            
            <div class="info-box">
              <p><strong>Requester:</strong> ${data.requesterName}</p>
              <p><strong>Type:</strong> ${data.requesterType}</p>
              <p><strong>Message:</strong></p>
              <p>${data.message}</p>
            </div>
            
            <p>Please review this request and decide whether to grant access to your pitch materials.</p>
            
            <a href="https://pitchey.com/dashboard/nda-requests/${data.requestId}" class="button">
              Review Request
            </a>
            
            <p>You can approve or reject this request from your creator dashboard.</p>
            
            <div class="footer">
              <p>© 2024 Pitchey. All rights reserved.</p>
              <p>This email was sent because you received an NDA request on Pitchey.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Render NDA approval email template
   */
  private renderNDAApprovalTemplate(data: any): string {
    const expiryDate = new Date(data.expiresAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .success-box { background: #d1fae5; border: 1px solid #10b981; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .terms-box { background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 NDA Approved!</h1>
          </div>
          <div class="content">
            <p>Hi ${data.requesterName},</p>
            
            <div class="success-box">
              <p><strong>Great news!</strong> Your NDA request for "<strong>${data.pitchTitle}</strong>" has been approved.</p>
            </div>
            
            <p>You now have access to the full pitch materials and confidential information.</p>
            
            <p><strong>Access Valid Until:</strong> ${expiryDate}</p>
            
            ${data.customTerms ? `
              <div class="terms-box">
                <p><strong>Additional Terms:</strong></p>
                <p>${data.customTerms}</p>
              </div>
            ` : ''}
            
            ${data.message ? `
              <p><strong>Message from the creator:</strong></p>
              <p>${data.message}</p>
            ` : ''}
            
            <a href="https://pitchey.com/pitch/view" class="button">
              View Pitch Materials
            </a>
            
            ${data.documentUrl ? `
              <p>You can download the NDA document for your records:</p>
              <a href="${data.documentUrl}">Download NDA Document</a>
            ` : ''}
            
            <div class="footer">
              <p>© 2024 Pitchey. All rights reserved.</p>
              <p>Please respect the confidentiality of the information shared with you.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Render NDA rejection email template
   */
  private renderNDARejectionTemplate(data: any): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f3f4f6; color: #374151; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
          .info-box { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>NDA Request Update</h1>
          </div>
          <div class="content">
            <p>Hi ${data.requesterName},</p>
            
            <div class="info-box">
              <p>We regret to inform you that your NDA request for "<strong>${data.pitchTitle}</strong>" was not approved at this time.</p>
            </div>
            
            ${data.message ? `
              <p><strong>Message from the creator:</strong></p>
              <p>${data.message}</p>
            ` : ''}
            
            <p>You can explore other pitches that might be a better fit for your interests:</p>
            
            <a href="https://pitchey.com/browse" class="button">
              Browse Other Pitches
            </a>
            
            <div class="footer">
              <p>© 2024 Pitchey. All rights reserved.</p>
              <p>If you have questions, please contact our support team.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Render NDA expiry reminder template
   */
  private renderNDAExpiryTemplate(data: any): string {
    const expiryDate = new Date(data.expiresAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
          .warning-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ NDA Expiring Soon</h1>
          </div>
          <div class="content">
            <p>Hi ${data.requesterName},</p>
            
            <div class="warning-box">
              <p><strong>Important Notice:</strong> Your NDA access for "<strong>${data.pitchTitle}</strong>" will expire on <strong>${expiryDate}</strong>.</p>
            </div>
            
            <p>After this date, you will no longer have access to the confidential pitch materials.</p>
            
            <p>If you need continued access, please contact the creator to request an extension.</p>
            
            <a href="https://pitchey.com/pitch/${data.pitchId}" class="button">
              View Pitch
            </a>
            
            <p>Make sure to save any important information before your access expires.</p>
            
            <div class="footer">
              <p>© 2024 Pitchey. All rights reserved.</p>
              <p>This is an automated reminder about your expiring NDA access.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Render welcome email template
   */
  private renderWelcomeTemplate(data: any): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .features { background: #f9fafb; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Pitchey!</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            
            <p>Welcome to Pitchey - the platform that connects creative minds with the resources they need to bring stories to life!</p>
            
            <div class="features">
              <h3>As a ${data.userType}, you can:</h3>
              ${data.userType === 'creator' ? `
                <ul>
                  <li>Create and showcase your pitches</li>
                  <li>Connect with investors and production companies</li>
                  <li>Protect your ideas with NDA workflows</li>
                  <li>Track interest and engagement</li>
                </ul>
              ` : data.userType === 'investor' ? `
                <ul>
                  <li>Discover exciting new projects</li>
                  <li>Request NDA access to confidential materials</li>
                  <li>Track your investment portfolio</li>
                  <li>Connect directly with creators</li>
                </ul>
              ` : `
                <ul>
                  <li>Find your next production</li>
                  <li>Access detailed pitch materials</li>
                  <li>Manage production workflows</li>
                  <li>Collaborate with creators</li>
                </ul>
              `}
            </div>
            
            <a href="https://pitchey.com/dashboard" class="button">
              Go to Dashboard
            </a>
            
            <p>If you have any questions, our support team is here to help!</p>
            
            <div class="footer">
              <p>© 2024 Pitchey. All rights reserved.</p>
              <p>You're receiving this because you signed up for Pitchey.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Render password reset email template
   */
  private renderPasswordResetTemplate(data: any): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .code-box { background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            
            <p>We received a request to reset your Pitchey password. If you didn't make this request, you can ignore this email.</p>
            
            <p>To reset your password, click the button below:</p>
            
            <a href="https://pitchey.com/reset-password?token=${data.resetToken}" class="button">
              Reset Password
            </a>
            
            <p>Or use this reset code:</p>
            
            <div class="code-box">
              ${data.resetToken.substring(0, 6).toUpperCase()}
            </div>
            
            <p>This link will expire in 1 hour for security reasons.</p>
            
            <div class="footer">
              <p>© 2024 Pitchey. All rights reserved.</p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Convert HTML to plain text (simplified version)
   */
  private getPlainText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}