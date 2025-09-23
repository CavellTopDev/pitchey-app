import { Handlers } from "$fresh/server.ts";
import { getEmailQueueService } from "../../../src/services/email-queue.service.ts";

export const handler: Handlers = {
  // Handle email provider webhooks
  async POST(req) {
    try {
      const url = new URL(req.url);
      const provider = url.searchParams.get("provider") || "unknown";
      
      const body = await req.json();
      const emailQueue = getEmailQueueService();

      console.log(`Received email webhook from ${provider}:`, body);

      // Handle different provider webhook formats
      switch (provider) {
        case "sendgrid":
          await handleSendGridWebhook(body, emailQueue);
          break;
        case "ses":
          await handleSESWebhook(body, emailQueue);
          break;
        case "postmark":
          await handlePostmarkWebhook(body, emailQueue);
          break;
        default:
          await handleGenericWebhook(body, emailQueue);
          break;
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error processing email webhook:", error);
      return new Response(JSON.stringify({ 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

// SendGrid webhook handler
async function handleSendGridWebhook(events: any[], emailQueue: any) {
  for (const event of events) {
    const eventType = mapSendGridEvent(event.event);
    const data = {
      messageId: event.sg_message_id,
      email: event.email,
      timestamp: new Date(event.timestamp * 1000),
      reason: event.reason,
      bounceType: event.type,
      url: event.url, // for click events
    };

    await emailQueue.handleEmailWebhook(eventType, data);
  }
}

// AWS SES webhook handler
async function handleSESWebhook(message: any, emailQueue: any) {
  // SES sends SNS notifications
  if (message.Type === "Notification") {
    const notification = JSON.parse(message.Message);
    
    if (notification.notificationType === "Bounce") {
      await emailQueue.handleEmailWebhook("bounced", {
        messageId: notification.mail.messageId,
        email: notification.bounce.bouncedRecipients[0]?.emailAddress,
        reason: notification.bounce.bouncedRecipients[0]?.diagnosticCode,
        bounceType: notification.bounce.bounceType === "Permanent" ? "hard" : "soft",
      });
    } else if (notification.notificationType === "Complaint") {
      await emailQueue.handleEmailWebhook("complained", {
        messageId: notification.mail.messageId,
        email: notification.complaint.complainedRecipients[0]?.emailAddress,
        reason: notification.complaint.complaintFeedbackType,
      });
    } else if (notification.notificationType === "Delivery") {
      await emailQueue.handleEmailWebhook("delivered", {
        messageId: notification.mail.messageId,
        email: notification.delivery.recipients[0],
      });
    }
  }
}

// Postmark webhook handler
async function handlePostmarkWebhook(event: any, emailQueue: any) {
  const eventType = mapPostmarkEvent(event.Type);
  const data = {
    messageId: event.MessageID,
    email: event.Email,
    reason: event.Description,
    bounceType: event.Type,
  };

  await emailQueue.handleEmailWebhook(eventType, data);
}

// Generic webhook handler
async function handleGenericWebhook(event: any, emailQueue: any) {
  const eventType = event.type || event.event || "unknown";
  await emailQueue.handleEmailWebhook(eventType, event);
}

// Map SendGrid events to our internal event types
function mapSendGridEvent(sgEvent: string): string {
  const eventMap: Record<string, string> = {
    delivered: "delivered",
    bounce: "bounced",
    dropped: "bounced",
    deferred: "deferred",
    processed: "sent",
    open: "opened",
    click: "clicked",
    spamreport: "complained",
    unsubscribe: "unsubscribed",
    group_unsubscribe: "unsubscribed",
    group_resubscribe: "resubscribed",
  };

  return eventMap[sgEvent] || sgEvent;
}

// Map Postmark events to our internal event types
function mapPostmarkEvent(postmarkEvent: string): string {
  const eventMap: Record<string, string> = {
    HardBounce: "bounced",
    SoftBounce: "bounced", 
    SpamComplaint: "complained",
    ManuallyDeactivated: "unsubscribed",
    Unsubscribed: "unsubscribed",
    SubscriptionChange: "preference_changed",
  };

  return eventMap[postmarkEvent] || postmarkEvent.toLowerCase();
}