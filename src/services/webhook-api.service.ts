/**
 * Webhook API Service
 * Provides HTTP API endpoints for webhook management
 */

import { WebhookService } from './webhook.service';
import { WebhookEventPublisher } from './webhook-event-publisher.service';
import { WebhookTemplate } from '../db/webhook-schema';
import crypto from 'crypto';

interface WebhookAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

interface CreateEndpointRequest {
  name: string;
  description?: string;
  url: string;
  event_types: string[];
  event_filters?: Record<string, any>;
  timeout?: number;
  retry_policy?: {
    max_attempts: number;
    backoff_type: 'linear' | 'exponential';
    base_delay: number;
  };
  rate_limit?: number;
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
  tags?: string[];
}

interface UpdateEndpointRequest {
  name?: string;
  description?: string;
  url?: string;
  event_types?: string[];
  event_filters?: Record<string, any>;
  timeout?: number;
  retry_policy?: {
    max_attempts: number;
    backoff_type: 'linear' | 'exponential';
    base_delay: number;
  };
  rate_limit?: number;
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
  tags?: string[];
}

interface TestEndpointRequest {
  endpoint_id: number;
  test_payload?: Record<string, any>;
  test_headers?: Record<string, string>;
}

interface EventPublishRequest {
  event_type: string;
  resource_type?: string;
  resource_id?: number;
  payload: Record<string, any>;
  source?: string;
  metadata?: Record<string, any>;
  correlation_id?: string;
}

export class WebhookAPIService {
  private webhookService: WebhookService;
  private eventPublisher: WebhookEventPublisher;

  constructor(databaseUrl: string, redisUrl?: string) {
    this.webhookService = new WebhookService(databaseUrl);
    this.eventPublisher = new WebhookEventPublisher(databaseUrl, redisUrl);
  }

  // ============================================================================
  // ENDPOINT MANAGEMENT ROUTES
  // ============================================================================

  /**
   * GET /api/webhooks/endpoints
   * List user's webhook endpoints
   */
  async listEndpoints(userId: number): Promise<WebhookAPIResponse> {
    try {
      const endpoints = await this.webhookService.getUserEndpoints(userId);
      
      return {
        success: true,
        data: endpoints.map(endpoint => this.formatEndpointResponse(endpoint)),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list endpoints',
      };
    }
  }

  /**
   * POST /api/webhooks/endpoints
   * Create a new webhook endpoint
   */
  async createEndpoint(
    userId: number,
    request: CreateEndpointRequest
  ): Promise<WebhookAPIResponse> {
    try {
      // Validate required fields
      if (!request.name || !request.url || !request.event_types?.length) {
        return {
          success: false,
          error: 'Missing required fields: name, url, and event_types are required',
        };
      }

      // Validate URL format
      try {
        new URL(request.url);
      } catch {
        return {
          success: false,
          error: 'Invalid URL format',
        };
      }

      const endpoint = await this.webhookService.createEndpoint({
        userId,
        name: request.name,
        description: request.description,
        url: request.url,
        eventTypes: request.event_types,
        eventFilters: request.event_filters,
        timeout: request.timeout,
        retryPolicy: request.retry_policy,
        rateLimit: request.rate_limit,
        headers: request.headers,
        metadata: request.metadata,
        tags: request.tags,
      });

      return {
        success: true,
        data: this.formatEndpointResponse(endpoint),
        message: 'Webhook endpoint created successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create endpoint',
      };
    }
  }

  /**
   * GET /api/webhooks/endpoints/:id
   * Get a specific webhook endpoint
   */
  async getEndpoint(userId: number, endpointId: number): Promise<WebhookAPIResponse> {
    try {
      const endpoint = await this.webhookService.getEndpointByIdAndUser(endpointId, userId);
      
      if (!endpoint) {
        return {
          success: false,
          error: 'Webhook endpoint not found',
        };
      }

      return {
        success: true,
        data: this.formatEndpointResponse(endpoint),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get endpoint',
      };
    }
  }

  /**
   * PUT /api/webhooks/endpoints/:id
   * Update a webhook endpoint
   */
  async updateEndpoint(
    userId: number,
    endpointId: number,
    request: UpdateEndpointRequest
  ): Promise<WebhookAPIResponse> {
    try {
      // Validate URL if provided
      if (request.url) {
        try {
          new URL(request.url);
        } catch {
          return {
            success: false,
            error: 'Invalid URL format',
          };
        }
      }

      const endpoint = await this.webhookService.updateEndpoint(endpointId, userId, {
        name: request.name,
        description: request.description,
        url: request.url,
        eventTypes: request.event_types,
        eventFilters: request.event_filters,
        timeout: request.timeout,
        retryPolicy: request.retry_policy,
        rateLimit: request.rate_limit,
        headers: request.headers,
        metadata: request.metadata,
        tags: request.tags,
      });

      return {
        success: true,
        data: this.formatEndpointResponse(endpoint),
        message: 'Webhook endpoint updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update endpoint',
      };
    }
  }

  /**
   * DELETE /api/webhooks/endpoints/:id
   * Delete a webhook endpoint
   */
  async deleteEndpoint(userId: number, endpointId: number): Promise<WebhookAPIResponse> {
    try {
      await this.webhookService.deleteEndpoint(endpointId, userId);
      
      return {
        success: true,
        message: 'Webhook endpoint deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete endpoint',
      };
    }
  }

  /**
   * POST /api/webhooks/endpoints/:id/toggle
   * Toggle endpoint active status
   */
  async toggleEndpoint(
    userId: number,
    endpointId: number,
    isActive: boolean
  ): Promise<WebhookAPIResponse> {
    try {
      await this.webhookService.toggleEndpoint(endpointId, userId, isActive);
      
      return {
        success: true,
        message: `Webhook endpoint ${isActive ? 'activated' : 'deactivated'} successfully`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle endpoint',
      };
    }
  }

  // ============================================================================
  // ENDPOINT TESTING AND VALIDATION
  // ============================================================================

  /**
   * POST /api/webhooks/endpoints/:id/test
   * Test a webhook endpoint
   */
  async testEndpoint(
    userId: number,
    request: TestEndpointRequest
  ): Promise<WebhookAPIResponse> {
    try {
      const endpoint = await this.webhookService.getEndpointByIdAndUser(request.endpoint_id, userId);
      
      if (!endpoint) {
        return {
          success: false,
          error: 'Webhook endpoint not found',
        };
      }

      // Create test payload
      const testPayload = request.test_payload || {
        test: true,
        event_type: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook delivery',
          endpoint_name: endpoint.name,
        },
      };

      // Build headers
      const headers = this.buildTestHeaders(endpoint, testPayload, request.test_headers);

      // Make test request
      const startTime = Date.now();
      
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Pitchey-Webhooks-Test/1.0',
            ...headers,
          },
          body: JSON.stringify(testPayload),
        });

        const responseTime = Date.now() - startTime;
        const responseBody = await response.text();

        // Store test result
        await this.storeTestResult(
          request.endpoint_id,
          userId,
          'connectivity',
          response.ok,
          {
            status_code: response.status,
            response_time: responseTime,
            response_body: responseBody.substring(0, 1000), // Limit response body
            test_payload: testPayload,
          }
        );

        return {
          success: true,
          data: {
            passed: response.ok,
            status_code: response.status,
            response_time: responseTime,
            response_body: responseBody.substring(0, 1000),
            headers: Object.fromEntries(response.headers.entries()),
          },
          message: response.ok ? 'Test successful' : 'Test failed - check response details',
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        
        await this.storeTestResult(
          request.endpoint_id,
          userId,
          'connectivity',
          false,
          {
            error: error instanceof Error ? error.message : 'Network error',
            response_time: responseTime,
            test_payload: testPayload,
          }
        );

        return {
          success: false,
          data: {
            passed: false,
            error: error instanceof Error ? error.message : 'Network error',
            response_time: responseTime,
          },
          error: 'Test failed - unable to connect to endpoint',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test endpoint',
      };
    }
  }

  // ============================================================================
  // EVENT MANAGEMENT ROUTES
  // ============================================================================

  /**
   * POST /api/webhooks/events
   * Manually publish an event (for testing)
   */
  async publishEvent(
    userId: number,
    request: EventPublishRequest
  ): Promise<WebhookAPIResponse> {
    try {
      if (!request.event_type || !request.payload) {
        return {
          success: false,
          error: 'Missing required fields: event_type and payload are required',
        };
      }

      const eventId = await this.eventPublisher.publishEvent(
        request.event_type,
        request.payload,
        {
          resourceType: request.resource_type,
          resourceId: request.resource_id,
          triggeredBy: userId,
          source: request.source || 'manual',
          metadata: request.metadata,
          correlationId: request.correlation_id,
        }
      );

      return {
        success: true,
        data: {
          event_id: eventId,
          event_type: request.event_type,
          published_at: new Date().toISOString(),
        },
        message: 'Event published successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish event',
      };
    }
  }

  // ============================================================================
  // ANALYTICS AND MONITORING ROUTES
  // ============================================================================

  /**
   * GET /api/webhooks/endpoints/:id/analytics
   * Get endpoint analytics
   */
  async getEndpointAnalytics(
    userId: number,
    endpointId: number,
    period: 'hour' | 'day' | 'week' | 'month' = 'day',
    startDate?: string,
    endDate?: string
  ): Promise<WebhookAPIResponse> {
    try {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;
      
      const analytics = await this.webhookService.getEndpointAnalytics(
        endpointId,
        userId,
        period,
        start,
        end
      );

      return {
        success: true,
        data: analytics,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get analytics',
      };
    }
  }

  /**
   * GET /api/webhooks/endpoints/:id/deliveries
   * Get delivery history for endpoint
   */
  async getDeliveryHistory(
    userId: number,
    endpointId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<WebhookAPIResponse> {
    try {
      const offset = (page - 1) * limit;
      const result = await this.webhookService.getDeliveryHistory(
        endpointId,
        userId,
        limit + 1, // Get one extra to check if there are more
        offset
      );

      const deliveries = result.deliveries.slice(0, limit);
      const hasMore = result.deliveries.length > limit;

      return {
        success: true,
        data: deliveries,
        pagination: {
          page,
          limit,
          total: deliveries.length + offset + (hasMore ? 1 : 0),
          hasMore,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get delivery history',
      };
    }
  }

  // ============================================================================
  // TEMPLATES AND INTEGRATION ROUTES
  // ============================================================================

  /**
   * GET /api/webhooks/templates
   * List available webhook templates
   */
  async listTemplates(): Promise<WebhookAPIResponse> {
    try {
      // This would be implemented to fetch from webhook_templates table
      const templates = await this.getWebhookTemplates();

      return {
        success: true,
        data: templates,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list templates',
      };
    }
  }

  /**
   * POST /api/webhooks/endpoints/from-template
   * Create endpoint from template
   */
  async createEndpointFromTemplate(
    userId: number,
    templateId: number,
    config: {
      name: string;
      url: string;
      customizations?: Record<string, any>;
    }
  ): Promise<WebhookAPIResponse> {
    try {
      const template = await this.getWebhookTemplate(templateId);
      
      if (!template) {
        return {
          success: false,
          error: 'Template not found',
        };
      }

      // Create endpoint based on template
      const endpoint = await this.webhookService.createEndpoint({
        userId,
        name: config.name,
        description: template.description,
        url: config.url,
        eventTypes: template.eventTypes,
        timeout: template.defaultTimeout,
        retryPolicy: template.defaultRetryPolicy as any,
        rateLimit: template.recommendedRateLimit,
        headers: template.headerTemplates as Record<string, string>,
        metadata: {
          templateId: template.id,
          templateVersion: template.version,
          customizations: config.customizations,
        },
      });

      return {
        success: true,
        data: this.formatEndpointResponse(endpoint),
        message: 'Webhook endpoint created from template successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create endpoint from template',
      };
    }
  }

  // ============================================================================
  // SECURITY AND VALIDATION ROUTES
  // ============================================================================

  /**
   * POST /api/webhooks/verify-signature
   * Verify webhook signature (for endpoint consumers)
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): WebhookAPIResponse<{ valid: boolean }> {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const providedSignature = signature.startsWith('sha256=') 
        ? signature.substring(7) 
        : signature;

      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(providedSignature)
      );

      return {
        success: true,
        data: { valid: isValid },
      };
    } catch (error) {
      return {
        success: false,
        error: 'Invalid signature format',
        data: { valid: false },
      };
    }
  }

  /**
   * GET /api/webhooks/event-types
   * List available event types
   */
  getEventTypes(): WebhookAPIResponse<{ event_types: any[] }> {
    const eventTypes = [
      // User events
      { category: 'User', type: 'user.created', description: 'User account created' },
      { category: 'User', type: 'user.updated', description: 'User profile updated' },
      { category: 'User', type: 'user.verified', description: 'User email verified' },
      { category: 'User', type: 'user.login', description: 'User logged in' },
      { category: 'User', type: 'user.logout', description: 'User logged out' },

      // Pitch events
      { category: 'Pitch', type: 'pitch.created', description: 'New pitch created' },
      { category: 'Pitch', type: 'pitch.updated', description: 'Pitch updated' },
      { category: 'Pitch', type: 'pitch.published', description: 'Pitch published' },
      { category: 'Pitch', type: 'pitch.viewed', description: 'Pitch viewed' },
      { category: 'Pitch', type: 'pitch.liked', description: 'Pitch liked' },

      // NDA events
      { category: 'NDA', type: 'nda.requested', description: 'NDA requested' },
      { category: 'NDA', type: 'nda.signed', description: 'NDA signed' },
      { category: 'NDA', type: 'nda.approved', description: 'NDA approved' },
      { category: 'NDA', type: 'nda.rejected', description: 'NDA rejected' },

      // Investment events
      { category: 'Investment', type: 'investment.created', description: 'Investment created' },
      { category: 'Investment', type: 'investment.approved', description: 'Investment approved' },
      { category: 'Investment', type: 'investment.funded', description: 'Investment funded' },

      // Message events
      { category: 'Messaging', type: 'message.sent', description: 'Message sent' },
      { category: 'Messaging', type: 'message.read', description: 'Message read' },

      // Payment events
      { category: 'Payment', type: 'payment.succeeded', description: 'Payment successful' },
      { category: 'Payment', type: 'payment.failed', description: 'Payment failed' },
      { category: 'Payment', type: 'subscription.created', description: 'Subscription created' },
    ];

    return {
      success: true,
      data: { event_types: eventTypes },
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Format endpoint response for API
   */
  private formatEndpointResponse(endpoint: any): any {
    return {
      id: endpoint.id,
      name: endpoint.name,
      description: endpoint.description,
      url: endpoint.url,
      is_active: endpoint.isActive,
      event_types: endpoint.eventTypes,
      event_filters: endpoint.eventFilters,
      timeout: endpoint.timeout,
      retry_policy: endpoint.retryPolicy,
      rate_limit: endpoint.rateLimit,
      headers: endpoint.headers,
      metadata: endpoint.metadata,
      tags: endpoint.tags,
      health_status: endpoint.healthStatus,
      statistics: {
        total_deliveries: endpoint.totalDeliveries,
        successful_deliveries: endpoint.successfulDeliveries,
        failed_deliveries: endpoint.failedDeliveries,
        average_response_time: endpoint.averageResponseTime,
        uptime_percentage: endpoint.uptimePercentage,
        last_delivery_at: endpoint.lastDeliveryAt,
        last_success_at: endpoint.lastSuccessAt,
        last_failure_at: endpoint.lastFailureAt,
      },
      created_at: endpoint.createdAt,
      updated_at: endpoint.updatedAt,
    };
  }

  /**
   * Build headers for test requests
   */
  private buildTestHeaders(
    endpoint: any,
    payload: Record<string, any>,
    customHeaders?: Record<string, string>
  ): Record<string, string> {
    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', endpoint.secret)
      .update(payloadString)
      .digest('hex');

    return {
      'X-Webhook-Signature': `sha256=${signature}`,
      'X-Webhook-Timestamp': Date.now().toString(),
      'X-Webhook-ID': endpoint.id.toString(),
      'X-Webhook-Test': 'true',
      ...endpoint.headers,
      ...customHeaders,
    };
  }

  /**
   * Store test result
   */
  private async storeTestResult(
    endpointId: number,
    userId: number,
    testType: string,
    passed: boolean,
    details: Record<string, any>
  ): Promise<void> {
    // Implementation would store test results in webhook_test_results table
    console.log('Storing test result:', {
      endpointId,
      userId,
      testType,
      passed,
      details,
    });
  }

  /**
   * Get webhook templates (placeholder)
   */
  private async getWebhookTemplates(): Promise<any[]> {
    // This would query the webhook_templates table
    return [
      {
        id: 1,
        name: 'Slack Integration',
        description: 'Send notifications to Slack channels',
        category: 'messaging',
        provider: 'slack',
        event_types: ['user.created', 'pitch.created', 'investment.created'],
      },
      {
        id: 2,
        name: 'HubSpot CRM',
        description: 'Sync contacts and deals with HubSpot',
        category: 'crm',
        provider: 'hubspot',
        event_types: ['user.created', 'user.updated', 'investment.created'],
      },
      {
        id: 3,
        name: 'Mailchimp Marketing',
        description: 'Add users to Mailchimp lists',
        category: 'email',
        provider: 'mailchimp',
        event_types: ['user.created', 'user.verified'],
      },
    ];
  }

  /**
   * Get specific webhook template
   */
  private async getWebhookTemplate(templateId: number): Promise<WebhookTemplate | null> {
    // This would query the webhook_templates table
    const templates = await this.getWebhookTemplates();
    return templates.find(t => t.id === templateId) || null;
  }
}