import { useEffect, useCallback, useMemo } from 'react';
import * as Sentry from '@sentry/react';
import { useBetterAuthStore } from '../store/betterAuthStore';

export type PortalType = 'creator' | 'investor' | 'production' | 'admin';

interface SentryPortalConfig {
  portalType: PortalType;
  componentName: string;
  trackPerformance?: boolean;
  customTags?: Record<string, string>;
}

/**
 * Custom hook to integrate Sentry tracking for portal components
 * Automatically tracks navigation, errors, and performance
 */
export function useSentryPortal(config: SentryPortalConfig) {
  const { user } = useBetterAuthStore();
  const { portalType, componentName, trackPerformance = true, customTags = {} } = config;

  useEffect(() => {
    // Set user context
    if (user) {
      Sentry.setUser({
        id: String(user.id),
        email: user.email,
        username: user.username,
        portal: portalType,
        userType: user.userType
      });
    }

    // Set portal-specific tags
    Sentry.setTag('portal', portalType);
    Sentry.setTag('component', componentName);

    // Set custom tags
    Object.entries(customTags).forEach(([key, value]) => {
      Sentry.setTag(key, value);
    });

    // Add breadcrumb for navigation
    Sentry.addBreadcrumb({
      category: 'navigation',
      message: `Entered ${componentName} in ${portalType} portal`,
      level: 'info',
    });

    // Start performance span if enabled (Sentry v8 API)
    let span: ReturnType<typeof Sentry.startInactiveSpan> | undefined;

    if (trackPerformance) {
      span = Sentry.startInactiveSpan({
        name: `${portalType}.${componentName}`,
        op: 'component',
      });
    }

    // Store portal activity for error context
    sessionStorage.setItem(`${portalType}_last_component`, componentName);
    sessionStorage.setItem(`${portalType}_last_activity`, new Date().toISOString());

    // Cleanup function
    return () => {
      // End performance span
      if (span) {
        span.end();
      }

      // Add breadcrumb for leaving component
      Sentry.addBreadcrumb({
        category: 'navigation',
        message: `Left ${componentName} in ${portalType} portal`,
        level: 'info',
      });
    };
  }, [portalType, componentName, user, trackPerformance]);

  // Helper function to get time spent in component
  function getComponentDuration(): number {
    const lastActivity = sessionStorage.getItem(`${portalType}_last_activity`);
    if (!lastActivity) return 0;
    return Date.now() - new Date(lastActivity).getTime();
  }

  // Error reporting function with portal context
  // Memoized to prevent infinite re-render loops in dependent useEffect/useCallback hooks
  const reportError = useCallback((error: Error, context?: Record<string, any>) => {
    Sentry.withScope((scope) => {
      scope.setTag('portal', portalType);
      scope.setTag('component', componentName);
      scope.setExtra('userId', user?.id);
      scope.setExtra('userType', user?.userType);
      if (context) scope.setContext('custom', context);
      Sentry.captureException(error);
    });
  }, [portalType, componentName, user?.id, user?.userType]);

  // Track custom events
  // Memoized to prevent infinite re-render loops
  const trackEvent = useCallback((eventName: string, data?: Record<string, any>) => {
    Sentry.addBreadcrumb({
      category: 'portal.event',
      message: eventName,
      level: 'info',
      data: {
        portal: portalType,
        component: componentName,
        ...data
      }
    });
  }, [portalType, componentName]);

  // Track API errors with context
  // Memoized to prevent infinite re-render loops
  const trackApiError = useCallback((endpoint: string, error: any, requestData?: any) => {
    Sentry.withScope((scope) => {
      scope.setTag('portal', portalType);
      scope.setTag('component', componentName);
      scope.setTag('api.endpoint', endpoint);
      scope.setExtra('requestData', requestData ? JSON.stringify(requestData).substring(0, 1000) : undefined);
      scope.setExtra('responseStatus', error.status || error.response?.status);
      scope.setExtra('responseData', error.response?.data);
      Sentry.captureException(error instanceof Error ? error : new Error(`API Error: ${endpoint}`));
    });
  }, [portalType, componentName]);

  // Memoize the return object to maintain stable reference
  return useMemo(() => ({
    reportError,
    trackEvent,
    trackApiError
  }), [reportError, trackEvent, trackApiError]);
}

/**
 * Portal-specific Sentry configuration presets
 */
export const PORTAL_SENTRY_CONFIG = {
  creator: {
    tags: {
      portal: 'creator',
      role: 'content-creator'
    },
    breadcrumbs: {
      'pitch.create': 'Creating new pitch',
      'pitch.edit': 'Editing pitch',
      'pitch.delete': 'Deleting pitch',
      'analytics.view': 'Viewing analytics',
      'nda.manage': 'Managing NDAs'
    }
  },
  investor: {
    tags: {
      portal: 'investor',
      role: 'investor'
    },
    breadcrumbs: {
      'pitch.view': 'Viewing pitch details',
      'investment.create': 'Creating investment',
      'portfolio.view': 'Viewing portfolio',
      'nda.request': 'Requesting NDA',
      'saved.manage': 'Managing saved pitches'
    }
  },
  production: {
    tags: {
      portal: 'production',
      role: 'production-company'
    },
    breadcrumbs: {
      'project.view': 'Viewing project',
      'pitch.evaluate': 'Evaluating pitch',
      'talent.search': 'Searching talent',
      'production.plan': 'Planning production'
    }
  },
  admin: {
    tags: {
      portal: 'admin',
      role: 'administrator'
    },
    breadcrumbs: {
      'users.manage': 'Managing users',
      'content.moderate': 'Moderating content',
      'analytics.system': 'Viewing system analytics',
      'reports.generate': 'Generating reports'
    }
  }
};