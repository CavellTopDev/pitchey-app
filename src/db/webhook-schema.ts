/**
 * Comprehensive Webhook System Database Schema
 * For real-time third-party integrations
 */

import { pgTable, serial, integer, varchar, text, boolean, timestamp, decimal, jsonb, pgEnum, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./schema";

// Webhook event types enum
export const webhookEventTypeEnum = pgEnum("webhook_event_type", [
  // User lifecycle events
  "user.created", "user.updated", "user.deleted", "user.activated", "user.deactivated",
  "user.verified", "user.subscription_changed", "user.login", "user.logout",
  
  // Pitch lifecycle events  
  "pitch.created", "pitch.updated", "pitch.deleted", "pitch.published", "pitch.unpublished",
  "pitch.viewed", "pitch.liked", "pitch.saved", "pitch.shared", "pitch.commented",
  
  // NDA workflow events
  "nda.requested", "nda.approved", "nda.rejected", "nda.signed", "nda.expired",
  "nda.access_granted", "nda.access_revoked",
  
  // Investment events
  "investment.created", "investment.updated", "investment.approved", "investment.rejected",
  "investment.funded", "investment.completed", "investment.cancelled",
  
  // Message events
  "message.sent", "message.received", "message.read", "message.replied",
  "conversation.created", "conversation.archived",
  
  // Payment events
  "payment.created", "payment.succeeded", "payment.failed", "payment.refunded",
  "subscription.created", "subscription.updated", "subscription.cancelled",
  "subscription.renewed", "subscription.trial_ended",
  
  // Analytics events
  "analytics.event_tracked", "analytics.milestone_reached", "analytics.report_generated",
  
  // Production workflow events
  "production.review_started", "production.review_completed", "production.approved",
  "production.rejected", "production.calendar_event_created",
  
  // System events
  "system.maintenance_started", "system.maintenance_completed", "system.error_detected",
  "system.security_alert", "system.backup_completed",
  
  // Custom events
  "custom.workflow_triggered", "custom.automation_executed", "custom.integration_sync"
]);

// Webhook delivery status enum
export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "pending", "processing", "succeeded", "failed", "retrying", "cancelled", "expired"
]);

// Webhook endpoints table - stores registered webhook endpoints
export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Endpoint configuration
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  url: text("url").notNull(),
  
  // Security
  secret: varchar("secret", { length: 255 }).notNull(), // HMAC secret for signature verification
  isActive: boolean("is_active").default(true),
  
  // Event filtering
  eventTypes: varchar("event_types", { length: 100 }).array().notNull(), // Which events to subscribe to
  eventFilters: jsonb("event_filters").default("{}"), // Additional filtering criteria
  
  // Delivery settings
  timeout: integer("timeout").default(30), // Request timeout in seconds
  retryPolicy: jsonb("retry_policy").default('{"maxAttempts": 3, "backoffType": "exponential", "baseDelay": 1000}'),
  
  // Rate limiting
  rateLimit: integer("rate_limit").default(100), // Max deliveries per minute
  
  // Metadata
  headers: jsonb("headers").default("{}"), // Custom headers to send with requests
  metadata: jsonb("metadata").default("{}"),
  tags: varchar("tags", { length: 50 }).array().default([]),
  
  // Statistics
  totalDeliveries: integer("total_deliveries").default(0),
  successfulDeliveries: integer("successful_deliveries").default(0),
  failedDeliveries: integer("failed_deliveries").default(0),
  lastDeliveryAt: timestamp("last_delivery_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastFailureAt: timestamp("last_failure_at"),
  
  // Health monitoring
  healthStatus: varchar("health_status", { length: 20 }).default("healthy"), // healthy, degraded, unhealthy
  averageResponseTime: integer("average_response_time"), // in milliseconds
  uptimePercentage: decimal("uptime_percentage", { precision: 5, scale: 2 }).default("100.00"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("webhook_endpoints_user_id_idx").on(table.userId),
  activeIdx: index("webhook_endpoints_active_idx").on(table.isActive),
  eventTypesIdx: index("webhook_endpoints_event_types_idx").on(table.eventTypes),
  healthStatusIdx: index("webhook_endpoints_health_status_idx").on(table.healthStatus),
}));

// Webhook events table - stores events to be delivered
export const webhookEvents = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  
  // Event identification
  eventId: varchar("event_id", { length: 255 }).notNull().unique(), // UUID for idempotency
  eventType: webhookEventTypeEnum("event_type").notNull(),
  eventVersion: varchar("event_version", { length: 10 }).default("1.0"),
  
  // Event data
  resourceType: varchar("resource_type", { length: 50 }), // pitch, user, investment, etc.
  resourceId: integer("resource_id"),
  payload: jsonb("payload").notNull(),
  
  // Context
  triggeredBy: integer("triggered_by").references(() => users.id, { onDelete: "set null" }),
  triggeredAt: timestamp("triggered_at").defaultNow(),
  source: varchar("source", { length: 100 }).default("api"), // api, system, cron, etc.
  
  // Delivery tracking
  totalEndpoints: integer("total_endpoints").default(0),
  successfulDeliveries: integer("successful_deliveries").default(0),
  failedDeliveries: integer("failed_deliveries").default(0),
  pendingDeliveries: integer("pending_deliveries").default(0),
  
  // Processing status
  processingStatus: varchar("processing_status", { length: 20 }).default("pending"), // pending, processing, completed, failed
  processedAt: timestamp("processed_at"),
  
  // Metadata
  metadata: jsonb("metadata").default("{}"),
  correlationId: varchar("correlation_id", { length: 255 }), // For tracing related events
  
  // Retention
  expiresAt: timestamp("expires_at"), // Auto-cleanup old events
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  eventIdIdx: index("webhook_events_event_id_idx").on(table.eventId),
  eventTypeIdx: index("webhook_events_event_type_idx").on(table.eventType),
  resourceIdx: index("webhook_events_resource_idx").on(table.resourceType, table.resourceId),
  triggeredByIdx: index("webhook_events_triggered_by_idx").on(table.triggeredBy),
  triggeredAtIdx: index("webhook_events_triggered_at_idx").on(table.triggeredAt),
  processingStatusIdx: index("webhook_events_processing_status_idx").on(table.processingStatus),
  expiresAtIdx: index("webhook_events_expires_at_idx").on(table.expiresAt),
  correlationIdx: index("webhook_events_correlation_idx").on(table.correlationId),
}));

// Webhook deliveries table - tracks individual delivery attempts
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  
  // Relations
  eventId: integer("event_id").references(() => webhookEvents.id, { onDelete: "cascade" }).notNull(),
  endpointId: integer("endpoint_id").references(() => webhookEndpoints.id, { onDelete: "cascade" }).notNull(),
  
  // Delivery tracking
  deliveryId: varchar("delivery_id", { length: 255 }).notNull().unique(), // UUID for tracking
  status: webhookDeliveryStatusEnum("status").default("pending"),
  
  // Request details
  httpMethod: varchar("http_method", { length: 10 }).default("POST"),
  requestUrl: text("request_url").notNull(),
  requestHeaders: jsonb("request_headers").default("{}"),
  requestPayload: jsonb("request_payload").notNull(),
  
  // Response details
  responseStatus: integer("response_status"),
  responseHeaders: jsonb("response_headers"),
  responseBody: text("response_body"),
  responseTime: integer("response_time"), // in milliseconds
  
  // Retry information
  attemptNumber: integer("attempt_number").default(1),
  maxAttempts: integer("max_attempts").default(3),
  nextRetryAt: timestamp("next_retry_at"),
  
  // Error tracking
  errorMessage: text("error_message"),
  errorCode: varchar("error_code", { length: 100 }),
  errorDetails: jsonb("error_details"),
  
  // Timing
  scheduledAt: timestamp("scheduled_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  // Metadata
  metadata: jsonb("metadata").default("{}"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  eventIdIdx: index("webhook_deliveries_event_id_idx").on(table.eventId),
  endpointIdIdx: index("webhook_deliveries_endpoint_id_idx").on(table.endpointId),
  statusIdx: index("webhook_deliveries_status_idx").on(table.status),
  scheduledAtIdx: index("webhook_deliveries_scheduled_at_idx").on(table.scheduledAt),
  nextRetryAtIdx: index("webhook_deliveries_next_retry_at_idx").on(table.nextRetryAt),
  completedAtIdx: index("webhook_deliveries_completed_at_idx").on(table.completedAt),
  deliveryIdIdx: index("webhook_deliveries_delivery_id_idx").on(table.deliveryId),
}));

// Webhook subscriptions table - many-to-many relationship with advanced filtering
export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: serial("id").primaryKey(),
  endpointId: integer("endpoint_id").references(() => webhookEndpoints.id, { onDelete: "cascade" }).notNull(),
  
  // Event filtering
  eventType: webhookEventTypeEnum("event_type").notNull(),
  resourceType: varchar("resource_type", { length: 50 }),
  
  // Advanced filtering
  filters: jsonb("filters").default("{}"), // Complex filtering rules
  transformations: jsonb("transformations").default("{}"), // Data transformation rules
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Statistics
  eventCount: integer("event_count").default(0),
  lastTriggeredAt: timestamp("last_triggered_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  endpointEventIdx: index("webhook_subscriptions_endpoint_event_idx").on(table.endpointId, table.eventType),
  eventTypeIdx: index("webhook_subscriptions_event_type_idx").on(table.eventType),
  activeIdx: index("webhook_subscriptions_active_idx").on(table.isActive),
  uniqueSubscription: unique().on(table.endpointId, table.eventType, table.resourceType),
}));

// Webhook logs table - detailed logging for debugging
export const webhookLogs = pgTable("webhook_logs", {
  id: serial("id").primaryKey(),
  
  // Relations (optional for system-level logs)
  eventId: integer("event_id").references(() => webhookEvents.id, { onDelete: "set null" }),
  endpointId: integer("endpoint_id").references(() => webhookEndpoints.id, { onDelete: "set null" }),
  deliveryId: integer("delivery_id").references(() => webhookDeliveries.id, { onDelete: "set null" }),
  
  // Log details
  level: varchar("level", { length: 10 }).notNull(), // debug, info, warn, error
  message: text("message").notNull(),
  context: jsonb("context").default("{}"),
  
  // Categorization
  category: varchar("category", { length: 50 }).default("delivery"), // delivery, security, system, performance
  component: varchar("component", { length: 50 }), // parser, validator, sender, etc.
  
  // Request context
  requestId: varchar("request_id", { length: 255 }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  eventIdIdx: index("webhook_logs_event_id_idx").on(table.eventId),
  endpointIdIdx: index("webhook_logs_endpoint_id_idx").on(table.endpointId),
  levelIdx: index("webhook_logs_level_idx").on(table.level),
  categoryIdx: index("webhook_logs_category_idx").on(table.category),
  timestampIdx: index("webhook_logs_timestamp_idx").on(table.timestamp),
  requestIdIdx: index("webhook_logs_request_id_idx").on(table.requestId),
}));

// Webhook analytics table - aggregated metrics
export const webhookAnalytics = pgTable("webhook_analytics", {
  id: serial("id").primaryKey(),
  
  // Scope
  endpointId: integer("endpoint_id").references(() => webhookEndpoints.id, { onDelete: "cascade" }),
  eventType: webhookEventTypeEnum("event_type"),
  
  // Time period
  period: varchar("period", { length: 20 }).notNull(), // hour, day, week, month
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Delivery metrics
  totalDeliveries: integer("total_deliveries").default(0),
  successfulDeliveries: integer("successful_deliveries").default(0),
  failedDeliveries: integer("failed_deliveries").default(0),
  retriedDeliveries: integer("retried_deliveries").default(0),
  
  // Performance metrics
  averageResponseTime: integer("average_response_time"), // milliseconds
  p50ResponseTime: integer("p50_response_time"),
  p95ResponseTime: integer("p95_response_time"),
  p99ResponseTime: integer("p99_response_time"),
  
  // Error analysis
  errorRate: decimal("error_rate", { precision: 5, scale: 4 }),
  timeoutRate: decimal("timeout_rate", { precision: 5, scale: 4 }),
  commonErrors: jsonb("common_errors").default("{}"),
  
  // Traffic patterns
  peakHour: integer("peak_hour"), // 0-23
  quietHour: integer("quiet_hour"), // 0-23
  trafficPattern: jsonb("traffic_pattern").default("{}"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  endpointPeriodIdx: index("webhook_analytics_endpoint_period_idx").on(table.endpointId, table.period),
  eventTypePeriodIdx: index("webhook_analytics_event_type_period_idx").on(table.eventType, table.period),
  periodStartIdx: index("webhook_analytics_period_start_idx").on(table.periodStart),
  uniquePeriod: unique().on(table.endpointId, table.eventType, table.period, table.periodStart),
}));

// Webhook rate limits table - dynamic rate limiting
export const webhookRateLimits = pgTable("webhook_rate_limits", {
  id: serial("id").primaryKey(),
  endpointId: integer("endpoint_id").references(() => webhookEndpoints.id, { onDelete: "cascade" }).notNull(),
  
  // Rate limiting configuration
  windowSize: integer("window_size").default(60), // seconds
  maxRequests: integer("max_requests").default(100),
  
  // Current usage
  currentCount: integer("current_count").default(0),
  windowStart: timestamp("window_start").defaultNow(),
  windowEnd: timestamp("window_end"),
  
  // Violation tracking
  violations: integer("violations").default(0),
  lastViolationAt: timestamp("last_violation_at"),
  
  // Adaptive limits
  isAdaptive: boolean("is_adaptive").default(false),
  baseLimit: integer("base_limit"),
  adaptiveMultiplier: decimal("adaptive_multiplier", { precision: 3, scale: 2 }).default("1.00"),
  
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  endpointIdIdx: index("webhook_rate_limits_endpoint_id_idx").on(table.endpointId),
  windowEndIdx: index("webhook_rate_limits_window_end_idx").on(table.windowEnd),
  uniqueEndpoint: unique().on(table.endpointId),
}));

// Webhook circuit breakers table - for failing endpoints
export const webhookCircuitBreakers = pgTable("webhook_circuit_breakers", {
  id: serial("id").primaryKey(),
  endpointId: integer("endpoint_id").references(() => webhookEndpoints.id, { onDelete: "cascade" }).notNull(),
  
  // Circuit breaker state
  state: varchar("state", { length: 20 }).default("closed"), // closed, open, half-open
  
  // Configuration
  failureThreshold: integer("failure_threshold").default(5), // failures before opening
  successThreshold: integer("success_threshold").default(2), // successes before closing from half-open
  timeout: integer("timeout").default(300), // seconds to wait before trying half-open
  
  // Counters
  consecutiveFailures: integer("consecutive_failures").default(0),
  consecutiveSuccesses: integer("consecutive_successes").default(0),
  
  // Timing
  lastFailureAt: timestamp("last_failure_at"),
  lastSuccessAt: timestamp("last_success_at"),
  nextAttemptAt: timestamp("next_attempt_at"),
  openedAt: timestamp("opened_at"),
  
  // Statistics for the current window
  windowStart: timestamp("window_start").defaultNow(),
  windowFailures: integer("window_failures").default(0),
  windowSuccesses: integer("window_successes").default(0),
  
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  endpointIdIdx: index("webhook_circuit_breakers_endpoint_id_idx").on(table.endpointId),
  stateIdx: index("webhook_circuit_breakers_state_idx").on(table.state),
  nextAttemptIdx: index("webhook_circuit_breakers_next_attempt_idx").on(table.nextAttemptAt),
  uniqueEndpoint: unique().on(table.endpointId),
}));

// Webhook templates table - for common integration patterns
export const webhookTemplates = pgTable("webhook_templates", {
  id: serial("id").primaryKey(),
  
  // Template information
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }), // crm, email, analytics, etc.
  provider: varchar("provider", { length: 100 }), // salesforce, hubspot, mailchimp, etc.
  
  // Template configuration
  eventTypes: varchar("event_types", { length: 100 }).array().notNull(),
  urlTemplate: text("url_template").notNull(),
  headerTemplates: jsonb("header_templates").default("{}"),
  payloadTemplate: jsonb("payload_template").notNull(),
  
  // Transformation rules
  fieldMappings: jsonb("field_mappings").default("{}"),
  filterRules: jsonb("filter_rules").default("{}"),
  transformationRules: jsonb("transformation_rules").default("{}"),
  
  // Configuration
  defaultTimeout: integer("default_timeout").default(30),
  defaultRetryPolicy: jsonb("default_retry_policy").default('{"maxAttempts": 3, "backoffType": "exponential"}'),
  recommendedRateLimit: integer("recommended_rate_limit").default(100),
  
  // Documentation
  documentation: text("documentation"),
  setupInstructions: text("setup_instructions"),
  examplePayload: jsonb("example_payload"),
  
  // Metadata
  tags: varchar("tags", { length: 50 }).array().default([]),
  isPublic: boolean("is_public").default(false),
  usageCount: integer("usage_count").default(0),
  
  // Versioning
  version: varchar("version", { length: 10 }).default("1.0"),
  isActive: boolean("is_active").default(true),
  
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  categoryIdx: index("webhook_templates_category_idx").on(table.category),
  providerIdx: index("webhook_templates_provider_idx").on(table.provider),
  publicIdx: index("webhook_templates_public_idx").on(table.isPublic),
  activeIdx: index("webhook_templates_active_idx").on(table.isActive),
  usageCountIdx: index("webhook_templates_usage_count_idx").on(table.usageCount),
}));

// Webhook test results table - for endpoint testing
export const webhookTestResults = pgTable("webhook_test_results", {
  id: serial("id").primaryKey(),
  endpointId: integer("endpoint_id").references(() => webhookEndpoints.id, { onDelete: "cascade" }).notNull(),
  
  // Test details
  testId: varchar("test_id", { length: 255 }).notNull(),
  testType: varchar("test_type", { length: 50 }).notNull(), // connectivity, payload, performance, security
  
  // Test configuration
  testPayload: jsonb("test_payload"),
  testHeaders: jsonb("test_headers").default("{}"),
  
  // Results
  passed: boolean("passed").notNull(),
  responseStatus: integer("response_status"),
  responseTime: integer("response_time"), // milliseconds
  responseBody: text("response_body"),
  
  // Validation results
  validationResults: jsonb("validation_results").default("{}"),
  securityChecks: jsonb("security_checks").default("{}"),
  performanceMetrics: jsonb("performance_metrics").default("{}"),
  
  // Error details
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  
  // Context
  triggeredBy: integer("triggered_by").references(() => users.id, { onDelete: "set null" }),
  automatedTest: boolean("automated_test").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  endpointIdIdx: index("webhook_test_results_endpoint_id_idx").on(table.endpointId),
  testTypeIdx: index("webhook_test_results_test_type_idx").on(table.testType),
  passedIdx: index("webhook_test_results_passed_idx").on(table.passed),
  triggeredByIdx: index("webhook_test_results_triggered_by_idx").on(table.triggeredBy),
  createdAtIdx: index("webhook_test_results_created_at_idx").on(table.createdAt),
}));

// Relations
export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  user: one(users, {
    fields: [webhookEndpoints.userId],
    references: [users.id],
  }),
  subscriptions: many(webhookSubscriptions),
  deliveries: many(webhookDeliveries),
  rateLimit: one(webhookRateLimits),
  circuitBreaker: one(webhookCircuitBreakers),
  analytics: many(webhookAnalytics),
  testResults: many(webhookTestResults),
}));

export const webhookEventsRelations = relations(webhookEvents, ({ one, many }) => ({
  triggeredBy: one(users, {
    fields: [webhookEvents.triggeredBy],
    references: [users.id],
  }),
  deliveries: many(webhookDeliveries),
  logs: many(webhookLogs),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  event: one(webhookEvents, {
    fields: [webhookDeliveries.eventId],
    references: [webhookEvents.id],
  }),
  endpoint: one(webhookEndpoints, {
    fields: [webhookDeliveries.endpointId],
    references: [webhookEndpoints.id],
  }),
}));

export const webhookSubscriptionsRelations = relations(webhookSubscriptions, ({ one }) => ({
  endpoint: one(webhookEndpoints, {
    fields: [webhookSubscriptions.endpointId],
    references: [webhookEndpoints.id],
  }),
}));

export const webhookTemplatesRelations = relations(webhookTemplates, ({ one }) => ({
  createdBy: one(users, {
    fields: [webhookTemplates.createdBy],
    references: [users.id],
  }),
}));

// Export types
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type WebhookAnalytics = typeof webhookAnalytics.$inferSelect;
export type WebhookRateLimit = typeof webhookRateLimits.$inferSelect;
export type WebhookCircuitBreaker = typeof webhookCircuitBreakers.$inferSelect;
export type WebhookTemplate = typeof webhookTemplates.$inferSelect;
export type WebhookTestResult = typeof webhookTestResults.$inferSelect;