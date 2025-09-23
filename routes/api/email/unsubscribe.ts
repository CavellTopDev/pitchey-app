import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { unsubscribeTokens, emailSuppression } from "../../../src/db/schema.ts";
import { eq, and, gte } from "drizzle-orm";
import { getNotificationEmailService } from "../../../src/services/notification-email.service.ts";

export const handler: Handlers = {
  // Handle unsubscribe via token
  async GET(req) {
    try {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      const userId = url.searchParams.get("userId");
      const emailType = url.searchParams.get("type");

      if (!token && !userId) {
        return new Response("Invalid unsubscribe link", { status: 400 });
      }

      const notificationService = getNotificationEmailService();

      if (token) {
        // Handle token-based unsubscribe
        const tokenResults = await db
          .select()
          .from(unsubscribeTokens)
          .where(
            and(
              eq(unsubscribeTokens.token, token),
              gte(unsubscribeTokens.expiresAt, new Date())
            )
          )
          .limit(1);

        if (tokenResults.length === 0) {
          return new Response("Invalid or expired unsubscribe token", { status: 400 });
        }

        const tokenData = tokenResults[0];
        
        // Unsubscribe user
        await notificationService.unsubscribeUser(tokenData.userId, tokenData.emailType || undefined);

        // Mark token as used
        await db
          .update(unsubscribeTokens)
          .set({ usedAt: new Date() })
          .where(eq(unsubscribeTokens.id, tokenData.id));

        return new Response(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Unsubscribed - Pitchey</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                .success { color: #10b981; }
                .button { background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
              </style>
            </head>
            <body>
              <h1 class="success">Successfully Unsubscribed</h1>
              <p>You have been unsubscribed from ${tokenData.emailType || "all"} emails from Pitchey.</p>
              <p>You can update your email preferences at any time in your account settings.</p>
              <a href="${Deno.env.get("BASE_URL") || "https://pitchey.com"}/settings" class="button">Go to Settings</a>
            </body>
          </html>
        `, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      } else if (userId) {
        // Handle direct userId unsubscribe (for testing/admin)
        const userIdNum = parseInt(userId);
        if (isNaN(userIdNum)) {
          return new Response("Invalid user ID", { status: 400 });
        }

        await notificationService.unsubscribeUser(userIdNum, emailType || undefined);

        return new Response(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Unsubscribed - Pitchey</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                .success { color: #10b981; }
                .button { background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
              </style>
            </head>
            <body>
              <h1 class="success">Successfully Unsubscribed</h1>
              <p>You have been unsubscribed from ${emailType || "all"} emails from Pitchey.</p>
              <p>You can update your email preferences at any time in your account settings.</p>
              <a href="${Deno.env.get("BASE_URL") || "https://pitchey.com"}/settings" class="button">Go to Settings</a>
            </body>
          </html>
        `, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response("Invalid request", { status: 400 });
    } catch (error) {
      console.error("Error processing unsubscribe:", error);
      return new Response("Internal server error", { status: 500 });
    }
  },

  // Handle email suppression (for email providers)
  async POST(req) {
    try {
      const body = await req.json();
      const { email, type, reason } = body;

      if (!email || !type) {
        return new Response(JSON.stringify({ error: "Email and type are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Add to suppression list
      try {
        await db.insert(emailSuppression).values({
          email,
          suppressionType: type,
          reason,
        });
      } catch (error) {
        // Email might already be suppressed
        console.log(`Email ${email} already in suppression list`);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error adding email suppression:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};