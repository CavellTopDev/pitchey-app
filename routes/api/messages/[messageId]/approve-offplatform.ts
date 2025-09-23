import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { messages, users, pitches } from "../../../../src/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "../../../../utils/auth.ts";

export const handler: Handlers = {
  async POST(req, ctx) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = await verifyToken(token);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const messageId = parseInt(ctx.params.messageId);
      const body = await req.json();
      const { contactInfo } = body; // Optional contact information to share

      // Get the message
      const message = await db.select().from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (!message.length) {
        return new Response(JSON.stringify({ error: "Message not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const msg = message[0];

      // Verify the user is the receiver of the message
      if (msg.receiverId !== userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if off-platform was requested
      if (!msg.offPlatformRequested) {
        return new Response(JSON.stringify({ 
          error: "Off-platform communication was not requested" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if already approved
      if (msg.offPlatformApproved) {
        return new Response(JSON.stringify({ 
          error: "Off-platform communication already approved" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Update message to approved
      await db.update(messages)
        .set({
          offPlatformApproved: true,
        })
        .where(eq(messages.id, messageId));

      // Get user contact information if not provided
      let sharedContactInfo = contactInfo;
      if (!sharedContactInfo) {
        const user = await db.select({
          email: users.email,
          phone: users.phone,
          companyName: users.companyName,
          companyWebsite: users.companyWebsite,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

        if (user.length) {
          sharedContactInfo = {
            email: user[0].email,
            phone: user[0].phone,
            company: user[0].companyName,
            website: user[0].companyWebsite,
          };
        }
      }

      // Send a notification message with contact info
      if (sharedContactInfo) {
        await db.insert(messages).values({
          pitchId: msg.pitchId,
          senderId: userId,
          receiverId: msg.senderId, // Reply to original sender
          subject: "Re: Off-Platform Communication Approved",
          content: `Your request for off-platform communication has been approved. 
          
Contact Information:
${sharedContactInfo.email ? `Email: ${sharedContactInfo.email}` : ''}
${sharedContactInfo.phone ? `Phone: ${sharedContactInfo.phone}` : ''}
${sharedContactInfo.company ? `Company: ${sharedContactInfo.company}` : ''}
${sharedContactInfo.website ? `Website: ${sharedContactInfo.website}` : ''}

Please respect the NDA terms when communicating outside the platform.`,
          offPlatformRequested: false,
          offPlatformApproved: true,
          sentAt: new Date(),
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Off-platform communication approved",
        contactInfoShared: !!sharedContactInfo,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error approving off-platform:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};