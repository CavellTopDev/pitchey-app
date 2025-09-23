import Stripe from "stripe";

// Initialize Stripe with test keys for development
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "sk_test_...", {
  apiVersion: "2023-10-16",
});

// Subscription tiers and pricing
export const SUBSCRIPTION_TIERS = {
  BASIC: "BASIC",
  PRO: "PRO", 
  ENTERPRISE: "ENTERPRISE",
} as const;

export const SUBSCRIPTION_PRICES = {
  // Test mode price IDs - replace with actual Stripe price IDs
  [SUBSCRIPTION_TIERS.PRO]: Deno.env.get("STRIPE_PRO_PRICE_ID") || "price_1234567890",
  [SUBSCRIPTION_TIERS.ENTERPRISE]: Deno.env.get("STRIPE_ENTERPRISE_PRICE_ID") || "price_0987654321",
} as const;

// Credit packages
export const CREDIT_PACKAGES = {
  SMALL: {
    credits: 10,
    price: 1000, // $10.00 in cents
    priceId: Deno.env.get("STRIPE_CREDITS_SMALL_PRICE_ID") || "price_credits_small",
  },
  MEDIUM: {
    credits: 50,
    price: 4000, // $40.00 in cents
    priceId: Deno.env.get("STRIPE_CREDITS_MEDIUM_PRICE_ID") || "price_credits_medium",
  },
  LARGE: {
    credits: 100,
    price: 7000, // $70.00 in cents
    priceId: Deno.env.get("STRIPE_CREDITS_LARGE_PRICE_ID") || "price_credits_large",
  },
} as const;

// Success fee rate
export const SUCCESS_FEE_PERCENTAGE = 3.0;

// Credit usage costs
export const CREDIT_COSTS = {
  VIEW_PITCH: 1,
  UPLOAD_PITCH: 5,
  SEND_MESSAGE: 1,
  DOWNLOAD_MEDIA: 2,
} as const;

// Utility functions
export const formatCurrency = (amountInCents: number, currency = "USD"): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountInCents / 100);
};

export const calculateSuccessFee = (dealValue: number): number => {
  return Math.round(dealValue * (SUCCESS_FEE_PERCENTAGE / 100) * 100) / 100;
};

export const getTierFromPriceId = (priceId: string): keyof typeof SUBSCRIPTION_TIERS | null => {
  for (const [tier, id] of Object.entries(SUBSCRIPTION_PRICES)) {
    if (id === priceId) {
      return tier as keyof typeof SUBSCRIPTION_TIERS;
    }
  }
  return null;
};

export const getCreditsFromPriceId = (priceId: string): number => {
  for (const package_ of Object.values(CREDIT_PACKAGES)) {
    if (package_.priceId === priceId) {
      return package_.credits;
    }
  }
  return 0;
};

export default stripe;