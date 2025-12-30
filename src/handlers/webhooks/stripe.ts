import { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import Stripe from "stripe";

/**
 * Stripe Webhook Handler
 * Processes all Stripe webhook events for payments, subscriptions, and Connect accounts
 */

export class StripeWebhookHandler {
  private stripe: Stripe;

  constructor() {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "sk_test_dummy";
    this.stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });
  }

  /**
   * POST /api/webhooks/stripe
   * Main webhook endpoint
   */
  async handleWebhook(c: Context) {
    try {
      const signature = c.req.header('stripe-signature');
      if (!signature) {
        return c.json({ error: "Missing signature" }, 400);
      }

      const body = await c.req.text();
      const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

      // Verify webhook signature
      let event: Stripe.Event;
      try {
        event = this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return c.json({ error: "Invalid signature" }, 400);
      }

      console.log(`Processing webhook event: ${event.type}`);

      // Handle different event types
      switch (event.type) {
        // Payment events
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(c, event.data.object as Stripe.PaymentIntent);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(c, event.data.object as Stripe.PaymentIntent);
          break;

        // Checkout events
        case 'checkout.session.completed':
          await this.handleCheckoutComplete(c, event.data.object as Stripe.Checkout.Session);
          break;

        // Subscription events
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(c, event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(c, event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(c, event.data.object as Stripe.Subscription);
          break;

        // Invoice events
        case 'invoice.paid':
          await this.handleInvoicePaid(c, event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(c, event.data.object as Stripe.Invoice);
          break;

        // Connect account events
        case 'account.updated':
          await this.handleAccountUpdated(c, event.data.object as Stripe.Account);
          break;

        case 'account.application.authorized':
          await this.handleAccountAuthorized(c, event.data.object);
          break;

        case 'account.application.deauthorized':
          await this.handleAccountDeauthorized(c, event.data.object);
          break;

        // Transfer events (for payouts)
        case 'transfer.created':
          await this.handleTransferCreated(c, event.data.object as Stripe.Transfer);
          break;

        case 'transfer.paid':
          await this.handleTransferPaid(c, event.data.object as Stripe.Transfer);
          break;

        case 'transfer.failed':
          await this.handleTransferFailed(c, event.data.object as Stripe.Transfer);
          break;

        // Payout events
        case 'payout.created':
          await this.handlePayoutCreated(c, event.data.object as Stripe.Payout);
          break;

        case 'payout.paid':
          await this.handlePayoutPaid(c, event.data.object as Stripe.Payout);
          break;

        case 'payout.failed':
          await this.handlePayoutFailed(c, event.data.object as Stripe.Payout);
          break;

        // Refund events
        case 'charge.refunded':
          await this.handleChargeRefunded(c, event.data.object as Stripe.Charge);
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      return c.json({ received: true });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return c.json({ error: "Webhook processing failed" }, 500);
    }
  }

  private async handlePaymentIntentSucceeded(c: Context, paymentIntent: Stripe.PaymentIntent) {
    const metadata = paymentIntent.metadata;

    // Update payment transaction
    await c.env.DB.prepare(`
      UPDATE payment_transactions 
      SET status = 'completed', completed_at = datetime('now')
      WHERE provider_transaction_id = ?
    `).bind(paymentIntent.id).run();

    // If this is an investment payment
    if (metadata.type === 'investment') {
      await c.env.DB.prepare(`
        UPDATE investments 
        SET status = 'funded', funded_at = datetime('now')
        WHERE payment_transaction_id = ?
      `).bind(paymentIntent.id).run();

      // Send notification to creator
      await this.sendNotification(c, metadata.creator_id, {
        type: 'investment_received',
        title: 'New Investment Received!',
        message: `You've received a new investment of ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`,
        metadata: {
          pitch_id: metadata.pitch_id,
          investor_id: metadata.investor_id,
          amount: paymentIntent.amount,
        },
      });

      // Send confirmation to investor
      await this.sendNotification(c, metadata.investor_id, {
        type: 'investment_confirmed',
        title: 'Investment Confirmed',
        message: 'Your investment has been successfully processed',
        metadata: {
          pitch_id: metadata.pitch_id,
          amount: paymentIntent.amount,
        },
      });
    }

    // Log to audit
    await c.env.DB.prepare(`
      INSERT INTO audit_log (
        id, user_id, action, resource_type, resource_id, metadata, created_at
      )
      VALUES (?, ?, 'payment_succeeded', 'payment_intent', ?, ?, datetime('now'))
    `).bind(
      crypto.randomUUID(),
      metadata.user_id || metadata.investor_id,
      paymentIntent.id,
      JSON.stringify({ amount: paymentIntent.amount, currency: paymentIntent.currency })
    ).run();
  }

  private async handlePaymentIntentFailed(c: Context, paymentIntent: Stripe.PaymentIntent) {
    const metadata = paymentIntent.metadata;

    // Update payment transaction
    await c.env.DB.prepare(`
      UPDATE payment_transactions 
      SET status = 'failed', 
          error_message = ?,
          updated_at = datetime('now')
      WHERE provider_transaction_id = ?
    `).bind(
      paymentIntent.last_payment_error?.message || 'Payment failed',
      paymentIntent.id
    ).run();

    // Send failure notification
    await this.sendNotification(c, metadata.user_id || metadata.investor_id, {
      type: 'payment_failed',
      title: 'Payment Failed',
      message: paymentIntent.last_payment_error?.message || 'Your payment could not be processed',
      metadata: {
        payment_intent_id: paymentIntent.id,
      },
    });
  }

  private async handleCheckoutComplete(c: Context, session: Stripe.Checkout.Session) {
    const metadata = session.metadata || {};

    if (session.mode === 'subscription') {
      // Handle subscription checkout
      const subscription = await this.stripe.subscriptions.retrieve(session.subscription as string);
      const priceId = subscription.items.data[0]?.price.id;

      // Update user subscription
      await c.env.DB.prepare(`
        UPDATE users 
        SET stripe_subscription_id = ?,
            subscription_tier = ?,
            subscription_start_date = datetime(?),
            subscription_end_date = datetime(?)
        WHERE id = ?
      `).bind(
        subscription.id,
        this.getTierFromPriceId(priceId),
        new Date(subscription.current_period_start * 1000).toISOString(),
        new Date(subscription.current_period_end * 1000).toISOString(),
        metadata.userId
      ).run();
    } else if (session.mode === 'payment') {
      // Handle one-time payment (credits)
      if (metadata.credits) {
        const credits = parseInt(metadata.credits);
        
        // Update user credits
        await c.env.DB.prepare(`
          UPDATE user_credits 
          SET balance = balance + ?,
              total_purchased = total_purchased + ?,
              last_updated = datetime('now')
          WHERE user_id = ?
        `).bind(credits, credits, metadata.userId).run();

        // Record credit transaction
        await c.env.DB.prepare(`
          INSERT INTO credit_transactions (
            id, user_id, type, amount, description, created_at
          )
          VALUES (?, ?, 'purchase', ?, ?, datetime('now'))
        `).bind(
          crypto.randomUUID(),
          metadata.userId,
          credits,
          `Purchased ${credits} credits (${metadata.package} package)`
        ).run();
      }
    }

    // Update payment record
    if (metadata.paymentId) {
      await c.env.DB.prepare(`
        UPDATE payments 
        SET status = 'completed',
            completed_at = datetime('now')
        WHERE id = ?
      `).bind(metadata.paymentId).run();
    }
  }

  private async handleSubscriptionCreated(c: Context, subscription: Stripe.Subscription) {
    const customer = await this.stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
    const userId = customer.metadata.userId;
    const priceId = subscription.items.data[0]?.price.id;

    // Create subscription record
    await c.env.DB.prepare(`
      INSERT INTO subscription_history (
        id, user_id, stripe_subscription_id, tier, status,
        start_date, end_date, created_at
      )
      VALUES (?, ?, ?, ?, ?, datetime(?), datetime(?), datetime('now'))
    `).bind(
      crypto.randomUUID(),
      userId,
      subscription.id,
      this.getTierFromPriceId(priceId),
      subscription.status,
      new Date(subscription.current_period_start * 1000).toISOString(),
      new Date(subscription.current_period_end * 1000).toISOString()
    ).run();

    // Send welcome notification
    await this.sendNotification(c, userId, {
      type: 'subscription_created',
      title: 'Welcome to Pitchey Premium!',
      message: 'Your subscription is now active',
    });
  }

  private async handleSubscriptionUpdated(c: Context, subscription: Stripe.Subscription) {
    const customer = await this.stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
    const userId = customer.metadata.userId;

    // Update user subscription
    await c.env.DB.prepare(`
      UPDATE users 
      SET subscription_end_date = datetime(?)
      WHERE id = ?
    `).bind(
      new Date(subscription.current_period_end * 1000).toISOString(),
      userId
    ).run();
  }

  private async handleSubscriptionDeleted(c: Context, subscription: Stripe.Subscription) {
    const customer = await this.stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
    const userId = customer.metadata.userId;

    // Clear user subscription
    await c.env.DB.prepare(`
      UPDATE users 
      SET stripe_subscription_id = NULL,
          subscription_tier = 'free'
      WHERE id = ?
    `).bind(userId).run();

    // Send cancellation notification
    await this.sendNotification(c, userId, {
      type: 'subscription_cancelled',
      title: 'Subscription Cancelled',
      message: 'Your subscription has been cancelled',
    });
  }

  private async handleAccountUpdated(c: Context, account: Stripe.Account) {
    const userId = account.metadata?.pitchey_user_id;
    if (!userId) return;

    // Update Connect account status
    await c.env.DB.prepare(`
      UPDATE users 
      SET stripe_connect_status = ?,
          stripe_connect_verified_at = ?
      WHERE id = ?
    `).bind(
      account.charges_enabled ? 'active' : 'pending',
      account.charges_enabled ? new Date().toISOString() : null,
      userId
    ).run();

    if (account.charges_enabled) {
      await this.sendNotification(c, userId, {
        type: 'connect_account_active',
        title: 'Your payout account is ready!',
        message: 'You can now receive payments for your pitches',
      });
    }
  }

  private async handlePayoutPaid(c: Context, payout: Stripe.Payout) {
    // Update payout record
    await c.env.DB.prepare(`
      UPDATE payment_transactions 
      SET status = 'completed',
          completed_at = datetime('now')
      WHERE provider_transaction_id = ?
    `).bind(payout.id).run();

    // Notify creator of successful payout
    if (payout.metadata?.user_id) {
      await this.sendNotification(c, payout.metadata.user_id, {
        type: 'payout_completed',
        title: 'Payout Successful',
        message: `Your payout of ${payout.amount / 100} ${payout.currency.toUpperCase()} has been sent to your bank`,
      });
    }
  }

  private async handlePayoutFailed(c: Context, payout: Stripe.Payout) {
    // Update payout record
    await c.env.DB.prepare(`
      UPDATE payment_transactions 
      SET status = 'failed',
          error_message = ?,
          updated_at = datetime('now')
      WHERE provider_transaction_id = ?
    `).bind(
      payout.failure_message || 'Payout failed',
      payout.id
    ).run();

    // Notify creator of failed payout
    if (payout.metadata?.user_id) {
      await this.sendNotification(c, payout.metadata.user_id, {
        type: 'payout_failed',
        title: 'Payout Failed',
        message: payout.failure_message || 'Your payout could not be processed',
      });
    }
  }

  private async handleChargeRefunded(c: Context, charge: Stripe.Charge) {
    const refund = charge.refunds?.data[0];
    if (!refund) return;

    // Update refund record
    await c.env.DB.prepare(`
      UPDATE refunds 
      SET status = ?,
          completed_at = datetime('now')
      WHERE provider_refund_id = ?
    `).bind(refund.status, refund.id).run();

    // Notify user of refund
    if (charge.metadata?.user_id) {
      await this.sendNotification(c, charge.metadata.user_id, {
        type: 'refund_processed',
        title: 'Refund Processed',
        message: `Your refund of ${refund.amount / 100} ${refund.currency.toUpperCase()} has been processed`,
      });
    }
  }

  // Helper methods

  private async sendNotification(c: Context, userId: string, notification: any) {
    try {
      await c.env.DB.prepare(`
        INSERT INTO notifications (
          id, user_id, type, title, message, metadata, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        crypto.randomUUID(),
        userId,
        notification.type,
        notification.title,
        notification.message,
        JSON.stringify(notification.metadata || {})
      ).run();
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }

  private getTierFromPriceId(priceId: string): string {
    // Map price IDs to subscription tiers
    const tierMap: { [key: string]: string } = {
      'price_creator_monthly': 'creator',
      'price_pro_monthly': 'pro',
      'price_investor_monthly': 'investor',
      'price_enterprise_monthly': 'enterprise',
    };
    return tierMap[priceId] || 'free';
  }

  private async handleInvoicePaid(c: Context, invoice: Stripe.Invoice) {
    // Handle successful invoice payment
    console.log("Invoice paid:", invoice.id);
  }

  private async handleInvoicePaymentFailed(c: Context, invoice: Stripe.Invoice) {
    // Handle failed invoice payment
    console.log("Invoice payment failed:", invoice.id);
  }

  private async handleAccountAuthorized(c: Context, data: any) {
    // Handle Connect account authorization
    console.log("Account authorized:", data);
  }

  private async handleAccountDeauthorized(c: Context, data: any) {
    // Handle Connect account deauthorization
    console.log("Account deauthorized:", data);
  }

  private async handleTransferCreated(c: Context, transfer: Stripe.Transfer) {
    // Handle transfer creation
    console.log("Transfer created:", transfer.id);
  }

  private async handleTransferPaid(c: Context, transfer: Stripe.Transfer) {
    // Handle successful transfer
    console.log("Transfer paid:", transfer.id);
  }

  private async handleTransferFailed(c: Context, transfer: Stripe.Transfer) {
    // Handle failed transfer
    console.log("Transfer failed:", transfer.id);
  }

  private async handlePayoutCreated(c: Context, payout: Stripe.Payout) {
    // Handle payout creation
    console.log("Payout created:", payout.id);
  }
}