/**
 * Mock Payment Provider
 * 
 * Enhanced mock payment provider that implements full database updates
 * and provides a realistic testing environment for payment flows.
 */

import { db } from "../../db/client.ts";
import { 
  users, 
  transactions, 
  payments, 
  creditTransactions, 
  userCredits
} from "../../db/schema.ts";
import { eq } from "npm:drizzle-orm@0.35.3";
import {
  PaymentProvider,
  PaymentService,
  PaymentCustomer,
  PaymentSubscription,
  PaymentIntent,
  CheckoutSession,
  PaymentMethod,
  Invoice,
  WebhookEvent,
  CreateCustomerParams,
  CreateSubscriptionParams,
  UpdateSubscriptionParams,
  CreatePaymentIntentParams,
  CreateCheckoutSessionParams,
  CreditsPurchaseData,
  SubscriptionUpdateData,
  TransactionCreateData,
  PaymentError,
  PaymentProviderError
} from "./interface.ts";
import { CREDIT_PACKAGES, getTierFromPriceId, getCreditsFromPriceId } from "../../../utils/stripe.ts";

interface MockConfig {
  enabled: boolean;
  logPayments: boolean;
  simulateErrors: boolean;
  errorRate: number;
  baseUrl: string;
}

export class MockPaymentProvider implements PaymentService {
  private config: MockConfig;
  private customers: Map<string, PaymentCustomer> = new Map();
  private subscriptions: Map<string, PaymentSubscription> = new Map();
  private paymentIntents: Map<string, PaymentIntent> = new Map();
  private checkoutSessions: Map<string, CheckoutSession> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private paymentMethods: Map<string, PaymentMethod> = new Map();

  constructor(config: Partial<MockConfig> = {}) {
    this.config = {
      enabled: true,
      logPayments: true,
      simulateErrors: false,
      errorRate: 0.05,
      baseUrl: "http://localhost:8001",
      ...config
    };
    this.log("Mock Payment Provider initialized", { config: this.config });
  }

  private log(message: string, data?: any) {
    if (this.config.logPayments) {
      console.log(`[Mock Payment] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldSimulateError(): boolean {
    return this.config.simulateErrors && Math.random() < this.config.errorRate;
  }

  private throwError(message: string, code?: string, type?: string) {
    this.log(`Simulated error: ${message}`);
    throw new PaymentProviderError(message, "mock", code, type);
  }

  // Provider identification
  isTestMode(): boolean {
    return true;
  }

  getProviderName(): string {
    return "mock";
  }

  // Customer operations
  async createCustomer(params: CreateCustomerParams): Promise<PaymentCustomer> {
    if (this.shouldSimulateError()) {
      this.throwError("Failed to create customer", "customer_creation_failed");
    }

    const customer: PaymentCustomer = {
      id: this.generateId('cus'),
      email: params.email,
      metadata: params.metadata || {},
      created: Math.floor(Date.now() / 1000)
    };

    this.customers.set(customer.id, customer);
    this.log("Customer created", customer);
    return customer;
  }

  async retrieveCustomer(customerId: string): Promise<PaymentCustomer> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      this.throwError(`Customer ${customerId} not found`, "customer_not_found");
    }
    return customer!;
  }

  async updateCustomer(customerId: string, params: Partial<CreateCustomerParams>): Promise<PaymentCustomer> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      this.throwError(`Customer ${customerId} not found`, "customer_not_found");
    }

    const updatedCustomer = {
      ...customer!,
      ...params,
      metadata: { ...customer!.metadata, ...params.metadata }
    };

    this.customers.set(customerId, updatedCustomer);
    this.log("Customer updated", updatedCustomer);
    return updatedCustomer;
  }

  // Subscription operations
  async createSubscription(params: CreateSubscriptionParams): Promise<PaymentSubscription> {
    if (this.shouldSimulateError()) {
      this.throwError("Failed to create subscription", "subscription_creation_failed");
    }

    const priceId = params.items[0]?.price;
    const unitAmount = this.getPriceAmount(priceId);

    const subscription: PaymentSubscription = {
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

  async retrieveSubscription(subscriptionId: string): Promise<PaymentSubscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.throwError(`Subscription ${subscriptionId} not found`, "subscription_not_found");
    }
    return subscription!;
  }

  async updateSubscription(subscriptionId: string, params: UpdateSubscriptionParams): Promise<PaymentSubscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.throwError(`Subscription ${subscriptionId} not found`, "subscription_not_found");
    }

    const updatedSubscription = {
      ...subscription!,
      cancel_at_period_end: params.cancel_at_period_end
    };

    if (params.cancel_at_period_end) {
      updatedSubscription.status = 'canceled';
    }

    this.subscriptions.set(subscriptionId, updatedSubscription);
    this.log("Subscription updated", updatedSubscription);
    return updatedSubscription;
  }

  async cancelSubscription(subscriptionId: string): Promise<PaymentSubscription> {
    return this.updateSubscription(subscriptionId, { cancel_at_period_end: true });
  }

  // Payment Intent operations
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    if (this.shouldSimulateError()) {
      this.throwError("Failed to create payment intent", "payment_intent_creation_failed");
    }

    const paymentIntent: PaymentIntent = {
      id: this.generateId('pi'),
      amount: params.amount,
      currency: params.currency,
      status: 'requires_payment_method',
      client_secret: `${this.generateId('pi')}_secret_${Math.random().toString(36)}`,
      metadata: params.metadata || {},
      confirmation_method: params.confirmation_method || 'automatic'
    };

    this.paymentIntents.set(paymentIntent.id, paymentIntent);
    this.log("Payment intent created", paymentIntent);
    return paymentIntent;
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    const paymentIntent = this.paymentIntents.get(paymentIntentId);
    if (!paymentIntent) {
      this.throwError(`Payment intent ${paymentIntentId} not found`, "payment_intent_not_found");
    }
    return paymentIntent!;
  }

  async confirmPaymentIntent(paymentIntentId: string, params?: any): Promise<PaymentIntent> {
    const paymentIntent = this.paymentIntents.get(paymentIntentId);
    if (!paymentIntent) {
      this.throwError(`Payment intent ${paymentIntentId} not found`, "payment_intent_not_found");
    }

    // Simulate payment processing
    const updatedPaymentIntent = {
      ...paymentIntent!,
      status: 'succeeded' as const
    };

    this.paymentIntents.set(paymentIntentId, updatedPaymentIntent);
    this.log("Payment intent confirmed", updatedPaymentIntent);
    return updatedPaymentIntent;
  }

  // Checkout Session operations
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession> {
    if (this.shouldSimulateError()) {
      this.throwError("Failed to create checkout session", "checkout_session_creation_failed");
    }

    const sessionId = this.generateId('cs');
    const priceId = params.line_items[0]?.price;
    const unitAmount = this.getPriceAmount(priceId);
    
    const session: CheckoutSession = {
      id: sessionId,
      customer: params.customer,
      customer_email: params.customer_email,
      mode: params.mode,
      url: `${this.config.baseUrl}/mock-checkout/${sessionId}`,
      success_url: params.success_url,
      cancel_url: params.cancel_url,
      metadata: params.metadata || {},
      amount_total: unitAmount * (params.line_items[0]?.quantity || 1),
      status: 'open'
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

  async retrieveCheckoutSession(sessionId: string): Promise<CheckoutSession> {
    const session = this.checkoutSessions.get(sessionId);
    if (!session) {
      this.throwError(`Checkout session ${sessionId} not found`, "checkout_session_not_found");
    }
    return session!;
  }

  // Payment Method operations
  async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<PaymentMethod> {
    const paymentMethod: PaymentMethod = {
      id: paymentMethodId,
      type: 'card',
      customer: customerId,
      card: {
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2025,
        funding: 'credit'
      }
    };

    this.paymentMethods.set(paymentMethod.id, paymentMethod);
    this.log("Payment method attached", paymentMethod);
    return paymentMethod;
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
    const paymentMethod = this.paymentMethods.get(paymentMethodId);
    if (!paymentMethod) {
      this.throwError(`Payment method ${paymentMethodId} not found`, "payment_method_not_found");
    }

    const detachedPaymentMethod = {
      ...paymentMethod!,
      customer: undefined
    };

    this.paymentMethods.set(paymentMethodId, detachedPaymentMethod);
    this.log("Payment method detached", detachedPaymentMethod);
    return detachedPaymentMethod;
  }

  async listPaymentMethods(customerId: string, type?: string): Promise<{ data: PaymentMethod[] }> {
    const methods = Array.from(this.paymentMethods.values())
      .filter(pm => pm.customer === customerId && (!type || pm.type === type));
    
    return { data: methods };
  }

  // Invoice operations
  async retrieveInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      this.throwError(`Invoice ${invoiceId} not found`, "invoice_not_found");
    }
    return invoice!;
  }

  async listInvoices(customerId?: string): Promise<{ data: Invoice[] }> {
    let invoices = Array.from(this.invoices.values());
    if (customerId) {
      invoices = invoices.filter(inv => inv.customer === customerId);
    }
    return { data: invoices };
  }

  // Webhook operations
  constructEvent(payload: string, signature: string, secret: string): WebhookEvent {
    try {
      const data = JSON.parse(payload);
      const event: WebhookEvent = {
        id: this.generateId('evt'),
        type: data.type || 'unknown',
        data: data.data || { object: data },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        pending_webhooks: 1
      };

      this.log("Webhook event constructed", event);
      return event;
    } catch (error) {
      this.throwError("Invalid webhook payload", "webhook_invalid_payload");
      throw error; // TypeScript requirement
    }
  }

  // Database operations
  async processCreditsPayment(data: CreditsPurchaseData): Promise<void> {
    try {
      this.log("Processing credits payment", data);

      // Get or create user credits record
      let userCreditsRecord = await db.query.userCredits.findFirst({
        where: eq(userCredits.userId, data.userId),
      });

      if (!userCreditsRecord) {
        const newRecord = await db.insert(userCredits).values({
          userId: data.userId,
          amount: 0,
        }).returning();
        userCreditsRecord = newRecord[0];
      }

      const newBalance = userCreditsRecord.amount + data.credits;

      // Update credits balance
      await db.update(userCredits)
        .set({
          amount: newBalance,
          updatedAt: new Date(),
        })
        .where(eq(userCredits.userId, data.userId));

      // Create credit transaction
      await db.insert(creditTransactions).values({
        userId: data.userId,
        transactionType: 'purchase',
        amount: data.credits,
        description: `Purchased ${data.credits} credits (${data.packageType} package)`,
      });

      // Update payment record
      if (data.paymentIntentId) {
        await db.update(payments)
          .set({
            status: "completed",
            updatedAt: new Date(),
          })
          .where(eq(payments.stripePaymentIntentId, data.paymentIntentId));
      }

      this.log("Credits payment processed successfully", {
        userId: data.userId,
        creditsAdded: data.credits,
        newBalance
      });

    } catch (error) {
      console.error("Error processing credits payment:", error);
      throw new PaymentError("Failed to process credits payment", "credits_processing_failed");
    }
  }

  async processSubscriptionPayment(data: SubscriptionUpdateData): Promise<void> {
    try {
      this.log("Processing subscription payment", data);

      // Update user subscription
      await db.update(users)
        .set({
          stripeSubscriptionId: data.subscriptionId,
          stripeCustomerId: data.customerId,
          subscriptionTier: data.tier as any,
          subscriptionStartDate: data.currentPeriodStart,
          subscriptionEndDate: data.currentPeriodEnd,
        })
        .where(eq(users.id, data.userId));

      // Create transaction record
      await this.createTransactionRecord({
        userId: data.userId,
        type: 'subscription',
        amount: this.getPriceAmount(data.priceId) / 100, // Convert cents to dollars
        currency: 'usd',
        description: `Subscription payment: ${data.tier} plan`,
        metadata: {
          subscriptionId: data.subscriptionId,
          priceId: data.priceId,
          tier: data.tier
        }
      });

      this.log("Subscription payment processed successfully", {
        userId: data.userId,
        tier: data.tier,
        subscriptionId: data.subscriptionId
      });

    } catch (error) {
      console.error("Error processing subscription payment:", error);
      throw new PaymentError("Failed to process subscription payment", "subscription_processing_failed");
    }
  }

  async createTransactionRecord(data: TransactionCreateData): Promise<number> {
    try {
      const transaction = await db.insert(transactions).values({
        userId: data.userId,
        transactionType: data.type,
        amount: data.amount.toString(),
        description: data.description,
        metadata: data.metadata,
      }).returning();

      this.log("Transaction record created", transaction[0]);
      return transaction[0].id;

    } catch (error) {
      console.error("Error creating transaction record:", error);
      throw new PaymentError("Failed to create transaction record", "transaction_creation_failed");
    }
  }

  // Webhook handling
  async handleWebhook(payload: string, signature: string): Promise<void> {
    const event = this.constructEvent(payload, signature, "mock_webhook_secret");
    
    this.log(`Processing webhook event: ${event.type}`);
    
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutComplete(event.data.object);
        break;
      case "payment_intent.succeeded":
        await this.handlePaymentIntentSucceeded(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(event.data.object);
        break;
      case "invoice.paid":
        await this.handleInvoicePaid(event.data.object);
        break;
      default:
        this.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutComplete(session: any) {
    try {
      const userId = parseInt(session.metadata.userId);
      
      if (session.mode === "subscription") {
        await this.handleSubscriptionCheckout(session, userId);
      } else if (session.mode === "payment") {
        await this.handleCreditsCheckout(session, userId);
      }

      // Update checkout session status
      const checkoutSession = this.checkoutSessions.get(session.id);
      if (checkoutSession) {
        checkoutSession.status = 'complete';
        this.checkoutSessions.set(session.id, checkoutSession);
      }
        
    } catch (error) {
      console.error("Error handling checkout complete:", error);
    }
  }

  private async handleSubscriptionCheckout(session: any, userId: number) {
    const subscription = this.subscriptions.get(session.subscription);
    if (!subscription) return;

    const priceId = subscription.items.data[0]?.price.id;
    const tier = getTierFromPriceId(priceId) || "free";

    await this.processSubscriptionPayment({
      userId,
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      tier,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      priceId
    });
  }

  private async handleCreditsCheckout(session: any, userId: number) {
    const credits = parseInt(session.metadata.credits || "0");
    const packageType = session.metadata.package;

    if (credits > 0) {
      await this.processCreditsPayment({
        userId,
        credits,
        packageType,
        amount: session.amount_total || 0,
        currency: 'usd',
        sessionId: session.id
      });
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: any) {
    // Update payment intent status
    const pi = this.paymentIntents.get(paymentIntent.id);
    if (pi) {
      pi.status = 'succeeded';
      this.paymentIntents.set(paymentIntent.id, pi);
    }

    // Update database payment record
    await db.update(payments)
      .set({
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(payments.stripePaymentIntentId, paymentIntent.id));
  }

  private async handleSubscriptionUpdated(subscription: any) {
    // Update subscription in memory
    this.subscriptions.set(subscription.id, subscription);
    
    // Update database if needed
    const customer = this.customers.get(subscription.customer);
    if (customer?.metadata?.userId) {
      const userId = parseInt(customer.metadata.userId);
      await db.update(users)
        .set({
          subscriptionEndDate: new Date(subscription.current_period_end * 1000),
        })
        .where(eq(users.id, userId));
    }
  }

  private async handleSubscriptionDeleted(subscription: any) {
    // Update subscription status
    const sub = this.subscriptions.get(subscription.id);
    if (sub) {
      sub.status = 'canceled';
      this.subscriptions.set(subscription.id, sub);
    }

    // Update database
    const customer = this.customers.get(subscription.customer);
    if (customer?.metadata?.userId) {
      const userId = parseInt(customer.metadata.userId);
      await db.update(users)
        .set({
          subscriptionTier: "free",
          stripeSubscriptionId: null,
        })
        .where(eq(users.id, userId));
    }
  }

  private async handleInvoicePaid(invoice: any) {
    // Create or update invoice record
    this.invoices.set(invoice.id, {
      ...invoice,
      status: 'paid'
    });
  }

  // Mock-specific simulation methods
  async simulateCheckoutCompletion(sessionId: string): Promise<WebhookEvent> {
    const session = this.checkoutSessions.get(sessionId);
    if (!session) {
      this.throwError(`Checkout session ${sessionId} not found`, "checkout_session_not_found");
    }

    // Mark session as complete
    session!.status = 'complete';
    this.checkoutSessions.set(sessionId, session!);

    const event: WebhookEvent = {
      id: this.generateId('evt'),
      type: 'checkout.session.completed',
      data: {
        object: session!
      },
      created: Math.floor(Date.now() / 1000),
      livemode: false
    };

    // Process the webhook
    await this.handleWebhook(JSON.stringify({
      type: event.type,
      data: event.data
    }), "mock_signature");

    this.log("Simulated checkout completion", event);
    return event;
  }

  async simulatePaymentSuccess(paymentIntentId: string): Promise<WebhookEvent> {
    const paymentIntent = this.paymentIntents.get(paymentIntentId);
    if (!paymentIntent) {
      this.throwError(`Payment intent ${paymentIntentId} not found`, "payment_intent_not_found");
    }

    paymentIntent!.status = 'succeeded';
    this.paymentIntents.set(paymentIntentId, paymentIntent!);

    const event: WebhookEvent = {
      id: this.generateId('evt'),
      type: 'payment_intent.succeeded',
      data: {
        object: paymentIntent!
      },
      created: Math.floor(Date.now() / 1000),
      livemode: false
    };

    // Process the webhook
    await this.handleWebhook(JSON.stringify({
      type: event.type,
      data: event.data
    }), "mock_signature");

    this.log("Simulated payment success", event);
    return event;
  }

  async simulateWebhookEvent(eventType: string, data: any): Promise<void> {
    const event: WebhookEvent = {
      id: this.generateId('evt'),
      type: eventType,
      data: { object: data },
      created: Math.floor(Date.now() / 1000),
      livemode: false
    };

    await this.handleWebhook(JSON.stringify({
      type: event.type,
      data: event.data
    }), "mock_signature");

    this.log("Simulated webhook event", event);
  }

  // Test utilities
  async clearTestData(): Promise<void> {
    this.customers.clear();
    this.subscriptions.clear();
    this.paymentIntents.clear();
    this.checkoutSessions.clear();
    this.invoices.clear();
    this.paymentMethods.clear();
    this.log("All test data cleared");
  }

  async getTestData(): Promise<any> {
    return {
      customers: Array.from(this.customers.values()),
      subscriptions: Array.from(this.subscriptions.values()),
      paymentIntents: Array.from(this.paymentIntents.values()),
      checkoutSessions: Array.from(this.checkoutSessions.values()),
      invoices: Array.from(this.invoices.values()),
      paymentMethods: Array.from(this.paymentMethods.values())
    };
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
}