# Stripe Payment Integration for Pitchey Platform

## Overview

Complete Stripe payment processing integration for the Pitchey platform, supporting subscriptions, one-time payments, investment transactions, and comprehensive billing management.

## Features Implemented

### 🔐 Subscription Management
- **4 Subscription Tiers**: Creator Basic ($29/mo), Creator Pro ($99/mo), Investor ($199/mo), Production Company ($499/mo)
- **Automatic billing cycle management**
- **Prorated upgrades/downgrades**
- **Cancellation handling**
- **Subscription history tracking**

### 💳 Payment Processing
- **PCI-compliant payment processing**
- **SCA/3D Secure support**
- **Multiple payment methods** (cards, bank accounts)
- **Saved payment methods**
- **Invoice generation and management**

### 🎯 Investment Transactions
- **2.5% success fee on investments**
- **Automatic payment splitting**
- **Creator payout processing**
- **Transaction tracking and reporting**

### 📊 Billing & Reporting
- **Detailed invoice history**
- **Payment method management**
- **Subscription analytics**
- **Tax calculation support**

## API Endpoints

### Authentication Required Endpoints

#### Subscription Management
```http
GET    /api/payments/subscription-tiers       # Get available tiers
POST   /api/payments/create-customer          # Create Stripe customer
POST   /api/payments/create-subscription      # Subscribe to plan
POST   /api/payments/cancel-subscription      # Cancel subscription
GET    /api/payments/subscription-status      # Get current subscription
GET    /api/payments/subscription-history     # Get subscription history
```

#### Payment Processing
```http
POST   /api/payments/create-checkout          # One-time payment checkout
GET    /api/payments/invoices                 # Get user invoices
GET    /api/payments/payment-methods          # Get saved payment methods
POST   /api/payments/process-investment       # Process investment transaction
```

#### Webhooks (No Auth Required)
```http
POST   /api/payments/webhook                  # Handle Stripe webhooks
```

## Subscription Tiers

### Creator Basic - $29/month
- Upload up to 3 pitches
- Basic analytics
- Standard support
- Basic NDA templates

### Creator Pro - $99/month
- Unlimited pitches
- Advanced analytics
- Priority support
- Custom NDA templates
- Video pitch hosting
- Collaboration tools

### Investor Access - $199/month
- Full pitch database access
- Advanced search & filters
- Investment tracking
- Portfolio analytics
- Direct messaging
- Deal flow management

### Production Company - $499/month
- Enterprise dashboard
- Team collaboration
- Advanced screening tools
- Custom workflows
- White-label options
- Dedicated support

## Environment Configuration

### Required Environment Variables
```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Subscription Price IDs
STRIPE_PRICE_CREATOR_BASIC=price_...
STRIPE_PRICE_CREATOR_PRO=price_...
STRIPE_PRICE_INVESTOR=price_...
STRIPE_PRICE_PRODUCTION=price_...

# Application URLs
APP_URL=https://pitchey-5o8.pages.dev
API_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev
```

### Setup Instructions

1. **Create Stripe Account**
   ```bash
   # Visit https://dashboard.stripe.com
   # Complete business verification
   # Enable payment methods (cards, bank transfers)
   ```

2. **Create Product Catalog**
   ```bash
   # In Stripe Dashboard > Products
   # Create 4 products for subscription tiers
   # Set up monthly/yearly pricing
   # Copy Price IDs to environment variables
   ```

3. **Configure Webhooks**
   ```bash
   # In Stripe Dashboard > Webhooks
   # Add endpoint: https://your-api-domain.com/api/payments/webhook
   # Select events:
   #   - customer.subscription.created
   #   - customer.subscription.updated
   #   - customer.subscription.deleted
   #   - invoice.payment_succeeded
   #   - invoice.payment_failed
   #   - payment_intent.succeeded
   #   - payment_method.attached
   ```

4. **Environment Setup**
   ```bash
   # Copy environment template
   cp .env.stripe.example .env.local
   
   # Add your Stripe keys
   vim .env.local
   ```

## Usage Examples

### Frontend Integration

#### 1. Get Subscription Tiers
```typescript
const response = await fetch('/api/payments/subscription-tiers?userType=creator');
const { tiers } = await response.json();
```

#### 2. Create Subscription
```typescript
const response = await fetch('/api/payments/create-subscription', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tierID: 'creator_pro',
    paymentMethodId: 'pm_xxx' // Optional
  })
});

const { subscription, clientSecret } = await response.json();
```

#### 3. Create Checkout Session
```typescript
const response = await fetch('/api/payments/create-checkout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 100, // $100
    description: 'One-time investment',
    successUrl: 'https://app.com/success',
    cancelUrl: 'https://app.com/cancel'
  })
});

const { sessionId, url } = await response.json();
// Redirect user to `url` for payment
```

#### 4. Process Investment
```typescript
const response = await fetch('/api/payments/process-investment', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    creatorId: 123,
    pitchId: 456,
    amount: 5000 // $5,000
  })
});

const { transferId, feeAmount, creatorAmount } = await response.json();
```

### Success Fee Structure
```typescript
// Investment: $5,000
// Platform Fee (2.5%): $125
// Creator Receives: $4,875
```

## Database Schema

### Enhanced Tables Used

#### users
- `stripeCustomerId` - Stripe customer ID
- `subscriptionTier` - Current subscription tier
- `subscriptionStartDate` - Subscription start date
- `subscriptionEndDate` - Subscription end date
- `stripeSubscriptionId` - Stripe subscription ID

#### subscriptionHistory
- Complete subscription change tracking
- Billing history with amounts
- Status transitions
- Metadata for debugging

#### paymentMethods
- Saved payment methods
- Card/bank account details
- Default method selection
- Active/inactive status

#### payments
- Payment intent tracking
- Invoice associations
- Transaction status
- Failure reason logging

## Security Features

### PCI Compliance
- All payment data handled by Stripe
- No card data stored locally
- Tokenized payment methods
- Secure webhook verification

### Authentication
- JWT-based authentication required
- User context validation
- Permission-based access control
- Rate limiting on sensitive endpoints

### Webhook Security
- Stripe signature verification
- Idempotency handling
- Error logging and alerting
- Automatic retry mechanism

## Error Handling

### Common Scenarios
```typescript
// Insufficient funds
if (error.code === 'card_declined') {
  return 'Payment was declined. Please try a different payment method.';
}

// Authentication required
if (error.code === 'authentication_required') {
  return 'Please complete 3D Secure authentication.';
}

// Subscription already exists
if (error.code === 'subscription_exists') {
  return 'You already have an active subscription.';
}
```

### Monitoring & Alerts
- Sentry integration for error tracking
- Webhook failure notifications
- Payment failure alerts
- Subscription churn monitoring

## Testing

### Test Cards (Stripe Test Mode)
```bash
# Successful payment
4242424242424242

# Requires authentication
4000000000003220

# Declined payment
4000000000000002

# Insufficient funds
4000000000009995
```

### Test Scenarios
1. **Subscription Lifecycle**
   - Create subscription
   - Upgrade/downgrade
   - Cancel subscription
   - Reactivate subscription

2. **Payment Processing**
   - One-time payments
   - Investment transactions
   - Refund processing
   - Failed payment handling

3. **Webhook Processing**
   - Subscription events
   - Payment events
   - Customer events
   - Invoice events

## Deployment

### Production Checklist
- [ ] Switch to live Stripe keys
- [ ] Configure production webhooks
- [ ] Set up monitoring and alerts
- [ ] Test payment flows end-to-end
- [ ] Configure tax settings
- [ ] Set up Connect for creator payouts
- [ ] Review security settings
- [ ] Test webhook endpoints

### Performance Optimization
- Database indexes on subscription queries
- Webhook idempotency handling
- Payment method caching
- Subscription status caching

## Troubleshooting

### Common Issues

#### Webhook Not Received
```bash
# Check webhook endpoint URL
# Verify Stripe signature
# Check server logs for errors
# Test with Stripe CLI
stripe listen --forward-to localhost:8001/api/payments/webhook
```

#### Payment Failures
```bash
# Check Stripe Dashboard > Logs
# Verify payment method status
# Check for authentication requirements
# Review error codes and messages
```

#### Subscription Sync Issues
```bash
# Verify webhook processing
# Check subscription status in Stripe
# Review database sync logic
# Manual subscription sync if needed
```

## Support

### Resources
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Dashboard](https://dashboard.stripe.com)
- [Pitchey Payment Service Code](./src/services/stripe-service.ts)
- [Payment Routes](./src/routes/payments.ts)

### Contact
For technical issues related to payment processing:
1. Check Stripe Dashboard for transaction details
2. Review server logs and error messages
3. Test in Stripe test mode first
4. Contact development team with specific error codes

## Future Enhancements

### Planned Features
- Multi-currency support
- Subscription pause/resume
- Usage-based billing
- Advanced tax handling
- Connect marketplace expansion
- Mobile payment optimization
- Crypto payment integration
- Enterprise billing features