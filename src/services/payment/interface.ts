/**
 * Payment Service Interface
 * 
 * This interface defines the contract for payment providers,
 * allowing seamless switching between mock and real payment providers.
 */

export interface PaymentCustomer {
  id: string;
  email: string;
  metadata: Record<string, string>;
  created: number;
}

export interface PaymentSubscription {
  id: string;
  customer: string;
  status: 'active' | 'canceled' | 'incomplete' | 'past_due' | 'trialing' | 'unpaid';
  current_period_start: number;
  current_period_end: number;
  currency: string;
  items: {
    data: Array<{
      price: {
        id: string;
        unit_amount: number;
        recurring?: {
          interval: 'month' | 'year';
        };
      };
    }>;
  };
  cancel_at_period_end?: boolean;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'failed';
  client_secret: string;
  metadata: Record<string, string>;
  last_payment_error?: {
    message: string;
    code?: string;
  };
  confirmation_method?: string;
}

export interface CheckoutSession {
  id: string;
  customer?: string;
  customer_email?: string;
  mode: 'subscription' | 'payment' | 'setup';
  url: string;
  success_url: string;
  cancel_url: string;
  metadata: Record<string, string>;
  amount_total?: number;
  payment_intent?: string;
  subscription?: string;
  status?: 'open' | 'complete' | 'expired';
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'paypal';
  customer?: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
    funding?: string;
  };
  billing_details?: {
    name?: string;
    email?: string;
    address?: any;
  };
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
  livemode?: boolean;
  pending_webhooks?: number;
}

export interface Invoice {
  id: string;
  customer: string;
  subscription?: string;
  payment_intent?: string;
  amount_paid: number;
  amount_due: number;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  currency: string;
  created: number;
  due_date?: number;
}

// Configuration interfaces
export interface CreateCustomerParams {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
  description?: string;
}

export interface CreateSubscriptionParams {
  customer: string;
  items: Array<{ price: string; quantity?: number }>;
  payment_behavior?: 'default_incomplete' | 'allow_incomplete' | 'error_if_incomplete';
  expand?: string[];
  metadata?: Record<string, string>;
  trial_period_days?: number;
}

export interface UpdateSubscriptionParams {
  cancel_at_period_end?: boolean;
  items?: Array<{ price: string; quantity?: number }>;
  metadata?: Record<string, string>;
  proration_behavior?: 'none' | 'create_prorations' | 'always_invoice';
}

export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  customer?: string;
  payment_method?: string;
  confirmation_method?: 'automatic' | 'manual';
  confirm?: boolean;
  metadata?: Record<string, string>;
  description?: string;
}

export interface CreateCheckoutSessionParams {
  customer?: string;
  customer_email?: string;
  line_items: Array<{ 
    price: string; 
    quantity: number;
    adjustable_quantity?: {
      enabled: boolean;
      minimum?: number;
      maximum?: number;
    };
  }>;
  mode: 'subscription' | 'payment' | 'setup';
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
  allow_promotion_codes?: boolean;
  billing_address_collection?: 'auto' | 'required';
  payment_method_types?: string[];
  subscription_data?: {
    trial_period_days?: number;
    metadata?: Record<string, string>;
  };
}

// Payment provider interface
export interface PaymentProvider {
  // Core operations
  createCustomer(params: CreateCustomerParams): Promise<PaymentCustomer>;
  retrieveCustomer(customerId: string): Promise<PaymentCustomer>;
  updateCustomer(customerId: string, params: Partial<CreateCustomerParams>): Promise<PaymentCustomer>;
  
  // Subscription operations
  createSubscription(params: CreateSubscriptionParams): Promise<PaymentSubscription>;
  retrieveSubscription(subscriptionId: string): Promise<PaymentSubscription>;
  updateSubscription(subscriptionId: string, params: UpdateSubscriptionParams): Promise<PaymentSubscription>;
  cancelSubscription(subscriptionId: string): Promise<PaymentSubscription>;
  
  // Payment Intent operations
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent>;
  retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntent>;
  confirmPaymentIntent(paymentIntentId: string, params?: any): Promise<PaymentIntent>;
  
  // Checkout Session operations
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession>;
  retrieveCheckoutSession(sessionId: string): Promise<CheckoutSession>;
  
  // Payment Method operations
  attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<PaymentMethod>;
  detachPaymentMethod(paymentMethodId: string): Promise<PaymentMethod>;
  listPaymentMethods(customerId: string, type?: string): Promise<{ data: PaymentMethod[] }>;
  
  // Invoice operations
  retrieveInvoice(invoiceId: string): Promise<Invoice>;
  listInvoices(customerId?: string): Promise<{ data: Invoice[] }>;
  
  // Webhook operations
  constructEvent(payload: string, signature: string, secret: string): WebhookEvent;
  
  // Utility operations
  isTestMode(): boolean;
  getProviderName(): string;
}

// Database update interfaces
export interface CreditsPurchaseData {
  userId: number;
  credits: number;
  packageType: string;
  amount: number;
  currency: string;
  paymentIntentId?: string;
  sessionId?: string;
}

export interface SubscriptionUpdateData {
  userId: number;
  subscriptionId: string;
  customerId: string;
  tier: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  priceId: string;
}

export interface TransactionCreateData {
  userId: number;
  type: string;
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, any>;
  paymentIntentId?: string;
  invoiceId?: string;
  subscriptionId?: string;
}

// Payment service interface with database operations
export interface PaymentService extends PaymentProvider {
  // Database operations
  processCreditsPayment(data: CreditsPurchaseData): Promise<void>;
  processSubscriptionPayment(data: SubscriptionUpdateData): Promise<void>;
  createTransactionRecord(data: TransactionCreateData): Promise<number>;
  
  // Webhook handling
  handleWebhook(payload: string, signature: string): Promise<void>;
  
  // Mock-specific operations (only available on mock provider)
  simulateCheckoutCompletion?(sessionId: string): Promise<WebhookEvent>;
  simulatePaymentSuccess?(paymentIntentId: string): Promise<WebhookEvent>;
  simulateWebhookEvent?(eventType: string, data: any): Promise<void>;
  
  // Test utilities
  clearTestData?(): Promise<void>;
  getTestData?(): Promise<any>;
}

// Environment configuration
export interface PaymentConfig {
  provider: 'stripe' | 'mock';
  stripe?: {
    secretKey: string;
    publishableKey: string;
    webhookSecret: string;
  };
  mock?: {
    enabled: boolean;
    logPayments: boolean;
    simulateErrors: boolean;
    errorRate: number;
    baseUrl: string;
  };
  appUrl: string;
}

// Error types
export class PaymentError extends Error {
  constructor(
    message: string,
    public code?: string,
    public type?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class PaymentProviderError extends PaymentError {
  constructor(
    message: string,
    public provider: string,
    code?: string,
    type?: string
  ) {
    super(message, code, type);
    this.name = 'PaymentProviderError';
  }
}