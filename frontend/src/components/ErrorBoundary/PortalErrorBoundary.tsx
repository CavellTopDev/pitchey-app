import React, { Component, ErrorInfo, ReactNode } from 'react';
// import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCw, Home, MessageCircle } from 'lucide-react';

interface PortalErrorBoundaryProps {
  children: ReactNode;
  portalType: 'creator' | 'investor' | 'production' | 'admin';
  userId?: string | number;
  userName?: string;
  fallback?: ReactNode;
}

interface PortalErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
  retryCount: number;
}

export class PortalErrorBoundary extends Component<PortalErrorBoundaryProps, PortalErrorBoundaryState> {
  private readonly MAX_RETRIES = 3;

  constructor(props: PortalErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorId: '',
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<PortalErrorBoundaryState> {
    const errorId = `portal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { portalType, userId, userName } = this.props;
    const { errorId } = this.state;

    // Create detailed error context
    const errorContext = {
      errorId,
      portal: portalType,
      userId: userId || 'unknown',
      userName: userName || 'unknown',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...this.extractErrorDetails(error, errorInfo)
    };

    // Log to console for debugging
    console.error(`[${portalType.toUpperCase()} Portal Error ${errorId}]:`, {
      error,
      errorInfo,
      context: errorContext
    });

    // Send to Sentry with enhanced context - temporarily disabled
    console.error('Portal Error Boundary:', {
      portalType,
      errorId,
      retryCount: this.state.retryCount,
      componentStack: errorInfo.componentStack,
      userId,
      userName
    });

    this.setState({ errorInfo });
  }

  private extractErrorDetails(error: Error, errorInfo: ErrorInfo) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
      // Extract component name from stack if possible
      failedComponent: this.extractComponentName(errorInfo.componentStack)
    };
  }

  private extractComponentName(componentStack?: string): string {
    if (!componentStack) return 'Unknown';
    
    const match = componentStack.match(/in (\w+)/);
    return match ? match[1] : 'Unknown';
  }

  private getPortalSpecificContext() {
    const { portalType } = this.props;
    
    // Get portal-specific data from localStorage or session
    const context: Record<string, any> = {
      lastAction: sessionStorage.getItem(`${portalType}_last_action`) || 'unknown',
      sessionDuration: this.getSessionDuration(),
    };

    // Add portal-specific metrics
    switch (portalType) {
      case 'creator':
        context.activePitches = sessionStorage.getItem('active_pitches_count') || '0';
        context.lastPitchAction = sessionStorage.getItem('last_pitch_action') || 'none';
        break;
      case 'investor':
        context.portfolioSize = sessionStorage.getItem('portfolio_size') || '0';
        context.activeInvestments = sessionStorage.getItem('active_investments') || '0';
        break;
      case 'production':
        context.activeProjects = sessionStorage.getItem('active_projects') || '0';
        context.inProduction = sessionStorage.getItem('in_production_count') || '0';
        break;
      case 'admin':
        context.adminLevel = sessionStorage.getItem('admin_level') || 'standard';
        context.lastAdminAction = sessionStorage.getItem('last_admin_action') || 'none';
        break;
    }

    return context;
  }

  private getSeverityLevel(portalType: string, error: Error): string {
    // Admin errors are more critical
    if (portalType === 'admin') return 'error';
    
    // Network errors are warnings
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'warning';
    }
    
    // Default to error for other portal errors
    return 'error';
  }

  private getSessionDuration(): number {
    const sessionStart = sessionStorage.getItem('session_start');
    if (!sessionStart) return 0;
    
    return Math.floor((Date.now() - parseInt(sessionStart)) / 1000);
  }

  private handleRetry = () => {
    if (this.state.retryCount < this.MAX_RETRIES) {
      this.setState((prevState) => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleContactSupport = () => {
    const { errorId, error } = this.state;
    const { portalType } = this.props;
    
    const subject = encodeURIComponent(`Error in ${portalType} portal - ${errorId}`);
    const body = encodeURIComponent(`
Error ID: ${errorId}
Portal: ${portalType}
Error: ${error?.message || 'Unknown error'}
Time: ${new Date().toISOString()}

Please describe what you were doing when the error occurred:
    `);
    
    window.open(`mailto:support@pitchey.com?subject=${subject}&body=${body}`);
  };

  render() {
    if (this.state.hasError) {
      const { portalType, fallback } = this.props;
      const { error, errorId, retryCount } = this.state;

      // Use custom fallback if provided
      if (fallback) {
        return <>{fallback}</>;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Oops! Something went wrong
              </h1>
              
              <p className="text-gray-600 mb-6">
                We encountered an error in the {portalType} portal. 
                {retryCount > 0 && ` (Retry ${retryCount}/${this.MAX_RETRIES})`}
              </p>

              <div className="bg-gray-50 rounded p-4 mb-6 text-left">
                <p className="text-sm text-gray-500 mb-1">Error ID:</p>
                <code className="text-xs text-gray-700 break-all">{errorId}</code>
                
                {import.meta.env.DEV && error && (
                  <>
                    <p className="text-sm text-gray-500 mt-3 mb-1">Error Message:</p>
                    <code className="text-xs text-red-600 break-all">{error.message}</code>
                  </>
                )}
              </div>

              <div className="space-y-3">
                {retryCount < this.MAX_RETRIES && (
                  <button
                    onClick={this.handleRetry}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </button>
                )}

                <button
                  onClick={this.handleGoHome}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                >
                  <Home className="w-4 h-4" />
                  Go to Homepage
                </button>

                <button
                  onClick={this.handleContactSupport}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  Contact Support
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-6">
                This error has been automatically reported to our team.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for easy wrapping of portal components
export function withPortalErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  portalType: 'creator' | 'investor' | 'production' | 'admin'
) {
  return React.forwardRef<any, P>((props, ref) => {
    // Try to get user info from auth store if available
    const userId = (window as any).__authStore?.user?.id;
    const userName = (window as any).__authStore?.user?.username;

    return (
      <PortalErrorBoundary 
        portalType={portalType}
        userId={userId}
        userName={userName}
      >
        <Component {...props} ref={ref} />
      </PortalErrorBoundary>
    );
  });
}

// Sentry-integrated error boundary - temporarily disabled
export const SentryPortalErrorBoundary = ({ children }: { children: ReactNode }) => <>{children}</>;