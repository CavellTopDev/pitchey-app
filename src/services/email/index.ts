/**
 * Email Service Index
 * Provides unified access to email sending functions for Cloudflare Workers
 */

import { WorkerEmailService } from '../worker-email.ts';

// Helper to get email service with environment variables
function getEmailService() {
  // Try Deno.env (for tests/local) or global process.env (for compatibility)
  const getEnv = (key: string) => {
    try {
      return (globalThis as any).Deno?.env.get(key) || (globalThis as any).process?.env[key];
    } catch {
      return undefined;
    }
  };

  const apiKey = getEnv("RESEND_API_KEY");
  const fromEmail = getEnv("SENDGRID_FROM_EMAIL") || 'notifications@pitchey.com';
  const fromName = getEnv("SENDGRID_FROM_NAME") || 'Pitchey';
  
  return new WorkerEmailService({
    apiKey: apiKey || '',
    fromEmail,
    fromName
  });
}

/**
 * Send NDA Request Email
 */
export async function sendNDARequestEmail(to: string, data: any) {
  const service = getEmailService();
  return await service.sendTemplate(to, 'ndaRequest', {
    ...data,
    requesterName: data.senderName, // Map template variable
    reviewUrl: data.actionUrl      // Map template variable
  });
}

/**
 * Send NDA Response Email (Approval/Rejection)
 */
export async function sendNDAResponseEmail(to: string, data: any) {
  const service = getEmailService();
  const template = data.approved ? 'ndaApproved' : 'ndaRejected';
  
  return await service.sendTemplate(to, template, {
    ...data,
    pitchUrl: data.actionUrl // Map template variable
  });
}
