/**
 * Webhook Service
 * Frontend service for managing webhook endpoints and interactions
 */

import { apiRequest } from './api.service';

export interface WebhookEndpoint {
  id: number;
  name: string;
  description?: string;
  url: string;
  is_active: boolean;
  event_types: string[];
  event_filters?: Record<string, any>;
  timeout: number;
  retry_policy: {
    max_attempts: number;
    backoff_type: 'linear' | 'exponential';
    base_delay: number;
  };
  rate_limit: number;
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
  tags?: string[];
  health_status: string;
  statistics: {
    total_deliveries: number;
    successful_deliveries: number;
    failed_deliveries: number;
    average_response_time: number;
    uptime_percentage: number;
    last_delivery_at?: string;
    last_success_at?: string;
    last_failure_at?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface CreateEndpointRequest {
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

export interface UpdateEndpointRequest {
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

export interface TestEndpointRequest {
  endpoint_id: number;
  test_payload?: Record<string, any>;
  test_headers?: Record<string, string>;
}

export interface TestResult {
  passed: boolean;
  status_code?: number;
  response_time: number;
  response_body?: string;
  error?: string;
  headers?: Record<string, string>;
}

export interface WebhookDelivery {
  id: number;
  delivery_id: string;
  status: string;
  http_method: string;
  request_url: string;
  request_payload: Record<string, any>;
  response_status?: number;
  response_body?: string;
  response_time?: number;
  attempt_number: number;
  max_attempts: number;
  error_message?: string;
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  event: {
    id: number;
    event_id: string;
    event_type: string;
    resource_type?: string;
    triggered_at: string;
  };
}

export interface WebhookAnalytics {
  endpoint: {
    id: number;
    name: string;
    url: string;
    is_active: boolean;
    health_status: string;
  };
  period: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  analytics: Array<{
    period_start: string;
    period_end: string;
    total_deliveries: number;
    successful_deliveries: number;
    failed_deliveries: number;
    average_response_time: number;
    error_rate: number;
  }>;
  summary: {
    totalDeliveries: number;
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

export interface WebhookTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  provider: string;
  event_types: string[];
  documentation?: string;
  setup_instructions?: string;
}

export interface EventType {
  category: string;
  type: string;
  description: string;
}

export interface ApiResponse<T = any> {
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

class WebhookService {
  /**
   * List user's webhook endpoints
   */
  async listEndpoints(): Promise<ApiResponse<WebhookEndpoint[]>> {
    return apiRequest<WebhookEndpoint[]>('/api/webhooks/endpoints', {
      method: 'GET',
    });
  }

  /**
   * Get a specific webhook endpoint
   */
  async getEndpoint(endpointId: number): Promise<ApiResponse<WebhookEndpoint>> {
    return apiRequest<WebhookEndpoint>(`/api/webhooks/endpoints/${endpointId}`, {
      method: 'GET',
    });
  }

  /**
   * Create a new webhook endpoint
   */
  async createEndpoint(data: CreateEndpointRequest): Promise<ApiResponse<WebhookEndpoint>> {
    return apiRequest<WebhookEndpoint>('/api/webhooks/endpoints', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a webhook endpoint
   */
  async updateEndpoint(
    endpointId: number,
    data: UpdateEndpointRequest
  ): Promise<ApiResponse<WebhookEndpoint>> {
    return apiRequest<WebhookEndpoint>(`/api/webhooks/endpoints/${endpointId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a webhook endpoint
   */
  async deleteEndpoint(endpointId: number): Promise<ApiResponse> {
    return apiRequest(`/api/webhooks/endpoints/${endpointId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Toggle endpoint active status
   */
  async toggleEndpoint(endpointId: number, isActive: boolean): Promise<ApiResponse> {
    return apiRequest(`/api/webhooks/endpoints/${endpointId}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ is_active: isActive }),
    });
  }

  /**
   * Test a webhook endpoint
   */
  async testEndpoint(data: TestEndpointRequest): Promise<ApiResponse<TestResult>> {
    return apiRequest<TestResult>(`/api/webhooks/endpoints/${data.endpoint_id}/test`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get endpoint analytics
   */
  async getEndpointAnalytics(
    endpointId: number,
    period: 'hour' | 'day' | 'week' | 'month' = 'day',
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<WebhookAnalytics>> {
    const params = new URLSearchParams({
      period,
      ...(startDate && { start_date: startDate }),
      ...(endDate && { end_date: endDate }),
    });

    return apiRequest<WebhookAnalytics>(
      `/api/webhooks/endpoints/${endpointId}/analytics?${params}`,
      {
        method: 'GET',
      }
    );
  }

  /**
   * Get delivery history for endpoint
   */
  async getDeliveryHistory(
    endpointId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<ApiResponse<WebhookDelivery[]>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    return apiRequest<WebhookDelivery[]>(
      `/api/webhooks/endpoints/${endpointId}/deliveries?${params}`,
      {
        method: 'GET',
      }
    );
  }

  /**
   * Manually publish an event (for testing)
   */
  async publishEvent(data: {
    event_type: string;
    resource_type?: string;
    resource_id?: number;
    payload: Record<string, any>;
    source?: string;
    metadata?: Record<string, any>;
    correlation_id?: string;
  }): Promise<ApiResponse<{ event_id: string; event_type: string; published_at: string }>> {
    return apiRequest('/api/webhooks/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * List available webhook templates
   */
  async listTemplates(): Promise<ApiResponse<WebhookTemplate[]>> {
    return apiRequest<WebhookTemplate[]>('/api/webhooks/templates', {
      method: 'GET',
    });
  }

  /**
   * Create endpoint from template
   */
  async createEndpointFromTemplate(
    templateId: number,
    config: {
      name: string;
      url: string;
      customizations?: Record<string, any>;
    }
  ): Promise<ApiResponse<WebhookEndpoint>> {
    return apiRequest<WebhookEndpoint>('/api/webhooks/endpoints/from-template', {
      method: 'POST',
      body: JSON.stringify({}),
        template_id: templateId,
        ...config,
      }),
    });
  }

  /**
   * Verify webhook signature (for developers)
   */
  async verifySignature(
    payload: string,
    signature: string,
    secret: string
  ): Promise<ApiResponse<{ valid: boolean }>> {
    return apiRequest<{ valid: boolean }>('/api/webhooks/verify-signature', {
      method: 'POST',
      body: JSON.stringify({}),
        payload,
        signature,
        secret,
      }),
    });
  }

  /**
   * Get available event types
   */
  async getEventTypes(): Promise<ApiResponse<{ event_types: EventType[] }>> {
    return apiRequest<{ event_types: EventType[] }>('/api/webhooks/event-types', {
      method: 'GET',
    });
  }

  /**
   * Generate code snippets for webhook integration
   */
  generateCodeSnippet(
    endpoint: WebhookEndpoint,
    language: 'javascript' | 'python' | 'php' | 'curl'
  ): string {
    const url = endpoint.url;
    const secret = '***'; // Hidden for security

    switch (language) {
      case 'javascript':
        return `// Express.js webhook handler
const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.raw({ type: 'application/json' }));

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const payload = req.body;
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', '${secret}')
    .update(timestamp + '.' + payload)
    .digest('hex');
  
  if (signature !== 'sha256=' + expectedSignature) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(payload);
  console.log('Received event:', event.event_type);
  
  // Process your event here
  // ...
  
  res.status(200).send('OK');
});

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
});`;

      case 'python':
        return `# Flask webhook handler
import hashlib
import hmac
import json
from flask import Flask, request, abort

app = Flask(__name__)
WEBHOOK_SECRET = '${secret}'

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Webhook-Signature', '')
    timestamp = request.headers.get('X-Webhook-Timestamp', '')
    payload = request.get_data()
    
    # Verify signature
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode(),
        (timestamp + '.' + payload.decode()).encode(),
        hashlib.sha256
    ).hexdigest()
    
    if signature != f'sha256={expected_signature}':
        abort(401, 'Invalid signature')
    
    event = json.loads(payload)
    print(f"Received event: {event['event_type']}")
    
    # Process your event here
    # ...
    
    return 'OK', 200

if __name__ == '__main__':
    app.run(port=5000)`;

      case 'php':
        return `<?php
// PHP webhook handler
$webhook_secret = '${secret}';

// Get headers and payload
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';
$timestamp = $_SERVER['HTTP_X_WEBHOOK_TIMESTAMP'] ?? '';
$payload = file_get_contents('php://input');

// Verify signature
$expected_signature = 'sha256=' . hash_hmac('sha256', $timestamp . '.' . $payload, $webhook_secret);

if (!hash_equals($signature, $expected_signature)) {
    http_response_code(401);
    die('Invalid signature');
}

$event = json_decode($payload, true);
error_log('Received event: ' . $event['event_type']);

// Process your event here
// ...

http_response_code(200);
echo 'OK';
?>`;

      case 'curl':
        return `# Test webhook endpoint
curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Signature: sha256=YOUR_SIGNATURE_HERE" \\
  -H "X-Webhook-Timestamp: $(date +%s)" \\
  -d '{
    "event_id": "test_event_123",
    "timestamp": "2024-01-01T12:00:00Z",
    "webhook": {
      "id": ${endpoint.id},
      "name": "${endpoint.name}"
    },
    "data": {
      "event_type": "test.event",
      "message": "This is a test webhook"
    }
  }'`;

      default:
        return '';
    }
  }

  /**
   * Format event type for display
   */
  formatEventType(eventType: string): string {
    return eventType
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get event category color
   */
  getEventCategoryColor(eventType: string): string {
    const category = eventType.split('.')[0];
    
    switch (category) {
      case 'user': return 'blue';
      case 'pitch': return 'green';
      case 'nda': return 'purple';
      case 'investment': return 'yellow';
      case 'message': return 'indigo';
      case 'payment': return 'pink';
      case 'analytics': return 'gray';
      case 'system': return 'red';
      default: return 'gray';
    }
  }

  /**
   * Validate webhook URL
   */
  validateWebhookUrl(url: string): { valid: boolean; error?: string } {
    try {
      const urlObj = new URL(url);
      
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
      }
      
      if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
        return { valid: false, error: 'Localhost URLs are not allowed' };
      }
      
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  /**
   * Calculate health score
   */
  calculateHealthScore(endpoint: WebhookEndpoint): number {
    const stats = endpoint.statistics;
    let score = 100;
    
    // Deduct for low success rate
    const successRate = stats.total_deliveries > 0 
      ? (stats.successful_deliveries / stats.total_deliveries) * 100 
      : 100;
    score = score * (successRate / 100);
    
    // Deduct for slow response times
    if (stats.average_response_time > 5000) {
      score *= 0.5; // 50% penalty for very slow responses
    } else if (stats.average_response_time > 2000) {
      score *= 0.8; // 20% penalty for slow responses
    }
    
    // Deduct for low uptime
    score = score * (stats.uptime_percentage / 100);
    
    return Math.round(score);
  }

  /**
   * Get health recommendations
   */
  getHealthRecommendations(endpoint: WebhookEndpoint): string[] {
    const recommendations: string[] = [];
    const stats = endpoint.statistics;
    
    const successRate = stats.total_deliveries > 0 
      ? (stats.successful_deliveries / stats.total_deliveries) * 100 
      : 100;
    
    if (successRate < 95) {
      recommendations.push('Improve error handling in your webhook endpoint');
    }
    
    if (stats.average_response_time > 2000) {
      recommendations.push('Optimize your webhook endpoint response time');
    }
    
    if (stats.uptime_percentage < 99) {
      recommendations.push('Ensure your webhook endpoint has high availability');
    }
    
    if (!endpoint.is_active) {
      recommendations.push('Activate your webhook endpoint to receive events');
    }
    
    if (endpoint.health_status === 'unhealthy') {
      recommendations.push('Check your webhook endpoint for connectivity issues');
    }
    
    return recommendations;
  }
}

export const webhookService = new WebhookService();
export default webhookService;