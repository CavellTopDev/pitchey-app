// Legacy Email Service Bridge
// This file provides backward compatibility for existing code
// All new development should use: import { getEmailService, sendWelcomeEmail, etc. } from './email/index.ts';

import { getEmailService } from './email/index.ts';
import type { EmailConfig, EmailData, EmailResult, EmailAttachment } from './email/interface.ts';

// Re-export types for backward compatibility
export type { EmailConfig, EmailData, EmailResult, EmailAttachment };

// Legacy EmailService class for backward compatibility
export class EmailService {
  private service = getEmailService();

  async sendEmail(data: EmailData): Promise<EmailResult> {
    return this.service.sendEmail(data);
  }

  async verifyConfiguration(): Promise<boolean> {
    return this.service.verifyConfiguration();
  }

  getProviderName(): string {
    return this.service.getProviderName();
  }

  getConfig(): EmailConfig {
    return this.service.getConfig();
  }

  async getHealthStatus(): Promise<any> {
    return this.service.getHealthStatus();
  }

  getProviderInfo(): any {
    return this.service.getProviderInfo();
  }
}

// Legacy singleton for backward compatibility
let emailServiceInstance: EmailService | null = null;

export function getEmailService_Legacy(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

// Export the new service as default but keep legacy compatibility
export { getEmailService } from './email/index.ts';
export default EmailService;