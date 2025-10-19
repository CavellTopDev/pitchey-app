/**
 * Payment Factory
 * 
 * Factory pattern implementation for payment providers.
 * Handles automatic switching between mock and real Stripe providers
 * based on environment configuration.
 */

import { PaymentService, PaymentConfig, PaymentError } from "./interface.ts";
import { MockPaymentProvider } from "./mock-provider.ts";
import { StripePaymentProvider } from "./stripe-provider.ts";

class PaymentFactory {
  private static instance: PaymentService | null = null;
  private static config: PaymentConfig | null = null;

  /**
   * Get the payment service instance (singleton)
   */
  static getInstance(): PaymentService {
    if (!this.instance) {
      this.instance = this.createProvider();
    }
    return this.instance;
  }

  /**
   * Initialize the payment factory with configuration
   */
  static initialize(config?: Partial<PaymentConfig>): PaymentService {
    this.config = this.buildConfig(config);
    this.instance = this.createProvider();
    return this.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static reset(): void {
    this.instance = null;
    this.config = null;
  }

  /**
   * Get current configuration
   */
  static getConfig(): PaymentConfig | null {
    return this.config;
  }

  /**
   * Build configuration from environment variables and overrides
   */
  private static buildConfig(configOverrides?: Partial<PaymentConfig>): PaymentConfig {
    // Default base URL
    const defaultBaseUrl = Deno.env.get("APP_URL") || "http://localhost:8001";

    // Check environment variables
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripePublishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY");
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const paymentProvider = Deno.env.get("PAYMENT_PROVIDER");

    // Determine provider based on configuration
    let provider: 'stripe' | 'mock' = 'mock';

    if (paymentProvider === 'stripe') {
      provider = 'stripe';
    } else if (paymentProvider === 'mock') {
      provider = 'mock';
    } else {
      // Auto-detect based on Stripe keys
      if (stripeSecretKey && 
          stripePublishableKey && 
          stripeWebhookSecret &&
          !stripeSecretKey.startsWith('mock_') &&
          stripeSecretKey !== 'sk_test_...') {
        provider = 'stripe';
      }
    }

    const config: PaymentConfig = {
      provider,
      appUrl: defaultBaseUrl,
      stripe: provider === 'stripe' ? {
        secretKey: stripeSecretKey || '',
        publishableKey: stripePublishableKey || '',
        webhookSecret: stripeWebhookSecret || '',
      } : undefined,
      mock: provider === 'mock' ? {
        enabled: true,
        logPayments: Deno.env.get("MOCK_PAYMENT_LOGS") !== 'false',
        simulateErrors: Deno.env.get("MOCK_PAYMENT_ERRORS") === 'true',
        errorRate: parseFloat(Deno.env.get("MOCK_PAYMENT_ERROR_RATE") || '0.05'),
        baseUrl: defaultBaseUrl,
      } : undefined,
      ...configOverrides
    };

    console.log(`[Payment Factory] Using ${provider} provider`);
    
    return config;
  }

  /**
   * Create the appropriate payment provider
   */
  private static createProvider(): PaymentService {
    if (!this.config) {
      this.config = this.buildConfig();
    }

    try {
      switch (this.config.provider) {
        case 'stripe':
          if (!this.config.stripe) {
            throw new PaymentError(
              'Stripe configuration missing',
              'stripe_config_missing'
            );
          }
          
          this.validateStripeConfig(this.config.stripe);
          return new StripePaymentProvider(this.config.stripe);

        case 'mock':
          return new MockPaymentProvider(this.config.mock || {
            enabled: true,
            logPayments: true,
            simulateErrors: false,
            errorRate: 0,
            baseUrl: this.config.appUrl
          });

        default:
          throw new PaymentError(
            `Unknown payment provider: ${(this.config as any).provider}`,
            'unknown_provider'
          );
      }
    } catch (error) {
      console.error('[Payment Factory] Error creating provider:', error);
      
      // Fallback to mock provider on configuration errors
      console.log('[Payment Factory] Falling back to mock provider');
      return new MockPaymentProvider({
        enabled: true,
        logPayments: true,
        simulateErrors: false,
        errorRate: 0,
        baseUrl: this.config.appUrl
      });
    }
  }

  /**
   * Validate Stripe configuration
   */
  private static validateStripeConfig(config: NonNullable<PaymentConfig['stripe']>): void {
    const errors: string[] = [];

    if (!config.secretKey) {
      errors.push('STRIPE_SECRET_KEY is required');
    } else if (!config.secretKey.startsWith('sk_')) {
      errors.push('STRIPE_SECRET_KEY must start with "sk_"');
    }

    if (!config.publishableKey) {
      errors.push('STRIPE_PUBLISHABLE_KEY is required');
    } else if (!config.publishableKey.startsWith('pk_')) {
      errors.push('STRIPE_PUBLISHABLE_KEY must start with "pk_"');
    }

    if (!config.webhookSecret) {
      errors.push('STRIPE_WEBHOOK_SECRET is required');
    } else if (!config.webhookSecret.startsWith('whsec_')) {
      errors.push('STRIPE_WEBHOOK_SECRET must start with "whsec_"');
    }

    if (errors.length > 0) {
      throw new PaymentError(
        `Stripe configuration errors: ${errors.join(', ')}`,
        'stripe_config_invalid'
      );
    }
  }

  /**
   * Check if the current provider is in test mode
   */
  static isTestMode(): boolean {
    return this.getInstance().isTestMode();
  }

  /**
   * Get the current provider name
   */
  static getProviderName(): string {
    return this.getInstance().getProviderName();
  }

  /**
   * Get provider-specific configuration for frontend
   */
  static getFrontendConfig(): {
    provider: string;
    isTestMode: boolean;
    publishableKey?: string;
    mockCheckoutUrl?: string;
  } {
    const instance = this.getInstance();
    const config = this.getConfig();
    
    return {
      provider: instance.getProviderName(),
      isTestMode: instance.isTestMode(),
      publishableKey: config?.stripe?.publishableKey,
      mockCheckoutUrl: config?.provider === 'mock' ? `${config.appUrl}/mock-checkout` : undefined
    };
  }
}

// Convenience functions for common operations
export const getPaymentService = (): PaymentService => {
  return PaymentFactory.getInstance();
};

export const initializePayments = (config?: Partial<PaymentConfig>): PaymentService => {
  return PaymentFactory.initialize(config);
};

export const isPaymentTestMode = (): boolean => {
  return PaymentFactory.isTestMode();
};

export const getPaymentProviderName = (): string => {
  return PaymentFactory.getProviderName();
};

export const getPaymentFrontendConfig = () => {
  return PaymentFactory.getFrontendConfig();
};

export const resetPaymentService = (): void => {
  PaymentFactory.reset();
};

// Export the factory class for advanced usage
export { PaymentFactory };

// Export default instance getter
export default getPaymentService;