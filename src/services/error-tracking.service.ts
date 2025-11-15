/**
 * Advanced Error Tracking and Alerting Service
 * Provides comprehensive error monitoring, analysis, and intelligent alerting
 */

import { telemetry } from "../utils/telemetry.ts";

export interface ErrorEvent {
  id: string;
  timestamp: number;
  level: "critical" | "error" | "warning" | "info";
  message: string;
  error: any;
  stack?: string;
  context: {
    userId?: string;
    sessionId?: string;
    route?: string;
    method?: string;
    userAgent?: string;
    ip?: string;
    environment?: string;
    version?: string;
  };
  fingerprint: string;
  tags: string[];
  metadata: Record<string, any>;
  resolved: boolean;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: {
    type: "frequency" | "severity" | "pattern" | "threshold";
    value: any;
    timeWindow: number;
  };
  channels: string[];
  enabled: boolean;
  cooldown: number;
  lastTriggered?: number;
  filters: {
    level?: string[];
    route?: string[];
    environment?: string[];
    tags?: string[];
  };
}

export interface AlertChannel {
  id: string;
  type: "email" | "webhook" | "slack" | "discord" | "sms";
  name: string;
  config: Record<string, any>;
  enabled: boolean;
}

export interface ErrorMetrics {
  totalErrors: number;
  criticalErrors: number;
  errorsByLevel: Record<string, number>;
  errorsByRoute: Record<string, number>;
  errorRate: number;
  mttr: number; // Mean Time To Resolution
  unresolvedErrors: number;
  topErrors: ErrorEvent[];
  recentTrends: Array<{
    timestamp: number;
    count: number;
    level: string;
  }>;
}

export class ErrorTrackingService {
  private static instance: ErrorTrackingService;
  private errors: Map<string, ErrorEvent> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private alertChannels: Map<string, AlertChannel> = new Map();
  private alertHistory: Array<{
    id: string;
    ruleId: string;
    timestamp: number;
    errorId: string;
    sent: boolean;
    response?: any;
  }> = [];
  
  private isInitialized = false;
  private settings = {
    maxErrors: 10000,
    retentionDays: 30,
    enableAutoResolution: true,
    autoResolutionHours: 24,
    enableTrendAnalysis: true,
    enableMachineLearning: false,
    alertCooldownMinutes: 15
  };

  private errorPatterns: Map<string, {
    count: number;
    lastSeen: number;
    confidence: number;
    prediction: "increasing" | "stable" | "decreasing";
  }> = new Map();

  public static getInstance(): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService();
    }
    return ErrorTrackingService.instance;
  }

  public initialize(config?: Partial<typeof this.settings>): void {
    if (this.isInitialized) return;

    this.settings = { ...this.settings, ...config };
    this.setupDefaultAlertRules();
    this.setupDefaultChannels();
    this.startBackgroundTasks();
    this.isInitialized = true;

    telemetry.logger.info("Error tracking service initialized", this.settings);
  }

  // Error tracking methods
  public trackError(error: any, context: Partial<ErrorEvent['context']> = {}): string {
    const errorId = this.generateErrorId(error, context);
    const fingerprint = this.generateFingerprint(error, context);
    const timestamp = Date.now();

    const existingError = this.errors.get(fingerprint);
    
    if (existingError) {
      // Update existing error
      existingError.count++;
      existingError.lastSeen = timestamp;
      existingError.context = { ...existingError.context, ...context };
    } else {
      // Create new error
      const errorEvent: ErrorEvent = {
        id: errorId,
        timestamp,
        level: this.determineErrorLevel(error, context),
        message: this.extractErrorMessage(error),
        error: this.sanitizeError(error),
        stack: this.extractStack(error),
        context: {
          environment: Deno.env.get("DENO_ENV") || "unknown",
          version: Deno.env.get("APP_VERSION") || "unknown",
          ...context
        },
        fingerprint,
        tags: this.extractTags(error, context),
        metadata: this.extractMetadata(error, context),
        resolved: false,
        count: 1,
        firstSeen: timestamp,
        lastSeen: timestamp
      };

      this.errors.set(fingerprint, errorEvent);
      
      // Send to external services
      this.sendToExternalServices(errorEvent);
    }

    // Check alert rules
    this.checkAlertRules(fingerprint);

    // Update patterns for ML
    if (this.settings.enableMachineLearning) {
      this.updateErrorPatterns(fingerprint);
    }

    // Clean up old errors
    this.cleanupOldErrors();

    return errorId;
  }

  public resolveError(fingerprint: string, userId?: string): boolean {
    const error = this.errors.get(fingerprint);
    if (!error || error.resolved) return false;

    error.resolved = true;
    error.metadata.resolvedBy = userId || "system";
    error.metadata.resolvedAt = Date.now();

    telemetry.logger.info("Error resolved", { fingerprint, userId });
    return true;
  }

  public getErrors(filters: {
    level?: string;
    resolved?: boolean;
    route?: string;
    limit?: number;
    offset?: number;
  } = {}): ErrorEvent[] {
    let errorList = Array.from(this.errors.values());

    // Apply filters
    if (filters.level) {
      errorList = errorList.filter(e => e.level === filters.level);
    }
    if (filters.resolved !== undefined) {
      errorList = errorList.filter(e => e.resolved === filters.resolved);
    }
    if (filters.route) {
      errorList = errorList.filter(e => e.context.route?.includes(filters.route));
    }

    // Sort by last seen (newest first)
    errorList.sort((a, b) => b.lastSeen - a.lastSeen);

    // Pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    return errorList.slice(offset, offset + limit);
  }

  public getErrorById(id: string): ErrorEvent | null {
    return Array.from(this.errors.values()).find(e => e.id === id) || null;
  }

  public getErrorByFingerprint(fingerprint: string): ErrorEvent | null {
    return this.errors.get(fingerprint) || null;
  }

  // Metrics and analytics
  public getMetrics(timeWindow: number = 24 * 60 * 60 * 1000): ErrorMetrics {
    const now = Date.now();
    const cutoff = now - timeWindow;
    const errors = Array.from(this.errors.values());
    const recentErrors = errors.filter(e => e.lastSeen >= cutoff);

    const errorsByLevel = recentErrors.reduce((acc, error) => {
      acc[error.level] = (acc[error.level] || 0) + error.count;
      return acc;
    }, {} as Record<string, number>);

    const errorsByRoute = recentErrors.reduce((acc, error) => {
      const route = error.context.route || "unknown";
      acc[route] = (acc[route] || 0) + error.count;
      return acc;
    }, {} as Record<string, number>);

    const totalErrors = recentErrors.reduce((sum, e) => sum + e.count, 0);
    const criticalErrors = recentErrors
      .filter(e => e.level === "critical")
      .reduce((sum, e) => sum + e.count, 0);

    const resolvedErrors = errors.filter(e => e.resolved && e.metadata.resolvedAt >= cutoff);
    const mttr = resolvedErrors.length > 0
      ? resolvedErrors.reduce((sum, e) => 
          sum + (e.metadata.resolvedAt - e.firstSeen), 0
        ) / resolvedErrors.length
      : 0;

    return {
      totalErrors,
      criticalErrors,
      errorsByLevel,
      errorsByRoute,
      errorRate: totalErrors / (timeWindow / (60 * 1000)), // errors per minute
      mttr,
      unresolvedErrors: errors.filter(e => !e.resolved).length,
      topErrors: recentErrors
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      recentTrends: this.calculateTrends(timeWindow)
    };
  }

  // Alert management
  public addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = crypto.randomUUID();
    this.alertRules.set(id, { ...rule, id });
    telemetry.logger.info("Alert rule added", { id, name: rule.name });
    return id;
  }

  public removeAlertRule(id: string): boolean {
    const removed = this.alertRules.delete(id);
    if (removed) {
      telemetry.logger.info("Alert rule removed", { id });
    }
    return removed;
  }

  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  public addAlertChannel(channel: Omit<AlertChannel, 'id'>): string {
    const id = crypto.randomUUID();
    this.alertChannels.set(id, { ...channel, id });
    telemetry.logger.info("Alert channel added", { id, type: channel.type });
    return id;
  }

  public removeAlertChannel(id: string): boolean {
    const removed = this.alertChannels.delete(id);
    if (removed) {
      telemetry.logger.info("Alert channel removed", { id });
    }
    return removed;
  }

  public getAlertChannels(): AlertChannel[] {
    return Array.from(this.alertChannels.values());
  }

  // Pattern analysis
  public getErrorPatterns(): Array<{
    fingerprint: string;
    pattern: typeof this.errorPatterns extends Map<any, infer V> ? V : never;
    error: ErrorEvent;
  }> {
    return Array.from(this.errorPatterns.entries())
      .map(([fingerprint, pattern]) => ({
        fingerprint,
        pattern,
        error: this.errors.get(fingerprint)!
      }))
      .filter(item => item.error)
      .sort((a, b) => b.pattern.confidence - a.pattern.confidence);
  }

  // Configuration
  public updateSettings(newSettings: Partial<typeof this.settings>): void {
    this.settings = { ...this.settings, ...newSettings };
    telemetry.logger.info("Error tracking settings updated", newSettings);
  }

  public getSettings(): typeof this.settings {
    return { ...this.settings };
  }

  // Private helper methods
  private generateErrorId(error: any, context: any): string {
    return crypto.randomUUID();
  }

  private generateFingerprint(error: any, context: any): string {
    const message = this.extractErrorMessage(error);
    const stack = this.extractStack(error);
    const route = context.route || "";
    
    // Create a stable fingerprint based on error characteristics
    const fingerprintData = `${message}:${route}:${stack?.split('\n')[0] || ''}`;
    
    // Simple hash function for demonstration
    let hash = 0;
    for (let i = 0; i < fingerprintData.length; i++) {
      const char = fingerprintData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  private determineErrorLevel(error: any, context: any): ErrorEvent['level'] {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('critical') || message.includes('fatal')) {
        return 'critical';
      }
      if (message.includes('warning') || message.includes('warn')) {
        return 'warning';
      }
    }
    
    // Check HTTP status codes
    if (context.statusCode) {
      if (context.statusCode >= 500) return 'critical';
      if (context.statusCode >= 400) return 'error';
      return 'warning';
    }

    return 'error';
  }

  private extractErrorMessage(error: any): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    return String(error);
  }

  private extractStack(error: any): string | undefined {
    if (error instanceof Error) return error.stack;
    if (error?.stack) return error.stack;
    return undefined;
  }

  private extractTags(error: any, context: any): string[] {
    const tags = [];
    
    if (context.route) {
      tags.push(`route:${context.route}`);
    }
    if (context.method) {
      tags.push(`method:${context.method}`);
    }
    if (context.environment) {
      tags.push(`env:${context.environment}`);
    }
    if (error instanceof TypeError) {
      tags.push('type:TypeError');
    }
    
    return tags;
  }

  private extractMetadata(error: any, context: any): Record<string, any> {
    return {
      originalError: error.constructor?.name,
      timestamp: Date.now(),
      ...context
    };
  }

  private sanitizeError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    return error;
  }

  private sendToExternalServices(errorEvent: ErrorEvent): void {
    // Send to Sentry if available
    try {
      telemetry.captureException(errorEvent.error, {
        tags: Object.fromEntries(errorEvent.tags.map(tag => {
          const [key, value] = tag.split(':');
          return [key, value || 'true'];
        })),
        extra: errorEvent.metadata,
        level: errorEvent.level as any
      });
    } catch (err) {
      console.warn('Failed to send to external service:', err);
    }
  }

  private checkAlertRules(fingerprint: string): void {
    const error = this.errors.get(fingerprint);
    if (!error) return;

    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      // Check cooldown
      if (rule.lastTriggered && 
          Date.now() - rule.lastTriggered < rule.cooldown) {
        continue;
      }

      if (this.shouldTriggerAlert(rule, error)) {
        this.triggerAlert(rule, error);
        rule.lastTriggered = Date.now();
      }
    }
  }

  private shouldTriggerAlert(rule: AlertRule, error: ErrorEvent): boolean {
    // Apply filters
    if (rule.filters.level && !rule.filters.level.includes(error.level)) {
      return false;
    }
    if (rule.filters.route && error.context.route && 
        !rule.filters.route.some(r => error.context.route!.includes(r))) {
      return false;
    }
    if (rule.filters.environment && error.context.environment && 
        !rule.filters.environment.includes(error.context.environment)) {
      return false;
    }

    // Check conditions
    const { condition } = rule;
    const now = Date.now();

    switch (condition.type) {
      case 'frequency':
        const recentErrors = Array.from(this.errors.values())
          .filter(e => now - e.lastSeen <= condition.timeWindow)
          .reduce((sum, e) => sum + e.count, 0);
        return recentErrors >= condition.value;

      case 'severity':
        return error.level === condition.value;

      case 'pattern':
        return error.message.includes(condition.value);

      case 'threshold':
        return error.count >= condition.value;

      default:
        return false;
    }
  }

  private async triggerAlert(rule: AlertRule, error: ErrorEvent): Promise<void> {
    const alertId = crypto.randomUUID();
    
    for (const channelId of rule.channels) {
      const channel = this.alertChannels.get(channelId);
      if (!channel || !channel.enabled) continue;

      try {
        await this.sendAlert(channel, rule, error);
        
        this.alertHistory.push({
          id: alertId,
          ruleId: rule.id,
          timestamp: Date.now(),
          errorId: error.id,
          sent: true
        });
      } catch (err) {
        this.alertHistory.push({
          id: alertId,
          ruleId: rule.id,
          timestamp: Date.now(),
          errorId: error.id,
          sent: false,
          response: err
        });
      }
    }
  }

  private async sendAlert(channel: AlertChannel, rule: AlertRule, error: ErrorEvent): Promise<void> {
    const alertData = {
      rule: rule.name,
      error: {
        message: error.message,
        level: error.level,
        count: error.count,
        firstSeen: new Date(error.firstSeen).toISOString(),
        lastSeen: new Date(error.lastSeen).toISOString()
      },
      context: error.context
    };

    switch (channel.type) {
      case 'webhook':
        await fetch(channel.config.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertData)
        });
        break;

      case 'email':
        // Implement email sending logic
        console.log(`Email alert: ${JSON.stringify(alertData)}`);
        break;

      case 'slack':
        // Implement Slack webhook
        if (channel.config.webhookUrl) {
          await fetch(channel.config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🚨 Error Alert: ${error.message}`,
              attachments: [{
                color: error.level === 'critical' ? 'danger' : 'warning',
                fields: [
                  { title: 'Level', value: error.level, short: true },
                  { title: 'Count', value: error.count.toString(), short: true },
                  { title: 'Route', value: error.context.route || 'unknown', short: true }
                ]
              }]
            })
          });
        }
        break;
    }
  }

  private updateErrorPatterns(fingerprint: string): void {
    const pattern = this.errorPatterns.get(fingerprint) || {
      count: 0,
      lastSeen: 0,
      confidence: 0,
      prediction: "stable" as const
    };

    pattern.count++;
    pattern.lastSeen = Date.now();
    
    // Simple trend analysis
    const timeDiff = pattern.lastSeen - pattern.lastSeen;
    if (timeDiff < 60000) { // Less than 1 minute
      pattern.prediction = "increasing";
      pattern.confidence = Math.min(100, pattern.confidence + 10);
    } else if (timeDiff > 3600000) { // More than 1 hour
      pattern.prediction = "decreasing";
      pattern.confidence = Math.max(0, pattern.confidence - 5);
    } else {
      pattern.prediction = "stable";
    }

    this.errorPatterns.set(fingerprint, pattern);
  }

  private calculateTrends(timeWindow: number): ErrorMetrics['recentTrends'] {
    const now = Date.now();
    const intervals = 24; // 24 data points
    const intervalSize = timeWindow / intervals;
    const trends = [];

    for (let i = 0; i < intervals; i++) {
      const start = now - (intervals - i) * intervalSize;
      const end = start + intervalSize;
      
      const errorsInInterval = Array.from(this.errors.values())
        .filter(e => e.lastSeen >= start && e.lastSeen < end);
      
      const count = errorsInInterval.reduce((sum, e) => sum + e.count, 0);
      const level = errorsInInterval.length > 0 
        ? errorsInInterval.reduce((prev, curr) => 
            prev.level === 'critical' ? prev : curr
          ).level
        : 'info';

      trends.push({
        timestamp: start,
        count,
        level
      });
    }

    return trends;
  }

  private cleanupOldErrors(): void {
    const cutoff = Date.now() - (this.settings.retentionDays * 24 * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [fingerprint, error] of this.errors) {
      if (error.lastSeen < cutoff) {
        this.errors.delete(fingerprint);
        removedCount++;
      }
    }

    // Ensure we don't exceed max errors
    if (this.errors.size > this.settings.maxErrors) {
      const sortedErrors = Array.from(this.errors.entries())
        .sort(([, a], [, b]) => a.lastSeen - b.lastSeen);
      
      const toRemove = this.errors.size - this.settings.maxErrors;
      for (let i = 0; i < toRemove; i++) {
        this.errors.delete(sortedErrors[i][0]);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      telemetry.logger.info("Cleaned up old errors", { removedCount });
    }
  }

  private setupDefaultAlertRules(): void {
    // Critical error alerts
    this.addAlertRule({
      name: "Critical Errors",
      condition: {
        type: "severity",
        value: "critical",
        timeWindow: 5 * 60 * 1000 // 5 minutes
      },
      channels: [],
      enabled: true,
      cooldown: 5 * 60 * 1000, // 5 minutes
      filters: {}
    });

    // High frequency errors
    this.addAlertRule({
      name: "High Frequency Errors",
      condition: {
        type: "frequency",
        value: 10,
        timeWindow: 5 * 60 * 1000 // 10 errors in 5 minutes
      },
      channels: [],
      enabled: true,
      cooldown: 15 * 60 * 1000, // 15 minutes
      filters: {}
    });
  }

  private setupDefaultChannels(): void {
    // Console channel for development
    this.addAlertChannel({
      type: "webhook",
      name: "Development Console",
      config: {
        url: "http://localhost:8001/api/alerts/console"
      },
      enabled: Deno.env.get("DENO_ENV") === "development"
    });
  }

  private startBackgroundTasks(): void {
    // Auto-resolution task
    if (this.settings.enableAutoResolution) {
      setInterval(() => {
        const cutoff = Date.now() - (this.settings.autoResolutionHours * 60 * 60 * 1000);
        let resolvedCount = 0;

        for (const error of this.errors.values()) {
          if (!error.resolved && error.lastSeen < cutoff) {
            error.resolved = true;
            error.metadata.resolvedBy = "auto-resolution";
            error.metadata.resolvedAt = Date.now();
            resolvedCount++;
          }
        }

        if (resolvedCount > 0) {
          telemetry.logger.info("Auto-resolved old errors", { resolvedCount });
        }
      }, 60 * 60 * 1000); // Run every hour
    }

    // Cleanup task
    setInterval(() => {
      this.cleanupOldErrors();
    }, 6 * 60 * 60 * 1000); // Run every 6 hours
  }
}