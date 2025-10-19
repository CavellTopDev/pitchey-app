// Console Email Provider for Development
// Provides formatted, readable email output for development environments

import { EmailProvider, EmailData, EmailResult } from './interface.ts';

export class ConsoleEmailProvider implements EmailProvider {
  name = 'console';

  async sendEmail(data: EmailData): Promise<EmailResult> {
    try {
      const timestamp = new Date().toISOString();
      const messageId = `console-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@pitchey.local`;
      
      // Format email for console output
      this.printEmailHeader();
      this.printEmailMetadata(data, messageId, timestamp);
      this.printEmailContent(data);
      this.printEmailFooter();
      
      return {
        success: true,
        messageId,
        providerId: 'console',
        timestamp,
      };
    } catch (error) {
      console.error('❌ Console email provider error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown console email error',
        providerId: 'console',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async verifyConfiguration(): Promise<boolean> {
    return true; // Console provider is always available
  }

  async getHealthStatus(): Promise<{ status: 'healthy' | 'degraded' | 'down'; details?: string }> {
    return { status: 'healthy', details: 'Console provider is always available' };
  }

  private printEmailHeader(): void {
    const border = '═'.repeat(80);
    console.log(`\n${border}`);
    console.log('📧 EMAIL SENT (DEVELOPMENT MODE)');
    console.log(border);
  }

  private printEmailMetadata(data: EmailData, messageId: string, timestamp: string): void {
    const fromName = Deno.env.get('EMAIL_FROM_NAME') || 'Pitchey';
    const fromEmail = Deno.env.get('EMAIL_FROM') || 'noreply@pitchey.com';
    
    console.log(`🏷️  MESSAGE ID: ${messageId}`);
    console.log(`⏰ TIMESTAMP: ${timestamp}`);
    if (data.templateName) {
      console.log(`📋 TEMPLATE: ${data.templateName}`);
    }
    if (data.trackingId) {
      console.log(`🔍 TRACKING ID: ${data.trackingId}`);
    }
    console.log('─'.repeat(80));
    
    console.log(`📤 FROM: ${fromName} <${fromEmail}>`);
    console.log(`📧 TO: ${Array.isArray(data.to) ? data.to.join(', ') : data.to}`);
    
    if (data.cc) {
      console.log(`📧 CC: ${Array.isArray(data.cc) ? data.cc.join(', ') : data.cc}`);
    }
    
    if (data.bcc) {
      console.log(`📧 BCC: ${Array.isArray(data.bcc) ? data.bcc.join(', ') : data.bcc}`);
    }
    
    if (data.replyTo) {
      console.log(`↩️  REPLY-TO: ${data.replyTo}`);
    }
    
    console.log(`📝 SUBJECT: ${data.subject}`);
    console.log('─'.repeat(80));
  }

  private printEmailContent(data: EmailData): void {
    // Print text content if available, otherwise extract from HTML
    if (data.text) {
      console.log('📄 TEXT CONTENT:');
      console.log(this.formatTextContent(data.text));
    } else {
      console.log('📄 TEXT CONTENT (extracted from HTML):');
      console.log(this.formatTextContent(this.extractTextFromHtml(data.html)));
    }
    
    console.log('─'.repeat(80));
    
    // Print HTML preview (truncated)
    console.log('🌐 HTML CONTENT (preview):');
    const htmlPreview = this.formatHtmlPreview(data.html);
    console.log(htmlPreview);
    
    if (data.attachments && data.attachments.length > 0) {
      console.log('─'.repeat(80));
      console.log('📎 ATTACHMENTS:');
      data.attachments.forEach((att, index) => {
        const size = typeof att.content === 'string' 
          ? `${att.content.length} chars`
          : `${att.content.length} bytes`;
        console.log(`   ${index + 1}. ${att.filename} (${att.contentType || 'unknown type'}) - ${size}`);
      });
    }
    
    if (data.unsubscribeUrl) {
      console.log('─'.repeat(80));
      console.log(`🚫 UNSUBSCRIBE: ${data.unsubscribeUrl}`);
    }
    
    if (data.headers && Object.keys(data.headers).length > 0) {
      console.log('─'.repeat(80));
      console.log('📋 HEADERS:');
      Object.entries(data.headers).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }
  }

  private printEmailFooter(): void {
    const border = '═'.repeat(80);
    console.log(border);
    console.log('✅ Email logged successfully (development mode)');
    console.log('💡 To send real emails, set EMAIL_PROVIDER to sendgrid, postmark, or ses');
    console.log(`${border}\n`);
  }

  private formatTextContent(text: string): string {
    // Add indentation for better readability
    return text
      .split('\n')
      .map(line => `   ${line}`)
      .join('\n');
  }

  private extractTextFromHtml(html: string): string {
    // Simple HTML to text conversion for development purposes
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

  private formatHtmlPreview(html: string): string {
    const maxLength = 500;
    let preview = html;
    
    // Clean up whitespace and format for display
    preview = preview
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();
    
    if (preview.length > maxLength) {
      preview = preview.substring(0, maxLength) + '...';
    }
    
    // Add indentation
    return preview
      .split('><')
      .map((line, index) => {
        if (index === 0) return `   ${line}${line.includes('<') ? '>' : ''}`;
        if (index === preview.split('><').length - 1) return `   <${line}`;
        return `   <${line}>`;
      })
      .join('\n');
  }
}

export default ConsoleEmailProvider;