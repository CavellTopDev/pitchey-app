import Stripe from "npm:stripe";
import { db } from "../db/client.ts";
import { 
  users, 
  transactions, 
  payments, 
  creditTransactions, 
  userCredits, 
  subscriptionHistory,
  paymentMethods 
} from "../db/schema.ts";
import { eq } from "npm:drizzle-orm";
import { getTierFromPriceId, getCreditsFromPriceId, SUBSCRIPTION_TIERS } from "../../utils/stripe.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "sk_test_...", {
  apiVersion: "2023-10-16",
});

export const SUBSCRIPTION_PRICES = {
  creator: "price_creator_monthly", // €100/year or €10/pitch
  pro: "price_pro_monthly", // €200/year
  investor: "price_investor_monthly", // €200/year
};

export class StripeService {
  static async createCustomer(userId: number, email: string) {
    const customer = await stripe.customers.create({
      email,
      metadata: { userId: String(userId) },
    });
    
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
    }
    
    const subscription = await stripe.subscriptions.create({
      customer: user!.stripeCustomerId!,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
    });
    
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
    
    const subscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      { cancel_at_period_end: true }
    );
    
    return subscription;
  }
  
  static async createCheckoutSession(userId: number, priceId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    const session = await stripe.checkout.sessions.create({
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
    
    const session = await stripe.checkout.sessions.create({
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
    
    // Update payment record with Stripe session ID
    await db.update(payments)
      .set({ stripeSessionId: session.id })
      .where(eq(payments.id, payment[0].id));
    
    return session;
  }
  
  static async handleWebhook(payload: string, signature: string) {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
    
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
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
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
    await db.insert(subscriptionHistory).values({
      userId,
      tier: tier as any || "PRO",
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      startDate: new Date(subscription.current_period_start * 1000),
      endDate: new Date(subscription.current_period_end * 1000),
      status: "active",
      amount: String(subscription.items.data[0]?.price.unit_amount || 0),
      currency: subscription.currency,
      billingInterval: subscription.items.data[0]?.price.recurring?.interval || "monthly",
    });
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
      const customer = await stripe.customers.retrieve(invoice.customer);
      const userId = parseInt((customer as any).metadata.userId);
      
      if (invoice.subscription) {
        // Update subscription
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        
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
      const customer = await stripe.customers.retrieve(subscription.customer);
      const userId = parseInt((customer as any).metadata.userId);
      const priceId = subscription.items.data[0]?.price.id;
      const tier = getTierFromPriceId(priceId);
      
      // Create subscription history record
      await db.insert(subscriptionHistory).values({
        userId,
        tier: tier as any || "PRO",
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        startDate: new Date(subscription.current_period_start * 1000),
        endDate: new Date(subscription.current_period_end * 1000),
        status: subscription.status,
        amount: String(subscription.items.data[0]?.price.unit_amount || 0),
        currency: subscription.currency,
        billingInterval: subscription.items.data[0]?.price.recurring?.interval || "monthly",
      });
      
    } catch (error) {
      console.error("Error handling subscription created:", error);
    }
  }
  
  private static async handleSubscriptionUpdated(subscription: any) {
    try {
      const customer = await stripe.customers.retrieve(subscription.customer);
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
      const customer = await stripe.customers.retrieve(subscription.customer);
      const userId = parseInt((customer as any).metadata.userId);
      
      await db.update(users)
        .set({
          subscriptionTier: "free",
          stripeSubscriptionId: null,
        })
        .where(eq(users.id, userId));
      
      // Update subscription history
      await db.update(subscriptionHistory)
        .set({
          status: "canceled",
          endDate: new Date(),
          canceledAt: new Date(),
        })
        .where(eq(subscriptionHistory.stripeSubscriptionId, subscription.id));
        
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
      const customer = await stripe.customers.retrieve(paymentMethod.customer);
      const userId = parseInt((customer as any).metadata.userId);
      
      // Check if this payment method is already stored
      const existingPaymentMethod = await db.query.paymentMethods.findFirst({
        where: eq(paymentMethods.stripePaymentMethodId, paymentMethod.id),
      });
      
      if (!existingPaymentMethod) {
        // Store payment method details
        await db.insert(paymentMethods).values({
          userId,
          stripePaymentMethodId: paymentMethod.id,
          stripeCustomerId: paymentMethod.customer,
          type: paymentMethod.type,
          cardBrand: paymentMethod.card?.brand,
          cardLast4: paymentMethod.card?.last4,
          cardExpMonth: paymentMethod.card?.exp_month,
          cardExpYear: paymentMethod.card?.exp_year,
          isDefault: false,
          isActive: true,
        });
      }
      
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
}