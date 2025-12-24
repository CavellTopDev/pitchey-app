import React, { lazy, Suspense, ComponentType } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Loading fallback component with centered spinner
 */
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[200px] w-full">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

/**
 * Page-level loading fallback with full screen spinner
 */
const PageLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen w-full">
    <div className="text-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

/**
 * Error boundary fallback component
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex items-center justify-center min-h-[200px] w-full">
            <div className="text-center">
              <p className="text-destructive font-semibold mb-2">
                Something went wrong
              </p>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-muted-foreground underline"
              >
                Reload page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

/**
 * Wrapper for lazy loaded components with loading and error states
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options?: {
    fallback?: React.ReactNode;
    errorFallback?: React.ReactNode;
    isPage?: boolean;
  }
) {
  const LazyComponent = lazy(importFunc);

  return (props: React.ComponentProps<T>) => (
    <ErrorBoundary fallback={options?.errorFallback}>
      <Suspense
        fallback={
          options?.fallback ||
          (options?.isPage ? <PageLoadingFallback /> : <LoadingFallback />)
        }
      >
        <LazyComponent {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Preload a lazy component (useful for predictive loading)
 */
export function preloadComponent(
  importFunc: () => Promise<any>
): Promise<any> {
  return importFunc();
}

/**
 * Lazy load heavy components
 */

// Analytics components
export const AnalyticsDashboard = lazyLoad(
  () => import('@/components/Analytics/AnalyticsDashboard'),
  { isPage: false }
);

// Team components
export const TeamManagement = lazyLoad(
  () => import('@/components/Team/TeamManagement'),
  { isPage: false }
);

// Browse components
export const EnhancedBrowseView = lazyLoad(
  () => import('@/components/Browse/EnhancedBrowseView'),
  { isPage: false }
);

// Character components
export const CharacterManager = lazyLoad(
  () => import('@/components/Characters/CharacterManager'),
  { isPage: false }
);

// Visibility components
export const VisibilitySettings = lazyLoad(
  () => import('@/components/Visibility/VisibilitySettings'),
  { isPage: false }
);

// Page-level lazy loading
export const LazyPages = {
  // Creator pages
  CreatePitch: lazyLoad(
    () => import('@/pages/CreatePitch'),
    { isPage: true }
  ),
  EditPitch: lazyLoad(
    () => import('@/pages/EditPitch'),
    { isPage: true }
  ),
  CreatorDashboard: lazyLoad(
    () => import('@/pages/CreatorDashboard'),
    { isPage: true }
  ),
  
  // Investor pages
  InvestorDashboard: lazyLoad(
    () => import('@/pages/InvestorDashboard'),
    { isPage: true }
  ),
  Portfolio: lazyLoad(
    () => import('@/pages/Portfolio'),
    { isPage: true }
  ),
  
  // Production pages
  ProductionDashboard: lazyLoad(
    () => import('@/pages/ProductionDashboard'),
    { isPage: true }
  ),
  
  // Shared pages
  PitchDetail: lazyLoad(
    () => import('@/pages/PitchDetail'),
    { isPage: true }
  ),
  Browse: lazyLoad(
    () => import('@/pages/Browse'),
    { isPage: true }
  ),
  Settings: lazyLoad(
    () => import('@/pages/Settings'),
    { isPage: true }
  ),
  Profile: lazyLoad(
    () => import('@/pages/Profile'),
    { isPage: true }
  ),
};

/**
 * Route-based preloading strategy
 * Call this when user hovers over navigation links
 */
export const preloadStrategies = {
  // Preload dashboard based on user role
  preloadDashboard: (role: 'creator' | 'investor' | 'production') => {
    switch (role) {
      case 'creator':
        return preloadComponent(() => import('@/pages/CreatorDashboard'));
      case 'investor':
        return preloadComponent(() => import('@/pages/InvestorDashboard'));
      case 'production':
        return preloadComponent(() => import('@/pages/ProductionDashboard'));
    }
  },
  
  // Preload pitch creation (for creators)
  preloadPitchCreation: () => {
    return Promise.all([
      preloadComponent(() => import('@/pages/CreatePitch')),
      preloadComponent(() => import('@/components/Characters/CharacterManager')),
    ]);
  },
  
  // Preload browse and search
  preloadBrowse: () => {
    return Promise.all([
      preloadComponent(() => import('@/pages/Browse')),
      preloadComponent(() => import('@/components/Browse/EnhancedBrowseView')),
    ]);
  },
  
  // Preload analytics (for all portals)
  preloadAnalytics: () => {
    return preloadComponent(() => import('@/components/Analytics/AnalyticsDashboard'));
  },
  
  // Preload team management
  preloadTeam: () => {
    return preloadComponent(() => import('@/components/Team/TeamManagement'));
  },
};

/**
 * Intersection Observer for predictive preloading
 * Preloads components when they're about to enter viewport
 */
export function usePredictivePreload(
  preloadFunc: () => Promise<any>,
  threshold = 0.5
) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [hasPreloaded, setHasPreloaded] = React.useState(false);

  React.useEffect(() => {
    if (!ref.current || hasPreloaded) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasPreloaded) {
          preloadFunc();
          setHasPreloaded(true);
        }
      },
      { threshold }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [preloadFunc, threshold, hasPreloaded]);

  return ref;
}

/**
 * Hook for navigation-based preloading
 */
export function useNavigationPreload() {
  const handleLinkHover = React.useCallback((route: string) => {
    // Preload based on route patterns
    if (route.includes('/create-pitch')) {
      preloadStrategies.preloadPitchCreation();
    } else if (route.includes('/browse')) {
      preloadStrategies.preloadBrowse();
    } else if (route.includes('/analytics')) {
      preloadStrategies.preloadAnalytics();
    } else if (route.includes('/team')) {
      preloadStrategies.preloadTeam();
    } else if (route.includes('/dashboard')) {
      // Determine user role and preload appropriate dashboard
      const userRole = localStorage.getItem('userRole') as 'creator' | 'investor' | 'production';
      if (userRole) {
        preloadStrategies.preloadDashboard(userRole);
      }
    }
  }, []);

  return { handleLinkHover };
}

export default lazyLoad;