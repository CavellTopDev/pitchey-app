import { Handlers } from "$fresh/server.ts";
import { EmailTemplates } from "../../../src/services/email-templates.service.ts";
import { verifyAuthToken } from "../../../src/middleware/auth.middleware.ts";

interface PreviewRequest {
  template: string;
  data: any;
}

export const handler: Handlers = {
  // Preview email template
  async POST(req) {
    try {
      const authResult = await verifyAuthToken(req);
      if (!authResult.success) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Only allow admin users to preview emails
      if (authResult.user!.userType !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body: PreviewRequest = await req.json();
      const { template, data } = body;

      // Sample data for each template type
      const sampleData = {
        welcome: {
          firstName: "John",
          userType: "creator" as const,
          dashboardUrl: "https://pitchey.com/dashboard",
          profileSetupUrl: "https://pitchey.com/profile/setup",
          unsubscribeUrl: "https://pitchey.com/unsubscribe?token=sample",
        },
        nda_request: {
          recipientName: "Jane Smith",
          senderName: "John Doe",
          pitchTitle: "The Next Great Film",
          requestMessage: "I'm very interested in this project and would love to learn more about it.",
          actionUrl: "https://pitchey.com/nda-requests",
          unsubscribeUrl: "https://pitchey.com/unsubscribe?token=sample",
        },
        nda_response: {
          recipientName: "John Doe",
          senderName: "Jane Smith",
          pitchTitle: "The Next Great Film",
          approved: true,
          reason: "Your background looks great for this project.",
          actionUrl: "https://pitchey.com/pitches/123",
          unsubscribeUrl: "https://pitchey.com/unsubscribe?token=sample",
        },
        message: {
          recipientName: "Jane Smith",
          senderName: "John Doe",
          messageContent: "Hi Jane, I saw your pitch and I'm really interested in discussing it further. Would you be available for a call this week?",
          pitchTitle: "The Next Great Film",
          conversationUrl: "https://pitchey.com/messages",
          unsubscribeUrl: "https://pitchey.com/unsubscribe?token=sample",
        },
        password_reset: {
          firstName: "John",
          resetUrl: "https://pitchey.com/reset-password/sample-token",
          expiresIn: "1 hour",
          unsubscribeUrl: "https://pitchey.com/unsubscribe?token=sample",
        },
        payment_confirmation: {
          firstName: "John",
          paymentType: "subscription" as const,
          amount: "29.99",
          currency: "USD",
          description: "Monthly Pro Subscription",
          invoiceUrl: "https://pitchey.com/invoices/123",
          receiptUrl: "https://pitchey.com/receipts/123",
          unsubscribeUrl: "https://pitchey.com/unsubscribe?token=sample",
        },
        weekly_digest: {
          firstName: "John",
          weekRange: "Dec 11 - Dec 18, 2024",
          stats: {
            newPitches: 12,
            newFollowers: 5,
            messages: 8,
            views: 145,
          },
          topPitches: [
            {
              title: "The Next Great Film",
              views: 45,
              url: "https://pitchey.com/pitches/123",
            },
            {
              title: "Documentary Project",
              views: 32,
              url: "https://pitchey.com/pitches/124",
            },
          ],
          recommendations: [
            {
              title: "Sci-Fi Adventure",
              creator: "Jane Smith",
              url: "https://pitchey.com/pitches/125",
              imageUrl: "https://pitchey.com/images/pitch-125.jpg",
            },
            {
              title: "Comedy Series",
              creator: "Bob Johnson",
              url: "https://pitchey.com/pitches/126",
            },
          ],
          unsubscribeUrl: "https://pitchey.com/unsubscribe?token=sample",
        },
        pitch_view: {
          creatorName: "Jane Smith",
          pitchTitle: "The Next Great Film",
          viewerName: "John Doe",
          viewerType: "Investor",
          pitchUrl: "https://pitchey.com/pitches/123",
          viewTime: new Date().toLocaleString(),
          unsubscribeUrl: "https://pitchey.com/unsubscribe?token=sample",
        },
      };

      // Use provided data or sample data
      const templateData = data || sampleData[template as keyof typeof sampleData];

      if (!templateData) {
        return new Response(JSON.stringify({ error: "Invalid template type" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Generate email content
      let emailContent;
      
      try {
        switch (template) {
          case "welcome":
            emailContent = EmailTemplates.welcome(templateData);
            break;
          case "nda_request":
            emailContent = EmailTemplates.ndaRequest(templateData);
            break;
          case "nda_response":
            emailContent = EmailTemplates.ndaResponse(templateData);
            break;
          case "message":
            emailContent = EmailTemplates.message(templateData);
            break;
          case "password_reset":
            emailContent = EmailTemplates.passwordReset(templateData);
            break;
          case "payment_confirmation":
            emailContent = EmailTemplates.paymentConfirmation(templateData);
            break;
          case "weekly_digest":
            emailContent = EmailTemplates.weeklyDigest(templateData);
            break;
          case "pitch_view":
            emailContent = EmailTemplates.pitchView(templateData);
            break;
          default:
            return new Response(JSON.stringify({ error: "Unknown template type" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({
          html: emailContent.html,
          text: emailContent.text,
          data: templateData,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Error generating email template:", error);
        return new Response(JSON.stringify({ 
          error: "Error generating email template",
          details: error instanceof Error ? error.message : "Unknown error",
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (error) {
      console.error("Error previewing email:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Get HTML preview
  async GET(req) {
    try {
      const url = new URL(req.url);
      const template = url.searchParams.get("template");
      
      if (!template) {
        return new Response("Template parameter is required", { status: 400 });
      }

      // Sample data for preview
      const sampleData = {
        welcome: {
          firstName: "John",
          userType: "creator" as const,
          dashboardUrl: "https://pitchey.com/dashboard",
          profileSetupUrl: "https://pitchey.com/profile/setup",
          unsubscribeUrl: "https://pitchey.com/unsubscribe?token=sample",
        },
        // Add other sample data as needed...
      };

      const templateData = sampleData[template as keyof typeof sampleData];
      
      if (!templateData) {
        return new Response("Invalid template type", { status: 400 });
      }

      try {
        let emailContent;
        
        switch (template) {
          case "welcome":
            emailContent = EmailTemplates.welcome(templateData);
            break;
          // Add other cases as needed...
          default:
            return new Response("Template not implemented for preview", { status: 400 });
        }

        return new Response(emailContent.html, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      } catch (error) {
        console.error("Error generating email template:", error);
        return new Response("Error generating email template", { status: 500 });
      }
    } catch (error) {
      console.error("Error previewing email:", error);
      return new Response("Internal server error", { status: 500 });
    }
  },
};