// SendGrid Email Provider for Production
// Ready for API key configuration - just set SENDGRID_API_KEY environment variable

import { EmailProvider, EmailData, EmailResult } from './interface.ts';

export class SendGridEmailProvider implements EmailProvider {
  name = 'sendgrid';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendEmail(data: EmailData): Promise<EmailResult> {
    try {
      // Import SendGrid dynamically to avoid dependency issues in development
      const sgMail = await this.getSendGridClient();
      
      if (!sgMail) {
        throw new Error('SendGrid client not available. Install @sendgrid/mail package.');
      }

      sgMail.setApiKey(this.apiKey);

      const msg = this.buildSendGridMessage(data);
      const response = await sgMail.send(msg);
      
      const messageId = response[0]?.headers?.['x-message-id'] as string || 
                       `sendgrid-${Date.now()}`;
      
      console.log(`✅ Email sent via SendGrid: ${data.subject} to ${data.to}`);
      
      return {
        success: true,
        messageId,
        providerId: 'sendgrid',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ SendGrid email error:', error);
      
      // Extract meaningful error message from SendGrid error
      let errorMessage = 'Unknown SendGrid error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // SendGrid errors often have response.body
        const sgError = error as any;
        if (sgError.response?.body?.errors) {
          errorMessage = sgError.response.body.errors.map((e: any) => e.message).join(', ');
        } else if (sgError.message) {
          errorMessage = sgError.message;
        }
      }
      
      return {
        success: false,
        error: errorMessage,
        providerId: 'sendgrid',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async verifyConfiguration(): Promise<boolean> {
    try {
      const sgMail = await this.getSendGridClient();
      if (!sgMail) return false;
      
      sgMail.setApiKey(this.apiKey);
      
      // Test API key by attempting to get account info
      // Note: SendGrid doesn't have a simple validation endpoint
      // In production, you might want to send a test email to a known address
      
      // For now, just verify the API key format
      if (!this.apiKey || !this.apiKey.startsWith('SG.')) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('SendGrid configuration verification failed:', error);
      return false;
    }
  }

  async getHealthStatus(): Promise<{ status: 'healthy' | 'degraded' | 'down'; details?: string }> {
    try {
      const isConfigValid = await this.verifyConfiguration();
      
      if (!isConfigValid) {
        return {
          status: 'down',
          details: 'SendGrid configuration invalid or API key missing'
        };
      }

      // You could add additional health checks here like:
      // - Check SendGrid API status
      // - Check rate limits
      // - Test connectivity
      
      return {
        status: 'healthy',
        details: 'SendGrid provider ready'
      };
    } catch (error) {
      return {
        status: 'down',
        details: `SendGrid health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async getSendGridClient(): Promise<any> {
    try {
      // Try to import SendGrid - use dynamic import to handle missing dependency
      const sgMail = await import('@sendgrid/mail');
      return sgMail.default || sgMail;
    } catch (error) {
      console.warn('SendGrid package not installed. Run: npm install @sendgrid/mail');
      return null;
    }
  }

  private buildSendGridMessage(data: EmailData): any {
    const fromEmail = Deno.env.get('EMAIL_FROM') || 'noreply@pitchey.com';
    const fromName = Deno.env.get('EMAIL_FROM_NAME') || 'Pitchey';

    const msg = {
      to: Array.isArray(data.to) ? data.to : [data.to],
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: data.subject,
      html: data.html,
      text: data.text,
      headers: {
        'X-Mailer': 'Pitchey Email Service',
        'X-Provider': 'SendGrid',
        ...data.headers,
      },
    } as any;

    // Add optional fields if provided
    if (data.cc) {
      msg.cc = Array.isArray(data.cc) ? data.cc : [data.cc];
    }

    if (data.bcc) {
      msg.bcc = Array.isArray(data.bcc) ? data.bcc : [data.bcc];
    }

    if (data.replyTo) {
      msg.replyTo = data.replyTo;
    }

    if (data.attachments && data.attachments.length > 0) {
      msg.attachments = data.attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        type: att.contentType,
        contentId: att.cid,
      }));
    }

    // Add tracking and unsubscribe information
    if (data.trackingId) {
      msg.customArgs = {
        trackingId: data.trackingId,
        templateName: data.templateName || 'unknown',
      };
    }

    if (data.unsubscribeUrl) {
      msg.asm = {
        groupId: 1, // Configure unsubscribe groups in SendGrid dashboard
      };
      
      if (data.listUnsubscribe) {
        msg.headers['List-Unsubscribe'] = data.listUnsubscribe;
      } else {
        msg.headers['List-Unsubscribe'] = `<${data.unsubscribeUrl}>`;
      }
    }

    return msg;
  }
}

export default SendGridEmailProvider;