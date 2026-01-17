/**
 * Analytics Tracking for High-Value CTAs
 *
 * Tracks user interactions with business-critical elements and sends to Axiom
 */

interface AnalyticsEvent {
  event: string;
  category: 'conversion' | 'engagement' | 'navigation' | 'error';
  label?: string;
  value?: number;
  userId?: string;
  userType?: string;
  metadata?: Record<string, any>;
}

interface CTAEvent {
  ctaName: string;
  ctaLocation: string;
  businessValue: 'high' | 'medium' | 'low';
  outcome?: 'success' | 'failure' | 'abandoned';
}

// High-value CTA definitions
export const HIGH_VALUE_CTAS = {
  // Creator actions
  CREATE_PITCH: { name: 'create_pitch', category: 'conversion', businessValue: 'high' },
  PUBLISH_PITCH: { name: 'publish_pitch', category: 'conversion', businessValue: 'high' },
  APPROVE_NDA: { name: 'approve_nda', category: 'conversion', businessValue: 'high' },
  REJECT_NDA: { name: 'reject_nda', category: 'engagement', businessValue: 'medium' },
  UPLOAD_DOCUMENT: { name: 'upload_document', category: 'engagement', businessValue: 'medium' },

  // Investor actions
  REQUEST_NDA: { name: 'request_nda', category: 'conversion', businessValue: 'high' },
  SIGN_NDA: { name: 'sign_nda', category: 'conversion', businessValue: 'high' },
  SAVE_PITCH: { name: 'save_pitch', category: 'engagement', businessValue: 'medium' },
  EXPRESS_INTEREST: { name: 'express_interest', category: 'conversion', businessValue: 'high' },
  MAKE_OFFER: { name: 'make_offer', category: 'conversion', businessValue: 'high' },

  // Production actions
  SHORTLIST_PITCH: { name: 'shortlist_pitch', category: 'engagement', businessValue: 'medium' },
  CONTACT_CREATOR: { name: 'contact_creator', category: 'conversion', businessValue: 'high' },
  START_NEGOTIATION: { name: 'start_negotiation', category: 'conversion', businessValue: 'high' },

  // Monetization
  UPGRADE_PLAN: { name: 'upgrade_plan', category: 'conversion', businessValue: 'high' },
  ADD_PAYMENT: { name: 'add_payment', category: 'conversion', businessValue: 'high' },
  PURCHASE_CREDITS: { name: 'purchase_credits', category: 'conversion', businessValue: 'high' },

  // Auth
  SIGN_UP: { name: 'sign_up', category: 'conversion', businessValue: 'high' },
  SIGN_IN: { name: 'sign_in', category: 'engagement', businessValue: 'medium' },
  USE_DEMO: { name: 'use_demo', category: 'engagement', businessValue: 'medium' },
} as const;

class Analytics {
  private apiUrl: string;
  private userId: string | null = null;
  private userType: string | null = null;
  private sessionId: string;
  private queue: AnalyticsEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.apiUrl = import.meta.env.VITE_API_URL || '';
    this.sessionId = this.generateSessionId();
    this.startFlushInterval();
    this.setupPageVisibility();
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private startFlushInterval() {
    // Flush events every 10 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 10000);
  }

  private setupPageVisibility() {
    // Flush when page becomes hidden (user navigates away)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });
  }

  /**
   * Set the current user for analytics
   */
  setUser(userId: string, userType: string) {
    this.userId = userId;
    this.userType = userType;
  }

  /**
   * Clear user on logout
   */
  clearUser() {
    this.userId = null;
    this.userType = null;
  }

  /**
   * Track a generic event
   */
  track(event: AnalyticsEvent) {
    const enrichedEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      userType: this.userType,
      page: window.location.pathname,
      referrer: document.referrer,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      userAgent: navigator.userAgent,
    };

    this.queue.push(enrichedEvent);

    // Flush immediately for high-value events
    if (event.category === 'conversion') {
      this.flush();
    }
  }

  /**
   * Track a CTA click
   */
  trackCTA(cta: keyof typeof HIGH_VALUE_CTAS, location: string, metadata?: Record<string, any>) {
    const ctaConfig = HIGH_VALUE_CTAS[cta];

    this.track({
      event: `cta_${ctaConfig.name}`,
      category: ctaConfig.category as AnalyticsEvent['category'],
      label: location,
      metadata: {
        ctaName: ctaConfig.name,
        businessValue: ctaConfig.businessValue,
        ...metadata,
      },
    });

    // Log to console in development
    if (import.meta.env.DEV) {
      console.log(`[Analytics] CTA: ${ctaConfig.name}`, { location, metadata });
    }
  }

  /**
   * Track page view
   */
  trackPageView(pageName: string, metadata?: Record<string, any>) {
    this.track({
      event: 'page_view',
      category: 'navigation',
      label: pageName,
      metadata,
    });
  }

  /**
   * Track form submission
   */
  trackFormSubmission(formName: string, success: boolean, metadata?: Record<string, any>) {
    this.track({
      event: success ? 'form_success' : 'form_failure',
      category: success ? 'conversion' : 'error',
      label: formName,
      metadata,
    });
  }

  /**
   * Track error
   */
  trackError(errorType: string, errorMessage: string, metadata?: Record<string, any>) {
    this.track({
      event: 'error',
      category: 'error',
      label: errorType,
      metadata: {
        message: errorMessage,
        ...metadata,
      },
    });
  }

  /**
   * Track timing (e.g., API response time)
   */
  trackTiming(category: string, variable: string, timeMs: number) {
    this.track({
      event: 'timing',
      category: 'engagement',
      label: `${category}:${variable}`,
      value: timeMs,
    });
  }

  /**
   * Flush queued events to backend
   */
  private async flush() {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    try {
      // Use sendBeacon for reliability on page unload
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ events })], { type: 'application/json' });
        navigator.sendBeacon(`${this.apiUrl}/api/analytics/events`, blob);
      } else {
        await fetch(`${this.apiUrl}/api/analytics/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events }),
          credentials: 'include',
        });
      }
    } catch (error) {
      // Re-queue failed events
      this.queue.unshift(...events);
      console.error('[Analytics] Failed to flush events:', error);
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

// Singleton instance
export const analytics = new Analytics();

// React hook for analytics
export function useAnalytics() {
  return {
    trackCTA: analytics.trackCTA.bind(analytics),
    trackPageView: analytics.trackPageView.bind(analytics),
    trackFormSubmission: analytics.trackFormSubmission.bind(analytics),
    trackError: analytics.trackError.bind(analytics),
    trackTiming: analytics.trackTiming.bind(analytics),
    setUser: analytics.setUser.bind(analytics),
    clearUser: analytics.clearUser.bind(analytics),
  };
}

// HOC for tracking button clicks
export function withAnalytics<P extends { onClick?: () => void }>(
  WrappedComponent: React.ComponentType<P>,
  ctaName: keyof typeof HIGH_VALUE_CTAS,
  location: string
) {
  return function AnalyticsWrapper(props: P) {
    const handleClick = () => {
      analytics.trackCTA(ctaName, location);
      props.onClick?.();
    };

    return <WrappedComponent {...props} onClick={handleClick} />;
  };
}

export default analytics;
