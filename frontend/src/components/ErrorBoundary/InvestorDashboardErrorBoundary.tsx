import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
// import * as Sentry from '@sentry/react';
import { Link } from 'react-router-dom';

interface Props {
  children: ReactNode;
  fallbackComponent?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  eventId: string | null;
}

export class InvestorDashboardErrorBoundary extends Component<Props, State> {
  private retryCount: number = 0;
  private maxRetries: number = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Enhanced Sentry reporting for investor dashboard
    const eventId = // Sentry.captureException(error, {
      tags: {
        component: 'investor-dashboard',
        errorBoundary: 'InvestorDashboardErrorBoundary',
        route: window.location.pathname,
        userAgent: navigator.userAgent.slice(0, 100)
      },
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
          errorBoundary: this.constructor.name
        },
        dashboard: {
          retryCount: this.retryCount,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          referrer: document.referrer
        }
      },
      extra: {
        errorInfo,
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
        localStorage: this.getLocalStorageData(),
        sessionData: this.getSessionData()
      },
      level: 'error'
    });

    this.setState({ eventId });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console for debugging
    console.error('🚨 Investor Dashboard Error Boundary triggered:', error, errorInfo);
  }

  private getLocalStorageData() {
    try {
      return {
        user: localStorage.getItem('user') ? 'present' : 'absent',
        token: localStorage.getItem('token') ? 'present' : 'absent',
        theme: localStorage.getItem('theme'),
        lastActivity: localStorage.getItem('lastActivity')
      };
    } catch (e) {
      return { error: 'Unable to access localStorage' };
    }
  }

  private getSessionData() {
    try {
      return {
        sessionStorage: sessionStorage.length > 0 ? 'has-data' : 'empty',
        timestamp: Date.now(),
        userAgent: navigator.userAgent.slice(0, 100)
      };
    } catch (e) {
      return { error: 'Unable to access sessionStorage' };
    }
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount += 1;
      
      // Add breadcrumb for retry attempt
      // Sentry.addBreadcrumb({
        message: `Dashboard retry attempt ${this.retryCount}`,
        category: 'user.interaction',
        level: 'info',
        data: {
          retryCount: this.retryCount,
          maxRetries: this.maxRetries,
          timestamp: new Date().toISOString()
        }
      });

      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        eventId: null
      });
    }
  };

  private handleReload = () => {
    // Track page reload in Sentry
    // Sentry.addBreadcrumb({
      message: 'User triggered page reload from error boundary',
      category: 'user.interaction',
      level: 'info',
      data: {
        retryCount: this.retryCount,
        timestamp: new Date().toISOString()
      }
    });

    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback component if provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      // Default investor dashboard error UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                Dashboard Error
              </h1>
              
              <p className="text-gray-600 mb-6">
                Something went wrong with your investor dashboard. Our team has been notified and is working on a fix.
              </p>

              {/* Error ID for support */}
              {this.state.eventId && (
                <div className="bg-gray-50 rounded-lg p-3 mb-6">
                  <p className="text-sm text-gray-600 mb-1">Error ID for support:</p>
                  <code className="text-xs font-mono bg-white px-2 py-1 rounded border">
                    {this.state.eventId}
                  </code>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-3">
                {this.retryCount < this.maxRetries && (
                  <button
                    onClick={this.handleRetry}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again ({this.maxRetries - this.retryCount} attempts left)
                  </button>
                )}
                
                <button
                  onClick={this.handleReload}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reload Page
                </button>
                
                <Link
                  to="/investor/browse"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Browse Opportunities
                </Link>
              </div>

              {/* Debug info in development */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-6 text-left">
                  <summary className="text-sm font-medium text-gray-700 cursor-pointer mb-2">
                    Debug Information
                  </summary>
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-xs">
                    <pre className="whitespace-pre-wrap text-red-700">
                      {this.state.error.toString()}
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-Order Component for wrapping dashboard sections
export const withInvestorDashboardErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallbackComponent?: ReactNode
) => {
  return (props: P) => (
    <InvestorDashboardErrorBoundary fallbackComponent={fallbackComponent}>
      <Component {...props} />
    </InvestorDashboardErrorBoundary>
  );
};

// Hook for manual error reporting from dashboard components
export const useInvestorDashboardErrorReporting = () => {
  return {
    reportError: (error: Error, context?: Record<string, any>) => {
      // Sentry.captureException(error, {
        tags: {
          component: 'investor-dashboard',
          reportedManually: true,
          route: window.location.pathname
        },
        extra: {
          context,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent.slice(0, 100)
        }
      });
    },
    addBreadcrumb: (message: string, data?: Record<string, any>) => {
      // Sentry.addBreadcrumb({
        message,
        category: 'dashboard.action',
        level: 'info',
        data: {
          ...data,
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};