import { Handlers } from "$fresh/server.ts";
import { getNotificationEmailService } from "../../../src/services/notification-email.service.ts";
import { verifyAuthToken } from "../../../src/middleware/auth.middleware.ts";

interface EmailPreferencesRequest {
  emailEnabled?: boolean;
  welcomeEmails?: boolean;
  ndaRequests?: boolean;
  ndaResponses?: boolean;
  messageNotifications?: "instant" | "daily" | "weekly" | "never";
  pitchViewNotifications?: boolean;
  paymentConfirmations?: boolean;
  weeklyDigest?: boolean;
  marketingEmails?: boolean;
  securityAlerts?: boolean;
  digestDay?: number;
  digestTime?: string;
  timezone?: string;
}

export const handler: Handlers = {
  // Get email preferences
  async GET(req) {
    try {
      const authResult = await verifyAuthToken(req);
      if (!authResult.success) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const notificationService = getNotificationEmailService();
      const preferences = await notificationService.getEmailPreferences(authResult.user!.id);

      return new Response(JSON.stringify({ preferences }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error getting email preferences:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Update email preferences
  async PUT(req) {
    try {
      const authResult = await verifyAuthToken(req);
      if (!authResult.success) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body: EmailPreferencesRequest = await req.json();
      const notificationService = getNotificationEmailService();

      await notificationService.updateEmailPreferences(authResult.user!.id, body);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error updating email preferences:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};