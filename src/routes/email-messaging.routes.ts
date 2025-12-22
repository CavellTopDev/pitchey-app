/**
 * Email & Messaging Routes for Cloudflare Worker
 * Integrates email service, messaging, and notifications into the worker
 */

import { EmailService } from '../services/email.service';
import { MessagingService } from '../services/messaging.service';
import { NotificationService } from '../services/notification.service';
import { ApiResponseBuilder } from '../utils/api-response';
import { getCorsHeaders } from '../utils/response';

export interface EmailMessagingEnv {
  // Email Configuration
  SENDGRID_API_KEY?: string;
  SENDGRID_FROM_EMAIL?: string;
  SENDGRID_FROM_NAME?: string;
  AWS_SES_ACCESS_KEY?: string;
  AWS_SES_SECRET_KEY?: string;
  AWS_SES_REGION?: string;
  AWS_SES_FROM_EMAIL?: string;
  AWS_SES_FROM_NAME?: string;
  
  // Messaging Configuration
  MESSAGE_ATTACHMENTS?: R2Bucket;
  EMAIL_ATTACHMENTS?: R2Bucket;
  
  // Queue Bindings
  EMAIL_QUEUE?: Queue;
  NOTIFICATION_QUEUE?: Queue;
  
  // Cache Bindings
  EMAIL_CACHE?: KVNamespace;
  NOTIFICATION_CACHE?: KVNamespace;
  
  // Redis
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  
  // Database
  DATABASE_URL: string;
}

/**
 * Email & Messaging Route Handler
 */
export class EmailMessagingRoutes {
  private emailService: EmailService;
  private messagingService: MessagingService;
  private notificationService: NotificationService;
  
  constructor(private env: EmailMessagingEnv) {
    // Initialize services with environment configuration
    this.emailService = new EmailService({
      providers: {
        sendgrid: {
          apiKey: env.SENDGRID_API_KEY || '',
          fromEmail: env.SENDGRID_FROM_EMAIL || 'noreply@pitchey.com',
          fromName: env.SENDGRID_FROM_NAME || 'Pitchey',
        },
        awsSes: env.AWS_SES_ACCESS_KEY ? {
          accessKey: env.AWS_SES_ACCESS_KEY,
          secretKey: env.AWS_SES_SECRET_KEY || '',
          region: env.AWS_SES_REGION || 'us-east-1',
          fromEmail: env.AWS_SES_FROM_EMAIL || 'noreply@pitchey.com',
          fromName: env.AWS_SES_FROM_NAME || 'Pitchey',
        } : undefined,
      },
      cache: {
        redis: {
          url: env.UPSTASH_REDIS_REST_URL,
          token: env.UPSTASH_REDIS_REST_TOKEN,
        },
      },
    });
    
    this.messagingService = new MessagingService({
      database: {
        url: env.DATABASE_URL,
      },
      storage: {
        r2Bucket: env.MESSAGE_ATTACHMENTS,
      },
      websocket: {
        enabled: false, // Will be enabled when WebSocket is available
      },
      redis: {
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      },
    });
    
    this.notificationService = new NotificationService({
      email: this.emailService,
      messaging: this.messagingService,
      database: {
        url: env.DATABASE_URL,
      },
      redis: {
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      },
    });
  }
  
  /**
   * Send Email
   * POST /api/email/send
   */
  async sendEmail(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { to, subject, template, data, attachments } = body;
      
      const result = await this.emailService.send({
        to,
        subject,
        template,
        data,
        attachments,
      });
      
      return new Response(JSON.stringify({
        success: true,
        data: result,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin')),
        },
      });
    } catch (error) {
      return ApiResponseBuilder.error(error as Error);
    }
  }
  
  /**
   * Send Batch Emails
   * POST /api/email/batch
   */
  async sendBatchEmails(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { emails } = body;
      
      const results = await this.emailService.sendBatch(emails);
      
      return new Response(JSON.stringify({
        success: true,
        data: results,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin')),
        },
      });
    } catch (error) {
      return ApiResponseBuilder.error(error as Error);
    }
  }
  
  /**
   * Get Email Status
   * GET /api/email/:id/status
   */
  async getEmailStatus(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const id = url.pathname.split('/')[3];
      
      const status = await this.emailService.getStatus(id);
      
      return new Response(JSON.stringify({
        success: true,
        data: status,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin')),
        },
      });
    } catch (error) {
      return ApiResponseBuilder.error(error as Error);
    }
  }
  
  /**
   * Send Message
   * POST /api/messages/send
   */
  async sendMessage(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { conversationId, senderId, content, attachments } = body;
      
      const message = await this.messagingService.sendMessage({
        conversationId,
        senderId,
        content,
        attachments,
      });
      
      return new Response(JSON.stringify({
        success: true,
        data: message,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin')),
        },
      });
    } catch (error) {
      return ApiResponseBuilder.error(error as Error);
    }
  }
  
  /**
   * Get Messages
   * GET /api/messages/:conversationId
   */
  async getMessages(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const conversationId = url.pathname.split('/')[3];
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      
      const messages = await this.messagingService.getMessages(
        conversationId,
        { limit, offset }
      );
      
      return new Response(JSON.stringify({
        success: true,
        data: messages,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin')),
        },
      });
    } catch (error) {
      return ApiResponseBuilder.error(error as Error);
    }
  }
  
  /**
   * Get Conversations
   * GET /api/messages/conversations
   */
  async getConversations(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId');
      
      if (!userId) {
        return ApiResponseBuilder.error(new Error('User ID required'));
      }
      
      const conversations = await this.messagingService.getConversations(userId);
      
      return new Response(JSON.stringify({
        success: true,
        data: conversations,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin')),
        },
      });
    } catch (error) {
      return ApiResponseBuilder.error(error as Error);
    }
  }
  
  /**
   * Create Conversation
   * POST /api/messages/conversations
   */
  async createConversation(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { participants, name, type } = body;
      
      const conversation = await this.messagingService.createConversation({
        participants,
        name,
        type,
      });
      
      return new Response(JSON.stringify({
        success: true,
        data: conversation,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin')),
        },
      });
    } catch (error) {
      return ApiResponseBuilder.error(error as Error);
    }
  }
  
  /**
   * Mark Message as Read
   * POST /api/messages/:messageId/read
   */
  async markAsRead(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const messageId = url.pathname.split('/')[3];
      const body = await request.json();
      const { userId } = body;
      
      await this.messagingService.markAsRead(messageId, userId);
      
      return new Response(JSON.stringify({
        success: true,
        data: { message: 'Message marked as read' },
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin')),
        },
      });
    } catch (error) {
      return ApiResponseBuilder.error(error as Error);
    }
  }
  
  /**
   * Get Notifications
   * GET /api/notifications
   */
  async getNotifications(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId');
      const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      
      if (!userId) {
        return ApiResponseBuilder.error(new Error('User ID required'));
      }
      
      const notifications = await this.notificationService.getNotifications(
        userId,
        { unreadOnly, limit, offset }
      );
      
      return new Response(JSON.stringify({
        success: true,
        data: notifications,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin')),
        },
      });
    } catch (error) {
      return ApiResponseBuilder.error(error as Error);
    }
  }
  
  /**
   * Send Notification
   * POST /api/notifications/send
   */
  async sendNotification(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { userId, type, title, message, data, channels } = body;
      
      const result = await this.notificationService.send({
        userId,
        type,
        title,
        message,
        data,
        channels: channels || ['in-app'],
      });
      
      return new Response(JSON.stringify({
        success: true,
        data: result,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin')),
        },
      });
    } catch (error) {
      return ApiResponseBuilder.error(error as Error);
    }
  }
  
  /**
   * Mark Notification as Read
   * POST /api/notifications/:id/read
   */
  async markNotificationAsRead(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const id = url.pathname.split('/')[3];
      
      await this.notificationService.markAsRead(id);
      
      return new Response(JSON.stringify({
        success: true,
        data: { message: 'Notification marked as read' },
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin')),
        },
      });
    } catch (error) {
      return ApiResponseBuilder.error(error as Error);
    }
  }
  
  /**
   * Get Notification Preferences
   * GET /api/notifications/preferences
   */
  async getNotificationPreferences(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId');
      
      if (!userId) {
        return ApiResponseBuilder.error(new Error('User ID required'));
      }
      
      const preferences = await this.notificationService.getPreferences(userId);
      
      return new Response(JSON.stringify({
        success: true,
        data: preferences,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin')),
        },
      });
    } catch (error) {
      return ApiResponseBuilder.error(error as Error);
    }
  }
  
  /**
   * Update Notification Preferences
   * PUT /api/notifications/preferences
   */
  async updateNotificationPreferences(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { userId, preferences } = body;
      
      const updated = await this.notificationService.updatePreferences(
        userId,
        preferences
      );
      
      return new Response(JSON.stringify({
        success: true,
        data: updated,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin')),
        },
      });
    } catch (error) {
      return ApiResponseBuilder.error(error as Error);
    }
  }
  
  /**
   * Send NDA Request Notification
   * POST /api/notifications/nda/request
   */
  async sendNDARequestNotification(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { pitchId, investorId, creatorId } = body;
      
      await this.notificationService.sendNDARequestNotification({
        pitchId,
        investorId,
        creatorId,
      });
      
      return new Response(JSON.stringify({
        success: true,
        data: { message: 'NDA request notification sent' },
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin')),
        },
      });
    } catch (error) {
      return ApiResponseBuilder.error(error as Error);
    }
  }
  
  /**
   * Send Investment Notification
   * POST /api/notifications/investment
   */
  async sendInvestmentNotification(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { investmentId, type } = body;
      
      await this.notificationService.sendInvestmentNotification({
        investmentId,
        type,
      });
      
      return new Response(JSON.stringify({
        success: true,
        data: { message: 'Investment notification sent' },
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin')),
        },
      });
    } catch (error) {
      return ApiResponseBuilder.error(error as Error);
    }
  }
}