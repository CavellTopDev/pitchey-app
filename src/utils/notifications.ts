/**
 * Simple Notification Utility for Cloudflare Workers
 * Provides a lightweight notification function for handlers
 */

import { Env } from '../types';
import postgres from 'postgres';

export interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  actionUrl?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

/**
 * Send a notification to a user
 * Creates an in-app notification in the database
 */
export async function sendNotification(
  env: Env,
  input: NotificationInput
): Promise<void> {
  try {
    const sql = postgres(env.DATABASE_URL);

    await sql`
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data,
        action_url,
        priority,
        created_at
      ) VALUES (
        ${input.userId},
        ${input.type},
        ${input.title},
        ${input.message},
        ${JSON.stringify(input.data || {})},
        ${input.actionUrl || null},
        ${input.priority || 'normal'},
        NOW()
      )
    `;

    await sql.end();
  } catch (error) {
    // Log error but don't throw - notifications should not break the main flow
    console.error('Failed to send notification:', error);
  }
}
