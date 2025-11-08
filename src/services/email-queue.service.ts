import { db } from "../db/client.ts";
import { emailQueue, emailPreferences, emailEvents, emailSuppression, unsubscribeTokens } from "../db/schema.ts";
import { eq, and, gte, lt, lte, isNull, inArray, desc, asc, sql, or } from "npm:drizzle-orm@0.35.3";
import { getEmailService, EmailData, EmailResult } from "./email.service.ts";
import { EmailTemplates } from "./email-templates.service.ts";

export interface QueueEmailData {
  userId?: number;
  toEmail: string;
  ccEmails?: string[];
  bccEmails?: string[];
  subject: string;
  emailType: string;
  templateData?: any;
  priority?: number;
  scheduledFor?: Date;
  maxAttempts?: number;
}

export interface EmailQueueStats {
  pending: number;
  sent: number;
  failed: number;
  total: number;
}

export class EmailQueueService {
  private emailService = getEmailService();

  // Add email to queue
  async queueEmail(data: QueueEmailData): Promise<number> {
    // Check if email is suppressed
    if (await this.isEmailSuppressed(data.toEmail)) {
      console.log(`Email ${data.toEmail} is suppressed, skipping queue`);
      return -1;
    }

    // Check if user has unsubscribed from this email type
    if (data.userId && await this.isUnsubscribed(data.userId, data.emailType)) {
      console.log(`User ${data.userId} has unsubscribed from ${data.emailType}, skipping queue`);
      return -1;
    }

    // Generate email content using templates
    const { html, text } = await this.generateEmailContent(data.emailType, data.templateData || {});

    const [queueItem] = await db.insert(emailQueue).values({
      userId: data.userId,
      toEmail: data.toEmail,
      ccEmails: data.ccEmails?.join(','),
      bccEmails: data.bccEmails?.join(','),
      subject: data.subject,
      htmlContent: html,
      textContent: text,
      emailType: data.emailType,
      templateData: data.templateData,
      priority: data.priority || 5,
      scheduledFor: data.scheduledFor,
      maxAttempts: data.maxAttempts || 3,
    }).returning({ id: emailQueue.id });

    console.log(`Email queued with ID: ${queueItem.id}`);
    return queueItem.id;
  }

  // Process pending emails
  async processPendingEmails(batchSize = 10): Promise<void> {
    const now = new Date();
    
    // Get pending emails that are ready to send
    const pendingEmails = await db
      .select()
      .from(emailQueue)
      .where(
        and(
          eq(emailQueue.status, "pending"),
          lt(emailQueue.attempts, emailQueue.maxAttempts),
          // Either no scheduled time or scheduled time has passed
          or(
            isNull(emailQueue.scheduledFor),
            lte(emailQueue.scheduledFor, sql`NOW()`)
          )
        )
      )
      .orderBy(asc(emailQueue.priority), asc(emailQueue.createdAt))
      .limit(batchSize);

    console.log(`Processing ${pendingEmails.length} pending emails`);

    for (const email of pendingEmails) {
      await this.sendQueuedEmail(email);
    }
  }

  // Send a specific queued email
  private async sendQueuedEmail(email: any): Promise<void> {
    try {
      // Update attempt count
      await db
        .update(emailQueue)
        .set({
          attempts: email.attempts + 1,
          lastAttemptAt: new Date(),
        })
        .where(eq(emailQueue.id, email.id));

      // Check if email is still valid
      if (await this.isEmailSuppressed(email.toEmail)) {
        await this.markEmailAsSuppressed(email.id, "Email suppressed");
        return;
      }

      // Generate unsubscribe URL
      const unsubscribeUrl = await this.generateUnsubscribeUrl(email.userId, email.emailType);

      // Prepare email data
      const emailData: EmailData = {
        to: email.toEmail,
        cc: email.ccEmails ? email.ccEmails.split(',') : undefined,
        bcc: email.bccEmails ? email.bccEmails.split(',') : undefined,
        subject: email.subject,
        html: this.addUnsubscribeToHtml(email.htmlContent, unsubscribeUrl),
        text: this.addUnsubscribeToText(email.textContent, unsubscribeUrl),
        trackingId: `queue_${email.id}`,
        unsubscribeUrl,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };

      // Send email
      const result: EmailResult = await this.emailService.sendEmail(emailData);

      if (result.success) {
        // Mark as sent
        await db
          .update(emailQueue)
          .set({
            status: "sent",
            sentAt: new Date(),
            providerId: result.providerId,
            providerMessageId: result.messageId,
          })
          .where(eq(emailQueue.id, email.id));

        // Log sent event
        await this.logEmailEvent(email.id, "sent", { messageId: result.messageId });

        console.log(`Email ${email.id} sent successfully`);
      } else {
        // Check if we've reached max attempts
        if (email.attempts + 1 >= email.maxAttempts) {
          await db
            .update(emailQueue)
            .set({
              status: "failed",
              errorMessage: result.error,
            })
            .where(eq(emailQueue.id, email.id));

          console.error(`Email ${email.id} failed permanently: ${result.error}`);
        } else {
          await db
            .update(emailQueue)
            .set({
              errorMessage: result.error,
            })
            .where(eq(emailQueue.id, email.id));

          console.warn(`Email ${email.id} failed attempt ${email.attempts + 1}: ${result.error}`);
        }

        // Log failed event
        await this.logEmailEvent(email.id, "failed", { error: result.error });
      }
    } catch (error) {
      console.error(`Error processing email ${email.id}:`, error);
      
      // Mark as failed if max attempts reached
      if (email.attempts + 1 >= email.maxAttempts) {
        await db
          .update(emailQueue)
          .set({
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          })
          .where(eq(emailQueue.id, email.id));
      }
    }
  }

  // Generate email content using templates
  private async generateEmailContent(emailType: string, templateData: any): Promise<{ html: string; text: string }> {
    switch (emailType) {
      case "welcome":
        return EmailTemplates.welcome(templateData);
      case "nda_request":
        return EmailTemplates.ndaRequest(templateData);
      case "nda_response":
        return EmailTemplates.ndaResponse(templateData);
      case "message":
        return EmailTemplates.message(templateData);
      case "password_reset":
        return EmailTemplates.passwordReset(templateData);
      case "payment_confirmation":
        return EmailTemplates.paymentConfirmation(templateData);
      case "weekly_digest":
        return EmailTemplates.weeklyDigest(templateData);
      case "pitch_view":
        return EmailTemplates.pitchView(templateData);
      default:
        throw new Error(`Unknown email type: ${emailType}`);
    }
  }

  // Generate unsubscribe URL
  private async generateUnsubscribeUrl(userId?: number, emailType?: string): Promise<string> {
    if (!userId) {
      return `${Deno.env.get("BASE_URL") || "https://pitchey.com"}/unsubscribe`;
    }

    // Create unsubscribe token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await db.insert(unsubscribeTokens).values({
      userId,
      token,
      emailType,
      expiresAt,
    });

    return `${Deno.env.get("BASE_URL") || "https://pitchey.com"}/unsubscribe/${token}`;
  }

  // Add unsubscribe link to HTML email
  private addUnsubscribeToHtml(html: string, unsubscribeUrl: string): string {
    return html.replace(
      /(<div class="unsubscribe"[^>]*>[\s\S]*?<\/div>)/i,
      `<div class="unsubscribe">
        <a href="${unsubscribeUrl}">Unsubscribe from these emails</a>
      </div>`
    );
  }

  // Add unsubscribe link to text email
  private addUnsubscribeToText(text: string | null, unsubscribeUrl: string): string {
    if (!text) return `\n\nUnsubscribe: ${unsubscribeUrl}`;
    
    return text.replace(
      /Unsubscribe:.*$/m,
      `Unsubscribe: ${unsubscribeUrl}`
    );
  }

  // Check if email is suppressed
  private async isEmailSuppressed(email: string): Promise<boolean> {
    const suppressed = await db
      .select()
      .from(emailSuppression)
      .where(eq(emailSuppression.email, email))
      .limit(1);

    return suppressed.length > 0;
  }

  // Check if user has unsubscribed
  private async isUnsubscribed(userId: number, emailType: string): Promise<boolean> {
    // Check general email preferences
    const prefs = await db
      .select()
      .from(emailPreferences)
      .where(eq(emailPreferences.userId, userId))
      .limit(1);

    if (prefs.length === 0) {
      // No preferences set, assume they want emails
      return false;
    }

    const pref = prefs[0];

    // Check if emails are globally disabled
    if (!pref.emailEnabled) {
      return true;
    }

    // Check specific email type preferences
    switch (emailType) {
      case "welcome":
        return !pref.welcomeEmails;
      case "nda_request":
      case "nda_response":
        return !pref.ndaRequests || !pref.ndaResponses;
      case "message":
        return pref.messageNotifications === "never";
      case "pitch_view":
        return !pref.pitchViewNotifications;
      case "payment_confirmation":
        return !pref.paymentConfirmations;
      case "weekly_digest":
        return !pref.weeklyDigest;
      case "password_reset":
        return !pref.securityAlerts;
      default:
        return false;
    }
  }

  // Mark email as suppressed
  private async markEmailAsSuppressed(emailId: number, reason: string): Promise<void> {
    await db
      .update(emailQueue)
      .set({
        status: "unsubscribed",
        errorMessage: reason,
      })
      .where(eq(emailQueue.id, emailId));
  }

  // Log email event
  private async logEmailEvent(emailQueueId: number, eventType: string, eventData?: any): Promise<void> {
    await db.insert(emailEvents).values({
      emailQueueId,
      eventType,
      eventData,
    });
  }

  // Get queue statistics
  async getQueueStats(): Promise<EmailQueueStats> {
    const stats = await db
      .select({
        status: emailQueue.status,
        count: db.$count(emailQueue.id),
      })
      .from(emailQueue)
      .groupBy(emailQueue.status);

    const result: EmailQueueStats = {
      pending: 0,
      sent: 0,
      failed: 0,
      total: 0,
    };

    for (const stat of stats) {
      switch (stat.status) {
        case "pending":
          result.pending = stat.count;
          break;
        case "sent":
        case "delivered":
          result.sent += stat.count;
          break;
        case "failed":
        case "bounced":
          result.failed += stat.count;
          break;
      }
      result.total += stat.count;
    }

    return result;
  }

  // Retry failed emails
  async retryFailedEmails(olderThan: Date, maxAttempts = 3): Promise<number> {
    const failedEmails = await db
      .select()
      .from(emailQueue)
      .where(
        and(
          inArray(emailQueue.status, ["failed", "pending"]),
          lt(emailQueue.attempts, maxAttempts),
          lt(emailQueue.createdAt, olderThan)
        )
      );

    // Reset failed emails to pending
    await db
      .update(emailQueue)
      .set({
        status: "pending",
        errorMessage: null,
      })
      .where(
        and(
          inArray(emailQueue.status, ["failed"]),
          lt(emailQueue.attempts, maxAttempts),
          lt(emailQueue.createdAt, olderThan)
        )
      );

    console.log(`Reset ${failedEmails.length} failed emails to pending`);
    return failedEmails.length;
  }

  // Clean old emails
  async cleanOldEmails(olderThan: Date): Promise<number> {
    const result = await db
      .delete(emailQueue)
      .where(
        and(
          inArray(emailQueue.status, ["sent", "delivered", "failed"]),
          lt(emailQueue.createdAt, olderThan)
        )
      );

    console.log(`Cleaned ${result.rowCount || 0} old emails`);
    return result.rowCount || 0;
  }

  // Handle email webhooks (bounces, complaints, etc.)
  async handleEmailWebhook(eventType: string, data: any): Promise<void> {
    const messageId = data.messageId || data.providerMessageId;
    
    if (!messageId) {
      console.warn("Webhook received without message ID");
      return;
    }

    // Find the queued email
    const queuedEmails = await db
      .select()
      .from(emailQueue)
      .where(eq(emailQueue.providerMessageId, messageId))
      .limit(1);

    if (queuedEmails.length === 0) {
      console.warn(`No queued email found for message ID: ${messageId}`);
      return;
    }

    const queuedEmail = queuedEmails[0];

    // Log the event
    await this.logEmailEvent(queuedEmail.id, eventType, data);

    // Handle specific event types
    switch (eventType) {
      case "delivered":
        await db
          .update(emailQueue)
          .set({
            status: "delivered",
            deliveredAt: new Date(),
          })
          .where(eq(emailQueue.id, queuedEmail.id));
        break;

      case "bounced":
        await db
          .update(emailQueue)
          .set({
            status: "bounced",
            errorMessage: data.reason || "Email bounced",
          })
          .where(eq(emailQueue.id, queuedEmail.id));

        // Add to suppression list for hard bounces
        if (data.bounceType === "Permanent") {
          await this.addToSuppressionList(
            queuedEmail.toEmail,
            "bounce",
            data.reason,
            "hard"
          );
        }
        break;

      case "complained":
        await this.addToSuppressionList(
          queuedEmail.toEmail,
          "complaint",
          data.reason
        );
        break;

      case "unsubscribed":
        await this.addToSuppressionList(
          queuedEmail.toEmail,
          "unsubscribe",
          "User unsubscribed via email client"
        );
        break;
    }
  }

  // Add email to suppression list
  private async addToSuppressionList(
    email: string,
    type: string,
    reason?: string,
    bounceType?: string
  ): Promise<void> {
    try {
      await db.insert(emailSuppression).values({
        email,
        suppressionType: type,
        reason,
        bounceType,
      });
      console.log(`Added ${email} to suppression list: ${type}`);
    } catch (error) {
      // Email might already be in suppression list
      console.log(`Email ${email} already in suppression list`);
    }
  }
}

// Create singleton instance
let emailQueueServiceInstance: EmailQueueService | null = null;

export function getEmailQueueService(): EmailQueueService {
  if (!emailQueueServiceInstance) {
    emailQueueServiceInstance = new EmailQueueService();
  }
  return emailQueueServiceInstance;
}

// Helper function to import 'or' operator
function or(...conditions: any[]) {
  // In production, import this from drizzle-orm
  return conditions; // Placeholder
}

export default EmailQueueService;