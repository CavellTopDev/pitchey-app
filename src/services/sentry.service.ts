// Sentry Error Tracking Service for Deno Backend
// This integrates Sentry for production error monitoring

const SENTRY_DSN = Deno.env.get("SENTRY_DSN") || Deno.env.get("SENTRY_DSN_BACKEND");

// Simple Sentry integration for Deno
class SentryService {
  private dsn: string | undefined;
  private environment: string;
  private enabled: boolean;

  constructor() {
    this.dsn = SENTRY_DSN;
    this.environment = Deno.env.get("DENO_ENV") || "production";
    
    // Only enable Sentry in production with valid DSN
    this.enabled = !!(this.dsn && this.environment === "production");

    if (this.enabled) {
      console.log(`✅ Sentry initialized for ${this.environment} environment`);
    } else {
      const reason = !this.dsn ? "DSN not configured" : `disabled in ${this.environment}`;
      console.log(`⚠️ Sentry error tracking disabled - ${reason}`);
    }
  }

  // Capture an exception
  captureException(error: Error, context?: Record<string, any>) {
    if (!this.enabled || !this.dsn) return;

    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        timestamp: new Date().toISOString(),
        environment: this.environment,
        context: context || {},
        platform: "javascript",
        server_name: "pitchey-backend",
      };

      // Send to Sentry
      this.sendToSentry("error", errorData);
      
      // Also log locally
      console.error("[Sentry]", error.message, context);
    } catch (err) {
      console.error("Failed to send error to Sentry:", err);
    }
  }

  // Capture a message
  captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
    if (!this.enabled || !this.dsn) return;

    try {
      const messageData = {
        message,
        level,
        timestamp: new Date().toISOString(),
        environment: this.environment,
        platform: "javascript",
        server_name: "pitchey-backend",
      };

      this.sendToSentry("message", messageData);
      console.log(`[Sentry ${level}]`, message);
    } catch (err) {
      console.error("Failed to send message to Sentry:", err);
    }
  }

  // Add user context
  setUser(user: { id?: string | number; email?: string; username?: string }) {
    if (!this.enabled) return;
    
    // Store user context for future error reports
    // This would be attached to subsequent error reports
    console.log("[Sentry] User context set:", user.email || user.id);
  }

  // Add custom tags
  setTag(key: string, value: string) {
    if (!this.enabled) return;
    console.log(`[Sentry] Tag set: ${key}=${value}`);
  }

  // Add breadcrumb
  addBreadcrumb(breadcrumb: {
    message: string;
    category?: string;
    level?: "debug" | "info" | "warning" | "error";
    data?: Record<string, any>;
  }) {
    if (!this.enabled) return;
    console.log("[Sentry Breadcrumb]", breadcrumb.message);
  }

  // Send data to Sentry
  private async sendToSentry(type: "error" | "message", data: any) {
    if (!this.dsn) return;

    try {
      // Parse DSN
      const dsnUrl = new URL(this.dsn);
      const projectId = dsnUrl.pathname.substring(1);
      const key = dsnUrl.username;
      const sentryUrl = `https://${dsnUrl.host}/api/${projectId}/store/`;

      // Prepare Sentry envelope
      const envelope = {
        event_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        platform: "javascript",
        level: type === "error" ? "error" : "info",
        server_name: "pitchey-backend",
        environment: this.environment,
        ...data,
      };

      // Send to Sentry
      const response = await fetch(sentryUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=deno-custom/1.0, sentry_key=${key}`,
        },
        body: JSON.stringify(envelope),
      });

      if (!response.ok) {
        console.error("Sentry API error:", response.status, response.statusText);
      }
    } catch (error) {
      // Fail silently to not impact application
      console.error("Failed to send to Sentry:", error);
    }
  }

  // Wrap async functions with error handling
  wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context?: Record<string, any>
  ): T {
    if (!this.enabled) return fn;

    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.captureException(error as Error, {
          ...context,
          function: fn.name,
          args: args.slice(0, 3), // Limit args to prevent sensitive data exposure
        });
        throw error;
      }
    }) as T;
  }

  // Express/Oak middleware style error handler
  errorHandler() {
    return (error: Error, context?: any) => {
      this.captureException(error, context);
    };
  }
}

// Export singleton instance
export const sentryService = new SentryService();

// Export for convenience
export const captureException = (error: Error, context?: Record<string, any>) => 
  sentryService.captureException(error, context);

export const captureMessage = (message: string, level?: "info" | "warning" | "error") =>
  sentryService.captureMessage(message, level);

export const setUser = (user: { id?: string | number; email?: string; username?: string }) =>
  sentryService.setUser(user);

export const setTag = (key: string, value: string) =>
  sentryService.setTag(key, value);

export const addBreadcrumb = (breadcrumb: any) =>
  sentryService.addBreadcrumb(breadcrumb);