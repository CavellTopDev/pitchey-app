import Stripe from "npm:stripe";
import { db } from "../db/client.ts";
import { 
  users, 
  transactions, 
  payments, 
  creditTransactions, 
  userCredits
} from "../db/schema.ts";
import { eq } from "npm:drizzle-orm";
import { getTierFromPriceId, getCreditsFromPriceId, SUBSCRIPTION_TIERS } from "../../utils/stripe.ts";
import { getMockStripeService, shouldUseMockStripe } from "./stripe-mock.service.ts";

// Initialize real Stripe only if we have valid credentials
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "sk_test_...";
const stripe = shouldUseMockStripe() ? null : new Stripe(stripeKey, {
  apiVersion: "2023-10-16",
});

// Get mock service instance
const mockStripe = getMockStripeService({
  enabled: shouldUseMockStripe(),
  logPayments: true,
  simulateErrors: false,
  errorRate: 0
});

export const SUBSCRIPTION_PRICES = {
  creator: "price_creator_monthly", // €100/year or €10/pitch
  pro: "price_pro_monthly", // €200/year
  investor: "price_investor_monthly", // €200/year
};

export class StripeService {
  static async createCustomer(userId: number, email: string) {
    let customer;
    
    if (shouldUseMockStripe()) {
      customer = await mockStripe.createCustomer({
        email,
        metadata: { userId: String(userId) }
      });
    } else {
      customer = await stripe!.customers.create({
        email,
        metadata: { userId: String(userId) },
      });
    }
    
    await db.update(users)
      .set({ stripeCustomerId: customer.id })
      .where(eq(users.id, userId));
    
    return customer;
  }
  
  static async createSubscription(userId: number, priceId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    if (!user?.stripeCustomerId) {
      await this.createCustomer(userId, user!.email);
      // Refetch user to get the updated stripeCustomerId
      const updatedUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      user!.stripeCustomerId = updatedUser!.stripeCustomerId;
    }
    
    let subscription;
    
    if (shouldUseMockStripe()) {
      subscription = await mockStripe.createSubscription({
        customer: user!.stripeCustomerId!,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
      });
    } else {
      subscription = await stripe!.subscriptions.create({
        customer: user!.stripeCustomerId!,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
      });
    }
    
    await db.update(users)
      .set({
        stripeSubscriptionId: subscription.id,
        subscriptionTier: this.getTierFromPriceId(priceId),
        subscriptionStartDate: new Date(subscription.current_period_start * 1000),
        subscriptionEndDate: new Date(subscription.current_period_end * 1000),
      })
      .where(eq(users.id, userId));
    
    return subscription;
  }
  
  static async cancelSubscription(userId: number) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    if (!user?.stripeSubscriptionId) {
      throw new Error("No active subscription");
    }
    
    let subscription;
    
    if (shouldUseMockStripe()) {
      subscription = await mockStripe.updateSubscription(
        user.stripeSubscriptionId,
        { cancel_at_period_end: true }
      );
    } else {
      subscription = await stripe!.subscriptions.update(
        user.stripeSubscriptionId,
        { cancel_at_period_end: true }
      );
    }
    
    return subscription;
  }
  
  static async createCheckoutSession(userId: number, priceId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    let session;
    
    if (shouldUseMockStripe()) {
      session = await mockStripe.createCheckoutSession({
        customer: user?.stripeCustomerId || undefined,
        customer_email: user?.stripeCustomerId ? undefined : user?.email,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${Deno.env.get("APP_URL")}/dashboard?success=true`,
        cancel_url: `${Deno.env.get("APP_URL")}/pricing?canceled=true`,
        metadata: {
          userId: String(userId),
        },
      });
    } else {
      session = await stripe!.checkout.sessions.create({
        customer: user?.stripeCustomerId || undefined,
        customer_email: user?.stripeCustomerId ? undefined : user?.email,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${Deno.env.get("APP_URL")}/dashboard?success=true`,
        cancel_url: `${Deno.env.get("APP_URL")}/pricing?canceled=true`,
        metadata: {
          userId: String(userId),
        },
      });
    }
    
    return session;
  }

  static async createCreditsCheckoutSession(userId: number, priceId: string, credits: number, packageType: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    // Create payment record
    const payment = await db.insert(payments).values({
      userId,
      type: "credits",
      amount: String(getCreditsFromPriceId(priceId) * 10), // Store in cents equivalent
      currency: "USD",
      status: "pending",
      description: `Credit purchase: ${credits} credits (${packageType} package)`,
      metadata: {
        creditAmount: credits,
        originalAmount: String(credits * 10), // Store original amount
      },
    }).returning();
    
    let session;
    
    if (shouldUseMockStripe()) {
      session = await mockStripe.createCheckoutSession({
        customer: user?.stripeCustomerId || undefined,
        customer_email: user?.stripeCustomerId ? undefined : user?.email,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${Deno.env.get("APP_URL")}/dashboard?success=true&type=credits`,
        cancel_url: `${Deno.env.get("APP_URL")}/pricing?canceled=true`,
        metadata: {
          userId: String(userId),
          credits: String(credits),
          package: packageType,
          paymentId: String(payment[0].id),
        },
      });
    } else {
      session = await stripe!.checkout.sessions.create({
        customer: user?.stripeCustomerId || undefined,
        customer_email: user?.stripeCustomerId ? undefined : user?.email,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${Deno.env.get("APP_URL")}/dashboard?success=true&type=credits`,
        cancel_url: `${Deno.env.get("APP_URL")}/pricing?canceled=true`,
        metadata: {
          userId: String(userId),
          credits: String(credits),
          package: packageType,
          paymentId: String(payment[0].id),
        },
      });
    }
    
    // Update payment record with Stripe session ID
    await db.update(payments)
      .set({ stripeSessionId: session.id })
      .where(eq(payments.id, payment[0].id));
    
    return session;
  }
  
  static async handleWebhook(payload: string, signature: string) {
    let event;
    
    if (shouldUseMockStripe()) {
      // For mock Stripe, we create a mock event from the payload
      event = mockStripe.constructEvent(
        payload,
        signature,
        Deno.env.get("STRIPE_WEBHOOK_SECRET") || "mock_webhook_secret"
      );
    } else {
      event = stripe!.webhooks.constructEvent(
        payload,
        signature,
        Deno.env.get("STRIPE_WEBHOOK_SECRET")!
      );
    }
    
    console.log(`Processing webhook event: ${event.type}`);
    
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutComplete(event.data.object as any);
        break;
      case "invoice.paid":
        await this.handleInvoicePaid(event.data.object as any);
        break;
      case "invoice.payment_failed":
        await this.handleInvoicePaymentFailed(event.data.object as any);
        break;
      case "customer.subscription.created":
        await this.handleSubscriptionCreated(event.data.object as any);
        break;
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(event.data.object as any);
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(event.data.object as any);
        break;
      case "payment_intent.succeeded":
        await this.handlePaymentIntentSucceeded(event.data.object as any);
        break;
      case "payment_intent.payment_failed":
        await this.handlePaymentIntentFailed(event.data.object as any);
        break;
      case "payment_method.attached":
        await this.handlePaymentMethodAttached(event.data.object as any);
        break;
      case "customer.created":
        await this.handleCustomerCreated(event.data.object as any);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }
  
  private static async handleCheckoutComplete(session: any) {
    try {
      const userId = parseInt(session.metadata.userId);
      
      if (session.mode === "subscription") {
        // Handle subscription checkout
        await this.handleSubscriptionCheckout(session, userId);
      } else if (session.mode === "payment") {
        // Handle one-time payment (credits)
        await this.handleCreditsCheckout(session, userId);
      }
      
      // Update payment record
      await db.update(payments)
        .set({
          status: "completed",
          stripePaymentIntentId: session.payment_intent,
          completedAt: new Date(),
        })
        .where(eq(payments.stripeSessionId, session.id));
        
    } catch (error) {
      console.error("Error handling checkout complete:", error);
    }
  }
  
  private static async handleSubscriptionCheckout(session: any, userId: number) {
    // Get subscription details
    let subscription;
    if (shouldUseMockStripe()) {
      subscription = await mockStripe.retrieveSubscription(session.subscription);
    } else {
      subscription = await stripe!.subscriptions.retrieve(session.subscription);
    }
    const priceId = subscription.items.data[0]?.price.id;
    const tier = getTierFromPriceId(priceId);
    
    // Update user subscription
    await db.update(users)
      .set({
        stripeSubscriptionId: subscription.id,
        subscriptionTier: tier as any || "free",
        subscriptionStartDate: new Date(subscription.current_period_start * 1000),
        subscriptionEndDate: new Date(subscription.current_period_end * 1000),
      })
      .where(eq(users.id, userId));
    
    // Create subscription history record
    // TODO: Implement subscription history table
    console.log(`[Mock Stripe] Subscription created for user ${userId}: ${subscription.id}`);
  }
  
  private static async handleCreditsCheckout(session: any, userId: number) {
    const credits = parseInt(session.metadata.credits || "0");
    const packageType = session.metadata.package;
    
    if (credits > 0) {
      // Get or create user credits record
      let userCreditsRecord = await db.query.userCredits.findFirst({
        where: eq(userCredits.userId, userId),
      });
      
      if (!userCreditsRecord) {
        await db.insert(userCredits).values({
          userId,
          balance: 0,
          totalPurchased: 0,
          totalUsed: 0,
        });
        
        userCreditsRecord = {
          id: 0,
          userId,
          balance: 0,
          totalPurchased: 0,
          totalUsed: 0,
          lastUpdated: new Date(),
        };
      }
      
      const newBalance = userCreditsRecord.balance + credits;
      const newTotalPurchased = userCreditsRecord.totalPurchased + credits;
      
      // Update credits balance
      await db.update(userCredits)
        .set({
          balance: newBalance,
          totalPurchased: newTotalPurchased,
          lastUpdated: new Date(),
        })
        .where(eq(userCredits.userId, userId));
      
      // Create credit transaction
      const paymentRecord = await db.query.payments.findFirst({
        where: eq(payments.stripeSessionId, session.id),
      });
      
      await db.insert(creditTransactions).values({
        userId,
        paymentId: paymentRecord?.id,
        type: "purchase",
        amount: credits,
        description: `Purchased ${credits} credits (${packageType} package)`,
        balanceBefore: userCreditsRecord.balance,
        balanceAfter: newBalance,
        metadata: {
          packageType,
          originalPrice: String(session.amount_total),
        },
      });
    }
  }
  
  private static async handleInvoicePaid(invoice: any) {
    try {
      let customer;
      if (shouldUseMockStripe()) {
        customer = await mockStripe.retrieveCustomer(invoice.customer);
      } else {
        customer = await stripe!.customers.retrieve(invoice.customer);
      }
      const userId = parseInt((customer as any).metadata.userId);
      
      if (invoice.subscription) {
        // Update subscription
        let subscription;
        if (shouldUseMockStripe()) {
          subscription = await mockStripe.retrieveSubscription(invoice.subscription);
        } else {
          subscription = await stripe!.subscriptions.retrieve(invoice.subscription);
        }
        
        await db.update(users)
          .set({
            subscriptionEndDate: new Date(subscription.current_period_end * 1000),
          })
          .where(eq(users.id, userId));
      }
      
      // Update payment record
      await db.update(payments)
        .set({
          status: "completed",
          stripeInvoiceId: invoice.id,
          completedAt: new Date(),
        })
        .where(eq(payments.stripePaymentIntentId, invoice.payment_intent));
        
    } catch (error) {
      console.error("Error handling invoice paid:", error);
    }
  }
  
  private static async handleInvoicePaymentFailed(invoice: any) {
    try {
      // Update payment record
      await db.update(payments)
        .set({
          status: "failed",
          failureReason: "Invoice payment failed",
          failedAt: new Date(),
        })
        .where(eq(payments.stripeInvoiceId, invoice.id));
        
    } catch (error) {
      console.error("Error handling invoice payment failed:", error);
    }
  }
  
  private static async handleSubscriptionCreated(subscription: any) {
    try {
      let customer;
      if (shouldUseMockStripe()) {
        customer = await mockStripe.retrieveCustomer(subscription.customer);
      } else {
        customer = await stripe!.customers.retrieve(subscription.customer);
      }
      const userId = parseInt((customer as any).metadata.userId);
      const priceId = subscription.items.data[0]?.price.id;
      const tier = getTierFromPriceId(priceId);
      
      // Create subscription history record
      // TODO: Implement subscription history table
      console.log(`[Mock Stripe] Subscription history created for user ${userId}: ${subscription.id}`);
      
    } catch (error) {
      console.error("Error handling subscription created:", error);
    }
  }
  
  private static async handleSubscriptionUpdated(subscription: any) {
    try {
      let customer;
      if (shouldUseMockStripe()) {
        customer = await mockStripe.retrieveCustomer(subscription.customer);
      } else {
        customer = await stripe!.customers.retrieve(subscription.customer);
      }
      const userId = parseInt((customer as any).metadata.userId);
      
      // Update user subscription details
      await db.update(users)
        .set({
          subscriptionEndDate: new Date(subscription.current_period_end * 1000),
        })
        .where(eq(users.id, userId));
        
    } catch (error) {
      console.error("Error handling subscription updated:", error);
    }
  }
  
  private static async handleSubscriptionDeleted(subscription: any) {
    try {
      let customer;
      if (shouldUseMockStripe()) {
        customer = await mockStripe.retrieveCustomer(subscription.customer);
      } else {
        customer = await stripe!.customers.retrieve(subscription.customer);
      }
      const userId = parseInt((customer as any).metadata.userId);
      
      await db.update(users)
        .set({
          subscriptionTier: "free",
          stripeSubscriptionId: null,
        })
        .where(eq(users.id, userId));
      
      // Update subscription history
      // TODO: Implement subscription history table
      console.log(`[Mock Stripe] Subscription canceled for user ${userId}: ${subscription.id}`);
        
    } catch (error) {
      console.error("Error handling subscription deleted:", error);
    }
  }
  
  private static async handlePaymentIntentSucceeded(paymentIntent: any) {
    try {
      // Update payment record
      await db.update(payments)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(payments.stripePaymentIntentId, paymentIntent.id));
        
    } catch (error) {
      console.error("Error handling payment intent succeeded:", error);
    }
  }
  
  private static async handlePaymentIntentFailed(paymentIntent: any) {
    try {
      // Update payment record
      await db.update(payments)
        .set({
          status: "failed",
          failureReason: paymentIntent.last_payment_error?.message || "Payment failed",
          failedAt: new Date(),
        })
        .where(eq(payments.stripePaymentIntentId, paymentIntent.id));
        
    } catch (error) {
      console.error("Error handling payment intent failed:", error);
    }
  }
  
  private static async handlePaymentMethodAttached(paymentMethod: any) {
    try {
      // Get customer and user
      let customer;
      if (shouldUseMockStripe()) {
        customer = await mockStripe.retrieveCustomer(paymentMethod.customer);
      } else {
        customer = await stripe!.customers.retrieve(paymentMethod.customer);
      }
      const userId = parseInt((customer as any).metadata.userId);
      
      // Store payment method details
      // TODO: Implement payment methods table
      console.log(`[Mock Stripe] Payment method attached for user ${userId}: ${paymentMethod.id}`);
      
    } catch (error) {
      console.error("Error handling payment method attached:", error);
    }
  }
  
  private static async handleCustomerCreated(customer: any) {
    try {
      const userId = parseInt(customer.metadata.userId);
      
      // Update user with Stripe customer ID
      await db.update(users)
        .set({ stripeCustomerId: customer.id })
        .where(eq(users.id, userId));
        
    } catch (error) {
      console.error("Error handling customer created:", error);
    }
  }
  
  private static getTierFromPriceId(priceId: string): any {
    switch (priceId) {
      case SUBSCRIPTION_PRICES.creator:
        return "creator";
      case SUBSCRIPTION_PRICES.pro:
        return "pro";
      case SUBSCRIPTION_PRICES.investor:
        return "investor";
      default:
        return "free";
    }
  }

  static async getUserCredits(userId: number) {
    try {
      const userCredit = await db.query.userCredits.findFirst({
        where: eq(userCredits.userId, userId)
      });

      return {
        credits: userCredit?.balance || 0,
        tier: "free"
      };
    } catch (error) {
      console.error("Error getting user credits:", error);
      return {
        credits: 0,
        tier: "free"
      };
    }
  }

  static async getSubscriptionStatus(userId: number) {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      return {
        status: "active",
        tier: user?.subscriptionTier || "free",
        creditsRemaining: 100
      };
    } catch (error) {
      console.error("Error getting subscription status:", error);
      return {
        status: "inactive",
        tier: "free",
        creditsRemaining: 0
      };
    }
  }

  static async createPaymentIntent(data: {
    userId: number;
    amount: number;
    currency: string;
    type: string;
  }) {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, data.userId)
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Create payment intent with Stripe (real or mock)
      let paymentIntent;
      if (shouldUseMockStripe()) {
        paymentIntent = await mockStripe.createPaymentIntent({
          amount: Math.round(data.amount * 100), // Convert to cents
          currency: data.currency.toLowerCase(),
          metadata: {
            userId: data.userId.toString(),
            type: data.type
          }
        });
      } else {
        paymentIntent = await stripe!.paymentIntents.create({
          amount: Math.round(data.amount * 100), // Convert to cents
          currency: data.currency.toLowerCase(),
          metadata: {
            userId: data.userId.toString(),
            type: data.type
          }
        });
      }

      // Store payment record
      await db.insert(payments).values({
        userId: data.userId,
        type: data.type as any,
        amount: data.amount.toString(),
        currency: data.currency,
        stripePaymentIntentId: paymentIntent.id,
        status: "pending"
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      };
    } catch (error) {
      console.error("Error creating payment intent:", error);
      throw error;
    }
  }
}