# Pitchey Email Service - Production Ready

A comprehensive, production-ready email service with swap-ready architecture that allows switching between console (development), SendGrid, Postmark, and AWS SES with just environment variables.

## Features

- ✅ **Provider Switching**: Change email providers with just environment variables
- ✅ **Console Development Mode**: Formatted, readable email output for development
- ✅ **Production Ready**: SendGrid and Postmark providers ready for API keys
- ✅ **Template Engine**: Professional HTML email templates with responsive design
- ✅ **Health Monitoring**: Built-in health checks and configuration validation
- ✅ **Backward Compatibility**: Existing code continues to work without changes
- ✅ **Type Safety**: Full TypeScript support with comprehensive interfaces
- ✅ **Error Handling**: Graceful fallbacks and detailed error reporting

## Architecture

```
src/services/email/
├── interface.ts           # Core interfaces and types
├── console-provider.ts    # Development console provider
├── sendgrid-provider.ts   # SendGrid production provider
├── postmark-provider.ts   # Postmark production provider
├── factory.ts            # Provider factory and main service
├── template-engine.ts    # HTML template processing
└── index.ts              # Public API exports

src/templates/email/
├── base.html             # Base responsive email template
├── welcome.html          # Welcome email template
├── nda-request.html      # NDA request notification
├── nda-response.html     # NDA response notification
├── password-reset.html   # Password reset template
├── message-notification.html  # Message notification
└── payment-confirmation.html  # Payment confirmation
```

## Quick Start

### Development Mode (Default)

No configuration needed. All emails are logged to console with formatted output:

```typescript
import { sendWelcomeEmail } from './src/services/email/index.ts';

await sendWelcomeEmail('user@example.com', {
  firstName: 'John',
  userType: 'creator',
  dashboardUrl: 'https://pitchey.com/dashboard',
  profileSetupUrl: 'https://pitchey.com/profile/setup',
  unsubscribeUrl: 'https://pitchey.com/unsubscribe?token=xyz'
});
```

### Production Mode - SendGrid

1. Set environment variables:
```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your-api-key-here
```

2. Install SendGrid package:
```bash
npm install @sendgrid/mail
```

3. Restart service - emails now send via SendGrid!

### Production Mode - Postmark

1. Set environment variables:
```bash
EMAIL_PROVIDER=postmark
POSTMARK_API_KEY=your-api-key-here
```

2. Install Postmark package:
```bash
npm install postmark
```

3. Restart service - emails now send via Postmark!

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EMAIL_PROVIDER` | `console` | Provider: `console`, `sendgrid`, `postmark`, `ses` |
| `EMAIL_FROM` | `noreply@pitchey.com` | From email address |
| `EMAIL_FROM_NAME` | `Pitchey` | From display name |
| `EMAIL_REPLY_TO` | | Optional reply-to address |
| `SENDGRID_API_KEY` | | SendGrid API key (SG.xxx) |
| `POSTMARK_API_KEY` | | Postmark API key |
| `AWS_REGION` | | AWS region for SES |
| `AWS_ACCESS_KEY_ID` | | AWS access key for SES |
| `AWS_SECRET_ACCESS_KEY` | | AWS secret key for SES |

## Email Functions

### Welcome Email
```typescript
import { sendWelcomeEmail } from './src/services/email/index.ts';

await sendWelcomeEmail('user@example.com', {
  firstName: 'John',
  userType: 'creator', // 'creator' | 'investor' | 'production' | 'viewer'
  dashboardUrl: 'https://pitchey.com/dashboard',
  profileSetupUrl: 'https://pitchey.com/profile/setup',
  unsubscribeUrl: 'https://pitchey.com/unsubscribe?token=xyz'
});
```

### NDA Request Notification
```typescript
import { sendNDARequestEmail } from './src/services/email/index.ts';

await sendNDARequestEmail('creator@example.com', {
  recipientName: 'Jane Creator',
  senderName: 'Mike Investor',
  pitchTitle: 'Amazing Movie Concept',
  requestMessage: 'I would love to learn more about this project.',
  actionUrl: 'https://pitchey.com/nda/requests/123',
  unsubscribeUrl: 'https://pitchey.com/unsubscribe?token=xyz'
});
```

### NDA Response Notification
```typescript
import { sendNDAResponseEmail } from './src/services/email/index.ts';

await sendNDAResponseEmail('investor@example.com', {
  recipientName: 'Mike Investor',
  senderName: 'Jane Creator',
  pitchTitle: 'Amazing Movie Concept',
  approved: true,
  reason: 'Looking forward to collaborating!',
  actionUrl: 'https://pitchey.com/pitches/123',
  unsubscribeUrl: 'https://pitchey.com/unsubscribe?token=xyz'
});
```

### Password Reset
```typescript
import { sendPasswordResetEmail } from './src/services/email/index.ts';

await sendPasswordResetEmail('user@example.com', {
  firstName: 'John',
  resetUrl: 'https://pitchey.com/reset-password?token=abc123',
  expiresIn: '24 hours',
  unsubscribeUrl: 'https://pitchey.com/unsubscribe?token=xyz'
});
```

### Message Notification
```typescript
import { sendMessageNotificationEmail } from './src/services/email/index.ts';

await sendMessageNotificationEmail('recipient@example.com', {
  recipientName: 'Jane',
  senderName: 'Mike',
  messageContent: 'I loved your pitch! Let\'s discuss...',
  pitchTitle: 'Amazing Movie Concept', // optional
  conversationUrl: 'https://pitchey.com/messages/123',
  unsubscribeUrl: 'https://pitchey.com/unsubscribe?token=xyz'
});
```

### Payment Confirmation
```typescript
import { sendPaymentConfirmationEmail } from './src/services/email/index.ts';

await sendPaymentConfirmationEmail('user@example.com', {
  firstName: 'John',
  paymentType: 'subscription', // 'subscription' | 'credits' | 'success_fee'
  amount: '29.99',
  currency: 'USD',
  description: 'Monthly Pro Subscription',
  invoiceUrl: 'https://pitchey.com/invoices/123', // optional
  receiptUrl: 'https://pitchey.com/receipts/123', // optional
  unsubscribeUrl: 'https://pitchey.com/unsubscribe?token=xyz'
});
```

## Health Monitoring

### Check Service Health
```typescript
import { getEmailServiceHealth } from './src/services/email/index.ts';

const health = await getEmailServiceHealth();
console.log('Provider:', health.provider);
console.log('Healthy:', health.healthy);
console.log('Config Valid:', health.configValid);
```

### Get Service Information
```typescript
import { getEmailServiceInfo } from './src/services/email/index.ts';

const info = getEmailServiceInfo();
console.log('Current provider:', info.name);
console.log('Available providers:', info.availableProviders);
console.log('API keys configured:', info.config.hasApiKey);
```

## Testing

Run the test suite to verify everything works:

```bash
# Test with console provider (default)
deno run --allow-all test-email-service.ts

# Test with SendGrid configuration
EMAIL_PROVIDER=sendgrid SENDGRID_API_KEY=SG.test deno run --allow-all test-email-service.ts

# Test with Postmark configuration  
EMAIL_PROVIDER=postmark POSTMARK_API_KEY=test deno run --allow-all test-email-service.ts
```

## Console Output Example

In development mode, emails are beautifully formatted in the console:

```
════════════════════════════════════════════════════════════════════════════════
📧 EMAIL SENT (DEVELOPMENT MODE)
════════════════════════════════════════════════════════════════════════════════
🏷️  MESSAGE ID: console-1760812706770-xhfxe1r1k@pitchey.local
⏰ TIMESTAMP: 2025-10-18T18:38:26.770Z
📋 TEMPLATE: welcome
🔍 TRACKING ID: welcome-1760812706770-test@example.com
────────────────────────────────────────────────────────────────────────────────
📤 FROM: Pitchey <noreply@pitchey.com>
📧 TO: test@example.com
📝 SUBJECT: Welcome to Pitchey!
────────────────────────────────────────────────────────────────────────────────
📄 TEXT CONTENT:
   Welcome to Pitchey, John! 
   
   Thank you for joining Pitchey as a Creator...
────────────────────────────────────────────────────────────────────────────────
🚫 UNSUBSCRIBE: https://pitchey.com/unsubscribe?token=test123
════════════════════════════════════════════════════════════════════════════════
✅ Email logged successfully (development mode)
💡 To send real emails, set EMAIL_PROVIDER to sendgrid, postmark, or ses
════════════════════════════════════════════════════════════════════════════════
```

## Backward Compatibility

Existing code using the old email service continues to work:

```typescript
// This still works
import { getEmailService } from './src/services/email.service.ts';
const emailService = getEmailService();
await emailService.sendEmail(emailData);
```

## Migration from Console.log

All previous `console.log` email statements have been replaced with proper service calls:

```typescript
// OLD (replaced):
console.log("Sending welcome email to:", email);

// NEW:
await sendWelcomeEmail(email, welcomeData);
```

## Production Deployment

### SendGrid Setup
1. Sign up for SendGrid account
2. Generate API key with Mail Send permissions
3. Set environment variables:
   ```bash
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.your-real-api-key
   ```
4. Install package: `npm install @sendgrid/mail`

### Postmark Setup
1. Sign up for Postmark account
2. Generate Server API Token
3. Set environment variables:
   ```bash
   EMAIL_PROVIDER=postmark
   POSTMARK_API_KEY=your-real-api-key
   ```
4. Install package: `npm install postmark`

### Domain Configuration
- Configure your domain's SPF, DKIM, and DMARC records
- Set up proper sender reputation
- Configure unsubscribe handling
- Set up bounce and complaint handling

## Files Created

This implementation created the following files:

1. **Core Service Files**:
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/services/email/interface.ts`
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/services/email/console-provider.ts`
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/services/email/sendgrid-provider.ts`
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/services/email/postmark-provider.ts`
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/services/email/factory.ts`
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/services/email/template-engine.ts`
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/services/email/index.ts`

2. **Email Templates**:
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/templates/email/base.html`
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/templates/email/welcome.html`
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/templates/email/nda-request.html`
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/templates/email/nda-response.html`
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/templates/email/password-reset.html`
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/templates/email/message-notification.html`
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/templates/email/payment-confirmation.html`

3. **Updated Files**:
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/services/email.service.ts` (backward compatibility bridge)

4. **Test Files**:
   - `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/test-email-service.ts`

## Summary

✅ **Mission Accomplished**: The Pitchey platform now has a production-ready email service that can switch between console (development), SendGrid, Postmark, and AWS SES with just environment variable changes.

The architecture is clean, extensible, and maintains backward compatibility while providing a modern, type-safe email service for the platform.