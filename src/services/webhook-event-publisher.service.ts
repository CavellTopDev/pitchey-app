/**
 * Webhook Event Publisher Service
 * Handles event publishing, routing, and integration patterns
 */

import { WebhookService } from './webhook.service';
import { RedisService } from './redis.service';

interface EventPattern {
  eventType: string;
  resourceType?: string;
  condition?: (payload: any) => boolean;
  transform?: (payload: any) => any;
  metadata?: Record<string, any>;
}

interface EventSubscription {
  userId: number;
  endpointId: number;
  patterns: EventPattern[];
  isActive: boolean;
}

interface BatchEventInput {
  events: Array<{
    eventType: string;
    resourceType?: string;
    resourceId?: number;
    payload: Record<string, any>;
    correlationId?: string;
  }>;
  triggeredBy?: number;
  source?: string;
  metadata?: Record<string, any>;
}

export class WebhookEventPublisher {
  private webhookService: WebhookService;
  private redisService: RedisService;
  private eventQueue: Map<string, any[]> = new Map();
  private batchProcessingInterval: NodeJS.Timer | null = null;

  constructor(databaseUrl: string, redisUrl?: string) {
    this.webhookService = new WebhookService(databaseUrl);
    if (redisUrl) {
      this.redisService = new RedisService(redisUrl);
    }
    
    // Start batch processing if Redis is available
    if (this.redisService) {
      this.startBatchProcessing();
    }
  }

  // ============================================================================
  // REAL-TIME EVENT PUBLISHING
  // ============================================================================

  /**
   * Publish a single event immediately
   */
  async publishEvent(
    eventType: string,
    payload: Record<string, any>,
    options: {
      resourceType?: string;
      resourceId?: number;
      triggeredBy?: number;
      source?: string;
      metadata?: Record<string, any>;
      correlationId?: string;
    } = {}
  ): Promise<string> {
    try {
      const eventId = await this.webhookService.publishEvent({
        eventType,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
        payload,
        triggeredBy: options.triggeredBy,
        source: options.source || 'api',
        metadata: options.metadata || {},
        correlationId: options.correlationId,
      });

      // Cache event for real-time streaming
      if (this.redisService) {
        await this.cacheEventForStreaming(eventType, payload, eventId);
      }

      return eventId;
    } catch (error) {
      console.error('Failed to publish webhook event:', error);
      throw error;
    }
  }

  /**
   * Publish multiple events as a batch
   */
  async publishBatchEvents(input: BatchEventInput): Promise<string[]> {
    const eventIds: string[] = [];
    const correlationId = input.metadata?.correlationId || this.generateCorrelationId();

    try {
      // Process events in parallel for better performance
      const publishPromises = input.events.map(event =>
        this.publishEvent(event.eventType, event.payload, {
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          triggeredBy: input.triggeredBy,
          source: input.source || 'batch',
          correlationId: event.correlationId || correlationId,
          metadata: input.metadata,
        })
      );

      const results = await Promise.allSettled(publishPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          eventIds.push(result.value);
        } else {
          console.error(`Failed to publish event ${index}:`, result.reason);
        }
      });

      return eventIds;
    } catch (error) {
      console.error('Failed to publish batch events:', error);
      throw error;
    }
  }

  // ============================================================================
  // PLATFORM-SPECIFIC EVENT PUBLISHERS
  // ============================================================================

  /**
   * Publish user lifecycle events
   */
  async publishUserEvent(
    eventType: 'user.created' | 'user.updated' | 'user.deleted' | 'user.verified' | 'user.login' | 'user.logout',
    userId: number,
    userData: any,
    triggeredBy?: number
  ): Promise<string> {
    const payload = {
      user: {
        id: userId,
        ...this.sanitizeUserData(userData),
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishEvent(eventType, payload, {
      resourceType: 'user',
      resourceId: userId,
      triggeredBy: triggeredBy || userId,
      source: 'user_service',
    });
  }

  /**
   * Publish pitch lifecycle events
   */
  async publishPitchEvent(
    eventType: 'pitch.created' | 'pitch.updated' | 'pitch.deleted' | 'pitch.published' | 'pitch.viewed' | 'pitch.liked',
    pitchId: number,
    pitchData: any,
    triggeredBy?: number
  ): Promise<string> {
    const payload = {
      pitch: {
        id: pitchId,
        title: pitchData.title,
        creator_id: pitchData.userId,
        genre: pitchData.genre,
        format: pitchData.format,
        status: pitchData.status,
        visibility: pitchData.visibility,
        created_at: pitchData.createdAt,
        updated_at: pitchData.updatedAt,
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishEvent(eventType, payload, {
      resourceType: 'pitch',
      resourceId: pitchId,
      triggeredBy: triggeredBy,
      source: 'pitch_service',
    });
  }

  /**
   * Publish NDA workflow events
   */
  async publishNDAEvent(
    eventType: 'nda.requested' | 'nda.approved' | 'nda.rejected' | 'nda.signed' | 'nda.expired',
    ndaId: number,
    ndaData: any,
    triggeredBy?: number
  ): Promise<string> {
    const payload = {
      nda: {
        id: ndaId,
        pitch_id: ndaData.pitchId,
        requester_id: ndaData.requesterId || ndaData.signerId,
        owner_id: ndaData.ownerId || ndaData.userId,
        status: ndaData.status,
        nda_type: ndaData.ndaType,
        signed_at: ndaData.signedAt,
        expires_at: ndaData.expiresAt,
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishEvent(eventType, payload, {
      resourceType: 'nda',
      resourceId: ndaId,
      triggeredBy: triggeredBy,
      source: 'nda_service',
    });
  }

  /**
   * Publish investment events
   */
  async publishInvestmentEvent(
    eventType: 'investment.created' | 'investment.updated' | 'investment.approved' | 'investment.funded',
    investmentId: number,
    investmentData: any,
    triggeredBy?: number
  ): Promise<string> {
    const payload = {
      investment: {
        id: investmentId,
        investor_id: investmentData.investorId,
        pitch_id: investmentData.pitchId,
        amount: investmentData.amount,
        status: investmentData.status,
        terms: investmentData.terms,
        created_at: investmentData.createdAt,
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishEvent(eventType, payload, {
      resourceType: 'investment',
      resourceId: investmentId,
      triggeredBy: triggeredBy,
      source: 'investment_service',
    });
  }

  /**
   * Publish message events
   */
  async publishMessageEvent(
    eventType: 'message.sent' | 'message.received' | 'message.read',
    messageId: number,
    messageData: any,
    triggeredBy?: number
  ): Promise<string> {
    const payload = {
      message: {
        id: messageId,
        sender_id: messageData.senderId,
        receiver_id: messageData.receiverId,
        conversation_id: messageData.conversationId,
        content: this.sanitizeMessageContent(messageData.content),
        message_type: messageData.messageType,
        pitch_id: messageData.pitchId,
        sent_at: messageData.sentAt,
        read_at: messageData.readAt,
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishEvent(eventType, payload, {
      resourceType: 'message',
      resourceId: messageId,
      triggeredBy: triggeredBy,
      source: 'messaging_service',
    });
  }

  /**
   * Publish payment events
   */
  async publishPaymentEvent(
    eventType: 'payment.created' | 'payment.succeeded' | 'payment.failed' | 'payment.refunded',
    paymentId: string,
    paymentData: any,
    triggeredBy?: number
  ): Promise<string> {
    const payload = {
      payment: {
        id: paymentId,
        user_id: paymentData.userId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        status: paymentData.status,
        type: paymentData.type,
        stripe_payment_intent_id: paymentData.stripePaymentIntentId,
        description: paymentData.description,
        created_at: paymentData.createdAt,
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishEvent(eventType, payload, {
      resourceType: 'payment',
      resourceId: paymentData.id,
      triggeredBy: triggeredBy,
      source: 'payment_service',
    });
  }

  /**
   * Publish analytics events
   */
  async publishAnalyticsEvent(
    eventType: 'analytics.event_tracked' | 'analytics.milestone_reached' | 'analytics.report_generated',
    analyticsData: any,
    triggeredBy?: number
  ): Promise<string> {
    const payload = {
      analytics: analyticsData,
      timestamp: new Date().toISOString(),
    };

    return this.publishEvent(eventType, payload, {
      resourceType: 'analytics',
      triggeredBy: triggeredBy,
      source: 'analytics_service',
    });
  }

  // ============================================================================
  // STREAMING AND REAL-TIME DELIVERY
  // ============================================================================

  /**
   * Setup real-time WebSocket streaming for events
   */
  async streamEvents(
    patterns: EventPattern[],
    callback: (event: any) => void
  ): Promise<() => void> {
    if (!this.redisService) {
      throw new Error('Redis service not available for streaming');
    }

    const channelName = `webhook_events:${this.generateStreamId()}`;
    
    // Subscribe to Redis channel for real-time events
    const unsubscribe = await this.redisService.subscribe(channelName, (message) => {
      try {
        const event = JSON.parse(message);
        
        // Check if event matches any of the patterns
        if (this.matchesPatterns(event, patterns)) {
          callback(event);
        }
      } catch (error) {
        console.error('Error processing streamed event:', error);
      }
    });

    return unsubscribe;
  }

  /**
   * Cache event for real-time streaming
   */
  private async cacheEventForStreaming(
    eventType: string,
    payload: Record<string, any>,
    eventId: string
  ): Promise<void> {
    if (!this.redisService) return;

    const streamEvent = {
      event_id: eventId,
      event_type: eventType,
      payload,
      timestamp: new Date().toISOString(),
    };

    // Publish to Redis for real-time subscribers
    await this.redisService.publish(`webhook_events:stream`, JSON.stringify(streamEvent));

    // Cache for replay functionality
    await this.redisService.set(
      `webhook_event:${eventId}`,
      JSON.stringify(streamEvent),
      60 * 60 // 1 hour TTL
    );
  }

  // ============================================================================
  // EVENT SOURCING AND REPLAY
  // ============================================================================

  /**
   * Replay events for a specific time range
   */
  async replayEvents(
    startTime: Date,
    endTime: Date,
    eventTypes?: string[],
    resourceType?: string,
    resourceId?: number
  ): Promise<any[]> {
    // Implementation would query the database for events in the time range
    // and re-publish them to configured endpoints
    
    // This is a complex feature that would typically involve:
    // 1. Querying historical events from the database
    // 2. Filtering by criteria
    // 3. Re-publishing to active endpoints
    // 4. Tracking replay progress
    
    console.log('Event replay feature would be implemented here');
    return [];
  }

  // ============================================================================
  // BATCH PROCESSING AND OPTIMIZATION
  // ============================================================================

  /**
   * Start batch processing for high-volume events
   */
  private startBatchProcessing(): void {
    if (this.batchProcessingInterval) return;

    this.batchProcessingInterval = setInterval(async () => {
      await this.processBatchedEvents();
    }, 5000); // Process every 5 seconds
  }

  /**
   * Stop batch processing
   */
  stopBatchProcessing(): void {
    if (this.batchProcessingInterval) {
      clearInterval(this.batchProcessingInterval);
      this.batchProcessingInterval = null;
    }
  }

  /**
   * Add event to batch queue
   */
  async addToBatch(
    eventType: string,
    payload: Record<string, any>,
    options: Record<string, any> = {}
  ): Promise<void> {
    const queueKey = `batch:${eventType}`;
    
    if (!this.eventQueue.has(queueKey)) {
      this.eventQueue.set(queueKey, []);
    }

    const queue = this.eventQueue.get(queueKey)!;
    queue.push({
      eventType,
      payload,
      options,
      timestamp: Date.now(),
    });

    // Auto-flush if queue gets too large
    if (queue.length >= 100) {
      await this.flushBatch(queueKey);
    }
  }

  /**
   * Process all batched events
   */
  private async processBatchedEvents(): Promise<void> {
    for (const [queueKey, events] of this.eventQueue.entries()) {
      if (events.length > 0) {
        await this.flushBatch(queueKey);
      }
    }
  }

  /**
   * Flush a specific batch queue
   */
  private async flushBatch(queueKey: string): Promise<void> {
    const events = this.eventQueue.get(queueKey);
    if (!events || events.length === 0) return;

    // Clear the queue
    this.eventQueue.set(queueKey, []);

    try {
      // Process events in smaller chunks
      const chunkSize = 10;
      for (let i = 0; i < events.length; i += chunkSize) {
        const chunk = events.slice(i, i + chunkSize);
        
        const publishPromises = chunk.map(event =>
          this.publishEvent(event.eventType, event.payload, event.options)
        );

        await Promise.allSettled(publishPromises);
      }
    } catch (error) {
      console.error('Error flushing batch:', error);
      
      // Re-queue failed events
      const existingQueue = this.eventQueue.get(queueKey) || [];
      this.eventQueue.set(queueKey, [...existingQueue, ...events]);
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Check if event matches patterns
   */
  private matchesPatterns(event: any, patterns: EventPattern[]): boolean {
    return patterns.some(pattern => {
      // Check event type
      if (pattern.eventType !== event.event_type) return false;
      
      // Check resource type if specified
      if (pattern.resourceType && pattern.resourceType !== event.payload?.resourceType) {
        return false;
      }
      
      // Check custom condition
      if (pattern.condition && !pattern.condition(event.payload)) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Sanitize user data for webhook payload
   */
  private sanitizeUserData(userData: any): any {
    return {
      id: userData.id,
      email: userData.email,
      username: userData.username,
      first_name: userData.firstName || userData.first_name,
      last_name: userData.lastName || userData.last_name,
      user_type: userData.userType || userData.user_type,
      company_name: userData.companyName || userData.company_name,
      verified: userData.emailVerified || userData.verified,
      created_at: userData.createdAt || userData.created_at,
      updated_at: userData.updatedAt || userData.updated_at,
    };
  }

  /**
   * Sanitize message content
   */
  private sanitizeMessageContent(content: string): string {
    // Remove sensitive information, truncate if necessary
    if (!content) return '';
    
    // Truncate long messages for webhooks
    if (content.length > 500) {
      return content.substring(0, 497) + '...';
    }
    
    return content;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate stream ID
   */
  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================================================
  // INTEGRATION HELPERS
  // ============================================================================

  /**
   * Create integration-specific event publishers
   */
  createCRMPublisher() {
    return {
      leadCreated: (leadData: any) => this.publishEvent('custom.crm_lead_created', leadData),
      dealUpdated: (dealData: any) => this.publishEvent('custom.crm_deal_updated', dealData),
      contactSynced: (contactData: any) => this.publishEvent('custom.crm_contact_synced', contactData),
    };
  }

  createEmailMarketingPublisher() {
    return {
      subscriberAdded: (subscriberData: any) => this.publishEvent('custom.email_subscriber_added', subscriberData),
      campaignSent: (campaignData: any) => this.publishEvent('custom.email_campaign_sent', campaignData),
      unsubscribed: (unsubscribeData: any) => this.publishEvent('custom.email_unsubscribed', unsubscribeData),
    };
  }

  createAnalyticsPublisher() {
    return {
      eventTracked: (eventData: any) => this.publishAnalyticsEvent('analytics.event_tracked', eventData),
      goalCompleted: (goalData: any) => this.publishEvent('custom.analytics_goal_completed', goalData),
      reportGenerated: (reportData: any) => this.publishAnalyticsEvent('analytics.report_generated', reportData),
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopBatchProcessing();
    
    if (this.redisService) {
      // Clean up Redis connections
      // this.redisService.disconnect();
    }
  }
}

// Export singleton instance
export const webhookEventPublisher = new WebhookEventPublisher(
  process.env.DATABASE_URL || '',
  process.env.REDIS_URL
);

// Export types for external use
export type { EventPattern, EventSubscription, BatchEventInput };