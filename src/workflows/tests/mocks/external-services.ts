/**
 * Mock implementations for external services used in Cloudflare Workflows
 * 
 * This module provides comprehensive mocks for:
 * - Stripe payment processing
 * - DocuSign document signing
 * - Database operations (Neon PostgreSQL)
 * - Notification services (SendGrid, Pusher)
 * - Document storage (Cloudflare R2)
 * - Cache services (Upstash Redis)
 * 
 * These mocks simulate real-world behavior including failures, delays,
 * and edge cases for comprehensive testing.
 */

import { vi, type MockedFunction } from 'vitest';

// ============================================================================
// Type Definitions
// ============================================================================

export interface StripePaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled';
  metadata: Record<string, string>;
  payment_method?: string;
  last_payment_error?: {
    type: string;
    code: string;
    message: string;
  };
}

export interface DocuSignEnvelope {
  envelopeId: string;
  status: 'created' | 'sent' | 'delivered' | 'completed' | 'declined' | 'voided';
  emailSubject: string;
  recipients: Array<{
    email: string;
    name: string;
    status: string;
    signedDateTime?: string;
  }>;
  documents: Array<{
    documentId: string;
    name: string;
    pages?: number;
  }>;
}

export interface NotificationPayload {
  type: string;
  recipientId: string;
  recipientType: string;
  data: Record<string, any>;
  channels: string[];
  priority: 'low' | 'normal' | 'high';
}

// ============================================================================
// Stripe Service Mock
// ============================================================================

export class StripeServiceMock {
  private paymentIntents: Map<string, StripePaymentIntent> = new Map();
  private webhookEvents: any[] = [];
  
  constructor() {
    this.reset();
  }

  reset() {
    this.paymentIntents.clear();
    this.webhookEvents = [];
  }

  createPaymentIntent = vi.fn().mockImplementation(async (params: {
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
  }): Promise<StripePaymentIntent> => {
    const paymentIntent: StripePaymentIntent = {
      id: `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: params.amount,
      currency: params.currency,
      status: 'requires_payment_method',
      metadata: params.metadata || {}
    };

    this.paymentIntents.set(paymentIntent.id, paymentIntent);
    
    // Simulate webhook event
    this.webhookEvents.push({
      type: 'payment_intent.created',
      data: { object: paymentIntent },
      created: Math.floor(Date.now() / 1000)
    });

    return paymentIntent;
  });

  confirmPaymentIntent = vi.fn().mockImplementation(async (
    paymentIntentId: string,
    params?: { payment_method?: string }
  ): Promise<StripePaymentIntent> => {
    const intent = this.paymentIntents.get(paymentIntentId);
    if (!intent) {
      throw new Error(`Payment intent ${paymentIntentId} not found`);
    }

    // Simulate different outcomes based on payment method or random
    const shouldSucceed = params?.payment_method !== 'pm_card_chargeDeclined' && Math.random() > 0.1;

    if (shouldSucceed) {
      intent.status = 'succeeded';
      intent.payment_method = params?.payment_method || 'pm_card_visa';
      
      this.webhookEvents.push({
        type: 'payment_intent.succeeded',
        data: { object: intent },
        created: Math.floor(Date.now() / 1000)
      });
    } else {
      intent.status = 'requires_payment_method';
      intent.last_payment_error = {
        type: 'card_error',
        code: 'card_declined',
        message: 'Your card was declined.'
      };
      
      this.webhookEvents.push({
        type: 'payment_intent.payment_failed',
        data: { object: intent },
        created: Math.floor(Date.now() / 1000)
      });
    }

    this.paymentIntents.set(paymentIntentId, intent);
    return intent;
  });

  retrievePaymentIntent = vi.fn().mockImplementation(async (paymentIntentId: string): Promise<StripePaymentIntent> => {
    const intent = this.paymentIntents.get(paymentIntentId);
    if (!intent) {
      throw new Error(`Payment intent ${paymentIntentId} not found`);
    }
    return intent;
  });

  cancelPaymentIntent = vi.fn().mockImplementation(async (paymentIntentId: string): Promise<StripePaymentIntent> => {
    const intent = this.paymentIntents.get(paymentIntentId);
    if (!intent) {
      throw new Error(`Payment intent ${paymentIntentId} not found`);
    }

    intent.status = 'canceled';
    this.paymentIntents.set(paymentIntentId, intent);
    
    this.webhookEvents.push({
      type: 'payment_intent.canceled',
      data: { object: intent },
      created: Math.floor(Date.now() / 1000)
    });

    return intent;
  });

  // Simulate refund processing
  createRefund = vi.fn().mockImplementation(async (params: {
    payment_intent: string;
    amount?: number;
    reason?: string;
  }) => {
    const refund = {
      id: `re_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: params.amount,
      status: 'succeeded',
      payment_intent: params.payment_intent,
      reason: params.reason || 'requested_by_customer',
      created: Math.floor(Date.now() / 1000)
    };

    this.webhookEvents.push({
      type: 'charge.refunded',
      data: { object: refund },
      created: Math.floor(Date.now() / 1000)
    });

    return refund;
  });

  // Get all webhook events for testing
  getWebhookEvents() {
    return [...this.webhookEvents];
  }

  // Simulate webhook signature verification
  constructEvent = vi.fn().mockImplementation((payload: string, signature: string, secret: string) => {
    // In real implementation, this would verify the signature
    // For testing, we just parse the payload
    try {
      return JSON.parse(payload);
    } catch {
      throw new Error('Invalid JSON payload');
    }
  });
}

// ============================================================================
// DocuSign Service Mock
// ============================================================================

export class DocuSignServiceMock {
  private envelopes: Map<string, DocuSignEnvelope> = new Map();
  private webhookEvents: any[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.envelopes.clear();
    this.webhookEvents = [];
  }

  createEnvelope = vi.fn().mockImplementation(async (params: {
    emailSubject: string;
    documents: Array<{
      name: string;
      documentBase64: string;
      documentId: string;
    }>;
    recipients: Array<{
      email: string;
      name: string;
      recipientId: string;
    }>;
  }): Promise<DocuSignEnvelope> => {
    const envelope: DocuSignEnvelope = {
      envelopeId: `env_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'created',
      emailSubject: params.emailSubject,
      recipients: params.recipients.map(r => ({
        ...r,
        status: 'created'
      })),
      documents: params.documents.map(d => ({
        documentId: d.documentId,
        name: d.name,
        pages: Math.floor(Math.random() * 50) + 1
      }))
    };

    this.envelopes.set(envelope.envelopeId, envelope);

    this.webhookEvents.push({
      type: 'envelope.created',
      data: { object: envelope },
      created: Math.floor(Date.now() / 1000)
    });

    return envelope;
  });

  sendEnvelope = vi.fn().mockImplementation(async (envelopeId: string): Promise<DocuSignEnvelope> => {
    const envelope = this.envelopes.get(envelopeId);
    if (!envelope) {
      throw new Error(`Envelope ${envelopeId} not found`);
    }

    envelope.status = 'sent';
    envelope.recipients = envelope.recipients.map(r => ({
      ...r,
      status: 'sent'
    }));

    this.envelopes.set(envelopeId, envelope);

    this.webhookEvents.push({
      type: 'envelope.sent',
      data: { object: envelope },
      created: Math.floor(Date.now() / 1000)
    });

    // Simulate delivery after short delay
    setTimeout(() => {
      this.simulateEnvelopeDelivery(envelopeId);
    }, 100);

    return envelope;
  });

  private simulateEnvelopeDelivery(envelopeId: string) {
    const envelope = this.envelopes.get(envelopeId);
    if (!envelope) return;

    envelope.status = 'delivered';
    envelope.recipients = envelope.recipients.map(r => ({
      ...r,
      status: 'delivered'
    }));

    this.envelopes.set(envelopeId, envelope);

    this.webhookEvents.push({
      type: 'envelope.delivered',
      data: { object: envelope },
      created: Math.floor(Date.now() / 1000)
    });
  }

  // Simulate recipient signing
  simulateRecipientSigning = vi.fn().mockImplementation(async (
    envelopeId: string,
    recipientEmail: string,
    shouldDecline: boolean = false
  ): Promise<DocuSignEnvelope> => {
    const envelope = this.envelopes.get(envelopeId);
    if (!envelope) {
      throw new Error(`Envelope ${envelopeId} not found`);
    }

    const recipient = envelope.recipients.find(r => r.email === recipientEmail);
    if (!recipient) {
      throw new Error(`Recipient ${recipientEmail} not found in envelope`);
    }

    if (shouldDecline) {
      recipient.status = 'declined';
      envelope.status = 'declined';
      
      this.webhookEvents.push({
        type: 'envelope.declined',
        data: { object: envelope },
        created: Math.floor(Date.now() / 1000)
      });
    } else {
      recipient.status = 'completed';
      recipient.signedDateTime = new Date().toISOString();

      // Check if all recipients have signed
      const allSigned = envelope.recipients.every(r => r.status === 'completed');
      if (allSigned) {
        envelope.status = 'completed';
        
        this.webhookEvents.push({
          type: 'envelope.completed',
          data: { object: envelope },
          created: Math.floor(Date.now() / 1000)
        });
      } else {
        this.webhookEvents.push({
          type: 'recipient.signed',
          data: { 
            object: envelope,
            recipient: recipient
          },
          created: Math.floor(Date.now() / 1000)
        });
      }
    }

    this.envelopes.set(envelopeId, envelope);
    return envelope;
  });

  getEnvelope = vi.fn().mockImplementation(async (envelopeId: string): Promise<DocuSignEnvelope> => {
    const envelope = this.envelopes.get(envelopeId);
    if (!envelope) {
      throw new Error(`Envelope ${envelopeId} not found`);
    }
    return envelope;
  });

  voidEnvelope = vi.fn().mockImplementation(async (
    envelopeId: string,
    reason: string
  ): Promise<DocuSignEnvelope> => {
    const envelope = this.envelopes.get(envelopeId);
    if (!envelope) {
      throw new Error(`Envelope ${envelopeId} not found`);
    }

    envelope.status = 'voided';
    this.envelopes.set(envelopeId, envelope);

    this.webhookEvents.push({
      type: 'envelope.voided',
      data: { 
        object: envelope,
        voidReason: reason
      },
      created: Math.floor(Date.now() / 1000)
    });

    return envelope;
  });

  getWebhookEvents() {
    return [...this.webhookEvents];
  }
}

// ============================================================================
// Database Service Mock (Neon PostgreSQL)
// ============================================================================

export class DatabaseServiceMock {
  private data: Map<string, any[]> = new Map();
  private connectionFails = false;
  private queryDelay = 0;

  constructor() {
    this.reset();
  }

  reset() {
    this.data.clear();
    this.connectionFails = false;
    this.queryDelay = 0;
    this.seedTestData();
  }

  // Simulate connection failures
  setConnectionFails(shouldFail: boolean) {
    this.connectionFails = shouldFail;
  }

  // Simulate query delays
  setQueryDelay(delayMs: number) {
    this.queryDelay = delayMs;
  }

  private seedTestData() {
    // Seed test users
    this.data.set('users', [
      {
        id: 'test_user_1',
        email: 'test@example.com',
        name: 'Test User',
        email_verified: true,
        phone_verified: true,
        identity_verified: true,
        trust_score: 85,
        created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]);

    // Seed test pitches
    this.data.set('pitches', [
      {
        id: 'test_pitch_1',
        title: 'Test Movie Pitch',
        creator_id: 'test_user_1',
        funding_goal: 1000000,
        current_funding: 0,
        status: 'active'
      }
    ]);

    // Initialize empty tables
    this.data.set('investment_deals', []);
    this.data.set('production_deals', []);
    this.data.set('ndas', []);
    this.data.set('pitch_access', []);
  }

  query = vi.fn().mockImplementation(async (sql: string, params: any[] = []): Promise<any[]> => {
    if (this.connectionFails) {
      throw new Error('Connection to database failed');
    }

    if (this.queryDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.queryDelay));
    }

    // Simple SQL parser for basic operations
    const sqlLower = sql.toLowerCase().trim();
    
    if (sqlLower.startsWith('select')) {
      return this.handleSelect(sql, params);
    } else if (sqlLower.startsWith('insert')) {
      return this.handleInsert(sql, params);
    } else if (sqlLower.startsWith('update')) {
      return this.handleUpdate(sql, params);
    } else if (sqlLower.startsWith('delete')) {
      return this.handleDelete(sql, params);
    }
    
    // Default return for other operations
    return [];
  });

  private handleSelect(sql: string, params: any[]): any[] {
    // Extract table name (simplified)
    const tableMatch = sql.match(/from\s+(\w+)/i);
    if (!tableMatch) return [];
    
    const tableName = tableMatch[1];
    const tableData = this.data.get(tableName) || [];
    
    // For testing purposes, return filtered results based on common patterns
    if (sql.includes('WHERE')) {
      // Simple filtering for common test cases
      if (params.length > 0) {
        return tableData.filter(row => {
          // Basic parameter matching
          return Object.values(row).some(value => 
            params.some(param => value === param)
          );
        });
      }
    }
    
    return [...tableData];
  }

  private handleInsert(sql: string, params: any[]): any[] {
    // Extract table name
    const tableMatch = sql.match(/insert\s+into\s+(\w+)/i);
    if (!tableMatch) return [];
    
    const tableName = tableMatch[1];
    const tableData = this.data.get(tableName) || [];
    
    // Create a new record with provided parameters
    const newRecord: any = {};
    
    // Extract column names from SQL
    const columnsMatch = sql.match(/\(([^)]+)\)/);
    if (columnsMatch && params.length > 0) {
      const columns = columnsMatch[1].split(',').map(col => col.trim());
      columns.forEach((col, index) => {
        if (index < params.length) {
          newRecord[col] = params[index];
        }
      });
    }
    
    // Add timestamp fields
    newRecord.created_at = newRecord.created_at || new Date().toISOString();
    newRecord.updated_at = new Date().toISOString();
    
    tableData.push(newRecord);
    this.data.set(tableName, tableData);
    
    return [newRecord];
  }

  private handleUpdate(sql: string, params: any[]): any[] {
    const tableMatch = sql.match(/update\s+(\w+)/i);
    if (!tableMatch) return [];
    
    const tableName = tableMatch[1];
    const tableData = this.data.get(tableName) || [];
    
    // Simple update - find by last parameter (usually ID)
    if (params.length >= 2) {
      const whereValue = params[params.length - 1];
      const updatedRows = tableData.map(row => {
        if (Object.values(row).includes(whereValue)) {
          return { ...row, updated_at: new Date().toISOString() };
        }
        return row;
      });
      
      this.data.set(tableName, updatedRows);
      return updatedRows.filter(row => Object.values(row).includes(whereValue));
    }
    
    return [];
  }

  private handleDelete(sql: string, params: any[]): any[] {
    const tableMatch = sql.match(/delete\s+from\s+(\w+)/i);
    if (!tableMatch) return [];
    
    const tableName = tableMatch[1];
    const tableData = this.data.get(tableName) || [];
    
    if (params.length > 0) {
      const whereValue = params[0];
      const filteredData = tableData.filter(row => 
        !Object.values(row).includes(whereValue)
      );
      
      this.data.set(tableName, filteredData);
    }
    
    return [];
  }

  // Helper method to directly insert test data
  insertTestData(tableName: string, data: any[]) {
    this.data.set(tableName, [...(this.data.get(tableName) || []), ...data]);
  }

  // Helper method to get all data for testing
  getTableData(tableName: string) {
    return this.data.get(tableName) || [];
  }
}

// ============================================================================
// Notification Service Mock
// ============================================================================

export class NotificationServiceMock {
  private sentNotifications: NotificationPayload[] = [];
  private failureRate = 0;

  constructor() {
    this.reset();
  }

  reset() {
    this.sentNotifications = [];
    this.failureRate = 0;
  }

  setFailureRate(rate: number) {
    this.failureRate = Math.min(Math.max(rate, 0), 1);
  }

  send = vi.fn().mockImplementation(async (notification: NotificationPayload): Promise<{
    messageId: string;
    status: string;
  }> => {
    if (Math.random() < this.failureRate) {
      throw new Error('Notification service temporarily unavailable');
    }

    this.sentNotifications.push(notification);

    return {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'sent'
    };
  });

  // Email-specific mock
  sendEmail = vi.fn().mockImplementation(async (params: {
    to: string;
    subject: string;
    html: string;
    templateId?: string;
    templateData?: Record<string, any>;
  }) => {
    const notification: NotificationPayload = {
      type: 'email',
      recipientId: params.to,
      recipientType: 'user',
      data: {
        subject: params.subject,
        html: params.html,
        templateId: params.templateId,
        templateData: params.templateData
      },
      channels: ['email'],
      priority: 'normal'
    };

    return this.send(notification);
  });

  // Push notification mock
  sendPush = vi.fn().mockImplementation(async (params: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, any>;
  }) => {
    const notification: NotificationPayload = {
      type: 'push',
      recipientId: params.userId,
      recipientType: 'user',
      data: {
        title: params.title,
        body: params.body,
        ...params.data
      },
      channels: ['push'],
      priority: 'normal'
    };

    return this.send(notification);
  });

  // In-app notification mock
  sendInApp = vi.fn().mockImplementation(async (params: {
    userId: string;
    type: string;
    data: Record<string, any>;
  }) => {
    const notification: NotificationPayload = {
      type: params.type,
      recipientId: params.userId,
      recipientType: 'user',
      data: params.data,
      channels: ['in_app'],
      priority: 'normal'
    };

    return this.send(notification);
  });

  getSentNotifications(): NotificationPayload[] {
    return [...this.sentNotifications];
  }

  getNotificationsByType(type: string): NotificationPayload[] {
    return this.sentNotifications.filter(n => n.type === type);
  }

  getNotificationsByRecipient(recipientId: string): NotificationPayload[] {
    return this.sentNotifications.filter(n => n.recipientId === recipientId);
  }
}

// ============================================================================
// Document Storage Mock (Cloudflare R2)
// ============================================================================

export class DocumentStorageMock {
  private documents: Map<string, string> = new Map();
  private failureRate = 0;
  private uploadDelay = 0;

  constructor() {
    this.reset();
  }

  reset() {
    this.documents.clear();
    this.failureRate = 0;
    this.uploadDelay = 0;
  }

  setFailureRate(rate: number) {
    this.failureRate = Math.min(Math.max(rate, 0), 1);
  }

  setUploadDelay(delayMs: number) {
    this.uploadDelay = delayMs;
  }

  put = vi.fn().mockImplementation(async (key: string, content: string | ArrayBuffer): Promise<{
    url: string;
    etag: string;
  }> => {
    if (Math.random() < this.failureRate) {
      throw new Error('Storage service temporarily unavailable');
    }

    if (this.uploadDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.uploadDelay));
    }

    const contentString = typeof content === 'string' ? content : 'binary_content';
    this.documents.set(key, contentString);

    return {
      url: `https://mock-storage.example.com/${key}`,
      etag: `etag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  });

  get = vi.fn().mockImplementation(async (key: string): Promise<string | null> => {
    if (Math.random() < this.failureRate) {
      throw new Error('Storage service temporarily unavailable');
    }

    return this.documents.get(key) || null;
  });

  delete = vi.fn().mockImplementation(async (key: string): Promise<boolean> => {
    if (Math.random() < this.failureRate) {
      throw new Error('Storage service temporarily unavailable');
    }

    return this.documents.delete(key);
  });

  list = vi.fn().mockImplementation(async (prefix?: string): Promise<string[]> => {
    if (Math.random() < this.failureRate) {
      throw new Error('Storage service temporarily unavailable');
    }

    const keys = Array.from(this.documents.keys());
    return prefix ? keys.filter(key => key.startsWith(prefix)) : keys;
  });

  getStoredDocuments(): Map<string, string> {
    return new Map(this.documents);
  }

  hasDocument(key: string): boolean {
    return this.documents.has(key);
  }
}

// ============================================================================
// Cache Service Mock (Upstash Redis)
// ============================================================================

export class CacheServiceMock {
  private cache: Map<string, { value: any; expiry?: number }> = new Map();
  private failureRate = 0;
  private latency = 0;

  constructor() {
    this.reset();
  }

  reset() {
    this.cache.clear();
    this.failureRate = 0;
    this.latency = 0;
  }

  setFailureRate(rate: number) {
    this.failureRate = Math.min(Math.max(rate, 0), 1);
  }

  setLatency(latencyMs: number) {
    this.latency = latencyMs;
  }

  put = vi.fn().mockImplementation(async (
    key: string, 
    value: any, 
    options?: { expirationTtl?: number }
  ): Promise<boolean> => {
    if (Math.random() < this.failureRate) {
      throw new Error('Cache service temporarily unavailable');
    }

    if (this.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latency));
    }

    const expiry = options?.expirationTtl ? Date.now() + (options.expirationTtl * 1000) : undefined;
    this.cache.set(key, { value, expiry });
    
    return true;
  });

  get = vi.fn().mockImplementation(async (key: string): Promise<any> => {
    if (Math.random() < this.failureRate) {
      throw new Error('Cache service temporarily unavailable');
    }

    if (this.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latency));
    }

    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check expiry
    if (cached.expiry && Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  });

  delete = vi.fn().mockImplementation(async (key: string): Promise<boolean> => {
    if (Math.random() < this.failureRate) {
      throw new Error('Cache service temporarily unavailable');
    }

    if (this.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latency));
    }

    return this.cache.delete(key);
  });

  // Redis-specific operations
  setex = vi.fn().mockImplementation(async (key: string, ttl: number, value: any): Promise<boolean> => {
    return this.put(key, value, { expirationTtl: ttl });
  });

  incr = vi.fn().mockImplementation(async (key: string): Promise<number> => {
    const current = await this.get(key) || 0;
    const newValue = Number(current) + 1;
    await this.put(key, newValue);
    return newValue;
  });

  lpush = vi.fn().mockImplementation(async (key: string, ...values: any[]): Promise<number> => {
    const list = await this.get(key) || [];
    list.unshift(...values);
    await this.put(key, list);
    return list.length;
  });

  rpop = vi.fn().mockImplementation(async (key: string): Promise<any> => {
    const list = await this.get(key);
    if (!Array.isArray(list) || list.length === 0) return null;
    
    const value = list.pop();
    await this.put(key, list);
    return value;
  });

  getCacheKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  getCacheStats() {
    return {
      totalKeys: this.cache.size,
      memoryUsage: JSON.stringify(Array.from(this.cache.entries())).length,
      hitRate: this.failureRate === 0 ? 1 : 1 - this.failureRate
    };
  }
}

// ============================================================================
// Workflow Environment Factory
// ============================================================================

export interface MockWorkflowEnv {
  HYPERDRIVE: { connectionString: string };
  WORKFLOW_INSTANCE_ID: string;
  NOTIFICATION_QUEUE: NotificationServiceMock;
  DOCUMENTS: DocumentStorageMock;
  CONTRACTS: DocumentStorageMock;
  NDA_TEMPLATES: DocumentStorageMock;
  DEAL_CACHE: CacheServiceMock;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  [key: string]: any;
}

export function createMockWorkflowEnv(overrides: Partial<MockWorkflowEnv> = {}): MockWorkflowEnv {
  const baseEnv: MockWorkflowEnv = {
    HYPERDRIVE: { connectionString: 'postgresql://test@localhost/test' },
    WORKFLOW_INSTANCE_ID: `mock_workflow_${Date.now()}`,
    NOTIFICATION_QUEUE: new NotificationServiceMock(),
    DOCUMENTS: new DocumentStorageMock(),
    CONTRACTS: new DocumentStorageMock(),
    NDA_TEMPLATES: new DocumentStorageMock(),
    DEAL_CACHE: new CacheServiceMock(),
    STRIPE_SECRET_KEY: 'sk_test_mock_key',
    STRIPE_WEBHOOK_SECRET: 'whsec_mock_secret',
  };

  return { ...baseEnv, ...overrides };
}

// ============================================================================
// Test Scenario Builders
// ============================================================================

export class TestScenarioBuilder {
  static successfulPayment(amount: number = 100000) {
    return {
      stripeEvents: [
        { type: 'payment_intent.created', amount },
        { type: 'payment_intent.succeeded', amount }
      ],
      expectedOutcome: 'success'
    };
  }

  static failedPayment(errorCode: string = 'card_declined') {
    return {
      stripeEvents: [
        { type: 'payment_intent.created', amount: 100000 },
        { type: 'payment_intent.payment_failed', error: { code: errorCode } }
      ],
      expectedOutcome: 'failure'
    };
  }

  static completedDocuSigning(recipientEmail: string) {
    return {
      docusignEvents: [
        { type: 'envelope.sent', recipient: recipientEmail },
        { type: 'envelope.delivered', recipient: recipientEmail },
        { type: 'envelope.completed', recipient: recipientEmail }
      ],
      expectedOutcome: 'signed'
    };
  }

  static declinedDocuSigning(recipientEmail: string) {
    return {
      docusignEvents: [
        { type: 'envelope.sent', recipient: recipientEmail },
        { type: 'envelope.delivered', recipient: recipientEmail },
        { type: 'envelope.declined', recipient: recipientEmail }
      ],
      expectedOutcome: 'declined'
    };
  }

  static lowRiskNDA() {
    return {
      userProfile: {
        email_verified: true,
        phone_verified: true,
        identity_verified: true,
        trust_score: 90,
        account_age_days: 365
      },
      template: { type: 'standard' },
      customTerms: {},
      expectedRiskLevel: 'low',
      expectedApproval: 'auto'
    };
  }

  static highRiskNDA() {
    return {
      userProfile: {
        email_verified: false,
        phone_verified: false,
        identity_verified: false,
        trust_score: 25,
        account_age_days: 1
      },
      template: { type: 'custom' },
      customTerms: { complex: true },
      priorBreaches: 1,
      expectedRiskLevel: 'high',
      expectedApproval: 'legal_review'
    };
  }
}

// ============================================================================
// Export All Mocks
// ============================================================================

export const allMocks = {
  StripeServiceMock,
  DocuSignServiceMock,
  DatabaseServiceMock,
  NotificationServiceMock,
  DocumentStorageMock,
  CacheServiceMock,
  createMockWorkflowEnv,
  TestScenarioBuilder
};

export default allMocks;