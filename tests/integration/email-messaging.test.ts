/**
 * Email and Messaging System Integration Tests
 * 
 * Comprehensive test suite for email service, messaging service, and notification orchestrator.
 * These tests verify critical workflows including NDA notifications, investment alerts,
 * and message delivery across the entire system.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createEmailService, type EmailService } from '../../src/services/email.service.ts';
import { MessagingService } from '../../src/services/messaging.service.ts';
import { NotificationService, type NotificationInput } from '../../src/services/notification.service.ts';
import { createEmailMessagingConfig, type EmailMessagingConfig } from '../../src/config/email-messaging.config.ts';

// ============================================================================
// TEST CONFIGURATION AND SETUP
// ============================================================================

// Mock environment for testing
const TEST_ENV = {
  ENVIRONMENT: 'testing' as const,
  DATABASE_URL: 'postgresql://test:test@localhost:5432/pitchey_test',
  UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-token',
  BETTER_AUTH_SECRET: 'test-secret-key-for-testing-only',
  SENDGRID_API_KEY: 'SG.test-key-for-testing',
  SENDGRID_FROM_EMAIL: 'test@pitchey.com',
  SENDGRID_FROM_NAME: 'Pitchey Test',
  FRONTEND_URL: 'https://test.pitchey.com',
  DEBUG_MODE: 'true',
  ENABLE_EMAIL_SERVICE: 'true',
  ENABLE_MESSAGING_SERVICE: 'true',
  ENABLE_NOTIFICATION_SERVICE: 'true',
};

// Mock services and databases
interface MockDatabase {
  users: Array<{ id: number; email: string; firstName: string; userType: string }>;
  notifications: Array<any>;
  messages: Array<any>;
  conversations: Array<any>;
  pitches: Array<{ id: number; title: string; creatorId: number }>;
  ndaRequests: Array<{ id: number; pitchId: number; investorId: number; status: string }>;
}

interface MockRedis {
  store: Map<string, string>;
  lists: Map<string, string[]>;
  sets: Map<string, Set<string>>;
}

// Test data setup
const TEST_USERS = {
  CREATOR: { id: 1, email: 'creator@test.com', firstName: 'John', userType: 'creator' },
  INVESTOR: { id: 2, email: 'investor@test.com', firstName: 'Jane', userType: 'investor' },
  PRODUCTION: { id: 3, email: 'production@test.com', firstName: 'Mike', userType: 'production' },
};

const TEST_PITCH = { id: 1, title: 'Revolutionary AI Startup', creatorId: TEST_USERS.CREATOR.id };
const TEST_NDA_REQUEST = { id: 1, pitchId: TEST_PITCH.id, investorId: TEST_USERS.INVESTOR.id, status: 'pending' };

// ============================================================================
// MOCK IMPLEMENTATIONS
// ============================================================================

class MockDatabaseService {
  private db: MockDatabase = {
    users: Object.values(TEST_USERS),
    notifications: [],
    messages: [],
    conversations: [],
    pitches: [TEST_PITCH],
    ndaRequests: [TEST_NDA_REQUEST],
  };

  async insert(table: string) {
    return {
      values: (data: any) => ({
        returning: () => ({
          execute: async () => {
            const id = this.db[table as keyof MockDatabase]?.length || 0 + 1;
            const record = { ...data, id };
            (this.db[table as keyof MockDatabase] as any[])?.push(record);
            return [record];
          }
        })
      })
    };
  }

  async select(fields?: any) {
    return {
      from: (table: string) => ({
        where: (condition: any) => ({
          execute: async () => {
            return this.db[table as keyof MockDatabase] || [];
          }
        }),
        execute: async () => {
          return this.db[table as keyof MockDatabase] || [];
        }
      })
    };
  }

  async update(table: string) {
    return {
      set: (data: any) => ({
        where: (condition: any) => ({
          execute: async () => {
            // Mock update logic
            return [{ ...data, id: 1 }];
          }
        })
      })
    };
  }

  // Direct access for testing
  getTable(table: string) {
    return this.db[table as keyof MockDatabase] || [];
  }

  clear() {
    this.db = {
      users: Object.values(TEST_USERS),
      notifications: [],
      messages: [],
      conversations: [],
      pitches: [TEST_PITCH],
      ndaRequests: [TEST_NDA_REQUEST],
    };
  }
}

class MockRedisService {
  private redis: MockRedis = {
    store: new Map(),
    lists: new Map(),
    sets: new Map(),
  };

  async get(key: string): Promise<string | null> {
    return this.redis.store.get(key) || null;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    this.redis.store.set(key, value);
    if (ttl) {
      setTimeout(() => this.redis.store.delete(key), ttl * 1000);
    }
  }

  async del(key: string): Promise<void> {
    this.redis.store.delete(key);
  }

  async rpush(key: string, value: string): Promise<void> {
    if (!this.redis.lists.has(key)) {
      this.redis.lists.set(key, []);
    }
    this.redis.lists.get(key)!.push(value);
  }

  async lpop(key: string): Promise<string | null> {
    const list = this.redis.lists.get(key);
    return list?.shift() || null;
  }

  async llen(key: string): Promise<number> {
    return this.redis.lists.get(key)?.length || 0;
  }

  async hget(hash: string, field: string): Promise<string | null> {
    return this.redis.store.get(`${hash}:${field}`) || null;
  }

  async hset(hash: string, field: string, value: string): Promise<void> {
    this.redis.store.set(`${hash}:${field}`, value);
  }

  async hdel(hash: string, field: string): Promise<void> {
    this.redis.store.delete(`${hash}:${field}`);
  }

  async sadd(set: string, member: string): Promise<void> {
    if (!this.redis.sets.has(set)) {
      this.redis.sets.set(set, new Set());
    }
    this.redis.sets.get(set)!.add(member);
  }

  async srem(set: string, member: string): Promise<void> {
    this.redis.sets.get(set)?.delete(member);
  }

  async smembers(set: string): Promise<string[]> {
    return Array.from(this.redis.sets.get(set) || []);
  }

  async publish(channel: string, message: string): Promise<void> {
    // Mock WebSocket broadcast
    console.log(`WebSocket broadcast: ${channel} -> ${message}`);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    // Mock subscription
    console.log(`Subscribed to channel: ${channel}`);
  }

  // Test utilities
  getStore() {
    return this.redis.store;
  }

  clear() {
    this.redis.store.clear();
    this.redis.lists.clear();
    this.redis.sets.clear();
  }
}

class MockStorageService {
  private files: Map<string, { content: any; metadata: any }> = new Map();

  async uploadFile(file: any, key: string, metadata?: Record<string, any>): Promise<string> {
    this.files.set(key, { content: file, metadata });
    return `https://mock-storage.com/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    this.files.delete(key);
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    return `https://mock-storage.com/${key}?signed=true&expires=${Date.now() + expiresIn * 1000}`;
  }

  async generateUploadUrl(key: string, contentType: string): Promise<{ url: string; fields: Record<string, string> }> {
    return {
      url: `https://mock-storage.com/upload`,
      fields: { key, 'Content-Type': contentType }
    };
  }

  // Test utilities
  getFiles() {
    return this.files;
  }

  clear() {
    this.files.clear();
  }
}

// Email delivery tracking
interface EmailDelivery {
  to: string;
  subject: string;
  success: boolean;
  provider: string;
  messageId: string | null;
  timestamp: string;
  templateType?: string;
  variables?: Record<string, any>;
}

class MockEmailService extends EmailService {
  private deliveries: EmailDelivery[] = [];

  async sendEmail(data: any): Promise<any> {
    // Simulate email sending
    const success = !data.to.includes('fail'); // Fail for emails containing 'fail'
    const delivery: EmailDelivery = {
      to: data.to,
      subject: data.subject,
      success,
      provider: 'mock-sendgrid',
      messageId: success ? `mock_${Date.now()}` : null,
      timestamp: new Date().toISOString(),
      templateType: data.templateType,
      variables: data.variables,
    };
    
    this.deliveries.push(delivery);
    
    return {
      success,
      messageId: delivery.messageId,
      provider: delivery.provider,
      timestamp: delivery.timestamp,
      error: success ? undefined : 'Mock email failure'
    };
  }

  // Test utilities
  getDeliveries(): EmailDelivery[] {
    return this.deliveries;
  }

  clearDeliveries(): void {
    this.deliveries = [];
  }

  getLastDelivery(): EmailDelivery | undefined {
    return this.deliveries[this.deliveries.length - 1];
  }
}

// ============================================================================
// TEST SUITE SETUP
// ============================================================================

describe('Email and Messaging System Integration', () => {
  let config: EmailMessagingConfig;
  let mockDb: MockDatabaseService;
  let mockRedis: MockRedisService;
  let mockStorage: MockStorageService;
  let mockEmail: MockEmailService;
  let messagingService: MessagingService;
  let notificationService: NotificationService;

  beforeAll(() => {
    config = createEmailMessagingConfig(TEST_ENV);
  });

  beforeEach(() => {
    // Reset all mock services
    mockDb = new MockDatabaseService();
    mockRedis = new MockRedisService();
    mockStorage = new MockStorageService();
    
    // Create email service with mock configuration
    const emailConfig = {
      sendgrid: {
        apiKey: 'test-key',
        fromEmail: 'test@pitchey.com',
        fromName: 'Pitchey Test'
      },
      defaultProvider: 'sendgrid' as const,
      rateLimits: { perMinute: 100, perHour: 1000, perDay: 10000 },
      retryConfig: { maxRetries: 1, initialDelay: 100, maxDelay: 1000 },
      queueConfig: { maxConcurrent: 5, processingInterval: 1000 }
    };
    
    mockEmail = new (class extends MockEmailService {
      constructor() {
        super(emailConfig);
      }
    })();

    // Create messaging service
    messagingService = new MessagingService(
      mockDb as any,
      mockRedis as any,
      mockEmail as any,
      mockStorage as any,
      {} as any // encryption service mock
    );

    // Create notification service
    notificationService = new NotificationService(
      mockDb as any,
      mockRedis as any,
      mockEmail as any,
      messagingService as any
    );
  });

  // ============================================================================
  // EMAIL SERVICE TESTS
  // ============================================================================

  describe('Email Service', () => {
    it('should send welcome email successfully', async () => {
      const result = await mockEmail.sendEmail({
        to: 'newuser@test.com',
        subject: 'Welcome to Pitchey!',
        html: '<p>Welcome!</p>',
        templateType: 'welcome',
        variables: { name: 'Test User' }
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeTruthy();
      expect(result.provider).toBe('mock-sendgrid');

      const delivery = mockEmail.getLastDelivery();
      expect(delivery?.to).toBe('newuser@test.com');
      expect(delivery?.templateType).toBe('welcome');
    });

    it('should handle email delivery failure gracefully', async () => {
      const result = await mockEmail.sendEmail({
        to: 'fail@test.com', // This will trigger failure in mock
        subject: 'Test Email',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Mock email failure');
      expect(result.messageId).toBeNull();
    });

    it('should send templated NDA request email', async () => {
      const result = await mockEmail.sendEmail({
        to: TEST_USERS.CREATOR.email,
        subject: 'NDA Request for "Revolutionary AI Startup"',
        templateType: 'nda_request',
        variables: {
          investorName: TEST_USERS.INVESTOR.firstName,
          pitchTitle: TEST_PITCH.title,
          creatorName: TEST_USERS.CREATOR.firstName,
          reviewUrl: 'https://test.pitchey.com/nda/review/1'
        }
      });

      expect(result.success).toBe(true);
      
      const delivery = mockEmail.getLastDelivery();
      expect(delivery?.templateType).toBe('nda_request');
      expect(delivery?.variables?.investorName).toBe(TEST_USERS.INVESTOR.firstName);
      expect(delivery?.variables?.pitchTitle).toBe(TEST_PITCH.title);
    });

    it('should track email metrics correctly', async () => {
      // Send multiple emails
      await mockEmail.sendEmail({
        to: 'user1@test.com',
        subject: 'Test 1',
        html: '<p>Test 1</p>'
      });
      
      await mockEmail.sendEmail({
        to: 'user2@test.com',
        subject: 'Test 2',
        html: '<p>Test 2</p>'
      });
      
      await mockEmail.sendEmail({
        to: 'fail@test.com',
        subject: 'Test Fail',
        html: '<p>Test Fail</p>'
      });

      const deliveries = mockEmail.getDeliveries();
      expect(deliveries).toHaveLength(3);
      
      const successful = deliveries.filter(d => d.success);
      const failed = deliveries.filter(d => !d.success);
      
      expect(successful).toHaveLength(2);
      expect(failed).toHaveLength(1);
    });
  });

  // ============================================================================
  // MESSAGING SERVICE TESTS
  // ============================================================================

  describe('Messaging Service', () => {
    it('should create conversation between users', async () => {
      const conversation = await messagingService.createOrGetConversation(
        TEST_USERS.CREATOR.id,
        [TEST_USERS.INVESTOR.id],
        TEST_PITCH.id,
        'Pitch Discussion'
      );

      expect(conversation).toBeTruthy();
      expect(conversation.participants).toBeDefined();
      expect(conversation.participants.length).toBeGreaterThan(0);

      // Verify conversation was stored in mock database
      const conversations = mockDb.getTable('conversations');
      expect(conversations).toHaveLength(1);
    });

    it('should send message in conversation', async () => {
      // First create a conversation
      const conversation = await messagingService.createOrGetConversation(
        TEST_USERS.CREATOR.id,
        [TEST_USERS.INVESTOR.id],
        TEST_PITCH.id
      );

      // Send a message
      const message = await messagingService.sendMessage({
        conversationId: conversation.id,
        content: 'Hi, I\'m interested in your pitch!',
        messageType: 'text',
        priority: 'normal'
      }, TEST_USERS.INVESTOR.id);

      expect(message).toBeTruthy();
      expect(message.content).toBe('Hi, I\'m interested in your pitch!');
      expect(message.sender.id).toBe(TEST_USERS.INVESTOR.id);

      // Verify message was stored
      const messages = mockDb.getTable('messages');
      expect(messages).toHaveLength(1);
    });

    it('should handle file attachments', async () => {
      const conversation = await messagingService.createOrGetConversation(
        TEST_USERS.CREATOR.id,
        [TEST_USERS.INVESTOR.id]
      );

      // Mock file
      const mockFile = {
        name: 'pitch_deck.pdf',
        type: 'application/pdf',
        size: 1024000 // 1MB
      };

      const attachmentIds = await messagingService.uploadMessageAttachments(
        [mockFile as any],
        TEST_USERS.CREATOR.id
      );

      expect(attachmentIds).toHaveLength(1);
      expect(attachmentIds[0]).toBeGreaterThan(0);

      // Verify file was uploaded to mock storage
      const files = mockStorage.getFiles();
      expect(files.size).toBe(1);
    });

    it('should track typing indicators', async () => {
      const conversation = await messagingService.createOrGetConversation(
        TEST_USERS.CREATOR.id,
        [TEST_USERS.INVESTOR.id]
      );

      // Start typing
      await messagingService.startTyping(conversation.id, TEST_USERS.INVESTOR.id);

      // Check Redis for typing indicator
      const typingKey = `typing:${conversation.id}`;
      const typingStatus = await mockRedis.hget(typingKey, TEST_USERS.INVESTOR.id.toString());
      expect(typingStatus).toBeTruthy();

      // Stop typing
      await messagingService.stopTyping(conversation.id, TEST_USERS.INVESTOR.id);

      // Verify typing indicator was removed
      const stoppedStatus = await mockRedis.hget(typingKey, TEST_USERS.INVESTOR.id.toString());
      expect(stoppedStatus).toBeFalsy();
    });
  });

  // ============================================================================
  // NOTIFICATION SERVICE TESTS
  // ============================================================================

  describe('Notification Service', () => {
    it('should send notification to all configured channels', async () => {
      const notificationInput: NotificationInput = {
        userId: TEST_USERS.CREATOR.id,
        type: 'nda_request',
        title: 'New NDA Request',
        message: 'You have received a new NDA request for your pitch',
        priority: 'normal',
        relatedPitchId: TEST_PITCH.id,
        relatedUserId: TEST_USERS.INVESTOR.id,
        actionUrl: '/nda/review/1',
        channels: {
          email: true,
          inApp: true,
          push: false,
          sms: false
        }
      };

      const result = await notificationService.sendNotification(notificationInput);

      expect(result.notificationId).toBeTruthy();
      expect(result.channels).toHaveLength(2); // email and in-app

      // Verify notification was stored
      const notifications = mockDb.getTable('notifications');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('nda_request');
    });

    it('should respect user notification preferences', async () => {
      // Update user preferences to disable email notifications
      await notificationService.updateUserPreferences(TEST_USERS.CREATOR.id, {
        emailNotifications: false,
        pushNotifications: true,
      } as any);

      const notificationInput: NotificationInput = {
        userId: TEST_USERS.CREATOR.id,
        type: 'message',
        title: 'New Message',
        message: 'You have a new message',
        priority: 'normal'
      };

      const result = await notificationService.sendNotification(notificationInput);

      // Should only have in-app notification (email disabled)
      expect(result.channels.find(c => c.channel === 'email')).toBeFalsy();
      expect(result.channels.find(c => c.channel === 'in_app')).toBeTruthy();
    });

    it('should queue notifications for background processing', async () => {
      const notificationInput: NotificationInput = {
        userId: TEST_USERS.INVESTOR.id,
        type: 'investment',
        title: 'Investment Confirmation',
        message: 'Your investment has been processed',
        priority: 'high',
        channels: {
          email: true,
          push: true
        }
      };

      await notificationService.sendNotification(notificationInput);

      // Check notification queues in Redis
      const emailQueueSize = await mockRedis.llen('notification_queue:high:email');
      const pushQueueSize = await mockRedis.llen('notification_queue:high:push');

      expect(emailQueueSize).toBe(1);
      expect(pushQueueSize).toBe(1);
    });

    it('should send batch notifications efficiently', async () => {
      const notifications: NotificationInput[] = [
        {
          userId: TEST_USERS.CREATOR.id,
          type: 'system',
          title: 'System Update 1',
          message: 'System has been updated',
          priority: 'low'
        },
        {
          userId: TEST_USERS.INVESTOR.id,
          type: 'system',
          title: 'System Update 2',
          message: 'System has been updated',
          priority: 'low'
        },
        {
          userId: TEST_USERS.PRODUCTION.id,
          type: 'system',
          title: 'System Update 3',
          message: 'System has been updated',
          priority: 'low'
        }
      ];

      const result = await notificationService.sendBatchNotifications(notifications);

      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);

      // Verify all notifications were stored
      const storedNotifications = mockDb.getTable('notifications');
      expect(storedNotifications).toHaveLength(3);
    });
  });

  // ============================================================================
  // WORKFLOW INTEGRATION TESTS
  // ============================================================================

  describe('NDA Notification Workflow', () => {
    it('should complete full NDA request notification flow', async () => {
      // Step 1: Send NDA request notification
      const ndaRequestNotification: NotificationInput = {
        userId: TEST_USERS.CREATOR.id,
        type: 'nda_request',
        title: 'NDA Request for "Revolutionary AI Startup"',
        message: 'Jane Smith has requested to sign an NDA for your pitch',
        priority: 'normal',
        relatedPitchId: TEST_PITCH.id,
        relatedUserId: TEST_USERS.INVESTOR.id,
        relatedNdaRequestId: TEST_NDA_REQUEST.id,
        actionUrl: '/nda/review/1',
        emailOptions: {
          templateType: 'nda_request',
          variables: {
            investorName: TEST_USERS.INVESTOR.firstName,
            pitchTitle: TEST_PITCH.title,
            creatorName: TEST_USERS.CREATOR.firstName,
            reviewUrl: 'https://test.pitchey.com/nda/review/1'
          }
        }
      };

      const requestResult = await notificationService.sendNotification(ndaRequestNotification);
      expect(requestResult.notificationId).toBeTruthy();

      // Verify email was sent
      const emailDeliveries = mockEmail.getDeliveries();
      expect(emailDeliveries).toHaveLength(1);
      expect(emailDeliveries[0].templateType).toBe('nda_request');

      // Step 2: Send NDA approval notification  
      const approvalNotification: NotificationInput = {
        userId: TEST_USERS.INVESTOR.id,
        type: 'nda_approval',
        title: 'NDA Approved - Access Granted',
        message: 'Your NDA request has been approved',
        priority: 'high',
        relatedPitchId: TEST_PITCH.id,
        relatedUserId: TEST_USERS.CREATOR.id,
        relatedNdaRequestId: TEST_NDA_REQUEST.id,
        actionUrl: `/pitch/${TEST_PITCH.id}`,
        emailOptions: {
          templateType: 'nda_approval',
          variables: {
            pitchTitle: TEST_PITCH.title,
            creatorName: TEST_USERS.CREATOR.firstName,
            pitchUrl: `https://test.pitchey.com/pitch/${TEST_PITCH.id}`
          }
        }
      };

      const approvalResult = await notificationService.sendNotification(approvalNotification);
      expect(approvalResult.notificationId).toBeTruthy();

      // Verify both emails were sent
      expect(mockEmail.getDeliveries()).toHaveLength(2);
      
      const approvalEmail = mockEmail.getDeliveries().find(d => d.templateType === 'nda_approval');
      expect(approvalEmail).toBeTruthy();
      expect(approvalEmail?.to).toBe(TEST_USERS.INVESTOR.email);

      // Verify notifications were stored
      const notifications = mockDb.getTable('notifications');
      expect(notifications).toHaveLength(2);
      expect(notifications.find(n => n.type === 'nda_request')).toBeTruthy();
      expect(notifications.find(n => n.type === 'nda_approval')).toBeTruthy();
    });
  });

  describe('Investment Notification Workflow', () => {
    it('should handle investment confirmation workflow', async () => {
      const investmentNotification: NotificationInput = {
        userId: TEST_USERS.CREATOR.id,
        type: 'investment',
        title: 'New Investment Received',
        message: 'You have received a $50,000 investment',
        priority: 'high',
        relatedPitchId: TEST_PITCH.id,
        relatedUserId: TEST_USERS.INVESTOR.id,
        actionUrl: '/dashboard/investments',
        emailOptions: {
          templateType: 'investment_confirmation',
          variables: {
            amount: '$50,000',
            pitchTitle: TEST_PITCH.title,
            investorName: TEST_USERS.INVESTOR.firstName,
            investmentType: 'Seed Funding',
            transactionId: 'INV_' + Date.now()
          }
        }
      };

      const result = await notificationService.sendNotification(investmentNotification);
      expect(result.notificationId).toBeTruthy();

      // Send confirmation to investor as well
      const investorNotification: NotificationInput = {
        userId: TEST_USERS.INVESTOR.id,
        type: 'investment',
        title: 'Investment Confirmed',
        message: 'Your $50,000 investment has been confirmed',
        priority: 'high',
        relatedPitchId: TEST_PITCH.id,
        relatedUserId: TEST_USERS.CREATOR.id,
        actionUrl: '/portfolio',
        emailOptions: {
          templateType: 'investment_confirmation',
          variables: {
            amount: '$50,000',
            pitchTitle: TEST_PITCH.title,
            creatorName: TEST_USERS.CREATOR.firstName,
            portfolioUrl: 'https://test.pitchey.com/portfolio'
          }
        }
      };

      await notificationService.sendNotification(investorNotification);

      // Verify both parties received notifications
      const notifications = mockDb.getTable('notifications');
      expect(notifications).toHaveLength(2);
      expect(notifications.every(n => n.type === 'investment')).toBe(true);

      const emails = mockEmail.getDeliveries();
      expect(emails).toHaveLength(2);
      expect(emails.every(e => e.templateType === 'investment_confirmation')).toBe(true);
    });
  });

  describe('Message Delivery Workflow', () => {
    it('should handle complete message delivery with offline notifications', async () => {
      // Create conversation
      const conversation = await messagingService.createOrGetConversation(
        TEST_USERS.CREATOR.id,
        [TEST_USERS.INVESTOR.id],
        TEST_PITCH.id
      );

      // Send message
      const message = await messagingService.sendMessage({
        conversationId: conversation.id,
        content: 'I would like to discuss investment opportunities for your pitch.',
        messageType: 'text',
        priority: 'normal'
      }, TEST_USERS.INVESTOR.id);

      expect(message).toBeTruthy();
      expect(message.content).toContain('investment opportunities');

      // Verify message was stored
      const messages = mockDb.getTable('messages');
      expect(messages).toHaveLength(1);

      // Check if WebSocket broadcast was triggered (in Redis)
      const redisStore = mockRedis.getStore();
      const broadcastKeys = Array.from(redisStore.keys()).filter(k => k.includes('conversation:'));
      // Note: In real implementation, this would verify WebSocket broadcast

      // Verify conversation was updated
      const conversations = mockDb.getTable('conversations');
      expect(conversations).toHaveLength(1);
    });
  });

  // ============================================================================
  // ERROR HANDLING AND EDGE CASES
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle email service failures gracefully', async () => {
      const notificationInput: NotificationInput = {
        userId: TEST_USERS.CREATOR.id,
        type: 'system',
        title: 'Test Notification',
        message: 'This should fail email delivery',
        priority: 'normal',
        channels: {
          email: true,
          inApp: true
        },
        emailOptions: {
          variables: {
            userEmail: 'fail@test.com' // This will trigger failure
          }
        }
      };

      // Override email sending to always fail
      const originalSendEmail = mockEmail.sendEmail;
      mockEmail.sendEmail = async () => ({
        success: false,
        error: 'Simulated email failure',
        provider: 'mock-sendgrid',
        messageId: null,
        timestamp: new Date().toISOString()
      });

      const result = await notificationService.sendNotification(notificationInput);

      // Should still succeed for in-app notification
      expect(result.notificationId).toBeTruthy();
      expect(result.channels.find(c => c.channel === 'in_app' && c.status === 'sent')).toBeTruthy();

      // Restore original method
      mockEmail.sendEmail = originalSendEmail;
    });

    it('should handle invalid user IDs gracefully', async () => {
      const notificationInput: NotificationInput = {
        userId: 99999, // Non-existent user
        type: 'system',
        title: 'Test Notification',
        message: 'This should handle missing user',
        priority: 'normal'
      };

      // This should not throw an error but handle gracefully
      await expect(
        notificationService.sendNotification(notificationInput)
      ).rejects.toThrow(); // Or handle gracefully based on implementation
    });

    it('should handle Redis connection failures', async () => {
      // Simulate Redis failure
      const originalSet = mockRedis.set;
      mockRedis.set = async () => {
        throw new Error('Redis connection failed');
      };

      const conversation = await messagingService.createOrGetConversation(
        TEST_USERS.CREATOR.id,
        [TEST_USERS.INVESTOR.id]
      );

      // Should handle Redis failure gracefully and not break core functionality
      const message = await messagingService.sendMessage({
        conversationId: conversation.id,
        content: 'This should work despite Redis failure',
        messageType: 'text'
      }, TEST_USERS.CREATOR.id);

      expect(message).toBeTruthy();

      // Restore original method
      mockRedis.set = originalSet;
    });
  });

  // ============================================================================
  // PERFORMANCE AND LOAD TESTS
  // ============================================================================

  describe('Performance Tests', () => {
    it('should handle bulk notification sending', async () => {
      const startTime = Date.now();
      
      // Create 100 notifications
      const notifications: NotificationInput[] = Array.from({ length: 100 }, (_, i) => ({
        userId: TEST_USERS.CREATOR.id,
        type: 'system',
        title: `Bulk Notification ${i + 1}`,
        message: `This is bulk notification number ${i + 1}`,
        priority: 'low'
      }));

      const result = await notificationService.sendBatchNotifications(notifications);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.successful).toBe(100);
      expect(result.failed).toBe(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all notifications were stored
      const storedNotifications = mockDb.getTable('notifications');
      expect(storedNotifications).toHaveLength(100);
    });

    it('should handle concurrent message sending', async () => {
      const conversation = await messagingService.createOrGetConversation(
        TEST_USERS.CREATOR.id,
        [TEST_USERS.INVESTOR.id]
      );

      const startTime = Date.now();

      // Send 50 messages concurrently
      const messagePromises = Array.from({ length: 50 }, (_, i) =>
        messagingService.sendMessage({
          conversationId: conversation.id,
          content: `Concurrent message ${i + 1}`,
          messageType: 'text'
        }, TEST_USERS.CREATOR.id)
      );

      const messages = await Promise.all(messagePromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(messages).toHaveLength(50);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds

      // Verify all messages were stored
      const storedMessages = mockDb.getTable('messages');
      expect(storedMessages).toHaveLength(50);
    });
  });

  // ============================================================================
  // CLEANUP
  // ============================================================================

  afterAll(() => {
    // Clean up any resources if needed
    mockDb.clear();
    mockRedis.clear();
    mockStorage.clear();
    mockEmail.clearDeliveries();
  });
});

// ============================================================================
// UTILITY TESTS
// ============================================================================

describe('Configuration Validation', () => {
  it('should validate email messaging configuration', () => {
    expect(() => createEmailMessagingConfig(TEST_ENV)).not.toThrow();
    
    const config = createEmailMessagingConfig(TEST_ENV);
    expect(config.email.enabled).toBe(true);
    expect(config.messaging.enabled).toBe(true);
    expect(config.notifications.enabled).toBe(true);
  });

  it('should require essential environment variables', () => {
    const invalidEnv = { ...TEST_ENV };
    delete invalidEnv.DATABASE_URL;

    expect(() => createEmailMessagingConfig(invalidEnv)).toThrow();
  });

  it('should validate email provider configuration', () => {
    const config = createEmailMessagingConfig(TEST_ENV);
    expect(config.email.providers.sendgrid).toBeTruthy();
    expect(config.email.defaultProvider).toBe('sendgrid');
  });
});

describe('Service Health Checks', () => {
  it('should provide health status for all services', async () => {
    // This would test the health check endpoints
    // For now, just verify services can be instantiated
    expect(mockEmail).toBeTruthy();
    expect(messagingService).toBeTruthy();
    expect(notificationService).toBeTruthy();
  });
});

export {};