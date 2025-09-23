import { z } from "npm:zod";

// Environment configuration
const EmailConfig = z.object({
  EMAIL_PROVIDER: z.enum(["sendgrid", "ses", "smtp", "console"]).default("console"),
  EMAIL_FROM: z.string().default("noreply@pitchey.com"),
  EMAIL_FROM_NAME: z.string().default("Pitchey"),
  EMAIL_REPLY_TO: z.string().optional(),
  
  // SendGrid
  SENDGRID_API_KEY: z.string().optional(),
  
  // AWS SES
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  
  // SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.boolean().default(true),
});

export type EmailConfig = z.infer<typeof EmailConfig>;

// Email interfaces
export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  cid?: string; // Content-ID for inline images
}

export interface EmailData {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  trackingId?: string;
  unsubscribeUrl?: string;
  listUnsubscribe?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerId?: string;
}

export interface EmailProvider {
  name: string;
  sendEmail(data: EmailData): Promise<EmailResult>;
  verifyConfiguration(): Promise<boolean>;
}

// Console Provider (for development)
class ConsoleProvider implements EmailProvider {
  name = "console";

  async sendEmail(data: EmailData): Promise<EmailResult> {
    try {
      console.log("\n=== EMAIL SENT (CONSOLE MODE) ===");
      console.log(`From: ${Deno.env.get("EMAIL_FROM_NAME") || "Pitchey"} <${Deno.env.get("EMAIL_FROM") || "noreply@pitchey.com"}>`);
      console.log(`To: ${Array.isArray(data.to) ? data.to.join(", ") : data.to}`);
      if (data.cc) console.log(`CC: ${Array.isArray(data.cc) ? data.cc.join(", ") : data.cc}`);
      if (data.bcc) console.log(`BCC: ${Array.isArray(data.bcc) ? data.bcc.join(", ") : data.bcc}`);
      if (data.replyTo) console.log(`Reply-To: ${data.replyTo}`);
      console.log(`Subject: ${data.subject}`);
      console.log(`Tracking ID: ${data.trackingId || "none"}`);
      console.log("--- Text Content ---");
      console.log(data.text || "No text content");
      console.log("--- HTML Content (truncated) ---");
      console.log(data.html.substring(0, 500) + (data.html.length > 500 ? "..." : ""));
      if (data.attachments?.length) {
        console.log("--- Attachments ---");
        data.attachments.forEach(att => console.log(`- ${att.filename} (${att.contentType || "unknown type"})`));
      }
      if (data.unsubscribeUrl) console.log(`Unsubscribe: ${data.unsubscribeUrl}`);
      console.log("=====================================\n");

      // Generate mock message ID
      const messageId = `console-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@pitchey.com`;
      
      return {
        success: true,
        messageId,
        providerId: "console",
      };
    } catch (error) {
      console.error("Console email error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown console email error",
        providerId: "console",
      };
    }
  }

  async verifyConfiguration(): Promise<boolean> {
    return true; // Console provider is always available
  }
}

// SendGrid Provider
class SendGridProvider implements EmailProvider {
  name = "sendgrid";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendEmail(data: EmailData): Promise<EmailResult> {
    try {
      // In production, use @sendgrid/mail
      const sgMail = await import("@sendgrid/mail").catch(() => null);
      
      if (!sgMail) {
        throw new Error("SendGrid package not installed");
      }

      sgMail.setApiKey(this.apiKey);

      const msg = {
        to: Array.isArray(data.to) ? data.to : [data.to],
        cc: data.cc,
        bcc: data.bcc,
        from: {
          email: Deno.env.get("EMAIL_FROM") || "noreply@pitchey.com",
          name: Deno.env.get("EMAIL_FROM_NAME") || "Pitchey",
        },
        replyTo: data.replyTo,
        subject: data.subject,
        html: data.html,
        text: data.text,
        attachments: data.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          type: att.contentType,
          contentId: att.cid,
        })),
        customArgs: data.trackingId ? { trackingId: data.trackingId } : undefined,
        asm: data.unsubscribeUrl ? {
          groupId: 1, // Configure unsubscribe group in SendGrid
        } : undefined,
      };

      const response = await sgMail.send(msg);
      
      return {
        success: true,
        messageId: response[0]?.headers?.["x-message-id"] as string,
        providerId: "sendgrid",
      };
    } catch (error) {
      console.error("SendGrid error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown SendGrid error",
        providerId: "sendgrid",
      };
    }
  }

  async verifyConfiguration(): Promise<boolean> {
    try {
      const sgMail = await import("@sendgrid/mail").catch(() => null);
      if (!sgMail) return false;
      
      sgMail.setApiKey(this.apiKey);
      // SendGrid doesn't have a simple verification endpoint
      // In production, you could send a test email or check API status
      return true;
    } catch {
      return false;
    }
  }
}

// AWS SES Provider  
class SESProvider implements EmailProvider {
  name = "ses";
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;

  constructor(region: string, accessKeyId: string, secretAccessKey: string) {
    this.region = region;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
  }

  async sendEmail(data: EmailData): Promise<EmailResult> {
    try {
      // In production, use AWS SDK
      const AWS = await import("aws-sdk").catch(() => null);
      
      if (!AWS) {
        throw new Error("AWS SDK not installed");
      }

      const ses = new AWS.SES({
        region: this.region,
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      });

      const params = {
        Source: `${Deno.env.get("EMAIL_FROM_NAME") || "Pitchey"} <${Deno.env.get("EMAIL_FROM") || "noreply@pitchey.com"}>`,
        Destination: {
          ToAddresses: Array.isArray(data.to) ? data.to : [data.to],
          CcAddresses: data.cc ? (Array.isArray(data.cc) ? data.cc : [data.cc]) : undefined,
          BccAddresses: data.bcc ? (Array.isArray(data.bcc) ? data.bcc : [data.bcc]) : undefined,
        },
        Message: {
          Subject: { Data: data.subject },
          Body: {
            Html: { Data: data.html },
            Text: data.text ? { Data: data.text } : undefined,
          },
        },
        ReplyToAddresses: data.replyTo ? [data.replyTo] : undefined,
        Tags: data.trackingId ? [
          {
            Name: "trackingId",
            Value: data.trackingId,
          },
        ] : undefined,
      };

      const result = await ses.sendEmail(params).promise();
      
      return {
        success: true,
        messageId: result.MessageId,
        providerId: "ses",
      };
    } catch (error) {
      console.error("SES error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown SES error",
        providerId: "ses",
      };
    }
  }

  async verifyConfiguration(): Promise<boolean> {
    try {
      const AWS = await import("aws-sdk").catch(() => null);
      if (!AWS) return false;
      
      const ses = new AWS.SES({
        region: this.region,
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      });

      await ses.getSendQuota().promise();
      return true;
    } catch {
      return false;
    }
  }
}

// SMTP Provider
class SMTPProvider implements EmailProvider {
  name = "smtp";
  private config: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };

  constructor(host: string, port: number, user: string, pass: string, secure = true) {
    this.config = {
      host,
      port,
      secure,
      auth: { user, pass },
    };
  }

  async sendEmail(data: EmailData): Promise<EmailResult> {
    try {
      // Mock SMTP sending for now - in production use nodemailer
      console.log("=== SMTP EMAIL (MOCK) ===");
      console.log(`Host: ${this.config.host}:${this.config.port}`);
      console.log(`To: ${Array.isArray(data.to) ? data.to.join(", ") : data.to}`);
      console.log(`Subject: ${data.subject}`);
      console.log(`Body: ${data.text || data.html.substring(0, 200)}...`);
      console.log("========================");

      // Generate mock message ID
      const messageId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@pitchey.com`;
      
      return {
        success: true,
        messageId,
        providerId: "smtp",
      };
    } catch (error) {
      console.error("SMTP error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown SMTP error",
        providerId: "smtp",
      };
    }
  }

  async verifyConfiguration(): Promise<boolean> {
    try {
      // Mock verification - in production, test SMTP connection
      return true;
    } catch {
      return false;
    }
  }
}

// Email Service
export class EmailService {
  private provider: EmailProvider;
  private config: EmailConfig;

  constructor() {
    this.config = EmailConfig.parse({
      EMAIL_PROVIDER: Deno.env.get("EMAIL_PROVIDER"),
      EMAIL_FROM: Deno.env.get("EMAIL_FROM"),
      EMAIL_FROM_NAME: Deno.env.get("EMAIL_FROM_NAME"),
      EMAIL_REPLY_TO: Deno.env.get("EMAIL_REPLY_TO"),
      SENDGRID_API_KEY: Deno.env.get("SENDGRID_API_KEY"),
      AWS_REGION: Deno.env.get("AWS_REGION"),
      AWS_ACCESS_KEY_ID: Deno.env.get("AWS_ACCESS_KEY_ID"),
      AWS_SECRET_ACCESS_KEY: Deno.env.get("AWS_SECRET_ACCESS_KEY"),
      SMTP_HOST: Deno.env.get("SMTP_HOST"),
      SMTP_PORT: Deno.env.get("SMTP_PORT") ? parseInt(Deno.env.get("SMTP_PORT")!) : undefined,
      SMTP_USER: Deno.env.get("SMTP_USER"),
      SMTP_PASS: Deno.env.get("SMTP_PASS"),
      SMTP_SECURE: Deno.env.get("SMTP_SECURE") === "true",
    });

    this.provider = this.createProvider();
  }

  private createProvider(): EmailProvider {
    switch (this.config.EMAIL_PROVIDER) {
      case "console":
        return new ConsoleProvider();

      case "sendgrid":
        if (!this.config.SENDGRID_API_KEY) {
          console.warn("SENDGRID_API_KEY not found, falling back to console provider");
          return new ConsoleProvider();
        }
        return new SendGridProvider(this.config.SENDGRID_API_KEY);

      case "ses":
        if (!this.config.AWS_REGION || !this.config.AWS_ACCESS_KEY_ID || !this.config.AWS_SECRET_ACCESS_KEY) {
          console.warn("AWS credentials not found, falling back to console provider");
          return new ConsoleProvider();
        }
        return new SESProvider(
          this.config.AWS_REGION,
          this.config.AWS_ACCESS_KEY_ID,
          this.config.AWS_SECRET_ACCESS_KEY
        );

      case "smtp":
        if (!this.config.SMTP_HOST || !this.config.SMTP_PORT || !this.config.SMTP_USER || !this.config.SMTP_PASS) {
          console.warn("SMTP configuration not found, falling back to console provider");
          return new ConsoleProvider();
        }
        return new SMTPProvider(
          this.config.SMTP_HOST,
          this.config.SMTP_PORT,
          this.config.SMTP_USER,
          this.config.SMTP_PASS,
          this.config.SMTP_SECURE
        );

      default:
        console.warn(`Unsupported email provider: ${this.config.EMAIL_PROVIDER}, falling back to console provider`);
        return new ConsoleProvider();
    }
  }

  async sendEmail(data: EmailData): Promise<EmailResult> {
    // Add default from address if not specified
    const emailData = {
      ...data,
      headers: {
        "X-Mailer": "Pitchey Email Service",
        ...data.headers,
      },
    };

    try {
      const result = await this.provider.sendEmail(emailData);
      
      // Log email activity
      console.log(`Email sent via ${this.provider.name}:`, {
        to: data.to,
        subject: data.subject,
        success: result.success,
        messageId: result.messageId,
        trackingId: data.trackingId,
      });

      return result;
    } catch (error) {
      console.error("Email service error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown email service error",
      };
    }
  }

  async verifyConfiguration(): Promise<boolean> {
    return this.provider.verifyConfiguration();
  }

  getProviderName(): string {
    return this.provider.name;
  }

  getConfig(): EmailConfig {
    return { ...this.config };
  }
}

// Singleton instance
let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

export default EmailService;