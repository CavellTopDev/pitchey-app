# Email and Messaging System Integration Guide

This comprehensive guide covers the deployment, configuration, and maintenance of Pitchey's email and messaging systems.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Service Dependencies](#service-dependencies)
3. [API Endpoints](#api-endpoints)
4. [Configuration Requirements](#configuration-requirements)
5. [Deployment Steps](#deployment-steps)
6. [Monitoring and Health Checks](#monitoring-and-health-checks)
7. [Troubleshooting](#troubleshooting)
8. [Security Considerations](#security-considerations)

## Architecture Overview

The email and messaging system consists of three core services that work together to provide comprehensive communication capabilities:

```mermaid
graph TB
    %% User Interfaces
    Frontend[Frontend Application]
    API[API Gateway/Worker]
    
    %% Core Services
    EmailService[Email Service]
    MessagingService[Messaging Service] 
    NotificationService[Notification Orchestrator]
    
    %% External Services
    SendGrid[SendGrid API]
    AWS_SES[AWS SES]
    Redis[Upstash Redis]
    DB[(Neon PostgreSQL)]
    R2[Cloudflare R2]
    WS[WebSocket Connections]
    
    %% Data Flow
    Frontend --> API
    API --> NotificationService
    API --> MessagingService
    
    NotificationService --> EmailService
    NotificationService --> MessagingService
    NotificationService --> Redis
    
    EmailService --> SendGrid
    EmailService --> AWS_SES
    EmailService --> Redis
    
    MessagingService --> DB
    MessagingService --> Redis
    MessagingService --> R2
    MessagingService --> WS
    
    %% Persistence
    NotificationService --> DB
    EmailService --> DB
    
    style EmailService fill:#e1f5fe
    style MessagingService fill:#f3e5f5
    style NotificationService fill:#e8f5e8
```

### Core Components

#### 1. Email Service (`/src/services/email.service.ts`)
- **Purpose**: Handles all email communications with multi-provider support
- **Features**:
  - Multi-provider support (SendGrid, AWS SES)
  - Automatic failover between providers
  - Rate limiting and queuing
  - Template-based emails with variable substitution
  - Delivery tracking and retry logic
  - Attachment support

#### 2. Messaging Service (`/src/services/messaging.service.ts`)
- **Purpose**: Real-time messaging with WebSocket integration
- **Features**:
  - Real-time WebSocket messaging
  - End-to-end encryption support
  - File attachments via R2 storage
  - Read receipts and typing indicators
  - Message search and filtering
  - User blocking and moderation

#### 3. Notification Orchestrator (`/src/services/notification.service.ts`)
- **Purpose**: Coordinates notifications across all channels
- **Features**:
  - Multi-channel orchestration (email, in-app, push, SMS)
  - User preference management
  - Quiet hours and timezone support
  - Batch processing and queuing
  - Delivery analytics and metrics
  - A/B testing support

## Service Dependencies

### Required External Services

#### Database (Neon PostgreSQL)
- **Tables Used**:
  - `notifications` - Notification records
  - `notification_preferences` - User preferences
  - `notification_deliveries` - Delivery tracking
  - `conversations` - Message conversations
  - `messages` - Individual messages
  - `message_attachments` - File attachments
  - `email_logs` - Email delivery logs

#### Redis (Upstash)
- **Usage**:
  - Notification queuing
  - Real-time message broadcasting
  - Typing indicators
  - User presence tracking
  - Rate limiting counters
  - Email template caching

#### Storage (Cloudflare R2)
- **Usage**:
  - Message attachments
  - Email attachments
  - Media file thumbnails

### Email Providers

#### SendGrid (Primary)
```bash
# Required Environment Variables
SENDGRID_API_KEY=your_api_key
SENDGRID_FROM_EMAIL=noreply@pitchey.com
SENDGRID_FROM_NAME=Pitchey
```

#### AWS SES (Fallback)
```bash
# Required Environment Variables
AWS_SES_ACCESS_KEY=your_access_key
AWS_SES_SECRET_KEY=your_secret_key
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@pitchey.com
AWS_SES_FROM_NAME=Pitchey
```

## API Endpoints

### Email Service Endpoints

#### Send Email
```http
POST /api/email/send
Content-Type: application/json

{
  "to": "user@example.com",
  "subject": "Test Email",
  "html": "<p>HTML content</p>",
  "text": "Text content",
  "templateType": "welcome",
  "variables": {
    "name": "John Doe",
    "verificationUrl": "https://app.com/verify/token"
  }
}
```

#### Send Templated Email
```http
POST /api/email/template
Content-Type: application/json

{
  "templateType": "nda_request",
  "to": "investor@example.com",
  "variables": {
    "investorName": "Jane Smith",
    "pitchTitle": "Revolutionary AI Startup",
    "creatorName": "John Doe",
    "reviewUrl": "https://app.com/nda/review/123"
  },
  "priority": "high"
}
```

#### Get Email Metrics
```http
GET /api/email/metrics?startDate=2024-01-01&endDate=2024-01-31
```

### Messaging Service Endpoints

#### Get Conversations
```http
GET /api/messaging/conversations?limit=20&offset=0
```

#### Send Message
```http
POST /api/messaging/send
Content-Type: application/json

{
  "conversationId": 123,
  "content": "Hello, this is a test message",
  "messageType": "text",
  "priority": "normal",
  "isEncrypted": false
}
```

#### Upload Message Attachment
```http
POST /api/messaging/attachments
Content-Type: multipart/form-data

files: [file1.pdf, file2.jpg]
```

### Notification Service Endpoints

#### Send Notification
```http
POST /api/notifications/send
Content-Type: application/json

{
  "userId": 123,
  "type": "nda_request",
  "title": "New NDA Request",
  "message": "You have received a new NDA request",
  "priority": "normal",
  "channels": {
    "email": true,
    "push": true,
    "inApp": true
  },
  "relatedPitchId": 456,
  "actionUrl": "/nda/review/789"
}
```

#### Get User Notifications
```http
GET /api/notifications/user/123?limit=20&includeRead=false
```

#### Update User Preferences
```http
PATCH /api/notifications/preferences/123
Content-Type: application/json

{
  "emailNotifications": true,
  "pushNotifications": true,
  "quietHoursEnabled": true,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "08:00",
  "timezone": "America/New_York"
}
```

## Configuration Requirements

### Environment Variables

#### Core Configuration
```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Application
FRONTEND_URL=https://pitchey-5o8.pages.dev
ENVIRONMENT=production

# Security
BETTER_AUTH_SECRET=your-secret-key
JWT_SECRET=your-jwt-secret  # For legacy compatibility
```

#### Email Service Configuration
```bash
# Primary Provider (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@pitchey.com
SENDGRID_FROM_NAME=Pitchey

# Fallback Provider (AWS SES)
AWS_SES_ACCESS_KEY=your_aws_access_key
AWS_SES_SECRET_KEY=your_aws_secret_key
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@pitchey.com
AWS_SES_FROM_NAME=Pitchey

# Email Service Settings
EMAIL_PRIMARY_PROVIDER=sendgrid
EMAIL_RATE_LIMIT_MINUTE=50
EMAIL_RATE_LIMIT_HOUR=1000
EMAIL_RATE_LIMIT_DAY=10000
EMAIL_MAX_RETRIES=3
EMAIL_RETRY_DELAY=1000
EMAIL_RETRY_MAX_DELAY=30000
EMAIL_QUEUE_CONCURRENT=5
EMAIL_QUEUE_INTERVAL=10000
```

#### Messaging Configuration
```bash
# WebSocket Settings
WS_HEARTBEAT_INTERVAL=30000
WS_CONNECTION_TIMEOUT=60000

# File Upload Settings
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES=pdf,doc,docx,jpg,jpeg,png,gif,mp4,mov

# Encryption Settings
ENABLE_E2E_ENCRYPTION=true
```

#### Notification Configuration
```bash
# Processing Settings
NOTIFICATION_PROCESSING_INTERVAL=5000
NOTIFICATION_BATCH_SIZE=10
NOTIFICATION_MAX_RETRIES=3

# Queue Settings
NOTIFICATION_QUEUE_TTL=86400  # 24 hours

# Push Notifications (Future)
FCM_SERVER_KEY=your_fcm_key
APNS_CERTIFICATE_PATH=/path/to/cert.p8
APNS_KEY_ID=your_key_id
APNS_TEAM_ID=your_team_id

# SMS Configuration (Future)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890
```

### Cloudflare Worker Configuration (wrangler.toml)

The system requires specific Cloudflare Worker bindings and environment setup:

```toml
# Email Service Bindings
[[kv_namespaces]]
binding = "EMAIL_CACHE"
id = "your-kv-namespace-id"

# Messaging Service Bindings
[[r2_buckets]]
binding = "MESSAGE_ATTACHMENTS"
bucket_name = "pitchey-message-attachments"

[[durable_objects.bindings]]
name = "MESSAGE_ROOMS"
class_name = "MessageRoom"
script_name = "pitchey-messaging"

# Notification Service Bindings
[[kv_namespaces]]
binding = "NOTIFICATION_CACHE"
id = "your-notification-cache-id"

[[queues.producers]]
binding = "NOTIFICATION_QUEUE"
queue = "notification-processing"

[[queues.consumers]]
queue = "notification-processing"
max_batch_size = 10
max_batch_timeout = 30
```

## Deployment Steps

### Prerequisites

1. **Cloudflare Account Setup**
   - Workers Paid plan (for Durable Objects and Queues)
   - R2 storage enabled
   - KV namespaces created

2. **External Services**
   - Neon PostgreSQL database
   - Upstash Redis instance
   - SendGrid account (primary email provider)
   - AWS SES configured (fallback email provider)

### Step-by-Step Deployment

#### 1. Environment Setup
```bash
# Clone repository
git clone <repository-url>
cd pitchey_v0.2

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.production
# Edit .env.production with your values
```

#### 2. Database Schema
```bash
# Run database migrations
npm run migrate:production

# Seed initial data if needed
npm run seed:production
```

#### 3. Configure Cloudflare Secrets
```bash
# Set all required secrets
wrangler secret put DATABASE_URL
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN
wrangler secret put SENDGRID_API_KEY
wrangler secret put AWS_SES_ACCESS_KEY
wrangler secret put AWS_SES_SECRET_KEY
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put JWT_SECRET
```

#### 4. Deploy Worker
```bash
# Build and deploy
npm run build:worker
wrangler deploy

# Verify deployment
curl https://your-worker.your-subdomain.workers.dev/api/health
```

#### 5. Test Services
```bash
# Run integration tests
npm run test:integration

# Run deployment script
./scripts/deploy-email-messaging.sh
```

### Automated Deployment

Use the provided deployment script for automated setup:

```bash
chmod +x scripts/deploy-email-messaging.sh
./scripts/deploy-email-messaging.sh
```

This script will:
- Validate all environment variables
- Run database migrations
- Deploy the Worker
- Run health checks
- Validate service connectivity

## Monitoring and Health Checks

### Health Check Endpoints

#### Overall System Health
```http
GET /api/health
```
Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "email": "healthy",
    "messaging": "healthy"
  },
  "metrics": {
    "uptime": "99.99%",
    "responseTime": "45ms"
  }
}
```

#### Email Service Health
```http
GET /api/email/health
```

#### Messaging Service Health
```http
GET /api/messaging/health
```

#### Notification Service Health
```http
GET /api/notifications/health
```

### Monitoring Metrics

#### Key Performance Indicators

1. **Email Delivery Metrics**
   - Delivery rate: Target >98%
   - Bounce rate: Target <2%
   - Open rate: Target >25%
   - Response time: Target <2 seconds

2. **Messaging Performance**
   - Message delivery time: Target <100ms
   - WebSocket connection success: Target >99%
   - File upload success: Target >99%

3. **Notification Metrics**
   - Processing time: Target <5 seconds
   - Queue depth: Monitor for backlog
   - Channel success rates: Target >95%

#### Alerting Thresholds

```yaml
alerts:
  email_delivery_rate:
    threshold: 95%
    severity: critical
  
  message_queue_depth:
    threshold: 1000
    severity: warning
  
  notification_processing_time:
    threshold: 10s
    severity: warning
  
  websocket_error_rate:
    threshold: 5%
    severity: critical
```

### Logging and Observability

#### Structured Logging
All services use structured JSON logging:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "service": "email",
  "action": "send_email",
  "userId": 123,
  "emailId": "abc123",
  "provider": "sendgrid",
  "duration": 1200,
  "success": true
}
```

#### Sentry Integration
Error tracking with Sentry for production monitoring:

```bash
# Set Sentry DSN
wrangler secret put SENTRY_DSN
```

#### Custom Metrics
Track custom business metrics:

```typescript
// Email metrics
analytics.track('email_sent', {
  provider: 'sendgrid',
  template: 'nda_request',
  success: true
});

// Message metrics
analytics.track('message_sent', {
  conversationId: 123,
  messageType: 'text',
  encrypted: false
});
```

## Troubleshooting

### Common Issues

#### Email Delivery Problems

**Issue**: Emails not being delivered
```bash
# Check email service health
curl https://your-api.com/api/email/health

# Check provider status
curl https://your-api.com/api/email/metrics

# Review logs
wrangler tail --env production | grep "email"
```

**Resolution Steps**:
1. Verify API keys are correctly configured
2. Check provider rate limits
3. Review bounce and block lists
4. Validate DNS records (SPF, DKIM, DMARC)

#### WebSocket Connection Issues

**Issue**: Real-time messaging not working
```bash
# Check WebSocket health
wscat -c wss://your-api.com/ws

# Monitor connection logs
wrangler tail --env production | grep "websocket"
```

**Resolution Steps**:
1. Verify Durable Object bindings
2. Check CORS configuration
3. Monitor connection limits
4. Review Redis connectivity

#### Database Connection Problems

**Issue**: Database queries failing
```bash
# Test database connectivity
curl https://your-api.com/api/health

# Check connection pool
curl https://your-api.com/api/debug/db-stats
```

**Resolution Steps**:
1. Verify DATABASE_URL secret
2. Check Neon database status
3. Review connection limits
4. Monitor query performance

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
# Set debug environment
wrangler secret put DEBUG_MODE "true"

# View detailed logs
wrangler tail --env production --format pretty
```

### Performance Optimization

#### Email Service Optimization
```bash
# Increase batch size for bulk emails
EMAIL_BATCH_SIZE=20

# Optimize retry settings
EMAIL_MAX_RETRIES=2
EMAIL_RETRY_DELAY=500

# Enable email template caching
ENABLE_EMAIL_TEMPLATE_CACHE=true
```

#### Messaging Optimization
```bash
# Increase WebSocket connection limits
WS_MAX_CONNECTIONS=1000

# Optimize message batching
MESSAGE_BATCH_SIZE=10
MESSAGE_BATCH_TIMEOUT=100

# Enable message caching
ENABLE_MESSAGE_CACHE=true
```

## Security Considerations

### Data Protection

#### Email Security
- All email content is encrypted in transit (TLS)
- API keys stored as Cloudflare secrets
- Email logs are retained for 30 days maximum
- PII is automatically redacted in logs

#### Message Security
- Optional end-to-end encryption for messages
- File attachments scanned for malware
- Message content filtered for spam/abuse
- User blocking and moderation tools

#### Authentication
- All API endpoints require authentication
- Rate limiting on all public endpoints
- CORS properly configured
- Input validation and sanitization

### Compliance

#### GDPR Compliance
- User data retention policies
- Right to data export
- Right to data deletion
- Consent management

#### Privacy Protection
- Email addresses encrypted at rest
- Message metadata anonymization
- User preference encryption
- Audit logging for compliance

### Security Monitoring

#### Threat Detection
```bash
# Monitor for unusual patterns
curl https://your-api.com/api/security/anomalies

# Review security events
curl https://your-api.com/api/security/events
```

#### Access Control
- API key rotation policies
- Service account management
- IP allowlisting for admin endpoints
- Multi-factor authentication for admin access

### Incident Response

#### Security Incident Playbook
1. **Detection**: Automated alerts for security events
2. **Assessment**: Rapid triage and impact assessment
3. **Containment**: Immediate threat mitigation
4. **Recovery**: Service restoration procedures
5. **Lessons Learned**: Post-incident analysis

#### Emergency Contacts
- Security Team: security@pitchey.com
- DevOps Team: devops@pitchey.com
- Management: management@pitchey.com

---

## Support and Maintenance

### Regular Maintenance Tasks

#### Daily
- Monitor system health dashboards
- Review error logs and alerts
- Check queue depths and processing times

#### Weekly  
- Review delivery metrics and performance
- Update security patches
- Rotate API keys as needed

#### Monthly
- Analyze usage patterns and scaling needs
- Review and update monitoring thresholds
- Conduct security reviews

### Contact Information

For technical support or questions about this integration:

- **Development Team**: dev@pitchey.com
- **DevOps Team**: devops@pitchey.com
- **Documentation**: https://docs.pitchey.com

### Version History

- **v1.0.0** (2024-01-15): Initial email and messaging system integration
- **v1.1.0** (TBD): Enhanced encryption and security features
- **v1.2.0** (TBD): Advanced analytics and monitoring

---

*This guide is maintained by the Pitchey development team. For the latest updates, visit our internal documentation portal.*