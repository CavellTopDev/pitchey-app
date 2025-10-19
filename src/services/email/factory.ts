// Email Service Factory
// Handles provider switching based on environment variables
// Allows switching from console to production email with just env changes

import { EmailProvider, EmailConfig, EmailServiceFactory } from './interface.ts';
import { ConsoleEmailProvider } from './console-provider.ts';
import { SendGridEmailProvider } from './sendgrid-provider.ts';
import { PostmarkEmailProvider } from './postmark-provider.ts';

export class EmailFactory implements EmailServiceFactory {
  
  createProvider(config: EmailConfig): EmailProvider {
    switch (config.EMAIL_PROVIDER) {
      case 'console':
        return new ConsoleEmailProvider();

      case 'sendgrid':
        if (!config.SENDGRID_API_KEY) {
          console.warn('⚠️  SENDGRID_API_KEY not found, falling back to console provider');
          return new ConsoleEmailProvider();
        }
        console.log('✅ Using SendGrid email provider');
        return new SendGridEmailProvider(config.SENDGRID_API_KEY);

      case 'postmark':
        if (!config.POSTMARK_API_KEY) {
          console.warn('⚠️  POSTMARK_API_KEY not found, falling back to console provider');
          return new ConsoleEmailProvider();
        }
        console.log('✅ Using Postmark email provider');
        return new PostmarkEmailProvider(config.POSTMARK_API_KEY);

      case 'ses':
        if (!config.AWS_REGION || !config.AWS_ACCESS_KEY_ID || !config.AWS_SECRET_ACCESS_KEY) {
          console.warn('⚠️  AWS credentials not found, falling back to console provider');
          return new ConsoleEmailProvider();
        }
        console.log('✅ Using AWS SES email provider');
        // Note: AWS SES provider would be implemented here
        // For now, fall back to console
        console.warn('⚠️  AWS SES provider not yet implemented, falling back to console provider');
        return new ConsoleEmailProvider();

      default:
        console.warn(`⚠️  Unsupported email provider: ${config.EMAIL_PROVIDER}, falling back to console provider`);
        return new ConsoleEmailProvider();
    }
  }

  getProviderNames(): string[] {
    return ['console', 'sendgrid', 'postmark', 'ses'];
  }
}

// Email Service class with production-ready features
export class EmailService {
  private provider: EmailProvider;
  private config: EmailConfig;
  private factory: EmailFactory;

  constructor() {
    this.factory = new EmailFactory();
    this.config = this.loadConfig();
    this.provider = this.factory.createProvider(this.config);
    
    // Verify configuration on startup
    this.verifyProviderHealth();
  }

  private loadConfig(): EmailConfig {
    return {
      EMAIL_PROVIDER: (Deno.env.get('EMAIL_PROVIDER') as any) || 'console',
      EMAIL_FROM: Deno.env.get('EMAIL_FROM') || 'noreply@pitchey.com',
      EMAIL_FROM_NAME: Deno.env.get('EMAIL_FROM_NAME') || 'Pitchey',
      EMAIL_REPLY_TO: Deno.env.get('EMAIL_REPLY_TO'),
      SENDGRID_API_KEY: Deno.env.get('SENDGRID_API_KEY'),
      POSTMARK_API_KEY: Deno.env.get('POSTMARK_API_KEY'),
      AWS_REGION: Deno.env.get('AWS_REGION'),
      AWS_ACCESS_KEY_ID: Deno.env.get('AWS_ACCESS_KEY_ID'),
      AWS_SECRET_ACCESS_KEY: Deno.env.get('AWS_SECRET_ACCESS_KEY'),
    };
  }

  private async verifyProviderHealth(): Promise<void> {
    try {
      const isConfigValid = await this.provider.verifyConfiguration();
      const healthStatus = await this.provider.getHealthStatus();
      
      if (!isConfigValid) {
        console.warn(`⚠️  Email provider ${this.provider.name} configuration invalid`);
      }
      
      if (healthStatus.status !== 'healthy') {
        console.warn(`⚠️  Email provider ${this.provider.name} health status: ${healthStatus.status} - ${healthStatus.details}`);
      }
      
      if (isConfigValid && healthStatus.status === 'healthy') {
        console.log(`✅ Email service initialized with ${this.provider.name} provider`);
      }
    } catch (error) {
      console.error('❌ Email provider health check failed:', error);
    }
  }

  async sendEmail(data: any): Promise<any> {
    // Add default metadata
    const emailData = {
      ...data,
      headers: {
        'X-Mailer': 'Pitchey Email Service v2.0',
        'X-Sent-From': 'Pitchey Platform',
        ...data.headers,
      },
    };

    try {
      const result = await this.provider.sendEmail(emailData);
      
      // Log email activity for monitoring
      if (result.success) {
        console.log(`📧 Email sent successfully via ${this.provider.name}:`, {
          to: data.to,
          subject: data.subject,
          messageId: result.messageId,
          trackingId: data.trackingId,
          templateName: data.templateName,
        });
      } else {
        console.error(`❌ Email failed via ${this.provider.name}:`, {
          to: data.to,
          subject: data.subject,
          error: result.error,
          trackingId: data.trackingId,
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Email service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown email service error',
        providerId: this.provider.name,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async verifyConfiguration(): Promise<boolean> {
    return this.provider.verifyConfiguration();
  }

  async getHealthStatus(): Promise<any> {
    return this.provider.getHealthStatus();
  }

  getProviderName(): string {
    return this.provider.name;
  }

  getConfig(): EmailConfig {
    return { ...this.config };
  }

  // Reload configuration and recreate provider
  async reloadProvider(): Promise<void> {
    console.log('🔄 Reloading email provider configuration...');
    this.config = this.loadConfig();
    this.provider = this.factory.createProvider(this.config);
    await this.verifyProviderHealth();
  }

  // Get detailed provider information
  getProviderInfo(): any {
    return {
      name: this.provider.name,
      config: {
        provider: this.config.EMAIL_PROVIDER,
        fromEmail: this.config.EMAIL_FROM,
        fromName: this.config.EMAIL_FROM_NAME,
        hasApiKey: this.getApiKeyStatus(),
      },
      availableProviders: this.factory.getProviderNames(),
    };
  }

  private getApiKeyStatus(): { [key: string]: boolean } {
    return {
      sendgrid: !!this.config.SENDGRID_API_KEY,
      postmark: !!this.config.POSTMARK_API_KEY,
      ses: !!(this.config.AWS_ACCESS_KEY_ID && this.config.AWS_SECRET_ACCESS_KEY),
    };
  }
}

// Singleton instance for global use
let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

// Reset singleton (useful for testing)
export function resetEmailService(): void {
  emailServiceInstance = null;
}

export default EmailService;