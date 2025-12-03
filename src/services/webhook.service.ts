/**
 * Comprehensive Webhook Service
 * Handles webhook endpoint management, event publishing, and delivery
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq, gte, lte, desc, asc, sql, inArray, isNull } from 'drizzle-orm';
import {
  webhookEndpoints,
  webhookEvents,
  webhookDeliveries,
  webhookSubscriptions,
  webhookLogs,
  webhookAnalytics,
  webhookRateLimits,
  webhookCircuitBreakers,
  WebhookEndpoint,
  WebhookEvent,
  WebhookDelivery,
  WebhookSubscription,
  webhookEventTypeEnum,
} from '../db/webhook-schema';
import { users } from '../db/schema';
import crypto from 'crypto';

interface WebhookCreateEndpointInput {
  userId: number;
  name: string;
  description?: string;
  url: string;
  eventTypes: string[];
  eventFilters?: Record<string, any>;
  timeout?: number;
  retryPolicy?: {
    maxAttempts: number;
    backoffType: 'linear' | 'exponential';
    baseDelay: number;
  };
  rateLimit?: number;
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
  tags?: string[];
}

interface WebhookEventInput {
  eventType: string;
  resourceType?: string;
  resourceId?: number;
  payload: Record<string, any>;
  triggeredBy?: number;
  source?: string;
  metadata?: Record<string, any>;
  correlationId?: string;
}

interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseTime: number;
  responseBody?: string;
  error?: string;
  headers?: Record<string, string>;
}

export class WebhookService {
  private db: ReturnType<typeof drizzle>;

  constructor(databaseUrl: string) {
    this.db = drizzle({ connection: databaseUrl });
  }

  // ============================================================================
  // WEBHOOK ENDPOINT MANAGEMENT
  // ============================================================================

  /**
   * Create a new webhook endpoint
   */
  async createEndpoint(input: WebhookCreateEndpointInput): Promise<WebhookEndpoint> {
    // Generate secure secret for HMAC signing
    const secret = crypto.randomBytes(32).toString('hex');
    
    // Validate URL
    try {
      new URL(input.url);
    } catch (error) {
      throw new Error('Invalid webhook URL provided');
    }

    // Validate event types
    const validEventTypes = webhookEventTypeEnum.enumValues;
    const invalidTypes = input.eventTypes.filter(type => !validEventTypes.includes(type as any));
    if (invalidTypes.length > 0) {
      throw new Error(`Invalid event types: ${invalidTypes.join(', ')}`);
    }

    const [endpoint] = await this.db.insert(webhookEndpoints).values({
      userId: input.userId,
      name: input.name,
      description: input.description,
      url: input.url,
      secret,
      eventTypes: input.eventTypes,
      eventFilters: input.eventFilters || {},
      timeout: input.timeout || 30,
      retryPolicy: input.retryPolicy || {
        maxAttempts: 3,
        backoffType: 'exponential',
        baseDelay: 1000
      },
      rateLimit: input.rateLimit || 100,
      headers: input.headers || {},
      metadata: input.metadata || {},
      tags: input.tags || [],
    }).returning();

    // Create rate limit entry
    await this.initializeRateLimit(endpoint.id, input.rateLimit || 100);

    // Create circuit breaker entry
    await this.initializeCircuitBreaker(endpoint.id);

    // Create subscriptions for each event type
    await this.createSubscriptions(endpoint.id, input.eventTypes);

    await this.logWebhookActivity(
      'info',
      `Webhook endpoint created: ${endpoint.name}`,
      { endpointId: endpoint.id, url: endpoint.url },
      'management',
      'creation',
      null,
      input.userId
    );

    return endpoint;
  }

  /**
   * Update webhook endpoint
   */
  async updateEndpoint(
    endpointId: number,
    userId: number,
    updates: Partial<WebhookCreateEndpointInput>
  ): Promise<WebhookEndpoint> {
    // Verify ownership
    const endpoint = await this.getEndpointByIdAndUser(endpointId, userId);
    if (!endpoint) {
      throw new Error('Webhook endpoint not found');
    }

    // Validate URL if provided
    if (updates.url) {
      try {
        new URL(updates.url);
      } catch (error) {
        throw new Error('Invalid webhook URL provided');
      }
    }

    // Validate event types if provided
    if (updates.eventTypes) {
      const validEventTypes = webhookEventTypeEnum.enumValues;
      const invalidTypes = updates.eventTypes.filter(type => !validEventTypes.includes(type as any));
      if (invalidTypes.length > 0) {
        throw new Error(`Invalid event types: ${invalidTypes.join(', ')}`);
      }
    }

    const [updatedEndpoint] = await this.db
      .update(webhookEndpoints)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(webhookEndpoints.id, endpointId))
      .returning();

    // Update subscriptions if event types changed
    if (updates.eventTypes) {
      await this.updateSubscriptions(endpointId, updates.eventTypes);
    }

    // Update rate limit if changed
    if (updates.rateLimit) {
      await this.updateRateLimit(endpointId, updates.rateLimit);
    }

    await this.logWebhookActivity(
      'info',
      `Webhook endpoint updated: ${updatedEndpoint.name}`,
      { endpointId, changes: updates },
      'management',
      'update',
      null,
      userId
    );

    return updatedEndpoint;
  }

  /**
   * Delete webhook endpoint
   */
  async deleteEndpoint(endpointId: number, userId: number): Promise<void> {
    // Verify ownership
    const endpoint = await this.getEndpointByIdAndUser(endpointId, userId);
    if (!endpoint) {
      throw new Error('Webhook endpoint not found');
    }

    // Delete endpoint (cascades to related records)
    await this.db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, endpointId));

    await this.logWebhookActivity(
      'info',
      `Webhook endpoint deleted: ${endpoint.name}`,
      { endpointId, url: endpoint.url },
      'management',
      'deletion',
      null,
      userId
    );
  }

  /**
   * Get webhook endpoints for user
   */
  async getUserEndpoints(userId: number): Promise<WebhookEndpoint[]> {
    return await this.db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.userId, userId))
      .orderBy(desc(webhookEndpoints.createdAt));
  }

  /**
   * Get webhook endpoint by ID and user
   */
  async getEndpointByIdAndUser(endpointId: number, userId: number): Promise<WebhookEndpoint | null> {
    const [endpoint] = await this.db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, endpointId),
          eq(webhookEndpoints.userId, userId)
        )
      );
    
    return endpoint || null;
  }

  /**
   * Toggle endpoint active status
   */
  async toggleEndpoint(endpointId: number, userId: number, isActive: boolean): Promise<void> {
    await this.db
      .update(webhookEndpoints)
      .set({ 
        isActive,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(webhookEndpoints.id, endpointId),
          eq(webhookEndpoints.userId, userId)
        )
      );

    await this.logWebhookActivity(
      'info',
      `Webhook endpoint ${isActive ? 'activated' : 'deactivated'}`,
      { endpointId, isActive },
      'management',
      'status_change',
      endpointId,
      userId
    );
  }

  // ============================================================================
  // EVENT PUBLISHING AND PROCESSING
  // ============================================================================

  /**
   * Publish a webhook event
   */
  async publishEvent(input: WebhookEventInput): Promise<string> {
    const eventId = crypto.randomUUID();
    
    // Find all active endpoints that should receive this event
    const eligibleEndpoints = await this.findEligibleEndpoints(
      input.eventType,
      input.resourceType,
      input.payload
    );

    if (eligibleEndpoints.length === 0) {
      await this.logWebhookActivity(
        'debug',
        `No eligible endpoints for event ${input.eventType}`,
        { eventType: input.eventType, resourceType: input.resourceType },
        'event_processing'
      );
      return eventId;
    }

    // Create the event record
    const [event] = await this.db.insert(webhookEvents).values({
      eventId,
      eventType: input.eventType as any,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      payload: input.payload,
      triggeredBy: input.triggeredBy,
      source: input.source || 'api',
      metadata: input.metadata || {},
      correlationId: input.correlationId,
      totalEndpoints: eligibleEndpoints.length,
      pendingDeliveries: eligibleEndpoints.length,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    }).returning();

    // Create delivery records for each endpoint
    const deliveries = eligibleEndpoints.map(endpoint => ({
      eventId: event.id,
      endpointId: endpoint.id,
      deliveryId: crypto.randomUUID(),
      requestUrl: endpoint.url,
      requestPayload: this.transformPayload(input.payload, endpoint),
      requestHeaders: this.buildRequestHeaders(endpoint, input.payload),
      maxAttempts: (endpoint.retryPolicy as any)?.maxAttempts || 3,
    }));

    await this.db.insert(webhookDeliveries).values(deliveries);

    // Start async delivery process
    this.processEventDeliveries(event.id).catch(error => {
      console.error('Error processing deliveries:', error);
    });

    await this.logWebhookActivity(
      'info',
      `Event published: ${input.eventType}`,
      { 
        eventId, 
        eventType: input.eventType, 
        endpointCount: eligibleEndpoints.length,
        resourceType: input.resourceType,
        resourceId: input.resourceId 
      },
      'event_processing',
      'publish'
    );

    return eventId;
  }

  /**
   * Process deliveries for an event
   */
  private async processEventDeliveries(eventId: number): Promise<void> {
    const pendingDeliveries = await this.db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.eventId, eventId),
          eq(webhookDeliveries.status, 'pending')
        )
      );

    const deliveryPromises = pendingDeliveries.map(delivery => 
      this.executeDelivery(delivery).catch(error => {
        console.error(`Delivery ${delivery.deliveryId} failed:`, error);
      })
    );

    await Promise.allSettled(deliveryPromises);

    // Update event processing status
    await this.updateEventStatus(eventId);
  }

  /**
   * Execute a single webhook delivery
   */
  private async executeDelivery(delivery: WebhookDelivery): Promise<void> {
    const endpoint = await this.db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, delivery.endpointId))
      .limit(1);

    if (!endpoint[0]) {
      await this.markDeliveryFailed(delivery.id, 'Endpoint not found');
      return;
    }

    // Check circuit breaker
    const circuitOpen = await this.isCircuitBreakerOpen(delivery.endpointId);
    if (circuitOpen) {
      await this.markDeliveryFailed(delivery.id, 'Circuit breaker is open');
      return;
    }

    // Check rate limit
    const rateLimited = await this.isRateLimited(delivery.endpointId);
    if (rateLimited) {
      await this.scheduleRetry(delivery);
      return;
    }

    // Update delivery status
    await this.db
      .update(webhookDeliveries)
      .set({
        status: 'processing',
        startedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, delivery.id));

    try {
      const result = await this.makeHttpRequest(
        endpoint[0],
        delivery.requestPayload as Record<string, any>,
        delivery.requestHeaders as Record<string, string>
      );

      if (result.success) {
        await this.markDeliverySuccessful(delivery, result);
        await this.recordCircuitBreakerSuccess(delivery.endpointId);
      } else {
        await this.handleDeliveryFailure(delivery, result);
        await this.recordCircuitBreakerFailure(delivery.endpointId);
      }
    } catch (error) {
      await this.handleDeliveryError(delivery, error as Error);
      await this.recordCircuitBreakerFailure(delivery.endpointId);
    }
  }

  /**
   * Make HTTP request to webhook endpoint
   */
  private async makeHttpRequest(
    endpoint: WebhookEndpoint,
    payload: Record<string, any>,
    headers: Record<string, string>
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), endpoint.timeout * 1000);

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Pitchey-Webhooks/1.0',
          ...headers,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const responseBody = await response.text();

      return {
        success: response.ok,
        statusCode: response.status,
        responseTime,
        responseBody,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Find eligible endpoints for an event
   */
  private async findEligibleEndpoints(
    eventType: string,
    resourceType?: string,
    payload?: Record<string, any>
  ): Promise<WebhookEndpoint[]> {
    const endpoints = await this.db
      .select()
      .from(webhookEndpoints)
      .innerJoin(
        webhookSubscriptions,
        and(
          eq(webhookSubscriptions.endpointId, webhookEndpoints.id),
          eq(webhookSubscriptions.eventType, eventType as any),
          eq(webhookSubscriptions.isActive, true)
        )
      )
      .where(
        and(
          eq(webhookEndpoints.isActive, true),
          resourceType ? eq(webhookSubscriptions.resourceType, resourceType) : undefined
        )
      );

    // Apply additional filtering if needed
    return endpoints
      .map(result => result.webhook_endpoints)
      .filter(endpoint => this.matchesEventFilters(endpoint, payload));
  }

  /**
   * Check if payload matches endpoint filters
   */
  private matchesEventFilters(endpoint: WebhookEndpoint, payload?: Record<string, any>): boolean {
    if (!endpoint.eventFilters || Object.keys(endpoint.eventFilters).length === 0) {
      return true;
    }

    if (!payload) return true;

    // Simple filter matching (can be extended)
    for (const [key, expectedValue] of Object.entries(endpoint.eventFilters)) {
      if (payload[key] !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Transform payload based on endpoint configuration
   */
  private transformPayload(payload: Record<string, any>, endpoint: WebhookEndpoint): Record<string, any> {
    // Add webhook metadata
    const transformedPayload = {
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      webhook: {
        id: endpoint.id,
        name: endpoint.name,
      },
      data: payload,
    };

    // Apply custom transformations if configured
    // This can be extended based on endpoint.metadata.transformations

    return transformedPayload;
  }

  /**
   * Build request headers including HMAC signature
   */
  private buildRequestHeaders(endpoint: WebhookEndpoint, payload: Record<string, any>): Record<string, string> {
    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', endpoint.secret)
      .update(payloadString)
      .digest('hex');

    return {
      'X-Webhook-Signature': `sha256=${signature}`,
      'X-Webhook-Timestamp': Date.now().toString(),
      'X-Webhook-ID': endpoint.id.toString(),
      ...endpoint.headers as Record<string, string>,
    };
  }

  /**
   * Initialize rate limit for endpoint
   */
  private async initializeRateLimit(endpointId: number, maxRequests: number): Promise<void> {
    await this.db.insert(webhookRateLimits).values({
      endpointId,
      maxRequests,
      windowSize: 60,
      currentCount: 0,
      windowStart: new Date(),
      windowEnd: new Date(Date.now() + 60000),
    });
  }

  /**
   * Initialize circuit breaker for endpoint
   */
  private async initializeCircuitBreaker(endpointId: number): Promise<void> {
    await this.db.insert(webhookCircuitBreakers).values({
      endpointId,
      state: 'closed',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 300,
      windowStart: new Date(),
    });
  }

  /**
   * Create subscriptions for event types
   */
  private async createSubscriptions(endpointId: number, eventTypes: string[]): Promise<void> {
    const subscriptions = eventTypes.map(eventType => ({
      endpointId,
      eventType: eventType as any,
    }));

    await this.db.insert(webhookSubscriptions).values(subscriptions);
  }

  /**
   * Update subscriptions for endpoint
   */
  private async updateSubscriptions(endpointId: number, eventTypes: string[]): Promise<void> {
    // Delete existing subscriptions
    await this.db
      .delete(webhookSubscriptions)
      .where(eq(webhookSubscriptions.endpointId, endpointId));

    // Create new subscriptions
    await this.createSubscriptions(endpointId, eventTypes);
  }

  /**
   * Update rate limit configuration
   */
  private async updateRateLimit(endpointId: number, maxRequests: number): Promise<void> {
    await this.db
      .update(webhookRateLimits)
      .set({
        maxRequests,
        updatedAt: new Date(),
      })
      .where(eq(webhookRateLimits.endpointId, endpointId));
  }

  /**
   * Check if endpoint is rate limited
   */
  private async isRateLimited(endpointId: number): Promise<boolean> {
    const [rateLimit] = await this.db
      .select()
      .from(webhookRateLimits)
      .where(eq(webhookRateLimits.endpointId, endpointId));

    if (!rateLimit) return false;

    const now = new Date();
    
    // Reset window if expired
    if (now > rateLimit.windowEnd!) {
      await this.db
        .update(webhookRateLimits)
        .set({
          currentCount: 0,
          windowStart: now,
          windowEnd: new Date(now.getTime() + rateLimit.windowSize * 1000),
          updatedAt: now,
        })
        .where(eq(webhookRateLimits.id, rateLimit.id));
      
      return false;
    }

    return rateLimit.currentCount >= rateLimit.maxRequests;
  }

  /**
   * Check if circuit breaker is open
   */
  private async isCircuitBreakerOpen(endpointId: number): Promise<boolean> {
    const [breaker] = await this.db
      .select()
      .from(webhookCircuitBreakers)
      .where(eq(webhookCircuitBreakers.endpointId, endpointId));

    if (!breaker) return false;

    if (breaker.state === 'open') {
      // Check if we should try half-open
      if (breaker.nextAttemptAt && new Date() > breaker.nextAttemptAt) {
        await this.db
          .update(webhookCircuitBreakers)
          .set({
            state: 'half-open',
            updatedAt: new Date(),
          })
          .where(eq(webhookCircuitBreakers.id, breaker.id));
        
        return false;
      }
      
      return true;
    }

    return false;
  }

  /**
   * Mark delivery as successful
   */
  private async markDeliverySuccessful(delivery: WebhookDelivery, result: WebhookDeliveryResult): Promise<void> {
    await this.db
      .update(webhookDeliveries)
      .set({
        status: 'succeeded',
        responseStatus: result.statusCode,
        responseBody: result.responseBody,
        responseHeaders: result.headers,
        responseTime: result.responseTime,
        completedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, delivery.id));

    // Update endpoint statistics
    await this.updateEndpointStats(delivery.endpointId, true, result.responseTime);
    
    // Update rate limit
    await this.incrementRateLimit(delivery.endpointId);
  }

  /**
   * Handle delivery failure
   */
  private async handleDeliveryFailure(delivery: WebhookDelivery, result: WebhookDeliveryResult): Promise<void> {
    const shouldRetry = delivery.attemptNumber < delivery.maxAttempts;
    
    if (shouldRetry) {
      await this.scheduleRetry(delivery);
    } else {
      await this.markDeliveryFailed(delivery.id, result.error || `HTTP ${result.statusCode}`);
    }

    await this.updateEndpointStats(delivery.endpointId, false, result.responseTime);
  }

  /**
   * Handle delivery error
   */
  private async handleDeliveryError(delivery: WebhookDelivery, error: Error): Promise<void> {
    const shouldRetry = delivery.attemptNumber < delivery.maxAttempts;
    
    if (shouldRetry) {
      await this.scheduleRetry(delivery);
    } else {
      await this.markDeliveryFailed(delivery.id, error.message);
    }

    await this.updateEndpointStats(delivery.endpointId, false, 0);
  }

  /**
   * Schedule retry for failed delivery
   */
  private async scheduleRetry(delivery: WebhookDelivery): Promise<void> {
    const delay = this.calculateRetryDelay(delivery.attemptNumber);
    const nextRetryAt = new Date(Date.now() + delay);

    await this.db
      .update(webhookDeliveries)
      .set({
        status: 'retrying',
        attemptNumber: delivery.attemptNumber + 1,
        nextRetryAt,
      })
      .where(eq(webhookDeliveries.id, delivery.id));

    // Schedule actual retry (in production, use a queue system)
    setTimeout(() => {
      this.retryDelivery(delivery.id).catch(console.error);
    }, delay);
  }

  /**
   * Calculate retry delay
   */
  private calculateRetryDelay(attemptNumber: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    return Math.pow(2, attemptNumber - 1) * 1000;
  }

  /**
   * Retry a specific delivery
   */
  private async retryDelivery(deliveryId: number): Promise<void> {
    const [delivery] = await this.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId));

    if (delivery && delivery.status === 'retrying') {
      await this.executeDelivery(delivery);
    }
  }

  /**
   * Mark delivery as failed
   */
  private async markDeliveryFailed(deliveryId: number, errorMessage: string): Promise<void> {
    await this.db
      .update(webhookDeliveries)
      .set({
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, deliveryId));
  }

  /**
   * Update endpoint statistics
   */
  private async updateEndpointStats(endpointId: number, success: boolean, responseTime: number): Promise<void> {
    const updateData: any = {
      totalDeliveries: sql`${webhookEndpoints.totalDeliveries} + 1`,
      lastDeliveryAt: new Date(),
    };

    if (success) {
      updateData.successfulDeliveries = sql`${webhookEndpoints.successfulDeliveries} + 1`;
      updateData.lastSuccessAt = new Date();
      
      // Update average response time
      updateData.averageResponseTime = sql`
        CASE 
          WHEN ${webhookEndpoints.averageResponseTime} IS NULL THEN ${responseTime}
          ELSE (${webhookEndpoints.averageResponseTime} + ${responseTime}) / 2
        END
      `;
    } else {
      updateData.failedDeliveries = sql`${webhookEndpoints.failedDeliveries} + 1`;
      updateData.lastFailureAt = new Date();
    }

    await this.db
      .update(webhookEndpoints)
      .set(updateData)
      .where(eq(webhookEndpoints.id, endpointId));
  }

  /**
   * Increment rate limit counter
   */
  private async incrementRateLimit(endpointId: number): Promise<void> {
    await this.db
      .update(webhookRateLimits)
      .set({
        currentCount: sql`${webhookRateLimits.currentCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(webhookRateLimits.endpointId, endpointId));
  }

  /**
   * Record circuit breaker success
   */
  private async recordCircuitBreakerSuccess(endpointId: number): Promise<void> {
    const [breaker] = await this.db
      .select()
      .from(webhookCircuitBreakers)
      .where(eq(webhookCircuitBreakers.endpointId, endpointId));

    if (!breaker) return;

    let newState = breaker.state;
    let consecutiveSuccesses = breaker.consecutiveSuccesses + 1;
    let consecutiveFailures = 0;

    // If half-open and we've reached success threshold, close the circuit
    if (breaker.state === 'half-open' && consecutiveSuccesses >= breaker.successThreshold) {
      newState = 'closed';
      consecutiveSuccesses = 0;
    }

    await this.db
      .update(webhookCircuitBreakers)
      .set({
        state: newState,
        consecutiveSuccesses,
        consecutiveFailures,
        lastSuccessAt: new Date(),
        windowSuccesses: sql`${webhookCircuitBreakers.windowSuccesses} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(webhookCircuitBreakers.id, breaker.id));
  }

  /**
   * Record circuit breaker failure
   */
  private async recordCircuitBreakerFailure(endpointId: number): Promise<void> {
    const [breaker] = await this.db
      .select()
      .from(webhookCircuitBreakers)
      .where(eq(webhookCircuitBreakers.endpointId, endpointId));

    if (!breaker) return;

    let newState = breaker.state;
    let consecutiveFailures = breaker.consecutiveFailures + 1;
    let consecutiveSuccesses = 0;
    let nextAttemptAt = breaker.nextAttemptAt;

    // If we've reached failure threshold, open the circuit
    if (consecutiveFailures >= breaker.failureThreshold) {
      newState = 'open';
      nextAttemptAt = new Date(Date.now() + breaker.timeout * 1000);
    }

    // If half-open, go back to open on any failure
    if (breaker.state === 'half-open') {
      newState = 'open';
      nextAttemptAt = new Date(Date.now() + breaker.timeout * 1000);
    }

    await this.db
      .update(webhookCircuitBreakers)
      .set({
        state: newState,
        consecutiveFailures,
        consecutiveSuccesses,
        lastFailureAt: new Date(),
        nextAttemptAt,
        windowFailures: sql`${webhookCircuitBreakers.windowFailures} + 1`,
        updatedAt: new Date(),
        ...(newState === 'open' && { openedAt: new Date() }),
      })
      .where(eq(webhookCircuitBreakers.id, breaker.id));
  }

  /**
   * Update event processing status
   */
  private async updateEventStatus(eventId: number): Promise<void> {
    const deliveryCounts = await this.db
      .select({
        total: sql<number>`count(*)`,
        successful: sql<number>`count(*) filter (where status = 'succeeded')`,
        failed: sql<number>`count(*) filter (where status = 'failed')`,
        pending: sql<number>`count(*) filter (where status in ('pending', 'retrying', 'processing'))`,
      })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.eventId, eventId));

    const counts = deliveryCounts[0];
    
    let processingStatus = 'processing';
    if (counts.pending === 0) {
      processingStatus = 'completed';
    }

    await this.db
      .update(webhookEvents)
      .set({
        successfulDeliveries: counts.successful,
        failedDeliveries: counts.failed,
        pendingDeliveries: counts.pending,
        processingStatus,
        processedAt: counts.pending === 0 ? new Date() : undefined,
      })
      .where(eq(webhookEvents.id, eventId));
  }

  /**
   * Log webhook activity
   */
  private async logWebhookActivity(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context: Record<string, any> = {},
    category: string = 'general',
    component?: string,
    endpointId?: number | null,
    userId?: number | null,
    requestId?: string
  ): Promise<void> {
    try {
      await this.db.insert(webhookLogs).values({
        level,
        message,
        context,
        category,
        component,
        endpointId,
        userId,
        requestId,
      });
    } catch (error) {
      console.error('Failed to log webhook activity:', error);
    }
  }

  // ============================================================================
  // ANALYTICS AND MONITORING
  // ============================================================================

  /**
   * Get webhook analytics for an endpoint
   */
  async getEndpointAnalytics(
    endpointId: number,
    userId: number,
    period: 'hour' | 'day' | 'week' | 'month' = 'day',
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    // Verify endpoint ownership
    const endpoint = await this.getEndpointByIdAndUser(endpointId, userId);
    if (!endpoint) {
      throw new Error('Webhook endpoint not found');
    }

    // Default date range
    if (!startDate) {
      startDate = new Date();
      if (period === 'hour') startDate.setHours(startDate.getHours() - 24);
      else if (period === 'day') startDate.setDate(startDate.getDate() - 30);
      else if (period === 'week') startDate.setDate(startDate.getDate() - 90);
      else startDate.setMonth(startDate.getMonth() - 12);
    }
    
    if (!endDate) {
      endDate = new Date();
    }

    const analytics = await this.db
      .select()
      .from(webhookAnalytics)
      .where(
        and(
          eq(webhookAnalytics.endpointId, endpointId),
          eq(webhookAnalytics.period, period),
          gte(webhookAnalytics.periodStart, startDate),
          lte(webhookAnalytics.periodEnd, endDate)
        )
      )
      .orderBy(asc(webhookAnalytics.periodStart));

    return {
      endpoint: {
        id: endpoint.id,
        name: endpoint.name,
        url: endpoint.url,
        isActive: endpoint.isActive,
        healthStatus: endpoint.healthStatus,
      },
      period,
      dateRange: { startDate, endDate },
      analytics,
      summary: this.calculateAnalyticsSummary(analytics),
    };
  }

  /**
   * Calculate analytics summary
   */
  private calculateAnalyticsSummary(analytics: any[]): any {
    if (analytics.length === 0) {
      return {
        totalDeliveries: 0,
        successRate: 0,
        averageResponseTime: 0,
        errorRate: 0,
      };
    }

    const totals = analytics.reduce(
      (acc, item) => ({
        deliveries: acc.deliveries + item.totalDeliveries,
        successful: acc.successful + item.successfulDeliveries,
        failed: acc.failed + item.failedDeliveries,
        responseTime: acc.responseTime + (item.averageResponseTime || 0),
      }),
      { deliveries: 0, successful: 0, failed: 0, responseTime: 0 }
    );

    return {
      totalDeliveries: totals.deliveries,
      successRate: totals.deliveries > 0 ? (totals.successful / totals.deliveries) * 100 : 0,
      errorRate: totals.deliveries > 0 ? (totals.failed / totals.deliveries) * 100 : 0,
      averageResponseTime: analytics.length > 0 ? totals.responseTime / analytics.length : 0,
    };
  }

  /**
   * Get webhook delivery history
   */
  async getDeliveryHistory(
    endpointId: number,
    userId: number,
    limit: number = 100,
    offset: number = 0
  ): Promise<any> {
    // Verify endpoint ownership
    const endpoint = await this.getEndpointByIdAndUser(endpointId, userId);
    if (!endpoint) {
      throw new Error('Webhook endpoint not found');
    }

    const deliveries = await this.db
      .select({
        delivery: webhookDeliveries,
        event: {
          id: webhookEvents.id,
          eventId: webhookEvents.eventId,
          eventType: webhookEvents.eventType,
          resourceType: webhookEvents.resourceType,
          triggeredAt: webhookEvents.triggeredAt,
        },
      })
      .from(webhookDeliveries)
      .innerJoin(webhookEvents, eq(webhookDeliveries.eventId, webhookEvents.id))
      .where(eq(webhookDeliveries.endpointId, endpointId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      deliveries: deliveries.map(item => ({
        ...item.delivery,
        event: item.event,
      })),
      pagination: {
        limit,
        offset,
        hasMore: deliveries.length === limit,
      },
    };
  }
}