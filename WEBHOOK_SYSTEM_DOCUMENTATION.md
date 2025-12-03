# Pitchey Webhook System Documentation

## Overview

The Pitchey Webhook System provides a comprehensive real-time integration platform that enables third-party services to receive instant notifications about platform events. This system supports CRM integrations, email marketing automation, analytics platforms, payment processors, and custom applications.

## Architecture

### Core Components

1. **Webhook Management Service** - Endpoint registration and configuration
2. **Event Publishing System** - Real-time event routing and delivery
3. **Security Layer** - Authentication, rate limiting, and security monitoring
4. **Developer Dashboard** - Web interface for webhook management
5. **Analytics & Monitoring** - Delivery tracking and performance metrics

### Technology Stack

- **Backend**: TypeScript on Cloudflare Workers
- **Database**: PostgreSQL with Drizzle ORM
- **Cache**: Redis for rate limiting and real-time features
- **Security**: HMAC-SHA256 signatures, rate limiting, circuit breakers
- **Monitoring**: Real-time analytics and delivery tracking

## Getting Started

### 1. Create a Webhook Endpoint

```typescript
// Using the frontend dashboard
const endpoint = await webhookService.createEndpoint({
  name: 'My CRM Integration',
  url: 'https://myapp.com/webhooks/pitchey',
  event_types: ['user.created', 'pitch.created', 'investment.made'],
  timeout: 30,
  retry_policy: {
    max_attempts: 3,
    backoff_type: 'exponential',
    base_delay: 1000
  }
});
```

### 2. Handle Webhook Events

```javascript
// Express.js example
const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.raw({ type: 'application/json' }));

app.post('/webhooks/pitchey', (req, res) => {
  // Verify signature
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const payload = req.body;
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(timestamp + '.' + payload)
    .digest('hex');
  
  if (signature !== 'sha256=' + expectedSignature) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(payload);
  
  // Handle different event types
  switch (event.data.event_type) {
    case 'user.created':
      handleUserCreated(event.data);
      break;
    case 'pitch.created':
      handlePitchCreated(event.data);
      break;
    case 'investment.made':
      handleInvestmentMade(event.data);
      break;
  }
  
  res.status(200).send('OK');
});
```

## Event Types

### User Events
- `user.created` - New user registration
- `user.updated` - User profile changes
- `user.verified` - Email verification completed
- `user.login` - User login event
- `user.logout` - User logout event

### Pitch Events
- `pitch.created` - New pitch submitted
- `pitch.updated` - Pitch modified
- `pitch.published` - Pitch made public
- `pitch.viewed` - Pitch viewed by user
- `pitch.liked` - Pitch liked/favorited

### NDA Events
- `nda.requested` - NDA request submitted
- `nda.signed` - NDA digitally signed
- `nda.approved` - NDA approved by creator
- `nda.rejected` - NDA request denied

### Investment Events
- `investment.created` - Investment interest expressed
- `investment.approved` - Investment approved
- `investment.funded` - Investment completed

### Message Events
- `message.sent` - Message sent between users
- `message.read` - Message marked as read

### Payment Events
- `payment.succeeded` - Payment processed successfully
- `payment.failed` - Payment failed
- `subscription.created` - New subscription started

## Payload Format

All webhook payloads follow this structure:

```json
{
  "event_id": "evt_1234567890",
  "timestamp": "2024-01-15T10:30:00Z",
  "webhook": {
    "id": 42,
    "name": "My Webhook Endpoint"
  },
  "data": {
    "event_type": "user.created",
    "user": {
      "id": 123,
      "email": "user@example.com",
      "username": "newuser",
      "user_type": "creator",
      "created_at": "2024-01-15T10:30:00Z"
    }
  }
}
```

## Security

### Signature Verification

All webhook requests include an HMAC-SHA256 signature in the `X-Webhook-Signature` header:

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret, timestamp) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(timestamp + '.' + payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature.replace('sha256=', '')),
    Buffer.from(expectedSignature)
  );
}
```

### Rate Limiting

- Default: 100 requests per minute per endpoint
- Adaptive rate limiting based on endpoint performance
- Circuit breaker protection for failing endpoints

### Security Features

- HTTPS requirement for all webhook URLs
- Signature verification with timestamp validation
- IP allowlisting and blocklisting
- Suspicious activity detection
- Security audit logs

## Rate Limiting & Reliability

### Retry Logic

Failed webhook deliveries are automatically retried with exponential backoff:

1. **Immediate retry** - If endpoint returns 5xx error
2. **1 second delay** - First retry attempt
3. **2 second delay** - Second retry attempt  
4. **4 second delay** - Third retry attempt

### Circuit Breaker

Endpoints with consistent failures are temporarily disabled:

- **Failure threshold**: 5 consecutive failures
- **Open duration**: 5 minutes
- **Half-open test**: Single request to test recovery

### Dead Letter Queue

Failed deliveries after all retries are stored for:
- Manual retry through dashboard
- Debug and troubleshooting
- Data recovery

## Integration Templates

### Slack Notifications

```javascript
// Slack webhook integration
app.post('/webhooks/slack', (req, res) => {
  const event = JSON.parse(req.body);
  
  const slackMessage = {
    text: `New ${event.data.event_type} event`,
    attachments: [{
      color: 'good',
      fields: [
        {
          title: 'Event Type',
          value: event.data.event_type,
          short: true
        },
        {
          title: 'Timestamp',
          value: event.timestamp,
          short: true
        }
      ]
    }]
  };
  
  // Send to Slack
  fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slackMessage)
  });
  
  res.status(200).send('OK');
});
```

### HubSpot CRM Sync

```javascript
// HubSpot contact sync
app.post('/webhooks/hubspot', (req, res) => {
  const event = JSON.parse(req.body);
  
  if (event.data.event_type === 'user.created') {
    const contact = {
      properties: {
        email: event.data.user.email,
        firstname: event.data.user.first_name,
        lastname: event.data.user.last_name,
        company: event.data.user.company_name,
        user_type: event.data.user.user_type,
        pitchey_user_id: event.data.user.id.toString()
      }
    };
    
    // Create contact in HubSpot
    fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contact)
    });
  }
  
  res.status(200).send('OK');
});
```

### Mailchimp List Sync

```javascript
// Mailchimp subscriber sync
app.post('/webhooks/mailchimp', (req, res) => {
  const event = JSON.parse(req.body);
  
  if (event.data.event_type === 'user.verified') {
    const subscriber = {
      email_address: event.data.user.email,
      status: 'subscribed',
      merge_fields: {
        FNAME: event.data.user.first_name,
        LNAME: event.data.user.last_name,
        USERTYPE: event.data.user.user_type
      },
      tags: [event.data.user.user_type, 'pitchey-user']
    };
    
    // Add to Mailchimp list
    fetch(`https://us1.api.mailchimp.com/3.0/lists/${process.env.MAILCHIMP_LIST_ID}/members`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MAILCHIMP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscriber)
    });
  }
  
  res.status(200).send('OK');
});
```

## API Reference

### Create Endpoint

```http
POST /api/webhooks/endpoints
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Webhook",
  "url": "https://myapp.com/webhooks",
  "event_types": ["user.created", "pitch.created"],
  "timeout": 30,
  "retry_policy": {
    "max_attempts": 3,
    "backoff_type": "exponential",
    "base_delay": 1000
  },
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

### List Endpoints

```http
GET /api/webhooks/endpoints
Authorization: Bearer <token>
```

### Update Endpoint

```http
PUT /api/webhooks/endpoints/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Webhook Name",
  "is_active": true
}
```

### Test Endpoint

```http
POST /api/webhooks/endpoints/{id}/test
Authorization: Bearer <token>
Content-Type: application/json

{
  "test_payload": {
    "message": "Test webhook delivery"
  }
}
```

### Get Analytics

```http
GET /api/webhooks/endpoints/{id}/analytics?period=day&start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer <token>
```

## Monitoring & Analytics

### Dashboard Metrics

- **Success Rate** - Percentage of successful deliveries
- **Response Time** - Average endpoint response time
- **Uptime** - Endpoint availability percentage
- **Error Rate** - Failed delivery percentage

### Performance Monitoring

- Real-time delivery status
- Response time tracking
- Error categorization
- Health score calculation

### Alerting

- Failed delivery notifications
- Security violation alerts
- Performance degradation warnings
- Circuit breaker activations

## Best Practices

### Endpoint Implementation

1. **Idempotency** - Handle duplicate events gracefully
2. **Fast Response** - Return 200 OK quickly (< 2 seconds)
3. **Error Handling** - Return appropriate HTTP status codes
4. **Signature Verification** - Always verify webhook signatures
5. **Timeout Handling** - Set appropriate request timeouts

### Security

1. **Use HTTPS** - Only accept webhooks over secure connections
2. **Verify Signatures** - Implement signature verification
3. **Validate Timestamps** - Check for replay attacks
4. **Allowlist IPs** - Restrict webhook sources if needed
5. **Monitor Activity** - Log and monitor webhook activity

### Performance

1. **Async Processing** - Process webhooks asynchronously
2. **Rate Limiting** - Implement your own rate limiting
3. **Caching** - Cache responses when appropriate
4. **Load Balancing** - Use multiple endpoints for high volume

## Troubleshooting

### Common Issues

**Signature Verification Failures**
- Check webhook secret configuration
- Verify timestamp inclusion in signature
- Ensure proper encoding (UTF-8)

**Delivery Failures**
- Check endpoint URL accessibility
- Verify SSL/TLS certificate validity
- Monitor response times and status codes

**Rate Limit Exceeded**
- Increase endpoint rate limits
- Implement request queueing
- Use multiple webhook endpoints

### Debug Tools

- **Test Endpoint** - Send test payloads to verify connectivity
- **Delivery History** - View detailed delivery logs and responses
- **Analytics Dashboard** - Monitor performance metrics
- **Security Logs** - Review security events and violations

## Support

For additional support with webhook integration:

1. **Documentation** - Review this comprehensive guide
2. **Dashboard** - Use the webhook management interface
3. **API Reference** - Consult the detailed API documentation
4. **Templates** - Use pre-built integration templates
5. **Testing Tools** - Utilize built-in testing and debugging features

## Migration Guide

### From Other Webhook Systems

1. **Export Configuration** - Document existing webhook endpoints
2. **Create New Endpoints** - Set up endpoints in Pitchey dashboard  
3. **Update URLs** - Point existing integrations to new endpoints
4. **Test Thoroughly** - Verify all integrations work correctly
5. **Monitor Performance** - Watch metrics during transition

### Version Updates

- **Backward Compatibility** - Event formats remain stable
- **New Event Types** - Subscribe to new events as needed
- **Security Updates** - Update signature verification as required
- **Performance Improvements** - No action needed for optimization updates