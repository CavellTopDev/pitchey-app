# Mock Stripe Payment System

This document explains how the mock Stripe payment system works in the Pitchey platform. The mock system allows full payment functionality without requiring real Stripe credentials or processing actual payments.

## Overview

The mock Stripe service provides a complete replacement for Stripe API calls, enabling:
- Investment payments (one-time)
- Subscription management (Creator Pro, Investor Pro)
- Credit purchases
- Payment intent handling
- Webhook simulation
- Customer management

## Automatic Mock Mode Detection

The system automatically switches to mock mode when:

1. **No Stripe credentials provided**: `STRIPE_SECRET_KEY` is not set
2. **Mock test key used**: `STRIPE_SECRET_KEY` starts with `mock_`
3. **Default test key**: `STRIPE_SECRET_KEY` equals `sk_test_...`

## Files Structure

```
src/services/
├── stripe.service.ts          # Main Stripe service (supports both real and mock)
├── stripe-mock.service.ts     # Mock Stripe implementation
test-mock-stripe-only.ts       # Test script for mock service
test-mock-payments.ts          # Full payment system test (requires DB)
test-payment-endpoints.ts      # API endpoint tests
```

## Mock Service Features

### ✅ Supported Operations

- **Customer Management**
  - Create customers
  - Retrieve customer details
  - Store customer metadata

- **Subscription Management**
  - Create subscriptions
  - Update subscriptions (cancellation)
  - Retrieve subscription details
  - Handle subscription lifecycle

- **Payment Processing**
  - Create payment intents
  - Process one-time payments
  - Handle payment success/failure

- **Checkout Sessions**
  - Create checkout sessions for subscriptions
  - Create checkout sessions for credit purchases
  - Generate mock checkout URLs

- **Webhook Handling**
  - Construct webhook events
  - Simulate payment success
  - Simulate checkout completion
  - Process webhook payloads

### 📊 Mock Data Generation

The mock service generates realistic Stripe-like data:

```typescript
// Customer IDs
"cus_mock_1760793784609_h9n5spw33"

// Subscription IDs  
"sub_mock_1760793784609_sgjjtd1le"

// Payment Intent IDs
"pi_mock_1760793784627_ia3s937hg"

// Checkout Session IDs
"cs_mock_1760793784627_rcs4ddtgw"

// Client Secrets
"pi_mock_1760793784627_a7ri409y8_secret_0.tcpi1gxavr"
```

## Configuration

### Environment Variables

```bash
# Force mock mode
STRIPE_SECRET_KEY=mock_test

# Or leave unset for automatic mock mode
# STRIPE_SECRET_KEY=

# Real Stripe (requires valid credentials)
STRIPE_SECRET_KEY=sk_live_...
# or
STRIPE_SECRET_KEY=sk_test_...
```

### Mock Service Configuration

```typescript
const mockStripe = getMockStripeService({
  enabled: true,           // Enable mock mode
  logPayments: true,       // Log all operations to console
  simulateErrors: false,   // Don't simulate errors
  errorRate: 0            // 0% error rate
});
```

## Price Configuration

The mock service recognizes these price IDs and amounts:

| Price ID | Amount | Description |
|----------|---------|-------------|
| `price_creator_monthly` | $10.00 | Creator subscription |
| `price_pro_monthly` | $20.00 | Pro subscription |
| `price_investor_monthly` | $20.00 | Investor subscription |
| `price_credits_small` | $10.00 | 10 credits |
| `price_credits_medium` | $40.00 | 50 credits |
| `price_credits_large` | $70.00 | 100 credits |

## Usage Examples

### Basic Mock Payment Flow

```typescript
import { StripeService } from "./src/services/stripe.service.ts";

// Set mock mode
Deno.env.set("STRIPE_SECRET_KEY", "mock_test");

// Create customer
const customer = await StripeService.createCustomer(userId, email);

// Create subscription
const subscription = await StripeService.createSubscription(userId, "price_pro_monthly");

// Create payment intent
const paymentIntent = await StripeService.createPaymentIntent({
  userId: userId,
  amount: 50.00,
  currency: "USD",
  type: "investment"
});
```

### Direct Mock Service Usage

```typescript
import { getMockStripeService } from "./src/services/stripe-mock.service.ts";

const mockStripe = getMockStripeService();

// Create customer directly
const customer = await mockStripe.createCustomer({
  email: "test@example.com",
  metadata: { userId: "123" }
});

// Simulate webhook
const event = await mockStripe.simulateCheckoutCompletion(sessionId);
```

## Testing

### Run Mock Service Tests

```bash
# Test mock service without database
deno run --allow-all test-mock-stripe-only.ts

# Test full payment system (requires database)
STRIPE_SECRET_KEY=mock_test deno run --allow-all test-mock-payments.ts

# Test payment endpoints (requires running server)
deno run --allow-all test-payment-endpoints.ts
```

### Test Output

Successful tests show:
```
🎉 All Mock Stripe Service Tests Passed!
=======================================

✅ The mock Stripe service is working correctly!
✅ All core Stripe operations are properly mocked.
✅ Realistic mock data is generated for all operations.
✅ Event simulation works for testing webhooks.
```

## API Endpoints

All existing payment endpoints work with mock data:

```bash
# Get subscription status
GET /api/payments/subscription-status

# Get credit balance  
GET /api/payments/credits/balance

# Purchase credits
POST /api/payments/credits/purchase

# Create payment intent
POST /api/payments/create-intent

# Subscribe to plan
POST /api/payments/subscribe

# Cancel subscription
POST /api/payments/cancel-subscription

# Get payment history
GET /api/payments/history

# Get payment methods
GET /api/payments/payment-methods
```

## Webhook Simulation

The mock service can simulate webhook events for testing:

```typescript
// Simulate successful payment
const successEvent = await mockStripe.simulatePaymentSuccess(paymentIntentId);

// Simulate completed checkout
const checkoutEvent = await mockStripe.simulateCheckoutCompletion(sessionId);

// Process webhook through main service
await StripeService.handleWebhook(JSON.stringify(event), "mock_signature");
```

## Console Logging

When `logPayments: true`, all operations are logged:

```
[Mock Stripe] Customer created {
  "id": "cus_mock_1760793784609_h9n5spw33",
  "email": "test@mock-payments.com",
  "metadata": { "userId": "999" },
  "created": 1760793784
}

[Mock Stripe] Subscription created {
  "id": "sub_mock_1760793784609_sgjjtd1le",
  "customer": "cus_mock_1760793784609_h9n5spw33",
  "status": "active"
}
```

## Production vs Mock Mode

| Feature | Mock Mode | Production Mode |
|---------|-----------|-----------------|
| **Payment Processing** | Simulated | Real Stripe API |
| **Webhook Events** | Simulated | Real Stripe webhooks |
| **Payment IDs** | Mock format | Real Stripe IDs |
| **Error Handling** | Configurable | Real API errors |
| **Logging** | Detailed console logs | Error logs only |
| **Data Persistence** | In-memory (session) | Stripe dashboard |

## Benefits

### ✅ For Development
- No Stripe account required
- No real money involved
- Instant payment processing
- Detailed logging
- Consistent test data

### ✅ For Testing
- Predictable payment outcomes
- Webhook event simulation
- Error scenario testing
- No external dependencies
- Fast test execution

### ✅ For Demos
- Works without configuration
- Professional payment flows
- No payment failures
- Realistic user experience
- Safe for demonstrations

## Migration to Production

To switch to real Stripe:

1. **Set up Stripe account**
2. **Configure environment variables**:
   ```bash
   STRIPE_SECRET_KEY=sk_live_your_real_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```
3. **Update price IDs** in `utils/stripe.ts`
4. **Test with Stripe test mode** first
5. **Deploy with live keys** for production

The code automatically detects real credentials and switches to production mode.

## Security Considerations

### ✅ Mock Mode Security
- No real payment data
- No external API calls
- Safe for development/testing
- No sensitive data exposure

### ⚠️ Production Mode Requirements
- Secure credential storage
- PCI compliance considerations
- Webhook signature verification
- HTTPS endpoints required
- Regular security audits

## Troubleshooting

### Common Issues

1. **Database errors in tests**
   - Use `test-mock-stripe-only.ts` to test without DB
   - Ensure database is running for full tests

2. **Mock mode not activating**
   - Check `STRIPE_SECRET_KEY` value
   - Verify `shouldUseMockStripe()` returns `true`

3. **Webhook simulation failing**
   - Ensure payload is valid JSON
   - Check mock service configuration
   - Verify event types are supported

### Debug Information

```typescript
import { shouldUseMockStripe } from "./src/services/stripe-mock.service.ts";

console.log("Mock mode:", shouldUseMockStripe());
console.log("Stripe key:", Deno.env.get("STRIPE_SECRET_KEY"));
```

## Support

For issues with the mock payment system:

1. Run the test suites to verify functionality
2. Check console logs for detailed operation info
3. Verify environment variable configuration
4. Ensure database tables exist for full integration

The mock system is designed to be a drop-in replacement for Stripe, maintaining full API compatibility while providing safe, predictable payment processing for development and testing.