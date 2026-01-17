/**
 * Unified Environment Interface for Cloudflare Workers
 * Consolidates all environment variables and bindings across the application
 */

export interface UnifiedEnv {
  // Database
  DATABASE_URL: string;
  READ_REPLICA_URLS?: string;
  
  // Auth
  JWT_SECRET: string;
  BETTER_AUTH_SECRET?: string;
  
  // KV Namespaces
  KV: KVNamespace;
  CACHE: KVNamespace;
  SESSIONS_KV: KVNamespace;
  RATE_LIMIT_KV: KVNamespace;
  EMAIL_CACHE?: KVNamespace;
  NOTIFICATION_CACHE?: KVNamespace;
  MONITORING_KV?: KVNamespace;
  SESSION_STORE?: KVNamespace;
  
  // R2 Buckets
  R2_BUCKET: R2Bucket;
  MESSAGE_ATTACHMENTS?: R2Bucket;
  EMAIL_ATTACHMENTS?: R2Bucket;
  MEDIA_STORAGE?: R2Bucket;
  NDA_STORAGE?: R2Bucket;
  PITCH_STORAGE?: R2Bucket;
  TRACE_LOGS?: R2Bucket;
  
  // Queues
  EMAIL_QUEUE?: Queue;
  NOTIFICATION_QUEUE?: Queue;
  
  // Email Config
  SENDGRID_API_KEY?: string;
  SENDGRID_FROM_EMAIL?: string;
  SENDGRID_FROM_NAME?: string;
  RESEND_API_KEY?: string;
  
  // Redis
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  
  // URLs
  FRONTEND_URL: string;
  BACKEND_URL?: string;
  ORIGIN_URL?: string;
  
  // Environment
  ENVIRONMENT: 'development' | 'staging' | 'production';
  
  // Services
  HYPERDRIVE?: Hyperdrive;
  WEBSOCKET_ROOM?: DurableObjectNamespace;
  
  // Push Notifications
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  
  // Monitoring
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
  
  // Stripe
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  
  // Storage
  STORAGE_PROVIDER?: string;
  USE_LOCAL_FALLBACK?: boolean;
  
  // Cache settings
  CACHE_ENABLED?: boolean;
  
  // Feature flags
  ENABLE_WEBSOCKETS?: boolean;
  ENABLE_PUSH_NOTIFICATIONS?: boolean;
  
  // Allow any additional properties for flexibility
  [key: string]: any;
}