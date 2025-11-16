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
  WeeklyDigestEmailData,
  PitchViewEmailData,
  InvestorInviteEmailData,
  ProjectUpdateEmailData,
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

    // Handle each loops {{#each array}}...{{/each}}
    processed = processed.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, content) => {
      const arrayData = data[arrayName];
      if (!Array.isArray(arrayData)) return '';
      
      return arrayData.map((item, index) => {
        let itemContent = content;
        // Replace {{this}} with current item if it's a string
        if (typeof item === 'string') {
          itemContent = itemContent.replace(/\{\{this\}\}/g, item);
        } else if (typeof item === 'object') {
          // Replace {{property}} with item properties
          for (const [prop, value] of Object.entries(item)) {
            const regex = new RegExp(`\\{\\{${prop}\\}\\}`, 'g');
            itemContent = itemContent.replace(regex, String(value || ''));
          }
        }
        // Add index support
        itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));
        return itemContent;
      }).join('');
    });

    // Handle equality conditionals {{#if (eq var "value")}}...{{/if}}
    processed = processed.replace(/\{\{#if\s+\(eq\s+(\w+)\s+"([^"]+)"\)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, varName, value, content) => {
      return data[varName] === value ? content : '';
    });

    // Handle conditional blocks {{#if variable}}...{{/if}}
    processed = processed.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      // Support nested property access like stats.newPitches
      const value = this.getNestedValue(data, condition.trim());
      return value ? content : '';
    });

    // Handle conditional blocks {{#unless variable}}...{{/unless}}
    processed = processed.replace(/\{\{#unless\s+([^}]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (match, condition, content) => {
      const value = this.getNestedValue(data, condition.trim());
      return !value ? content : '';
    });

    // Handle else blocks {{#if variable}}...{{else}}...{{/if}}
    processed = processed.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, ifContent, elseContent) => {
      const value = this.getNestedValue(data, condition.trim());
      return value ? ifContent : elseContent;
    });

    // Simple template processing - replace {{variable}} with data values
    processed = processed.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
      const value = this.getNestedValue(data, variable.trim());
      return String(value || '');
    });

    return processed;
  }

  private getNestedValue(data: Record<string, any>, path: string): any {
    return path.split('.').reduce((obj, key) => obj?.[key], data);
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

  async buildWeeklyDigestEmail(data: WeeklyDigestEmailData): Promise<EmailData> {
    const templateData = {
      ...data,
      hasNewPitches: data.stats.newPitches > 0,
      hasActivity: data.stats.newFollowers > 0 || data.stats.messages > 0 || data.stats.views > 0,
      currentYear: new Date().getFullYear(),
    };

    const contentTemplate = await this.loadTemplate('weekly-digest');
    const baseTemplate = await this.loadBaseTemplate();
    
    const content = this.processTemplate(contentTemplate, templateData);
    const html = this.processTemplate(baseTemplate, {
      ...templateData,
      title: `Your Weekly Digest - ${data.weekRange}`,
      preheader: `${data.stats.newPitches} new pitches, ${data.stats.newFollowers} new followers`,
      content,
    });

    return {
      to: data.firstName, // This should be email
      subject: `Your Weekly Digest - ${data.weekRange}`,
      html,
      text: this.generateTextFromHtml(html),
      unsubscribeUrl: data.unsubscribeUrl,
      templateName: EMAIL_TEMPLATES.WEEKLY_DIGEST,
    };
  }

  async buildPitchViewEmail(data: PitchViewEmailData): Promise<EmailData> {
    const templateData = {
      ...data,
      currentYear: new Date().getFullYear(),
    };

    const contentTemplate = await this.loadTemplate('pitch-view-notification');
    const baseTemplate = await this.loadBaseTemplate();
    
    const content = this.processTemplate(contentTemplate, templateData);
    const html = this.processTemplate(baseTemplate, {
      ...templateData,
      title: 'Your Pitch Was Viewed!',
      preheader: `${data.viewerName} (${data.viewerType}) viewed "${data.pitchTitle}"`,
      content,
    });

    return {
      to: data.creatorName, // This should be email
      subject: `Your pitch "${data.pitchTitle}" was viewed!`,
      html,
      text: this.generateTextFromHtml(html),
      unsubscribeUrl: data.unsubscribeUrl,
      templateName: EMAIL_TEMPLATES.PITCH_VIEW,
    };
  }

  async buildInvestorInviteEmail(data: InvestorInviteEmailData): Promise<EmailData> {
    const templateData = {
      ...data,
      hasMessage: !!data.inviteMessage,
      currentYear: new Date().getFullYear(),
    };

    const contentTemplate = await this.loadTemplate('investor-invite');
    const baseTemplate = await this.loadBaseTemplate();
    
    const content = this.processTemplate(contentTemplate, templateData);
    const html = this.processTemplate(baseTemplate, {
      ...templateData,
      title: 'Investment Opportunity',
      preheader: `${data.inviterName} invites you to invest in "${data.projectTitle}"`,
      content,
    });

    return {
      to: data.recipientName, // This should be email
      subject: `Investment Opportunity: "${data.projectTitle}"`,
      html,
      text: this.generateTextFromHtml(html),
      unsubscribeUrl: data.unsubscribeUrl,
      templateName: EMAIL_TEMPLATES.INVESTOR_INVITE,
    };
  }

  async buildProjectUpdateEmail(data: ProjectUpdateEmailData): Promise<EmailData> {
    const updateTypeLabels = {
      milestone: 'Milestone Update',
      funding: 'Funding Update',
      production: 'Production Update',
      release: 'Release Update'
    };

    const templateData = {
      ...data,
      updateTypeLabel: updateTypeLabels[data.updateType],
      currentYear: new Date().getFullYear(),
    };

    const contentTemplate = await this.loadTemplate('project-update');
    const baseTemplate = await this.loadBaseTemplate();
    
    const content = this.processTemplate(contentTemplate, templateData);
    const html = this.processTemplate(baseTemplate, {
      ...templateData,
      title: `Project Update: ${data.projectTitle}`,
      preheader: `New ${updateTypeLabels[data.updateType].toLowerCase()} for "${data.projectTitle}"`,
      content,
    });

    return {
      to: data.investorName, // This should be email
      subject: `${updateTypeLabels[data.updateType]}: "${data.projectTitle}"`,
      html,
      text: this.generateTextFromHtml(html),
      unsubscribeUrl: data.unsubscribeUrl,
      templateName: EMAIL_TEMPLATES.PROJECT_UPDATE,
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