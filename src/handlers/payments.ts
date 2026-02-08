import { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { StripeConnectService } from "../services/stripe-connect.service.ts";
import { StripeService } from "../services/stripe.service.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

/**
 * Payment Handlers for Stripe Integration
 * Handles payment methods, charges, refunds, and payouts
 */

// Validation schemas
const AddPaymentMethodSchema = z.object({
  type: z.enum(['card', 'bank_account']),
  token: z.string().optional(),
  paymentMethodId: z.string().optional(),
});

const ChargePaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  paymentMethodId: z.string(),
  description: z.string(),
  pitchId: z.string().uuid().optional(),
  creatorId: z.string().uuid().optional(),
});

const PayoutSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  description: z.string().optional(),
});

const InvestmentSchema = z.object({
  pitchId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethodId: z.string(),
  contractId: z.string().uuid().optional(),
  terms: z.object({
    equityPercentage: z.number().optional(),
    revenueSharePercentage: z.number().optional(),
    maturityDate: z.string().optional(),
  }).optional(),
});

export class PaymentHandlers {
  private connectService: StripeConnectService;
  private stripeService: typeof StripeService;

  constructor(databaseUrl: string) {
    this.connectService = new StripeConnectService(databaseUrl);
    this.stripeService = StripeService;
  }

  async initialize() {
    await this.connectService.connect();
  }

  async cleanup() {
    await this.connectService.disconnect();
  }

  /**
   * POST /api/payments/methods
   * Add a payment method to user account
   */
  async addPaymentMethod(c: Context) {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      const validated = AddPaymentMethodSchema.parse(body);

      // Get or create Stripe customer
      const user = await c.env.DB.prepare(`
        SELECT id, email, stripe_customer_id FROM users WHERE id = ?
      `).bind(userId).first();

      let customerId = user.stripe_customer_id;
      if (!customerId) {
        const customer = await this.stripeService.createCustomer(userId, user.email);
        customerId = customer.id;
      }

      // Attach payment method to customer
      if (validated.paymentMethodId) {
        const stripe = new (await import("stripe")).default(c.env.STRIPE_SECRET_KEY);
        await stripe.paymentMethods.attach(validated.paymentMethodId, {
          customer: customerId,
        });

        // Save to database
        await c.env.DB.prepare(`
          INSERT INTO payment_methods (
            id, user_id, type, provider, provider_id, is_default, created_at
          )
          VALUES (?, ?, ?, 'stripe', ?, ?, datetime('now'))
        `).bind(
          crypto.randomUUID(),
          userId,
          validated.type,
          validated.paymentMethodId,
          false
        ).run();
      }

      // Log to audit
      await c.env.DB.prepare(`
        INSERT INTO audit_log (
          id, user_id, action, resource_type, metadata, created_at
        )
        VALUES (?, ?, 'payment_method_added', 'payment_method', ?, datetime('now'))
      `).bind(
        crypto.randomUUID(),
        userId,
        JSON.stringify({ type: validated.type })
      ).run();

      return c.json({ success: true, message: "Payment method added successfully" });
    } catch (error) {
      console.error("Error adding payment method:", error);
      return c.json({ error: "Failed to add payment method" }, 500);
    }
  }

  /**
   * GET /api/payments/methods
   * List user's payment methods
   */
  async listPaymentMethods(c: Context) {
    try {
      const userId = c.get('userId');

      const methods = await c.env.DB.prepare(`
        SELECT 
          id, type, provider, last_four, brand, 
          exp_month, exp_year, is_default, created_at
        FROM payment_methods
        WHERE user_id = ? AND deleted_at IS NULL
        ORDER BY is_default DESC, created_at DESC
      `).bind(userId).all();

      return c.json({ methods: methods.results || [] });
    } catch (error) {
      console.error("Error listing payment methods:", error);
      return c.json({ error: "Failed to list payment methods" }, 500);
    }
  }

  /**
   * DELETE /api/payments/methods/:id
   * Remove a payment method
   */
  async removePaymentMethod(c: Context) {
    try {
      const userId = c.get('userId');
      const methodId = c.req.param('id');

      // Soft delete the payment method
      await c.env.DB.prepare(`
        UPDATE payment_methods 
        SET deleted_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).bind(methodId, userId).run();

      return c.json({ success: true, message: "Payment method removed" });
    } catch (error) {
      console.error("Error removing payment method:", error);
      return c.json({ error: "Failed to remove payment method" }, 500);
    }
  }

  /**
   * POST /api/payments/methods/:id/default
   * Set payment method as default
   */
  async setDefaultPaymentMethod(c: Context) {
    try {
      const userId = c.get('userId');
      const methodId = c.req.param('id');

      // Remove current default
      await c.env.DB.prepare(`
        UPDATE payment_methods 
        SET is_default = 0
        WHERE user_id = ?
      `).bind(userId).run();

      // Set new default
      await c.env.DB.prepare(`
        UPDATE payment_methods 
        SET is_default = 1
        WHERE id = ? AND user_id = ?
      `).bind(methodId, userId).run();

      return c.json({ success: true, message: "Default payment method updated" });
    } catch (error) {
      console.error("Error setting default payment method:", error);
      return c.json({ error: "Failed to set default payment method" }, 500);
    }
  }

  /**
   * POST /api/payments/charge
   * Process a payment
   */
  async chargePayment(c: Context) {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      const validated = ChargePaymentSchema.parse(body);

      // Convert amount to cents
      const amountCents = Math.round(validated.amount * 100);

      // If this is an investment payment with a creator
      if (validated.creatorId && validated.pitchId) {
        const result = await this.connectService.processInvestmentPayment({
          investorId: userId,
          creatorId: validated.creatorId,
          pitchId: validated.pitchId,
          amountCents,
          platformFeeCents: Math.round(amountCents * 0.05), // 5% platform fee
          description: validated.description,
        });

        return c.json({
          success: true,
          paymentIntentId: result.id,
          clientSecret: result.client_secret,
        });
      }

      // Regular payment
      const result = await this.stripeService.createPaymentIntent({
        userId: parseInt(userId),
        amount: validated.amount,
        currency: validated.currency,
        type: 'payment',
      });

      return c.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("Error processing payment:", error);
      return c.json({ error: "Failed to process payment" }, 500);
    }
  }

  /**
   * POST /api/payments/refund
   * Process a refund
   */
  async processRefund(c: Context) {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      const { transactionId, amount, reason } = body;

      // Get original transaction
      const transaction = await c.env.DB.prepare(`
        SELECT * FROM payment_transactions
        WHERE id = ? AND user_id = ?
      `).bind(transactionId, userId).first();

      if (!transaction) {
        return c.json({ error: "Transaction not found" }, 404);
      }

      // Create refund with Stripe
      const stripe = new (await import("stripe")).default(c.env.STRIPE_SECRET_KEY);
      const refund = await stripe.refunds.create({
        payment_intent: transaction.provider_transaction_id,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason: reason || 'requested_by_customer',
      });

      // Record refund in database
      await c.env.DB.prepare(`
        INSERT INTO refunds (
          id, transaction_id, amount_cents, reason, status,
          provider_refund_id, created_at
        )
        VALUES (?, ?, ?, ?, 'pending', ?, datetime('now'))
      `).bind(
        crypto.randomUUID(),
        transactionId,
        refund.amount,
        reason,
        refund.id
      ).run();

      return c.json({
        success: true,
        refundId: refund.id,
        status: refund.status,
      });
    } catch (error) {
      console.error("Error processing refund:", error);
      return c.json({ error: "Failed to process refund" }, 500);
    }
  }

  /**
   * POST /api/payments/payout
   * Create payout to creator
   */
  async createPayout(c: Context) {
    try {
      const userId = c.get('userId');
      const userType = c.get('userType');
      
      // Only creators and production companies can receive payouts
      if (userType !== 'creator' && userType !== 'production') {
        return c.json({ error: "Unauthorized" }, 403);
      }

      const body = await c.req.json();
      const validated = PayoutSchema.parse(body);

      const amountCents = Math.round(validated.amount * 100);

      const result = await this.connectService.createPayout({
        userId,
        amountCents,
        currency: validated.currency,
        description: validated.description,
      });

      return c.json({
        success: true,
        payoutId: result.id,
        status: result.status,
        arrivalDate: result.arrival_date,
      });
    } catch (error) {
      console.error("Error creating payout:", error);
      return c.json({ error: "Failed to create payout" }, 500);
    }
  }

  /**
   * GET /api/payments/history
   * Get payment history
   */
  async getPaymentHistory(c: Context) {
    try {
      const userId = c.get('userId');
      const { page = 1, limit = 20 } = c.req.query();

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const transactions = await c.env.DB.prepare(`
        SELECT 
          id, type, amount_cents, currency, status,
          description, created_at, completed_at
        FROM payment_transactions
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).bind(userId, parseInt(limit as string), offset).all();

      const total = await c.env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM payment_transactions
        WHERE user_id = ?
      `).bind(userId).first();

      return c.json({
        transactions: transactions.results || [],
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: total?.count || 0,
          pages: Math.ceil((total?.count || 0) / parseInt(limit as string)),
        },
      });
    } catch (error) {
      console.error("Error getting payment history:", error);
      return c.json({ error: "Failed to get payment history" }, 500);
    }
  }

  /**
   * POST /api/payments/connect-account
   * Create Stripe Connect account for creator
   */
  async createConnectAccount(c: Context) {
    try {
      const userId = c.get('userId');
      const userType = c.get('userType');
      const body = await c.req.json();

      // Only creators and production companies can have Connect accounts
      if (userType !== 'creator' && userType !== 'production') {
        return c.json({ error: "Unauthorized" }, 403);
      }

      const user = await c.env.DB.prepare(`
        SELECT email FROM users WHERE id = ?
      `).bind(userId).first();

      const account = await this.connectService.createConnectAccount({
        userId,
        email: user.email,
        type: userType as 'creator' | 'production',
        businessProfile: body.businessProfile,
      });

      // Generate onboarding link
      const onboardingUrl = await this.connectService.createAccountLink(
        userId,
        `${c.env.FRONTEND_URL}/dashboard/payments?setup=complete`,
        `${c.env.FRONTEND_URL}/dashboard/payments?setup=refresh`
      );

      return c.json({
        success: true,
        accountId: account.id,
        onboardingUrl,
      });
    } catch (error) {
      console.error("Error creating Connect account:", error);
      return c.json({ error: "Failed to create Connect account" }, 500);
    }
  }

  /**
   * GET /api/payments/connect-status
   * Check Connect account status
   */
  async getConnectStatus(c: Context) {
    try {
      const userId = c.get('userId');
      
      const status = await this.connectService.verifyAccountStatus(userId);
      
      return c.json(status);
    } catch (error) {
      console.error("Error checking Connect status:", error);
      return c.json({ error: "Failed to check Connect status" }, 500);
    }
  }

  /**
   * POST /api/investments/commit
   * Commit to an investment
   */
  async commitInvestment(c: Context) {
    try {
      const userId = c.get('userId');
      const userType = c.get('userType');
      
      // Only investors can make investments
      if (userType !== 'investor') {
        return c.json({ error: "Unauthorized" }, 403);
      }

      const body = await c.req.json();
      const validated = InvestmentSchema.parse(body);

      // Get pitch and creator details
      const pitch = await c.env.DB.prepare(`
        SELECT p.id, p.user_id, p.title, u.stripe_connect_id
        FROM pitches p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
      `).bind(validated.pitchId).first();

      if (!pitch) {
        return c.json({ error: "Pitch not found" }, 404);
      }

      const amountCents = Math.round(validated.amount * 100);
      const platformFeeCents = Math.round(amountCents * 0.05); // 5% platform fee

      // Process investment payment
      const paymentIntent = await this.connectService.processInvestmentPayment({
        investorId: userId,
        creatorId: pitch.user_id,
        pitchId: validated.pitchId,
        amountCents,
        platformFeeCents,
        description: `Investment in "${pitch.title}"`,
        contractId: validated.contractId,
      });

      // Create escrow if needed
      const investmentId = crypto.randomUUID();
      await this.connectService.createEscrow(
        validated.pitchId,
        investmentId,
        amountCents - platformFeeCents
      );

      return c.json({
        success: true,
        investmentId,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error) {
      console.error("Error committing investment:", error);
      return c.json({ error: "Failed to commit investment" }, 500);
    }
  }
}