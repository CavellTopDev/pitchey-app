// Postmark Email Provider for Production
// Ready for API key configuration - just set POSTMARK_API_KEY environment variable

import { EmailProvider, EmailData, EmailResult } from './interface.ts';

export class PostmarkEmailProvider implements EmailProvider {
  name = 'postmark';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendEmail(data: EmailData): Promise<EmailResult> {
    try {
      const client = await this.getPostmarkClient();
      
      if (!client) {
        throw new Error('Postmark client not available. Install postmark package.');
      }

      const message = this.buildPostmarkMessage(data);
      const response = await client.sendEmail(message);
      
      console.log(`✅ Email sent via Postmark: ${data.subject} to ${data.to}`);
      
      return {
        success: true,
        messageId: response.MessageID,
        providerId: 'postmark',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Postmark email error:', error);
      
      // Extract meaningful error message from Postmark error
      let errorMessage = 'Unknown Postmark error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        const pmError = error as any;
        if (pmError.message) {
          errorMessage = pmError.message;
        } else if (pmError.ErrorCode) {
          errorMessage = `Postmark Error ${pmError.ErrorCode}: ${pmError.Message}`;
        }
      }
      
      return {
        success: false,
        error: errorMessage,
        providerId: 'postmark',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async verifyConfiguration(): Promise<boolean> {
    try {
      const client = await this.getPostmarkClient();
      if (!client) return false;
      
      // Test API key by getting account info
      await client.getServer();
      return true;
    } catch (error) {
      console.error('Postmark configuration verification failed:', error);
      return false;
    }
  }

  async getHealthStatus(): Promise<{ status: 'healthy' | 'degraded' | 'down'; details?: string }> {
    try {
      const isConfigValid = await this.verifyConfiguration();
      
      if (!isConfigValid) {
        return {
          status: 'down',
          details: 'Postmark configuration invalid or API key missing'
        };
      }

      // Additional health checks
      const client = await this.getPostmarkClient();
      if (client) {
        try {
          const serverInfo = await client.getServer();
          
          // Check bounce rate and other metrics if needed
          return {
            status: 'healthy',
            details: `Postmark server: ${serverInfo.Name || 'Unknown'}`
          };
        } catch (error) {
          return {
            status: 'degraded',
            details: 'Postmark API accessible but server info unavailable'
          };
        }
      }
      
      return {
        status: 'healthy',
        details: 'Postmark provider ready'
      };
    } catch (error) {
      return {
        status: 'down',
        details: `Postmark health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async getPostmarkClient(): Promise<any> {
    try {
      // Try to import Postmark - use dynamic import to handle missing dependency
      const postmark = await import('postmark');
      return new postmark.ServerClient(this.apiKey);
    } catch (error) {
      console.warn('Postmark package not installed. Run: npm install postmark');
      return null;
    }
  }

  private buildPostmarkMessage(data: EmailData): any {
    const fromEmail = Deno.env.get('EMAIL_FROM') || 'noreply@pitchey.com';
    const fromName = Deno.env.get('EMAIL_FROM_NAME') || 'Pitchey';

    const message = {
      From: `${fromName} <${fromEmail}>`,
      To: Array.isArray(data.to) ? data.to.join(',') : data.to,
      Subject: data.subject,
      HtmlBody: data.html,
      TextBody: data.text,
      Headers: [
        {
          Name: 'X-Mailer',
          Value: 'Pitchey Email Service'
        },
        {
          Name: 'X-Provider',
          Value: 'Postmark'
        }
      ]
    } as any;

    // Add optional fields if provided
    if (data.cc) {
      message.Cc = Array.isArray(data.cc) ? data.cc.join(',') : data.cc;
    }

    if (data.bcc) {
      message.Bcc = Array.isArray(data.bcc) ? data.bcc.join(',') : data.bcc;
    }

    if (data.replyTo) {
      message.ReplyTo = data.replyTo;
    }

    // Add custom headers
    if (data.headers) {
      Object.entries(data.headers).forEach(([key, value]) => {
        message.Headers.push({
          Name: key,
          Value: value
        });
      });
    }

    // Add tracking information
    if (data.trackingId) {
      message.Headers.push({
        Name: 'X-Tracking-ID',
        Value: data.trackingId
      });
      
      if (data.templateName) {
        message.Headers.push({
          Name: 'X-Template-Name',
          Value: data.templateName
        });
      }

      // Use Postmark's metadata feature
      message.Metadata = {
        trackingId: data.trackingId,
        templateName: data.templateName || 'unknown'
      };
    }

    // Handle attachments
    if (data.attachments && data.attachments.length > 0) {
      message.Attachments = data.attachments.map(att => ({
        Name: att.filename,
        Content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
        ContentType: att.contentType || 'application/octet-stream',
        ContentID: att.cid
      }));
    }

    // Handle unsubscribe
    if (data.unsubscribeUrl) {
      message.Headers.push({
        Name: 'List-Unsubscribe',
        Value: data.listUnsubscribe || `<${data.unsubscribeUrl}>`
      });
      
      // Postmark supports unsubscribe links in tracking
      message.TrackLinks = 'HtmlAndText';
    }

    return message;
  }
}

export default PostmarkEmailProvider;