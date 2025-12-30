import Stripe from "stripe";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

/**
 * Stripe Connect Service for Creator Payouts and Investment Processing
 * Handles marketplace payments, revenue sharing, and investment transactions
 */

interface ConnectAccountData {
  userId: string;
  email: string;
  type: 'creator' | 'investor' | 'production';
  businessProfile?: {
    name?: string;
    productDescription?: string;
    supportEmail?: string;
    url?: string;
  };
  bankAccount?: {
    country: string;
    currency: string;
    accountHolderName: string;
    accountHolderType: 'individual' | 'company';
    routingNumber: string;
    accountNumber: string;
  };
}

interface InvestmentPaymentData {
  investorId: string;
  creatorId: string;
  pitchId: string;
  amountCents: number;
  platformFeeCents: number;
  description: string;
  contractId?: string;
}

interface PayoutData {
  userId: string;
  amountCents: number;
  currency?: string;
  description?: string;
}

export class StripeConnectService {
  private stripe: Stripe;
  private db: Client;
  private platformFeePercent = 5; // 5% platform fee

  constructor(databaseUrl: string) {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey || stripeKey.startsWith("sk_test")) {
      console.warn("⚠️ Using test Stripe key - payments will not be real");
    }

    this.stripe = new Stripe(stripeKey || "sk_test_dummy", {
      apiVersion: "2023-10-16",
      typescript: true,
    });

    // Initialize database connection
    const url = new URL(databaseUrl);
    this.db = new Client({
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
      hostname: url.hostname,
      port: parseInt(url.port || "5432"),
      tls: {
        enabled: url.searchParams.get("sslmode") === "require",
      },
    });
  }

  async connect() {
    await this.db.connect();
  }

  async disconnect() {
    await this.db.end();
  }

  /**
   * Create a Stripe Connect account for a creator/production company
   */
  async createConnectAccount(data: ConnectAccountData): Promise<Stripe.Account> {
    try {
      // Create the Connect account
      const account = await this.stripe.accounts.create({
        type: 'express', // Express accounts for simplified onboarding
        email: data.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: data.businessProfile,
        metadata: {
          pitchey_user_id: data.userId,
          user_type: data.type,
        },
      });

      // Store the Connect account ID in database
      await this.db.queryObject(`
        UPDATE users 
        SET stripe_connect_id = $1, 
            stripe_connect_status = 'pending',
            stripe_connect_created_at = NOW()
        WHERE id = $2::uuid
      `, [account.id, data.userId]);

      // Log to audit table
      await this.db.queryObject(`
        INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
        VALUES ($1::uuid, 'stripe_connect_created', 'stripe_account', $2::uuid, $3::jsonb)
      `, [data.userId, account.id, JSON.stringify({ account_type: 'express' })]);

      return account;
    } catch (error) {
      console.error("Error creating Connect account:", error);
      throw error;
    }
  }

  /**
   * Generate Connect account onboarding link
   */
  async createAccountLink(userId: string, returnUrl: string, refreshUrl: string): Promise<string> {
    try {
      // Get user's Connect account ID
      const result = await this.db.queryObject<{ stripe_connect_id: string }>(`
        SELECT stripe_connect_id FROM users WHERE id = $1::uuid
      `, [userId]);

      if (!result.rows[0]?.stripe_connect_id) {
        throw new Error("No Connect account found for user");
      }

      const accountLink = await this.stripe.accountLinks.create({
        account: result.rows[0].stripe_connect_id,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      return accountLink.url;
    } catch (error) {
      console.error("Error creating account link:", error);
      throw error;
    }
  }

  /**
   * Process investment payment with platform fee
   */
  async processInvestmentPayment(data: InvestmentPaymentData): Promise<Stripe.PaymentIntent> {
    try {
      // Get creator's Connect account
      const creatorResult = await this.db.queryObject<{ stripe_connect_id: string }>(`
        SELECT stripe_connect_id FROM users WHERE id = $1::uuid
      `, [data.creatorId]);

      if (!creatorResult.rows[0]?.stripe_connect_id) {
        throw new Error("Creator does not have a Connect account");
      }

      // Get investor's customer ID
      const investorResult = await this.db.queryObject<{ stripe_customer_id: string }>(`
        SELECT stripe_customer_id FROM users WHERE id = $1::uuid
      `, [data.investorId]);

      // Create payment intent with destination charge
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: data.amountCents,
        currency: 'usd',
        customer: investorResult.rows[0]?.stripe_customer_id,
        description: data.description,
        transfer_data: {
          destination: creatorResult.rows[0].stripe_connect_id,
        },
        application_fee_amount: data.platformFeeCents,
        metadata: {
          investor_id: data.investorId,
          creator_id: data.creatorId,
          pitch_id: data.pitchId,
          contract_id: data.contractId || '',
          type: 'investment',
        },
      });

      // Create payment transaction record
      await this.db.queryObject(`
        INSERT INTO payment_transactions (
          user_id, type, amount_cents, currency, status, 
          provider_transaction_id, description, metadata
        )
        VALUES ($1::uuid, 'investment', $2, 'USD', 'pending', $3, $4, $5::jsonb)
      `, [
        data.investorId,
        data.amountCents,
        paymentIntent.id,
        data.description,
        JSON.stringify({
          creator_id: data.creatorId,
          pitch_id: data.pitchId,
          platform_fee: data.platformFeeCents,
        })
      ]);

      // Create investment record
      await this.db.queryObject(`
        INSERT INTO investments (
          investor_id, pitch_id, amount_cents, currency, 
          status, payment_transaction_id, contract_id
        )
        VALUES ($1::uuid, $2::uuid, $3, 'USD', 'pending', $4, $5::uuid)
      `, [
        data.investorId,
        data.pitchId,
        data.amountCents,
        paymentIntent.id,
        data.contractId
      ]);

      return paymentIntent;
    } catch (error) {
      console.error("Error processing investment payment:", error);
      throw error;
    }
  }

  /**
   * Create payout to creator's bank account
   */
  async createPayout(data: PayoutData): Promise<Stripe.Payout> {
    try {
      // Get user's Connect account
      const result = await this.db.queryObject<{ stripe_connect_id: string }>(`
        SELECT stripe_connect_id FROM users WHERE id = $1::uuid
      `, [data.userId]);

      if (!result.rows[0]?.stripe_connect_id) {
        throw new Error("No Connect account found for user");
      }

      // Create payout on the Connect account
      const payout = await this.stripe.payouts.create(
        {
          amount: data.amountCents,
          currency: data.currency || 'usd',
          description: data.description,
          metadata: {
            user_id: data.userId,
            type: 'manual_payout',
          },
        },
        {
          stripeAccount: result.rows[0].stripe_connect_id,
        }
      );

      // Record payout in payment transactions
      await this.db.queryObject(`
        INSERT INTO payment_transactions (
          user_id, type, amount_cents, currency, status, 
          provider_transaction_id, description
        )
        VALUES ($1::uuid, 'payout', $2, $3, 'pending', $4, $5)
      `, [
        data.userId,
        data.amountCents,
        data.currency || 'USD',
        payout.id,
        data.description || 'Creator payout'
      ]);

      return payout;
    } catch (error) {
      console.error("Error creating payout:", error);
      throw error;
    }
  }

  /**
   * Handle revenue share distribution
   */
  async distributeRevenueShares(pitchId: string, totalRevenueCents: number): Promise<void> {
    try {
      // Get all revenue share agreements for the pitch
      const shares = await this.db.queryObject<{
        recipient_id: string;
        share_percentage: number;
        stripe_connect_id: string;
      }>(`
        SELECT rs.recipient_id, rs.share_percentage, u.stripe_connect_id
        FROM revenue_shares rs
        JOIN users u ON rs.recipient_id = u.id
        WHERE rs.pitch_id = $1::uuid 
          AND rs.status = 'active'
          AND u.stripe_connect_id IS NOT NULL
      `, [pitchId]);

      // Calculate and create transfers for each recipient
      for (const share of shares.rows) {
        const shareAmountCents = Math.floor(totalRevenueCents * (share.share_percentage / 100));
        
        if (shareAmountCents > 0) {
          // Create transfer to recipient
          const transfer = await this.stripe.transfers.create({
            amount: shareAmountCents,
            currency: 'usd',
            destination: share.stripe_connect_id,
            description: `Revenue share for pitch ${pitchId}`,
            metadata: {
              pitch_id: pitchId,
              recipient_id: share.recipient_id,
              share_percentage: share.share_percentage.toString(),
            },
          });

          // Record the distribution
          await this.db.queryObject(`
            INSERT INTO payment_transactions (
              user_id, type, amount_cents, currency, status,
              provider_transaction_id, description, metadata
            )
            VALUES ($1::uuid, 'revenue_share', $2, 'USD', 'completed', $3, $4, $5::jsonb)
          `, [
            share.recipient_id,
            shareAmountCents,
            transfer.id,
            `Revenue share distribution (${share.share_percentage}%)`,
            JSON.stringify({ pitch_id: pitchId, total_revenue: totalRevenueCents })
          ]);
        }
      }
    } catch (error) {
      console.error("Error distributing revenue shares:", error);
      throw error;
    }
  }

  /**
   * Verify Connect account status
   */
  async verifyAccountStatus(userId: string): Promise<{
    verified: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    requirements?: any;
  }> {
    try {
      const result = await this.db.queryObject<{ stripe_connect_id: string }>(`
        SELECT stripe_connect_id FROM users WHERE id = $1::uuid
      `, [userId]);

      if (!result.rows[0]?.stripe_connect_id) {
        return {
          verified: false,
          chargesEnabled: false,
          payoutsEnabled: false,
        };
      }

      const account = await this.stripe.accounts.retrieve(result.rows[0].stripe_connect_id);

      // Update status in database
      await this.db.queryObject(`
        UPDATE users 
        SET stripe_connect_status = $1,
            stripe_connect_verified_at = $2
        WHERE id = $3::uuid
      `, [
        account.charges_enabled ? 'active' : 'pending',
        account.charges_enabled ? new Date() : null,
        userId
      ]);

      return {
        verified: account.details_submitted || false,
        chargesEnabled: account.charges_enabled || false,
        payoutsEnabled: account.payouts_enabled || false,
        requirements: account.requirements,
      };
    } catch (error) {
      console.error("Error verifying account status:", error);
      throw error;
    }
  }

  /**
   * Create escrow for investment
   */
  async createEscrow(pitchId: string, investmentId: string, amountCents: number): Promise<void> {
    try {
      await this.db.queryObject(`
        INSERT INTO escrow_accounts (
          pitch_id, investment_id, balance_cents, currency, status, release_conditions
        )
        VALUES ($1::uuid, $2::uuid, $3, 'USD', 'active', $4::jsonb)
      `, [
        pitchId,
        investmentId,
        amountCents,
        JSON.stringify({
          min_investors: 5,
          target_amount: 1000000,
          deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        })
      ]);
    } catch (error) {
      console.error("Error creating escrow:", error);
      throw error;
    }
  }

  /**
   * Release funds from escrow
   */
  async releaseEscrowFunds(escrowId: string): Promise<void> {
    try {
      // Get escrow details
      const escrow = await this.db.queryObject<{
        pitch_id: string;
        balance_cents: number;
      }>(`
        SELECT pitch_id, balance_cents 
        FROM escrow_accounts 
        WHERE id = $1::uuid AND status = 'active'
      `, [escrowId]);

      if (!escrow.rows[0]) {
        throw new Error("Escrow account not found or not active");
      }

      // Get creator details
      const creator = await this.db.queryObject<{
        creator_id: string;
        stripe_connect_id: string;
      }>(`
        SELECT p.creator_id, u.stripe_connect_id
        FROM pitches p
        JOIN users u ON p.creator_id = u.id
        WHERE p.id = $1::uuid
      `, [escrow.rows[0].pitch_id]);

      if (!creator.rows[0]?.stripe_connect_id) {
        throw new Error("Creator Connect account not found");
      }

      // Create payout to creator
      await this.createPayout({
        userId: creator.rows[0].creator_id,
        amountCents: escrow.rows[0].balance_cents,
        description: `Escrow release for pitch ${escrow.rows[0].pitch_id}`,
      });

      // Update escrow status
      await this.db.queryObject(`
        UPDATE escrow_accounts 
        SET status = 'released', updated_at = NOW()
        WHERE id = $1::uuid
      `, [escrowId]);
    } catch (error) {
      console.error("Error releasing escrow funds:", error);
      throw error;
    }
  }
}