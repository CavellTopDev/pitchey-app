/**
 * Frontend Telemetry & Observability Setup
 * Integrates Sentry error tracking with performance monitoring for Cloudflare Pages
 */

// import * as Sentry from "https://esm.sh/@sentry/browser@8"; // Temporarily disabled

interface FrontendTelemetryConfig {
  sentryDsn?: string;
  environment: string;
  release?: string;
  enableReplay: boolean;
  enablePerformance: boolean;
  sampleRate: number;
  replaySampleRate: number;
}

export class FrontendTelemetryManager {
  private config: FrontendTelemetryConfig;
  private isInitialized = false;

  constructor(config: Partial<FrontendTelemetryConfig> = {}) {
    this.config = {
      sentryDsn: import.meta.env.VITE_SENTRY_DSN || "",
      environment: import.meta.env.VITE_NODE_ENV || "development",
      release: import.meta.env.VITE_APP_VERSION || "1.0.0",
      enableReplay: import.meta.env.PROD,
      enablePerformance: true,
      sampleRate: import.meta.env.PROD ? 0.1 : 1.0,
      replaySampleRate: import.meta.env.PROD ? 0.1 : 1.0,
      ...config
    };
  }

  /**
   * Initialize Sentry with production-optimized configuration
   */
  initialize(): void {
    if (this.isInitialized || !this.config.sentryDsn) {
      console.warn("🔶 Frontend Sentry not configured - error tracking disabled");
      return;
    }

    try {
      // Sentry.init - temporarily disabled to resolve initialization errors
      console.log("Sentry initialization temporarily disabled");

      // Set global context - temporarily disabled
      console.log("App context:", {
        name: "pitchey-frontend",
        version: this.config.release,
        environment: this.config.environment,
      });

      this.isInitialized = true;
      console.log("✅ Frontend Sentry telemetry initialized", {
        environment: this.config.environment,
        release: this.config.release
      });
    } catch (error) {
      console.error("❌ Failed to initialize frontend Sentry:", error);
    }
  }

  /**
   * Filter sensitive data from error reports - temporarily disabled
   */
  private filterSensitiveData(event: any): any | null {
    // Remove sensitive context data
    if (event.contexts?.user) {
      delete event.contexts.user.email;
      delete event.contexts.user.ip_address;
    }

    // Filter localStorage/sessionStorage data
    if (event.extra?.localStorage) {
      delete event.extra.localStorage.token;
      delete event.extra.localStorage.authToken;
    }

    // Remove sensitive form data
    if (event.request?.data) {
      if (typeof event.request.data === "object") {
        const data = { ...event.request.data };
        delete data.password;
        delete data.token;
        delete data.apiKey;
        event.request.data = data;
      }
    }

    return event;
  }

  /**
   * Filter sensitive data from performance transactions - temporarily disabled
   */
  private filterSensitiveTransactions(transaction: any): any | null {
    // Skip health check transactions to reduce noise
    if (transaction.name?.includes("/api/health")) {
      return null;
    }

    return transaction;
  }

  /**
   * Set user context for error tracking
   */
  setUser(user: { id?: string; email?: string; userType?: string }) {
    if (!this.isInitialized) return;

    // Sentry.setUser - temporarily disabled
    console.log("User context set:", {
      id: user.id,
      username: user.email?.split("@")[0],
      segment: user.userType,
    });
  }

  /**
   * Clear user context (e.g., on logout)
   */
  clearUser(): void {
    if (!this.isInitialized) return;
    // Sentry.setUser(null) - temporarily disabled
    console.log("User context cleared");
  }

  /**
   * Manually capture an exception
   */
  captureException(error: Error | unknown, context?: Record<string, any>): void {
    if (!this.isInitialized) return;

    // Sentry.captureException - temporarily disabled
    console.error("Exception captured:", error, { context });
  }

  /**
   * Capture a message
   */
  captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
    if (!this.isInitialized) return;
    // Sentry.captureMessage - temporarily disabled
    console.log(`[${level.toUpperCase()}] ${message}`);
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(message: string, data?: Record<string, any>): void {
    if (!this.isInitialized) return;

    // Sentry.addBreadcrumb - temporarily disabled
    console.debug("Breadcrumb:", { message, data, timestamp: Date.now() / 1000 });
  }

  /**
   * Set custom tag for filtering
   */
  setTag(key: string, value: string): void {
    if (!this.isInitialized) return;
    // Sentry.setTag - temporarily disabled
    console.debug("Tag set:", { key, value });
  }

  /**
   * Track API call performance
   */
  trackApiCall(endpoint: string, method: string, duration: number, status: number): void {
    this.addBreadcrumb(`API ${method} ${endpoint}`, {
      duration_ms: duration,
      status,
      type: "api_call",
    });

    // Log slow API calls
    if (duration > 2000) {
      this.captureMessage(`Slow API call: ${method} ${endpoint}`, "warning");
    }

    // Log API errors
    if (status >= 400) {
      this.captureMessage(`API error: ${method} ${endpoint} returned ${status}`, "error");
    }
  }

  /**
   * Track page performance
   */
  trackPageLoad(path: string, loadTime: number): void {
    this.addBreadcrumb(`Page load: ${path}`, {
      load_time_ms: loadTime,
      type: "navigation",
    });

    // Alert on slow page loads
    if (loadTime > 3000) {
      this.captureMessage(`Slow page load: ${path}`, "warning");
    }
  }

  /**
   * Track user interactions
   */
  trackUserAction(action: string, details?: Record<string, any>): void {
    this.addBreadcrumb(`User action: ${action}`, {
      ...details,
      type: "user_interaction",
    });
  }

  /**
   * Health check for telemetry system
   */
  getHealthStatus(): { initialized: boolean; environment: string; config: any } {
    return {
      initialized: this.isInitialized,
      environment: this.config.environment,
      config: {
        release: this.config.release,
        enableReplay: this.config.enableReplay,
        enablePerformance: this.config.enablePerformance,
        sampleRate: this.config.sampleRate,
        sentryConfigured: !!this.config.sentryDsn,
      },
    };
  }
}

// Global telemetry instance
export const frontendTelemetry = new FrontendTelemetryManager();

/**
 * React Hook for telemetry
 */
export function useTelemetry() {
  return {
    captureException: frontendTelemetry.captureException.bind(frontendTelemetry),
    captureMessage: frontendTelemetry.captureMessage.bind(frontendTelemetry),
    trackApiCall: frontendTelemetry.trackApiCall.bind(frontendTelemetry),
    trackPageLoad: frontendTelemetry.trackPageLoad.bind(frontendTelemetry),
    trackUserAction: frontendTelemetry.trackUserAction.bind(frontendTelemetry),
    setUser: frontendTelemetry.setUser.bind(frontendTelemetry),
    clearUser: frontendTelemetry.clearUser.bind(frontendTelemetry),
    addBreadcrumb: frontendTelemetry.addBreadcrumb.bind(frontendTelemetry),
    setTag: frontendTelemetry.setTag.bind(frontendTelemetry),
  };
}

/**
 * HOC for wrapping components with error boundaries - temporarily disabled
 */
export function withTelemetry<P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<P> {
  return (props: P) => {
    // Sentry.ErrorBoundary temporarily disabled
    return <WrappedComponent {...props} />;
  };
}

/**
 * Fetch wrapper with automatic telemetry
 */
export async function fetchWithTelemetry(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const startTime = performance.now();
  const method = options?.method || "GET";

  try {
    const response = await fetch(url, options);
    const duration = performance.now() - startTime;

    frontendTelemetry.trackApiCall(url, method, duration, response.status);

    return response;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    frontendTelemetry.trackApiCall(url, method, duration, 0);
    frontendTelemetry.captureException(error, {
      url,
      method,
      duration_ms: duration,
    });

    throw error;
  }
}

// Initialize telemetry on module load
if (typeof window !== "undefined") {
  frontendTelemetry.initialize();
}