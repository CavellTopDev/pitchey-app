/**
 * Email Service for Cloudflare Workers
 * Uses Resend API for sending emails
 */

export interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded
  }>;
}

export class WorkerEmailService {
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;
  private readonly resendApiUrl = 'https://api.resend.com/emails';

  constructor(config: EmailConfig) {
    this.apiKey = config.apiKey;
    this.fromEmail = config.fromEmail;
    this.fromName = config.fromName || 'Pitchey';
  }

  /**
   * Send a single email
   */
  async send(message: EmailMessage): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const response = await fetch(this.resendApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: Array.isArray(message.to) ? message.to : [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo,
          cc: message.cc,
          bcc: message.bcc,
          attachments: message.attachments,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Failed to send email',
        };
      }

      return {
        success: true,
        id: data.id,
      };
    } catch (error) {
      console.error('Email send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send batch emails (up to 100 at once)
   */
  async sendBatch(messages: EmailMessage[]): Promise<Array<{ success: boolean; id?: string; error?: string }>> {
    // Resend supports batch sending up to 100 emails
    const batches = this.chunkArray(messages, 100);
    const results = [];

    for (const batch of batches) {
      const batchPromises = batch.map(message => this.send(message));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Send templated emails
   */
  async sendTemplate(
    to: string | string[],
    template: string,
    data: Record<string, any>
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const html = this.renderTemplate(template, data);
    return this.send({
      to,
      subject: data.subject || 'Notification from Pitchey',
      html,
    });
  }

  /**
   * Common email templates
   */
  private renderTemplate(template: string, data: Record<string, any>): string {
    const templates: Record<string, (data: any) => string> = {
      welcome: (data) => `
        <h2>Welcome to Pitchey, ${data.name}!</h2>
        <p>We're excited to have you on board.</p>
        <p>Your account type: <strong>${data.userType}</strong></p>
        <p><a href="${data.loginUrl}">Login to your account</a></p>
      `,
      
      ndaRequest: (data) => `
        <h2>New NDA Request</h2>
        <p>${data.requesterName} has requested to sign an NDA for your pitch "${data.pitchTitle}".</p>
        <p><a href="${data.reviewUrl}">Review Request</a></p>
      `,
      
      ndaApproved: (data) => `
        <h2>NDA Approved</h2>
        <p>Your NDA request for "${data.pitchTitle}" has been approved.</p>
        <p>You can now view the full pitch details.</p>
        <p><a href="${data.pitchUrl}">View Pitch</a></p>
      `,
      
      ndaRejected: (data) => `
        <h2>NDA Request Declined</h2>
        <p>Your NDA request for "${data.pitchTitle}" was declined.</p>
        ${data.reason ? `<p>Reason: ${data.reason}</p>` : ''}
      `,
      
      passwordReset: (data) => `
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your password.</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="${data.resetUrl}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
      
      newMessage: (data) => `
        <h2>New Message</h2>
        <p>You have a new message from ${data.senderName}:</p>
        <blockquote>${data.preview}</blockquote>
        <p><a href="${data.messageUrl}">View Full Message</a></p>
      `,
      
      investmentInterest: (data) => `
        <h2>Investment Interest</h2>
        <p>${data.investorName} has expressed interest in investing in "${data.pitchTitle}".</p>
        <p>Investment amount: ${data.amount}</p>
        <p><a href="${data.detailsUrl}">View Details</a></p>
      `,
    };

    const renderFn = templates[template];
    if (!renderFn) {
      throw new Error(`Unknown email template: ${template}`);
    }

    // Wrap in base layout
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            h2 { color: #2c3e50; }
            a { color: #3498db; text-decoration: none; }
            a:hover { text-decoration: underline; }
            blockquote { border-left: 3px solid #3498db; padding-left: 10px; margin-left: 0; }
          </style>
        </head>
        <body>
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            ${renderFn(data)}
            <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #999;">
              © ${new Date().getFullYear()} Pitchey. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Helper to chunk array
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}