// Email Template Engine
// Processes HTML templates with data interpolation and builds complete emails

import { 
  EmailData, 
  WelcomeEmailData, 
  NDARequestEmailData, 
  NDAResponseEmailData, 
  MessageEmailData, 
  PasswordResetEmailData, 
  PaymentConfirmationEmailData,
  EMAIL_TEMPLATES 
} from './interface.ts';

export class EmailTemplateEngine {
  private templateCache: Map<string, string> = new Map();
  private baseTemplate: string | null = null;

  async loadTemplate(templateName: string): Promise<string> {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    try {
      const templatePath = `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/templates/email/${templateName}.html`;
      const template = await Deno.readTextFile(templatePath);
      this.templateCache.set(templateName, template);
      return template;
    } catch (error) {
      console.error(`Failed to load email template: ${templateName}`, error);
      throw new Error(`Email template not found: ${templateName}`);
    }
  }

  async loadBaseTemplate(): Promise<string> {
    if (this.baseTemplate) {
      return this.baseTemplate;
    }

    this.baseTemplate = await this.loadTemplate('base');
    return this.baseTemplate;
  }

  private processTemplate(template: string, data: Record<string, any>): string {
    let processed = template;

    // Simple template processing - replace {{variable}} with data values
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processed = processed.replace(regex, String(value || ''));
    }

    // Handle conditional blocks {{#if variable}}...{{/if}}
    processed = processed.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      return data[condition] ? content : '';
    });

    // Handle conditional blocks {{#unless variable}}...{{/unless}}
    processed = processed.replace(/\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (match, condition, content) => {
      return !data[condition] ? content : '';
    });

    // Clean up any remaining template syntax
    processed = processed.replace(/\{\{[^}]+\}\}/g, '');

    return processed;
  }

  private generateTextFromHtml(html: string): string {
    // Convert HTML to plain text for text version
    return html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  async buildWelcomeEmail(data: WelcomeEmailData): Promise<EmailData> {
    const userTypeLabels = {
      creator: "Creator",
      investor: "Investor", 
      production: "Production Company",
      viewer: "Viewer"
    };

    const userTypeMessages = {
      creator: "Start building your portfolio by creating your first pitch.",
      investor: "Discover amazing new projects and connect with talented creators.",
      production: "Find your next big production and manage your development pipeline.",
      viewer: "Explore the latest film and TV projects from emerging creators."
    };

    const templateData = {
      ...data,
      userTypeLabel: userTypeLabels[data.userType],
      userTypeMessage: userTypeMessages[data.userType],
      currentYear: new Date().getFullYear(),
    };

    const contentTemplate = await this.loadTemplate('welcome');
    const baseTemplate = await this.loadBaseTemplate();
    
    const content = this.processTemplate(contentTemplate, templateData);
    const html = this.processTemplate(baseTemplate, {
      ...templateData,
      title: 'Welcome to Pitchey!',
      preheader: `Get started as a ${userTypeLabels[data.userType]} on Pitchey`,
      content,
    });

    return {
      to: data.firstName, // This should be email, but using firstName for template
      subject: 'Welcome to Pitchey!',
      html,
      text: this.generateTextFromHtml(html),
      unsubscribeUrl: data.unsubscribeUrl,
      templateName: EMAIL_TEMPLATES.WELCOME,
    };
  }

  async buildNDARequestEmail(data: NDARequestEmailData): Promise<EmailData> {
    const templateData = {
      ...data,
      currentYear: new Date().getFullYear(),
    };

    const contentTemplate = await this.loadTemplate('nda-request');
    const baseTemplate = await this.loadBaseTemplate();
    
    const content = this.processTemplate(contentTemplate, templateData);
    const html = this.processTemplate(baseTemplate, {
      ...templateData,
      title: 'New NDA Request',
      preheader: `${data.senderName} wants to access your pitch "${data.pitchTitle}"`,
      content,
    });

    return {
      to: data.recipientName, // This should be email
      subject: `New NDA Request for "${data.pitchTitle}"`,
      html,
      text: this.generateTextFromHtml(html),
      unsubscribeUrl: data.unsubscribeUrl,
      templateName: EMAIL_TEMPLATES.NDA_REQUEST,
    };
  }

  async buildNDAResponseEmail(data: NDAResponseEmailData): Promise<EmailData> {
    const status = data.approved ? "Approved" : "Declined";
    const statusColor = data.approved ? "#10b981" : "#ef4444";
    const emoji = data.approved ? "✅" : "❌";

    const templateData = {
      ...data,
      status,
      statusColor,
      statusText: status.toLowerCase(),
      emoji,
      currentYear: new Date().getFullYear(),
    };

    const contentTemplate = await this.loadTemplate('nda-response');
    const baseTemplate = await this.loadBaseTemplate();
    
    const content = this.processTemplate(contentTemplate, templateData);
    const html = this.processTemplate(baseTemplate, {
      ...templateData,
      title: `NDA Request ${status}`,
      preheader: `Your NDA request for "${data.pitchTitle}" has been ${status.toLowerCase()}`,
      content,
    });

    return {
      to: data.recipientName, // This should be email
      subject: `NDA Request ${status} - "${data.pitchTitle}"`,
      html,
      text: this.generateTextFromHtml(html),
      unsubscribeUrl: data.unsubscribeUrl,
      templateName: EMAIL_TEMPLATES.NDA_RESPONSE,
    };
  }

  async buildMessageEmail(data: MessageEmailData): Promise<EmailData> {
    const messagePreview = data.messageContent.length > 200 
      ? data.messageContent.substring(0, 200) + '...' 
      : data.messageContent;

    const templateData = {
      ...data,
      messagePreview,
      currentYear: new Date().getFullYear(),
    };

    const contentTemplate = await this.loadTemplate('message-notification');
    const baseTemplate = await this.loadBaseTemplate();
    
    const content = this.processTemplate(contentTemplate, templateData);
    const title = data.pitchTitle 
      ? `New message about "${data.pitchTitle}" from ${data.senderName}`
      : `New message from ${data.senderName}`;
    
    const html = this.processTemplate(baseTemplate, {
      ...templateData,
      title,
      preheader: `New message from ${data.senderName}`,
      content,
    });

    return {
      to: data.recipientName, // This should be email
      subject: title,
      html,
      text: this.generateTextFromHtml(html),
      unsubscribeUrl: data.unsubscribeUrl,
      templateName: EMAIL_TEMPLATES.MESSAGE,
    };
  }

  async buildPasswordResetEmail(data: PasswordResetEmailData): Promise<EmailData> {
    const templateData = {
      ...data,
      currentYear: new Date().getFullYear(),
    };

    const contentTemplate = await this.loadTemplate('password-reset');
    const baseTemplate = await this.loadBaseTemplate();
    
    const content = this.processTemplate(contentTemplate, templateData);
    const html = this.processTemplate(baseTemplate, {
      ...templateData,
      title: 'Reset Your Password',
      preheader: 'Reset your Pitchey account password',
      content,
    });

    return {
      to: data.firstName, // This should be email
      subject: 'Reset Your Password - Pitchey',
      html,
      text: this.generateTextFromHtml(html),
      unsubscribeUrl: data.unsubscribeUrl,
      templateName: EMAIL_TEMPLATES.PASSWORD_RESET,
    };
  }

  async buildPaymentConfirmationEmail(data: PaymentConfirmationEmailData): Promise<EmailData> {
    const paymentTypeLabels = {
      subscription: "Subscription Payment",
      credits: "Credit Purchase", 
      success_fee: "Success Fee Payment"
    };

    const templateData = {
      ...data,
      paymentTypeLabel: paymentTypeLabels[data.paymentType],
      paymentTypeText: paymentTypeLabels[data.paymentType].toLowerCase(),
      hasDocuments: !!(data.invoiceUrl || data.receiptUrl),
      currentYear: new Date().getFullYear(),
    };

    const contentTemplate = await this.loadTemplate('payment-confirmation');
    const baseTemplate = await this.loadBaseTemplate();
    
    const content = this.processTemplate(contentTemplate, templateData);
    const html = this.processTemplate(baseTemplate, {
      ...templateData,
      title: 'Payment Confirmation',
      preheader: `Your payment of ${data.amount} ${data.currency} has been confirmed`,
      content,
    });

    return {
      to: data.firstName, // This should be email
      subject: 'Payment Confirmation - Pitchey',
      html,
      text: this.generateTextFromHtml(html),
      unsubscribeUrl: data.unsubscribeUrl,
      templateName: EMAIL_TEMPLATES.PAYMENT_CONFIRMATION,
    };
  }

  // Clear template cache (useful for development)
  clearCache(): void {
    this.templateCache.clear();
    this.baseTemplate = null;
  }
}

// Singleton instance
let templateEngineInstance: EmailTemplateEngine | null = null;

export function getEmailTemplateEngine(): EmailTemplateEngine {
  if (!templateEngineInstance) {
    templateEngineInstance = new EmailTemplateEngine();
  }
  return templateEngineInstance;
}

export default EmailTemplateEngine;