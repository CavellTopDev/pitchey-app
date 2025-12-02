/**
 * Email Service for Cloudflare Workers
 * Supports multiple providers: SendGrid, Resend, Mailgun
 */

export interface EmailConfig {
  provider: 'sendgrid' | 'resend' | 'mailgun';
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
  }

  async send(message: EmailMessage): Promise<boolean> {
    switch (this.config.provider) {
      case 'sendgrid':
        return this.sendWithSendGrid(message);
      case 'resend':
        return this.sendWithResend(message);
      case 'mailgun':
        return this.sendWithMailgun(message);
      default:
        console.error('Unknown email provider');
        return false;
    }
  }

  private async sendWithSendGrid(message: EmailMessage): Promise<boolean> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.to }] }],
          from: {
            email: this.config.fromEmail,
            name: this.config.fromName,
          },
          subject: message.subject,
          content: [
            { type: 'text/plain', value: message.text || this.htmlToText(message.html) },
            { type: 'text/html', value: message.html },
          ],
        }),
      });

      return response.status === 202;
    } catch (error) {
      console.error('SendGrid error:', error);
      return false;
    }
  }

  private async sendWithResend(message: EmailMessage): Promise<boolean> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${this.config.fromName} <${this.config.fromEmail}>`,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text || this.htmlToText(message.html),
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Resend error:', error);
      return false;
    }
  }

  private async sendWithMailgun(message: EmailMessage): Promise<boolean> {
    try {
      const domain = this.config.fromEmail.split('@')[1];
      const formData = new FormData();
      formData.append('from', `${this.config.fromName} <${this.config.fromEmail}>`);
      formData.append('to', message.to);
      formData.append('subject', message.subject);
      formData.append('html', message.html);
      formData.append('text', message.text || this.htmlToText(message.html));

      const response = await fetch(
        `https://api.mailgun.net/v3/${domain}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`api:${this.config.apiKey}`)}`,
          },
          body: formData,
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Mailgun error:', error);
      return false;
    }
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  // Email templates
  static getWelcomeEmail(name: string, verificationUrl: string): EmailMessage {
    return {
      to: '',
      subject: 'Welcome to Pitchey - Verify Your Email',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; color: #718096; margin-top: 30px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Pitchey!</h1>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>Thank you for joining Pitchey, the platform where great stories meet great opportunities.</p>
              <p>Please verify your email address to get started:</p>
              <a href="${verificationUrl}" class="button">Verify Email</a>
              <p>Or copy and paste this link:</p>
              <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
              <p>This link will expire in 24 hours.</p>
              <div class="footer">
                <p>If you didn't create an account, you can safely ignore this email.</p>
                <p>© 2024 Pitchey. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  static getPasswordResetEmail(name: string, resetUrl: string): EmailMessage {
    return {
      to: '',
      subject: 'Reset Your Pitchey Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #e53e3e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; color: #718096; margin-top: 30px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>We received a request to reset your password for your Pitchey account.</p>
              <p>Click the button below to create a new password:</p>
              <a href="${resetUrl}" class="button">Reset Password</a>
              <p>Or copy and paste this link:</p>
              <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
              <p>This link will expire in 1 hour for security reasons.</p>
              <p><strong>If you didn't request this, please ignore this email.</strong> Your password won't be changed.</p>
              <div class="footer">
                <p>For security, this request was received from ${new Date().toLocaleString()}.</p>
                <p>© 2024 Pitchey. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  static getNDARequestEmail(investorName: string, pitchTitle: string, ndaUrl: string): EmailMessage {
    return {
      to: '',
      subject: `NDA Request for "${pitchTitle}"`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #48bb78; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .info-box { background: #f7fafc; padding: 15px; border-left: 4px solid #48bb78; margin: 20px 0; }
            .footer { text-align: center; color: #718096; margin-top: 30px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New NDA Request</h1>
            </div>
            <div class="content">
              <h2>You have a new NDA request!</h2>
              <div class="info-box">
                <p><strong>Investor:</strong> ${investorName}</p>
                <p><strong>Pitch:</strong> ${pitchTitle}</p>
                <p><strong>Requested:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
              <p>${investorName} is interested in learning more about your pitch and has requested to sign an NDA to access additional materials.</p>
              <a href="${ndaUrl}" class="button">Review NDA Request</a>
              <p>You can approve or decline this request from your creator dashboard.</p>
              <div class="footer">
                <p>© 2024 Pitchey. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }
}