import { useEffect, useCallback, useMemo } from 'react';
// import * as Sentry from '@sentry/react'; // Temporarily disabled
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
    // Set user context - temporarily disabled
    if (user && typeof Sentry !== 'undefined') {
      Sentry.setUser({
        id: String(user.id),
        email: user.email,
        username: user.username,
        portal: portalType,
        userType: user.userType
      });
    }

    // Set portal-specific tags
    // Sentry.setTag('portal', portalType);
    // Sentry.setTag('component', componentName);
    
    // Set custom tags
    Object.entries(customTags).forEach(([key, value]) => {
      // Sentry.setTag(key, value);
    });

    // Add breadcrumb for navigation - temporarily disabled

    // Start performance transaction if enabled - temporarily disabled
    let transaction: any | undefined;
    
    if (trackPerformance) {
    }

    // Store portal activity for error context
    sessionStorage.setItem(`${portalType}_last_component`, componentName);
    sessionStorage.setItem(`${portalType}_last_activity`, new Date().toISOString());

    // Cleanup function
    return () => {
      // Finish performance transaction
      if (transaction) {
        transaction.finish();
      }

      // Add breadcrumb for leaving component - temporarily disabled
    };
  }, [portalType, componentName, user, trackPerformance]);

  // Helper function to get time spent in component
  function getComponentDuration(): number {
    const lastActivity = sessionStorage.getItem(`${portalType}_last_activity`);
    if (!lastActivity) return 0;
    return Date.now() - new Date(lastActivity).getTime();
  }

  // Error reporting function with portal context - temporarily disabled
  // Memoized to prevent infinite re-render loops in dependent useEffect/useCallback hooks
  const reportError = useCallback((error: Error, context?: Record<string, any>) => {
    console.error('Portal error captured:', error, {
      portalType,
      componentName,
      userId: user?.id,
      userType: user?.userType,
      ...context
    });
  }, [portalType, componentName, user?.id, user?.userType]);

  // Track custom events - temporarily disabled
  // Memoized to prevent infinite re-render loops
  const trackEvent = useCallback((eventName: string, data?: Record<string, any>) => {
    console.info(`Portal Event: ${eventName}`, {
      portal: portalType,
      component: componentName,
      ...data
    });
  }, [portalType, componentName]);

  // Track API errors with context - temporarily disabled
  // Memoized to prevent infinite re-render loops
  const trackApiError = useCallback((endpoint: string, error: any, requestData?: any) => {
    console.error('API Error:', {
      endpoint,
      portal: portalType,
      component: componentName,
      requestData: requestData ? JSON.stringify(requestData).substring(0, 1000) : undefined,
      responseStatus: error.status || error.response?.status,
      responseData: error.response?.data
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