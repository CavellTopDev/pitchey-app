import Stripe from "stripe";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

/**
 * Subscription Management Service
 * Handles subscription tiers, billing cycles, and usage-based billing
 */

export interface SubscriptionTier {
  id: string;
  name: string;
  priceId: string;
  monthlyPrice: number;
  yearlyPrice?: number;
  features: string[];
  limits: {
    pitches?: number;
    storage?: number; // GB
    teamMembers?: number;
    analytics?: boolean;
    customBranding?: boolean;
    prioritySupport?: boolean;
  };
}

export interface UsageRecord {
  userId: string;
  type: 'pitch_view' | 'storage' | 'api_call' | 'video_stream';
  quantity: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class SubscriptionService {
  private stripe: Stripe;
  private db: Client;

  // Define subscription tiers
  private readonly tiers: SubscriptionTier[] = [
    {
      id: 'free',
      name: 'Free',
      priceId: '',
      monthlyPrice: 0,
      features: [
        'Up to 3 pitches',
        '1GB storage',
        'Basic analytics',
        'Community support'
      ],
      limits: {
        pitches: 3,
        storage: 1,
        teamMembers: 1,
        analytics: false,
        customBranding: false,
        prioritySupport: false,
      }
    },
    {
      id: 'creator',
      name: 'Creator',
      priceId: Deno.env.get('STRIPE_CREATOR_PRICE_ID') || 'price_creator_monthly',
      monthlyPrice: 10,
      yearlyPrice: 100,
      features: [
        'Unlimited pitches',
        '10GB storage',
        'Advanced analytics',
        'Team collaboration (3 members)',
        'Custom branding',
        'Priority support'
      ],
      limits: {
        pitches: -1, // unlimited
        storage: 10,
        teamMembers: 3,
        analytics: true,
        customBranding: true,
        prioritySupport: true,
      }
    },
    {
      id: 'pro',
      name: 'Professional',
      priceId: Deno.env.get('STRIPE_PRO_PRICE_ID') || 'price_pro_monthly',
      monthlyPrice: 29,
      yearlyPrice: 290,
      features: [
        'Unlimited pitches',
        '50GB storage',
        'Advanced analytics & insights',
        'Team collaboration (10 members)',
        'Custom branding',
        'API access',
        'Priority support',
        'Export tools'
      ],
      limits: {
        pitches: -1,
        storage: 50,
        teamMembers: 10,
        analytics: true,
        customBranding: true,
        prioritySupport: true,
      }
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      priceId: Deno.env.get('STRIPE_ENTERPRISE_PRICE_ID') || 'price_enterprise_monthly',
      monthlyPrice: 99,
      features: [
        'Everything in Pro',
        'Unlimited storage',
        'Unlimited team members',
        'Custom integrations',
        'Dedicated account manager',
        'SLA guarantee',
        'Custom contracts',
        'White-label options'
      ],
      limits: {
        pitches: -1,
        storage: -1,
        teamMembers: -1,
        analytics: true,
        customBranding: true,
        prioritySupport: true,
      }
    }
  ];

  constructor(databaseUrl: string) {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "sk_test_dummy";
    this.stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
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
   * Get available subscription tiers
   */
  getTiers(): SubscriptionTier[] {
    return this.tiers;
  }

  /**
   * Get a specific tier by ID
   */
  getTier(tierId: string): SubscriptionTier | undefined {
    return this.tiers.find(tier => tier.id === tierId);
  }

  /**
   * Create a subscription for a user
   */
  async createSubscription(userId: string, tierId: string, interval: 'month' | 'year' = 'month'): Promise<Stripe.Subscription> {
    try {
      const tier = this.getTier(tierId);
      if (!tier || tier.id === 'free') {
        throw new Error("Invalid tier for subscription");
      }

      // Get user's Stripe customer ID
      const userResult = await this.db.queryObject<{ 
        stripe_customer_id: string | null;
        email: string;
      }>(`
        SELECT stripe_customer_id, email FROM users WHERE id = $1::uuid
      `, [userId]);

      const user = userResult.rows[0];
      if (!user) {
        throw new Error("User not found");
      }

      // Create customer if doesn't exist
      let customerId = user.stripe_customer_id;
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          email: user.email,
          metadata: { pitchey_user_id: userId }
        });
        customerId = customer.id;

        await this.db.queryObject(`
          UPDATE users SET stripe_customer_id = $1 WHERE id = $2::uuid
        `, [customerId, userId]);
      }

      // Create subscription
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: tier.priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          user_id: userId,
          tier_id: tierId,
        }
      });

      // Update user's subscription info
      await this.db.queryObject(`
        UPDATE users SET 
          stripe_subscription_id = $1,
          subscription_tier = $2,
          subscription_start_date = $3,
          subscription_end_date = $4,
          subscription_status = $5
        WHERE id = $6::uuid
      `, [
        subscription.id,
        tierId,
        new Date(subscription.current_period_start * 1000),
        new Date(subscription.current_period_end * 1000),
        subscription.status,
        userId
      ]);

      // Log to audit
      await this.db.queryObject(`
        INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
        VALUES ($1::uuid, 'subscription_created', 'subscription', $2::uuid, $3::jsonb)
      `, [userId, subscription.id, JSON.stringify({ tier: tierId, interval })]);

      return subscription;
    } catch (error) {
      console.error("Error creating subscription:", error);
      throw error;
    }
  }

  /**
   * Update subscription tier
   */
  async updateSubscription(userId: string, newTierId: string): Promise<Stripe.Subscription> {
    try {
      const tier = this.getTier(newTierId);
      if (!tier) {
        throw new Error("Invalid tier");
      }

      // Get user's current subscription
      const userResult = await this.db.queryObject<{ 
        stripe_subscription_id: string;
      }>(`
        SELECT stripe_subscription_id FROM users WHERE id = $1::uuid
      `, [userId]);

      const user = userResult.rows[0];
      if (!user?.stripe_subscription_id) {
        throw new Error("No active subscription found");
      }

      // Retrieve current subscription
      const subscription = await this.stripe.subscriptions.retrieve(user.stripe_subscription_id);
      
      // Update subscription item
      const updatedSubscription = await this.stripe.subscriptions.update(subscription.id, {
        items: [{
          id: subscription.items.data[0].id,
          price: tier.priceId,
        }],
        proration_behavior: 'create_prorations',
      });

      // Update database
      await this.db.queryObject(`
        UPDATE users SET 
          subscription_tier = $1,
          subscription_status = $2
        WHERE id = $3::uuid
      `, [newTierId, updatedSubscription.status, userId]);

      return updatedSubscription;
    } catch (error) {
      console.error("Error updating subscription:", error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string, immediately = false): Promise<Stripe.Subscription> {
    try {
      // Get user's subscription
      const userResult = await this.db.queryObject<{ 
        stripe_subscription_id: string;
      }>(`
        SELECT stripe_subscription_id FROM users WHERE id = $1::uuid
      `, [userId]);

      const user = userResult.rows[0];
      if (!user?.stripe_subscription_id) {
        throw new Error("No active subscription found");
      }

      // Cancel subscription
      const subscription = await this.stripe.subscriptions.update(
        user.stripe_subscription_id,
        immediately ? { cancel_at_period_end: false } : { cancel_at_period_end: true }
      );

      if (immediately) {
        await this.stripe.subscriptions.cancel(user.stripe_subscription_id);
        
        // Update user to free tier
        await this.db.queryObject(`
          UPDATE users SET 
            stripe_subscription_id = NULL,
            subscription_tier = 'free',
            subscription_status = 'cancelled'
          WHERE id = $1::uuid
        `, [userId]);
      } else {
        // Mark as cancelling
        await this.db.queryObject(`
          UPDATE users SET 
            subscription_status = 'cancelling'
          WHERE id = $1::uuid
        `, [userId]);
      }

      return subscription;
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      throw error;
    }
  }

  /**
   * Check if user has access to a feature based on their tier
   */
  async checkFeatureAccess(userId: string, feature: keyof SubscriptionTier['limits']): Promise<boolean> {
    try {
      const userResult = await this.db.queryObject<{ 
        subscription_tier: string;
      }>(`
        SELECT subscription_tier FROM users WHERE id = $1::uuid
      `, [userId]);

      const user = userResult.rows[0];
      const tierName = user?.subscription_tier || 'free';
      const tier = this.getTier(tierName);
      
      if (!tier) {
        return false;
      }

      const limit = tier.limits[feature];
      return limit === true || limit === -1; // true for boolean features, -1 for unlimited
    } catch (error) {
      console.error("Error checking feature access:", error);
      return false;
    }
  }

  /**
   * Check usage against tier limits
   */
  async checkUsageLimit(userId: string, resource: 'pitches' | 'storage' | 'teamMembers'): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
  }> {
    try {
      // Get user's tier
      const userResult = await this.db.queryObject<{ 
        subscription_tier: string;
      }>(`
        SELECT subscription_tier FROM users WHERE id = $1::uuid
      `, [userId]);

      const user = userResult.rows[0];
      const tierName = user?.subscription_tier || 'free';
      const tier = this.getTier(tierName);
      
      if (!tier) {
        return { allowed: false, current: 0, limit: 0 };
      }

      let current = 0;
      const limit = tier.limits[resource] as number || 0;

      // Get current usage
      switch (resource) {
        case 'pitches':
          const pitchCount = await this.db.queryObject<{ count: number }>(`
            SELECT COUNT(*) as count FROM pitches WHERE creator_id = $1::uuid
          `, [userId]);
          current = pitchCount.rows[0]?.count || 0;
          break;
        
        case 'storage':
          // Calculate storage usage from uploaded files
          const storageResult = await this.db.queryObject<{ total_size: number }>(`
            SELECT COALESCE(SUM(file_size_bytes), 0) as total_size
            FROM video_assets
            WHERE user_id = $1::uuid
          `, [userId]);
          current = (storageResult.rows[0]?.total_size || 0) / (1024 * 1024 * 1024); // Convert to GB
          break;
        
        case 'teamMembers':
          const teamCount = await this.db.queryObject<{ count: number }>(`
            SELECT COUNT(*) as count 
            FROM team_members 
            WHERE team_id IN (
              SELECT id FROM teams WHERE owner_id = $1::uuid
            )
          `, [userId]);
          current = teamCount.rows[0]?.count || 0;
          break;
      }

      const allowed = limit === -1 || current < limit;
      return { allowed, current, limit };
    } catch (error) {
      console.error("Error checking usage limit:", error);
      return { allowed: false, current: 0, limit: 0 };
    }
  }

  /**
   * Record usage for metered billing
   */
  async recordUsage(usage: UsageRecord): Promise<void> {
    try {
      // Store usage record
      await this.db.queryObject(`
        INSERT INTO usage_records (
          id, user_id, type, quantity, timestamp, metadata
        )
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb)
      `, [
        crypto.randomUUID(),
        usage.userId,
        usage.type,
        usage.quantity,
        usage.timestamp,
        JSON.stringify(usage.metadata || {})
      ]);

      // For certain usage types, report to Stripe for metered billing
      if (usage.type === 'api_call' || usage.type === 'video_stream') {
        const userResult = await this.db.queryObject<{ 
          stripe_subscription_id: string;
        }>(`
          SELECT stripe_subscription_id FROM users WHERE id = $1::uuid
        `, [usage.userId]);

        if (userResult.rows[0]?.stripe_subscription_id) {
          // Report usage to Stripe (for metered billing items)
          // This would require metered price items to be configured in Stripe
          console.log("Reporting usage to Stripe:", usage);
        }
      }
    } catch (error) {
      console.error("Error recording usage:", error);
    }
  }

  /**
   * Get subscription portal URL for user to manage billing
   */
  async createPortalSession(userId: string, returnUrl: string): Promise<string> {
    try {
      // Get user's Stripe customer ID
      const userResult = await this.db.queryObject<{ 
        stripe_customer_id: string;
      }>(`
        SELECT stripe_customer_id FROM users WHERE id = $1::uuid
      `, [userId]);

      const user = userResult.rows[0];
      if (!user?.stripe_customer_id) {
        throw new Error("No customer found");
      }

      // Create billing portal session
      const session = await this.stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: returnUrl,
      });

      return session.url;
    } catch (error) {
      console.error("Error creating portal session:", error);
      throw error;
    }
  }
}