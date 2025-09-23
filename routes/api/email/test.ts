import { Handlers } from "$fresh/server.ts";
import { getNotificationEmailService } from "../../../src/services/notification-email.service.ts";
import { getEmailQueueService } from "../../../src/services/email-queue.service.ts";
import { verifyAuthToken } from "../../../src/middleware/auth.middleware.ts";

interface TestEmailRequest {
  type: string;
  toEmail: string;
  data?: any;
}

export const handler: Handlers = {
  // Send test email
  async POST(req) {
    try {
      const authResult = await verifyAuthToken(req);
      if (!authResult.success) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Only allow admin users to send test emails
      if (authResult.user!.userType !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body: TestEmailRequest = await req.json();
      const { type, toEmail, data } = body;

      const notificationService = getNotificationEmailService();

      // Send different types of test emails
      switch (type) {
        case "welcome":
          await notificationService.sendWelcomeEmail({
            userId: authResult.user!.id,
            userType: data?.userType || "creator",
          });
          break;

        case "nda_request":
          await notificationService.sendNDARequestEmail({
            requesterId: data?.requesterId || authResult.user!.id,
            ownerId: data?.ownerId || authResult.user!.id,
            pitchId: data?.pitchId || 1,
            requestMessage: data?.requestMessage || "This is a test NDA request.",
          });
          break;

        case "nda_response":
          await notificationService.sendNDAResponseEmail({
            requesterId: data?.requesterId || authResult.user!.id,
            ownerId: data?.ownerId || authResult.user!.id,
            pitchId: data?.pitchId || 1,
            approved: data?.approved !== false,
            reason: data?.reason || "This is a test NDA response.",
          });
          break;

        case "message":
          await notificationService.sendMessageEmail({
            senderId: data?.senderId || authResult.user!.id,
            receiverId: data?.receiverId || authResult.user!.id,
            messageContent: data?.messageContent || "This is a test message notification.",
            pitchId: data?.pitchId,
          });
          break;

        case "password_reset":
          await notificationService.sendPasswordResetEmail({
            userId: authResult.user!.id,
            resetToken: "test-token-" + Math.random().toString(36).substr(2, 9),
            expiresIn: "1 hour",
          });
          break;

        case "payment_confirmation":
          await notificationService.sendPaymentConfirmationEmail({
            userId: authResult.user!.id,
            paymentType: data?.paymentType || "subscription",
            amount: data?.amount || "29.99",
            currency: data?.currency || "USD",
            description: data?.description || "Test payment confirmation",
            invoiceUrl: data?.invoiceUrl,
            receiptUrl: data?.receiptUrl,
          });
          break;

        case "pitch_view":
          await notificationService.sendPitchViewEmail({
            creatorId: data?.creatorId || authResult.user!.id,
            viewerId: data?.viewerId || authResult.user!.id,
            pitchId: data?.pitchId || 1,
          });
          break;

        case "weekly_digest":
          await notificationService.sendWeeklyDigestEmail(
            authResult.user!.id,
            data?.stats || {
              newPitches: 5,
              newFollowers: 3,
              messages: 12,
              views: 89,
              topPitches: [
                {
                  title: "Test Pitch 1",
                  views: 45,
                  url: "https://pitchey.com/pitches/1",
                },
                {
                  title: "Test Pitch 2", 
                  views: 32,
                  url: "https://pitchey.com/pitches/2",
                },
              ],
            },
            data?.recommendations || [
              {
                title: "Recommended Pitch 1",
                creator: "Test Creator",
                url: "https://pitchey.com/pitches/3",
              },
            ]
          );
          break;

        default:
          return new Response(JSON.stringify({ error: "Unknown email type" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: `Test ${type} email queued successfully`,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error sending test email:", error);
      return new Response(JSON.stringify({ 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Get email queue status
  async GET(req) {
    try {
      const authResult = await verifyAuthToken(req);
      if (!authResult.success) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Only allow admin users to view queue status
      if (authResult.user!.userType !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const emailQueue = getEmailQueueService();
      const stats = await emailQueue.getQueueStats();

      return new Response(JSON.stringify({ 
        stats,
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error getting queue stats:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};