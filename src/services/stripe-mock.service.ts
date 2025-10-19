// Mock Stripe Service for Development/Testing
// This service provides the same interface as Stripe but returns mock data
// Used when STRIPE_SECRET_KEY is not configured or starts with 'mock_'

export interface MockStripeConfig {
  enabled: boolean;
  logPayments: boolean;
  simulateErrors: boolean;
  errorRate: number; // 0-1, percentage of operations that should fail
}

export interface MockCustomer {
  id: string;
  email: string;
  metadata: Record<string, string>;
  created: number;
}

export interface MockSubscription {
  id: string;
  customer: string;
  status: 'active' | 'canceled' | 'incomplete' | 'past_due';
  current_period_start: number;
  current_period_end: number;
  currency: string;
  items: {
    data: Array<{
      price: {
        id: string;
        unit_amount: number;
        recurring?: {
          interval: 'month' | 'year';
        };
      };
    }>;
  };
}

export interface MockPaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'requires_payment_method' | 'failed';
  client_secret: string;
  metadata: Record<string, string>;
  last_payment_error?: {
    message: string;
  };
}

export interface MockCheckoutSession {
  id: string;
  customer?: string;
  customer_email?: string;
  mode: 'subscription' | 'payment';
  url: string;
  success_url: string;
  cancel_url: string;
  metadata: Record<string, string>;
  amount_total?: number;
  payment_intent?: string;
  subscription?: string;
}

export interface MockInvoice {
  id: string;
  customer: string;
  subscription?: string;
  payment_intent?: string;
  amount_paid: number;
  status: 'paid' | 'open' | 'draft';
}

export interface MockPaymentMethod {
  id: string;
  type: 'card';
  customer: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

export interface MockWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
}

export class MockStripeService {
  private config: MockStripeConfig;
  private customers: Map<string, MockCustomer> = new Map();
  private subscriptions: Map<string, MockSubscription> = new Map();
  private paymentIntents: Map<string, MockPaymentIntent> = new Map();
  private checkoutSessions: Map<string, MockCheckoutSession> = new Map();
  private invoices: Map<string, MockInvoice> = new Map();
  private paymentMethods: Map<string, MockPaymentMethod> = new Map();

  constructor(config: MockStripeConfig = {
    enabled: true,
    logPayments: true,
    simulateErrors: false,
    errorRate: 0.05
  }) {
    this.config = config;
    this.log("Mock Stripe Service initialized", { config });
  }

  private log(message: string, data?: any) {
    if (this.config.logPayments) {
      console.log(`[Mock Stripe] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldSimulateError(): boolean {
    return this.config.simulateErrors && Math.random() < this.config.errorRate;
  }

  private throwError(message: string) {
    this.log(`Simulated error: ${message}`);
    throw new Error(`Mock Stripe Error: ${message}`);
  }

  // Customer operations
  async createCustomer(params: { email: string; metadata?: Record<string, string> }): Promise<MockCustomer> {
    if (this.shouldSimulateError()) {
      this.throwError("Failed to create customer");
    }

    const customer: MockCustomer = {
      id: this.generateId('cus'),
      email: params.email,
      metadata: params.metadata || {},
      created: Math.floor(Date.now() / 1000)
    };

    this.customers.set(customer.id, customer);
    this.log("Customer created", customer);
    return customer;
  }

  async retrieveCustomer(customerId: string): Promise<MockCustomer> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      this.throwError(`Customer ${customerId} not found`);
    }
    return customer!;
  }

  // Subscription operations
  async createSubscription(params: {
    customer: string;
    items: Array<{ price: string }>;
    payment_behavior?: string;
    expand?: string[];
  }): Promise<MockSubscription> {
    if (this.shouldSimulateError()) {
      this.throwError("Failed to create subscription");
    }

    const priceId = params.items[0]?.price;
    const unitAmount = this.getPriceAmount(priceId);

    const subscription: MockSubscription = {
      id: this.generateId('sub'),
      customer: params.customer,
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000), // 30 days
      currency: 'usd',
      items: {
        data: [{
          price: {
            id: priceId,
            unit_amount: unitAmount,
            recurring: {
              interval: 'month'
            }
          }
        }]
      }
    };

    this.subscriptions.set(subscription.id, subscription);
    this.log("Subscription created", subscription);
    return subscription;
  }

  async retrieveSubscription(subscriptionId: string): Promise<MockSubscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.throwError(`Subscription ${subscriptionId} not found`);
    }
    return subscription!;
  }

  async updateSubscription(subscriptionId: string, params: { cancel_at_period_end?: boolean }): Promise<MockSubscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.throwError(`Subscription ${subscriptionId} not found`);
    }

    if (params.cancel_at_period_end) {
      subscription!.status = 'canceled';
    }

    this.log("Subscription updated", subscription);
    return subscription!;
  }

  // Payment Intent operations
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
  }): Promise<MockPaymentIntent> {
    if (this.shouldSimulateError()) {
      this.throwError("Failed to create payment intent");
    }

    const paymentIntent: MockPaymentIntent = {
      id: this.generateId('pi'),
      amount: params.amount,
      currency: params.currency,
      status: 'succeeded',
      client_secret: `${this.generateId('pi')}_secret_${Math.random().toString(36)}`,
      metadata: params.metadata || {}
    };

    this.paymentIntents.set(paymentIntent.id, paymentIntent);
    this.log("Payment intent created", paymentIntent);
    return paymentIntent;
  }

  // Checkout Session operations
  async createCheckoutSession(params: {
    customer?: string;
    customer_email?: string;
    line_items: Array<{ price: string; quantity: number }>;
    mode: 'subscription' | 'payment';
    success_url: string;
    cancel_url: string;
    metadata?: Record<string, string>;
  }): Promise<MockCheckoutSession> {
    if (this.shouldSimulateError()) {
      this.throwError("Failed to create checkout session");
    }

    const sessionId = this.generateId('cs');
    const priceId = params.line_items[0]?.price;
    const unitAmount = this.getPriceAmount(priceId);
    
    const session: MockCheckoutSession = {
      id: sessionId,
      customer: params.customer,
      customer_email: params.customer_email,
      mode: params.mode,
      url: `https://checkout.stripe.com/c/pay/${sessionId}#mock`,
      success_url: params.success_url,
      cancel_url: params.cancel_url,
      metadata: params.metadata || {},
      amount_total: unitAmount * (params.line_items[0]?.quantity || 1)
    };

    if (params.mode === 'subscription') {
      session.subscription = this.generateId('sub');
    } else {
      session.payment_intent = this.generateId('pi');
    }

    this.checkoutSessions.set(session.id, session);
    this.log("Checkout session created", session);
    return session;
  }

  // Payment Method operations
  async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<MockPaymentMethod> {
    const paymentMethod: MockPaymentMethod = {
      id: paymentMethodId,
      type: 'card',
      customer: customerId,
      card: {
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2025
      }
    };

    this.paymentMethods.set(paymentMethod.id, paymentMethod);
    this.log("Payment method attached", paymentMethod);
    return paymentMethod;
  }

  // Webhook construction (mock)
  constructEvent(payload: string, signature: string, secret: string): MockWebhookEvent {
    // In real Stripe, this would verify the signature
    // For mock, we'll just return a parsed event
    try {
      const data = JSON.parse(payload);
      const event: MockWebhookEvent = {
        id: this.generateId('evt'),
        type: data.type || 'unknown',
        data: data.data || { object: data },
        created: Math.floor(Date.now() / 1000)
      };

      this.log("Webhook event constructed", event);
      return event;
    } catch (error) {
      this.throwError("Invalid webhook payload");
      throw error; // This will never be reached due to throwError, but TypeScript needs it
    }
  }

  // Utility method to simulate successful checkout completion
  async simulateCheckoutCompletion(sessionId: string): Promise<MockWebhookEvent> {
    const session = this.checkoutSessions.get(sessionId);
    if (!session) {
      this.throwError(`Checkout session ${sessionId} not found`);
    }

    const event: MockWebhookEvent = {
      id: this.generateId('evt'),
      type: 'checkout.session.completed',
      data: {
        object: session!
      },
      created: Math.floor(Date.now() / 1000)
    };

    this.log("Simulated checkout completion", event);
    return event;
  }

  // Utility method to simulate payment success
  async simulatePaymentSuccess(paymentIntentId: string): Promise<MockWebhookEvent> {
    const paymentIntent = this.paymentIntents.get(paymentIntentId);
    if (!paymentIntent) {
      this.throwError(`Payment intent ${paymentIntentId} not found`);
    }

    paymentIntent!.status = 'succeeded';

    const event: MockWebhookEvent = {
      id: this.generateId('evt'),
      type: 'payment_intent.succeeded',
      data: {
        object: paymentIntent!
      },
      created: Math.floor(Date.now() / 1000)
    };

    this.log("Simulated payment success", event);
    return event;
  }

  // Helper to get mock price amounts
  private getPriceAmount(priceId: string): number {
    const priceMap: Record<string, number> = {
      // Subscription prices (monthly amounts in cents)
      'price_creator_monthly': 1000, // $10
      'price_pro_monthly': 2000, // $20  
      'price_investor_monthly': 2000, // $20
      
      // Credit packages (in cents)
      'price_credits_small': 1000, // $10 for 10 credits
      'price_credits_medium': 4000, // $40 for 50 credits
      'price_credits_large': 7000, // $70 for 100 credits
      
      // Default fallback
      'default': 1000
    };

    return priceMap[priceId] || priceMap.default;
  }

  // Test utilities for development
  async getAllMockData() {
    return {
      customers: Array.from(this.customers.values()),
      subscriptions: Array.from(this.subscriptions.values()),
      paymentIntents: Array.from(this.paymentIntents.values()),
      checkoutSessions: Array.from(this.checkoutSessions.values()),
      invoices: Array.from(this.invoices.values()),
      paymentMethods: Array.from(this.paymentMethods.values())
    };
  }

  async clearAllMockData() {
    this.customers.clear();
    this.subscriptions.clear();
    this.paymentIntents.clear();
    this.checkoutSessions.clear();
    this.invoices.clear();
    this.paymentMethods.clear();
    this.log("All mock data cleared");
  }
}

// Singleton instance for the mock service
let mockStripeInstance: MockStripeService | null = null;

export function getMockStripeService(config?: MockStripeConfig): MockStripeService {
  if (!mockStripeInstance) {
    mockStripeInstance = new MockStripeService(config);
  }
  return mockStripeInstance;
}

// Helper to determine if we should use mock Stripe
export function shouldUseMockStripe(): boolean {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  return !stripeKey || stripeKey.startsWith('mock_') || stripeKey === 'sk_test_...';
}