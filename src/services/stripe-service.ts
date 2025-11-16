// Stripe Payment Service
// Provides comprehensive payment processing, subscription management, and webhook handling

import Stripe from "stripe";
import { db } from "../db/client.ts";
import { users, payments, subscriptionHistory, paymentMethods, transactions } from "../db/schema.ts";
import { eq, and } from "drizzle-orm";

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  interval: "month" | "year";
  features: string[];
  stripePriceId: string;
  userType: "creator" | "investor" | "production";
}

// Subscription tier definitions
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "creator_basic",
    name: "Creator Basic",
    price: 29,
    interval: "month",
    features: [
      "Upload up to 3 pitches",
      "Basic analytics",
      "Standard support",
      "Basic NDA templates"
    ],
    stripePriceId: Deno.env.get("STRIPE_PRICE_CREATOR_BASIC") || "price_creator_basic",
    userType: "creator"
  },
  {
    id: "creator_pro",
    name: "Creator Pro", 
    price: 99,
    interval: "month",
    features: [
      "Unlimited pitches",
      "Advanced analytics",
      "Priority support",
      "Custom NDA templates",
      "Video pitch hosting",
      "Collaboration tools"
    ],
    stripePriceId: Deno.env.get("STRIPE_PRICE_CREATOR_PRO") || "price_creator_pro",
    userType: "creator"
  },
  {
    id: "investor",
    name: "Investor Access",
    price: 199,
    interval: "month", 
    features: [
      "Full pitch database access",
      "Advanced search & filters",
      "Investment tracking",
      "Portfolio analytics",
      "Direct messaging",
      "Deal flow management"
    ],
    stripePriceId: Deno.env.get("STRIPE_PRICE_INVESTOR") || "price_investor",
    userType: "investor"
  },
  {
    id: "production",
    name: "Production Company",
    price: 499,
    interval: "month",
    features: [
      "Enterprise dashboard",
      "Team collaboration",
      "Advanced screening tools", 
      "Custom workflows",
      "White-label options",
      "Dedicated support"
    ],
    stripePriceId: Deno.env.get("STRIPE_PRICE_PRODUCTION") || "price_production",
    userType: "production"
  }
];

export class StripeService {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor() {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.warn("⚠️ STRIPE_SECRET_KEY not configured - payment features disabled");
      // Initialize with dummy values to prevent crashes
      // @ts-ignore - Using null for disabled Stripe
      this.stripe = null;
      this.webhookSecret = "";
      return;
    }
    
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20"
    });
    
    this.webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  }

  // Create or retrieve Stripe customer
  async createOrGetCustomer(userId: number, email: string, name?: string): Promise<string> {
    if (!this.stripe) {
      throw new Error("Stripe is not configured - payment features are disabled");
    }
    try {
      // Check if user already has a Stripe customer ID
      const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (existingUser[0]?.stripeCustomerId) {
        // Verify customer exists in Stripe
        try {
          await this.stripe.customers.retrieve(existingUser[0].stripeCustomerId);
          return existingUser[0].stripeCustomerId;
        } catch (error) {
          console.warn("Stripe customer not found, creating new one:", error);
        }
      }

      // Create new Stripe customer
      const customer = await this.stripe.customers.create({
        email,
        name: name || email.split("@")[0],
        metadata: {
          userId: userId.toString()
        }
      });

      // Update user record with Stripe customer ID
      await db.update(users)
        .set({ stripeCustomerId: customer.id })
        .where(eq(users.id, userId));

      return customer.id;
    } catch (error) {
      console.error("Error creating/getting Stripe customer:", error);
      throw new Error("Failed to create customer");
    }
  }

  // Create subscription
  async createSubscription(userId: number, tierID: string, paymentMethodId?: string): Promise<{ 
    subscription: Stripe.Subscription, 
    clientSecret?: string 
  }> {
    try {
      const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierID);
      if (!tier) {
        throw new Error("Invalid subscription tier");
      }

      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user[0]) {
        throw new Error("User not found");
      }

      const customerId = await this.createOrGetCustomer(userId, user[0].email, 
        `${user[0].firstName} ${user[0].lastName}`);

      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{
          price: tier.stripePriceId
        }],
        metadata: {
          userId: userId.toString(),
          tierID: tierID
        },
        expand: ["latest_invoice.payment_intent"],
        billing_cycle_anchor: Math.floor(Date.now() / 1000) + 86400 // Start tomorrow
      };

      if (paymentMethodId) {
        subscriptionData.default_payment_method = paymentMethodId;
      } else {
        subscriptionData.payment_behavior = "default_incomplete";
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionData);

      // Record subscription in database
      await this.recordSubscriptionHistory(userId, {
        action: "create",
        newTier: tierID,
        stripeSubscriptionId: subscription.id,
        stripePriceId: tier.stripePriceId,
        amount: tier.price,
        currency: "usd",
        billingInterval: tier.interval,
        status: subscription.status,
        periodStart: new Date(subscription.current_period_start * 1000),
        periodEnd: new Date(subscription.current_period_end * 1000)
      });

      // Update user subscription
      await db.update(users)
        .set({
          subscriptionTier: tierID,
          stripeSubscriptionId: subscription.id,
          subscriptionStartDate: new Date(subscription.current_period_start * 1000),
          subscriptionEndDate: new Date(subscription.current_period_end * 1000)
        })
        .where(eq(users.id, userId));

      let clientSecret: string | undefined;
      if (subscription.latest_invoice && typeof subscription.latest_invoice === "object") {
        const paymentIntent = subscription.latest_invoice.payment_intent;
        if (paymentIntent && typeof paymentIntent === "object") {
          clientSecret = paymentIntent.client_secret || undefined;
        }
      }

      return { subscription, clientSecret };
    } catch (error) {
      console.error("Error creating subscription:", error);
      throw new Error("Failed to create subscription");
    }
  }

  // Create one-time payment checkout session
  async createCheckoutSession(
    userId: number, 
    amount: number, 
    description: string,
    successUrl: string,
    cancelUrl: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Checkout.Session> {
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user[0]) {
        throw new Error("User not found");
      }

      const customerId = await this.createOrGetCustomer(userId, user[0].email);

      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: description
            },
            unit_amount: Math.round(amount * 100) // Convert to cents
          },
          quantity: 1
        }],
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: userId.toString(),
          type: "one_time_payment",
          ...metadata
        }
      });

      // Record payment intent
      await db.insert(payments).values({
        userId,
        stripeSessionId: session.id,
        type: "one_time",
        amount: amount.toString(),
        currency: "usd",
        status: "pending",
        description,
        metadata: metadata || {}
      });

      return session;
    } catch (error) {
      console.error("Error creating checkout session:", error);
      throw new Error("Failed to create checkout session");
    }
  }

  // Process investment transaction with success fee
  async processInvestmentTransaction(
    investorId: number,
    creatorId: number,
    pitchId: number,
    investmentAmount: number
  ): Promise<{ transferId: string, feeAmount: number }> {
    try {
      const successFeeRate = 0.025; // 2.5% success fee
      const feeAmount = investmentAmount * successFeeRate;
      const creatorAmount = investmentAmount - feeAmount;

      // Get creator's Stripe customer ID
      const creator = await db.select().from(users).where(eq(users.id, creatorId)).limit(1);
      if (!creator[0]?.stripeCustomerId) {
        throw new Error("Creator must have payment account setup");
      }

      // Create payment intent for investment
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(investmentAmount * 100),
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        application_fee_amount: Math.round(feeAmount * 100),
        transfer_data: {
          destination: creator[0].stripeCustomerId
        },
        metadata: {
          type: "investment",
          investorId: investorId.toString(),
          creatorId: creatorId.toString(),
          pitchId: pitchId.toString(),
          feeAmount: feeAmount.toString(),
          creatorAmount: creatorAmount.toString()
        }
      });

      // Record transaction
      await db.insert(transactions).values({
        userId: investorId,
        transactionType: "investment",
        amount: investmentAmount.toString(),
        description: `Investment in pitch ${pitchId}`,
        metadata: {
          pitchId,
          creatorId,
          feeAmount,
          paymentIntentId: paymentIntent.id
        }
      });

      return {
        transferId: paymentIntent.id,
        feeAmount
      };
    } catch (error) {
      console.error("Error processing investment transaction:", error);
      throw new Error("Failed to process investment transaction");
    }
  }

  // Cancel subscription
  async cancelSubscription(userId: number): Promise<void> {
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user[0]?.stripeSubscriptionId) {
        throw new Error("No active subscription found");
      }

      const subscription = await this.stripe.subscriptions.update(user[0].stripeSubscriptionId, {
        cancel_at_period_end: true
      });

      // Record cancellation
      await this.recordSubscriptionHistory(userId, {
        action: "cancel",
        previousTier: user[0].subscriptionTier || "free",
        newTier: "free",
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        periodStart: new Date(subscription.current_period_start * 1000),
        periodEnd: new Date(subscription.current_period_end * 1000)
      });

      // Update user record to reflect cancellation
      await db.update(users)
        .set({
          subscriptionTier: "free",
          stripeSubscriptionId: null
        })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error("Error canceling subscription:", error);
      throw new Error("Failed to cancel subscription");
    }
  }

  // Get user's invoices
  async getUserInvoices(userId: number, limit = 10): Promise<Stripe.Invoice[]> {
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user[0]?.stripeCustomerId) {
        return [];
      }

      const invoices = await this.stripe.invoices.list({
        customer: user[0].stripeCustomerId,
        limit
      });

      return invoices.data;
    } catch (error) {
      console.error("Error fetching user invoices:", error);
      throw new Error("Failed to fetch invoices");
    }
  }

  // Handle Stripe webhook
  async handleWebhook(body: string, signature: string): Promise<void> {
    try {
      const event = this.stripe.webhooks.constructEvent(body, signature, this.webhookSecret);

      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
          break;

        case "customer.subscription.deleted":
          await this.handleSubscriptionCancellation(event.data.object as Stripe.Subscription);
          break;

        case "invoice.payment_succeeded":
          await this.handlePaymentSuccess(event.data.object as Stripe.Invoice);
          break;

        case "invoice.payment_failed":
          await this.handlePaymentFailure(event.data.object as Stripe.Invoice);
          break;

        case "payment_intent.succeeded":
          await this.handlePaymentIntentSuccess(event.data.object as Stripe.PaymentIntent);
          break;

        case "payment_method.attached":
          await this.handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error("Error handling webhook:", error);
      throw new Error("Webhook handling failed");
    }
  }

  // Private helper methods
  private async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    const userId = parseInt(subscription.metadata.userId);
    if (!userId) return;

    const tierID = subscription.metadata.tierID;
    const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierID);

    await db.update(users)
      .set({
        subscriptionTier: tierID || "free",
        stripeSubscriptionId: subscription.id,
        subscriptionStartDate: new Date(subscription.current_period_start * 1000),
        subscriptionEndDate: new Date(subscription.current_period_end * 1000)
      })
      .where(eq(users.id, userId));

    if (tier) {
      await this.recordSubscriptionHistory(userId, {
        action: "update",
        newTier: tierID,
        stripeSubscriptionId: subscription.id,
        stripePriceId: tier.stripePriceId,
        amount: tier.price,
        currency: "usd",
        billingInterval: tier.interval,
        status: subscription.status,
        periodStart: new Date(subscription.current_period_start * 1000),
        periodEnd: new Date(subscription.current_period_end * 1000)
      });
    }
  }

  private async handleSubscriptionCancellation(subscription: Stripe.Subscription): Promise<void> {
    const userId = parseInt(subscription.metadata.userId);
    if (!userId) return;

    await db.update(users)
      .set({
        subscriptionTier: "free",
        stripeSubscriptionId: null
      })
      .where(eq(users.id, userId));

    await this.recordSubscriptionHistory(userId, {
      action: "cancel",
      newTier: "free",
      stripeSubscriptionId: subscription.id,
      status: "canceled",
      periodStart: new Date(subscription.current_period_start * 1000),
      periodEnd: new Date(subscription.current_period_end * 1000)
    });
  }

  private async handlePaymentSuccess(invoice: Stripe.Invoice): Promise<void> {
    if (typeof invoice.customer !== "string") return;

    await db.update(payments)
      .set({ 
        status: "completed",
        completedAt: new Date(),
        stripeInvoiceId: invoice.id
      })
      .where(eq(payments.stripeInvoiceId, invoice.id));
  }

  private async handlePaymentFailure(invoice: Stripe.Invoice): Promise<void> {
    await db.update(payments)
      .set({ 
        status: "failed",
        failedAt: new Date(),
        failureReason: "Payment failed"
      })
      .where(eq(payments.stripeInvoiceId, invoice.id));
  }

  private async handlePaymentIntentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    await db.update(payments)
      .set({
        status: "completed",
        completedAt: new Date()
      })
      .where(eq(payments.stripePaymentIntentId, paymentIntent.id));
  }

  private async handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    if (typeof paymentMethod.customer !== "string") return;

    // Find user by Stripe customer ID
    const user = await db.select().from(users)
      .where(eq(users.stripeCustomerId, paymentMethod.customer))
      .limit(1);

    if (!user[0]) return;

    // Store payment method
    await db.insert(paymentMethods).values({
      userId: user[0].id,
      stripePaymentMethodId: paymentMethod.id,
      stripeCustomerId: paymentMethod.customer,
      type: paymentMethod.type,
      brand: paymentMethod.card?.brand,
      lastFour: paymentMethod.card?.last4,
      expMonth: paymentMethod.card?.exp_month,
      expYear: paymentMethod.card?.exp_year
    });
  }

  private async recordSubscriptionHistory(userId: number, data: {
    action: string;
    previousTier?: string;
    newTier: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    amount?: number;
    currency?: string;
    billingInterval?: string;
    status: string;
    periodStart?: Date;
    periodEnd?: Date;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await db.insert(subscriptionHistory).values({
      userId,
      previousTier: data.previousTier || null,
      newTier: data.newTier,
      action: data.action,
      stripeSubscriptionId: data.stripeSubscriptionId || null,
      stripePriceId: data.stripePriceId || null,
      amount: data.amount ? data.amount.toString() : null,
      currency: data.currency || "usd",
      billingInterval: data.billingInterval || null,
      status: data.status,
      periodStart: data.periodStart || null,
      periodEnd: data.periodEnd || null,
      metadata: data.metadata || {}
    });
  }
}

// Singleton instance
export const stripeService = new StripeService();