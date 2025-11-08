/**
 * Stripe Payment Provider
 * 
 * Production-ready Stripe integration that implements the payment service interface.
 * This provider handles real payments and webhooks with full error handling.
 */

import Stripe from "npm:stripe";
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
import { getTierFromPriceId, getCreditsFromPriceId } from "../../../utils/stripe.ts";

interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
}

export class StripePaymentProvider implements PaymentService {
  private stripe: Stripe;
  private config: StripeConfig;

  constructor(config: StripeConfig) {
    this.config = config;
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: "2023-10-16",
    });
    
    console.log(`[Stripe] Provider initialized in ${this.isTestMode() ? 'test' : 'live'} mode`);
  }

  private log(message: string, data?: any) {
    console.log(`[Stripe] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }

  private handleStripeError(error: any, operation: string): never {
    console.error(`[Stripe] Error in ${operation}:`, error);
    
    if (error.type === 'StripeCardError') {
      throw new PaymentProviderError(
        error.message || 'Card was declined',
        'stripe',
        error.code,
        'card_error'
      );
    } else if (error.type === 'StripeRateLimitError') {
      throw new PaymentProviderError(
        'Too many requests',
        'stripe',
        'rate_limit',
        'rate_limit_error'
      );
    } else if (error.type === 'StripeInvalidRequestError') {
      throw new PaymentProviderError(
        error.message || 'Invalid request',
        'stripe',
        error.code,
        'invalid_request_error'
      );
    } else if (error.type === 'StripeAPIError') {
      throw new PaymentProviderError(
        'Internal server error',
        'stripe',
        'api_error',
        'api_error'
      );
    } else if (error.type === 'StripeConnectionError') {
      throw new PaymentProviderError(
        'Network error',
        'stripe',
        'connection_error',
        'connection_error'
      );
    } else if (error.type === 'StripeAuthenticationError') {
      throw new PaymentProviderError(
        'Authentication error',
        'stripe',
        'authentication_error',
        'authentication_error'
      );
    } else {
      throw new PaymentProviderError(
        error.message || 'Unknown payment error',
        'stripe',
        'unknown',
        'unknown_error'
      );
    }
  }

  // Provider identification
  isTestMode(): boolean {
    return this.config.secretKey.includes('_test_');
  }

  getProviderName(): string {
    return "stripe";
  }

  // Customer operations
  async createCustomer(params: CreateCustomerParams): Promise<PaymentCustomer> {
    try {
      const customer = await this.stripe.customers.create({
        email: params.email,
        name: params.name,
        description: params.description,
        metadata: params.metadata || {},
      });

      this.log("Customer created", { id: customer.id, email: customer.email });
      
      return {
        id: customer.id,
        email: customer.email || '',
        metadata: customer.metadata,
        created: customer.created
      };
    } catch (error) {
      this.handleStripeError(error, 'createCustomer');
    }
  }

  async retrieveCustomer(customerId: string): Promise<PaymentCustomer> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      
      if (customer.deleted) {
        throw new PaymentProviderError(
          `Customer ${customerId} was deleted`,
          'stripe',
          'customer_deleted'
        );
      }

      return {
        id: customer.id,
        email: (customer as any).email || '',
        metadata: (customer as any).metadata || {},
        created: (customer as any).created
      };
    } catch (error) {
      this.handleStripeError(error, 'retrieveCustomer');
    }
  }

  async updateCustomer(customerId: string, params: Partial<CreateCustomerParams>): Promise<PaymentCustomer> {
    try {
      const customer = await this.stripe.customers.update(customerId, {
        email: params.email,
        name: params.name,
        description: params.description,
        metadata: params.metadata,
      });

      this.log("Customer updated", { id: customer.id });
      
      return {
        id: customer.id,
        email: customer.email || '',
        metadata: customer.metadata,
        created: customer.created
      };
    } catch (error) {
      this.handleStripeError(error, 'updateCustomer');
    }
  }

  // Subscription operations
  async createSubscription(params: CreateSubscriptionParams): Promise<PaymentSubscription> {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: params.customer,
        items: params.items,
        payment_behavior: params.payment_behavior || 'default_incomplete',
        expand: params.expand,
        metadata: params.metadata,
        trial_period_days: params.trial_period_days,
      });

      this.log("Subscription created", { id: subscription.id, customer: subscription.customer });

      return {
        id: subscription.id,
        customer: subscription.customer as string,
        status: subscription.status as any,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        currency: subscription.currency,
        items: {
          data: subscription.items.data.map(item => ({
            price: {
              id: item.price.id,
              unit_amount: item.price.unit_amount || 0,
              recurring: item.price.recurring ? {
                interval: item.price.recurring.interval as 'month' | 'year'
              } : undefined
            }
          }))
        },
        cancel_at_period_end: subscription.cancel_at_period_end
      };
    } catch (error) {
      this.handleStripeError(error, 'createSubscription');
    }
  }

  async retrieveSubscription(subscriptionId: string): Promise<PaymentSubscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

      return {
        id: subscription.id,
        customer: subscription.customer as string,
        status: subscription.status as any,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        currency: subscription.currency,
        items: {
          data: subscription.items.data.map(item => ({
            price: {
              id: item.price.id,
              unit_amount: item.price.unit_amount || 0,
              recurring: item.price.recurring ? {
                interval: item.price.recurring.interval as 'month' | 'year'
              } : undefined
            }
          }))
        },
        cancel_at_period_end: subscription.cancel_at_period_end
      };
    } catch (error) {
      this.handleStripeError(error, 'retrieveSubscription');
    }
  }

  async updateSubscription(subscriptionId: string, params: UpdateSubscriptionParams): Promise<PaymentSubscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: params.cancel_at_period_end,
        items: params.items,
        metadata: params.metadata,
        proration_behavior: params.proration_behavior,
      });

      this.log("Subscription updated", { id: subscription.id });

      return {
        id: subscription.id,
        customer: subscription.customer as string,
        status: subscription.status as any,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        currency: subscription.currency,
        items: {
          data: subscription.items.data.map(item => ({
            price: {
              id: item.price.id,
              unit_amount: item.price.unit_amount || 0,
              recurring: item.price.recurring ? {
                interval: item.price.recurring.interval as 'month' | 'year'
              } : undefined
            }
          }))
        },
        cancel_at_period_end: subscription.cancel_at_period_end
      };
    } catch (error) {
      this.handleStripeError(error, 'updateSubscription');
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<PaymentSubscription> {
    return this.updateSubscription(subscriptionId, { cancel_at_period_end: true });
  }

  // Payment Intent operations
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: params.amount,
        currency: params.currency,
        customer: params.customer,
        payment_method: params.payment_method,
        confirmation_method: params.confirmation_method || 'automatic',
        confirm: params.confirm,
        metadata: params.metadata,
        description: params.description,
      });

      this.log("Payment intent created", { id: paymentIntent.id, amount: paymentIntent.amount });

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status as any,
        client_secret: paymentIntent.client_secret || '',
        metadata: paymentIntent.metadata,
        confirmation_method: paymentIntent.confirmation_method as any,
        last_payment_error: paymentIntent.last_payment_error ? {
          message: paymentIntent.last_payment_error.message || '',
          code: paymentIntent.last_payment_error.code
        } : undefined
      };
    } catch (error) {
      this.handleStripeError(error, 'createPaymentIntent');
    }
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status as any,
        client_secret: paymentIntent.client_secret || '',
        metadata: paymentIntent.metadata,
        confirmation_method: paymentIntent.confirmation_method as any,
        last_payment_error: paymentIntent.last_payment_error ? {
          message: paymentIntent.last_payment_error.message || '',
          code: paymentIntent.last_payment_error.code
        } : undefined
      };
    } catch (error) {
      this.handleStripeError(error, 'retrievePaymentIntent');
    }
  }

  async confirmPaymentIntent(paymentIntentId: string, params?: any): Promise<PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, params);

      this.log("Payment intent confirmed", { id: paymentIntent.id, status: paymentIntent.status });

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status as any,
        client_secret: paymentIntent.client_secret || '',
        metadata: paymentIntent.metadata,
        confirmation_method: paymentIntent.confirmation_method as any,
        last_payment_error: paymentIntent.last_payment_error ? {
          message: paymentIntent.last_payment_error.message || '',
          code: paymentIntent.last_payment_error.code
        } : undefined
      };
    } catch (error) {
      this.handleStripeError(error, 'confirmPaymentIntent');
    }
  }

  // Checkout Session operations
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: params.customer,
        customer_email: params.customer_email,
        line_items: params.line_items,
        mode: params.mode,
        success_url: params.success_url,
        cancel_url: params.cancel_url,
        metadata: params.metadata,
        allow_promotion_codes: params.allow_promotion_codes,
        billing_address_collection: params.billing_address_collection,
        payment_method_types: params.payment_method_types,
        subscription_data: params.subscription_data,
      });

      this.log("Checkout session created", { id: session.id, mode: session.mode });

      return {
        id: session.id,
        customer: session.customer as string | undefined,
        customer_email: session.customer_email || undefined,
        mode: session.mode as any,
        url: session.url || '',
        success_url: session.success_url || '',
        cancel_url: session.cancel_url || '',
        metadata: session.metadata || {},
        amount_total: session.amount_total || undefined,
        payment_intent: session.payment_intent as string | undefined,
        subscription: session.subscription as string | undefined,
        status: session.status as any
      };
    } catch (error) {
      this.handleStripeError(error, 'createCheckoutSession');
    }
  }

  async retrieveCheckoutSession(sessionId: string): Promise<CheckoutSession> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);

      return {
        id: session.id,
        customer: session.customer as string | undefined,
        customer_email: session.customer_email || undefined,
        mode: session.mode as any,
        url: session.url || '',
        success_url: session.success_url || '',
        cancel_url: session.cancel_url || '',
        metadata: session.metadata || {},
        amount_total: session.amount_total || undefined,
        payment_intent: session.payment_intent as string | undefined,
        subscription: session.subscription as string | undefined,
        status: session.status as any
      };
    } catch (error) {
      this.handleStripeError(error, 'retrieveCheckoutSession');
    }
  }

  // Payment Method operations
  async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      this.log("Payment method attached", { id: paymentMethod.id, customer: customerId });

      return {
        id: paymentMethod.id,
        type: paymentMethod.type as any,
        customer: paymentMethod.customer as string,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          exp_month: paymentMethod.card.exp_month,
          exp_year: paymentMethod.card.exp_year,
          funding: paymentMethod.card.funding
        } : undefined,
        billing_details: paymentMethod.billing_details
      };
    } catch (error) {
      this.handleStripeError(error, 'attachPaymentMethod');
    }
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.detach(paymentMethodId);

      this.log("Payment method detached", { id: paymentMethod.id });

      return {
        id: paymentMethod.id,
        type: paymentMethod.type as any,
        customer: paymentMethod.customer as string | undefined,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          exp_month: paymentMethod.card.exp_month,
          exp_year: paymentMethod.card.exp_year,
          funding: paymentMethod.card.funding
        } : undefined,
        billing_details: paymentMethod.billing_details
      };
    } catch (error) {
      this.handleStripeError(error, 'detachPaymentMethod');
    }
  }

  async listPaymentMethods(customerId: string, type?: string): Promise<{ data: PaymentMethod[] }> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: type as any || 'card',
      });

      return {
        data: paymentMethods.data.map(pm => ({
          id: pm.id,
          type: pm.type as any,
          customer: pm.customer as string,
          card: pm.card ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
            funding: pm.card.funding
          } : undefined,
          billing_details: pm.billing_details
        }))
      };
    } catch (error) {
      this.handleStripeError(error, 'listPaymentMethods');
    }
  }

  // Invoice operations
  async retrieveInvoice(invoiceId: string): Promise<Invoice> {
    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId);

      return {
        id: invoice.id,
        customer: invoice.customer as string,
        subscription: invoice.subscription as string | undefined,
        payment_intent: invoice.payment_intent as string | undefined,
        amount_paid: invoice.amount_paid,
        amount_due: invoice.amount_due,
        status: invoice.status as any,
        currency: invoice.currency,
        created: invoice.created,
        due_date: invoice.due_date || undefined
      };
    } catch (error) {
      this.handleStripeError(error, 'retrieveInvoice');
    }
  }

  async listInvoices(customerId?: string): Promise<{ data: Invoice[] }> {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: customerId,
        limit: 100,
      });

      return {
        data: invoices.data.map(invoice => ({
          id: invoice.id,
          customer: invoice.customer as string,
          subscription: invoice.subscription as string | undefined,
          payment_intent: invoice.payment_intent as string | undefined,
          amount_paid: invoice.amount_paid,
          amount_due: invoice.amount_due,
          status: invoice.status as any,
          currency: invoice.currency,
          created: invoice.created,
          due_date: invoice.due_date || undefined
        }))
      };
    } catch (error) {
      this.handleStripeError(error, 'listInvoices');
    }
  }

  // Webhook operations
  constructEvent(payload: string, signature: string, secret: string): WebhookEvent {
    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, secret);
      
      this.log("Webhook event constructed", { type: event.type, id: event.id });
      
      return {
        id: event.id,
        type: event.type,
        data: event.data,
        created: event.created,
        livemode: event.livemode,
        pending_webhooks: event.pending_webhooks
      };
    } catch (error) {
      this.handleStripeError(error, 'constructEvent');
    }
  }

  // Database operations (shared with mock provider)
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
        amount: 0, // Will be updated with actual amount from webhook
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

  // Webhook handling (same as mock provider)
  async handleWebhook(payload: string, signature: string): Promise<void> {
    const event = this.constructEvent(payload, signature, this.config.webhookSecret);
    
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
      case "invoice.payment_failed":
        await this.handleInvoicePaymentFailed(event.data.object);
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
        
    } catch (error) {
      console.error("Error handling checkout complete:", error);
    }
  }

  private async handleSubscriptionCheckout(session: any, userId: number) {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(session.subscription);
      const priceId = subscription.items.data[0]?.price.id;
      const tier = getTierFromPriceId(priceId) || "free";

      await this.processSubscriptionPayment({
        userId,
        subscriptionId: subscription.id,
        customerId: subscription.customer as string,
        tier,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        priceId
      });
    } catch (error) {
      console.error("Error handling subscription checkout:", error);
    }
  }

  private async handleCreditsCheckout(session: any, userId: number) {
    try {
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
    } catch (error) {
      console.error("Error handling credits checkout:", error);
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: any) {
    try {
      // Update database payment record
      await db.update(payments)
        .set({
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(payments.stripePaymentIntentId, paymentIntent.id));
    } catch (error) {
      console.error("Error handling payment intent succeeded:", error);
    }
  }

  private async handleSubscriptionUpdated(subscription: any) {
    try {
      const customer = await this.stripe.customers.retrieve(subscription.customer);
      if ((customer as any).metadata?.userId) {
        const userId = parseInt((customer as any).metadata.userId);
        await db.update(users)
          .set({
            subscriptionEndDate: new Date(subscription.current_period_end * 1000),
          })
          .where(eq(users.id, userId));
      }
    } catch (error) {
      console.error("Error handling subscription updated:", error);
    }
  }

  private async handleSubscriptionDeleted(subscription: any) {
    try {
      const customer = await this.stripe.customers.retrieve(subscription.customer);
      if ((customer as any).metadata?.userId) {
        const userId = parseInt((customer as any).metadata.userId);
        await db.update(users)
          .set({
            subscriptionTier: "free",
            stripeSubscriptionId: null,
          })
          .where(eq(users.id, userId));
      }
    } catch (error) {
      console.error("Error handling subscription deleted:", error);
    }
  }

  private async handleInvoicePaid(invoice: any) {
    try {
      // Update payment record if exists
      await db.update(payments)
        .set({
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(payments.stripePaymentIntentId, invoice.payment_intent));
    } catch (error) {
      console.error("Error handling invoice paid:", error);
    }
  }

  private async handleInvoicePaymentFailed(invoice: any) {
    try {
      // Update payment record
      await db.update(payments)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(payments.stripePaymentIntentId, invoice.payment_intent));
    } catch (error) {
      console.error("Error handling invoice payment failed:", error);
    }
  }
}