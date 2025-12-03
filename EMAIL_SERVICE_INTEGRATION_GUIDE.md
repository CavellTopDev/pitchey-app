# Email Service Integration Guide

## Overview
This guide covers setting up transactional email services for Pitchey using either SendGrid, Resend, or Cloudflare Email Workers.

## Option 1: SendGrid Integration (Recommended)

### 1.1 SendGrid Account Setup
```bash
1. Sign up at https://sendgrid.com
2. Verify your email domain
3. Create API Key:
   - Settings > API Keys > Create API Key
   - Full Access or Restricted (Mail Send only)
   - Save the key securely
```

### 1.2 Domain Authentication
```bash
# Add DNS records in Cloudflare
1. SendGrid > Settings > Sender Authentication
2. Authenticate Your Domain
3. Add these records to Cloudflare DNS:

CNAME: em1234.pitchey.com → sendgrid.net
CNAME: s1._domainkey.pitchey.com → s1.domainkey.u1234.wl.sendgrid.net
CNAME: s2._domainkey.pitchey.com → s2.domainkey.u1234.wl.sendgrid.net
```

### 1.3 Worker Integration
```typescript
// src/services/email-service.ts
export class EmailService {
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;

  constructor(env: Env) {
    this.apiKey = env.SENDGRID_API_KEY;
    this.fromEmail = env.FROM_EMAIL || 'noreply@pitchey.com';
    this.fromName = env.FROM_NAME || 'Pitchey Platform';
  }

  async sendEmail(to: string, subject: string, html: string, text?: string) {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }]
        }],
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        content: [
          { type: 'text/plain', value: text || this.htmlToText(html) },
          { type: 'text/html', value: html }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Email send failed: ${response.statusText}`);
    }

    return { success: true, messageId: response.headers.get('x-message-id') };
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}
```

## Option 2: Resend Integration (Modern Alternative)

### 2.1 Resend Setup
```bash
1. Sign up at https://resend.com
2. Add and verify domain
3. Get API key from dashboard
```

### 2.2 Worker Integration
```typescript
// src/services/resend-email-service.ts
export class ResendEmailService {
  private apiKey: string;

  constructor(env: Env) {
    this.apiKey = env.RESEND_API_KEY;
  }

  async sendEmail(to: string, subject: string, html: string) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Pitchey <noreply@pitchey.com>',
        to: [to],
        subject,
        html
      })
    });

    const data = await response.json();
    return { success: response.ok, id: data.id };
  }
}
```

## Option 3: Cloudflare Email Workers

### 3.1 Email Routing Setup
```bash
1. Cloudflare Dashboard > Email > Email Routing
2. Add domain: pitchey.com
3. Create routing rules:
   - support@pitchey.com → forward to your email
   - noreply@pitchey.com → worker processing
```

### 3.2 Email Worker
```typescript
// src/email-worker.ts
export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    // Process incoming emails
    const from = message.from;
    const subject = message.headers.get('subject');
    
    // Auto-reply for support emails
    if (message.to.includes('support@pitchey.com')) {
      await this.sendAutoReply(from, env);
    }
    
    // Forward to admin
    await message.forward('admin@yourcompany.com');
  },

  async sendAutoReply(to: string, env: Env) {
    // Use SendGrid/Resend API to send auto-reply
    const emailService = new EmailService(env);
    await emailService.sendEmail(
      to,
      'Thank you for contacting Pitchey Support',
      `<p>We've received your message and will respond within 24 hours.</p>`
    );
  }
};
```

## Email Templates

### 4.1 Welcome Email Template
```typescript
// src/templates/welcome-email.ts
export function getWelcomeEmail(user: any) {
  return {
    subject: 'Welcome to Pitchey!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f7f7f7; }
          .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Pitchey!</h1>
          </div>
          <div class="content">
            <p>Hi ${user.first_name},</p>
            <p>Thank you for joining Pitchey! Your ${user.user_type} account has been created successfully.</p>
            <p>Get started by:</p>
            <ul>
              <li>Completing your profile</li>
              <li>Exploring trending pitches</li>
              <li>${user.user_type === 'creator' ? 'Creating your first pitch' : 'Browsing investment opportunities'}</li>
            </ul>
            <p style="text-align: center;">
              <a href="https://pitchey.com/dashboard" class="button">Go to Dashboard</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 Pitchey. All rights reserved.</p>
            <p><a href="https://pitchey.com/unsubscribe">Unsubscribe</a></p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}
```

### 4.2 NDA Request Template
```typescript
// src/templates/nda-request-email.ts
export function getNDARequestEmail(creator: any, investor: any, pitch: any) {
  return {
    subject: `NDA Request for "${pitch.title}"`,
    html: `
      <div class="container">
        <h2>New NDA Request</h2>
        <p>Hi ${creator.first_name},</p>
        <p><strong>${investor.first_name} ${investor.last_name}</strong> from ${investor.company_name} has requested access to the full details of your pitch "${pitch.title}".</p>
        <p>Please review and respond to this NDA request in your dashboard.</p>
        <a href="https://pitchey.com/dashboard/nda-requests" class="button">Review NDA Request</a>
      </div>
    `
  };
}
```

### 4.3 Password Reset Template
```typescript
// src/templates/password-reset-email.ts
export function getPasswordResetEmail(user: any, resetToken: string) {
  const resetUrl = `https://pitchey.com/reset-password?token=${resetToken}`;
  
  return {
    subject: 'Reset Your Pitchey Password',
    html: `
      <div class="container">
        <h2>Password Reset Request</h2>
        <p>Hi ${user.first_name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <a href="${resetUrl}" class="button">Reset Password</a>
        <p>This link will expire in 1 hour for security reasons.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `
  };
}
```

## Email Service Implementation

### 5.1 Unified Email Handler
```typescript
// src/handlers/email-handler.ts
export class EmailHandler {
  private emailService: EmailService;

  constructor(env: Env) {
    this.emailService = new EmailService(env);
  }

  async sendWelcomeEmail(user: any) {
    const template = getWelcomeEmail(user);
    return await this.emailService.sendEmail(
      user.email,
      template.subject,
      template.html
    );
  }

  async sendNDARequest(creator: any, investor: any, pitch: any) {
    const template = getNDARequestEmail(creator, investor, pitch);
    return await this.emailService.sendEmail(
      creator.email,
      template.subject,
      template.html
    );
  }

  async sendPasswordReset(user: any, token: string) {
    const template = getPasswordResetEmail(user, token);
    return await this.emailService.sendEmail(
      user.email,
      template.subject,
      template.html
    );
  }

  async sendBulkEmail(recipients: string[], subject: string, html: string) {
    const results = await Promise.allSettled(
      recipients.map(email => 
        this.emailService.sendEmail(email, subject, html)
      )
    );

    return {
      sent: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length
    };
  }
}
```

### 5.2 Email Queue with KV
```typescript
// src/services/email-queue.ts
export class EmailQueue {
  private kv: KVNamespace;

  constructor(env: Env) {
    this.kv = env.KV;
  }

  async queueEmail(email: EmailJob) {
    const id = crypto.randomUUID();
    const key = `email:queue:${id}`;
    
    await this.kv.put(key, JSON.stringify({
      ...email,
      id,
      status: 'pending',
      createdAt: new Date().toISOString()
    }), {
      expirationTtl: 86400 // 24 hours
    });

    return id;
  }

  async processQueue(emailService: EmailService) {
    const list = await this.kv.list({ prefix: 'email:queue:' });
    
    for (const key of list.keys) {
      const job = await this.kv.get(key.name, 'json') as EmailJob;
      
      if (job.status === 'pending') {
        try {
          await emailService.sendEmail(job.to, job.subject, job.html);
          
          // Mark as sent
          job.status = 'sent';
          job.sentAt = new Date().toISOString();
          await this.kv.put(key.name, JSON.stringify(job));
        } catch (error) {
          // Mark as failed
          job.status = 'failed';
          job.error = error.message;
          job.retries = (job.retries || 0) + 1;
          
          if (job.retries < 3) {
            job.status = 'pending'; // Retry later
          }
          
          await this.kv.put(key.name, JSON.stringify(job));
        }
      }
    }
  }
}

interface EmailJob {
  id?: string;
  to: string;
  subject: string;
  html: string;
  status?: 'pending' | 'sent' | 'failed';
  createdAt?: string;
  sentAt?: string;
  retries?: number;
  error?: string;
}
```

## Configuration

### 6.1 Environment Variables
```bash
# Set email service secrets
wrangler secret put SENDGRID_API_KEY
# Enter: SG.xxxxxxxxxxxxxxxxxxxx

wrangler secret put FROM_EMAIL
# Enter: noreply@pitchey.com

wrangler secret put FROM_NAME
# Enter: Pitchey Platform

# Or for Resend
wrangler secret put RESEND_API_KEY
# Enter: re_xxxxxxxxxxxxxxxxxxxx
```

### 6.2 Wrangler Configuration
```toml
# wrangler-custom-domain.toml
[vars]
EMAIL_PROVIDER = "sendgrid"  # or "resend"
FROM_EMAIL = "noreply@pitchey.com"
FROM_NAME = "Pitchey Platform"
SUPPORT_EMAIL = "support@pitchey.com"

# Email worker route (if using Cloudflare Email)
[[email]]
routing = [
  { name = "support", destination = "support@yourcompany.com" },
  { name = "noreply", destination = "worker" }
]
```

## Testing

### 7.1 Test Email Sending
```typescript
// test-email.ts
async function testEmailService() {
  const env = {
    SENDGRID_API_KEY: 'your-api-key',
    FROM_EMAIL: 'noreply@pitchey.com',
    FROM_NAME: 'Pitchey Test'
  };

  const emailService = new EmailService(env);
  
  try {
    const result = await emailService.sendEmail(
      'test@example.com',
      'Test Email from Pitchey',
      '<h1>Test Email</h1><p>This is a test email from Pitchey.</p>'
    );
    
    console.log('Email sent:', result);
  } catch (error) {
    console.error('Email failed:', error);
  }
}
```

### 7.2 Email Delivery Testing
```bash
# Test with curl
curl -X POST https://api.pitchey.com/api/test-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-admin-token" \
  -d '{"to": "test@example.com"}'
```

## Monitoring

### 8.1 Email Analytics
```typescript
// Track email metrics in KV
export class EmailAnalytics {
  async trackEmail(type: string, status: 'sent' | 'failed') {
    const key = `email:analytics:${new Date().toISOString().slice(0, 10)}`;
    const stats = await this.kv.get(key, 'json') || {};
    
    if (!stats[type]) {
      stats[type] = { sent: 0, failed: 0 };
    }
    
    stats[type][status]++;
    
    await this.kv.put(key, JSON.stringify(stats), {
      expirationTtl: 30 * 24 * 60 * 60 // 30 days
    });
  }
}
```

### 8.2 SendGrid Webhooks
```typescript
// Handle SendGrid event webhooks
export async function handleSendGridWebhook(request: Request) {
  const events = await request.json();
  
  for (const event of events) {
    switch (event.event) {
      case 'delivered':
        await trackDelivery(event);
        break;
      case 'bounce':
        await handleBounce(event);
        break;
      case 'spam_report':
        await handleSpamReport(event);
        break;
    }
  }
}
```

## Email Types Checklist

- [ ] Welcome emails for new users
- [ ] Email verification
- [ ] Password reset
- [ ] NDA requests and approvals
- [ ] Investment notifications
- [ ] Message notifications
- [ ] Weekly digests
- [ ] Pitch status updates
- [ ] Payment confirmations
- [ ] Account alerts
- [ ] Marketing campaigns (with unsubscribe)

## Compliance

### GDPR/CAN-SPAM Requirements
1. Include unsubscribe link in all emails
2. Store email preferences
3. Honor unsubscribe requests immediately
4. Include physical address
5. Clear "From" identification

### Unsubscribe Handler
```typescript
export class UnsubscribeHandler {
  async unsubscribe(email: string, type?: string) {
    const key = `unsubscribe:${email}`;
    const prefs = await this.kv.get(key, 'json') || {};
    
    if (type) {
      prefs[type] = false;  // Unsubscribe from specific type
    } else {
      prefs.all = true;  // Unsubscribe from all
    }
    
    await this.kv.put(key, JSON.stringify(prefs));
    return { success: true };
  }
  
  async isUnsubscribed(email: string, type: string): Promise<boolean> {
    const prefs = await this.kv.get(`unsubscribe:${email}`, 'json');
    return prefs?.all || prefs?.[type] === false;
  }
}
```

## Troubleshooting

### Common Issues

1. **Domain Not Verified**
   - Check DNS records
   - Wait for propagation (up to 48 hours)
   - Verify in provider dashboard

2. **Emails Going to Spam**
   - Set up SPF, DKIM, DMARC records
   - Avoid spam trigger words
   - Include unsubscribe link
   - Use verified domain

3. **Rate Limiting**
   - SendGrid: 100 emails/second (free tier)
   - Implement queue system
   - Use batch sending for bulk emails

## Next Steps

After email service is configured:
1. Test all email templates
2. Set up email analytics dashboard
3. Configure bounce handling
4. Implement email preferences UI
5. Set up transactional email tracking