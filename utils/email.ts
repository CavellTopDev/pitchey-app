// Email notification service integration
// Now uses the comprehensive email notification system

import { getNotificationEmailService } from "../src/services/notification-email.service.ts";
import { db } from "../src/db/client.ts";
import { users } from "../src/db/schema.ts";
import { eq } from "drizzle-orm";

interface MessageNotificationData {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  messageContent: string;
  pitchTitle?: string;
  conversationUrl: string;
}

interface NDANotificationData {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  pitchTitle: string;
  actionType: 'request' | 'approval' | 'rejection';
  actionUrl: string;
  reason?: string;
}

// Helper to get user ID from email
async function getUserIdByEmail(email: string): Promise<number | null> {
  try {
    const userResults = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    return userResults[0]?.id || null;
  } catch (error) {
    console.error("Error getting user by email:", error);
    return null;
  }
}

// Helper to get user data by name
async function getUserByName(name: string): Promise<{ id: number; email: string } | null> {
  try {
    // Try to find by firstName or username
    const userResults = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        // In production, use proper OR condition from drizzle-orm
        eq(users.firstName, name) // Simplified for now
      )
      .limit(1);
    
    if (userResults.length === 0) {
      // Try username
      const usernameResults = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.username, name))
        .limit(1);
      
      return usernameResults[0] || null;
    }
    
    return userResults[0];
  } catch (error) {
    console.error("Error getting user by name:", error);
    return null;
  }
}

export async function sendMessageNotification(data: MessageNotificationData): Promise<boolean> {
  try {
    const notificationService = getNotificationEmailService();
    
    // Get user IDs
    const senderId = await getUserByName(data.senderName);
    const receiverId = await getUserIdByEmail(data.recipientEmail);
    
    if (!senderId || !receiverId) {
      console.error("Could not find sender or receiver for message notification");
      return false;
    }

    // Extract pitch ID if available (simplified)
    const pitchId = data.pitchTitle ? 1 : undefined; // In production, parse from conversationUrl or pass explicitly

    await notificationService.sendMessageEmail({
      senderId: senderId.id,
      receiverId,
      messageContent: data.messageContent,
      pitchId,
    });

    return true;
  } catch (error) {
    console.error("Error sending message notification:", error);
    return false;
  }
}

export async function sendNDANotification(data: NDANotificationData): Promise<boolean> {
  try {
    const notificationService = getNotificationEmailService();
    
    // Get user IDs
    const sender = await getUserByName(data.senderName);
    const recipient = await getUserIdByEmail(data.recipientEmail);
    
    if (!sender || !recipient) {
      console.error("Could not find sender or recipient for NDA notification");
      return false;
    }

    // Extract pitch ID (simplified - in production, pass this explicitly)
    const pitchId = 1; // In production, parse from actionUrl or pass explicitly

    switch (data.actionType) {
      case 'request':
        await notificationService.sendNDARequestEmail({
          requesterId: sender.id,
          ownerId: recipient,
          pitchId,
          requestMessage: data.reason,
        });
        break;

      case 'approval':
        await notificationService.sendNDAResponseEmail({
          requesterId: recipient,
          ownerId: sender.id,
          pitchId,
          approved: true,
          reason: data.reason,
        });
        break;

      case 'rejection':
        await notificationService.sendNDAResponseEmail({
          requesterId: recipient,
          ownerId: sender.id,
          pitchId,
          approved: false,
          reason: data.reason,
        });
        break;

      default:
        throw new Error(`Unknown NDA notification type: ${data.actionType}`);
    }

    return true;
  } catch (error) {
    console.error("Error sending NDA notification:", error);
    return false;
  }
}

export async function sendOffPlatformApprovalNotification(
  recipientEmail: string,
  recipientName: string,
  approverName: string,
  pitchTitle: string,
  contactInfo: string,
  messagesUrl: string
): Promise<boolean> {
  const subject = `Off-Platform Communication Approved for "${pitchTitle}"`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10b981;">Off-Platform Communication Approved</h2>
      
      <p>Hi ${recipientName},</p>
      
      <p><strong>${approverName}</strong> has approved off-platform communication for "<strong>${pitchTitle}</strong>".</p>
      
      <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #374151;">Contact Information:</h3>
        <p style="margin-bottom: 0;">${contactInfo}</p>
      </div>
      
      <p>You can now communicate directly outside of the Pitchey platform.</p>
      
      <p>
        <a href="${messagesUrl}" 
           style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Conversation
        </a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="color: #6b7280; font-size: 12px;">
        © 2024 Pitchey. All rights reserved.
      </p>
    </div>
  `;

  const text = `
Off-Platform Communication Approved

Hi ${recipientName},

${approverName} has approved off-platform communication for "${pitchTitle}".

Contact Information:
${contactInfo}

You can now communicate directly outside of the Pitchey platform.

View conversation: ${messagesUrl}
  `;

  return sendEmail({
    to: recipientEmail,
    subject,
    html,
    text,
  });
}