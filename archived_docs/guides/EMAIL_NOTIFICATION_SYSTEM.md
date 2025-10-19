# Email Notification System Documentation

This document describes the comprehensive email notification system implemented for the Pitchey platform.

## Overview

The email notification system provides:
- Multi-provider email service support (SendGrid, AWS SES, SMTP)
- Responsive HTML email templates
- Email queue system for reliable delivery
- User notification preferences management
- Unsubscribe handling and suppression lists
- Bounce and delivery tracking
- Weekly digest emails
- Email testing and preview capabilities

## Architecture

### Core Services

1. **EmailService** (`src/services/email.service.ts`)
   - Provider abstraction layer
   - Support for SendGrid, AWS SES, and SMTP
   - Configuration management
   - Email delivery handling

2. **EmailTemplateService** (`src/services/email-templates.service.ts`)
   - Responsive HTML email templates
   - Plain text fallbacks
   - Template data validation
   - Base template with consistent styling

3. **EmailQueueService** (`src/services/email-queue.service.ts`)
   - Queued email processing
   - Retry logic for failed emails
   - Priority-based sending
   - Scheduled email delivery
   - Suppression list management

4. **NotificationEmailService** (`src/services/notification-email.service.ts`)
   - High-level notification methods
   - User preference checking
   - Database integration
   - Template data preparation

5. **EmailCronService** (`src/services/email-cron.service.ts`)
   - Periodic email queue processing
   - Weekly digest generation
   - Failed email retry
   - Email cleanup

### Database Schema

The system uses several database tables:

- `email_preferences` - User email notification settings
- `email_queue` - Queued emails for processing
- `email_events` - Email delivery tracking events
- `unsubscribe_tokens` - Unsubscribe link management
- `email_suppression` - Bounced/complained email addresses
- `digest_history` - Weekly digest delivery tracking

## Email Types

### 1. Welcome Emails
- Sent when new users register
- Customized by user type (creator, investor, production, viewer)
- Includes onboarding links and next steps

### 2. NDA Notifications
- **NDA Requests**: Sent to pitch owners when someone requests NDA access
- **NDA Approvals**: Sent to requesters when access is granted
- **NDA Rejections**: Sent to requesters when access is denied

### 3. Message Notifications
- Sent when users receive new messages
- Supports instant, daily, weekly, or never frequency
- Includes message preview and conversation link

### 4. Password Reset
- Security emails for password reset requests
- Secure token-based links with expiration
- High priority delivery

### 5. Payment Confirmations
- Sent after successful payments
- Includes payment details and receipts
- Supports subscriptions, credits, and success fees

### 6. Pitch View Notifications
- Notifies creators when their pitches are viewed
- Includes viewer information and viewing time
- Can be disabled by user preference

### 7. Weekly Digest
- Summary of platform activity
- Personalized statistics and recommendations
- Scheduled delivery based on user preferences

## Email Templates

All templates feature:
- Responsive design for mobile and desktop
- Consistent branding and styling
- Unsubscribe links in footer
- Plain text alternatives
- Accessibility considerations

### Template Structure
```
Header (Logo and branding)
├── Content Area
│   ├── Greeting
│   ├── Main Message
│   ├── Call-to-Action Buttons
│   └── Additional Information
└── Footer
    ├── Company Information
    ├── Links (Help, Privacy, Terms)
    └── Unsubscribe Options
```

## Configuration

### Environment Variables

Copy `.env.email.example` to `.env.local` and configure:

```bash
# Provider Selection
EMAIL_PROVIDER=sendgrid  # or 'ses', 'smtp'

# Email Settings
EMAIL_FROM=noreply@pitchey.com
EMAIL_FROM_NAME=Pitchey
BASE_URL=https://pitchey.com

# Provider-specific settings
SENDGRID_API_KEY=your_api_key
# or AWS SES
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
# or SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password
```

### Database Migration

Run the email notification migration:
```bash
# Apply the migration
deno run --allow-all drizzle/0003_email_notifications.sql
```

## API Endpoints

### Email Preferences
- `GET /api/email/preferences` - Get user's email preferences
- `PUT /api/email/preferences` - Update email preferences

### Unsubscribe Management
- `GET /api/email/unsubscribe?token=<token>` - Unsubscribe via token
- `POST /api/email/unsubscribe` - Add email to suppression list

### Testing and Preview
- `POST /api/email/preview` - Preview email templates (admin only)
- `GET /api/email/preview?template=<type>` - HTML preview
- `POST /api/email/test` - Send test emails (admin only)
- `GET /api/email/test` - Get queue statistics (admin only)

### Webhooks
- `POST /api/email/webhook?provider=<provider>` - Handle provider webhooks

## Usage Examples

### Sending Notifications

```typescript
import { getNotificationEmailService } from "./src/services/notification-email.service.ts";

const emailService = getNotificationEmailService();

// Send welcome email
await emailService.sendWelcomeEmail({
  userId: 123,
  userType: "creator"
});

// Send NDA request
await emailService.sendNDARequestEmail({
  requesterId: 456,
  ownerId: 123,
  pitchId: 789,
  requestMessage: "I'm interested in this project"
});

// Send message notification
await emailService.sendMessageEmail({
  senderId: 456,
  receiverId: 123,
  messageContent: "Hello, I'd like to discuss your pitch",
  pitchId: 789
});
```

### Managing Email Queue

```typescript
import { getEmailQueueService } from "./src/services/email-queue.service.ts";

const queueService = getEmailQueueService();

// Process pending emails
await queueService.processPendingEmails(25);

// Get queue statistics
const stats = await queueService.getQueueStats();
console.log(stats); // { pending: 5, sent: 100, failed: 2, total: 107 }

// Retry failed emails
const retryDate = new Date();
retryDate.setHours(retryDate.getHours() - 1);
await queueService.retryFailedEmails(retryDate);
```

### User Preferences

```typescript
import { getNotificationEmailService } from "./src/services/notification-email.service.ts";

const emailService = getNotificationEmailService();

// Get user preferences
const prefs = await emailService.getEmailPreferences(userId);

// Update preferences
await emailService.updateEmailPreferences(userId, {
  messageNotifications: "daily",
  weeklyDigest: false
});

// Unsubscribe from specific type
await emailService.unsubscribeUser(userId, "pitch_view");
```

## Monitoring and Maintenance

### Email Queue Monitoring

The system provides real-time monitoring of:
- Queue length and processing rate
- Failed email count and reasons
- Delivery success rates
- Suppression list size

### Automated Maintenance

The cron service automatically:
- Processes pending emails every minute
- Sends weekly digests on Sundays at 9 AM
- Retries failed emails every 6 hours
- Cleans up old emails daily at 2 AM

### Manual Maintenance Commands

```typescript
// Clean emails older than 30 days
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 30);
await queueService.cleanOldEmails(cutoff);

// Force retry failed emails
const retryAfter = new Date();
retryAfter.setHours(retryAfter.getHours() - 1);
await queueService.retryFailedEmails(retryAfter);
```

## Error Handling

The system implements comprehensive error handling:

1. **Provider Failures**: Automatic retry with exponential backoff
2. **Invalid Recipients**: Added to suppression list
3. **Template Errors**: Logged with detailed error messages
4. **Queue Overload**: Priority-based processing
5. **Database Errors**: Graceful degradation

## Security Considerations

1. **Unsubscribe Tokens**: Cryptographically secure, time-limited
2. **Webhook Verification**: Optional signature verification
3. **Rate Limiting**: Configurable sending limits
4. **Data Protection**: Minimal email content logging
5. **Suppression Lists**: Automatic bounce handling

## Testing

### Email Preview
Access email previews at:
- `/api/email/preview?template=welcome`
- `/api/email/preview?template=nda_request`
- etc.

### Test Email Sending
Send test emails via API:
```bash
curl -X POST /api/email/test \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "welcome",
    "toEmail": "test@example.com",
    "data": { "userType": "creator" }
  }'
```

### Development Mode

Set `EMAIL_PREVIEW_MODE=true` to prevent actual email sending during development.

## Performance Optimization

1. **Batch Processing**: Process multiple emails per cron run
2. **Priority Queuing**: High-priority emails sent first
3. **Database Indexing**: Optimized queries for queue processing
4. **Template Caching**: Reduced template compilation overhead
5. **Connection Pooling**: Efficient database connections

## Troubleshooting

### Common Issues

1. **Emails Not Sending**
   - Check provider configuration
   - Verify email queue processing
   - Check suppression list

2. **High Bounce Rate**
   - Review email content for spam triggers
   - Verify sender reputation
   - Check email authentication (SPF, DKIM, DMARC)

3. **Template Rendering Errors**
   - Validate template data structure
   - Check for missing required fields
   - Review error logs

### Debugging

Enable debug logging:
```bash
EMAIL_DEBUG=true
```

Check queue status:
```bash
curl /api/email/test -H "Authorization: Bearer <admin_token>"
```

## Future Enhancements

1. **A/B Testing**: Template variant testing
2. **Advanced Analytics**: Open rates, click tracking
3. **Smart Scheduling**: Optimal send time prediction
4. **Content Personalization**: Dynamic content based on user behavior
5. **Multi-language Support**: Localized email templates
6. **Advanced Segmentation**: Targeted email campaigns

## Support

For issues or questions about the email notification system:
1. Check the error logs for specific error messages
2. Verify configuration settings
3. Test with the preview and test endpoints
4. Review the queue statistics for processing issues

This email notification system provides a robust, scalable foundation for all Pitchey platform communications.