import { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { useAuthStore } from '../store/authStore';

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
  const { user } = useAuthStore();
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
      data: {
        portal: portalType,
        component: componentName,
        userId: user?.id,
        timestamp: new Date().toISOString()
      }
    });

    // Start performance transaction if enabled
    let transaction: ReturnType<typeof Sentry.startTransaction> | undefined;
    
    if (trackPerformance && Sentry.getCurrentHub().getClient()) {
      transaction = Sentry.startTransaction({
        name: `${portalType}.${componentName}`,
        op: 'navigation',
        tags: {
          portal: portalType,
          component: componentName,
          ...customTags
        }
      });

      Sentry.getCurrentHub().configureScope(scope => scope.setSpan(transaction));
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

      // Add breadcrumb for leaving component
      Sentry.addBreadcrumb({
        category: 'navigation',
        message: `Left ${componentName} in ${portalType} portal`,
        level: 'info',
        data: {
          portal: portalType,
          component: componentName,
          duration: getComponentDuration()
        }
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
  const reportError = (error: Error, context?: Record<string, any>) => {
    Sentry.withScope((scope) => {
      scope.setTag('portal', portalType);
      scope.setTag('component', componentName);
      scope.setContext('portal_context', {
        portalType,
        componentName,
        userId: user?.id,
        userType: user?.userType,
        ...context
      });

      Sentry.captureException(error);
    });
  };

  // Track custom events
  const trackEvent = (eventName: string, data?: Record<string, any>) => {
    Sentry.addBreadcrumb({
      category: 'user-action',
      message: eventName,
      level: 'info',
      data: {
        portal: portalType,
        component: componentName,
        ...data
      }
    });

    // Also track as custom event for analytics
    if (Sentry.getCurrentHub().getClient()) {
      Sentry.captureMessage(`${portalType}.${eventName}`, 'info');
    }
  };

  // Track API errors with context
  const trackApiError = (endpoint: string, error: any, requestData?: any) => {
    Sentry.withScope((scope) => {
      scope.setTag('portal', portalType);
      scope.setTag('api.endpoint', endpoint);
      scope.setTag('api.error', true);
      
      scope.setContext('api_error', {
        endpoint,
        portal: portalType,
        component: componentName,
        requestData: requestData ? JSON.stringify(requestData).substring(0, 1000) : undefined,
        responseStatus: error.status || error.response?.status,
        responseData: error.response?.data
      });

      Sentry.captureException(new Error(`API Error: ${endpoint}`), {
        fingerprint: [portalType, endpoint, error.status || 'unknown']
      });
    });
  };

  return {
    reportError,
    trackEvent,
    trackApiError
  };
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