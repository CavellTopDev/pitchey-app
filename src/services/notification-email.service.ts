import { db } from "../db/client.ts";
import { users, emailPreferences, pitches } from "../db/schema.ts";
import { eq, and } from "npm:drizzle-orm@0.35.3";
import { getEmailQueueService } from "./email-queue.service.ts";

export interface WelcomeEmailOptions {
  userId: number;
  userType: "creator" | "investor" | "production" | "viewer";
}

export interface NDARequestEmailOptions {
  requesterId: number;
  ownerId: number;
  pitchId: number;
  requestMessage?: string;
}

export interface NDAResponseEmailOptions {
  requesterId: number;
  ownerId: number;
  pitchId: number;
  approved: boolean;
  reason?: string;
}

export interface MessageEmailOptions {
  senderId: number;
  receiverId: number;
  messageContent: string;
  pitchId?: number;
}

export interface PasswordResetEmailOptions {
  userId: number;
  resetToken: string;
  expiresIn: string;
}

export interface PaymentConfirmationEmailOptions {
  userId: number;
  paymentType: "subscription" | "credits" | "success_fee";
  amount: string;
  currency: string;
  description: string;
  invoiceUrl?: string;
  receiptUrl?: string;
}

export interface PitchViewEmailOptions {
  creatorId: number;
  viewerId: number;
  pitchId: number;
}

export class NotificationEmailService {
  private emailQueue = getEmailQueueService();

  // Send welcome email
  async sendWelcomeEmail(options: WelcomeEmailOptions): Promise<void> {
    const user = await this.getUser(options.userId);
    if (!user || !await this.shouldSendEmail(options.userId, "welcome")) {
      return;
    }

    const baseUrl = Deno.env.get("BASE_URL") || "https://pitchey.com";
    const unsubscribeUrl = await this.generateUnsubscribeUrl(options.userId, "welcome");

    await this.emailQueue.queueEmail({
      userId: options.userId,
      toEmail: user.email,
      subject: "Welcome to Pitchey!",
      emailType: "welcome",
      priority: 2, // High priority for welcome emails
      templateData: {
        firstName: user.firstName || user.username,
        userType: options.userType,
        dashboardUrl: `${baseUrl}/dashboard`,
        profileSetupUrl: `${baseUrl}/profile/setup`,
        unsubscribeUrl,
      },
    });
  }

  // Send NDA request notification
  async sendNDARequestEmail(options: NDARequestEmailOptions): Promise<void> {
    const [requester, owner, pitch] = await Promise.all([
      this.getUser(options.requesterId),
      this.getUser(options.ownerId),
      this.getPitch(options.pitchId),
    ]);

    if (!requester || !owner || !pitch || !await this.shouldSendEmail(options.ownerId, "nda_request")) {
      return;
    }

    const baseUrl = Deno.env.get("BASE_URL") || "https://pitchey.com";
    const unsubscribeUrl = await this.generateUnsubscribeUrl(options.ownerId, "nda_request");

    await this.emailQueue.queueEmail({
      userId: options.ownerId,
      toEmail: owner.email,
      subject: `NDA Request for "${pitch.title}" from ${requester.firstName || requester.username}`,
      emailType: "nda_request",
      priority: 3,
      templateData: {
        recipientName: owner.firstName || owner.username,
        senderName: requester.firstName || requester.username,
        pitchTitle: pitch.title,
        requestMessage: options.requestMessage,
        actionUrl: `${baseUrl}/nda-requests`,
        unsubscribeUrl,
      },
    });
  }

  // Send NDA response notification
  async sendNDAResponseEmail(options: NDAResponseEmailOptions): Promise<void> {
    const [requester, owner, pitch] = await Promise.all([
      this.getUser(options.requesterId),
      this.getUser(options.ownerId),
      this.getPitch(options.pitchId),
    ]);

    if (!requester || !owner || !pitch || !await this.shouldSendEmail(options.requesterId, "nda_response")) {
      return;
    }

    const baseUrl = Deno.env.get("BASE_URL") || "https://pitchey.com";
    const unsubscribeUrl = await this.generateUnsubscribeUrl(options.requesterId, "nda_response");
    const actionUrl = options.approved 
      ? `${baseUrl}/pitches/${options.pitchId}`
      : `${baseUrl}/browse`;

    await this.emailQueue.queueEmail({
      userId: options.requesterId,
      toEmail: requester.email,
      subject: `NDA Request ${options.approved ? "Approved" : "Declined"} for "${pitch.title}"`,
      emailType: "nda_response",
      priority: 3,
      templateData: {
        recipientName: requester.firstName || requester.username,
        senderName: owner.firstName || owner.username,
        pitchTitle: pitch.title,
        approved: options.approved,
        reason: options.reason,
        actionUrl,
        unsubscribeUrl,
      },
    });
  }

  // Send message notification
  async sendMessageEmail(options: MessageEmailOptions): Promise<void> {
    const [sender, receiver, pitch] = await Promise.all([
      this.getUser(options.senderId),
      this.getUser(options.receiverId),
      options.pitchId ? this.getPitch(options.pitchId) : null,
    ]);

    if (!sender || !receiver || !await this.shouldSendMessageEmail(options.receiverId)) {
      return;
    }

    const baseUrl = Deno.env.get("BASE_URL") || "https://pitchey.com";
    const unsubscribeUrl = await this.generateUnsubscribeUrl(options.receiverId, "message");

    const subject = pitch 
      ? `New message about "${pitch.title}" from ${sender.firstName || sender.username}`
      : `New message from ${sender.firstName || sender.username}`;

    await this.emailQueue.queueEmail({
      userId: options.receiverId,
      toEmail: receiver.email,
      subject,
      emailType: "message",
      priority: 4,
      templateData: {
        recipientName: receiver.firstName || receiver.username,
        senderName: sender.firstName || sender.username,
        messageContent: options.messageContent,
        pitchTitle: pitch?.title,
        conversationUrl: `${baseUrl}/messages`,
        unsubscribeUrl,
      },
    });
  }

  // Send password reset email
  async sendPasswordResetEmail(options: PasswordResetEmailOptions): Promise<void> {
    const user = await this.getUser(options.userId);
    if (!user || !await this.shouldSendEmail(options.userId, "password_reset")) {
      return;
    }

    const baseUrl = Deno.env.get("BASE_URL") || "https://pitchey.com";
    const unsubscribeUrl = await this.generateUnsubscribeUrl(options.userId, "password_reset");

    await this.emailQueue.queueEmail({
      userId: options.userId,
      toEmail: user.email,
      subject: "Reset Your Pitchey Password",
      emailType: "password_reset",
      priority: 1, // Highest priority for security emails
      templateData: {
        firstName: user.firstName || user.username,
        resetUrl: `${baseUrl}/reset-password/${options.resetToken}`,
        expiresIn: options.expiresIn,
        unsubscribeUrl,
      },
    });
  }

  // Send payment confirmation email
  async sendPaymentConfirmationEmail(options: PaymentConfirmationEmailOptions): Promise<void> {
    const user = await this.getUser(options.userId);
    if (!user || !await this.shouldSendEmail(options.userId, "payment_confirmation")) {
      return;
    }

    const unsubscribeUrl = await this.generateUnsubscribeUrl(options.userId, "payment_confirmation");

    await this.emailQueue.queueEmail({
      userId: options.userId,
      toEmail: user.email,
      subject: "Payment Confirmation - Pitchey",
      emailType: "payment_confirmation",
      priority: 2,
      templateData: {
        firstName: user.firstName || user.username,
        paymentType: options.paymentType,
        amount: options.amount,
        currency: options.currency,
        description: options.description,
        invoiceUrl: options.invoiceUrl,
        receiptUrl: options.receiptUrl,
        unsubscribeUrl,
      },
    });
  }

  // Send pitch view notification
  async sendPitchViewEmail(options: PitchViewEmailOptions): Promise<void> {
    const [creator, viewer, pitch] = await Promise.all([
      this.getUser(options.creatorId),
      this.getUser(options.viewerId),
      this.getPitch(options.pitchId),
    ]);

    if (!creator || !viewer || !pitch || !await this.shouldSendEmail(options.creatorId, "pitch_view")) {
      return;
    }

    const baseUrl = Deno.env.get("BASE_URL") || "https://pitchey.com";
    const unsubscribeUrl = await this.generateUnsubscribeUrl(options.creatorId, "pitch_view");

    await this.emailQueue.queueEmail({
      userId: options.creatorId,
      toEmail: creator.email,
      subject: `Your pitch "${pitch.title}" was viewed!`,
      emailType: "pitch_view",
      priority: 5, // Lower priority for view notifications
      templateData: {
        creatorName: creator.firstName || creator.username,
        pitchTitle: pitch.title,
        viewerName: viewer.firstName || viewer.username,
        viewerType: viewer.userType,
        pitchUrl: `${baseUrl}/pitches/${options.pitchId}`,
        viewTime: new Date().toLocaleString(),
        unsubscribeUrl,
      },
    });
  }

  // Send weekly digest email
  async sendWeeklyDigestEmail(userId: number, stats: any, recommendations: any[]): Promise<void> {
    const user = await this.getUser(userId);
    if (!user || !await this.shouldSendEmail(userId, "weekly_digest")) {
      return;
    }

    const unsubscribeUrl = await this.generateUnsubscribeUrl(userId, "weekly_digest");
    
    // Calculate week range
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    
    const weekRange = `${weekStart.toLocaleDateString()} - ${now.toLocaleDateString()}`;

    await this.emailQueue.queueEmail({
      userId,
      toEmail: user.email,
      subject: "Your Weekly Pitchey Digest",
      emailType: "weekly_digest",
      priority: 6,
      scheduledFor: this.getDigestScheduleTime(userId),
      templateData: {
        firstName: user.firstName || user.username,
        weekRange,
        stats: stats || {
          newPitches: 0,
          newFollowers: 0,
          messages: 0,
          views: 0,
        },
        topPitches: stats?.topPitches || [],
        recommendations: recommendations || [],
        unsubscribeUrl,
      },
    });
  }

  // Helper: Get user data
  private async getUser(userId: number) {
    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return userResults[0] || null;
  }

  // Helper: Get pitch data
  private async getPitch(pitchId: number) {
    const pitchResults = await db
      .select()
      .from(pitches)
      .where(eq(pitches.id, pitchId))
      .limit(1);

    return pitchResults[0] || null;
  }

  // Helper: Check if we should send email
  private async shouldSendEmail(userId: number, emailType: string): Promise<boolean> {
    const prefsResults = await db
      .select()
      .from(emailPreferences)
      .where(eq(emailPreferences.userId, userId))
      .limit(1);

    // If no preferences exist, create default ones and allow email
    if (prefsResults.length === 0) {
      await this.createDefaultEmailPreferences(userId);
      return true;
    }

    const prefs = prefsResults[0];

    // Check global email enabled
    if (!prefs.emailEnabled) {
      return false;
    }

    // Check specific email type
    switch (emailType) {
      case "welcome":
        return prefs.welcomeEmails;
      case "nda_request":
        return prefs.ndaRequests;
      case "nda_response":
        return prefs.ndaResponses;
      case "pitch_view":
        return prefs.pitchViewNotifications;
      case "payment_confirmation":
        return prefs.paymentConfirmations;
      case "weekly_digest":
        return prefs.weeklyDigest;
      case "password_reset":
        return prefs.securityAlerts;
      default:
        return true;
    }
  }

  // Helper: Check if we should send message email (frequency check)
  private async shouldSendMessageEmail(userId: number): Promise<boolean> {
    const prefsResults = await db
      .select()
      .from(emailPreferences)
      .where(eq(emailPreferences.userId, userId))
      .limit(1);

    if (prefsResults.length === 0) {
      await this.createDefaultEmailPreferences(userId);
      return true;
    }

    const prefs = prefsResults[0];
    return prefs.emailEnabled && prefs.messageNotifications === "instant";
  }

  // Helper: Create default email preferences
  private async createDefaultEmailPreferences(userId: number): Promise<void> {
    try {
      await db.insert(emailPreferences).values({
        userId,
        emailEnabled: true,
        welcomeEmails: true,
        ndaRequests: true,
        ndaResponses: true,
        messageNotifications: "instant",
        pitchViewNotifications: true,
        paymentConfirmations: true,
        weeklyDigest: true,
        marketingEmails: false,
        securityAlerts: true,
      });
    } catch (error) {
      // Preferences might already exist due to race condition
      console.log(`Email preferences already exist for user ${userId}`);
    }
  }

  // Helper: Generate unsubscribe URL
  private async generateUnsubscribeUrl(userId: number, emailType: string): Promise<string> {
    const baseUrl = Deno.env.get("BASE_URL") || "https://pitchey.com";
    return `${baseUrl}/unsubscribe?userId=${userId}&type=${emailType}`;
  }

  // Helper: Get digest schedule time for user
  private getDigestScheduleTime(userId: number): Date | undefined {
    // For now, return undefined to send immediately
    // In production, you would look up user's digest preferences
    return undefined;
  }

  // Get user's email preferences
  async getEmailPreferences(userId: number) {
    const prefsResults = await db
      .select()
      .from(emailPreferences)
      .where(eq(emailPreferences.userId, userId))
      .limit(1);

    if (prefsResults.length === 0) {
      await this.createDefaultEmailPreferences(userId);
      return this.getEmailPreferences(userId);
    }

    return prefsResults[0];
  }

  // Update user's email preferences
  async updateEmailPreferences(userId: number, preferences: Partial<any>): Promise<void> {
    await db
      .update(emailPreferences)
      .set({
        ...preferences,
        updatedAt: new Date(),
      })
      .where(eq(emailPreferences.userId, userId));
  }

  // Unsubscribe user from specific email type
  async unsubscribeUser(userId: number, emailType?: string): Promise<void> {
    if (!emailType) {
      // Unsubscribe from all emails
      await db
        .update(emailPreferences)
        .set({
          emailEnabled: false,
          updatedAt: new Date(),
        })
        .where(eq(emailPreferences.userId, userId));
    } else {
      // Unsubscribe from specific email type
      const updates: any = { updatedAt: new Date() };
      
      switch (emailType) {
        case "welcome":
          updates.welcomeEmails = false;
          break;
        case "nda_request":
          updates.ndaRequests = false;
          break;
        case "nda_response":
          updates.ndaResponses = false;
          break;
        case "message":
          updates.messageNotifications = "never";
          break;
        case "pitch_view":
          updates.pitchViewNotifications = false;
          break;
        case "payment_confirmation":
          updates.paymentConfirmations = false;
          break;
        case "weekly_digest":
          updates.weeklyDigest = false;
          break;
      }

      await db
        .update(emailPreferences)
        .set(updates)
        .where(eq(emailPreferences.userId, userId));
    }
  }
}

// Create singleton instance
let notificationEmailServiceInstance: NotificationEmailService | null = null;

export function getNotificationEmailService(): NotificationEmailService {
  if (!notificationEmailServiceInstance) {
    notificationEmailServiceInstance = new NotificationEmailService();
  }
  return notificationEmailServiceInstance;
}

export default NotificationEmailService;