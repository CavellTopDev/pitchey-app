/**
 * Payment Services Module
 * 
 * Main entry point for payment services.
 * Provides unified interface for payment operations.
 */

// Export all interfaces and types
export type {
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
  PaymentConfig
} from "./interface.ts";

// Export error classes
export {
  PaymentError,
  PaymentProviderError
} from "./interface.ts";

// Export provider implementations
export { MockPaymentProvider } from "./mock-provider.ts";
export { StripePaymentProvider } from "./stripe-provider.ts";

// Export factory and convenience functions
export {
  PaymentFactory,
  getPaymentService,
  initializePayments,
  isPaymentTestMode,
  getPaymentProviderName,
  getPaymentFrontendConfig,
  resetPaymentService
} from "./factory.ts";

// Export default service instance
export { default as paymentService } from "./factory.ts";